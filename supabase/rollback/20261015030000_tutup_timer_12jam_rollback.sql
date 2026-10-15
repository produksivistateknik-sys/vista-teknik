-- ROLLBACK tutup timer >12 jam: hentikan jadwal & hapus fungsi.
-- Timer yang SUDAH ditutup job ini tidak otomatis dibuka lagi - daftar id-nya ada di activity_log
-- action 'TUTUP TIMER OTOMATIS' (kalau perlu dibuka: update fcs_timer_kerja set selesai = null where id in (...)).
begin;
do $$ begin perform cron.unschedule(jobname) from cron.job where jobname = 'tutup-timer-12jam'; end $$;
drop function if exists public.tutup_timer_kelewat_12jam();
commit;
