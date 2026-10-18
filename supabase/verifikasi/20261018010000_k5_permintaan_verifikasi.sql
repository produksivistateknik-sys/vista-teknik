-- VERIFIKASI K5 permintaan (jalankan SESUDAH migration 20261018010000). Semua di transaksi yang di-ROLLBACK (hasil
-- cek kesehatan uji tidak tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_sql text; v_hasil jsonb; v_hari int; v_divisi int; v_n int;
begin
  -- V1: baris lama hilang, 2 baris baru ada
  v_sql := public._sql_cek_kesehatan('K5');
  if v_sql like '%PermintaanView in ids%' then raise exception 'GAGAL V1: baris lama K5 masih ada'; end if;
  if v_sql not like '%per hari+jenis+divisi (Riwayat Permintaan operator)%'
     or v_sql not like '%per divisi di daftar Hutang operator%' then
    raise exception 'GAGAL V1: 2 baris baru K5 tidak ditemukan';
  end if;
  raise notice 'LULUS V1: baris lama K5 diganti 2 ukuran baru';

  -- V2: query K5 bisa dijalankan
  execute 'select count(*) from (' || v_sql || ') x' into v_n;
  raise notice 'LULUS V2: query K5 jalan, % baris melewati ambang 800', v_n;

  -- V3: nilai 2 ukuran baru (18 Okt: 53 & 167 - boleh sedikit naik krn permintaan baru)
  select coalesce(max(c), 0) into v_hari from (
    select count(*) c from public.permintaan m join public.permintaan_item i on i.permintaan_id = m.id
    where coalesce(i.is_hutang, false) = false group by m.jenis, m.divisi, (m.created_at at time zone 'UTC')::date) s;
  select coalesce(max(c), 0) into v_divisi from (select count(*) c from public.permintaan group by divisi) s;
  raise notice 'INFO V3: item terbanyak per hari+jenis+divisi = % (18 Okt: 53), id permintaan terbanyak per divisi = % (18 Okt: 167)', v_hari, v_divisi;

  -- V4: cek lain tidak berubah - semua kode K tetap menghasilkan query yang bisa dijalankan
  for v_sql in select public._sql_cek_kesehatan(k) from unnest(array['K1','K7','K8','K9','K10','K11','K12','K13','K14']) k loop
    execute 'select count(*) from (' || v_sql || ') x' into v_n;
  end loop;
  raise notice 'LULUS V4: K1, K7-K14 tetap bisa dijalankan';

  -- V5: penjalan cek resmi tanpa error untuk K5
  v_hasil := public.jalankan_cek_kesehatan('semua');
  if exists (select 1 from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K5' and status = 'error') then
    raise exception 'GAGAL V5: K5 error: %', (select pesan_error from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K5');
  end if;
  raise notice 'LULUS V5: jalankan_cek_kesehatan - K5 status %', (select status from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K5');
  raise notice 'SEMUA LULUS';
end $$;
rollback;
