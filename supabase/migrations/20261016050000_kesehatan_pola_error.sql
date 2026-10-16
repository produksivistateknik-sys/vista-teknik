-- ============================================================================================
-- KESEHATAN DATA - pola error yang dikenal (16 Okt 2026, disetujui user)
-- Tiap baris log_error_app di halaman Kesehatan Data dicocokkan (di browser) dgn pola di tabel ini, urut `urutan` kecil
-- dulu, cocok pertama yang dipakai. Yang tidak cocok tampil "Belum dianalisis". Isi bisa diedit dari SQL Editor TANPA
-- deploy. Kolom:
--   pola      : regex (tidak peka huruf besar/kecil) dicocokkan ke log_error_app.pesan
--   jenis     : kosong = semua jenis, atau daftar jenis log (chunk, gagal_simpan, upload, unhandled, window_error, crash)
--   aplikasi  : kosong = semua, atau 'vista-teknik' / 'vista-pekerja'
-- Tidak mengubah tabel produksi. Rollback: supabase/rollback/20261016050000_kesehatan_pola_error_rollback.sql
-- ============================================================================================
begin;

create table if not exists public.kesehatan_pola_error (
  kode text primary key,
  nama text not null,
  pola text not null,
  jenis text[] not null default '{}',
  aplikasi text[] not null default '{}',
  apa_terjadi text,
  penyebab text,
  dampak text,
  langkah text[] not null default '{}',
  urutan int not null default 100,
  aktif boolean not null default true,
  diubah timestamptz not null default now()
);
alter table public.kesehatan_pola_error enable row level security;
drop policy if exists baca_kesehatan_pola_error on public.kesehatan_pola_error;
create policy baca_kesehatan_pola_error on public.kesehatan_pola_error for select to anon, authenticated using (true);

insert into public.kesehatan_pola_error (kode, nama, pola, jenis, aplikasi, apa_terjadi, penyebab, dampak, langkah, urutan) values
 ('E1', 'File aplikasi versi lama tidak ada lagi (chunk)',
  'Failed to fetch dynamically imported module|Loading chunk .* failed|error loading dynamically imported module|Importing a module script failed|ChunkLoadError',
  '{}', '{}',
  $t$Tab browser gagal memuat file JavaScript menu yang dibuka, karena tab itu masih memakai versi aplikasi dari sebelum deploy terakhir dan file versi lama sudah tidak ada di server.$t$,
  $t$Setiap deploy ke main (Vercel) menyajikan file versi baru saja; file lama langsung 404. Tab yang terbuka sejak sebelum deploy lalu membuka menu yang belum pernah dibuka = gagal. Contoh 16 Okt: IHSAN membuka Proyek Luar 13.40, 11 menit setelah deploy 13.28; EDO membuka WO Digital 15.29, 39 menit setelah deploy 14.50. Sampai 16 Okt push yang hanya berisi file SQL pun mengganti nama file (cap versi di JS) - diperbaiki: nama file kini stabil, semua halaman diunduh di belakang layar, dan pindah menu memuat ulang otomatis kalau versi baru terdeteksi.$t$,
  $t$Layar berganti "Memuat versi terbaru..." lalu dimuat ulang otomatis sekali. Isian yang belum disimpan di halaman itu hilang. Data di server tidak rusak.$t$,
  array[
    $t$Tidak perlu tindakan kalau hanya sesekali tepat setelah deploy.$t$,
    $t$Kalau pengguna melapor layar tidak pulih: minta tekan "Muat ulang" atau Ctrl+Shift+R.$t$,
    $t$Kalau muncul berulang TANPA deploy baru: cek di Vercel apakah deploy terakhir berhasil penuh (file JS lengkap).$t$],
  10),
 ('E2', 'Gagal tersambung ke server (jaringan)',
  'Failed to fetch|Request timeout|Load failed|NetworkError|network error|ERR_INTERNET_DISCONNECTED|koneksi lambat',
  '{gagal_simpan,upload,unhandled,window_error,supabase_error}', '{}',
  $t$Permintaan ke server tidak sampai atau terputus di tengah jalan (tidak ada jawaban dari server), biasanya saat menyimpan progres, memulai/menghentikan timer, atau mengunggah foto.$t$,
  $t$Sinyal HP / jaringan pabrik putus-sambung atau sangat lambat. Ini BUKAN penolakan data oleh server - kalau server menolak, pesannya berisi kode error (mis. P0001, 23514). Contoh 16 Okt 10.43: SISWOYO menekan Kunci Progress STEL FS.13 tiga kali saat sinyal lemah; data akhirnya tersimpan saat sinyal kembali. Kalau banyak operator gagal di jam yang sama, kemungkinan gangguan server/Supabase.$t$,
  $t$Data belum tersimpan saat itu. Aplikasi operator (setelah rilis antrean simpan) menyimpan Ketik qty & Kunci Progress sementara di HP dan mengirimnya otomatis saat sinyal kembali; aksi lain harus diulang operator. Cek K14 menandai apakah akhirnya tersimpan.$t$,
  array[
    $t$Lihat K14 (Gagal simpan berulang): "tersimpan kemudian" = aman.$t$,
    $t$"BELUM terlihat tersimpan": minta operator isi ulang saat sinyal ada.$t$,
    $t$Sering di operator/lokasi yang sama: periksa WiFi / titik akses di area kerja itu.$t$,
    $t$Banyak operator sekaligus di jam yang sama: cek status Supabase (dashboard > Logs) di jam itu.$t$],
  20)
on conflict (kode) do update set nama = excluded.nama, pola = excluded.pola, jenis = excluded.jenis, aplikasi = excluded.aplikasi,
  apa_terjadi = excluded.apa_terjadi, penyebab = excluded.penyebab, dampak = excluded.dampak, langkah = excluded.langkah,
  urutan = excluded.urutan, diubah = now();

commit;
