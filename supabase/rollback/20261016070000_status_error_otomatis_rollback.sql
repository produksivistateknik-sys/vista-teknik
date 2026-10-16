-- ROLLBACK selesai otomatis: hentikan jadwal & hapus fungsinya. Status yang sudah ditandai otomatis TETAP Selesai
-- (bisa dibuka lagi manual). Kolom `otomatis` dibiarkan (tidak mengganggu); fungsi tandai_status_error & trigger
-- buka-kembali tetap versi baru (perilakunya sama, hanya ikut mengosongkan kolom otomatis).
begin;
do $$ begin perform cron.unschedule(jobname) from cron.job where jobname = 'kesehatan-error-otomatis'; end $$;
drop function if exists public.selesaikan_error_otomatis();
commit;
