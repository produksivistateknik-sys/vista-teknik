-- ROLLBACK Tahap 1 koreksi qty. Urutan: kembalikan aplikasi admin (vista-teknik) ke versi sebelum Tahap 1 DULU, baru jalankan ini.
-- approve_permintaan_koreksi 3 argumen kembali ke versi 22 Okt 2026; versi 4 argumen dihapus.
-- Kolom sumber & catatan_admin DIBIARKAN bila sudah ada baris bersumber admin / catatan terisi (riwayat tidak dihapus);
-- bila belum ada sama sekali, blok terakhir menghapusnya.
begin;
drop function if exists public.approve_permintaan_koreksi(bigint, numeric, text, text);
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

do $$ begin
  if exists (select 1 from public.permintaan_item_koreksi where sumber <> 'gudang' or catatan_admin is not null) then
    raise notice 'Kolom sumber/catatan_admin DIBIARKAN: sudah berisi riwayat koreksi admin.';
  else
    alter table public.permintaan_item_koreksi drop constraint if exists permintaan_item_koreksi_sumber_check;
    alter table public.permintaan_item_koreksi drop constraint if exists permintaan_item_koreksi_catatan_admin_panjang;
    alter table public.permintaan_item_koreksi drop column if exists sumber;
    alter table public.permintaan_item_koreksi drop column if exists catatan_admin;
    raise notice 'Kolom sumber/catatan_admin dihapus (belum ada isinya).';
  end if;
end $$;
-- Catatan: bila Tahap 3/5 sudah dijalankan, rollback Tahap 3/5 dulu (fungsinya menulis kolom sumber).
notify pgrst, 'reload schema';
commit;

-- Periksa: harus 1 baris (versi 3 argumen saja)
select p.oid::regprocedure from pg_proc p where p.proname = 'approve_permintaan_koreksi';
