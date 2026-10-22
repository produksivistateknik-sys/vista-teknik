-- ROLLBACK K20: buang lapisan K20, kembalikan nama fungsi K1-K19.
begin;
delete from public.kesehatan_hasil where kode = 'K20';
delete from public.kesehatan_temuan_diketahui where kode = 'K20';
delete from public.kesehatan_cek where kode = 'K20';
drop function public._sql_cek_kesehatan(text);
alter function public._sql_cek_kesehatan_k1_k19(text) rename to _sql_cek_kesehatan;
commit;
