# Fase 2 — Desain Skema `component_process_progress`

**Sifat**: Riset + desain skema. **TIDAK ADA migrasi/kode dieksekusi.** Menunggu konfirmasi sebelum lanjut ke migrasi SQL sebenarnya.

---

## 1. Survei bentuk data nyata di `panels.checklist` (dasar desain skema)

Dicek live (lanjutan audit `DATABASE_AUDIT_2026-09-20.md`) — 3 bentuk objek per-kode yang harus tertampung TANPA kehilangan data:

**(1) Proses biasa** (POTONG/BENDING/STEL/RENDAM/PAINTING/FINISHING/RAKIT/WIRING CONTROL/WIRING POWER/QC TEST/PACKING):
```
progress[proses]: number (0-100)
qtyProses[proses]: number (qty selesai, TERKINI)
qtyProsesByDate[proses][tanggal]: number
progressByDate[proses][tanggal]: number
stepDates[proses]: {} (selalu kosong di semua sample — kandidat DIABAIKAN, gak kepakai)
history[proses]: [{ts, pct, shift, tanggal, section?, sectionMulai?}]
```

**(2) Pasang Komponen — Box Control/Pintu** (tahap, setelah fix 18 Sep 2026 CUMA WIRING yang pernah keisi):
```
pasangKomponenTahap.WIRING: {progress, lastOperator:{ts,nama}}
fotoPemasangan: [{url,uploaded_by,uploaded_at}]
progress["PASANG KOMPONEN"]: number (= pasangKomponenTahap.WIRING.progress langsung, gak dirata-rata lagi)
```

**(3) BUSBAR pseudo-komponen** (`LINE/NETRAL/GROUND/COUPLER/INCOMING/OUTGOING/H-BUS`):
```
qty: 0 (selalu)
busbarTahap.{FABRIKASI,PLATING,HEATSHRINK,PASANG}: {progress, sudahDisimpan100}
  (COUPLER/GROUND cuma 3 tahap: FABRIKASI,PLATING,PASANG)
progress["BUSBAR"]: number (rata-rata busbarTahap, dihitung `hitungProgressBusbarGabungan`)
progressByDate["BUSBAR"][tanggal]: number
```

**Kesimpulan**: perbedaan struktural sebenarnya cuma 1 dimensi — **ada/tidaknya sub-tahap**. BUSBAR: 3-4 tahap. Pasang Komponen (Box Control/Pintu): 1 tahap (WIRING doang, setelah fix). Semua proses lain: 0 tahap (langsung 1 nilai). `stepDates` dan `qtyProsesByDate`/`progressByDate` terbukti REDUNDAN — bisa diturunkan dari histori (poin per-tanggal = entri histori TERAKHIR di tanggal itu), gak perlu disimpan terpisah lagi.

---

## 2. Skema yang diusulkan

