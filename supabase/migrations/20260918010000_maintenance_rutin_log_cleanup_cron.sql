-- Jadwalkan Edge Function "maintenance-rutin-log-cleanup" jalan HARIAN via pg_cron (18 Sep 2026)
-- - hapus baris maintenance_rutin_log yang dilakukan_pada > 30 hari lalu. Logic penghapusan
-- SENGAJA di server (edge function), BUKAN di browser/React, sesuai CLAUDE.md D. Lihat komentar
-- lengkap alasan/keamanan di supabase/functions/maintenance-rutin-log-cleanup/index.ts.
--
-- PENTING SEBELUM JALANKAN SQL INI: ganti placeholder <SERVICE_ROLE_KEY> di bawah dengan Service
-- Role key project ini (Project Settings > API di Supabase Dashboard) - JANGAN commit file ini ke
-- git kalau sudah diisi key asli (isi placeholder-nya SETELAH copy ke SQL Editor, bukan di file
-- yang di-commit - lihat CLAUDE.md F.1). Jadwal 20:00 UTC = 03:00 WIB dini hari, biar gak
-- bertabrakan jam kerja/jam sibuk sistem.
select cron.schedule(
  'maintenance-rutin-log-cleanup-harian',
  '0 20 * * *',
  $$
  select net.http_post(
    url := 'https://aoxhxfsqjnquwsxjrsmo.supabase.co/functions/v1/maintenance-rutin-log-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
