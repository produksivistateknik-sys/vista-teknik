-- ROLLBACK K17: kembalikan fungsi cek ke versi K1-K16 & buang baris cek K17 (hasil lama K17 ikut dihapus).
begin;
delete from public.kesehatan_hasil where kode = 'K17';
delete from public.kesehatan_temuan_diketahui where kode = 'K17';
delete from public.kesehatan_cek where kode = 'K17';
drop function public._sql_cek_kesehatan(text);
alter function public._sql_cek_kesehatan_k1_k16(text) rename to _sql_cek_kesehatan;
commit;
