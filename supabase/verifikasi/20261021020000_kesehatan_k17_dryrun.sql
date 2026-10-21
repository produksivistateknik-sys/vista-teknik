-- DRY-RUN K17 (BACA SAJA) - jalankan SEBELUM migration 20261021020000_kesehatan_k17.sql.
-- Isi = query K17 persis seperti di migration. Harapan (data 21 Okt 2026): 40 baris (POTONG->BENDING 21,
-- PAINTING->RAKIT 14, STEL->FINISHING 3, RENDAM->PAINTING 1, POTONG->RENDAM 1) - sama dgn tombol
-- "⚠ Urutan terbalik" di Raw Schedule (lib/urutanProses.ts). Angka bisa bergeser kalau jadwal diubah sejak itu.
with hari as (select ((now() at time zone 'Asia/Jakarta')::date)::text as ini),
   urutan(proses, kandidat) as (values
     ('BENDING',         array['POTONG']),
     ('STEL',            array['BENDING','POTONG']),
     ('FINISHING',       array['STEL','BENDING','POTONG']),
     ('RENDAM',          array['FINISHING','STEL','BENDING','POTONG']),
     ('PAINTING',        array['RENDAM','FINISHING','STEL','BENDING','POTONG']),
     ('RAKIT',           array['PAINTING','RENDAM','FINISHING','STEL','BENDING','POTONG']),
     ('PASANG KOMPONEN', array['RAKIT','PAINTING','RENDAM','FINISHING','STEL','BENDING','POTONG']),
     ('WIRING CONTROL',  array['PAINTING','RENDAM','FINISHING','STEL','BENDING','POTONG']),
     ('WIRING POWER',    array['PAINTING','RENDAM','FINISHING','STEL','BENDING','POTONG'])),
   mulai as (
     select r.panel_id, r.proses, k.kode, min(d.key) as tgl
     from public.raw_schedule r
     cross join lateral jsonb_each(case when jsonb_typeof(r.schedule) = 'object' then r.schedule else '{}'::jsonb end) d
     cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) e
     cross join lateral jsonb_array_elements_text(case when jsonb_typeof(e->'komponen') = 'array' then e->'komponen' else '[]'::jsonb end) k(kode)
     where r.deleted_at is null
       and r.proses in ('POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','PASANG KOMPONEN','WIRING CONTROL','WIRING POWER')
       and left(k.kode, 2) <> '__'
       and not coalesce((e->'digeserKe') ? k.kode, false)
     group by r.panel_id, r.proses, k.kode
   ),
   pasangan as (
     select m.panel_id, m.kode, m.proses as proses_sesudah, m.tgl as tgl_sesudah, p.tipe, trim(p.nama) as panel, p.checklist->m.kode as cl,
       (select a.proses_awal from unnest(u.kandidat) with ordinality a(proses_awal, n)
         where exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = m.kode and b.tipe_panel = p.tipe and b.jenis_pekerjaan = a.proses_awal)
           and exists (select 1 from mulai m2 where m2.panel_id = m.panel_id and m2.kode = m.kode and m2.proses = a.proses_awal)
         order by a.n limit 1) as proses_awal
     from mulai m
     join urutan u on u.proses = m.proses
     join public.panels p on p.id = m.panel_id and p.deleted_at is null
     where exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = m.kode and b.tipe_panel = p.tipe and b.jenis_pekerjaan = m.proses)
       and (p.checklist->m.kode->>'qty') ~ '^[0-9]+(\.[0-9]+)?$' and (p.checklist->m.kode->>'qty')::numeric > 0
   )
   select x.panel_id || ':' || x.kode || ':' || x.proses_awal || ':' || x.proses_sesudah as ref,
          x.panel, x.panel_id, x.kode as kode_komponen,
          x.proses_awal, ma.tgl as tgl_proses_awal,
          coalesce(case when (x.cl->'progress'->>x.proses_awal) ~ '^[0-9]+(\.[0-9]+)?$' then (x.cl->'progress'->>x.proses_awal)::numeric end, 0) as progres_proses_awal,
          x.proses_sesudah, x.tgl_sesudah as tgl_proses_sesudah,
          'peringatan' as tingkat
   from pasangan x
   join mulai ma on ma.panel_id = x.panel_id and ma.kode = x.kode and ma.proses = x.proses_awal
   where x.proses_awal is not null
     and x.tgl_sesudah < ma.tgl
     and ma.tgl >= (select ini from hari)
     and coalesce(case when (x.cl->'progress'->>x.proses_awal) ~ '^[0-9]+(\.[0-9]+)?$' then (x.cl->'progress'->>x.proses_awal)::numeric end, 0) < 100
   order by x.tgl_sesudah, x.panel_id, x.kode;
