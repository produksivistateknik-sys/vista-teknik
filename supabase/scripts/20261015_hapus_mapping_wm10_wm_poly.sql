-- ============================================================================================
-- Hapus mapping proses yatim WM.10 / WM_POLY (15 Okt 2026, temuan Kesehatan Data K7, persetujuan user)
-- Bukti (cek live 15 Okt):
--   * bom_proses_relevan punya 5 baris WM.10 / WM_POLY (id 409 POTONG, 410 BENDING, 411 RENDAM, 412 PAINTING,
--     413 RAKIT; dibuat 15 Jul 2026).
--   * bom_master WM_POLY hanya WM.1 s.d. WM.9 - WM.10 TIDAK ADA (WM.10 "Cover Komponen" hanya ada di WM_MS).
--   * panels aktif tipe WM_POLY: 0. panels_archived tipe WM_POLY: 18, yang punya WM.10 di checklist semuanya qty 0
--     progress 0 - tidak ada progres yang ikut hilang. fcs_process_time WM.10 / WM_POLY: tidak ada.
-- Hapus lewat SQL Editor (RLS bom_proses_relevan tidak mengizinkan delete dari aplikasi).
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback (kalau perlu).
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select id, kode_komponen, tipe_panel, jenis_pekerjaan, created_at
from public.bom_proses_relevan where kode_komponen = 'WM.10' and tipe_panel = 'WM_POLY' order by id;
-- HARUS 5 baris: 409 POTONG, 410 BENDING, 411 RENDAM, 412 PAINTING, 413 RAKIT

select (select count(*) from public.bom_master where kode_komponen = 'WM.10' and tipe_panel = 'WM_POLY') as di_bom_master,          -- HARUS 0
       (select count(*) from public.panels where tipe = 'WM_POLY' and coalesce(nullif(checklist->'WM.10'->>'qty', '')::numeric, 0) > 0) as panel_aktif_pakai;  -- HARUS 0


-- ── BAGIAN 2: EKSEKUSI ──────────────────────────────────────────────────────────────────────
begin;
do $$
declare v_n int;
begin
  if exists (select 1 from public.bom_master where kode_komponen = 'WM.10' and tipe_panel = 'WM_POLY') then
    raise exception 'DIBATALKAN: WM.10 ternyata ada di bom_master WM_POLY - mapping bukan yatim';
  end if;
  if exists (select 1 from public.panels where tipe = 'WM_POLY' and coalesce(nullif(checklist->'WM.10'->>'qty', '')::numeric, 0) > 0) then
    raise exception 'DIBATALKAN: ada panel aktif WM_POLY yang memakai WM.10';
  end if;
  delete from public.bom_proses_relevan
  where kode_komponen = 'WM.10' and tipe_panel = 'WM_POLY' and id in (409, 410, 411, 412, 413);
  get diagnostics v_n = row_count;
  if v_n <> 5 then raise exception 'DIBATALKAN: terhapus % baris, seharusnya 5', v_n; end if;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'ATUR PROSES RELEVAN',
    'WM_POLY WM.10 (tidak ada di BOM WM_POLY): -POTONG, -BENDING, -RENDAM, -PAINTING, -RAKIT | sekarang: (kosong). Mapping yatim, temuan K7 Kesehatan Data.',
    'master_data', 'SQL Editor');
end $$;

select count(*) as sisa_harus_0 from public.bom_proses_relevan where kode_komponen = 'WM.10' and tipe_panel = 'WM_POLY';
commit;
-- Sesudahnya: Sistem > Kesehatan Data > "Jalankan cek sekarang" -> K7 harus 0.


-- ── BAGIAN 3: ROLLBACK (hanya kalau perlu) - mengembalikan 5 baris persis (id & created_at sama) ──
-- begin;
-- insert into public.bom_proses_relevan (id, kode_komponen, tipe_panel, jenis_pekerjaan, created_at) values
--   (409, 'WM.10', 'WM_POLY', 'POTONG',   '2026-07-15T02:47:08.399006+00:00'),
--   (410, 'WM.10', 'WM_POLY', 'BENDING',  '2026-07-15T02:47:08.399006+00:00'),
--   (411, 'WM.10', 'WM_POLY', 'RENDAM',   '2026-07-15T02:47:08.399006+00:00'),
--   (412, 'WM.10', 'WM_POLY', 'PAINTING', '2026-07-15T02:47:08.399006+00:00'),
--   (413, 'WM.10', 'WM_POLY', 'RAKIT',    '2026-07-15T02:47:08.399006+00:00');
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'ATUR PROSES RELEVAN', 'Rollback: kembalikan mapping WM_POLY WM.10 (5 proses).', 'master_data', 'SQL Editor');
-- commit;
