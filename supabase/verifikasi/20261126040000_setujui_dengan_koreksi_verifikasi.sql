-- VERIFIKASI Tahap 5 (setujui dengan koreksi) - jalankan SESUDAH migration 20261126040000.
-- Uji memakai baris BUATAN di dalam begin..ROLLBACK (tidak ada sisa, tidak ada notifikasi). Harus NOTICE 'SEMUA LULUS'.
begin;
do $$
declare v_perm bigint; v_a bigint; j jsonb; gagal text[] := '{}'; uji text;
begin
  if not has_function_privilege('anon', 'public.setujui_permintaan_dengan_koreksi(bigint,numeric,numeric,text,text)', 'execute') then gagal := gagal || 'anon tidak bisa execute RPC'::text; end if;
  select id into v_perm from public.permintaan order by id desc limit 1;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status)
    values (v_perm, 'UJI VERIFIKASI', 5, 'menunggu_admin') returning id into v_a;

  foreach uji in array array['catatan_kosong','catatan_pendek','nol','sama','qty_lama_basi'] loop
    begin
      case uji
        when 'catatan_kosong' then j := public.setujui_permintaan_dengan_koreksi(v_a, 5, 3, '', 'UJI');
        when 'catatan_pendek' then j := public.setujui_permintaan_dengan_koreksi(v_a, 5, 3, 'ab', 'UJI');
        when 'nol' then j := public.setujui_permintaan_dengan_koreksi(v_a, 5, 0, 'salah pencet', 'UJI');
        when 'sama' then j := public.setujui_permintaan_dengan_koreksi(v_a, 5, 5, 'salah pencet', 'UJI');
        when 'qty_lama_basi' then j := public.setujui_permintaan_dengan_koreksi(v_a, 4, 3, 'salah pencet', 'UJI');
      end case;
      gagal := gagal || ('tidak ditolak: ' || uji);
    exception when sqlstate '22023' or sqlstate 'P0001' then null; end;
  end loop;
  if (select status || '/' || qty from public.permintaan_item where id = v_a) <> 'menunggu_admin/5' then gagal := gagal || 'penolakan mengubah item'::text; end if;

  -- naik boleh (Gudang belum melihat): 5 -> 8
  j := public.setujui_permintaan_dengan_koreksi(v_a, 5, 8, 'operator minta tambah', 'UJI');
  if (select status || '/' || qty || '/' || coalesce(disetujui_admin_oleh, '') from public.permintaan_item where id = v_a) <> 'pending/8/UJI'
    then gagal := gagal || 'item tidak jadi pending/8'::text; end if;
  if not exists (select 1 from public.permintaan_item_koreksi where permintaan_item_id = v_a and sumber = 'admin_saat_setuju'
                 and qty_lama = 5 and qty_final = 8 and status = 'disetujui' and alasan = 'operator minta tambah')
    then gagal := gagal || 'baris koreksi admin_saat_setuju tidak lengkap'::text; end if;
  -- kedua kali: sudah tidak menunggu -> P0001
  begin
    j := public.setujui_permintaan_dengan_koreksi(v_a, 8, 6, 'salah pencet', 'UJI');
    gagal := gagal || 'item sudah disetujui tidak ditolak'::text;
  exception when sqlstate 'P0001' then null; end;

  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
