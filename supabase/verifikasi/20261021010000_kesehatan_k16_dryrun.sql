-- DRY-RUN K16 (BACA SAJA) - jalankan SEBELUM migration 20261021010000_kesehatan_k16.sql.
-- Isi = query K16 persis seperti di migration. Harapan (data 21 Okt 2026 sore, sebelum skrip
-- 20261021_kembalikan_komponen_selesai_rebalance.sql dijalankan): baris raw_schedule 21-22 Okt utk
-- 547 FS.13 STEL, 528/529/531 FS.10 STEL, 526/528/531 FS.10 FINISHING, 531 FS.10 POTONG, 532 WM.4 STEL,
-- 526 FS.10 STEL, 547 FS.1 FINISHING, 545 FS.33/FS.34 POTONG + baris renhar 21 Okt (tingkat kritis)
-- termasuk #22179 SISWOYO. Sesudah skrip perbaikan dijalankan, baris raw_schedule rebalance hilang.
with hari as (select ((now() at time zone 'Asia/Jakarta')::date)::text as ini),
   jadwal as (
     select 'raw_schedule' as sumber, r.id as sumber_id, r.panel_id, r.proses, d.key as tanggal, e->>'wp' as wp, k.kode, null::jsonb as operator_id
     from public.raw_schedule r
     cross join lateral jsonb_each(case when jsonb_typeof(r.schedule) = 'object' then r.schedule else '{}'::jsonb end) d
     cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) e
     cross join lateral jsonb_array_elements_text(case when jsonb_typeof(e->'komponen') = 'array' then e->'komponen' else '[]'::jsonb end) k(kode)
     where r.deleted_at is null and d.key >= (select ini from hari)
       and r.proses not in ('NAMEPLATE', 'YELLOWMARK', 'BUSBAR')
       and left(k.kode, 9) <> '__wiring_'
       and not coalesce((e->'digeserKe') ? k.kode, false)
     union all
     select 'renhar', h.id, h.panel_id, h.proses, h.tanggal::text, h.wp, k.kode, to_jsonb(h.pekerja_per_komponen)->k.kode
     from public.renhar h
     cross join lateral jsonb_array_elements_text(case when jsonb_typeof(to_jsonb(h.komponen)) = 'array' then to_jsonb(h.komponen) else '[]'::jsonb end) k(kode)
     where h.deleted_at is null and h.tanggal::text >= (select ini from hari)
       and h.proses not in ('NAMEPLATE', 'YELLOWMARK', 'BUSBAR')
       and left(k.kode, 9) <> '__wiring_'
   ),
   nilai as (
     select j.*, trim(p.nama) as panel, p.checklist->j.kode as cl
     from jadwal j join public.panels p on p.id = j.panel_id
   ),
   selesai as (
     select n.*,
       (select min(b.key) from jsonb_each_text(case when jsonb_typeof(n.cl->'progressByDate'->n.proses) = 'object' then n.cl->'progressByDate'->n.proses else '{}'::jsonb end) b
         where b.value ~ '^[0-9]+(\.[0-9]+)?$' and b.value::numeric >= 100 and b.key < n.tanggal) as selesai_pbd,
       exists (select 1 from jsonb_each_text(case when jsonb_typeof(n.cl->'progressByDate'->n.proses) = 'object' then n.cl->'progressByDate'->n.proses else '{}'::jsonb end) b
         where b.key = n.tanggal and b.value ~ '^[0-9]+(\.[0-9]+)?$' and b.value::numeric >= 100) as selesai_tepat_pbd,
       (select min(x->>'tanggal') from jsonb_array_elements(case when jsonb_typeof(n.cl->'history'->n.proses) = 'array' then n.cl->'history'->n.proses else '[]'::jsonb end) x
         where (x->>'pct') ~ '^[0-9]+(\.[0-9]+)?$' and (x->>'pct')::numeric >= 100 and (x->>'tanggal') < n.tanggal) as selesai_hist,
       exists (select 1 from jsonb_array_elements(case when jsonb_typeof(n.cl->'history'->n.proses) = 'array' then n.cl->'history'->n.proses else '[]'::jsonb end) x
         where (x->>'tanggal') = n.tanggal and (x->>'pct') ~ '^[0-9]+(\.[0-9]+)?$' and (x->>'pct')::numeric >= 100) as selesai_tepat_hist
     from nilai n
     where (n.cl->'progress'->>n.proses) ~ '^[0-9]+(\.[0-9]+)?$' and (n.cl->'progress'->>n.proses)::numeric >= 100
   )
   select s.sumber || ':' || s.sumber_id || ':' || s.tanggal || ':' || s.kode as ref,
          s.sumber, s.tanggal, s.panel, s.panel_id, s.proses, s.wp, s.kode as kode_komponen,
          coalesce(s.selesai_pbd, s.selesai_hist) as selesai_tanggal,
          (select string_agg(k.nama, ', ') from public.pekerja k
            where s.operator_id is not null and jsonb_typeof(s.operator_id) = 'array' and to_jsonb(k.id) <@ s.operator_id) as operator,
          case when s.sumber = 'renhar' and s.tanggal = (select ini from hari) then 'kritis' else 'peringatan' end as tingkat
   from selesai s
   where not s.selesai_tepat_pbd
     and (s.selesai_pbd is not null or (not s.selesai_tepat_hist and s.selesai_hist is not null))
   order by s.tanggal, s.sumber desc, s.panel_id, s.proses, s.kode;
