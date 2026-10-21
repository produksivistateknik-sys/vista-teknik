-- VERIFIKASI K17 (BACA SAJA) - jalankan SESUDAH migration 20261021020000_kesehatan_k17.sql. Harus 'SEMUA LULUS'.
do $$
declare k text; n int; gagal text[] := '{}';
begin
  -- 1. K1-K16 identik dgn fungsi sebelumnya
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k16(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  -- 2. K17 terdefinisi & bisa dijalankan
  if public._sql_cek_kesehatan('K17') is null then gagal := gagal || 'K17 belum terdefinisi'::text; end if;
  begin
    execute 'select count(*) from (' || public._sql_cek_kesehatan('K17') || ') s' into n;
    raise notice 'K17 sekarang: % baris', n;
  exception when others then gagal := gagal || ('K17 error: ' || sqlerrm);
  end;
  -- 3. baris kesehatan_cek K17 aktif
  if not exists (select 1 from public.kesehatan_cek where kode = 'K17' and aktif and frekuensi = 'per_jam') then gagal := gagal || 'baris kesehatan_cek K17 tidak ada/aktif'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
