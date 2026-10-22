-- ROLLBACK K19: buang lapisan K19, kembalikan nama fungsi K1-K18.
begin;
delete from public.kesehatan_hasil where kode = 'K19';
delete from public.kesehatan_temuan_diketahui where kode = 'K19';
delete from public.kesehatan_cek where kode = 'K19';
drop function public._sql_cek_kesehatan(text);
alter function public._sql_cek_kesehatan_k1_k18(text) rename to _sql_cek_kesehatan;
commit;
