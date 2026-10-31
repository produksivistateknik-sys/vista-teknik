-- ============================================================================================
-- INVENTARIS - CRON PUSH NOTIFIKASI TINDAKAN OPERATOR (31 Okt 2026, T3). JALANKAN SESUDAH:
--   1) migrasi 20261031010000_inventaris_notifikasi.sql, dan
--   2) deploy Edge Function:  npx supabase functions deploy inv-notif-push --no-verify-jwt --project-ref aoxhxfsqjnquwsxjrsmo
-- Tiap menit pg_cron memanggil inv-notif-push (tanpa kunci: fungsi hanya mengirim push yang sudah antre di inv_notifikasi,
-- klaim atomik - dipanggil berlebih pun tidak mengirim dobel). Penggabungan & jendela: lihat komentar fungsi
-- inv_notif_ambil_push (tenang 30 dtk / maks 3 mnt / basi 60 mnt). Siap Run, tanpa placeholder; aman dijalankan ulang.
-- Matikan: select cron.unschedule('inventaris-notif-push');
-- ============================================================================================
begin;
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'inv_notif_ambil_push') then
    raise exception 'Jalankan dulu migrasi 20261031010000_inventaris_notifikasi.sql';
  end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'inventaris-notif-push';
select cron.schedule('inventaris-notif-push', '* * * * *', $c$
  select net.http_post(
    url := 'https://aoxhxfsqjnquwsxjrsmo.supabase.co/functions/v1/inv-notif-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb)
$c$);
select jobname, schedule, active from cron.job where jobname = 'inventaris-notif-push';
commit;
