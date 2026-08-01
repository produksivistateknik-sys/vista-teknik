# Investigasi: Operator Kosong di Rencana Harian

**Status: ROOT CAUSE DIKONFIRMASI + FIX DITERAPKAN (2026-08-01)**

Bug berulang: kolom Operator di Rencana Harian menampilkan "Pilih sendiri di
tablet" walau progress komponen sudah >0%. Dilaporkan berkali-kali (POTONG,
WIRING POWER, dan contoh konkret terbaru: SDP-PASTEURIZER / FS.34 - Tulangan
Cover / WP4 / BENDING 33%). Investigasi-investigasi sebelumnya tidak pernah
sampai dieksekusi tuntas (temuan hilang tertumpuk chat). Dokumen ini dibuat
justru supaya itu tidak terulang - findings tersimpan di kode, bukan cuma di
chat.

## Ringkasan super singkat

**Dugaan awal (dari laporan user): proses JEJAK/SPLIT (auto-geser/cascading)
menghilangkan referensi operator saat membuat entry baru — REFUTED, dibuktikan
dengan angka (lihat bawah).**

**Root cause sebenarnya:** ada beberapa fungsi di Vista Pekerja yang
menyimpan progress (`checklist.progress`/`progressByDate`) **langsung ke
database TANPA sekaligus mencatat siapa operatornya** ke tabel
`progress_checkpoint_log` (satu-satunya tabel yang menyimpan nama operator
sebagai teks untuk kasus "kunci progress tanpa timer aktif"). Bug ini murni
soal *tempat progress disimpan*, sama sekali tidak berhubungan dengan
jejak/geser/cascading.

Sebagian dari gap ini (`updatePctManual`, tombol PCT_STEPS non-BUSBAR) SUDAH
diperbaiki di commit `14624a6` (vista-pekerja, 2026-07-31 21:52 WIB) - sudah
live di produksi sebelum sesi investigasi ini. Sesi ini menemukan **2 gap lain
yang belum tersentuh fix itu** dan langsung memperbaikinya (lihat bagian
"Fix yang diterapkan").

## Bukti pembuktian hipotesis (poin wajib dari user)

Query terhadap SELURUH kombinasi (panel, kode komponen, proses) dengan
`progress > 0%`, dibandingkan dengan keberadaan data di 3 sumber operator
(`fcs_timer_kerja`, `progress_checkpoint_log`, `renhar.pekerja_per_komponen`),
DAN dicek apakah kombinasi itu PERNAH kena jejak/geser (`digeserKe` atau
`carriedOverFrom` muncul di `raw_schedule.schedule` untuk kode tsb):

```
Total (panel,kode,proses) dengan progress>0%: 819
  - pernah jejak/geser:      242
  - TIDAK pernah jejak/geser: 577

Total GAP (operator kosong di ketiga sumber): 32
  - GAP yang PERNAH jejak/geser:      2   (0.8% dari 242 - LEBIH RENDAH)
  - GAP yang TIDAK pernah jejak/geser: 30  (5.2% dari 577 - LEBIH TINGGI)
```

Kalau jejak/geser benar penyebabnya, rate gap di kelompok "pernah jejak"
harusnya JAUH LEBIH TINGGI dari kelompok "tidak pernah jejak" - kenyataannya
JUSTRU SEBALIKNYA (0.8% vs 5.2%). **Hipotesis jejak/split REFUTED dengan
angka konkret.**

Diperkuat juga secara struktural dari kode: `auto-geser-harian/index.ts`
(fungsi yang menjalankan semua jejak/cascading server-side) **tidak pernah
menyentuh `panels.checklist` sama sekali** - hanya memanipulasi
`raw_schedule.schedule` (field `komponen`, `digeserKe`, `carriedOverFrom`).
Jejak/geser secara fisik tidak mungkin menghapus data operator karena tidak
pernah membaca/menulis tabel yang menyimpannya.

## Root cause sebenarnya (dengan bukti kasus konkret)

Contoh SDP-PASTEURIZER / FS.34 yang dilaporkan user:
- `progress.BENDING` = 33%, history 1 entry: `tanggal:2026-07-27, ts:2026-07-29T07:23:58Z`
- **TIDAK ADA** baris di `fcs_timer_kerja` untuk kombinasi ini (dicek: 0 baris)
- **TIDAK ADA** baris di `progress_checkpoint_log` untuk kombinasi ini (dicek: 0 baris)
- Bandingkan dengan `progress.PAINTING` = 33% (panel & kode SAMA) yang
  operatornya MUNCUL BENAR ("DWI") karena checkpoint-nya ADA
  (`progress_checkpoint_log` id 2270 & 2510, tanggal 2026-07-31 & 2026-08-01)

