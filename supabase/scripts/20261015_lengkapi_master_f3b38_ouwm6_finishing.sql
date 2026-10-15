-- ============================================================================================
-- Lengkapi master data (15 Okt 2026, keputusan user):
--  (1) F3B.38 "Stik Pintu" belum punya mapping proses -> POTONG, BENDING, STEL, FINISHING, RAKIT (sama FS.36 Stik
--      Pintu FS/FS_SS & F3B.37 Pintu Hitam) + process time POTONG 1.6 / BENDING 1 disalin dari FS FS.36.
--  (2) OU_WM.MS.6 "Kotak Surat" (dibuat 14 Okt, urutan 0) DOBEL dgn OU_WM.MS.9 "Kotak Surat" yang sudah ber-mapping
--      -> dihapus lewat RPC hapus_bom_komponen (jalur resmi). Tidak ada panel aktif/arsip OU_WM.MS yang memuat kodenya,
--      mapping & process time-nya kosong.
--  (3) Process time FINISHING yang kosong - disalin HANYA dari komponen bernama sama yang waktunya seragam:
--      5 komponen "Topi" = 10 menit (sumber FS FS.22, FS_SS FS.22, OU_FS OU_FS.15 - semua 10 menit).
--      Tidak ada baris OU_FS yang diubah. OU_FS.18 Lantai Dasar & 34 lainnya TIDAK punya sumber -> diisi manual.
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback (kalau perlu).
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select 'mapping F3B.38 sekarang (HARUS 0)' as cek, count(*)::text as hasil from public.bom_proses_relevan where tipe_panel = 'F3B' and kode_komponen = 'F3B.38'
union all select 'process time F3B.38 sekarang (HARUS 0)', count(*)::text from public.fcs_process_time where tipe_panel = 'F3B' and kode_komponen = 'F3B.38'
union all select 'sumber FS FS.36 POTONG/BENDING (HARUS 1.6 / 1)', string_agg(jenis_pekerjaan || '=' || menit_per_pcs, ', ' order by jenis_pekerjaan) from public.fcs_process_time where tipe_panel = 'FS' and kode_komponen = 'FS.36' and jenis_pekerjaan in ('POTONG', 'BENDING')
union all select 'OU_WM.MS.6 di BOM (HARUS id 360 Kotak Surat)', string_agg(id || ' ' || nama_komponen, ', ') from public.bom_master where tipe_panel = 'OU_WM.MS' and kode_komponen = 'OU_WM.MS.6'
union all select 'OU_WM.MS.9 Kotak Surat + mapping (HARUS ada, 5 proses)', count(*)::text from public.bom_proses_relevan where tipe_panel = 'OU_WM.MS' and kode_komponen = 'OU_WM.MS.9'
union all select 'panel memuat OU_WM.MS.6 (HARUS 0)', ((select count(*) from public.panels where tipe = 'OU_WM.MS' and checklist::jsonb ? 'OU_WM.MS.6') + (select count(*) from public.panels_archived where tipe = 'OU_WM.MS' and checklist::jsonb ? 'OU_WM.MS.6'))::text
union all select 'FINISHING 5 Topi sudah ada waktu (HARUS 0)', count(*)::text from public.fcs_process_time where jenis_pekerjaan = 'FINISHING'
  and (tipe_panel, kode_komponen) in (('WM_MS','WM.12'), ('WM_SS','WM_SS.12'), ('WM_POLY','WM.9'), ('OU_WM.MS','OU_WM.MS.11'), ('BOX_KOSONG WM','BOX_KOSONG WM.7'))
union all select 'FINISHING sumber Topi (HARUS 10 semua)', string_agg(tipe_panel || ' ' || kode_komponen || '=' || menit_per_pcs, ', ') from public.fcs_process_time where jenis_pekerjaan = 'FINISHING'
  and (tipe_panel, kode_komponen) in (('FS','FS.22'), ('FS_SS','FS.22'), ('OU_FS','OU_FS.15'));


