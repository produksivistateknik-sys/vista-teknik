-- ============================================================================================
-- FS_SS (stainless) TANPA proses RENDAM & PAINTING di SELURUH komponen (16 Okt 2026, permintaan user:
-- "bahan stainless, tidak masuk dua proses tersebut").
-- Bukti (cek live 16 Okt):
--   * bom_proses_relevan FS_SS: 189 baris, 52 di antaranya RENDAM/PAINTING (27 komponen). Setelah dihapus SEMUA
--     komponen masih punya proses lain (tidak ada yang jadi tanpa proses).
--   * fcs_process_time FS_SS RENDAM/PAINTING: 0. Timer RENDAM/PAINTING panel FS_SS: 0. CCP: 0.
--   * Panel FS_SS aktif: 1 (525 SDP FILLING GALLON) - progres RENDAM/PAINTING 0 di semua komponen, tapi masih punya
--     2 baris Raw Schedule (7175 RENDAM, 7176 PAINTING, jadwal 14 Okt). Panel arsip FS_SS: 0.
--   * Generator jadwal (fcsService) membaca mapping ini -> panel FS_SS baru otomatis tanpa jadwal RENDAM/PAINTING.
-- BAGIAN 1 dry-run -> BAGIAN 2 hapus mapping -> BAGIAN 2b (DISARANKAN) hapus-lunak jadwal panel 525
-- -> BAGIAN 3 rollback (kalau perlu). Hapus lewat SQL Editor (RLS bom_proses_relevan menolak delete dari aplikasi).
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select jenis_pekerjaan, count(*) as baris, count(distinct kode_komponen) as komponen
from public.bom_proses_relevan where tipe_panel = 'FS_SS' and jenis_pekerjaan in ('RENDAM', 'PAINTING') group by 1;
-- HARUS: PAINTING & RENDAM, total 52 baris

select k.kode_komponen, string_agg(k.jenis_pekerjaan, ', ' order by k.jenis_pekerjaan) as proses_tersisa
from public.bom_proses_relevan k
where k.tipe_panel = 'FS_SS' and k.jenis_pekerjaan not in ('RENDAM', 'PAINTING')
  and k.kode_komponen in (select kode_komponen from public.bom_proses_relevan where tipe_panel = 'FS_SS' and jenis_pekerjaan in ('RENDAM', 'PAINTING'))
group by 1 order by 1;
-- HARUS 27 baris (tiap komponen masih punya proses lain)

select r.id, r.panel_id, r.proses, r.deleted_at, p.nama
from public.raw_schedule r join public.panels p on p.id = r.panel_id
where p.tipe = 'FS_SS' and r.proses in ('RENDAM', 'PAINTING') and r.deleted_at is null;
-- HARUS 2 baris: 7175 RENDAM & 7176 PAINTING panel 525


-- ── BAGIAN 2: HAPUS MAPPING RENDAM & PAINTING FS_SS ─────────────────────────────────────────
begin;
do $$
declare v_n int;
begin
  delete from public.bom_proses_relevan
  where tipe_panel = 'FS_SS' and jenis_pekerjaan in ('RENDAM', 'PAINTING')
    and id in (1652,1653,1659,1660,1668,1669,1674,1675,1679,1680,1697,1698,1701,1704,1707,1708,1710,1713,1716,1719,1722,1725,1727,1730,1732,1735,1738,1739,1743,1744,1752,1755,1757,1760,1762,1765,1767,1770,1773,1777,1782,1784,1787,1795,1796,1822,1826,1831,1832,1838,1841,1846);
  get diagnostics v_n = row_count;
  if v_n <> 52 then raise exception 'DIBATALKAN: terhapus % baris, seharusnya 52 (data berubah sejak dicek)', v_n; end if;
  if exists (select 1 from public.bom_proses_relevan where tipe_panel = 'FS_SS' and jenis_pekerjaan in ('RENDAM', 'PAINTING')) then
    raise exception 'DIBATALKAN: masih ada mapping RENDAM/PAINTING FS_SS (ada baris baru sejak dicek) - jalankan BAGIAN 1 lagi';
  end if;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'ATUR PROSES RELEVAN',
    'FS_SS semua komponen (27): -RENDAM, -PAINTING (52 mapping) | bahan stainless tidak melalui rendam & painting.',
    'master_data', 'SQL Editor');
end $$;
select count(*) as sisa_harus_0 from public.bom_proses_relevan where tipe_panel = 'FS_SS' and jenis_pekerjaan in ('RENDAM', 'PAINTING');
commit;


