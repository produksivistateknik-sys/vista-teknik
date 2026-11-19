-- ROLLBACK 20261119020000_media_rutin_hapus.sql (Tahap 2 hapus otomatis media Maintenance Rutin, 19 Nov 2026).
-- Jalankan di Supabase SQL Editor (Run). Menghapus jadwal cron, RPC, pemicu manual, saklar, rahasia, log, dan cek K26/K27.
-- BATAL UTUH bila proses hapus PERNAH menyentuh berkas (log mulai / berkas_terhapus / selesai / gagal): berkas di R2 bisa sudah
-- hilang, log itu satu-satunya jejak - jangan dibuang. Dalam keadaan itu cukup MATIKAN saja:
--   update public.inv_pengaturan set nilai = '"mati"' where kunci = 'hapus_media_rutin_mode';
--   select cron.unschedule('hapus-media-rutin-harian');
-- Izin anon ke inv_migrasi_data_lama (dicabut Tahap 2) TIDAK dikembalikan - RPC itu tidak dipakai aplikasi.
-- Tahap 1 (fungsi status & kolom penanda) tidak disentuh di sini - rollback-nya terpisah (jalankan SESUDAH file ini bila perlu).
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regclass('public.inv_media_hapus_log') is not null
     and exists (select 1 from public.inv_media_hapus_log where jenis in ('mulai', 'berkas_terhapus', 'selesai', 'gagal')) then
    raise exception 'Proses hapus sudah pernah menyentuh berkas (log mulai/berkas_terhapus/selesai/gagal) - rollback penuh dibatalkan. Matikan saja (lihat komentar di atas).';
  end if;
  if to_regprocedure('public._sql_cek_kesehatan_k1_k25(text)') is null then
    raise exception 'Lapisan _sql_cek_kesehatan_k1_k25 tidak ada - Tahap 2 belum pernah dijalankan? batal';
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'hapus-media-rutin-harian';
drop function if exists public.inv_media_rutin_jalankan_manual();
drop function if exists public.inv_media_rutin_akhiri(uuid, jsonb);
drop function if exists public.inv_media_rutin_gagal(uuid, bigint, text);
drop function if exists public.inv_media_rutin_tandai(uuid, bigint, bigint);
drop function if exists public.inv_media_rutin_terhapus(uuid, bigint, bigint);
drop function if exists public.inv_media_rutin_klaim(uuid, bigint);
drop function if exists public.inv_media_rutin_mulai(uuid, text);
drop function if exists public.inv_media_rutin_kunci_internal();
drop table if exists public.inv_media_hapus_log;
drop table if exists public.inv_rahasia_internal;
delete from public.inv_pengaturan where kunci in ('hapus_media_rutin_mode', 'hapus_media_rutin_batas');
do $$ begin
  if to_regclass('public.kesehatan_temuan_diketahui') is not null then
    delete from public.kesehatan_temuan_diketahui where kode in ('K26', 'K27');
  end if;
end $$;
delete from public.kesehatan_cek where kode in ('K26', 'K27');   -- kesehatan_hasil & kesehatan_tunda_cek ikut terhapus (cascade)
drop function public._sql_cek_kesehatan(text);
alter function public._sql_cek_kesehatan_k1_k25(text) rename to _sql_cek_kesehatan;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'hapus-media-rutin-harian')
     or to_regclass('public.inv_media_hapus_log') is not null or to_regclass('public.inv_rahasia_internal') is not null
     or to_regprocedure('public.inv_media_rutin_mulai(uuid,text)') is not null
     or to_regprocedure('public.inv_media_rutin_terhapus(uuid,bigint,bigint)') is not null
     or exists (select 1 from public.inv_pengaturan where kunci like 'hapus\_media\_rutin\_%')
     or exists (select 1 from public.kesehatan_cek where kode in ('K26', 'K27'))
     or to_regprocedure('public._sql_cek_kesehatan(text)') is null then
    raise exception 'Rollback GAGAL - masih ada sisa objek Tahap 2';
  end if;
  raise notice 'Rollback LULUS - jadwal, RPC, saklar, rahasia, log, dan K26/K27 sudah dihapus';
end $$;

commit;
