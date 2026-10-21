-- ============================================================================================
-- KESEHATAN DATA K17 "Urutan proses terbalik" (21 Okt 2026, keputusan user - tingkat Peringatan)
-- Komponen yang proses SESUDAHNYA dijadwalkan mulai LEBIH AWAL dari proses sebelumnya di Raw Schedule.
-- Aturan = CERMIN src/lib/urutanProses.ts (ubah keduanya bersamaan):
--   POTONG > BENDING > STEL > FINISHING > RENDAM > PAINTING lalu RAKIT > PASANG KOMPONEN;
--   WIRING CONTROL & WIRING POWER sejajar RAKIT (pendahulunya proses dasar terakhir) & satu sama lain;
--   BUSBAR / QC TEST / PACKING / NAMEPLATE / YELLOWMARK dikecualikan.
--   Proses relevan = bom_proses_relevan (kode x tipe panel). Tanggal = tanggal live (bukan jejak digeserKe)
--   paling awal. Pendahulu = proses relevan & terjadwal pertama di daftar kandidat. Hari sama boleh.
--   Proses sebelumnya yang sudah 100% tidak dihitung. Hanya yang proses sebelumnya masih >= hari ini (WIB).
--   Beda kecil dgn app: kode tanpa mapping bom_proses_relevan dilewati di sini (app memakai KOMPONEN_PROSES_MAP;
--   21 Okt 2026 semua kode panel aktif punya mapping).
-- K1-K16 dijamin TIDAK berubah: fungsi sekarang di-rename _sql_cek_kesehatan_k1_k16, fungsi baru
-- menangani K17 lalu mendelegasikan kode lain (pola sama dgn K16).
-- Dry-run   : supabase/verifikasi/20261021020000_kesehatan_k17_dryrun.sql (jalankan SEBELUM ini)
-- Verifikasi: supabase/verifikasi/20261021020000_kesehatan_k17_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261021020000_kesehatan_k17_rollback.sql
-- ============================================================================================
begin;

alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k16;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K17' then $q$
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
 else public._sql_cek_kesehatan_k1_k16(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K17', 'Urutan proses terbalik', 'Jadwal',
  'Komponen yang proses sesudahnya dijadwalkan mulai lebih awal dari proses sebelumnya (proses sebelumnya belum 100% dan tanggalnya hari ini / ke depan).', 'per_jam', 1, null, 60,
  array['Admin'],
  $t$Di Raw Schedule ada komponen yang urutan prosesnya terbalik, mis. BENDING dijadwalkan hari ini padahal POTONG-nya baru besok. Di Raw Schedule chip/WP itu bertanda ⚠ bingkai merah dan tercantum di tombol "⚠ Urutan terbalik".$t$,
  $t$Proses awal dipindah ke belakang (pin manual planner) tanpa memindahkan proses sesudahnya, proses awal belum selesai lalu dibawa maju auto-geser / terdorong kapasitas, atau rebalance Atur Kapasitas.$t$,
  $t$Operator proses sesudah mendapat tugas yang bahannya belum dikerjakan proses sebelumnya; rencana kapasitas per hari jadi tidak realistis.$t$,
  array[
    $t$Buka Raw Schedule, klik tombol "⚠ Urutan terbalik", pilih komponen di daftar (tampilan tersaring ke panel itu).$t$,
    $t$Geser proses sesudah ke tanggal yang sama/sesudah proses sebelumnya, atau majukan proses sebelumnya.$t$,
    $t$Kalau urutan terbalik memang disengaja (dikerjakan paralel), tekan "Tandai diketahui" dengan catatan.$t$])
on conflict (kode) do nothing;

commit;
