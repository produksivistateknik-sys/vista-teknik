-- VERIFIKASI penjelasan Kesehatan Data (jalankan SESUDAH migration 20261016010000). Hanya membaca.
select kode, aplikasi, cardinality(langkah) as jml_langkah,
       apa_terjadi is not null and penyebab_umum is not null and dampak_aplikasi is not null as lengkap
from public.kesehatan_cek order by urutan;
-- HARUS 7 baris, semua lengkap = true, jml_langkah 2-4;
-- aplikasi: K1/K5 {Admin,Operator}, K7/K10/K11 {Admin}, K8/K9 {Operator,Admin}.

do $$
begin
  if (select count(*) from public.kesehatan_cek where apa_terjadi is null or penyebab_umum is null or dampak_aplikasi is null or cardinality(langkah) = 0) > 0 then
    raise exception 'GAGAL: ada cek tanpa penjelasan lengkap';
  end if;
  if not exists (select 1 from public.kesehatan_cek where kode = 'K8' and 'Operator' = any(aplikasi)) then
    raise exception 'GAGAL: K8 belum berlabel Operator';
  end if;
  -- cek tetap bisa dijalankan (fungsi lama tidak bergantung kolom baru)
  perform 1 from public.kesehatan_cek where aktif;
  raise notice 'SEMUA LULUS';
end $$;
