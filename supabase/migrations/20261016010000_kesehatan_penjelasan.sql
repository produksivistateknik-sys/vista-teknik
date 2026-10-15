-- ============================================================================================
-- KESEHATAN DATA - penjelasan per cek + label aplikasi (16 Okt 2026, revisi halaman Admin, persetujuan user)
-- Kolom baru di kesehatan_cek (bisa diedit dari SQL Editor TANPA deploy - halaman membaca langsung dari sini):
--   apa_terjadi, penyebab_umum, dampak_aplikasi (text), langkah (text[] - urutan langkah penanganan),
--   aplikasi (text[] - 'Admin' / 'Operator', label & filter di halaman).
-- Isi penjelasan K1-K11 ditulis dari penyebab nyata di kode/data (insiden Okt 2026), bukan generik.
-- Hanya kesehatan_cek yang berubah (tidak punya tabel arsip/snapshot). Tabel produksi tidak disentuh.
-- Rollback: supabase/rollback/20261016010000_kesehatan_penjelasan_rollback.sql
-- ============================================================================================
begin;

alter table public.kesehatan_cek
  add column if not exists apa_terjadi text,
  add column if not exists penyebab_umum text,
  add column if not exists dampak_aplikasi text,
  add column if not exists langkah text[] not null default '{}',
  add column if not exists aplikasi text[] not null default '{Admin}';

update public.kesehatan_cek set
  aplikasi = array['Admin','Operator'],
  apa_terjadi = $t$Ada panel di WO aktif yang WO-nya sudah dibuatkan jadwal (FCS), tetapi panel itu sendiri tidak punya satu pun baris di Raw Schedule.$t$,
  penyebab_umum = $t$Kejadian nyata 10 Okt 2026 (WO 076, panel 521): menyimpan WO di Manajemen WO menghapus lalu menulis ulang panel, sehingga baris jadwal panel ikut terhapus. Sejak 12 Okt panel hanya dihapus lewat jalur aman (hapus_panel_aman). Penyebab lain: panel ditambahkan ke WO setelah FCS dijalankan dan FCS belum diulang untuk panel itu.$t$,
  dampak_aplikasi = $t$Panel tidak tampil di Raw Schedule dan Rencana Harian, sehingga operator tidak mendapat tugas untuk panel itu dan kapasitasnya tidak ikut dihitung. Progres masih bisa diisi, tetapi tidak masuk perencanaan.$t$,
  langkah = array[
    $t$Buka Raw Schedule WO terkait dan pastikan panel memang tidak muncul.$t$,
    $t$Kalau panel baru ditambahkan: jalankan FCS untuk panel itu.$t$,
    $t$Kalau jadwal hilang karena kejadian (hapus/simpan WO): cek activity_log WO itu, lalu minta SQL pemulihan dari backup harian dengan dry-run dan rollback.$t$]
where kode = 'K1';

update public.kesehatan_cek set
  aplikasi = array['Admin','Operator'],
  apa_terjadi = $t$Ada kelompok data yang dibaca aplikasi dalam satu permintaan sudah lebih dari 800 baris. Supabase memotong hasil di 1.000 baris tanpa pesan error.$t$,
  penyebab_umum = $t$Query di kode yang membaca tanpa paginasi (.range). Kejadian nyata 15 Okt 2026: bom_proses_relevan tembus 1.008 baris sehingga proses komponen OU_FS.1 hilang dari Pasang Komponen; sebelumnya renhar ("Rilis balik", Agustus 2026).$t$,
  dampak_aplikasi = $t$Data setelah baris ke-1.000 diam-diam tidak terbaca: komponen atau proses tidak tampil, jadwal terlihat kosong, hitungan kapasitas kurang. Tidak ada pesan error di layar.$t$,
  langkah = array[
    $t$Lihat nama data di contoh baris.$t$,
    $t$Cari query yang membacanya di kode admin/operator dan ubah ke paginasi (fetchAllPaged / bacaSemuaHalaman).$t$,
    $t$Setelah rilis, keluarkan baris itu dari daftar K5 (migration kecil).$t$]
where kode = 'K5';

update public.kesehatan_cek set
  aplikasi = array['Admin'],
  apa_terjadi = $t$Ada data turunan yang induknya sudah tidak ada (jadwal, renhar, timer, CCP atau permintaan tanpa panel), mapping proses untuk kode yang tidak ada di BOM, atau kode checklist panel (qty > 0) yang tidak ada di BOM tipenya.$t$,
  penyebab_umum = $t$Penghapusan dari aplikasi versi lama sebelum ada jalur hapus aman (hapus_panel_aman, hapus_bom_komponen, hapus_tipe_panel - Okt 2026), atau komponen BOM dihapus/diganti kode sementara mapping prosesnya tertinggal. Contoh 15 Okt: mapping WM.10 tersisa di tipe WM_POLY padahal BOM WM_POLY hanya sampai WM.9.$t$,
  dampak_aplikasi = $t$Data yatim tidak terlihat di layar tetapi tetap ikut terbaca dan menambah jumlah baris tabel. Kode checklist tanpa BOM membuat progres komponen itu tidak tampil di halaman yang berbasis BOM.$t$,
  langkah = array[
    $t$Lihat kolom jenis dan ref di contoh baris.$t$,
    $t$Pastikan di BOM/panel bahwa induknya memang sudah tidak ada (bukan salah ketik kode).$t$,
    $t$Minta SQL perbaikan dengan dry-run dan rollback. Mapping proses (bom_proses_relevan) hanya bisa dihapus lewat SQL Editor.$t$]
