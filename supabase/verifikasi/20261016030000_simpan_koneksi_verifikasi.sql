-- VERIFIKASI simpan-koneksi (jalankan SESUDAH migration 20261016030000). Data uji ditanam di transaksi yang di-ROLLBACK
-- (tidak ada yang tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_hasil jsonb; v_s jsonb; v_kode text; v_panel bigint;
begin
  -- U1: kolom ada di tabel live & arsip
  if (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'kunci_simpan'
      and table_name in ('progress_checkpoint_log', 'progress_checkpoint_log_archived')) <> 2 then
    raise exception 'GAGAL U1: kolom kunci_simpan belum ada di kedua tabel';
  end if;
  raise notice 'LULUS U1: kunci_simpan ada di progress_checkpoint_log & _archived';

  -- U2: kunci sama ditolak (23505), kunci NULL tetap boleh dobel (baris lama / app versi lama)
  select id into v_panel from public.panels order by id limit 1;
  insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, kunci_simpan)
    values (v_panel, 'UJI.K', 'STEL', 100, 'UJI', current_date, 'uji-kunci-1');
  begin
    insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, kunci_simpan)
      values (v_panel, 'UJI.K', 'STEL', 100, 'UJI', current_date, 'uji-kunci-1');
    raise exception 'GAGAL U2: kunci_simpan dobel tidak ditolak';
  exception when unique_violation then raise notice 'LULUS U2a: kunci_simpan dobel ditolak (23505)';
  end;
  insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal)
    values (v_panel, 'UJI.K', 'STEL', 50, 'UJI', current_date), (v_panel, 'UJI.K', 'STEL', 50, 'UJI', current_date);
  raise notice 'LULUS U2b: baris tanpa kunci (NULL) tetap bisa dobel';

  -- U3: K14 - 3 gagal simpan UJI.K (ada simpanan sesudahnya) & 3 gagal UJI.B (tidak ada simpanan)
  insert into public.log_error_app (aplikasi, jenis, sidik, pesan, pengguna, jumlah, konteks) values
    ('vista-pekerja', 'gagal_simpan', 'uji-k14-a', 'Kunci Progress STEL UJI.K: TypeError: Failed to fetch', 'OP UJI', 3,
      jsonb_build_object('panelId', v_panel, 'kode', 'UJI.K', 'proses', 'STEL', 'jenisGagal', 'koneksi')),
    ('vista-pekerja', 'gagal_simpan', 'uji-k14-b', 'Kunci Progress STEL UJI.B: TypeError: Failed to fetch', 'OP UJI', 3,
      jsonb_build_object('panelId', v_panel, 'kode', 'UJI.B', 'proses', 'STEL', 'jenisGagal', 'koneksi')),
    ('vista-pekerja', 'gagal_simpan', 'uji-k14-c', 'Kunci Progress STEL UJI.C: TypeError: Failed to fetch', 'OP UJI', 2,
      jsonb_build_object('panelId', v_panel, 'kode', 'UJI.C', 'proses', 'STEL'));
  v_hasil := public.jalankan_cek_kesehatan('semua');
  if exists (select 1 from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and status = 'error') then
    raise exception 'GAGAL U3: ada cek error: %', (select string_agg(kode || ': ' || pesan_error, '; ') from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and status = 'error');
  end if;
  select sampel into v_s from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K14';
  if not exists (select 1 from jsonb_array_elements(v_s) e where e->>'kode_komponen' = 'UJI.K' and e->>'jenis' = 'tersimpan kemudian') then
    raise exception 'GAGAL U3a: K14 tidak menandai UJI.K "tersimpan kemudian": %', v_s;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_s) e where e->>'kode_komponen' = 'UJI.B' and e->>'jenis' = 'BELUM terlihat tersimpan') then
    raise exception 'GAGAL U3b: K14 tidak menandai UJI.B "BELUM terlihat tersimpan": %', v_s;
  end if;
  if exists (select 1 from jsonb_array_elements(v_s) e where e->>'kode_komponen' = 'UJI.C') then
    raise exception 'GAGAL U3c: K14 menangkap UJI.C yang baru 2 kejadian';
  end if;
  raise notice 'LULUS U3: K14 membedakan tersimpan kemudian / belum tersimpan, < 3 kejadian tidak ikut';

  foreach v_kode in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13'] loop
    execute 'select count(*) from (' || public._sql_cek_kesehatan(v_kode) || ') q';
  end loop;
  raise notice 'LULUS U4: query K1-K13 tetap jalan';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
