-- ============================================================================================
-- KESEHATAN DATA K16 "Komponen sudah selesai tapi masih terjadwal lagi" (21 Okt 2026)
-- Insiden: SISWOYO (STEL) sudah simpan FS.13 panel 547 100% tgl 20 Okt, tapi rebalance Atur Kapasitas
-- memindahnya ke 21 Okt -> terbit ulang di renhar & HP operator (juga EDI MARWOTO, EDI MUKLAS).
-- Cek ini menangkap kelas masalahnya dari jalur MANA PUN (jalur lama/baru yang belum ketahuan):
-- kode yang progress-nya 100% & selesai SEBELUM tanggal jadwalnya, tapi masih aktif di raw_schedule
-- (bukan jejak) atau di renhar pada tanggal >= hari ini (WIB).
-- Aturan "selesai sebelum tanggal" = SAMA dgn helper app selesaiSebelumTanggal (vista-teknik
-- src/lib/kodeJadwalAktif.ts & vista-pekerja src/lib/panelHelpers.tsx): progress>=100, TIDAK ada
-- progressByDate>=100 tepat di tanggal itu, ADA progressByDate>=100 sebelum tanggal itu
-- (fallback history[].tanggal/pct utk data tanpa progressByDate).
--
-- K1-K15 dijamin TIDAK berubah: fungsi lama _sql_cek_kesehatan HANYA diganti nama menjadi
-- _sql_cek_kesehatan_k1_k15, lalu fungsi baru memanggilnya utk semua kode selain K16.
-- Dry-run   : supabase/verifikasi/20261021010000_kesehatan_k16_dryrun.sql (jalankan SEBELUM ini)
-- Verifikasi: supabase/verifikasi/20261021010000_kesehatan_k16_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261021010000_kesehatan_k16_rollback.sql
-- ============================================================================================
begin;

alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k15;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K16' then $q$
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
   order by s.tanggal, s.sumber desc, s.panel_id, s.proses, s.kode $q$
 else public._sql_cek_kesehatan_k1_k15(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K16', 'Komponen selesai masih terjadwal lagi', 'Jadwal',
  'Komponen yang progress-nya sudah 100% dan selesai SEBELUM tanggal jadwalnya, tapi masih aktif di Raw Schedule (bukan jejak) atau Rencana Harian pada hari ini / ke depan.', 'per_jam', 1, null, 59,
  array['Admin','Operator'],
  $t$Ada komponen yang sudah selesai dikerjakan (100%) tapi masih tercatat sebagai pekerjaan di tanggal sesudahnya. Kalau sudah masuk Rencana Harian hari ini (Kritis), operator melihat pekerjaan itu muncul lagi di HP padahal sudah disimpan.$t$,
  $t$Komponen dipindah ke tanggal lain oleh jalur pemindah jadwal tanpa cek 100% (insiden 21 Okt 2026: Atur Kapasitas pada tanggal yang sudah selesai dikerjakan), atau jadwal multi-hari yang selesai lebih cepat dari rencana.$t$,
  $t$Operator mengerjakan/menyimpan ulang komponen yang sudah selesai (catatan dobel di riwayat & checkpoint); planner melihat beban kapasitas yang salah.$t$,
  array[
    $t$Lihat contoh baris: sumber (raw_schedule / renhar), tanggal, panel, proses, kode, tanggal selesai.$t$,
    $t$raw_schedule: kembalikan kode ke tanggal selesainya (atau hapus dari tanggal ini) di Raw Schedule; minta bantuan Claude Code dengan tombol Salin bila banyak.$t$,
    $t$renhar hari ini: beri tahu operator bahwa komponen itu sudah selesai (tidak perlu disimpan ulang).$t$,
    $t$Catat jalur apa yang memindahkannya (activity_log sekitar waktu itu) - kalau bukan pola yang sudah diketahui, itu bug baru.$t$])
on conflict (kode) do nothing;

commit;
