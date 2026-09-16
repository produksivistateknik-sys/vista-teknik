# CLAUDE.md — Aturan Kerja Wajib Vista Teknik ERP

> Vista Teknik ERP adalah **project produksi aktif**. Operator memakai sistem ini
> setiap hari. Bug yang lolos langsung mengganggu produksi. File ini berisi aturan
> WAJIB yang harus dipatuhi Claude Code di **setiap** task, dibuat untuk mencegah
> pola bug yang sudah terbukti berulang.

Bahasa laporan/ringkasan/penjelasan ke user: **Bahasa Indonesia**.

---

## A. ATURAN QUERY SUPABASE

1. **Batas 1000 row.** Query Supabase secara default membatasi maksimal **1000 row**.
   SETIAP query yang berpotensi mengambil >1000 row (tabel yang bisa tumbuh besar,
   fungsi `getAll()`-style, tabel log/history/schedule/archive) **WAJIB** pakai
   `.range()` eksplisit atau pagination penuh. **Dilarang asumsi** data selalu di
   bawah 1000 row.

2. **Selalu cek `{ error }`.** SETIAP pemanggilan Supabase
   (`select` / `insert` / `update` / `delete` / `rpc`) **WAJIB** cek `error` dari
   hasilnya. **Dilarang** ada `const { data } = await supabase...` yang mengabaikan
   `error` tanpa penanganan. Minimal: `console.error` + `toast` ke user.
   **Dilarang silent fail.**

3. **API key format baru.** Kalau memakai API key format baru (`sb_secret_...`),
   gunakan **HANYA** header `apikey`. **JANGAN** pakai `Authorization: Bearer`.

---

## B. ATURAN KONSISTENSI DATA

1. **Satu sumber logika.** Kalau ada 2 (atau lebih) tempat kode yang
   membaca/menghitung status yang sama (progress, status approval, dedup jadwal,
   dsb), **WAJIB** keduanya pakai **1 fungsi/helper bersama**. **Dilarang**
   masing-masing punya logika sendiri yang bisa beda hasil.

2. **Proses spesial (WIRING / BUSBAR / QC TEST / PACKING / NAMEPLATE /
   YELLOWMARK).** Proses ini historisnya punya jalur kode terpisah dari
   "proses pada umumnya" (POTONG/BENDING/STEL/FINISHING/RENDAM/PAINTING/RAKIT/
   PASANG KOMPONEN). SETIAP kali menambah/mengubah fitur yang menyentuh proses
   secara generik (progress, filter tampilan, dedup jadwal, dsb), **WAJIB
   cek satu-satu** apakah proses spesial di bawah ini ikut kena dampaknya —
   **dilarang asumsi** 1 jalur kode mewakili semua proses (audit 16 Sep 2026:
   14 file pemakai `ALL_PROSES` di vista-teknik dicek satu-satu, referensi ini
   dibuat dari hasilnya):
   - **BUSBAR**: relevansi "panel ini butuh BUSBAR atau tidak" **WAJIB** pakai
     `getBusbarKomponen(tipe)` (`panelHelpers.ts`) — **BUKAN** `bom_proses_relevan`
     (tabel itu utk BOM mekanik asli; sejak fix `4c464e1` 10 Sep 2026,
     `isKomponenRelevant`/`getRelevantProsesForKode` sengaja hardcode exclude
     BUSBAR dari situ, lihat [[project_busbar_bom_proses_relevan_undeletable]]).
     Progress disimpan di checklist **pseudo-komponen** (LINE/NETRAL/GROUND dst)
     `.progress.BUSBAR`, **BUKAN** kolom mati `panels.busbar_progress` — lihat
     [[project_busbar_storage_model]]. Skeleton row `raw_schedule` dibuat lewat
     jalur terpisah di `fcsService.ts` (`ensureSkeletonRow` khusus BUSBAR),
     bukan lewat mapping `bom_proses_relevan` biasa.
   - **QC TEST / PACKING**: whole-panel, bukan per-komponen — komponennya
     literal `["MARKED"]`, bukan kode BOM asli. Terdaftar di
     `PROSES_TANPA_MAPPING_KOMPONEN` (`panelHelpers.ts`, 4 item — termasuk
     NAMEPLATE/YELLOWMARK). **Hati-hati**: `fcsService.ts` punya konstanta LOKAL
     bernama sama tapi isinya cuma 2 item (`["QC TEST","PACKING"]`, TANPA
     NAMEPLATE/YELLOWMARK) — jangan asumsikan dua konstanta bernama sama itu
     isinya identik, selalu cek definisinya di file yang bersangkutan.
   - **NAMEPLATE / YELLOWMARK**: **TIDAK ADA** di `ALL_PROSES`
     (`constants/panelTypes.ts`). Progress-nya kolom terpisah
     `panels.nameplate_progress` / `panels.yellowmark_progress`, bukan lewat
     `checklist`. `RawSchedule.tsx` & `RencanaHarian.tsx` menangani ini di
     **section terpisah sendiri**, baca `raw_schedule` langsung, gak lewat
     `allTasks`/renhar biasa sama sekali.
   - **WIRING CONTROL/POWER**: itu **jadwal pasti, bukan proyeksi**. Jangan
     bikin ulang badge/section/teks "proyeksi". Jaga dedup **real-menang** +
     **entri-terakhir-per-kode** kalau menyentuh logic ini.

