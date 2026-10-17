-- ============================================================================================
-- AKTIFKAN pembersihan permintaan ATURAN BARU (17 Okt 2026, opsi 4 disetujui user)
-- JALANKAN HANYA SETELAH Edge Function reset-permintaan-bulanan versi baru (aturan: panel dihapus permanen & > 1 tahun,
-- backup R2 dulu) SUDAH di-deploy: `supabase functions deploy reset-permintaan-bulanan`, lalu uji dry-run di dashboard
-- Supabase > Edge Functions > reset-permintaan-bulanan > Test, body {"dryRun": true} -> harus "kandidat": 0 (17 Okt).
-- Memakai ulang perintah HTTP jadwal lama yang disimpan di _backup_cron_reset_permintaan (URL & header sama), dgn jadwal
-- tanggal 3 jam 02.00 WIB. Kalau deploy BELUM dilakukan, jadwal ini akan menjalankan ATURAN LAMA (hapus semua bulan lalu)!
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback.
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select jobname, schedule, left(command, 80) as awal_perintah, disimpan_pada from public._backup_cron_reset_permintaan;
-- HARUS 1 baris (dari 20261017_hentikan_reset_permintaan.sql)
select count(*) as jadwal_aktif_sekarang_harus_0 from cron.job where command ilike '%reset-permintaan-bulanan%';


-- ── BAGIAN 2: EKSEKUSI (SETELAH deploy fungsi baru) ─────────────────────────────────────────
begin;
do $$
declare v_cmd text;
begin
  select command into v_cmd from public._backup_cron_reset_permintaan order by disimpan_pada desc limit 1;
  if v_cmd is null then raise exception 'DIBATALKAN: definisi jadwal lama tidak ada di _backup_cron_reset_permintaan'; end if;
  if exists (select 1 from cron.job where command ilike '%reset-permintaan-bulanan%') then raise exception 'DIBATALKAN: sudah ada jadwal aktif'; end if;
  perform cron.schedule('bersihkan-permintaan-lama', '0 19 2 * *', v_cmd);   -- 19.00 UTC tgl 2 = 02.00 WIB tgl 3
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'HENTIKAN RESET PERMINTAAN',
    'Jadwal bersihkan-permintaan-lama diaktifkan (tgl 3, 02.00 WIB): hanya permintaan panel dihapus permanen & > 1 tahun, backup R2 dulu.',
    'permintaan', 'SQL Editor');
end $$;
select jobname, schedule from cron.job where jobname = 'bersihkan-permintaan-lama';   -- HARUS 1 baris
commit;


-- ── BAGIAN 3: ROLLBACK ──────────────────────────────────────────────────────────────────────
-- select cron.unschedule('bersihkan-permintaan-lama');
