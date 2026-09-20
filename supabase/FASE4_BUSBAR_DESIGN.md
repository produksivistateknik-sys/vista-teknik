# Fase 4 — Migrasi `component_process_progress`: BUSBAR

**Sifat**: Riset + desain, sama seperti Fase 2/3. **TIDAK ADA migrasi/kode dieksekusi.** Menunggu
konfirmasi sebelum lanjut ke migrasi SQL/kode sebenarnya. Urutan ini sesuai sketsa awal
(`FASE2_COMPONENT_PROCESS_PROGRESS_DESIGN.md` bagian 6): BUSBAR sengaja terakhir sebelum proses
"biasa" — domain paling kompleks (4 sub-tahap), diriset setelah pola tahap-generik teruji stabil
dari Pasang Komponen (1 tahap) dan WIRING CONTROL/POWER (0 tahap).

---

## 1. Beda BUSBAR dari 2 domain sebelumnya — perbedaan paling fundamental

### 1a. Relevansi TIDAK punya sumber kebenaran statis (beda dari `bom_proses_relevan`)
Pasang Komponen & WIRING CONTROL/POWER: relevansi = fakta struktural stabil di `bom_proses_relevan`
(ada barisnya atau tidak, gak berubah-ubah). **BUSBAR TIDAK PUNYA INI** — dikonfirmasi eksplisit di
komentar `CLAUDE.md` B.2: *"relevansi 'panel ini butuh BUSBAR atau tidak' WAJIB pakai
`getBusbarKomponen(tipe)` — BUKAN `bom_proses_relevan`"*. Dicek langsung ke kode
(`panelHelpers.ts:33-41`, `getPanelBusbarKomponen`):
```
relevan = (pernah dijadwalkan di raw_schedule.busbar_schedule)
        ∪ (punya data progress di checklist - komponenBusbarPunyaData)
        ∪ (punya key di panels.busbar_progress legacy)
```
Ini **bukti retroaktif** (baru tahu "relevan" SETELAH ada aktivitas), bukan fakta yang bisa
dicek di muka seperti BOM. Konsekuensi buat seeding: kalau komponen busbar (LINE/NETRAL/dst)
BELUM PERNAH dijadwalkan/disentuh sama sekali di sebuah panel, sistem **tidak bisa tahu** apakah
itu "belum relevan" atau "gak akan pernah relevan" — beda total dari Pasang Komponen/WIRING yang
selalu bisa tahu pasti dari BOM. **Keputusan desain (bagian 4)**: JANGAN seed baris
`not_applicable` utk komponen tanpa bukti sama sekali — biarkan baris tercipta natural pas
pertama kali disentuh (dual-write), bukan dipaksa ada di muka.

### 1b. 3 write function, TERNYATA cuma 2 yang relevan (diverifikasi kode, bukan diasumsikan)
Ambil pelajaran dari Fase 3 (`lockProgress` yang kelewat) — dicek EKSPLISIT: apakah `lockProgress`
(tombol bulk) juga menyentuh BUSBAR? **Jawaban: TIDAK**, dikonfirmasi baca kode
`OperatorView.tsx:783`: `canLockKomponen=(...)=>{ if(proses==="BUSBAR")return false; ...}` — guard
ini bikin loop generik `lockProgress` SELALU skip BUSBAR (`if(!canLockKomponen(...))return;`
langsung kena di awal). Jadi cuma 2 fungsi nyata:
- `updatePctManualBusbarTahap(panelId,kode,tahap,pct)` — live, tiap klik PCT_STEPS 1 tahap.
- `simpanProgressTahapBusbar(panelId,kode,tahap)` — commit 1 tahap (checkpoint+history+
  `fcs_timer_kerja.progress` snapshot).

`lockProgress` MEMANG masih menyentuh BUSBAR, tapi HANYA update kolom legacy `panels.busbar_progress`
(bagian terpisah di fungsi yang sama, `busbarTasks`/`busbarProgressUpdate`) — **bukan**
`checklist`/history, jadi di luar scope dual-write (poin 1c).