3. **Filter progress berbasis tanggal ("basi" vs "selesai hari ini").** Kalau
   nyembunyiin/nge-exclude entry berdasarkan `progress>=100`, **WAJIB** pastikan
   itu bukan cuma exclude berdasarkan angka progress SAAT INI — cek juga APAKAH
   progress itu baru dicapai HARI INI (misal lewat `checklist[kode].progressByDate[proses][tanggal]`,
   field yang sudah konsisten ditulis tiap jalur simpan progress operator) vs
   beneran basi/sudah lama. 2x insiden nyata (14→15→16 Sep 2026, RencanaHarian
   carry-over): exclude yang cuma lihat angka progress terkini salah nyembunyiin
   item yang justru baru selesai dikerjakan hari itu juga.

4. **Tabel snapshot / archive.** Tabel seperti `panel_seksi_archived.data`,
   `raw_schedule_archived`, dan snapshot lain **WAJIB** disinkronkan strukturnya
   kalau ada perubahan skema di tabel live terkait.

---

## C. ATURAN VALIDASI

1. **Exclude diri sendiri saat cek duplikat.** SETIAP validasi duplikat/unik
   (cek nama sudah ada, cek kombinasi field unik, dsb) **WAJIB** meng-exclude row
   yang sedang di-edit (`id != current_id`), supaya user bisa save ulang datanya
   sendiri tanpa false-positive "duplikat".

---

## D. ATURAN LOGIKA WAKTU / JADWAL / AUTO-PROSES

1. **Tidak di browser.** SETIAP logika yang menggeser/menjadwalkan otomatis
   (auto-geser, due date otomatis, carry-to-next-day, dsb) **TIDAK BOLEH**
   dijalankan di sisi browser/React.
2. **Harus di server.** WAJIB lewat **Supabase Edge Function terjadwal (pg_cron)**
   di server, supaya tidak ada race condition atau duplikasi akibat banyak user
   membuka halaman bersamaan.
3. Fitur auto-geser (carry-to-next-day) sudah pernah di-revert — **jangan
   reintroduce tanpa permintaan eksplisit user**.

---

## E. CHECKLIST SEBELUM MENYATAKAN TASK SELESAI

Sebelum melaporkan task selesai, **WAJIB** jalankan checklist ini dan laporkan
hasil tiap poin **secara eksplisit** ke user:

1. Apakah ada query baru yang berpotensi >1000 row tanpa pagination?
2. Apakah semua panggilan Supabase baru sudah cek `error`?
3. Apakah ada perubahan pada tabel yang punya snapshot/archive terkait, dan sudah
   disinkronkan?
4. Apakah ada proses spesial (WIRING / BUSBAR / QC TEST / PACKING / NAMEPLATE /
   YELLOWMARK — lihat B.2) yang mungkin terlewat dari perubahan ini?
4b. Kalau ada exclude/filter berbasis `progress>=100`, apakah sudah dibedakan
    "basi (dari sebelum hari ini)" vs "baru selesai hari ini" (lihat B.3)?
5. Kalau ada validasi unik/duplikat baru, apakah sudah exclude diri sendiri?
6. Apakah perubahan sudah dites secara logis untuk skenario: data **KOSONG**,
   data **BANYAK** (edge case volume), dan **MULTI-USER** (kalau relevan)?
7. Apakah ada perubahan skema (kolom/tabel baru) yang perlu didokumentasikan?
8. Apakah `build` sudah dijalankan dan lolos? (jaga baseline audit Agustus 2026 —
   fitur baru tidak boleh meregresi fix audit atau menambah kelas bug baru).

---

## F. ATURAN KEAMANAN

1. **JANGAN PERNAH** menampilkan atau menulis kredensial asli (token GitHub,
   password database, API key R2, service key Supabase, dsb) di chat atau di file
   kode.
2. Selalu arahkan user mengisi kredensial langsung di tempat resmi:
   **GitHub Secrets**, **Supabase secrets**, atau **`.env.local`** yang tidak
   di-commit.

---

## G. ATURAN KERJA DENGAN USER

1. Untuk task yang menyentuh **data production** atau **logika kompleks**, alur
   wajibnya:
   1. **Investigasi dulu** — baca kode + cek live terhadap DB/`activity_log`.
   2. **Laporkan temuan dengan bukti** (query nyata + hasil nyata dari database),
      bukan teori dari baca kode saja.
   3. **Sajikan rencana.**
   4. **Tunggu konfirmasi user.**
   5. **Baru eksekusi.**
2. **Dilarang** langsung eksekusi tanpa laporan dan konfirmasi, KECUALI user
   secara eksplisit minta "langsung kerjakan".
3. Locking/floor progress operator **WAJIB** punya jalur koreksi (escape hatch /
   confirm override). Jangan asumsikan 2 bug dengan gejala sama itu penyebabnya
   sama — cek `git log` dulu.
4. Refactor "struktur saja": **jangan perbaiki bug** yang ketemu di tengah jalan
   kecuali diminta. Catat saja bug-nya di laporan.

---

## Catatan build & data

- Direct DB access untuk query/cleanup live: pakai Node script dengan anon key
  dari `.env.local` — jangan cuma serahkan SQL.
- Jalankan build sebelum menyatakan selesai; telusuri caller lintas repo kalau
  mengubah fungsi/skema bersama.
