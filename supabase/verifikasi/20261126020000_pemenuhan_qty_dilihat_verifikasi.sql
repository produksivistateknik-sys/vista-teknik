-- VERIFIKASI Tahap 2 (pemenuhan qty dilihat) - jalankan SESUDAH migration 20261126020000.
-- Uji memakai baris BUATAN di dalam begin..ROLLBACK (tidak ada sisa, tidak ada notifikasi). Harus NOTICE 'SEMUA LULUS'.
begin;
do $$
declare v_perm bigint; v_a bigint; v_b bigint; v_k bigint; v_h bigint; j jsonb; gagal text[] := '{}';
begin
  if to_regprocedure('public.proses_pemenuhan_permintaan(bigint,numeric,text,numeric)') is null then gagal := gagal || '4 argumen tidak ada'::text; end if;
  if not has_function_privilege('anon', 'public.proses_pemenuhan_permintaan(bigint,numeric,text,numeric)', 'execute') then gagal := gagal || 'anon tidak bisa execute 4 argumen'::text; end if;
  if not has_function_privilege('anon', 'public.proses_pemenuhan_permintaan(bigint,numeric,text)', 'execute') then gagal := gagal || 'anon kehilangan execute 3 argumen'::text; end if;

  select id into v_perm from public.permintaan order by id desc limit 1;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status, disetujui_admin_at, disetujui_admin_oleh)
    values (v_perm, 'UJI VERIFIKASI', 10, 'pending', now(), 'UJI') returning id into v_a;

  -- layar basi: Gudang melihat 5, qty sekarang 10 -> ditolak, item tetap pending
  begin
    j := public.proses_pemenuhan_permintaan(v_a, 5, 'UJI', 5);
    gagal := gagal || 'qty dilihat basi TIDAK ditolak'::text;
  exception when sqlstate 'P0001' then null; end;
  begin
    j := public.proses_pemenuhan_permintaan(v_a, 5, 'UJI', null);
    gagal := gagal || 'qty dilihat null TIDAK ditolak'::text;
  exception when sqlstate '22023' then null; end;
  if (select status from public.permintaan_item where id = v_a) <> 'pending' then gagal := gagal || 'penolakan mengubah item'::text; end if;

  -- qty dilihat cocok -> sebagian 4 dari 10: item submit 4 + hutang 6 (induk = item)
  j := public.proses_pemenuhan_permintaan(v_a, 4, 'UJI', 10);
  if (select status || '/' || qty from public.permintaan_item where id = v_a) <> 'submit/4' then gagal := gagal || 'pemenuhan sebagian salah'::text; end if;
  v_h := (j->>'hutang_id')::bigint;
  if (select qty from public.permintaan_item where id = v_h and induk_item_id = v_a and is_hutang) is distinct from 6 then gagal := gagal || 'hutang sebagian salah'::text; end if;

  -- dipenuhi 0 pada baris hutang yang punya koreksi: koreksi PINDAH ke hutang baru, induk tetap ke item asal
  insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, alasan, diajukan_oleh, target_divisi)
    values (v_h, 6, 6, 'UJI (rollback)', 'UJI', 'admin') returning id into v_k;
  j := public.proses_pemenuhan_permintaan(v_h, 0, 'UJI', 6);
  v_b := (j->>'hutang_id')::bigint;
  if exists (select 1 from public.permintaan_item where id = v_h) then gagal := gagal || 'item dipenuhi 0 tidak dihapus'::text; end if;
  if (select permintaan_item_id from public.permintaan_item_koreksi where id = v_k) is distinct from v_b then gagal := gagal || 'koreksi tidak pindah ke hutang baru'::text; end if;
  if (select induk_item_id from public.permintaan_item where id = v_b) is distinct from v_a then gagal := gagal || 'induk hutang baru bukan item asal'::text; end if;

  -- item biasa dipenuhi 0 lewat 3 argumen: hutang tanpa induk (sama dgn perilaku lama)
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status, disetujui_admin_at, disetujui_admin_oleh)
    values (v_perm, 'UJI VERIFIKASI 2', 3, 'pending', now(), 'UJI') returning id into v_a;
  j := public.proses_pemenuhan_permintaan(v_a, 0, 'UJI');
  if (select induk_item_id from public.permintaan_item where id = (j->>'hutang_id')::bigint) is not null then gagal := gagal || 'item biasa dipenuhi 0: induk tidak null'::text; end if;

  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
