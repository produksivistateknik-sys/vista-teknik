# Fase 5 — Migrasi `component_process_progress`: Proses "Biasa"

**Sifat**: Riset + desain, sama seperti Fase 2/3/4. **TIDAK ADA migrasi/kode dieksekusi.** Menunggu
konfirmasi sebelum lanjut ke migrasi SQL/kode sebenarnya. Domain terakhir di sketsa awal
(`FASE2_COMPONENT_PROCESS_PROGRESS_DESIGN.md` bagian 6) — sengaja paling akhir karena populasi
terbesar & dampak paling luas (paling banyak consumer/laporan baca proses-proses ini).

---

## 1. Scope — 7 proses, EKSPLISIT bukan QC TEST/PACKING/NAMEPLATE/YELLOWMARK

**Proses biasa** = `POTONG, BENDING, STEL, FINISHING, RENDAM, PAINTING, RAKIT` — 7 proses yang
pakai kode BOM asli + `bom_proses_relevan` seperti Pasang Komponen/WIRING (beda dari 3 proses
spesial lain di `ALL_PROSES` yang punya struktur data SAMA SEKALI berbeda, per CLAUDE.md B.2):
- **QC TEST/PACKING**: whole-panel, komponennya literal `["MARKED"]`, bukan kode BOM asli sama
  sekali — kalau nanti dimigrasi, itu domain TERPISAH lagi (di luar scope Fase 5 ini).
- **NAMEPLATE/YELLOWMARK**: TIDAK ADA di `ALL_PROSES`, progress-nya kolom terpisah
  `panels.nameplate_progress`/`yellowmark_progress` — bukan lewat `checklist` sama sekali, gak
  relevan sama arsitektur `component_process_progress` ini.

---

## 2. Survei data live

- **`bom_proses_relevan`**: 530 kombinasi kode+tipe+proses relevan (POTONG:100, RAKIT:105,
  BENDING:89, PAINTING:88, RENDAM:84, FINISHING:35, STEL:29) — sumber `not_applicable` SAMA
  seperti Pasang Komponen/WIRING (bukan kasus asimetris kayak BUSBAR).
- **Shape `checklist[kode]`**: sudah disurvei di Fase 2 (bentuk "(1) Proses biasa"):
  `progress[proses]`, `qtyProses[proses]` (nilai UTAMA yang di-track, pct DITURUNKAN darinya:
  `Math.round(qtyProses/qtyKomp*100)`), `qtyProsesByDate`, `progressByDate`, `history[proses]`
  (`[{ts,pct,shift,tanggal,section?,sectionMulai?}]` — `section`/`sectionMulai` CUMA ada di
  POTONG/RENDAM/PAINTING, proses lain gak pernah punya field ini).
- **Estimasi skala backfill**: 455 (panel,kode) qty>0 di panel aktif × 7 proses = **~3185 baris**
  (jauh di bawah kekhawatiran performa, batch upsert 200/request seperti fase sebelumnya cukup).

---

## 3. Write path — 4 fungsi, DIVERIFIKASI via kode (bukan diasumsikan)

Pelajaran dari Fase 3 (`lockProgress` kelewat) diterapkan penuh di sini — ditelusuri SEMUA
pemanggil sebelum desain difinalisasi, bukan cuma 2 fungsi yang "kelihatan jelas":

| Fungsi | Proses yang pakai | Kapan |
|---|---|---|
| `updateQtyProses` | **Semua 7** | Live, debounce 600ms tiap ketik qty |
| `lockSingleKomponen` | **BENDING, STEL, FINISHING, RAKIT** (4 dari 7) | Commit per-kartu (tombol "💾 Simpan Progress" individual) |
| `simpanSectionPaintingRendam` | **POTONG, RENDAM, PAINTING** (3 dari 7) | Commit BULK section-based (tombol beda, toolbar sendiri) |
| `lockProgress` | **Semua 7** (loop generik, gak peduli tombol UI mana yang dipakai) | Commit bulk "🔒 Kunci Progress Hari Ini" |

