-- HAPUS PERTAMA (MANUAL, MAKS 20 BERKAS) foto/video Maintenance Rutin > 30 hari - 19 Nov 2026.
-- JALANKAN HANYA SETELAH IZIN TERTULIS. Tidak bisa dibatalkan: berkas di R2 hilang permanen (tidak ada cadangan - keputusan user).
-- Prasyarat: migrasi 20261119010000 & 20261119020000 sudah jalan, Edge Function hapus-media-rutin sudah ter-deploy.
-- Yang terjadi: saklar -> 'manual' (jadwal 02.00 WIB TIDAK menghapus), batas 20, lalu satu permintaan ke Edge Function.
-- File ini hanya untuk yang PERTAMA: ditolak bila sudah pernah ada proses hapus. Mengulang manual sesudahnya cukup:
--   select public.inv_media_rutin_jalankan_manual();
-- Riwayat TIDAK dihapus; baris foto ditandai dan aplikasi menampilkan "Foto/video dihapus otomatis (lebih dari 30 hari)".
-- Saklar tetap 'manual' sampai Anda menjalankan 20261119_hapus_media_rutin_aktifkan_otomatis.sql.
-- Matikan kapan saja: update public.inv_pengaturan set nilai = '"mati"' where kunci = 'hapus_media_rutin_mode';
-- Harapan 1-2 menit sesudahnya: log selesai 20, gagal 0; status sudah_dihapus 20, kandidat sisa sekitar 13-16 (33 per 19 Nov + yang
-- menyusul lewat 30 hari).

do $$ declare n int; begin
  if exists (select 1 from public.inv_media_hapus_log where jenis = 'proses_mulai') then
    raise exception 'Sudah pernah ada proses hapus - file "pertama" ini ditolak. Ulang manual: select public.inv_media_rutin_jalankan_manual();';
  end if;
  select count(*) into n from public.inv_media_rutin_status() where status = 'kandidat';
  if n < 1 or n > 200 then raise exception 'Jumlah kandidat % di luar dugaan (1-200) - batal, cek dulu dengan npm run dryrun:media-rutin', n; end if;
  raise notice 'Kandidat saat ini: % berkas; yang dihapus sekarang maks 20', n;
end $$;
update public.inv_pengaturan set nilai = '"manual"' where kunci = 'hapus_media_rutin_mode';
update public.inv_pengaturan set nilai = '20' where kunci = 'hapus_media_rutin_batas';
select public.inv_media_rutin_jalankan_manual() as hasil;

-- 1-2 menit kemudian (baca saja):
--   select jenis, count(*) as jumlah, round(sum(ukuran_byte) / 1048576.0, 1) as mb from public.inv_media_hapus_log group by jenis order by jenis;
--   select status, count(*) from public.inv_media_rutin_status() group by status order by status;