```sql
CREATE TABLE public.component_process_progress (
  id bigint generated always as identity primary key,
  panel_id bigint not null references public.panels(id) on delete cascade,
  kode_komponen text not null,
  proses text not null,              -- nilai dari ALL_PROSES (POTONG, WIRING CONTROL, PASANG KOMPONEN, BUSBAR, dst)
  tahap text,                        -- NULL utk proses tanpa sub-tahap (mayoritas). Diisi utk BUSBAR
                                      -- (FABRIKASI/PLATING/HEATSHRINK/PASANG) & Pasang Komponen Box
                                      -- Control/Pintu (WIRING — satu2nya yg valid stlh fix 18 Sep).
  status text not null default 'not_started'
    check (status in ('not_applicable','not_started','in_progress','done')),
  progress_pct numeric(5,1) not null default 0
    check (progress_pct >= 0 and progress_pct <= 100),
  qty_done integer,                  -- nullable, cuma relevan proses qty-based (POTONG/BENDING/dst)
  qty_total integer,                 -- snapshot qty komponen (self-contained per baris, gak perlu JOIN ke checklist lama)
  photos jsonb not null default '[]',        -- [{url,uploaded_by,uploaded_at}]
  last_operator_nama text,
  last_operator_at timestamptz,
  sudah_disimpan_100 boolean not null default false,  -- checkpoint EKSPLISIT "Simpan/Arsipkan" di 100%,
                                                        -- beda dari progress_pct kebetulan 100 tanpa disimpan
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

CREATE UNIQUE INDEX component_process_progress_unique
  ON public.component_process_progress(panel_id, kode_komponen, proses, COALESCE(tahap,''));
CREATE INDEX component_process_progress_panel_idx ON public.component_process_progress(panel_id);
CREATE INDEX component_process_progress_status_idx ON public.component_process_progress(proses, status);

-- CHECK tambahan: status & progress_pct WAJIB konsisten (bukan 2 sumber kebenaran independen
-- kayak sekarang, itu sendiri sumber bug — lihat DATABASE_AUDIT_2026-09-20.md poin E.4).
ALTER TABLE public.component_process_progress ADD CONSTRAINT ccp_status_progress_consistent
  CHECK (
    (status = 'not_applicable' AND progress_pct = 0) OR
    (status = 'not_started' AND progress_pct = 0) OR
    (status = 'in_progress' AND progress_pct > 0 AND progress_pct < 100) OR
    (status = 'done' AND progress_pct = 100)
  );
```

**Histori per-tanggal/per-shift**: BUKAN kolom baru — **reuse `progress_checkpoint_log`** (tabel yang SUDAH ADA, sudah proses-agnostik: `panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, ts`). Sudah dipakai persis buat ini oleh `simpanProgress()` Pasang Komponen sejak 8 Agu 2026 — satu sumber logika (CLAUDE.md B.1), bukan tabel histori baru lagi. Kalau butuh `shift`/`section` (dipakai histori proses biasa, belum ada di `progress_checkpoint_log`) — itu 2 kolom nullable baru di tabel yang SUDAH ADA ini, bukan tabel baru.

### Kenapa TIDAK ada kolom `qtyProsesByDate`/`progressByDate`/`stepDates`
Semuanya derivable dari `progress_checkpoint_log` (per tanggal = checkpoint terakhir hari itu) — menyimpannya lagi di `component_process_progress` cuma mengulang kelas bug "2 sumber kebenaran utk 1 angka" yang sudah 2x insiden nyata (CLAUDE.md B.3).

---

## 3. Sumber kebenaran `not_applicable`

**Sudah ada — `bom_proses_relevan`** (tabel existing, `kode_komponen, tipe_panel, jenis_pekerjaan`). Dicek live: `WM.3` (Pintu, tipe `WM_POLY`, panel PP-POWER HOUSE - POLYESTER) cuma punya **1 baris** di `bom_proses_relevan`: `jenis_pekerjaan='WIRING CONTROL'`. POTONG/RAKIT/dst **tidak ada** barisnya sama sekali untuk kode ini.

**Tidak perlu field baru.** Saat seeding baris `component_process_progress` (materialisasi awal per panel+kode, mirror `initChecklist()` yang sudah ada tapi lebih pintar):
```
untuk setiap kode di BOM panel:
  untuk setiap proses di ALL_PROSES:
    ADA di bom_proses_relevan(kode,tipe,proses)?
      YA  -> insert status='not_started'
      TIDAK -> insert status='not_applicable'
```
Bukan dari "tipe proyek" (terlalu kasar — relevansi per-KODE, bukan per-panel/proyek) dan bukan field baru di BOM (tabel yang tepat sudah ada, cuma belum dipakai konsisten di semua jalur baca status).

---

## 4. Kasus uji: Wiring Control Pintu (box polyester) — root cause DIKONFIRMASI