**Kenapa POTONG/RENDAM/PAINTING TIDAK lewat `lockSingleKomponen`**: dikonfirmasi komentar eksplisit
di kode (`OperatorView.tsx:3092-3096`): *"tombol Simpan Progress per-card individual dihapus
KHUSUS RENDAM/PAINTING - sistem Section (simpanSectionPaintingRendam) udah nyakup... 2 cara simpan
buat hal yang sama bikin operator bingung"* — render kondisinya `proses!=="POTONG"&&proses!==
"RENDAM"&&proses!=="PAINTING"`. Jadi `lockSingleKomponen` dan `simpanSectionPaintingRendam` itu
**SALING MENGECUALIKAN per-proses** (bukan 2 jalur untuk proses yang sama), sedangkan
`updateQtyProses` (live) dan `lockProgress` (bulk akhir shift) TETAP jalan generik buat ketujuhnya
tanpa pengecualian apa pun.

**`section`/`sectionMulai` TIDAK direpresentasikan di `component_process_progress`** — itu konsep
historis (per-commit-event), sudah lengkap tersimpan di `checklist.history[proses]`.
`component_process_progress` modelnya "state TERKINI per baris", sama filosofi dengan keputusan
Fase 2 yang bilang `stepDates`/`progressByDate` redundan - diperluas konsisten ke `section` juga
(CLAUDE.md B.3: jangan simpan 2 sumber kebenaran untuk hal yang sama).

---

## 4. Kolom `qty_done`/`qty_total` — akhirnya benar-benar kepakai

3 domain sebelumnya (Pasang Komponen/WIRING/BUSBAR) selalu `qty_done=null` (proses-nya pct-only
di praktiknya). **Proses biasa** adalah domain PERTAMA yang qty-based beneran — `qty_done` diisi
`cl.qtyProses[proses]`, `qty_total` diisi `cl.qty` (bukan `null`/`0` seperti fase-fase sebelumnya).
Kolom yang sudah ada di skema Fase 2 (`qty_done integer — nullable, cuma relevan proses qty-based`)
akhirnya kepakai sesuai desain aslinya, **0 perubahan skema**.

---

## 5. Rencana dual-write (ringkas, pola SAMA PERSIS 3 fase sebelumnya)

- `updateQtyProses`: upsert 1 baris `(panel,kode,proses,tahap=NULL)` tiap debounce fire, `pct`
  dari kalkulasi yang sudah ada, `qty_done`/`qty_total` dari qtyProses/qty, `sudahDisimpan100:false`.
- `lockSingleKomponen`: guard diperluas dari `["WIRING CONTROL","WIRING POWER"]` jadi tambah
  `["BENDING","STEL","FINISHING","RAKIT"]` — `sudahDisimpan100:pct>=100` (rumus sama).
- `lockProgress`: guard diperluas jadi semua 7 proses biasa (ditambah yang sudah ada WIRING) —
  `ccpEntries` yang sudah dibangun di Fase 3 tinggal ditambah `qtyTotal`/`qtyDone` per baris.
- `simpanSectionPaintingRendam`: dual-write BARU (belum pernah ada guard di sini) - upsert per
  komponen di `panelRows` yang sukses, `sudahDisimpan100:r.pct>=100`.

Seeding backfill: pola sama persis Pasang Komponen/WIRING (bom_proses_relevan-based,
`not_applicable` utk kode gak relevan) — bukan pola asimetris BUSBAR.

---

## Ringkasan

1. **Skema**: 0 perubahan — `qty_done`/`qty_total` akhirnya terisi sesuai desain awal.
2. **Scope**: 7 proses (POTONG/BENDING/STEL/FINISHING/RENDAM/PAINTING/RAKIT) — QC TEST/PACKING/
   NAMEPLATE/YELLOWMARK EKSPLISIT di luar scope (struktur data beda total).
3. **Write path**: 4 fungsi terverifikasi lewat kode — `updateQtyProses`+`lockProgress` (semua 7),
   `lockSingleKomponen` (4/7), `simpanSectionPaintingRendam` (3/7, saling mengecualikan dengan
   `lockSingleKomponen` per-proses, BUKAN 2 jalur tumpang tindih).
4. **`section`/`sectionMulai`**: sengaja TIDAK dibawa ke `component_process_progress` (konsep
   historis, sudah lengkap di `checklist.history`).
5. **Skala**: ~3185 baris backfill, dalam batas wajar batch upsert yang sudah dipakai.
