-- VERIFIKASI Tahap 1 koreksi qty (catatan admin & sumber) - jalankan SESUDAH migration 20261126010000.
-- Semua uji di dalam begin..ROLLBACK (tidak ada sisa data, tidak ada notifikasi). Harus muncul NOTICE 'SEMUA LULUS'.
begin;
do $$
declare v_item bigint; v_qty numeric; v_k bigint; gagal text[] := '{}'; r record;
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'permintaan_item_koreksi'
      and column_name in ('sumber', 'catatan_admin')) <> 2 then gagal := gagal || 'kolom sumber/catatan_admin tidak lengkap'::text; end if;
  if exists (select 1 from public.permintaan_item_koreksi where sumber is distinct from 'gudang') then gagal := gagal || 'ada baris lama bersumber selain gudang'::text; end if;
  if to_regprocedure('public.approve_permintaan_koreksi(bigint,numeric,text,text)') is null
     or to_regprocedure('public.approve_permintaan_koreksi(bigint,numeric,text)') is null then gagal := gagal || 'versi 3/4 argumen tidak lengkap'::text; end if;
  if not has_function_privilege('anon', 'public.approve_permintaan_koreksi(bigint,numeric,text,text)', 'execute') then gagal := gagal || 'anon tidak bisa execute 4 argumen'::text; end if;
  begin
    insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, alasan, diajukan_oleh, target_divisi, sumber)
    values ((select id from public.permintaan_item order by id desc limit 1), 1, 1, 'UJI', 'UJI', 'admin', 'salah');
    gagal := gagal || 'CHECK sumber tidak menolak nilai asing'::text;
  exception when check_violation then null; end;

  -- item uji: sembarang item sudah disiapkan (status submit); semua perubahan di-rollback
  select id, qty into v_item, v_qty from public.permintaan_item where status = 'submit' order by id desc limit 1;
  insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, alasan, diajukan_oleh, target_divisi)
    values (v_item, v_qty, v_qty + 7, 'UJI verifikasi (rollback)', 'UJI', 'admin') returning id into v_k;
  select * into r from public.approve_permintaan_koreksi(v_k, v_qty + 5, 'UJI', null);
  if r.sukses then gagal := gagal || '4 arg: angka beda TANPA catatan tidak ditolak'::text; end if;
  select * into r from public.approve_permintaan_koreksi(v_k, v_qty + 5, 'UJI', '  ab ');
  if r.sukses then gagal := gagal || '4 arg: catatan "ab" tidak ditolak'::text; end if;
  select * into r from public.approve_permintaan_koreksi(v_k, v_qty + 5, 'UJI');
  if r.sukses then gagal := gagal || '3 arg: angka beda tidak ditolak'::text; end if;
  if (select status from public.permintaan_item_koreksi where id = v_k) <> 'menunggu' then gagal := gagal || 'penolakan mengubah status koreksi'::text; end if;
  select * into r from public.approve_permintaan_koreksi(v_k, v_qty + 5, 'UJI', 'stok gudang kurang');
  if not r.sukses then gagal := gagal || ('4 arg dgn catatan gagal: ' || r.pesan); end if;
  if (select catatan_admin from public.permintaan_item_koreksi where id = v_k) is distinct from 'stok gudang kurang' then gagal := gagal || 'catatan_admin tidak tersimpan'::text; end if;
  if (select qty from public.permintaan_item where id = v_item) is distinct from v_qty + 5 then gagal := gagal || 'qty item tidak berubah'::text; end if;
  -- 3 argumen dgn angka SAMA dgn usulan tetap jalan
  insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, alasan, diajukan_oleh, target_divisi)
    values (v_item, v_qty + 5, v_qty + 1, 'UJI verifikasi 2 (rollback)', 'UJI', 'admin') returning id into v_k;
  select * into r from public.approve_permintaan_koreksi(v_k, v_qty + 1, 'UJI');
  if not r.sukses then gagal := gagal || ('3 arg angka sama gagal: ' || r.pesan); end if;
  select * into r from public.approve_permintaan_koreksi(v_k, v_qty + 1, 'UJI', null);
  if r.sukses then gagal := gagal || 'approve kedua (sudah diproses) tidak ditolak'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
-- Baris ini hanya tampil bila blok di atas tidak error:
select 'SEMUA LULUS' as hasil;
