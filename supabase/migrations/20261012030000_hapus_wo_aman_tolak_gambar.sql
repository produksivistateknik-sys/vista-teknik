-- HAPUS WO AMAN: TOLAK juga WO yang masih punya DOKUMEN GAMBAR WO Digital (12 Okt 2026, keputusan user).
-- Latar: insiden WO 076 (10 Okt) - gambar panel 521 + revisinya terhapus permanen lewat FK
-- work_instructions.wo_id ON DELETE CASCADE saat WO lama dihapus. Fungsi sama persis dgn
-- 20261012020000_hapus_wo_aman.sql + 1 pengecekan tambahan (v_gambar).

create or replace function public.hapus_wo_aman(p_wo_id bigint, p_user text, p_halaman text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wo record; v_panel_ids bigint[]; v_perm int; v_gambar int; v_n jsonb := '{}'::jsonb; v_c int;
begin
  select id, wo, proyek into v_wo from public.work_orders where id = p_wo_id for update;
  if not found then
    raise exception 'WO % tidak ditemukan (mungkin sudah dihapus).', p_wo_id using errcode = 'P0001';
  end if;
  select coalesce(array_agg(id), '{}') into v_panel_ids from (select id from public.panels where wo_id = p_wo_id for update) s;

  select count(*) into v_perm from public.permintaan
   where wo_id = p_wo_id or panel_id = any(v_panel_ids) or panel_id_arsip = any(v_panel_ids);
  if v_perm > 0 then
    raise exception 'WO % - % tidak bisa dihapus karena masih punya % permintaan barang. Tidak ada data yang dihapus.',
      v_wo.wo, v_wo.proyek, v_perm using errcode = 'P0001';
  end if;

  -- (12 Okt 2026, keputusan user) dokumen gambar WO Digital ikut terhapus permanen lewat FK cascade -> TOLAK.
  select count(*) into v_gambar from public.work_instructions where wo_id = p_wo_id;
  if v_gambar > 0 then
    raise exception 'WO % - % tidak bisa dihapus karena masih punya % dokumen gambar WO Digital. Tidak ada data yang dihapus.',
      v_wo.wo, v_wo.proyek, v_gambar using errcode = 'P0001';
  end if;

  if coalesce(array_length(v_panel_ids, 1), 0) > 0 then
    delete from public.fcs_timer_kerja where panel_id = any(v_panel_ids);
    get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('fcs_timer_kerja', v_c);
    delete from public.progress_checkpoint_log where panel_id = any(v_panel_ids);
    get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('progress_checkpoint_log', v_c);
    delete from public.kendala where panel_id = any(v_panel_ids);
    get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('kendala', v_c);
  end if;
  delete from public.fcs_tracking_komponen where wo_id = p_wo_id;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('fcs_tracking_komponen', v_c);
  delete from public.renhar where wo_id = p_wo_id;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('renhar', v_c);
  delete from public.raw_schedule where wo_id = p_wo_id;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('raw_schedule', v_c);
  delete from public.panels where wo_id = p_wo_id;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('panel', v_c);
  delete from public.work_orders where id = p_wo_id;

  insert into public.activity_log (user_name, action, description, module, halaman, proyek, wo_number)
  values (coalesce(p_user, 'Admin'), 'HAPUS WO',
          'Hapus WO ' || v_wo.wo || ' - ' || v_wo.proyek || ' beserta semua data terkait ' || v_n::text,
          'wo', p_halaman, v_wo.proyek, v_wo.wo);
  return v_n;
end $$;

grant execute on function public.hapus_wo_aman(bigint, text, text) to anon, authenticated;
