-- DRY-RUN K17 baru + K18 (BACA SAJA) - jalankan SESUDAH 20261022010000_kunci_urutan_progres.sql & SEBELUM migration ini.
-- (a) K17 versi baru (membaca urutan_proses) - jumlah harus SAMA dgn K17 terakhir di Kesehatan Data.
select count(*) as k17_baru from (with hari as (select ((now() at time zone 'Asia/Jakarta')::date)::text as ini),
   urutan(proses, kandidat) as (select proses, pendahulu from public.urutan_proses where cardinality(pendahulu) > 0),
   mulai as (
     select r.panel_id, r.proses, k.kode, min(d.key) as tgl
     from public.raw_schedule r
     cross join lateral jsonb_each(case when jsonb_typeof(r.schedule) = 'object' then r.schedule else '{}'::jsonb end) d
     cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) e
     cross join lateral jsonb_array_elements_text(case when jsonb_typeof(e->'komponen') = 'array' then e->'komponen' else '[]'::jsonb end) k(kode)
     where r.deleted_at is null
       and r.proses in (select proses from public.urutan_proses)
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
   order by x.tgl_sesudah, x.panel_id, x.kode) s;
-- (b) K18 - harapan 21 Okt 2026: 1 baris (521 FS.5 RENDAM 67 < PAINTING 100, mode kunci).
with k as (
     select p.id as panel_id, trim(p.nama) as panel, p.tipe, e.key as kode, e.value as cl,
            exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe) as ada_mapping
     from public.panels p
     cross join lateral jsonb_each(case when jsonb_typeof(p.checklist) = 'object' then p.checklist else '{}'::jsonb end) e
     where p.deleted_at is null and jsonb_typeof(e.value) = 'object' and jsonb_typeof(e.value->'progress') = 'object'
       and (e.value->>'qty') ~ '^[0-9]+(\.[0-9]+)?$' and (e.value->>'qty')::numeric > 0
   )
   select k.panel_id || ':' || k.kode || ':' || x.awal || ':' || u.proses as ref,
          k.panel, k.panel_id, k.kode as kode_komponen,
          x.awal as proses_awal, public._angka_progres(k.cl->'progress'->>x.awal) as pct_awal, k.cl->'qtyProses'->>x.awal as qty_awal,
          u.proses as proses_sesudah, public._angka_progres(k.cl->'progress'->>u.proses) as pct_sesudah, k.cl->'qtyProses'->>u.proses as qty_sesudah,
          k.cl->>'qty' as qty_komponen, u.mode, 'peringatan' as tingkat
   from k
   cross join public.urutan_proses u
   cross join lateral (select q.p as awal from unnest(u.pendahulu) with ordinality q(p, n)
       where not k.ada_mapping or exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = k.kode and b.tipe_panel = k.tipe and b.jenis_pekerjaan = q.p)
       order by q.n limit 1) x
   where cardinality(u.pendahulu) > 0
     and (not k.ada_mapping or exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = k.kode and b.tipe_panel = k.tipe and b.jenis_pekerjaan = u.proses))
     and public._angka_progres(k.cl->'progress'->>u.proses) > public._angka_progres(k.cl->'progress'->>x.awal)
   order by (u.mode = 'kunci') desc, k.panel_id, k.kode, u.proses;
