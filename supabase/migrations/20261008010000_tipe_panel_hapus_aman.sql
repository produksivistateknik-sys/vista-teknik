-- HAPUS JENIS / KOMPONEN BOM YANG AMAN + KODE KOMPONEN TIDAK PERNAH DIPAKAI ULANG (8 Okt 2026)
--
-- Insiden OU_FS (8 Okt 2026, dicek live): "Hapus tipe panel" di Master Data (KapasitasPekerjaanTab)
-- cuma menghapus panel_wp_meta + panel_type_meta dari client. bom_master (23 komponen),
-- bom_proses_relevan (195 baris) & fcs_process_time TIDAK ikut terhapus -> jenis disembunyikan
-- (buildPanelTypesFromBom melewati tipe tanpa WP), begitu jenis dibuat ulang & WP1 disimpan, semua
-- komponen lama muncul lagi. Selain itu:
-- - hapus 1 komponen (deleteBom) meninggalkan baris bom_proses_relevan yatim (31 baris OU_FS);
-- - nomor kode baru = max kode yang MASIH ada di bom_master + 1 -> kalau kode tertinggi dihapus,
--   nomornya dipakai ulang & komponen baru "mewarisi" mapping proses / process time / checklist
--   panel milik komponen lama.
--
-- Isi migrasi ini (3 function, RLS tabel TIDAK diubah sama sekali - pola sama
-- set_bom_proses_relevan 20260916010000):
-- 1. nomor_kode_komponen_berikutnya(tipe) - nomor berikutnya dihitung dari SEMUA jejak kode tipe
--    itu (bom_master, bom_proses_relevan, fcs_process_time, checklist panels & panels_archived),
--    bukan cuma bom_master -> kode yang pernah ada tidak pernah dipakai ulang.
-- 2. hapus_tipe_panel(tipe, user) - DITOLAK kalau jenis masih dipakai panel (live/arsip/jadwal FCS/
--    arsip seksi). Kalau aman: hapus jenis + WP + komponen + mapping proses + process time dalam
--    1 transaksi, catat activity_log. qty_change_log (histori) TIDAK disentuh.
-- 3. hapus_bom_komponen(id, user) - hapus 1 komponen. Mapping proses & process time kode itu ikut
--    dihapus HANYA kalau kode itu tidak ada di checklist panel manapun (live/arsip). Kalau masih
--    dipakai, mapping DIBIARKAN: trigger cap progress Mekanik (20260921020000) menganggap kode
--    TANPA mapping relevan utk SEMUA proses - menghapus mapping kode yang masih dipakai panel bisa
--    mengubah perilaku progress panel itu.
-- SECURITY DEFINER karena bom_proses_relevan tidak punya policy DELETE utk anon.

create or replace function public.nomor_kode_komponen_berikutnya(p_tipe_panel text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(n), 0) + 1 from (
    select (substring(kode_komponen from '(\d+)$'))::int as n from public.bom_master where tipe_panel = p_tipe_panel
    union all
    select (substring(kode_komponen from '(\d+)$'))::int from public.bom_proses_relevan where tipe_panel = p_tipe_panel
    union all
    select (substring(kode_komponen from '(\d+)$'))::int from public.fcs_process_time where tipe_panel = p_tipe_panel
    union all
    select (substring(k from '\.(\d+)$'))::int
      from public.panels p, jsonb_object_keys(case when jsonb_typeof(p.checklist::jsonb) = 'object' then p.checklist::jsonb else '{}'::jsonb end) k
      where p.tipe = p_tipe_panel
    union all
    select (substring(k from '\.(\d+)$'))::int
      from public.panels_archived p, jsonb_object_keys(case when jsonb_typeof(p.checklist::jsonb) = 'object' then p.checklist::jsonb else '{}'::jsonb end) k
      where p.tipe = p_tipe_panel
  ) s
  where n is not null;
$$;

grant execute on function public.nomor_kode_komponen_berikutnya(text) to anon, authenticated;


