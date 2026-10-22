-- VERIFIKASI K19 (BACA SAJA) - jalankan SESUDAH migration K19. Harus 'SEMUA LULUS'.
do $$
declare k text; n int; gagal text[] := '{}';
begin
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16','K17','K18'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k18(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  begin
    execute 'select count(*) from (' || public._sql_cek_kesehatan('K19') || ') s' into n;
    raise notice 'K19 sekarang: % baris', n;
  exception when others then gagal := gagal || ('K19 error: ' || sqlerrm);
  end;
  if not exists (select 1 from public.kesehatan_cek where kode = 'K19' and aktif) then gagal := gagal || 'baris kesehatan_cek K19 tidak ada'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
