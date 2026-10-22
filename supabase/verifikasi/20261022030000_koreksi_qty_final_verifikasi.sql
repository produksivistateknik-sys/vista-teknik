-- VERIFIKASI qty_final - jalankan SESUDAH migration. Tes di dalam begin..ROLLBACK (tidak ada sisa). Harus 'SEMUA LULUS'.
begin;
do $$
declare v_k bigint; v_qty_awal numeric; gagal text[] := '{}'; r record;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'permintaan_item_koreksi' and column_name = 'qty_final')
    then gagal := gagal || 'kolom qty_final tidak ada'::text; end if;
  -- koreksi uji pada item 1939 (STREP TEMBAGA, di-rollback): diusulkan 590, admin MENGUBAH jadi 591
  select qty into v_qty_awal from public.permintaan_item where id = 1939;
  insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, alasan, diajukan_oleh, target_divisi)
    values (1939, v_qty_awal, 590, 'UJI verifikasi (rollback)', 'UJI', 'admin') returning id into v_k;
  select * into r from public.approve_permintaan_koreksi(v_k, 591, 'UJI');
  if not r.sukses then gagal := gagal || ('approve gagal: ' || r.pesan); end if;
  if (select qty_final from public.permintaan_item_koreksi where id = v_k) is distinct from 591 then gagal := gagal || 'qty_final tidak tersimpan'::text; end if;
  if (select qty from public.permintaan_item where id = 1939) is distinct from 591 then gagal := gagal || 'qty item tidak berubah'::text; end if;
  select * into r from public.approve_permintaan_koreksi(v_k, 1, 'UJI');
  if r.sukses then gagal := gagal || 'approve kedua (sudah diproses) TIDAK ditolak'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
