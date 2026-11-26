-- ============================================================================================
-- KOREKSI QTY PERMINTAAN - TAHAP 2: pemenuhan Gudang tahan layar basi + riwayat koreksi tidak hilang (26 Nov 2026, keputusan user)
-- (1) proses_pemenuhan_permintaan 4 argumen (+ p_qty_dilihat = qty yang TAMPIL di modal Konfirmasi HP Gudang):
--     baris dikunci; qty item sekarang beda dari yang dilihat (Admin baru mengoreksi) -> DITOLAK P0001 "muat ulang",
--     lalu menjalankan versi 3 argumen di transaksi yang sama (kunci baris sama). Tanpa ini: Admin menaikkan 5 -> 10, Gudang
--     menekan Konfirmasi 5 di layar lama = diam-diam jadi pemenuhan sebagian + hutang 5 palsu.
-- (2) proses_pemenuhan_permintaan 3 argumen (HP lama, dipakai juga oleh versi 4 argumen) - SAMA PERSIS dgn 19 Okt kecuali
--     cabang "dipenuhi 0" (item dihapus + hutang qty penuh):
--     a. baris hutang dibuat SEBELUM item dihapus, lalu riwayat koreksi item (permintaan_item_koreksi, FK on delete cascade)
--        DIPINDAH ke baris hutang itu - dulu ikut terhapus (temuan data-migrasi-reviewer 26 Nov; catatan wajib harus awet).
--     b. induk_item_id hutang = induk item yang dihapus (dulu selalu null). Item biasa: tetap null (sama). Item hutang yang
--        dipenuhi 0: rantai cicilan ke item asal tidak putus (dipakai cek K19 ketat Tahap 3). Pemakai induk_item_id di
--        aplikasi hanya peringatan "terkait hutang" Riwayat Gudang (vista-pekerja RiwayatGudangTab bukaKoreksi).
-- Verifikasi: supabase/verifikasi/20261126020000_pemenuhan_qty_dilihat_verifikasi.sql ('SEMUA LULUS')
-- Rollback  : supabase/rollback/20261126020000_pemenuhan_qty_dilihat_rollback.sql (kembalikan HP Gudang DULU)
-- ============================================================================================
begin;

do $$ begin
  if to_regprocedure('public.proses_pemenuhan_permintaan(bigint,numeric,text)') is null then
    raise exception 'proses_pemenuhan_permintaan 3 argumen tidak ditemukan - batal';
  end if;
  if to_regprocedure('public.proses_pemenuhan_permintaan(bigint,numeric,text,numeric)') is not null then
    raise exception 'proses_pemenuhan_permintaan 4 argumen sudah ada (Tahap 2 sudah dijalankan?) - batal';
  end if;
end $$;

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
  end if;

  if v_sisa > 0 then
    insert into public.permintaan_item (permintaan_id, komponen_bbmb_master_id, komponen_master_id, kode_komponen, nama_komponen,
      satuan, satuan_dipilih, qty, qty_diminta_awal, status, is_hutang, induk_item_id)
    values (v_it.permintaan_id, v_it.komponen_bbmb_master_id, v_it.komponen_master_id, v_it.kode_komponen, v_it.nama_komponen,
      v_it.satuan, v_it.satuan_dipilih, v_sisa, v_qty, 'pending', true,
      case when p_qty_dipenuhi > 0 then v_it.id else v_it.induk_item_id end)
    returning id into v_hutang;
  end if;

  if p_qty_dipenuhi = 0 then
    if v_hutang is not null then
      update public.permintaan_item_koreksi set permintaan_item_id = v_hutang where permintaan_item_id = v_it.id;
    end if;
    delete from public.permintaan_item where id = v_it.id;
  end if;

  return jsonb_build_object('item_id', v_it.id, 'dipenuhi', p_qty_dipenuhi, 'sisa', v_sisa, 'lunas', v_sisa = 0,
    'item_dihapus', p_qty_dipenuhi = 0, 'hutang_id', v_hutang);
end $$;
revoke all on function public.proses_pemenuhan_permintaan(bigint, numeric, text) from public;
grant execute on function public.proses_pemenuhan_permintaan(bigint, numeric, text) to anon, authenticated;

create function public.proses_pemenuhan_permintaan(p_item_id bigint, p_qty_dipenuhi numeric, p_oleh text, p_qty_dilihat numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_qty numeric; v_nama text;
begin
  if p_qty_dilihat is null or p_qty_dilihat < 0 then raise exception 'qty yang dilihat tidak sah (%)', p_qty_dilihat using errcode = '22023'; end if;
  select qty, nama_komponen into v_qty, v_nama from public.permintaan_item where id = p_item_id for update;
  if found and v_qty is distinct from p_qty_dilihat then
    raise exception 'Qty "%" baru dikoreksi Admin (% -> %) - daftar dimuat ulang, periksa lalu konfirmasi lagi.', v_nama, p_qty_dilihat, v_qty
      using errcode = 'P0001';
  end if;
  return public.proses_pemenuhan_permintaan(p_item_id, p_qty_dipenuhi, p_oleh);
end $$;
revoke all on function public.proses_pemenuhan_permintaan(bigint, numeric, text, numeric) from public;
grant execute on function public.proses_pemenuhan_permintaan(bigint, numeric, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
