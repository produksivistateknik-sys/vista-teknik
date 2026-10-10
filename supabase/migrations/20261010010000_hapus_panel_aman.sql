-- HAPUS PANEL AMAN (10 Okt 2026, insiden WO 076 HAS-MANYAR-CAP BANK / panel 521).
--
-- Akar insiden: saveWOWithSplit (Edit WO di Manajemen WO & WO Digital) menghapus data turunan panel
-- (renhar, raw_schedule, fcs_timer_kerja, progress_checkpoint_log, kendala) LEBIH DULU tanpa cek hasil, baru
-- panels. DELETE panels ditolak FK permintaan_panel_id_fkey (permintaan.panel_id tanpa ON DELETE) -> panel
-- tetap hidup, jadwal & riwayat timernya sudah terhapus.
--
-- Fungsi ini menggantikan urutan hapus di client: SATU transaksi, semua-atau-tidak.
--  - DITOLAK (P0001) bila ada panel yang masih punya permintaan barang (keputusan user) -> tidak ada data
--    turunan yang tersentuh.
--  - Panel dikunci (FOR UPDATE) dulu; FK lain yang belum tercakup -> exception -> seluruh hapus batal.
--  - activity_log 'HAPUS PANEL (EDIT WO)' dgn jumlah baris per tabel.

create or replace function public.hapus_panel_aman(p_panel_ids bigint[], p_user text, p_wo text default null, p_proyek text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids bigint[]; v_tolak text; v_nama text;
  v_rh int := 0; v_raw int := 0; v_tm int := 0; v_ck int := 0; v_kd int := 0; v_ftk int := 0; v_pn int := 0;
begin
  v_ids := array(select distinct x from unnest(coalesce(p_panel_ids, '{}'::bigint[])) as x where x is not null);
  if cardinality(v_ids) = 0 then
    return jsonb_build_object('panel', 0);
  end if;

  -- kunci baris panel (cegah simpan paralel / operator menulis bersamaan)
  perform 1 from public.panels where id = any(v_ids) for update;

  -- TOLAK: masih punya permintaan barang
  select string_agg(format('%s (%s permintaan)', trim(p.nama), c.n), ', ' order by p.id) into v_tolak
    from public.panels p
    join (select panel_id, count(*) as n from public.permintaan where panel_id = any(v_ids) group by panel_id) c on c.panel_id = p.id;
  if v_tolak is not null then
    raise exception 'Panel tidak bisa dihapus karena masih punya permintaan barang: %. Tidak ada data yang dihapus.', v_tolak
      using errcode = 'P0001';
  end if;

  select string_agg(trim(nama), ', ' order by id) into v_nama from public.panels where id = any(v_ids);

  delete from public.renhar where panel_id = any(v_ids);                    get diagnostics v_rh = row_count;
  delete from public.raw_schedule where panel_id = any(v_ids);              get diagnostics v_raw = row_count;
  delete from public.fcs_timer_kerja where panel_id = any(v_ids);           get diagnostics v_tm = row_count;
  delete from public.progress_checkpoint_log where panel_id = any(v_ids);   get diagnostics v_ck = row_count;
  delete from public.kendala where panel_id = any(v_ids);                   get diagnostics v_kd = row_count;
  delete from public.fcs_tracking_komponen where panel_id = any(v_ids);     get diagnostics v_ftk = row_count;
  delete from public.panels where id = any(v_ids);                          get diagnostics v_pn = row_count;

  insert into public.activity_log (user_name, action, description, module, halaman, proyek, wo_number)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'HAPUS PANEL (EDIT WO)',
    format('Hapus %s panel dari WO %s - %s: %s. Ikut terhapus: %s renhar, %s raw_schedule, %s fcs_timer_kerja, %s progress_checkpoint_log, %s kendala, %s fcs_tracking_komponen.',
      v_pn, coalesce(p_wo, '-'), coalesce(p_proyek, '-'), coalesce(v_nama, '-'), v_rh, v_raw, v_tm, v_ck, v_kd, v_ftk),
    'wo', 'Manajemen WO', coalesce(p_proyek, ''), coalesce(p_wo, ''));

  return jsonb_build_object('panel', v_pn, 'renhar', v_rh, 'raw_schedule', v_raw, 'fcs_timer_kerja', v_tm,
    'progress_checkpoint_log', v_ck, 'kendala', v_kd, 'fcs_tracking_komponen', v_ftk);
end;
$$;

grant execute on function public.hapus_panel_aman(bigint[], text, text, text) to anon, authenticated;