where kode = 'K7';

update public.kesehatan_cek set
  aplikasi = array['Operator','Admin'],
  apa_terjadi = $t$Timer pengerjaan operator yang tidak ditutup sejak hari sebelumnya, berjalan lebih dari 12 jam (30 hari terakhir), atau aktif dobel untuk operator, komponen dan proses yang sama.$t$,
  penyebab_umum = $t$Dari 30 timer basi Okt 2026: (a) timer dimulai operator lain atau dari HP lain, sedangkan penghentian otomatis lama hanya mengenal timer di HP yang menyimpan; (b) progres disimpan di bawah 100% lalu timer ditinggal; (c) Arsip Pasang Komponen tidak menutup timer dan kartunya hilang dari layar. Sejak 15 Okt timer ditutup otomatis saat komponen 100%/diarsip, dan oleh server setelah 12 jam.$t$,
  dampak_aplikasi = $t$Jam kerja di Tracking Pekerja, ringkasan operator Manajemen WO dan tooltip operator membengkak (19 timer > 12 jam = 557 jam). Timer yang ditutup Force Stop atau otomatis tanpa simpanan tercatat 0 menit, sehingga jam kerja itu hilang dari laporan.$t$,
  langkah = array[
    $t$Lihat operator, proses dan jam di contoh baris.$t$,
    $t$Timer yang masih jalan > 12 jam ditutup otomatis pada menit ke-5 jam berikutnya (catatan "TUTUP TIMER OTOMATIS" di activity_log).$t$,
    $t$Kalau muncul timer basi BARU setelah 15 Okt, laporkan: berarti ada jalur simpan yang belum menutup timer.$t$,
    $t$Ingatkan operator menekan Selesai saat berhenti bekerja. Baris > 12 jam lama hilang sendiri dari daftar setelah 30 hari.$t$]
where kode = 'K8';

update public.kesehatan_cek set
  aplikasi = array['Operator','Admin'],
  apa_terjadi = $t$Persentase progres di component_process_progress (CCP) berbeda dengan panels.checklist untuk komponen dan proses yang sama.$t$,
  penyebab_umum = $t$Aplikasi operator menulis progres ke dua tempat (sejak 21 Sep 2026). HP yang masih memakai versi aplikasi lama (belum di-reload) bisa menulis hanya sebagian. Contoh 10 Okt (panel 521 FS.30 PAINTING): Simpan Section versi sebelum 2 Okt hanya menambah history, sehingga CCP 100 tetapi checklist 0.$t$,
  dampak_aplikasi = $t$Halaman yang membaca CCP dan halaman yang membaca checklist (Raw Schedule, Outstanding, generator FCS) menampilkan angka berbeda. Komponen bisa terlihat belum dikerjakan padahal sudah selesai, atau sebaliknya.$t$,
  langkah = array[
    $t$Lihat panel, komponen dan operator di contoh baris.$t$,
    $t$Cocokkan dengan history dan catatan simpanan untuk menentukan nilai yang benar.$t$,
    $t$Minta SQL penyelarasan dengan dry-run dan rollback.$t$,
    $t$Minta operator terkait memuat ulang aplikasi supaya memakai versi terbaru.$t$]
where kode = 'K9';

update public.kesehatan_cek set
  aplikasi = array['Admin'],
  apa_terjadi = $t$Dokumen gambar WO Digital yang tidak terkait panel mana pun, dan WO aktif yang tidak punya panel.$t$,
  penyebab_umum = $t$Panel diarsip atau dihapus (gambar sengaja tetap disimpan agar tidak hilang), WO dipisah karena deadline berbeda, atau WO kosong sengaja dipertahankan karena masih punya gambar/permintaan (aturan sejak 12 Okt 2026).$t$,
  dampak_aplikasi = $t$Tidak mengganggu produksi. Gambar tetap bisa dibuka dari WO-nya; hanya daftar gambarnya yang tidak terkait panel.$t$,
  langkah = array[
    $t$Tidak mendesak.$t$,
    $t$Saat pembersihan berkala, tautkan gambar ke panel yang benar atau hapus yang memang tidak dipakai.$t$]
where kode = 'K10';

update public.kesehatan_cek set
  aplikasi = array['Admin'],
  apa_terjadi = $t$Backup database harian terakhir yang tercatat sudah lebih dari 30 jam lalu, atau belum pernah tercatat.$t$,
  penyebab_umum = $t$Workflow GitHub Actions "backup-database" (tiap malam) gagal: misalnya secret password database/R2 berubah, ukuran dump terlalu kecil sehingga upload dibatalkan, atau jadwal dinonaktifkan GitHub. Bisa juga backup berhasil tetapi langkah "Catat backup ke Kesehatan Data" gagal (hanya peringatan di log Actions).$t$,
  dampak_aplikasi = $t$Titik pemulihan terakhir lebih tua dari sehari. Pemulihan data seperti panel 521 (10 Okt) dan jejak Raw Schedule (14 Okt) memakai backup ini.$t$,
  langkah = array[
    $t$Buka GitHub, tab Actions, workflow backup-database, lihat run terakhir.$t$,
    $t$Kalau gagal: baca langkah yang merah, perbaiki, lalu jalankan ulang (Run workflow).$t$,
    $t$Kalau backup sukses tetapi tidak tercatat: lihat peringatan di langkah "Catat backup ke Kesehatan Data".$t$,
    $t$Jalankan cek lagi; status kembali Aman otomatis.$t$]
where kode = 'K11';

commit;
