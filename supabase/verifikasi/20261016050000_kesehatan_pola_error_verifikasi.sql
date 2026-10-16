-- VERIFIKASI pola error (jalankan SESUDAH migration 20261016050000). Hanya membaca. Harus berakhir 'SEMUA LULUS'.
-- Pencocokan di halaman memakai regex JavaScript (tidak peka huruf besar/kecil); di sini dicek dgn ~* PostgreSQL
-- (sintaks pola yang dipakai sama di keduanya).
do $$
declare v_kode text;
begin
  if (select count(*) from public.kesehatan_pola_error where aktif and apa_terjadi is not null and penyebab is not null
      and dampak is not null and cardinality(langkah) > 0) < 2 then
    raise exception 'GAGAL U1: pola E1/E2 belum lengkap';
  end if;
  raise notice 'LULUS U1: pola E1 & E2 terdaftar lengkap';
  -- pesan nyata 16 Okt -> pola pertama yang cocok (urutan kecil dulu)
  select kode into v_kode from public.kesehatan_pola_error
    where aktif and 'Failed to fetch dynamically imported module: https://admin.vistaproduksi.com/assets/ProyekLuarTab-Bv2tzQAU.js' ~* pola
    order by urutan limit 1;
  if v_kode is distinct from 'E1' then raise exception 'GAGAL U2: pesan chunk cocok ke % (harus E1)', v_kode; end if;
  select kode into v_kode from public.kesehatan_pola_error
    where aktif and 'Kunci Progress STEL FS.13: TypeError: Failed to fetch' ~* pola and ('gagal_simpan' = any(jenis) or cardinality(jenis) = 0)
    order by urutan limit 1;
  if v_kode is distinct from 'E2' then raise exception 'GAGAL U3: pesan gagal simpan cocok ke % (harus E2)', v_kode; end if;
  if exists (select 1 from public.kesehatan_pola_error where aktif and 'BENDING tidak boleh melebihi POTONG' ~* pola) then
    raise exception 'GAGAL U4: penolakan server ikut tertangkap pola jaringan';
  end if;
  raise notice 'LULUS U2-U4: chunk -> E1, Failed to fetch -> E2, penolakan server tidak cocok (Belum dianalisis)';
  raise notice 'SEMUA LULUS';
end $$;
