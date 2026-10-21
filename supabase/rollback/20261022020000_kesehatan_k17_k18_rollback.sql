-- ROLLBACK K17 baru + K18: lapisan atas kembali ke K17 versi 21 Okt (daftar tetap) + delegasi, K18 dibuang.
begin;
delete from public.kesehatan_hasil where kode = 'K18';
delete from public.kesehatan_temuan_diketahui where kode = 'K18';
delete from public.kesehatan_cek where kode = 'K18';
create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode when 'K17' then public._sql_cek_kesehatan_k17_lama() else public._sql_cek_kesehatan_k1_k16(p_kode) end
$f$;
commit;
-- Catatan: _sql_cek_kesehatan_k17_lama sengaja dibiarkan (dipakai lapisan atas setelah rollback).