**Kenapa Potong/Rakit blank (BENAR)**: `TaskMonitoring.tsx:31` — `if(!isKomponenRelevant(kode,tipe,proses))return null;` — cell di-skip total (gak dirender) kalau proses gak relevan. Untuk WM.3, POTONG/RAKIT memang gak ada di `bom_proses_relevan` → blank. **Ini sudah benar.**

**Kenapa Wiring Control tampil "NOT YET" (SALAH)** — root cause di `src/lib/panelHelpers.ts:220-222`, fungsi `computeProsesStatus()`:
```js
if(proses==="WIRING CONTROL"||proses==="WIRING POWER"){
  return(progressMap?.["RAKIT"]||0)>0?"TO DO":"NOT YET";
}
```
Special-case ini (dibuat 7 Agu 2026, niatnya: wiring boleh mulai begitu RAKIT jalan, skip nunggu Pasang Komponen) **hardcode gate ke `progressMap["RAKIT"]` TANPA cek apakah RAKIT relevan buat kode ini**. Untuk WM.3 (Pintu beli-jadi), RAKIT memang gak pernah relevan (gak ada di `bom_proses_relevan`) → `progressMap["RAKIT"]` PERMANEN 0 (bukan krn belum dikerjakan, tapi krn emang gak ada kerjaan RAKIT buat kode ini) → kondisi `>0` gak akan PERNAH terpenuhi → **"NOT YET" selamanya, kelihatan kayak nyangkut/nunggu sesuatu yang gak akan pernah terjadi**.

Ironisnya, logika chain generik yang SUDAH ADA di bawahnya (baris 223-232, `relevantProses`-aware) **sudah benar** kalau saja special-case di atasnya gak nyalip duluan — `chain=["WIRING CONTROL"]` (cuma 1 proses relevan), `prosesIdx=0`, `if(prosesIdx<=0)return "TO DO"` — langsung "TO DO", bukan nunggu apa-apa. Bug-nya BUKAN di logika intinya, tapi di shortcut yang bypass logika itu.

### Verifikasi skema baru menangani kasus ini
Dengan `component_process_progress`, status TIDAK dihitung on-the-fly dengan gate hardcoded — status DISIMPAN eksplisit per baris, ditentukan SEKALI saat seeding dari `bom_proses_relevan` (poin 3):
- `(panel=432, kode='WM.3', proses='POTONG', tahap=NULL)` → **status='not_applicable'**
- `(panel=432, kode='WM.3', proses='RAKIT', tahap=NULL)` → **status='not_applicable'**
- `(panel=432, kode='WM.3', proses='WIRING CONTROL', tahap=NULL)` → **status='not_started'** (BUKAN not_applicable — WIRING CONTROL memang kerjaan nyata buat kode ini)

Begitu WIRING CONTROL benar-benar migrasi ke tabel baru (Fase 3, belum sekarang), gate berbasis-RAKIT gak relevan lagi sama sekali — status yang ditampilkan LANGSUNG baca kolom `status`, gak ada special-case proses apa pun yang bisa nyasar seperti kasus ini. **Terkonfirmasi: skema ini menyelesaikan kasus Wiring Control Pintu polyester.**

> Catatan terpisah (bukan bagian task ini, cuma informasi): bug ini juga BISA diperbaiki independen dari migrasi skema — cukup tambah `if(!(relevantProses||[]).includes("RAKIT"))` di special-case tsb sebelum gate ke RAKIT. Perbaikan kecil di sistem lama, kalau Anda mau ini beres lebih cepat tanpa nunggu migrasi. Saya TIDAK mengeksekusi ini sekarang (sesuai instruksi task) — tinggal bilang kalau mau saya kerjakan terpisah.

---

## 5. Pasang Komponen sebagai domain migrasi pertama

