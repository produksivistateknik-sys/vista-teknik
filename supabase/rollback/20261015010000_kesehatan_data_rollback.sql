-- ROLLBACK Kesehatan Data (menghapus jadwal, fungsi & tabel hasil/log - tabel produksi tidak tersentuh)
begin;
do $$ begin perform cron.unschedule(jobname) from cron.job where jobname in ('kesehatan-per-jam', 'kesehatan-harian', 'kesehatan-bersih'); end $$;
drop function if exists public.jalankan_cek_kesehatan(text);
drop function if exists public._sql_cek_kesehatan(text);
drop function if exists public.catat_error_app(jsonb);
drop table if exists public.kesehatan_hasil;
drop table if exists public.kesehatan_cek;
drop table if exists public.kesehatan_backup;
drop table if exists public.log_error_app;
commit;