### 1c. Kolom legacy `busbar_progress` — temuan sampingan, TIDAK disentuh
Komentar di `panelHelpers.ts:11-16` klaim *"busbar_progress berhenti diisi ... sekarang selalu {}
di semua panel"* — **dicek live, TERNYATA SALAH**: 16 dari 26 panel live punya `busbar_progress`
TIDAK kosong, nilainya sinkron dengan checklist (mis. panel 375: `H-BUS:100,GROUND:100,...`,
cocok sama checklist-nya). Root cause: `lockProgress` MASIH aktif nulis ke kolom ini tiap bulk-lock
(kode belum dihapus walau komentar bilang "berhenti"). Ini **bukan bug yang perlu diperbaiki
sekarang** (di luar scope Fase 4, dicatat sesuai CLAUDE.md G.4) — disebut di sini cuma supaya
jelas: `component_process_progress` TIDAK PERLU peduli kolom ini sama sekali, `getBusbarProgress()`
yang sudah ada (dipakai semua consumer baca) sudah baca `checklist` DULU baru fallback ke kolom
legacy — pola baca ini TIDAK berubah oleh Fase 4.

### 1d. Operator per-tahap, BUKAN per-kode
`pekerja_per_komponen[kode]` normalnya array flat (`[id1,id2]`) — **BUSBAR beda**, bentuknya
object per-tahap: `{FABRIKASI:[id,...],PLATING:[id,...],...}` (`panelHelpers.tsx:71-79`,
`getFlatOperatorIds` sengaja dibikin defensif buat ini). Konsekuensi: resolusi nama operator per
baris `component_process_progress` (1 baris = 1 tahap) tinggal ambil
`pekerja_per_komponen[kode][tahap]` langsung — LEBIH SEDERHANA dari WIRING/Pasang Komponen
sebenarnya (gak perlu gabung-cabang kayak sebelumnya), karena struktur data sumbernya SUDAH
per-tahap dari awal.

---

## 2. Survei data live

- **49 kode (panel×komponen) punya `busbarTahap` terisi** dari sample 26 panel aktif — 37 dengan
  4 tahap penuh (FABRIKASI/PLATING/HEATSHRINK/PASANG), 12 dengan 3 tahap
  (`getUrutanTahapBusbar`: COUPLER/GROUND skip HEATSHRINK).
- **Shape per kode** (`checklist[kode]`, kode = LINE/NETRAL/GROUND/COUPLER/INCOMING/OUTGOING/H-BUS):
  ```
  qty: 0 (selalu - bukan komponen fisik ber-qty, pseudo-komponen)
  busbarTahap.{FABRIKASI,PLATING,HEATSHRINK,PASANG}: {progress, sudahDisimpan100}
  progress.BUSBAR: number (= hitungProgressBusbarGabungan, rata-rata urutan tahap)
  progressByDate.BUSBAR[tanggal]: number (gabungan, sama kayak proses lain)
  history.BUSBAR: [{ts,pct,shift,tanggal}] (gabungan, commit tiap Simpan Progress per-tahap)
  ```
- **`fcs_timer_kerja`**: proses-agnostik seperti dugaan, `tahap` diisi nama tahap BUSBAR asli
  (bukan NULL kayak WIRING) — **1 penyesuaian existing yang SUDAH ADA**: kolom `progress` (numeric,
  nullable) dipakai simpan snapshot persen tahap itu SAAT sesi timer itu di-Simpan
  (`simpanProgressTahapBusbar` baris ~1386-1396) — fitur yang SUDAH ADA, TIDAK terkait
  `component_process_progress`, disebut di sini cuma biar gak ketuker konsepnya.
- **Trigger `panels_validate_busbar_cap_progress`** (BEFORE UPDATE OF checklist): validasi
  urutan tahap non-decreasing (FABRIKASI≤PLATING≤HEATSHRINK≤PASANG). Berlaku HANYA di level
  `checklist` — `component_process_progress` TIDAK butuh trigger/validasi setara, karena
  dual-write SELALU menulis nilai yang SUDAH lolos validasi checklist duluan (checklist gagal →
  seluruh transaksi termasuk dual-write gak akan jalan, ini konsisten pola best-effort-SETELAH-
  checklist-sukses yang sudah dipakai Fase 2/3).

---

## 3. Skema `component_process_progress` — 0 perubahan kolom, 1 keputusan desain baru

Kolom yang ada SUDAH cukup: `proses='BUSBAR'`, `tahap` diisi salah satu dari
`FABRIKASI/PLATING/HEATSHRINK/PASANG` (bukan NULL — ini domain PERTAMA yang benar-benar
memanfaatkan kolom `tahap` buat >1 nilai nyata, validasi desain awal Fase 2 kepakai).

