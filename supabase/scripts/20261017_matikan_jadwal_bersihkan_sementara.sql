-- ============================================================================================
-- MATIKAN SEMENTARA jadwal bersihkan-permintaan-lama (17 Okt 2026)
-- 20261017_aktifkan_pembersihan_permintaan.sql sudah terjalankan (08.51 UTC), padahal Edge Function
-- reset-permintaan-bulanan di server MASIH VERSI LAMA (terakhir deploy 4 Sep 2026) = hapus SEMUA permintaan
-- bulan lalu. Kalau dibiarkan, 3 Nov 02.00 WIB permintaan Oktober akan terhapus. Jadwal dimatikan dulu;
-- diaktifkan lagi (file aktifkan_pembersihan) SETELAH fungsi versi baru di-deploy & diuji dryRun.
-- Definisi jadwal lama tetap aman di _backup_cron_reset_permintaan.
-- ============================================================================================

-- DRY-RUN: harus 1 baris
select jobid, jobname, schedule, active from cron.job where jobname = 'bersihkan-permintaan-lama';

-- EKSEKUSI
begin;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'bersihkan-permintaan-lama') then
    raise exception 'DIBATALKAN: jadwal bersihkan-permintaan-lama tidak ada (mungkin sudah dimatikan)';
  end if;
  perform cron.unschedule('bersihkan-permintaan-lama');
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'HENTIKAN RESET PERMINTAAN',
    'Jadwal bersihkan-permintaan-lama dimatikan sementara: Edge Function di server masih versi lama (hapus semua bulan lalu). Aktifkan lagi setelah deploy versi baru.',
    'permintaan', 'SQL Editor');
end $$;
select count(*) as jadwal_permintaan_tersisa_harus_0 from cron.job
where jobname = 'bersihkan-permintaan-lama' or command ilike '%reset-permintaan-bulanan%';
select count(*) as backup_definisi_harus_1 from public._backup_cron_reset_permintaan;
commit;
