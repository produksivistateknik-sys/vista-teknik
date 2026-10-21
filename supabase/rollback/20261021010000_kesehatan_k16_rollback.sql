-- ROLLBACK K16: kembalikan fungsi cek ke versi K1-K15 & buang baris cek K16 (hasil lama K16 ikut dihapus).
begin;
delete from public.kesehatan_hasil where kode = 'K16';
delete from public.kesehatan_temuan_diketahui where kode = 'K16';
delete from public.kesehatan_cek where kode = 'K16';
drop function public._sql_cek_kesehatan(text);
alter function public._sql_cek_kesehatan_k1_k15(text) rename to _sql_cek_kesehatan;
commit;