Kode yang menjelaskan kenapa BENDING gak punya checkpoint tapi PAINTING
punya: histori BENDING dibuat `ts:2026-07-29`, SEBELUM commit `14624a6`
(2026-07-31 21:52 WIB) yang memperbaiki jalur PCT_STEPS. Histori PAINTING
dibuat `2026-07-31` dan `2026-08-01`, SETELAH fix itu live - makanya
operatornya kebaca benar.

## Tiga jalur penulisan progress di Vista Pekerja, status checkpoint logging-nya

| Fungsi | Fitur UI | Status sebelum sesi ini | Status sesudah |
|---|---|---|---|
| `lockSingleKomponen` (~App.tsx:3742) | "Kunci Progress" | ✅ sudah benar dari awal | ✅ |
| BUSBAR "Simpan Progress" final (~App.tsx:3862) | Simpan Progress BUSBAR | ✅ sudah benar dari awal | ✅ |
| `updatePctManual` (~App.tsx:3573) | Tombol PCT_STEPS non-BUSBAR | ❌ gap (fixed commit `14624a6`, 2026-07-31) | ✅ |
| `updateQtyProses` (~App.tsx:3317) | Input qty manual (ketik angka) | ❌ **GAP BARU, ditemukan sesi ini** | ✅ **fixed sesi ini** |
| `updatePctManualBusbarTahap` (~App.tsx:3788) | PCT_STEPS per-tahap BUSBAR (live, sebelum klik Simpan) | ❌ **GAP BARU, ditemukan sesi ini** | ✅ **fixed sesi ini** |

Dua baris terakhir adalah alasan bug ini masih terjadi WALAU fix `14624a6`
sudah live - dua jalur lain yang polanya identik (persist langsung ke DB
tanpa mencatat checkpoint) belum ikut diperbaiki di commit itu.

## Fix yang diterapkan (sesi ini, 2026-08-01)

File: `vista-pekerja/src/App.tsx`

1. `updateQtyProses` (path input qty manual, di-debounce 600ms) - ditambah
   insert `progress_checkpoint_log` persis setelah update `panels.checklist`
   berhasil, sama pola dengan `updatePctManual` (cari `pekerja_per_komponen`
   dari task hari ini, fallback ke `user.nama` kalau belum ada assignment).
2. `updatePctManualBusbarTahap` (path live-update progress tahap BUSBAR
   sebelum "Simpan Progress" diklik) - ditambah insert yang sama, proses
   dipaksa `"BUSBAR"`, checkpoint dari `combined` (progress gabungan semua
   tahap).

Kedua fix mengikuti pola PERSIS yang sudah dipakai di `updatePctManual`
(commit `14624a6`) - tidak membuat mekanisme baru, cuma menutup 2 lubang yang
sama.

## Perbaikan data historis (poin 5)

**32 kombinasi (panel, kode, proses) dengan progress>0% TAPI operator TIDAK
BISA ditelusuri dari sumber manapun** (`fcs_timer_kerja` kosong,
`progress_checkpoint_log` kosong, `renhar.pekerja_per_komponen` kosong).

**Dicek juga: Activity Log (`activity_log`, Vista Teknik) TIDAK PERNAH
ditulisi dari Vista Pekerja sama sekali** (progress-update di app operator
tidak pernah insert ke `activity_log` - itu murni fitur sisi admin/Vista
Teknik). Jadi tidak ada sumber lain yang bisa dipakai merekonstruksi siapa
operatornya.

**Kesimpulan: ke-32 baris ini adalah DATA LOSS PERMANEN, tidak bisa
diperbaiki lagi.** Semuanya berasal dari sebelum fix `14624a6` (rentang
tanggal histori 2026-07-14 s/d 2026-07-29, semua sebelum 2026-07-31 21:52
WIB) - progress-nya sendiri VALID dan tetap ditampilkan apa adanya, cuma
info "siapa yang ngerjain" yang sudah tidak mungkin ditelusuri lagi.

Detail lengkap 32 baris (untuk referensi/audit lanjutan kalau diperlukan):

