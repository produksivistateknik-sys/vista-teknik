-- VERIFIKASI K5 (jalankan SESUDAH migration 20261015020000_kesehatan_k5.sql). Hanya membaca. Harus berakhir 'SEMUA LULUS'.
do $$
declare v_sql text; v_n int; v_kode text;
begin
  v_sql := public._sql_cek_kesehatan('K5');
  if v_sql ~ 'vista-pekerja' or v_sql ~ 'bom_proses_relevan' or v_sql ~ 'from public.bom_master' then
    raise exception 'GAGAL V1: K5 masih memuat baris vista-pekerja';
  end if;
  if v_sql !~ 'permintaan_item' or v_sql !~ 'panel_seksi_archived' or v_sql !~ 'renhar' or v_sql !~ 'raw_schedule' then
    raise exception 'GAGAL V1: baris K5 lain hilang';
  end if;
  raise notice 'LULUS V1: K5 tanpa 3 baris vista-pekerja, 4 baris lain tetap';
  execute 'select count(*) from (' || v_sql || ') q' into v_n;
  raise notice 'LULUS V2: query K5 jalan, temuan = %', v_n;
  foreach v_kode in array array['K1','K7','K8','K9','K10','K11'] loop
    execute 'select count(*) from (' || public._sql_cek_kesehatan(v_kode) || ') q' into v_n;
  end loop;
  raise notice 'LULUS V3: query cek lain (K1,K7-K11) tetap jalan';
  raise notice 'SEMUA LULUS';
end $$;
