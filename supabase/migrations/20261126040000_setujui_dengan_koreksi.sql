-- ============================================================================================
-- KOREKSI QTY PERMINTAAN - TAHAP 5: catatan wajib bila Admin MENGUBAH qty saat menyetujui permintaan (26 Nov 2026, keputusan user)
-- Dulu tulisSetujui (PermintaanAdminTab) menimpa qty dari operator tanpa jejak & tanpa catatan - angka asli hilang.
-- RPC setujui_permintaan_dengan_koreksi(item, qty_lama, qty_baru, catatan, admin) - dipakai HANYA bila qty diubah:
--   baris dikunci; sah bila status masih 'menunggu_admin' (penjaga sama dgn tulisSetujui) & qty = qty_lama; catatan 3-500 huruf;
--   qty_baru > 0 & beda dari qty sekarang (naik/turun boleh - Gudang belum melihat item ini).
--   SATU transaksi: status 'pending' + qty + disetujui_admin_oleh/at (kolom sama dgn tulisSetujui) DAN 1 baris
--   permintaan_item_koreksi (status 'disetujui', sumber 'admin_saat_setuju', qty_lama = angka asli operator).
-- Setujui TANPA mengubah qty tetap lewat tulisSetujui lama (tidak berubah, kecuali kolom qty tidak lagi dikirim).
-- Butuh Tahap 1 (kolom sumber).
-- Verifikasi: supabase/verifikasi/20261126040000_setujui_dengan_koreksi_verifikasi.sql ('SEMUA LULUS')
-- Rollback  : supabase/rollback/20261126040000_setujui_dengan_koreksi_rollback.sql
-- ============================================================================================
begin;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'permintaan_item_koreksi' and column_name = 'sumber') then
    raise exception 'Jalankan dulu Tahap 1 (20261126010000_koreksi_qty_catatan_admin.sql) - batal';
  end if;
  if exists (select 1 from pg_proc where proname = 'setujui_permintaan_dengan_koreksi') then
    raise exception 'setujui_permintaan_dengan_koreksi sudah ada (Tahap 5 sudah dijalankan?) - batal';
  end if;
end $$;

create function public.setujui_permintaan_dengan_koreksi(
  p_item_id bigint, p_qty_lama numeric, p_qty_baru numeric, p_catatan text, p_admin text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.permintaan_item%rowtype; v_k bigint; v_catatan text := btrim(coalesce(p_catatan, '')); v_admin text := btrim(coalesce(p_admin, ''));
begin
  if length(v_catatan) < 3 then raise exception 'Catatan alasan qty diubah wajib diisi (min. 3 huruf).' using errcode = '22023'; end if;
  if length(v_catatan) > 500 then raise exception 'Catatan terlalu panjang (maks. 500 huruf).' using errcode = '22023'; end if;
  if length(v_admin) < 1 or length(v_admin) > 100 then raise exception 'Nama admin tidak sah.' using errcode = '22023'; end if;
  if p_qty_lama is null or p_qty_baru is null or p_qty_baru <= 0 then raise exception 'Qty harus angka lebih dari 0.' using errcode = '22023'; end if;

  select * into v from public.permintaan_item where id = p_item_id for update;
  if not found then raise exception 'Item permintaan % tidak ada - muat ulang.', p_item_id using errcode = 'P0001'; end if;
  if v.status is distinct from 'menunggu_admin' then
    raise exception 'Item "%" sudah tidak menunggu persetujuan (status %) - daftar dimuat ulang.', v.nama_komponen, v.status using errcode = 'P0001';
  end if;
  if v.qty is distinct from p_qty_lama then
    raise exception 'Qty "%" sudah berubah (% -> %) - muat ulang.', v.nama_komponen, p_qty_lama, v.qty using errcode = 'P0001';
  end if;
  if p_qty_baru = v.qty then raise exception 'Qty tidak diubah - gunakan Setujui biasa.' using errcode = '22023'; end if;

  update public.permintaan_item
  set status = 'pending', qty = p_qty_baru, disetujui_admin_oleh = v_admin, disetujui_admin_at = now()
  where id = v.id;
  insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, qty_final, alasan, status,
    diajukan_oleh, diajukan_at, target_divisi, disetujui_oleh, diputuskan_at, sumber)
  values (v.id, v.qty, p_qty_baru, p_qty_baru, v_catatan, 'disetujui', v_admin, now(), 'admin', v_admin, now(), 'admin_saat_setuju')
  returning id into v_k;
  return jsonb_build_object('item_id', v.id, 'qty_lama', v.qty, 'qty_baru', p_qty_baru, 'koreksi_id', v_k);
end $$;
revoke all on function public.setujui_permintaan_dengan_koreksi(bigint, numeric, numeric, text, text) from public;
grant execute on function public.setujui_permintaan_dengan_koreksi(bigint, numeric, numeric, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
