-- ROLLBACK Tahap 2 (pemenuhan qty dilihat). URUTAN: kembalikan HP Gudang (vista-pekerja) ke versi yang memanggil 3 argumen DULU,
-- baru jalankan ini (kalau tidak, Konfirmasi Gudang gagal 'function not found'). Versi 3 argumen kembali PERSIS ke 19 Okt 2026.
-- Koreksi yang sudah dipindah ke baris hutang tetap di sana (riwayat tidak dihapus).
begin;
do $$ begin
  if to_regprocedure('public.koreksi_qty_sebelum_disiapkan(bigint,numeric,numeric,text,text)') is not null then
    raise exception 'Rollback Tahap 3 (030000) dulu - batal';
  end if;
end $$;
drop function if exists public.proses_pemenuhan_permintaan(bigint, numeric, text, numeric);
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
notify pgrst, 'reload schema';
commit;
-- Periksa: harus 1 baris (3 argumen)
select p.oid::regprocedure from pg_proc p where p.proname = 'proses_pemenuhan_permintaan';
