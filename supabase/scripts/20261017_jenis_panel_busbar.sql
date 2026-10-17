-- ============================================================================================
-- JENIS PANEL "BUSBAR" - pekerjaan HANYA proses BUSBAR tahap FABRIKASI (17 Okt 2026, keputusan user:
-- batang sama dgn FS, tanpa QC TEST/PACKING, waktu proses kosong seperti jenis lain, nama tetap "BUSBAR").
-- Kondisi awal (cek live 17 Okt): panel_type_meta BUSBAR SUDAH ADA (id 14, dibuat 12.33 WIB); panel_wp_meta,
-- bom_master, bom_proses_relevan, fcs_process_time BUSBAR kosong. WO 091 "BUSBAR SPF" (target 19 Okt) panel 546
-- "PLATE BUSBAR 400X120MM TEBAL 10MM" tercatat jenis FS (36 komponen FS qty 1, progres 0, belum ada jadwal/timer/
-- CCP/catatan simpanan; ada 1 permintaan barang & 1 gambar WO - tidak terpengaruh).
-- Data yang dibuat:
--   * panel_wp_meta: 1 WP (WP1, "BUSBAR.1")
--   * bom_master   : 1 komponen BUSBAR.1 "Busbar" - WAJIB ada (tanpa komponen aktif, progres panel selalu 0%)
--   * TANPA bom_proses_relevan (tidak ada proses mekanik) & TANPA fcs_process_time
--   * panel 546: jenis FS -> BUSBAR, checklist diganti 1 komponen BUSBAR.1 qty 1 (bentuk = initChecklist)
-- Perilaku "hanya FABRIKASI, tanpa QC/PACKING" diatur KODE (branch jenis-busbar di kedua repo) - jalankan SQL ini
-- setelah / bersamaan dgn rilis kode. Jadwal FCS WO 091 baru dibuat SETELAH kode admin live.
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback.
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select (select count(*) from public.panel_type_meta where tipe_panel = 'BUSBAR') as meta_harus_1,
       (select count(*) from public.panel_wp_meta where tipe_panel = 'BUSBAR') as wp_harus_0,
       (select count(*) from public.bom_master where tipe_panel = 'BUSBAR') as bom_harus_0,
       (select count(*) from public.bom_proses_relevan where tipe_panel = 'BUSBAR') as mapping_harus_0,
       (select tipe from public.panels where id = 546) as panel_546_jenis_harus_FS,
       (select count(*) from public.raw_schedule where panel_id = 546 and deleted_at is null) as jadwal_546_harus_0,
       (select count(*) from public.fcs_timer_kerja where panel_id = 546) as timer_546_harus_0,
       (select count(*) from public.component_process_progress where panel_id = 546) as ccp_546_harus_0;