**Keputusan: 1 baris per (panel, kode_busbar, tahap)** — 3 atau 4 baris per komponen busbar
tergantung `getUrutanTahapBusbar(kode)`. **TIDAK ADA baris "gabungan"** (tahap=NULL representasi
`progress.BUSBAR`) — kenapa:
1. Nilai gabungan = rata-rata murni dari baris-baris tahap (`hitungProgressBusbarGabungan`) -
   menyimpannya lagi sebagai baris terpisah = 2 sumber kebenaran utk 1 angka turunan, kelas bug
   yang sama persis yang coba dihindari desain Fase 2 (CLAUDE.md B.3).
2. Consumer yang butuh angka gabungan (Task Monitoring dkk) BELUM pindah baca dari tabel baru di
   fase ini (masih baca `checklist.progress.BUSBAR` seperti biasa) - jadi gak ada kebutuhan
   mendesak baris gabungan sekarang. Kalau nanti BUSBAR benar migrasi total (di luar scope Fase
   4), gabungan bisa dihitung via VIEW/RPC kecil (`avg(progress_pct) WHERE panel_id=..AND
   kode_komponen=..AND proses='BUSBAR'`), bukan kolom tersimpan.

---

## 4. Rencana dual-write

### `updatePctManualBusbarTahap` — live, tiap klik 1 tahap
Setelah `mergePanelChecklist` sukses: upsert **1 baris** `(panel,kode,'BUSBAR',tahap)` dengan
`pct` tahap itu SENDIRI (bukan `combined`). `sudahDisimpan100:false` (live, bukan commit - pola
sama Fase 2/3). Operator: `pekerja_per_komponen[kode][tahap]` (langsung, gak perlu union
lintas-tahap kayak dugaan awal - lihat 1d).

### `simpanProgressTahapBusbar` — commit 1 tahap
Setelah `mergePanelChecklist`(+checkpoint) sukses: upsert **1 baris** yang SAMA, `sudahDisimpan100`
dari rumus yang SUDAH ADA di kode (`pctTahap>=100`, `OperatorView.tsx:1346`) — bukan rumus baru.

### Seeding backfill — ASIMETRIS dari Fase 2/3 (poin 1a)
- Utk kode busbar dengan `busbarTahap` SUDAH ADA di checklist (bukti aktivitas nyata) → seed
  1 baris per tahap di `getUrutanTahapBusbar(kode)`, status dari `pctToStatus`.
- Utk kode busbar TANPA bukti sama sekali (gak ada di checklist, gak ada di `raw_schedule`
  historis, gak ada di `busbar_progress` legacy) → **TIDAK di-seed apa pun**, bukan
  `not_applicable`. Baris tercipta natural pas pertama kali `updatePctManualBusbarTahap` dipanggil.
- Operator/timestamp: dari `busbarTahap[tahap]` kalau ada, kalau enggak fallback ke checkpoint
  log TERAKHIR per (panel,kode,'BUSBAR') — sama pola koreksi yang dipelajari dari backfill Fase 3
  (histori checklist gak simpan nama operator, sumbernya `progress_checkpoint_log`).

---

## Ringkasan

1. **Skema**: 0 perubahan kolom. 1 baris per (panel, kode_busbar, tahap) — 3-4 baris per
   komponen, TIDAK ADA baris gabungan (dihindari demi 1 sumber kebenaran).
2. **Relevansi**: TIDAK ADA sumber statis (beda dari 2 domain sebelumnya) — pakai bukti aktivitas
   (`getPanelBusbarKomponen`-equivalent). Seeding jadi asimetris: kode tanpa bukti TIDAK di-seed
   `not_applicable`, dibiarkan tercipta natural.
3. **Write path**: cuma 2 fungsi nyata (`updatePctManualBusbarTahap`, `simpanProgressTahapBusbar`)
   — `lockProgress` DIKONFIRMASI (bukan diasumsikan) skip BUSBAR total via `canLockKomponen`.
4. **Validasi cap tahap**: sudah di level checklist (trigger DB), dual-write cuma mirror nilai
   yang sudah lolos - tidak perlu validasi terpisah.
5. **Temuan sampingan** (tidak disentuh): kolom legacy `panels.busbar_progress` ternyata masih
   aktif ditulis `lockProgress` walau komentar kode bilang "berhenti" — di luar scope Fase 4.
