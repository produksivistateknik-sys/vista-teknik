-- ============================================================================================
-- KESEHATAN DATA K25 - kode tidak valid di jadwal yang belum selesai (6 Nov 2026, insiden FS.10 UNP RENDAM panel 527).
--  Hanya membaca. Menandai kode di raw_schedule yang tidak relevan utk proses barisnya (bom_proses_relevan), tidak ada di
--  panel, atau qty 0, dan masih mungkin terbit sebagai tugas: bukan jejak, belum 100%, tanggal >= kemarin (hari kerja WIB).
--  Tidak dihitung: kode yang sudah 100% (mis. FS.19 POTONG & WM.3 RAKIT yang relevansinya dicabut setelah dikerjakan), panel
--  arsip, WO arsip, tanggal lama, BUSBAR/QC TEST/PACKING/NAMEPLATE/YELLOWMARK. Kode tanpa mapping BOM tidak dinilai.
--  Cermin aturan: src/lib/relevansiJadwal.ts & supabase/functions/auto-geser-harian/aturanKode.ts.
-- Pola lapisan sama dgn K16-K24: fungsi sekarang di-rename _sql_cek_kesehatan_k1_k24; K1-K24 tidak berubah.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja). Harap: lapisan belum ada.
select case when to_regprocedure('public._sql_cek_kesehatan_k1_k24(text)') is not null then 'SUDAH ADA - jangan jalankan lagi' else 'ok, belum ada' end as lapisan_k1_k24;

-- (1) EKSEKUSI
begin;
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k24;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K25' then $q$
   select r.id::text || ':' || s.tgl || ':' || coalesce(e->>'wp', '') || ':' || k.kode as ref,
          w.wo, w.proyek, p.id as panel_id, p.nama as panel, p.tipe, r.proses, k.kode as kode_komponen, s.tgl as tanggal, e->>'wp' as wp,
          case when jsonb_typeof(p.checklist->k.kode) is distinct from 'object' then 'tidak ada di panel'
               when public._angka_progres(p.checklist->k.kode->>'qty') <= 0 then 'qty 0'
               else 'tidak relevan' end as alasan,
          public._angka_progres(p.checklist->k.kode->'progress'->>r.proses) as persen, 'peringatan' as tingkat
   from public.raw_schedule r
   join public.panels p on p.id = r.panel_id
   join public.work_orders w on w.id = p.wo_id and coalesce(w.is_archived, false) = false and w.deleted_at is null
   cross join lateral jsonb_each(coalesce(r.schedule, '{}'::jsonb)) s(tgl, isi)
   cross join lateral jsonb_array_elements(case when jsonb_typeof(s.isi) = 'array' then s.isi else '[]'::jsonb end) e
   cross join lateral jsonb_array_elements_text(coalesce(e->'komponen', '[]'::jsonb)) k(kode)
   where r.deleted_at is null
     and r.proses not in ('BUSBAR', 'QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK')
     and k.kode not like '\_\_%'
     and not coalesce(e->'digeserKe', '{}'::jsonb) ? k.kode
     and s.tgl >= to_char((now() at time zone 'Asia/Jakarta') - interval '31 hours', 'YYYY-MM-DD')
     and public._angka_progres(p.checklist->k.kode->'progress'->>r.proses) < 100
     and (jsonb_typeof(p.checklist->k.kode) is distinct from 'object'
          or public._angka_progres(p.checklist->k.kode->>'qty') <= 0
          or (exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = k.kode and b.tipe_panel = p.tipe)
              and not exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = k.kode and b.tipe_panel = p.tipe and b.jenis_pekerjaan = r.proses)))
   order by s.tgl desc, p.id, r.proses, k.kode $q$
 else public._sql_cek_kesehatan_k1_k24(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K25', 'Kode tidak valid di jadwal yang belum selesai', 'Jadwal',
  'Komponen terjadwal di proses yang tidak dilewatinya, tidak ada di panel, atau qty 0, dan masih bisa terbit sebagai tugas. Komponen yang sudah 100% tidak dihitung.', 'per_jam', 1, null, 68,
  array['Admin'],
  $t$Ada komponen di Raw Schedule yang tidak seharusnya berada di proses itu dan belum selesai.$t$,
  $t$Tersisa dari salin-tempel sebelum saringan 21 Okt 2026, proses relevan di BOM diubah setelah dijadwalkan, atau qty diubah menjadi 0.$t$,
  $t$Komponen bisa muncul di Rencana Harian dan HP operator sebagai tugas padahal tidak dikerjakan di proses itu, dan ikut menempati kapasitas.$t$,
  array[
    $t$Lihat panel, proses, tanggal, dan alasan di contoh baris.$t$,
    $t$Pastikan dengan planner apakah komponen itu memang tidak lewat proses tersebut.$t$,
    $t$Bila tidak lewat, hapus dari sel lewat Raw Schedule. Bila lewat, perbaiki proses relevan di BOM.$t$])
on conflict (kode) do nothing;
commit;

-- (2) VERIFIKASI - harus 'SEMUA LULUS' (tampil sbg notice) dan TIDAK ada error.
do $$
declare k text; n int; gagal text[] := '{}';
begin
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16','K17','K18','K19','K20','K21','K22','K23','K24'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k24(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  begin
    execute 'select count(*) from (' || public._sql_cek_kesehatan('K25') || ') s' into n;
    raise notice 'K25 sekarang: % baris', n;
  exception when others then gagal := gagal || ('K25 error: ' || sqlerrm);
  end;
  if not exists (select 1 from public.kesehatan_cek where kode = 'K25' and aktif) then gagal := gagal || 'baris kesehatan_cek K25 tidak ada'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
select kode, nama, aktif from public.kesehatan_cek where kode = 'K25'; -- harap 1 baris aktif

-- (3) ROLLBACK:
-- begin;
-- delete from public.kesehatan_hasil where kode = 'K25';
-- delete from public.kesehatan_temuan_diketahui where kode = 'K25';
-- delete from public.kesehatan_cek where kode = 'K25';
-- drop function public._sql_cek_kesehatan(text);
-- alter function public._sql_cek_kesehatan_k1_k24(text) rename to _sql_cek_kesehatan;
-- commit;
