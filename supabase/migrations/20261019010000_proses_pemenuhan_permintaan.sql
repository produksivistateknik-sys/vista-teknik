-- ============================================================================================
-- RPC proses_pemenuhan_permintaan (19 Okt 2026, disetujui user). Pemenuhan permintaan oleh Gudang (penuh / sebagian /
-- 0 = jadi hutang) dulu 3 langkah terpisah dari browser TANPA cek error (vista-pekerja PermintaanGudangTab
-- prosesSubmitDenganQty): (1) update item jadi submit / HAPUS item kalau dipenuhi 0, (2) insert baris hutang sisa.
-- Sinyal putus di antara (1) & (2) = barang hilang dari permintaan; tombol tertekan 2x / 2 petugas = hutang dobel.
-- Sekarang SATU transaksi di server:
--   - baris item DIKUNCI (FOR UPDATE) & WAJIB masih 'pending' (sudah diproses -> ditolak, kode P0001)
--   - 0 <= qty dipenuhi <= qty item
--   - perilaku SAMA PERSIS dgn kode lama:
--       penuh    : item -> status submit, qty = dipenuhi
--       sebagian : item -> submit qty dipenuhi + baris hutang sisa (induk_item_id = item ini)
--       0        : item DIHAPUS + baris hutang qty penuh (tanpa induk) - lihat komentar lama di prosesSubmitDenganQty
--     baris hutang mengisi kolom yang sama dgn kode lama (komponen, satuan, qty_diminta_awal = qty item, status pending,
--     is_hutang true); updated_by/updated_at/dilihat_operator=false sama dgn update lama.
--   - gagal di langkah mana pun -> SEMUA batal.
-- Data cek 19 Okt: 35 baris hutang, 0 dobel, 0 kembar, 0 induk hilang (belum ada kerusakan; perbaikan pencegahan).
-- Verifikasi: supabase/verifikasi/20261019010000_proses_pemenuhan_permintaan_verifikasi.sql ('SEMUA LULUS')
-- Rollback  : supabase/rollback/20261019010000_proses_pemenuhan_permintaan_rollback.sql
-- ============================================================================================
begin;

create or replace function public.proses_pemenuhan_permintaan(p_item_id bigint, p_qty_dipenuhi numeric, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_it public.permintaan_item%rowtype; v_qty numeric; v_sisa numeric; v_hutang bigint;
begin
  if p_qty_dipenuhi is null or p_qty_dipenuhi < 0 then raise exception 'qty dipenuhi tidak sah (%)', p_qty_dipenuhi using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'nama petugas wajib' using errcode = '22023'; end if;
  select * into v_it from public.permintaan_item where id = p_item_id for update;
  if not found then raise exception 'Item permintaan % tidak ada (mungkin sudah diproses petugas lain) - muat ulang daftar.', p_item_id using errcode = 'P0001'; end if;
  if v_it.status is distinct from 'pending' then
    raise exception 'Item "%" sudah diproses (status %) - muat ulang daftar.', v_it.nama_komponen, v_it.status using errcode = 'P0001';
  end if;
  v_qty := coalesce(v_it.qty, 0);
  if p_qty_dipenuhi > v_qty then raise exception 'qty dipenuhi (%) melebihi qty diminta (%)', p_qty_dipenuhi, v_qty using errcode = '22023'; end if;
  v_sisa := v_qty - p_qty_dipenuhi;

  if p_qty_dipenuhi > 0 then
    update public.permintaan_item
    set status = 'submit', qty = p_qty_dipenuhi, updated_by = btrim(p_oleh), updated_at = now(), dilihat_operator = false
    where id = v_it.id;
  else
    delete from public.permintaan_item where id = v_it.id;
  end if;

  if v_sisa > 0 then
    insert into public.permintaan_item (permintaan_id, komponen_bbmb_master_id, komponen_master_id, kode_komponen, nama_komponen,
      satuan, satuan_dipilih, qty, qty_diminta_awal, status, is_hutang, induk_item_id)
    values (v_it.permintaan_id, v_it.komponen_bbmb_master_id, v_it.komponen_master_id, v_it.kode_komponen, v_it.nama_komponen,
      v_it.satuan, v_it.satuan_dipilih, v_sisa, v_qty, 'pending', true, case when p_qty_dipenuhi > 0 then v_it.id end)
    returning id into v_hutang;
  end if;

  return jsonb_build_object('item_id', v_it.id, 'dipenuhi', p_qty_dipenuhi, 'sisa', v_sisa, 'lunas', v_sisa = 0,
    'item_dihapus', p_qty_dipenuhi = 0, 'hutang_id', v_hutang);
end $$;

revoke all on function public.proses_pemenuhan_permintaan(bigint, numeric, text) from public;
grant execute on function public.proses_pemenuhan_permintaan(bigint, numeric, text) to anon, authenticated;

commit;
