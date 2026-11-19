-- AKTIFKAN HAPUS OTOMATIS HARIAN 02.00 WIB foto/video Maintenance Rutin > 30 hari - 19 Nov 2026.
-- JALANKAN HANYA SETELAH hasil eksekusi manual pertama dicek di aplikasi dan disetujui tertulis.
-- Mulai malam berikutnya pukul 02.00 WIB: maks 20 berkas per malam (ubah hapus_media_rutin_batas bila perlu, 1-200).
-- Ditolak bila belum ada berkas yang berhasil dihapus, atau masih ada berkas yang prosesnya menggantung (mulai/berkas_terhapus/gagal
-- tanpa selesai) - selesaikan dulu (jalankan manual lagi) dan cek Kesehatan Data K27.
-- Matikan kapan saja: update public.inv_pengaturan set nilai = '"mati"' where kunci = 'hapus_media_rutin_mode';

do $$ declare n int; begin
  if not exists (select 1 from public.inv_media_hapus_log where jenis = 'selesai') then
    raise exception 'Belum ada berkas yang berhasil dihapus - jalankan dulu 20261119_hapus_media_rutin_manual_pertama.sql dan cek hasilnya';
  end if;
  select count(*) into n
    from (select distinct on (x.media_id) x.media_id, x.jenis from public.inv_media_hapus_log x
           where x.media_id is not null and x.jenis in ('mulai', 'berkas_terhapus', 'selesai', 'gagal', 'dilewati')
           order by x.media_id, x.id desc) l
    join public.inv_media m on m.id = l.media_id
   where l.jenis in ('mulai', 'berkas_terhapus', 'gagal') and m.dihapus_pada is null;
  if n > 0 then raise exception 'Masih ada % berkas yang prosesnya belum tuntas - jalankan manual lagi / cek K27 dulu', n; end if;
  if not exists (select 1 from cron.job where jobname = 'hapus-media-rutin-harian' and active) then
    raise exception 'Jadwal cron hapus-media-rutin-harian tidak aktif';
  end if;
end $$;
update public.inv_pengaturan set nilai = '"otomatis"' where kunci = 'hapus_media_rutin_mode';
select kunci, nilai from public.inv_pengaturan where kunci like 'hapus_media_rutin_%';
select jobname, schedule, active from cron.job where jobname = 'hapus-media-rutin-harian';   -- 0 19 * * * = 02.00 WIB
