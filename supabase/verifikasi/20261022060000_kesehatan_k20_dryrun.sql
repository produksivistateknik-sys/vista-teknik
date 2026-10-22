-- DRY-RUN K20 (BACA SAJA) - jalankan SEBELUM migration K20. Query temuan yang sama persis dengan isi migration.
-- Harapan 22 Okt 2026 siang (simulasi Node pada data live, 40 timer berjalan): 4 baris -
--  26043 IFAL   534 FS.4 WIRING CONTROL 22 Okt  (tidak ada di daftar: daftar FIRMAN, RAFIK)
--  26050 FAHRI  544 FS.4 WIRING POWER   22 Okt  (renhar FS.4 hari ini dipindah ke 24 Okt -> tidak ada daftar hari itu)
--  26169 RIFKI  544 FS.4 WIRING POWER   21 Okt  (dimulai 22 Okt 10:31 WIB dari kartu 21 Okt)
--  26170 FAHRI  544 FS.4 WIRING POWER   21 Okt  (idem - FAHRI punya 2 timer berjalan sekaligus)
-- (Angka bisa berubah kalau operator sudah menekan Selesai.)
select case when to_regprocedure('public._sql_cek_kesehatan_k1_k19(text)') is not null then 'SUDAH ADA - jangan jalankan migration lagi' else 'ok, belum ada' end as lapisan_k1_k19;
select t.id::text as ref, pk.nama as pekerja, t.panel_id, p.nama as panel, t.kode_komponen, t.proses, t.tahap,
       t.tanggal, t.mulai,
       case when t.tanggal < (now() at time zone 'Asia/Jakarta')::date then 'timer bertanggal sebelum hari ini masih berjalan'
            else 'tidak ada di daftar operator hari itu' end as alasan,
       (select string_agg(coalesce(pk2.nama, x.v), ', ')
          from public.renhar r2
          cross join lateral jsonb_array_elements_text(case
               when jsonb_typeof(r2.pekerja_per_komponen -> t.kode_komponen) = 'array' then r2.pekerja_per_komponen -> t.kode_komponen
               when jsonb_typeof(r2.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')) = 'array' then r2.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')
               else '[]'::jsonb end) as x(v)
          left join public.pekerja pk2 on pk2.id::text = x.v
         where r2.panel_id = t.panel_id and r2.proses = t.proses and r2.tanggal = t.tanggal and r2.deleted_at is null) as daftar_hari_itu,
       'peringatan' as tingkat
from public.fcs_timer_kerja t
left join public.pekerja pk on pk.id = t.pekerja_id
left join public.panels p on p.id = t.panel_id
where t.selesai is null
  and (t.tanggal < (now() at time zone 'Asia/Jakarta')::date
       or not exists (
         select 1 from public.renhar r
         where r.panel_id = t.panel_id and r.proses = t.proses and r.tanggal = t.tanggal and r.deleted_at is null
           and (
             (jsonb_typeof(r.pekerja_per_komponen -> t.kode_komponen) = 'array'
                and (r.pekerja_per_komponen -> t.kode_komponen) @> to_jsonb(t.pekerja_id))
             or (jsonb_typeof(r.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')) = 'array'
                and (r.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')) @> to_jsonb(t.pekerja_id)))))
order by t.mulai;
