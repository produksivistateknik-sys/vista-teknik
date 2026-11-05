-- ============================================================================================
-- ROLE HRGA (6 Nov 2026, keputusan user) - login admin yang hanya menampilkan Inventaris & Maintenance. Pola sama dgn
-- 20260831060000_add_engineering_divisi_check_admins.sql. Hanya melonggarkan batasan nilai admins.divisi; fungsi Inventaris
-- tidak diubah (inv_aktor memeriksa akun aktif, bukan role). Tidak ada data yang berubah.
-- Verifikasi: supabase/verifikasi/20261106010000_admins_role_hrga_verifikasi.sql
-- Rollback:   supabase/rollback/20261106010000_admins_role_hrga_rollback.sql
-- ============================================================================================
begin;
alter table public.admins drop constraint if exists admins_divisi_check;
alter table public.admins add constraint admins_divisi_check check (divisi is null or divisi in ('admin','engineering','hrga'));
commit;