-- ── BAGIAN 2: EKSEKUSI ──────────────────────────────────────────────────────────────────────
begin;
do $$
declare v_n int; v_hasil jsonb;
begin
  -- (1) F3B.38 mapping + process time
  if exists (select 1 from public.bom_proses_relevan where tipe_panel = 'F3B' and kode_komponen = 'F3B.38') then
    raise exception 'DIBATALKAN: F3B.38 ternyata sudah punya mapping';
  end if;
  insert into public.bom_proses_relevan (kode_komponen, tipe_panel, jenis_pekerjaan)
  select 'F3B.38', 'F3B', p from unnest(array['POTONG','BENDING','STEL','FINISHING','RAKIT']) p;
  get diagnostics v_n = row_count; if v_n <> 5 then raise exception 'DIBATALKAN: mapping F3B.38 % baris', v_n; end if;

  insert into public.fcs_process_time (kode_komponen, nama_komponen, tipe_panel, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active)
  select 'F3B.38', 'Stik Pintu', 'F3B', 'WP2', s.jenis_pekerjaan, s.menit_per_pcs, 'salin timer dari FS FS.36 (15 Okt 2026)', true
  from public.fcs_process_time s
  where s.tipe_panel = 'FS' and s.kode_komponen = 'FS.36' and s.jenis_pekerjaan in ('POTONG', 'BENDING')
    and not exists (select 1 from public.fcs_process_time t where t.tipe_panel = 'F3B' and t.kode_komponen = 'F3B.38' and t.jenis_pekerjaan = s.jenis_pekerjaan);
  get diagnostics v_n = row_count; if v_n <> 2 then raise exception 'DIBATALKAN: process time F3B.38 % baris (harus 2)', v_n; end if;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'ATUR PROSES RELEVAN', 'F3B F3B.38 Stik Pintu: +POTONG, +BENDING, +STEL, +FINISHING, +RAKIT | sekarang: POTONG, BENDING, STEL, FINISHING, RAKIT (sama FS.36). Process time POTONG 1.6 & BENDING 1 disalin dari FS FS.36.', 'master_data', 'SQL Editor');

  -- (2) hapus OU_WM.MS.6 lewat RPC resmi (mencatat activity_log 'HAPUS KOMPONEN BOM' sendiri)
  if (select count(*) from public.bom_master where id = 360 and tipe_panel = 'OU_WM.MS' and kode_komponen = 'OU_WM.MS.6') <> 1 then
    raise exception 'DIBATALKAN: bom_master id 360 bukan OU_WM.MS.6';
  end if;
  v_hasil := public.hapus_bom_komponen(360, 'Admin (SQL) - duplikat OU_WM.MS.9 Kotak Surat');
  if (v_hasil->>'dipakai_panel')::int <> 0 then raise exception 'DIBATALKAN: OU_WM.MS.6 ternyata dipakai panel (%)', v_hasil; end if;

  -- (3) FINISHING 5 "Topi" = 10 menit
  insert into public.fcs_process_time (kode_komponen, nama_komponen, tipe_panel, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active)
  select b.kode_komponen, b.nama_komponen, b.tipe_panel, b.wp, 'FINISHING', 10, 'salin timer FINISHING dari Topi FS FS.22 / OU_FS OU_FS.15 (15 Okt 2026)', true
  from public.bom_master b
  where (b.tipe_panel, b.kode_komponen) in (('WM_MS','WM.12'), ('WM_SS','WM_SS.12'), ('WM_POLY','WM.9'), ('OU_WM.MS','OU_WM.MS.11'), ('BOX_KOSONG WM','BOX_KOSONG WM.7'))
    and b.nama_komponen = 'Topi'
    and exists (select 1 from public.bom_proses_relevan r where r.tipe_panel = b.tipe_panel and r.kode_komponen = b.kode_komponen and r.jenis_pekerjaan = 'FINISHING')
    and not exists (select 1 from public.fcs_process_time t where t.tipe_panel = b.tipe_panel and t.kode_komponen = b.kode_komponen and t.jenis_pekerjaan = 'FINISHING');
  get diagnostics v_n = row_count; if v_n <> 5 then raise exception 'DIBATALKAN: FINISHING Topi % baris (harus 5)', v_n; end if;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'ISI TIMER DARI JENIS LAIN', 'Process time FINISHING 10 menit/pcs disalin dari Topi (FS FS.22, FS_SS FS.22, OU_FS OU_FS.15 - semua 10 menit) ke: WM_MS WM.12, WM_SS WM_SS.12, WM_POLY WM.9, OU_WM.MS OU_WM.MS.11, BOX_KOSONG WM BOX_KOSONG WM.7. BOM OU_FS tidak diubah.', 'master_data', 'SQL Editor');
end $$;

-- verifikasi (masih di transaksi)
select 'mapping F3B.38 (HARUS 5)' as cek, count(*)::text as hasil from public.bom_proses_relevan where tipe_panel = 'F3B' and kode_komponen = 'F3B.38'
union all select 'process time F3B.38 (HARUS BENDING=1, POTONG=1.6)', string_agg(jenis_pekerjaan || '=' || menit_per_pcs, ', ' order by jenis_pekerjaan) from public.fcs_process_time where tipe_panel = 'F3B' and kode_komponen = 'F3B.38'
union all select 'OU_WM.MS.6 di BOM (HARUS 0)', count(*)::text from public.bom_master where tipe_panel = 'OU_WM.MS' and kode_komponen = 'OU_WM.MS.6'
union all select 'FINISHING Topi baru (HARUS 5)', count(*)::text from public.fcs_process_time where jenis_pekerjaan = 'FINISHING' and keterangan like 'salin timer FINISHING dari Topi%';
commit;
-- Sesudahnya: muat ulang halaman Kapasitas Pekerjaan / Raw Schedule (Ctrl+Shift+R).


-- ── BAGIAN 3: ROLLBACK (hanya kalau perlu) ──────────────────────────────────────────────────
-- begin;
-- delete from public.bom_proses_relevan where tipe_panel = 'F3B' and kode_komponen = 'F3B.38';
-- delete from public.fcs_process_time where tipe_panel = 'F3B' and kode_komponen = 'F3B.38' and keterangan = 'salin timer dari FS FS.36 (15 Okt 2026)';
-- delete from public.fcs_process_time where jenis_pekerjaan = 'FINISHING' and keterangan = 'salin timer FINISHING dari Topi FS FS.22 / OU_FS OU_FS.15 (15 Okt 2026)';
-- (kalau baris ini error "non-DEFAULT value into column id", hapus kata 'overriding system value' / sebaliknya)
-- insert into public.bom_master (id, kode_komponen, nama_komponen, tipe_panel, wp, urutan, created_at, updated_at)
--   overriding system value values (360, 'OU_WM.MS.6', 'Kotak Surat', 'OU_WM.MS', 'WP2', 0, '2026-10-14T04:10:20.370527+00:00', '2026-10-14T04:10:20.370527+00:00');
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'ATUR PROSES RELEVAN', 'Rollback lengkapi master 15 Okt: mapping & timer F3B.38 dihapus, FINISHING 5 Topi dihapus, OU_WM.MS.6 dikembalikan.', 'master_data', 'SQL Editor');
-- commit;
