-- Verifikasi role HRGA: definisi batasan harus memuat 'hrga', dan jumlah akun per role tidak berubah oleh migrasi ini.
select pg_get_constraintdef(oid) as batasan from pg_constraint where conname = 'admins_divisi_check';
select coalesce(divisi, '(kosong)') as divisi, count(*) as jumlah from public.admins group by 1 order by 1;
