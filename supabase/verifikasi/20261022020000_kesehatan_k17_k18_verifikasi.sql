-- VERIFIKASI K17 baru + K18 (BACA SAJA) - jalankan SESUDAH migration 20261022020000_kesehatan_k17_k18.sql. Harus 'SEMUA LULUS'.
do $$
declare k text; n_lama int; n_baru int; n18 int; beda int; gagal text[] := '{}';
begin
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k16(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  -- K17 baru (baca tabel) = K17 lama (daftar tetap), baris demi baris
  execute 'select count(*) from (' || public._sql_cek_kesehatan_k17_lama() || ') s' into n_lama;
  execute 'select count(*) from (' || public._sql_cek_kesehatan('K17') || ') s' into n_baru;
  execute 'select count(*) from ((select ref from (' || public._sql_cek_kesehatan_k17_lama() || ') a except select ref from (' || public._sql_cek_kesehatan('K17') || ') b)'
       || ' union all (select ref from (' || public._sql_cek_kesehatan('K17') || ') c except select ref from (' || public._sql_cek_kesehatan_k17_lama() || ') d)) x' into beda;
  raise notice 'K17 lama % baris, baru % baris, beda %', n_lama, n_baru, beda;
  if beda <> 0 or n_lama <> n_baru then gagal := gagal || 'K17 baru tidak sama dgn K17 lama'::text; end if;
  begin
    execute 'select count(*) from (' || public._sql_cek_kesehatan('K18') || ') s' into n18;
    raise notice 'K18 sekarang: % baris', n18;
  exception when others then gagal := gagal || ('K18 error: ' || sqlerrm);
  end;
  if not exists (select 1 from public.kesehatan_cek where kode = 'K18' and aktif) then gagal := gagal || 'baris kesehatan_cek K18 tidak ada'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
