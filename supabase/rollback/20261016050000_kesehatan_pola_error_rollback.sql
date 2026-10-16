-- ROLLBACK pola error Kesehatan Data (halaman otomatis menampilkan semua error sebagai "Belum dianalisis").
begin;
drop table if exists public.kesehatan_pola_error;
commit;
