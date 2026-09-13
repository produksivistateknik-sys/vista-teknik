-- Jaring pengaman: approve/tolak Koreksi Qty jadi ATOMIK (13 Sep 2026, audit "aplikasi bebas
-- bug" - modul Permintaan Barang).
--
-- Root cause celah yang ditemukan: setujuiKoreksi()/tolakKoreksi() (PermintaanAdminTab.tsx)
-- sebelumnya melakukan 2 UPDATE terpisah dari client (update qty di permintaan_item, lalu update
-- status di permintaan_item_koreksi) TANPA transaksi. Kalau koneksi putus di antara keduanya,
-- qty barang sudah berubah tapi status pengajuan tetap 'menunggu' - keliatan seolah belum
-- diproses padahal datanya sudah berubah. Juga TIDAK ADA proteksi race condition (2 admin klik
-- Setujui/Tolak bersamaan di baris yang sama, dobel-proses diam-diam).
--
-- 2 RPC ini gabungkan jadi 1 transaksi atomik di server (plpgsql, sama pola merge_panel_checklist/
-- panels_validate_busbar_cap_progress) + guard `where status='menunggu'` - kalau baris udah
-- diproses (misal admin lain lebih cepat), UPDATE gak kena baris manapun, RPC balikin
-- sukses=false dengan pesan jelas, BUKAN diam-diam dobel-proses.
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
  set status = 'disetujui', disetujui_oleh = p_admin, diputuskan_at = now()
  where id = p_koreksi_id;

  return query select true, 'OK';
end;
$$;

create or replace function public.reject_permintaan_koreksi(
  p_koreksi_id bigint, p_admin text, p_catatan text
) returns table(sukses boolean, pesan text)
language plpgsql
as $$
begin
  update public.permintaan_item_koreksi
  set status = 'ditolak', disetujui_oleh = p_admin, diputuskan_at = now(), catatan_reject = p_catatan
  where id = p_koreksi_id and status = 'menunggu';

  if not found then
    return query select false, 'Pengajuan ini sudah diproses (mungkin oleh admin lain) - refresh halaman.';
    return;
  end if;

  return query select true, 'OK';
end;
$$;

grant execute on function public.approve_permintaan_koreksi(bigint, numeric, text) to anon, authenticated;
grant execute on function public.reject_permintaan_koreksi(bigint, text, text) to anon, authenticated;

comment on function public.approve_permintaan_koreksi(bigint, numeric, text) is
  'Setujui pengajuan Koreksi Qty - atomik (update qty item + status koreksi dalam 1 transaksi), guard status=menunggu buat cegah race condition/dobel-proses.';
comment on function public.reject_permintaan_koreksi(bigint, text, text) is
  'Tolak pengajuan Koreksi Qty - atomik, guard status=menunggu, simpan catatan_reject.';