### Kenapa Pasang Komponen paling cocok jadi percobaan pertama
1. Sudah dikonfirmasi (sesi ini) WIRING-only untuk Box Control/Pintu — TIDAK PERLU lagi model 2-tahap-rata-rata. Kompleksitas paling rendah di antara proses spesial.
2. Sudah ada 2 populasi kode yang jelas: (a) Box Control/Pintu → owner Wiring Control, `tahap='WIRING'`; (b) kode lain (Dudukan ACB, Groundplate, dst) → owner Assembling Luar, `tahap=NULL`. Tinggal 1 kolom `tahap` sudah cukup merepresentasikan keduanya, gak perlu kolom pemisah tambahan.
3. `progress_checkpoint_log` SUDAH dipakai sebagai histori-nya sejak 8 Agu 2026 — gak perlu bikin apa pun baru buat dimensi histori.
4. Timer SUDAH generik (`fcs_timer_kerja.tahap` sudah dipakai persis buat ini, reuse langsung — lihat poin di bawah).

### Bagaimana Pasang Komponen ditulis ke tabel baru (BUKAN migrasi dari bentuk lama — tulis langsung sejak awal)
- `updatePctLive()`/`simpanProgress()` di `KomponenPasangView.tsx` (vista-pekerja) — GANTI target tulis dari `mergePanelChecklist()` (RPC JSONB merge) jadi `UPSERT component_process_progress` langsung (`ON CONFLICT (panel_id,kode_komponen,proses,COALESCE(tahap,'')) DO UPDATE`).
- `status` dihitung dari `progress_pct` di sisi APLIKASI sebelum upsert (bukan trigger DB — konsisten sama pola CHECK constraint yang validasi tapi gak menghitung otomatis, jaga logika penentuan status tetap 1 tempat yang mudah diaudit: fungsi kecil `pctToStatus(pct)`).
- Baris `not_applicable` di-seed SEKALI saat panel dibuat/qty di-set (mirror `initChecklist()`), TIDAK per-klik.

### Timer — REUSE `fcs_timer_kerja`, TIDAK bikin tabel timer terpisah
`fcs_timer_kerja` SUDAH proses-agnostik (`panel_id,kode_komponen,proses,tahap,pekerja_id,mulai,selesai,durasi_menit`) — dipakai persis pola ini utk BUSBAR dan (sesi ini) Pasang Komponen. Bikin tabel timer baru = duplikasi tanpa alasan kuat (CLAUDE.md B.1). Satu penyesuaian OPSIONAL (bukan wajib): tambah kolom nullable `component_process_progress_id bigint references component_process_progress(id)` di `fcs_timer_kerja` buat JOIN langsung yang lebih rapi — TAPI natural key (`panel_id,kode_komponen,proses,tahap`) yang sudah dipakai sekarang SUDAH CUKUP buat query gabungan tanpa FK eksplisit ini. Saya sarankan TUNDA kolom FK ini sampai ada kebutuhan nyata (query yang genuinely susah tanpa itu), bukan ditambah preventif.

### Tombol arsip manual — validasi jadi query sederhana
```sql
select bool_and(status='done')
from component_process_progress
where panel_id=$1 and kode_komponen=$2 and proses='PASANG KOMPONEN';
```
Dibanding sekarang (baca `checklist[kode].pasangKomponenTahap`, cek `sudahDisimpan100` manual per-tahap) — 1 query, gak ada JSONB path digging.

---

## 6. Strategi transisi — Pasang Komponen eksklusif dulu, proses lain TETAP di checklist

