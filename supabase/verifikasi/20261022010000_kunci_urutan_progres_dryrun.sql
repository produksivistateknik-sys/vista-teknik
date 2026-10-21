-- DRY-RUN kunci urutan progres (BACA SAJA) - jalankan SEBELUM migration 20261022010000_kunci_urutan_progres.sql.
-- 1) Objek belum ada (harus: urutan_proses=null, koreksi_progres_log=null, trigger lama ada, trigger baru belum).
select to_regclass('public.urutan_proses') as urutan_proses, to_regclass('public.koreksi_progres_log') as koreksi_progres_log,
  exists (select 1 from pg_trigger where tgname = 'trg_panels_validate_mekanik_cap' and not tgisinternal) as trigger_mekanik_ada,
  exists (select 1 from pg_trigger where tgname = 'trg_panels_validate_urutan_progres' and not tgisinternal) as trigger_baru_ada;

-- 2) Panel AKTIF yang SEKARANG sudah melanggar pasangan yang akan dikunci (data lama - tidak akan memblokir
--    simpanan lain krn trigger hanya memeriksa yang berubah). Harapan 21 Okt 2026: 1 baris, 521 FS.5 RENDAM 67 < PAINTING 100.
with aturan(proses, pendahulu) as (values
  ('BENDING', array['POTONG']), ('STEL', array['BENDING','POTONG']), ('FINISHING', array['STEL','BENDING','POTONG']),
  ('RENDAM', array['FINISHING','STEL','BENDING','POTONG']), ('PAINTING', array['RENDAM','FINISHING','STEL','BENDING','POTONG']),
  ('RAKIT', array['PAINTING','RENDAM','FINISHING','STEL','BENDING','POTONG'])),
k as (select p.id, trim(p.nama) as panel, p.tipe, e.key as kode, e.value as cl,
        exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe) as ada_mapping
      from public.panels p cross join lateral jsonb_each(case when jsonb_typeof(p.checklist) = 'object' then p.checklist else '{}'::jsonb end) e
      where jsonb_typeof(e.value) = 'object' and jsonb_typeof(e.value->'progress') = 'object')
select k.id as panel_id, k.panel, k.kode, x.awal as proses_awal, k.cl->'progress'->>x.awal as pct_awal, a.proses as proses_sesudah, k.cl->'progress'->>a.proses as pct_sesudah
from k cross join aturan a
cross join lateral (select u.p as awal from unnest(a.pendahulu) with ordinality u(p, n)
  where not k.ada_mapping or exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = k.kode and b.tipe_panel = k.tipe and b.jenis_pekerjaan = u.p)
  order by u.n limit 1) x
where (not k.ada_mapping or exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = k.kode and b.tipe_panel = k.tipe and b.jenis_pekerjaan = a.proses))
  and coalesce(nullif(k.cl->'progress'->>a.proses, '')::numeric, 0) > coalesce(nullif(k.cl->'progress'->>x.awal, '')::numeric, 0)
order by k.id, k.kode;
