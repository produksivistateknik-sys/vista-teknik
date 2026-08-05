# Investigasi: Qty "Berhasil Disimpan" Tapi Balik ke 0 Setelah Refresh

**Status: ROOT CAUSE DIKONFIRMASI + FIX DITERAPKAN + DATA DIPERBAIKI (2026-08-05)**

Bug dilaporkan: user isi qty komponen "Tulangan Cover" (WM.6, WP3, panel
PP-BASEMENT SERVICE AREA id=329, proyek MAGONIA LOMBOK) jadi 4, klik Simpan,
toast "Qty berhasil disimpan!" muncul - tapi setelah refresh, qty balik ke 0.
User menduga ini terkait investigasi lama soal gembok/qty beda antara
Manajemen WO vs Detail Progress (laporan lama tidak sempat dieksekusi).

## Ringkasan super singkat

**Root cause dikonfirmasi: BUKAN soal field locked, BUKAN race condition
refresh, BUKAN constraint database tersembunyi.** `saveQtyEdit()` di
`ManajemenWO.tsx` (fungsi yang menampilkan toast "Qty berhasil disimpan!")
punya gate `finalChecklist[kode]` yang men-skip diam-diam kalau kode
tersebut **belum ada sama sekali** di `panels.checklist` - dan panel 329
memang tidak punya key `WM.6` di checklist-nya sama sekali (bukan `qty:0`,
tapi key-nya hilang total). Toast "berhasil" tetap muncul karena
`qty_change_log`/`activity_log` ditulis TANPA dikondisikan ke keberhasilan
gate ini, dan `supabase.update()` tetap sukses menulis balik checklist yang
(untuk kode ini) sebenarnya tidak berubah.

## Bukti

Query `qty_change_log` panel 329 kode WM.6 menunjukkan **4 kali percobaan**
oleh user di hari yang sama (2026-08-04, 08:18-08:20 UTC), semuanya SETELAH
fix race-condition/multiplier-gate yang sudah di-deploy sehari sebelumnya
(commit `a069862`/`befc113`) - jadi ini BUKAN gejala dari 2 bug yang sudah
diperbaiki itu, ini gap ke-3 yang berbeda:

```
2026-08-04T08:18:01 | LUTVAN NUHA | WM.6 Tulangan Cover : 0 -> 2
2026-08-04T08:18:15 | LUTVAN NUHA | WM.6 Tulangan Cover : 1 -> 2
2026-08-04T08:18:34 | LUTVAN NUHA | WM.6 Tulangan Cover : 0 -> 2
2026-08-04T08:20:23 | LUTVAN NUHA | WM.6 Tulangan Cover : 0 -> 2
```

Catatan: log di atas menunjukkan target "→ 2", bukan "→ 4" seperti yang
diingat user saat laporan dibuat - kemungkinan user mencoba lagi setelah
08:20:23 dengan nilai 4 tapi percobaan itu (seperti 4 sebelumnya) juga
silent-fail sehingga tidak sempat ke-log, atau keliru mengingat angkanya.
Baik "2" maupun "4" **sama-sama tidak pernah benar-benar tersimpan** -
`panels.checklist` panel 329 sebelum fix ini sama sekali tidak punya key
`WM.6`.

Query langsung ke `panels.checklist` panel 329 (sebelum fix) mengonfirmasi:
checklist cuma punya 4 dari 10 kode BOM (`WM.1,WM.2,WM.3,WM.7`) - `WM.4,
WM.5, WM.6, WM.8, WM.9, WM.10` semuanya hilang total dari struktur data,
bukan cuma qty=0.

## Soal "gembok" (poin 4 di laporan user)

Dicek `ManajemenWO.tsx:499` (tampilan preview panel yang di-expand di daftar
WO): `const isLocked=cl.qty===0`. Icon 🔒 di situ **cuma indikator
tampilan qty===0 (termasuk kode yang gak ada di checklist, fallback ke
qty:0)** - bukan mekanisme yang memblokir penyimpanan. Ini BUKAN
constraint/validasi tersembunyi seperti dugaan poin 3 - cuma kebetulan
berkorelasi (kode yang hilang dari checklist otomatis kelihatan "gembok"
di preview ini, meski gembok itu sendiri tidak menyebabkan apa-apa).

## Skala dampak (poin 5)

Sweep seluruh tabel `panels` dibandingkan `bom_master` (BOM per tipe panel
yang sebenarnya berlaku, live dari Master Data BOM):

- **32 dari 65 panel (49%)** punya minimal 1 kode BOM yang hilang total dari
  `checklist` - **182 instance kode** secara keseluruhan.
- Sebaran per proyek: MAGONIA LOMBOK (12 panel), CIMORY CITEUREUP (10 panel),
  RS. TUNAS SUVARNA (8 panel), NPA (1 panel), CJI (1 panel).
- Artinya: SEBELUM fix ini, mencoba mengisi qty pertama kali untuk salah
  satu dari 182 kode ini SELALU gagal diam-diam, berapa kali pun dicoba -
  bukan cuma kasus WM.6 di panel 329.

## Fix yang diterapkan

**Kode** (`ManajemenWO.tsx`, fungsi `saveQtyEdit`): gate `finalChecklist[kode]`
diganti - kalau entry belum ada, BUAT dulu entry baru (shape sama persis
`initChecklist`: `qty:0, qtyProses:{}, progress/progressByDate/stepDates`
per `ALL_PROSES`), baru qty dari input admin diterapkan di atasnya. Bukan
di-skip lagi.

**Data** (backfill, bukan tebakan nilai): 182 kode yang hilang di 32 panel
ditambahkan ke `checklist` masing-masing dengan struktur default
(`qty:0`, shape sama seperti fix di atas) - MURNI mengisi struktur yang
hilang, TIDAK menebak qty berapa yang seharusnya (tidak ada cara reliable
menentukan nilai yang benar untuk 182 kode yang belum pernah tersimpan sama
sekali). Backup penuh sebelum eksekusi: `panels_backup_20260805_qtysilentfail`,
`raw_schedule_backup_20260805_qtysilentfail`.

**Untuk kasus yang dilaporkan (WM.6 panel 329)**: entry sekarang SUDAH ADA
di checklist (qty:0, bukan hilang lagi) - user perlu isi ulang qty yang
benar (2 atau 4, sesuai maksud aslinya) lewat UI, sekarang seharusnya
tersimpan normal karena gate-nya sudah diperbaiki.

## Yang TIDAK ditemukan (menjawab poin 3 laporan user)

Tidak ada validasi/constraint database tersembunyi yang menolak qty untuk
field spesifik ini, dan tidak ada dependency ke field lain yang bergembok
di sekitarnya. Murni bug logic di sisi aplikasi (gate yang salah asumsi
"kode pasti sudah ada di checklist").