-- ── BAGIAN 2b (DISARANKAN): hapus-lunak jadwal RENDAM & PAINTING panel 525 ──────────────────
-- Hapus-lunak (deleted_at diisi) - baris tetap ada & bisa dipulihkan dari Recycle Bin. Tidak ada progres yang hilang
-- (dicek di bawah). Riwayat Rencana Harian 12-15 Okt dibiarkan apa adanya.
begin;
do $$
declare v_n int;
begin
  if exists (select 1 from public.panels p, jsonb_each(case when jsonb_typeof(p.checklist::jsonb) = 'object' then p.checklist::jsonb else '{}'::jsonb end) e
             where p.id = 525 and jsonb_typeof(e.value) = 'object'
               and (coalesce(nullif(e.value->'progress'->>'RENDAM', '')::numeric, 0) > 0 or coalesce(nullif(e.value->'progress'->>'PAINTING', '')::numeric, 0) > 0)) then
    raise exception 'DIBATALKAN: panel 525 ternyata sudah punya progres RENDAM/PAINTING';
  end if;
  if exists (select 1 from public.fcs_timer_kerja where panel_id = 525 and proses in ('RENDAM', 'PAINTING') and selesai is null) then
    raise exception 'DIBATALKAN: ada timer RENDAM/PAINTING panel 525 yang sedang jalan';
  end if;
  update public.raw_schedule set deleted_at = now()
  where id in (7175, 7176) and panel_id = 525 and proses in ('RENDAM', 'PAINTING') and deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'DIBATALKAN: % baris jadwal terhapus, seharusnya 2', v_n; end if;
  insert into public.activity_log (user_name, action, description, module, halaman, panel)
  values ('Admin (SQL)', 'HAPUS JADWAL PROSES',
    'Panel 525 SDP FILLING GALLON (FS_SS stainless): jadwal RENDAM (raw 7175) & PAINTING (raw 7176) dihapus-lunak - proses tidak berlaku utk stainless. Progres 0, bisa dipulihkan dari Recycle Bin.',
    'raw_schedule', 'SQL Editor', 'SDP FILLING GALLON');
end $$;
commit;
-- Sesudahnya: muat ulang Raw Schedule / Rencana Harian (Ctrl+Shift+R).


-- ── BAGIAN 3: ROLLBACK (hanya kalau perlu) ──────────────────────────────────────────────────
-- (a) kembalikan 52 mapping persis (id & created_at sama):
-- begin;
-- insert into public.bom_proses_relevan (id, kode_komponen, tipe_panel, jenis_pekerjaan, created_at) values
--   (1652, 'FS.8', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1653, 'FS.8', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1659, 'FS.11', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1660, 'FS.11', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1668, 'FS.29', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1669, 'FS.29', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1674, 'FS.30', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1675, 'FS.30', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1679, 'FS.33', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1680, 'FS.33', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1697, 'FS.16', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1698, 'FS.16', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1701, 'FS.17', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1704, 'FS.17', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1707, 'FS.18', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1708, 'FS.18', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1710, 'FS.20', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1713, 'FS.20', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1716, 'FS.21', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1719, 'FS.21', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1722, 'FS.23', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1725, 'FS.23', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1727, 'FS.27', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1730, 'FS.27', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1732, 'FS.28', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1735, 'FS.28', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1738, 'FS.34', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1739, 'FS.34', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1743, 'FS.35', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1744, 'FS.35', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1752, 'FS.14', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1755, 'FS.14', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1757, 'FS.15', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1760, 'FS.15', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1762, 'FS.24', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1765, 'FS.24', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1767, 'FS.25', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1770, 'FS.25', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1773, 'FS.26', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1777, 'FS.26', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1782, 'FS.10', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1784, 'FS.22', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1787, 'FS.22', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1795, 'FS.31', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1796, 'FS.31', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1822, 'FS.13', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1826, 'FS.13', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1831, 'FS.9', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1832, 'FS.9', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1838, 'FS.12', 'FS_SS', 'PAINTING', '2026-10-09T04:14:57.738197+00:00'),
--   (1841, 'FS.12', 'FS_SS', 'RENDAM', '2026-10-09T04:14:57.738197+00:00'),
--   (1846, 'FS.19', 'FS_SS', 'PAINTING', '2026-10-09T09:32:36.023858+00:00')
--   ;
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'ATUR PROSES RELEVAN', 'Rollback: kembalikan RENDAM & PAINTING FS_SS (52 mapping).', 'master_data', 'SQL Editor');
-- commit;
-- (b) pulihkan jadwal panel 525:
-- update public.raw_schedule set deleted_at = null where id in (7175, 7176);
