-- FITUR (31 Agu 2026): role "Engineering" di Vista Teknik - admins.divisi sudah ada dari dulu
-- tapi belum pernah dipakai (selalu dipaksa 'admin' di Login.tsx). Sekarang dipakai buat
-- bedain Admin (view-only di WO Digital) vs Engineering (bisa upload gambar teknik).
-- CHECK constraint di level DB biar nilai divisi gak ngaco - konsisten sama pola constraint
-- yang sudah ada di panel_seksi_archived_seksi_check.
alter table public.admins drop constraint if exists admins_divisi_check;
alter table public.admins add constraint admins_divisi_check check (divisi is null or divisi in ('admin','engineering'));
