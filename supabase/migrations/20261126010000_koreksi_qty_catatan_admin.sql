-- ============================================================================================
-- KOREKSI QTY PERMINTAAN - TAHAP 1: catatan wajib & sumber koreksi (26 Nov 2026, keputusan user)
-- Usulan admin produksi: SETIAP koreksi qty wajib disertai catatan. Celah di jalur yang ada: admin menyetujui pengajuan
-- koreksi Gudang dengan angka BERBEDA dari usulan (approve_permintaan_koreksi p_qty_final) tanpa alasan (contoh #41, 1968).
-- (1) permintaan_item_koreksi.sumber   : 'gudang' (pengajuan Gudang, semua 26 baris lama - diperiksa 26 Nov: semua
--     diajukan akun Gudang), 'admin_sebelum_siap' (Tahap 3), 'admin_saat_setuju' (Tahap 5).
-- (2) permintaan_item_koreksi.catatan_admin : alasan admin bila angka disetujui beda dari usulan Gudang.
-- (3) approve_permintaan_koreksi 4 argumen (+ p_catatan_admin): wajib catatan >= 3 huruf bila qty_final <> qty_diusulkan.
--     Perilaku lain SAMA PERSIS dgn versi 22 Okt (qty item, sudah_diinput=false, qty_final; updated_at item TIDAK disentuh).
-- (4) approve_permintaan_koreksi 3 argumen (tab admin lama yang belum dimuat ulang): angka SAMA dgn usulan -> tetap jalan;
--     angka BEDA -> ditolak "muat ulang halaman" (tanpa catatan tidak boleh lagi).
-- Tidak ada tabel arsip pasangan permintaan_item_koreksi. Tidak mengubah data lama (default kolom saja).
-- Verifikasi: supabase/verifikasi/20261126010000_koreksi_qty_catatan_admin_verifikasi.sql ('SEMUA LULUS')
-- Rollback  : supabase/rollback/20261126010000_koreksi_qty_catatan_admin_rollback.sql
-- ============================================================================================
begin;

do $$ begin
  if to_regclass('public.permintaan_item_koreksi') is null then raise exception 'tabel permintaan_item_koreksi tidak ada - batal'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'permintaan_item_koreksi'
             and column_name in ('sumber', 'catatan_admin')) then
    raise exception 'Kolom sumber/catatan_admin sudah ada (Tahap 1 sudah pernah dijalankan?) - batal';
  end if;
  if to_regprocedure('public.approve_permintaan_koreksi(bigint,numeric,text)') is null then
    raise exception 'approve_permintaan_koreksi(bigint,numeric,text) tidak ditemukan - batal';
  end if;
  if to_regprocedure('public.approve_permintaan_koreksi(bigint,numeric,text,text)') is not null then
    raise exception 'approve_permintaan_koreksi 4 argumen sudah ada - batal';
  end if;
end $$;

alter table public.permintaan_item_koreksi add column sumber text not null default 'gudang';
alter table public.permintaan_item_koreksi add constraint permintaan_item_koreksi_sumber_check
  check (sumber in ('gudang', 'admin_sebelum_siap', 'admin_saat_setuju'));
alter table public.permintaan_item_koreksi add column catatan_admin text;
alter table public.permintaan_item_koreksi add constraint permintaan_item_koreksi_catatan_admin_panjang
  check (catatan_admin is null or length(catatan_admin) <= 500);
comment on column public.permintaan_item_koreksi.sumber is
  'gudang = pengajuan Gudang (diputuskan admin); admin_sebelum_siap = koreksi admin saat item disetujui & belum disiapkan Gudang; admin_saat_setuju = admin mengubah qty saat menyetujui permintaan. Sejak 26 Nov 2026.';
comment on column public.permintaan_item_koreksi.catatan_admin is
  'Alasan admin bila qty disetujui berbeda dari usulan Gudang (wajib sejak 26 Nov 2026).';

create function public.approve_permintaan_koreksi(
  p_koreksi_id bigint, p_qty_final numeric, p_admin text, p_catatan_admin text
) returns table(sukses boolean, pesan text)
language plpgsql
as $$
declare
  v_item_id bigint;
  v_usul numeric;
  v_catatan text := nullif(btrim(coalesce(p_catatan_admin, '')), '');
begin
  if p_qty_final is null or p_qty_final < 0 then
    return query select false, 'Qty harus diisi, angka >= 0.'; return;
  end if;
  if coalesce(length(btrim(p_admin)), 0) < 1 or length(p_admin) > 100 then
    return query select false, 'Nama admin tidak sah.'; return;
  end if;
  if v_catatan is not null and length(v_catatan) > 500 then
    return query select false, 'Catatan terlalu panjang (maks. 500 huruf).'; return;
  end if;

  select permintaan_item_id, qty_diusulkan into v_item_id, v_usul
  from public.permintaan_item_koreksi
  where id = p_koreksi_id and status = 'menunggu'
  for update;

  if not found then
    return query select false, 'Pengajuan ini sudah diproses (mungkin oleh admin lain) - refresh halaman.';
    return;
  end if;

  if p_qty_final is distinct from v_usul and coalesce(length(v_catatan), 0) < 3 then
    return query select false, 'Qty disetujui berbeda dari usulan Gudang - catatan alasan wajib diisi (min. 3 huruf).';
    return;
  end if;

  update public.permintaan_item set qty = p_qty_final, sudah_diinput = false where id = v_item_id;

  update public.permintaan_item_koreksi
  set status = 'disetujui', disetujui_oleh = p_admin, diputuskan_at = now(), qty_final = p_qty_final,
      catatan_admin = v_catatan
  where id = p_koreksi_id;

  return query select true, 'OK';
end;
$$;
grant execute on function public.approve_permintaan_koreksi(bigint, numeric, text, text) to anon, authenticated;

-- Versi 3 argumen: dipertahankan utk tab admin yang belum dimuat ulang. Angka sama = jalan; angka beda = ditolak.
create or replace function public.approve_permintaan_koreksi(
  p_koreksi_id bigint, p_qty_final numeric, p_admin text
) returns table(sukses boolean, pesan text)
language plpgsql
as $$
declare v_usul numeric;
begin
  select qty_diusulkan into v_usul from public.permintaan_item_koreksi where id = p_koreksi_id;
  if found and p_qty_final is distinct from v_usul then
    return query select false, 'Aplikasi admin versi lama: qty yang diubah wajib disertai catatan. Muat ulang halaman (Ctrl+Shift+R) lalu ulangi.';
    return;
  end if;
  return query select * from public.approve_permintaan_koreksi(p_koreksi_id, p_qty_final, p_admin, null::text);
end;
$$;
grant execute on function public.approve_permintaan_koreksi(bigint, numeric, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
