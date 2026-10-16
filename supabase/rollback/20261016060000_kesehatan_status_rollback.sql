-- ROLLBACK status error & tunda cek (halaman kembali menampilkan semua error & cek tanpa status/tunda).
begin;
drop trigger if exists trg_buka_lagi_status_error on public.log_error_app;
drop function if exists public._buka_lagi_status_error();
drop function if exists public.tandai_status_error(text, text, text, text, text);
drop function if exists public.tunda_cek_kesehatan(text, int, text, text);
drop function if exists public.batal_tunda_cek_kesehatan(text, text);
drop function if exists public._versi_angka(text);
drop table if exists public.kesehatan_status_error;
drop table if exists public.kesehatan_tunda_cek;
commit;
