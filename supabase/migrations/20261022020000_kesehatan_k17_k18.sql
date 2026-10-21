-- ============================================================================================
-- KESEHATAN DATA: K17 membaca urutan_proses + K18 "Progres melompati urutan proses" (22 Okt 2026)
-- Prasyarat: migration 20261022010000_kunci_urutan_progres.sql (tabel urutan_proses + _angka_progres).
-- K17 (urutan JADWAL terbalik, sudah live 21 Okt): isi query sama, hanya daftar urutan sekarang dibaca dari
--   public.urutan_proses (satu sumber) - hasil harus SAMA dgn versi 21 Okt (dibuktikan di verifikasi).
-- K18 (urutan PROGRES terbalik): komponen panel aktif yang progres proses sesudahnya > proses sebelumnya
--   (pendahulu = proses relevan pertama di urutan_proses.pendahulu; bom_proses_relevan, tanpa mapping = semua).
--   Kolom mode: 'kunci' (sejak trigger 22 Okt seharusnya hanya data lama) / 'peringatan' (RAKIT>PASANG,
--   PAINTING>WIRING - boleh terjadi, perlu dicek). Tingkat Peringatan. Harapan 21 Okt: 1 baris (521 FS.5).
-- K1-K16 tidak berubah: fungsi lapisan atas (_sql_cek_kesehatan, isinya hanya K17 + delegasi) diganti; K1-K16
-- tetap didelegasikan ke _sql_cek_kesehatan_k1_k16.
-- Dry-run   : supabase/verifikasi/20261022020000_kesehatan_k17_k18_dryrun.sql
-- Verifikasi: supabase/verifikasi/20261022020000_kesehatan_k17_k18_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261022020000_kesehatan_k17_k18_rollback.sql
-- ============================================================================================
begin;

-- salinan K17 versi 21 Okt (sebelum diganti) - pembanding di verifikasi & dipakai rollback
create or replace function public._sql_cek_kesehatan_k17_lama() returns text language sql immutable as $f$
select $q$
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
   order by x.tgl_sesudah, x.panel_id, x.kode $q$
$f$;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K17' then $q$
   with hari as (select ((now() at time zone 'Asia/Jakarta')::date)::text as ini),
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
   order by x.tgl_sesudah, x.panel_id, x.kode $q$
 when 'K18' then $q$
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
   order by (u.mode = 'kunci') desc, k.panel_id, k.kode, u.proses $q$
 else public._sql_cek_kesehatan_k1_k16(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K18', 'Progres melompati urutan proses', 'Progres',
  'Komponen panel aktif yang progres proses sesudahnya lebih tinggi dari proses sebelumnya (urutan dari tabel urutan_proses, proses relevan dari bom_proses_relevan).', 'per_jam', 1, null, 61,
  array['Admin','Operator'],
  $t$Ada komponen yang proses berikutnya tercatat lebih maju dari proses sebelumnya, mis. PAINTING 3/3 padahal RENDAM baru 2/3. Kolom mode: "kunci" = pasangan yang dijaga database (sejak 22 Okt 2026 seharusnya hanya data lama), "peringatan" = RAKIT>PASANG KOMPONEN atau PAINTING>WIRING (boleh terjadi, tapi perlu dicek).$t$,
  $t$Proses sebelumnya lupa diketik/disimpan operator (paling sering: pekerjaan sudah dilakukan tapi qty tidak diinput), atau data lama sebelum kuncian 22 Okt 2026.$t$,
  $t$Tracking progres menampilkan urutan yang mustahil (mis. Rendam IN PROGRESS padahal Painting & Rakit DONE); renhar proses sebelumnya terus terbit setiap hari.$t$,
  array[
    $t$Tanyakan ke operator proses sebelumnya apakah pekerjaannya sudah dilakukan.$t$,
    $t$Kalau sudah: operator menyimpan qty yang benar, atau Admin Produksi memakai "Koreksi progres" (alasan wajib, tercatat permanen).$t$,
    $t$Kalau memang sengaja (mode peringatan, dikerjakan paralel): tekan "Tandai diketahui" dengan catatan.$t$])
on conflict (kode) do nothing;

commit;
