-- VERIFIKASI proses_pemenuhan_permintaan (jalankan SESUDAH migration 20261019010000). Data uji ditanam & semua di
-- transaksi yang di-ROLLBACK (tidak ada yang tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_p bigint; a bigint; b bigint; c bigint; d bigint; v_h jsonb; v_n int;
begin
  insert into public.permintaan (jenis, operator_nama, divisi, panel_nama) values ('BBMB', 'UJI', 'uji', 'UJI PANEL') returning id into v_p;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status, satuan) values (v_p, 'UJI A', 10, 'pending', 'PCS') returning id into a;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status, satuan) values (v_p, 'UJI B', 10, 'pending', 'PCS') returning id into b;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status, satuan) values (v_p, 'UJI C', 7, 'pending', 'PCS') returning id into c;

  -- V1 penuh
  v_h := public.proses_pemenuhan_permintaan(a, 10, 'UJI');
  if (select status from public.permintaan_item where id = a) <> 'submit' or (v_h->>'lunas')::boolean is not true or v_h->>'hutang_id' is not null then raise exception 'GAGAL V1: %', v_h; end if;
  raise notice 'LULUS V1: dipenuhi penuh -> submit, tanpa hutang';

  -- V2 sebagian: 10 -> 6 dipenuhi, hutang 4 dgn induk
  v_h := public.proses_pemenuhan_permintaan(b, 6, 'UJI');
  if (select qty from public.permintaan_item where id = b) <> 6
     or not exists (select 1 from public.permintaan_item where id = (v_h->>'hutang_id')::bigint and is_hutang and status = 'pending' and qty = 4 and qty_diminta_awal = 10 and induk_item_id = b and satuan = 'PCS') then
    raise exception 'GAGAL V2: %', v_h; end if;
  raise notice 'LULUS V2: sebagian -> item submit 6 + hutang 4 (induk = item, qty awal 10)';

  -- V3 dipenuhi 0: item dihapus, hutang qty penuh tanpa induk
  v_h := public.proses_pemenuhan_permintaan(c, 0, 'UJI');
  if exists (select 1 from public.permintaan_item where id = c)
     or not exists (select 1 from public.permintaan_item where id = (v_h->>'hutang_id')::bigint and is_hutang and qty = 7 and induk_item_id is null and status = 'pending') then
    raise exception 'GAGAL V3: %', v_h; end if;
  d := (v_h->>'hutang_id')::bigint;
  raise notice 'LULUS V3: dipenuhi 0 -> item dihapus, hutang 7 tanpa induk';

  -- V4 diproses 2x ditolak (tidak ada hutang dobel)
  begin perform public.proses_pemenuhan_permintaan(b, 1, 'UJI'); raise exception 'GAGAL V4a: item submit diproses lagi';
  exception when sqlstate 'P0001' then null; end;
  begin perform public.proses_pemenuhan_permintaan(c, 0, 'UJI'); raise exception 'GAGAL V4b: item terhapus diproses lagi';
  exception when sqlstate 'P0001' then null; end;
  select count(*) into v_n from public.permintaan_item where permintaan_id = v_p and is_hutang;
  if v_n <> 2 then raise exception 'GAGAL V4c: jumlah hutang % (harus 2)', v_n; end if;
  raise notice 'LULUS V4: item yang sudah diproses ditolak (P0001), hutang tidak dobel';

  -- V5 cicilan hutang (rantai): hutang 7 -> dipenuhi 3, hutang baru 4 induk = hutang lama
  v_h := public.proses_pemenuhan_permintaan(d, 3, 'UJI');
  if not exists (select 1 from public.permintaan_item where id = (v_h->>'hutang_id')::bigint and is_hutang and qty = 4 and qty_diminta_awal = 7 and induk_item_id = d) then raise exception 'GAGAL V5: %', v_h; end if;
  raise notice 'LULUS V5: cicilan hutang -> hutang baru 4, induk = hutang lama';

  -- V6 qty tidak sah & nama wajib
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status) values (v_p, 'UJI D', 5, 'pending') returning id into a;
  begin perform public.proses_pemenuhan_permintaan(a, 6, 'UJI'); raise exception 'GAGAL V6a: qty > diminta lolos'; exception when sqlstate '22023' then null; end;
  begin perform public.proses_pemenuhan_permintaan(a, -1, 'UJI'); raise exception 'GAGAL V6b: qty negatif lolos'; exception when sqlstate '22023' then null; end;
  begin perform public.proses_pemenuhan_permintaan(a, 1, ' '); raise exception 'GAGAL V6c: nama kosong lolos'; exception when sqlstate '22023' then null; end;
  if (select status from public.permintaan_item where id = a) <> 'pending' then raise exception 'GAGAL V6d: item berubah walau ditolak'; end if;
  begin perform public.proses_pemenuhan_permintaan(-1, 1, 'UJI'); raise exception 'GAGAL V6e: item tidak ada lolos'; exception when sqlstate 'P0001' then null; end;
  raise notice 'LULUS V6: qty > diminta / negatif / nama kosong / item tidak ada ditolak, item tidak berubah';

  if not has_function_privilege('anon', 'public.proses_pemenuhan_permintaan(bigint,numeric,text)', 'execute') then raise exception 'GAGAL V7'; end if;
  raise notice 'LULUS V7: anon boleh memanggil';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