-- ── BAGIAN 2: EKSEKUSI ──────────────────────────────────────────────────────────────────────
begin;
do $$
declare v_entri jsonb;
begin
  if not exists (select 1 from public.panel_type_meta where tipe_panel = 'BUSBAR') then raise exception 'DIBATALKAN: panel_type_meta BUSBAR tidak ada'; end if;
  if exists (select 1 from public.bom_master where tipe_panel = 'BUSBAR') or exists (select 1 from public.panel_wp_meta where tipe_panel = 'BUSBAR') then
    raise exception 'DIBATALKAN: BOM/WP BUSBAR sudah ada (sudah dijalankan / diisi lewat wizard?) - jalankan BAGIAN 1';
  end if;
  if (select tipe from public.panels where id = 546) is distinct from 'FS' then raise exception 'DIBATALKAN: panel 546 bukan jenis FS lagi'; end if;
  if exists (select 1 from public.raw_schedule where panel_id = 546 and deleted_at is null)
     or exists (select 1 from public.fcs_timer_kerja where panel_id = 546)
     or exists (select 1 from public.component_process_progress where panel_id = 546)
     or exists (select 1 from public.progress_checkpoint_log where panel_id = 546) then
    raise exception 'DIBATALKAN: panel 546 sudah punya jadwal/timer/progres - ganti jenis harus dibicarakan dulu';
  end if;

  insert into public.panel_wp_meta (tipe_panel, wp, color, range_label, urutan) values ('BUSBAR', 'WP1', '#7c3aed', 'BUSBAR.1', 0);
  insert into public.bom_master (kode_komponen, nama_komponen, tipe_panel, wp, urutan) values ('BUSBAR.1', 'Busbar', 'BUSBAR', 'WP1', 1);

  -- entri checklist bentuk initChecklist (lib/panelHelpers.ts): qty + qtyProses + progress/progressByDate/stepDates per proses
  select jsonb_build_object('qty', 1, 'qtyProses', '{}'::jsonb,
           'progress', jsonb_object_agg(p, 0), 'progressByDate', jsonb_object_agg(p, '{}'::jsonb), 'stepDates', jsonb_object_agg(p, '{}'::jsonb))
    into v_entri
  from unnest(array['POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','PASANG KOMPONEN','BUSBAR','WIRING CONTROL','WIRING POWER','QC TEST','PACKING']) p;
  update public.panels set tipe = 'BUSBAR', checklist = jsonb_build_object('BUSBAR.1', v_entri) where id = 546 and tipe = 'FS';
  if not found then raise exception 'DIBATALKAN: panel 546 tidak ter-update'; end if;

  insert into public.activity_log (user_name, action, description, module, halaman, panel, wo_number)
  values ('Admin (SQL)', 'TAMBAH JENIS PANEL',
    'Jenis BUSBAR dilengkapi: 1 WP + komponen BUSBAR.1 (tanpa proses mekanik, tanpa waktu proses). Hanya proses BUSBAR tahap FABRIKASI (batang sama FS), tanpa QC/PACKING. Panel 546 PLATE BUSBAR 400X120MM (WO 091) jenis FS -> BUSBAR.',
    'master_data', 'SQL Editor', 'PLATE BUSBAR 400X120MM TEBAL 10MM', '091');
end $$;
select (select count(*) from public.panel_wp_meta where tipe_panel = 'BUSBAR') as wp_harus_1,
       (select count(*) from public.bom_master where tipe_panel = 'BUSBAR') as bom_harus_1,
       (select tipe from public.panels where id = 546) as panel_546_harus_BUSBAR,
       (select jsonb_object_keys(checklist) from public.panels where id = 546) as komponen_546_harus_BUSBAR_1;
commit;


-- ── BAGIAN 3: ROLLBACK (hanya kalau perlu - panel 546 kembali FS 36 komponen qty 1, BOM/WP BUSBAR dihapus) ──
-- begin;
-- update public.panels p set tipe = 'FS', checklist = (
--   select jsonb_object_agg(b.kode_komponen, jsonb_build_object('qty', 1, 'qtyProses', '{}'::jsonb,
--            'progress', (select jsonb_object_agg(x, 0) from unnest(array['POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','PASANG KOMPONEN','BUSBAR','WIRING CONTROL','WIRING POWER','QC TEST','PACKING']) x),
--            'progressByDate', (select jsonb_object_agg(x, '{}'::jsonb) from unnest(array['POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','PASANG KOMPONEN','BUSBAR','WIRING CONTROL','WIRING POWER','QC TEST','PACKING']) x),
--            'stepDates', (select jsonb_object_agg(x, '{}'::jsonb) from unnest(array['POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','PASANG KOMPONEN','BUSBAR','WIRING CONTROL','WIRING POWER','QC TEST','PACKING']) x)))
--   from public.bom_master b where b.tipe_panel = 'FS')
-- where p.id = 546 and p.tipe = 'BUSBAR';
-- delete from public.bom_master where tipe_panel = 'BUSBAR' and kode_komponen = 'BUSBAR.1';
-- delete from public.panel_wp_meta where tipe_panel = 'BUSBAR';
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'TAMBAH JENIS PANEL', 'Rollback jenis BUSBAR: BOM/WP dihapus, panel 546 kembali FS.', 'master_data', 'SQL Editor');
-- commit;
