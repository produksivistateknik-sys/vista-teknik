-- ROLLBACK qty_final: RPC kembali ke versi 13 Sep 2026. Kolom qty_final DIBIARKAN (berisi jejak qty final koreksi
-- yang disetujui sejak migration; tidak dibaca RPC lama). Hapus kolom hanya kalau yakin: alter table ... drop column qty_final.
begin;
create or replace function public.approve_permintaan_koreksi(
  p_koreksi_id bigint, p_qty_final numeric, p_admin text
) returns table(sukses boolean, pesan text)
language plpgsql
as $$
declare
  v_item_id bigint;
begin
  select permintaan_item_id into v_item_id from public.permintaan_item_koreksi where id = p_koreksi_id and status = 'menunggu' for update;
  if not found then
    return query select false, 'Pengajuan ini sudah diproses (mungkin oleh admin lain) - refresh halaman.';
    return;
  end if;
  update public.permintaan_item set qty = p_qty_final, sudah_diinput = false where id = v_item_id;
  update public.permintaan_item_koreksi set status = 'disetujui', disetujui_oleh = p_admin, diputuskan_at = now() where id = p_koreksi_id;
  return query select true, 'OK';
end;
$$;
grant execute on function public.approve_permintaan_koreksi(bigint, numeric, text) to anon, authenticated;
commit;
