-- ============================================================================================
-- KOREKSI QTY: simpan qty FINAL yang disetujui admin (22 Okt 2026, keputusan user)
-- Temuan item 1968 (VINIL 8 BROWN, permintaan #960): koreksi 297 -> 0 disetujui, tapi qty item 3. RPC
-- approve_permintaan_koreksi menulis qty = p_qty_final (angka di kotak layar admin, BOLEH diubah admin dari
-- qty_diusulkan) tapi angka itu TIDAK disimpan di mana pun -> tidak bisa ditelusuri.
-- (1) kolom permintaan_item_koreksi.qty_final (null = koreksi lama sebelum kolom ini; aplikasi memakai qty_diusulkan).
-- (2) approve_permintaan_koreksi menyimpan qty_final. Signature & perilaku lain TIDAK berubah - sengaja TIDAK mengisi
--     permintaan_item.updated_at (Riwayat Gudang memakai kolom itu sbg tanggal Gudang memproses barang).
-- Tidak ada tabel arsip pasangan (permintaan tetap di tempat saat panel diarsip - panel_id_arsip).
-- Dry-run   : supabase/verifikasi/20261022030000_koreksi_qty_final_dryrun.sql
-- Verifikasi: supabase/verifikasi/20261022030000_koreksi_qty_final_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261022030000_koreksi_qty_final_rollback.sql
-- ============================================================================================
begin;
alter table public.permintaan_item_koreksi add column if not exists qty_final numeric;
comment on column public.permintaan_item_koreksi.qty_final is
  'Qty yang BENAR-BENAR ditulis ke permintaan_item.qty saat disetujui (bisa beda dari qty_diusulkan bila admin mengubah). Null = koreksi sebelum 22 Okt 2026.';

create or replace function public.approve_permintaan_koreksi(
  p_koreksi_id bigint, p_qty_final numeric, p_admin text
) returns table(sukses boolean, pesan text)
language plpgsql
as $$
declare
  v_item_id bigint;
begin
  select permintaan_item_id into v_item_id
  from public.permintaan_item_koreksi
  where id = p_koreksi_id and status = 'menunggu'
  for update;

  if not found then
    return query select false, 'Pengajuan ini sudah diproses (mungkin oleh admin lain) - refresh halaman.';
    return;
  end if;

  update public.permintaan_item set qty = p_qty_final, sudah_diinput = false where id = v_item_id;

  update public.permintaan_item_koreksi
  set status = 'disetujui', disetujui_oleh = p_admin, diputuskan_at = now(), qty_final = p_qty_final
  where id = p_koreksi_id;

  return query select true, 'OK';
end;
$$;
grant execute on function public.approve_permintaan_koreksi(bigint, numeric, text) to anon, authenticated;
commit;