| Panel | Tipe | Kode | Proses | Progress | Pernah jejak? |
|---|---|---|---|---|---|
| SDB.LT 4 | FS | FS.36 | BENDING | 100% | tidak |
| CAPACITOR BANK-2 | FS | FS.27 | BENDING | 8% | tidak |
| CAPACITOR BANK-2 | FS | FS.29 | PAINTING | 100% | tidak |
| PP AC MINOR 1 | WM_MS | WM.5 | POTONG | 100% | tidak |
| PP AC MINOR 1 | WM_MS | WM.5 | BENDING | 100% | tidak |
| PP AC MINOR 1 | WM_MS | WM.5 | PAINTING | 100% | tidak |
| PP AC MINOR 1 | WM_MS | WM.12 | POTONG | 100% | tidak |
| PP AC MINOR 1 | WM_MS | WM.12 | BENDING | 100% | tidak |
| SDP-PASTEURIZER | FS | FS.34 | BENDING | 33% | **ya** |
| SDP-KOMPRESSOR | FS | FS.2 | POTONG | 100% | tidak |
| SDP-KOMPRESSOR | FS | FS.3 | POTONG | 100% | tidak |
| SDP-KOMPRESSOR | FS | FS.4 | POTONG | 100% | tidak |
| SDP-KOMPRESSOR | FS | FS.5 | POTONG | 100% | tidak |
| PP AC MINOR 2 | WM_MS | WM.5 | POTONG | 100% | tidak |
| PP AC MINOR 2 | WM_MS | WM.5 | BENDING | 100% | tidak |
| PP AC MINOR 2 | WM_MS | WM.5 | PAINTING | 100% | tidak |
| PP AC MINOR 2 | WM_MS | WM.12 | POTONG | 100% | tidak |
| PP AC MINOR 2 | WM_MS | WM.12 | BENDING | 100% | tidak |
| SDP-COOKING BAKSO & NPD | FS | FS.29 | RAKIT | 25% | tidak |
| SDP-WWTP | FS | FS.27 | BENDING | 13% | **ya** |
| SDB.LT 3 | FS | FS.36 | BENDING | 100% | tidak |
| PP CSSD | WM_MS | WM.5 | POTONG | 100% | tidak |
| PP CSSD | WM_MS | WM.5 | BENDING | 100% | tidak |
| PP CSSD | WM_MS | WM.5 | PAINTING | 100% | tidak |
| PP CSSD | WM_MS | WM.12 | POTONG | 100% | tidak |
| PP CSSD | WM_MS | WM.12 | BENDING | 100% | tidak |
| PP CSSD | WM_MS | WM.12 | PAINTING | 100% | tidak |
| FAB PANEL SWITCHING SHUTDOWN | FS | FS.34 | POTONG | 100% | tidak |
| CAPACITOR BANK-1 | FS | FS.27 | BENDING | 8% | tidak |
| PP PHARMASY | WM_MS | WM.5 | PAINTING | 100% | tidak |
| PP PHARMASY | WM_MS | WM.12 | PAINTING | 100% | tidak |
| PUTR 2 | FS | FS.11 | BENDING | 27% | tidak |

Tidak ada tindakan lanjutan untuk 30 baris "tidak pernah jejak" - datanya
sudah final (banyak yang 100%, sudah selesai). Untuk 2 baris "pernah jejak"
(SDP-PASTEURIZER FS.34 BENDING, SDP-WWTP FS.27 BENDING) - jejaknya TIDAK
menyebabkan hilangnya data (sudah dibuktikan di atas), kebetulan saja kedua
kombinasi ini juga termasuk yang progress-nya di-set lewat jalur lama
sebelum ada checkpoint logging.

## Verifikasi setelah fix (poin 6)

Tidak bisa reproduksi lewat klik UI langsung di sesi ini (tidak ada akses
browser interaktif), verifikasi dilakukan dengan kombinasi:

1. **Code-level**: `updateQtyProses` dan `updatePctManualBusbarTahap`
   sekarang insert ke `progress_checkpoint_log` persis kapan pun
   `panels.checklist` berhasil ditulis dengan progress>0%, pola identik
   dengan `updatePctManual` yang SUDAH terbukti bekerja di produksi (lihat
   poin berikutnya).
2. **Bukti empiris dari data produksi nyata**: checkpoint untuk
   SDP-PASTEURIZER/FS.34/PAINTING tanggal 2026-08-01 (`id:2510,
   pekerja_nama:"DWI"`) dibuat SETELAH commit `14624a6` (2026-07-31 21:52
   WIB) live - dan RencanaHarian.tsx MEMANG menampilkan "DWI" dengan benar
   untuk baris PAINTING itu sekarang (dikonfirmasi lewat simulasi fetch
   persis logic komponen). Ini bukti nyata bahwa pola fix yang sama (kini
   diterapkan juga ke `updateQtyProses`/`updatePctManualBusbarTahap`) memang
   berhasil menutup gap-nya.
3. `npm run build` vista-pekerja sukses tanpa error TypeScript.

**Rekomendasi**: setelah fix ini di-deploy, tolong test manual sekali di
tablet - isi qty komponen manual (bukan PCT_STEPS) untuk 1 komponen apa saja,
cek baris `progress_checkpoint_log` terbaru muncul dengan `pekerja_nama`
terisi benar, lalu cek Rencana Harian menampilkan operatornya (bukan "Pilih
sendiri di tablet").

## Backup sebelum eksekusi

- `raw_schedule_backup_20260801_operatorkosong` (740 baris, cocok dengan live)
- `fcs_timer_kerja_backup_20260801_operatorkosong` (4106 baris, cocok dengan live)