### Tidak ada konflik SELAMA fase ini (per desain)
- `panels.checklist[kode].progress["PASANG KOMPONEN"]` **TETAP ditulis paralel** (dual-write) selama masa transisi — bukan langsung dimatikan. Kode LAMA yang baca `checklist` (Task Monitoring, Detail Progres, laporan, dll) **tetap dapat data yang benar** tanpa tahu apa-apa soal tabel baru.
- Tabel baru jadi **sumber TAMBAHAN**, bukan pengganti, sampai semua consumer proses PASANG KOMPONEN dipindah baca dari sana. Baru setelah itu stabil, dual-write utk PASANG KOMPONEN dihentikan (checklist path itu jadi read-only historis).
- Task Monitoring (screenshot yang direferensikan) baca proses PASANG KOMPONEN TETAP dari `checklist` selama fase ini — TIDAK diubah di Fase 2. Kalau mau divalidasi silang (opsional, bukan wajib), bisa tambah 1 query pembanding non-blocking di background — TAPI itu di luar scope "belum eksekusi" task ini.
- Proses lain (POTONG/PAINTING/dst) **sama sekali tidak tersentuh** — baca-tulis `checklist` seperti biasa, nol perubahan.

### Kenapa aman: 13 proses independen, PASANG KOMPONEN gak dibaca proses lain
`ALL_PROSES` di seluruh kode selalu diperlakukan independen per-key (`progress[proses]`) — mengubah SATU proses ("PASANG KOMPONEN") gak menyentuh struktur `progress[proses lain]` di objek `checklist[kode]` yang sama. Risiko utama BUKAN "proses lain ikut rusak", tapi "2 sumber kebenaran PASANG KOMPONEN bisa divergen kalau dual-write ada bug" — makanya dual-write WAJIB, bukan cut-over langsung.

### Garis besar Fase 3+ (SKETSA SAJA, bukan bagian eksekusi task ini)
1. Setelah Pasang Komponen stabil beberapa minggu (dual-write terbukti konsisten, gak ada divergensi): migrasi proses ke-2 yang PALING SIMPEL dulu (kandidat: WIRING CONTROL/POWER — sekalian nutup bug polyester di poin 4, dan strukturnya udah paling dekat ke `component_process_progress` krn gak ada tahap sama sekali).
2. BUSBAR migrasi TERAKHIR (paling kompleks — 4 tahap, `busbarTahap`, formula rata-rata) setelah pola tahap-generik teruji stabil dari BUSBAR... eh, maksudnya dari PASANG KOMPONEN dulu (yang cuma 1 tahap) baru BUSBAR (4 tahap) sebagai uji-beban pola tahap yang lebih berat.
3. Proses "biasa" (POTONG/BENDING/dst, populasi terbesar) migrasi paling akhir — dampaknya paling luas (paling banyak consumer/laporan yang baca), jadi paling perlu jam terbang dari proses-proses sebelumnya dulu.
4. Setiap migrasi proses = pola yang sama: dual-write dulu → validasi konsistensi → pindah consumer baca → matikan dual-write → (opsional, jauh belakangan) backfill data historis checklist lama ke `progress_checkpoint_log` biar `checklist` bisa di-deprecate total.

---

## Ringkasan jawaban 4 poin output yang diminta

1. **Skema lengkap**: lihat bagian 2 — 1 tabel (`component_process_progress`, state terkini) + reuse `progress_checkpoint_log` (histori) + reuse `fcs_timer_kerja` (timer). Tidak ada tabel baru selain `component_process_progress` sendiri.
2. **Sumber `not_applicable`**: `bom_proses_relevan` (tabel existing) — dikonfirmasi live via kasus WM.3/WM_POLY. Tidak perlu field baru.
3. **Konfirmasi kasus Wiring Control Pintu polyester**: root cause dikonfirmasi (`computeProsesStatus()` di `panelHelpers.ts:220-222`, hardcoded gate ke RAKIT tanpa cek relevansi) — skema baru menghapus kelas bug ini karena status disimpan eksplisit, bukan dihitung ulang dengan gate proses-spesifik yang bisa salah asumsi.
4. **Rencana kasar migrasi Pasang Komponen**: lihat bagian 5-6 — tulis langsung ke tabel baru (bukan migrasi bentuk lama), dual-write ke `checklist` selama transisi, timer & histori reuse tabel existing, proses lain tidak tersentuh sama sekali di fase ini.