create or replace function public.hapus_tipe_panel(p_tipe_panel text, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_panel int; v_panel_arsip int; v_jadwal int; v_jadwal_arsip int; v_seksi_arsip int;
  v_bom int; v_relevan int; v_pt int; v_wp int; v_tipe int;
begin
  if coalesce(trim(p_tipe_panel), '') = '' then
    raise exception 'Tipe panel kosong';
  end if;

  select count(*) into v_panel from public.panels where tipe = p_tipe_panel;
  select count(*) into v_panel_arsip from public.panels_archived where tipe = p_tipe_panel;
  select count(*) into v_jadwal from public.fcs_schedule where tipe_panel = p_tipe_panel;
  select count(*) into v_jadwal_arsip from public.fcs_schedule_archived where tipe_panel = p_tipe_panel;
  select count(*) into v_seksi_arsip from public.panel_seksi_archived where panel_tipe = p_tipe_panel;
  if v_panel + v_panel_arsip + v_jadwal + v_jadwal_arsip + v_seksi_arsip > 0 then
    raise exception 'Tipe panel % masih dipakai: % panel aktif, % panel arsip, % jadwal FCS, % jadwal FCS arsip, % arsip seksi. Tidak dihapus.',
      p_tipe_panel, v_panel, v_panel_arsip, v_jadwal, v_jadwal_arsip, v_seksi_arsip
      using errcode = 'P0001';
  end if;

  delete from public.fcs_process_time where tipe_panel = p_tipe_panel; get diagnostics v_pt = row_count;
  delete from public.bom_proses_relevan where tipe_panel = p_tipe_panel; get diagnostics v_relevan = row_count;
  delete from public.bom_master where tipe_panel = p_tipe_panel; get diagnostics v_bom = row_count;
  delete from public.panel_wp_meta where tipe_panel = p_tipe_panel; get diagnostics v_wp = row_count;
  delete from public.panel_type_meta where tipe_panel = p_tipe_panel; get diagnostics v_tipe = row_count;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'HAPUS TIPE PANEL',
    format('Hapus tipe panel %s: %s jenis, %s WP, %s komponen BOM, %s mapping proses, %s process time',
      p_tipe_panel, v_tipe, v_wp, v_bom, v_relevan, v_pt),
    'master_data', 'Kapasitas Pekerjaan');

  return jsonb_build_object('tipe', v_tipe, 'wp', v_wp, 'bom', v_bom, 'proses_relevan', v_relevan, 'process_time', v_pt);
end;
$$;

grant execute on function public.hapus_tipe_panel(text, text) to anon, authenticated;


create or replace function public.hapus_bom_komponen(p_id bigint, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kode text; v_tipe text; v_nama text; v_dipakai int; v_relevan int := 0; v_pt int := 0;
begin
  select kode_komponen, tipe_panel, nama_komponen into v_kode, v_tipe, v_nama
    from public.bom_master where id = p_id;
  if v_kode is null then
    raise exception 'Komponen BOM id % tidak ditemukan (mungkin sudah dihapus orang lain)', p_id using errcode = 'P0002';
  end if;

  select (select count(*) from public.panels where tipe = v_tipe and jsonb_typeof(checklist::jsonb) = 'object' and checklist::jsonb ? v_kode)
       + (select count(*) from public.panels_archived where tipe = v_tipe and jsonb_typeof(checklist::jsonb) = 'object' and checklist::jsonb ? v_kode)
    into v_dipakai;

  delete from public.bom_master where id = p_id;
  if v_dipakai = 0 then
    delete from public.bom_proses_relevan where kode_komponen = v_kode and tipe_panel = v_tipe; get diagnostics v_relevan = row_count;
    delete from public.fcs_process_time where kode_komponen = v_kode and tipe_panel = v_tipe; get diagnostics v_pt = row_count;
  end if;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'HAPUS KOMPONEN BOM',
    format('Hapus komponen BOM %s (%s) tipe %s - %s',
      v_kode, v_nama, v_tipe,
      case when v_dipakai = 0 then format('%s mapping proses & %s process time ikut dihapus', v_relevan, v_pt)
           else format('kode masih ada di checklist %s panel, mapping proses & process time DIBIARKAN', v_dipakai) end),
    'master_data', 'Kapasitas Pekerjaan');

  return jsonb_build_object('kode', v_kode, 'dipakai_panel', v_dipakai, 'proses_relevan', v_relevan, 'process_time', v_pt);
end;
$$;

grant execute on function public.hapus_bom_komponen(bigint, text) to anon, authenticated;
