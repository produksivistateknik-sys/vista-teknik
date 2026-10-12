-- ARSIP PANEL TANPA MENGHAPUS PERMINTAAN BARANG (12 Okt 2026, tahap C insiden WO 076).
-- Dulu ManajemenWO.prosesArsipPanel MENGHAPUS permintaan + permintaan_item + fcs_tracking_komponen dari
-- browser (tanpa cek hasil) sebelum RPC arsip_panel, krn FK permintaan.panel_id menolak hapus panel.
-- Sekarang: permintaan TETAP UTUH, hanya dilepas dari panel (panel_id -> panel_id_arsip) di transaksi yang
-- sama dengan arsip_panel; unarsip menyambungkannya kembali (id panel tidak berubah saat diarsip).
-- arsip_panel / unarsip_panel lama TIDAK diubah - hanya dibungkus.

alter table public.permintaan add column if not exists panel_id_arsip bigint;
comment on column public.permintaan.panel_id_arsip is
  'Id panel saat panelnya diarsipkan (panel_id dikosongkan supaya FK tidak menolak). Diisi/dikembalikan oleh arsip_panel_aman/unarsip_panel_aman.';
create index if not exists idx_permintaan_panel_id_arsip on public.permintaan(panel_id_arsip) where panel_id_arsip is not null;

create or replace function public.arsip_panel_aman(p_panel_id bigint, p_user text, p_progress numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perm int;
begin
  perform 1 from public.panels where id = p_panel_id for update;
  if not found then
    raise exception 'Panel % tidak ditemukan (mungkin sudah diarsipkan/dihapus).', p_panel_id using errcode = 'P0001';
  end if;
  update public.permintaan set panel_id_arsip = panel_id, panel_id = null where panel_id = p_panel_id;
  get diagnostics v_perm = row_count;
  perform public.arsip_panel(p_panel_id => p_panel_id::int, p_user => p_user, p_progress => round(coalesce(p_progress, 0))::int);
  if exists (select 1 from public.panels where id = p_panel_id) then
    raise exception 'Arsip panel % gagal: panel masih ada setelah arsip_panel.', p_panel_id using errcode = 'P0001';
  end if;
  return jsonb_build_object('panel', 1, 'permintaan_dilepas', v_perm);
end $$;

create or replace function public.unarsip_panel_aman(p_panel_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perm int;
begin
  perform public.unarsip_panel(p_panel_id => p_panel_id::int);
  if not exists (select 1 from public.panels where id = p_panel_id) then
    raise exception 'Unarsip panel % gagal: panel tidak kembali.', p_panel_id using errcode = 'P0001';
  end if;
  update public.permintaan set panel_id = panel_id_arsip, panel_id_arsip = null where panel_id_arsip = p_panel_id;
  get diagnostics v_perm = row_count;
  return jsonb_build_object('panel', 1, 'permintaan_disambung', v_perm);
end $$;

grant execute on function public.arsip_panel_aman(bigint, text, numeric) to anon, authenticated;
grant execute on function public.unarsip_panel_aman(bigint) to anon, authenticated;
