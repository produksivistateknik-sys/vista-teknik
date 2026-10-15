-- ============================================================================================
-- KESEHATAN DATA - 2 cek khusus aplikasi operator (16 Okt 2026, usulan disetujui user "lanjut")
--  K12 Simpan progres tidak lengkap : simpanan TERAKHIR operator (progress_checkpoint_log, 14 hari) > progres di
--      panels.checklist komponen+proses itu (pola HP versi lama, kasus panel 521 FS.30 PAINTING 10 Okt).
--      Pakai simpanan terakhir (bukan maksimum) supaya koreksi turun tidak jadi temuan palsu.
--      Uji live 16 Okt: 1.913 kombinasi komponen-proses, 0 temuan (FS.30 sudah diselaraskan 15 Okt).
--  K13 Timer ditutup tanpa durasi   : timer 7 hari terakhir dgn selesai = mulai PERSIS (Force Stop admin, tutup
--      otomatis server tanpa simpanan, tutup saat komponen selesai utk timer hari sebelumnya). Stop manual cepat
--      (< 1 menit) TIDAK ikut karena selisih ms-nya tidak nol. Uji live: 18 (hampir semua Force Stop massal 15 Okt).
-- Mengganti fungsi _sql_cek_kesehatan (K1-K11 TIDAK berubah, hanya ditambah 2 cabang) + 2 baris kesehatan_cek.
-- Rollback: supabase/rollback/20261016020000_kesehatan_cek_operator_rollback.sql
-- ============================================================================================
begin;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K12', 'Simpan progres tidak lengkap', 'Progres',
  'Simpanan terakhir operator mencatat persen lebih tinggi daripada progres di checklist.', 'harian', 1, null, 55,
  array['Operator','Admin'],
  $t$Simpanan progres terakhir operator (catatan simpanan, 14 hari terakhir) mencatat persen lebih tinggi daripada progres yang tersimpan di checklist komponen itu.$t$,
  $t$HP operator memakai versi aplikasi lama yang belum dimuat ulang, sehingga jalur simpan hanya menulis sebagian data. Contoh 10 Okt (panel 521 FS.30 PAINTING): catatan simpanan dan history 100%, checklist 0%. Bisa juga simpan checklist ditolak server setelah catatan simpanan sudah masuk (pola sebelum perbaikan 29 Sep 2026).$t$,
  $t$Pekerjaan yang sudah dilaporkan operator tidak terhitung: Raw Schedule, Outstanding dan generator FCS menganggap komponen belum dikerjakan, sehingga bisa dijadwalkan ulang.$t$,
  array[
    $t$Lihat panel, komponen, operator dan waktu di contoh baris.$t$,
    $t$Pastikan ke operator bahwa pekerjaan memang sudah sampai persen yang disimpan.$t$,
    $t$Minta SQL penyelarasan dengan dry-run dan rollback.$t$,
    $t$Minta operator itu memuat ulang aplikasi supaya memakai versi terbaru.$t$]),
 ('K13', 'Timer ditutup tanpa durasi', 'Timer',
  'Timer 7 hari terakhir yang ditutup paksa dengan durasi 0 menit.', 'harian', 1, null, 45,
  array['Operator'],
  $t$Timer operator dalam 7 hari terakhir yang ditutup dengan durasi 0 menit: oleh Force Stop admin, oleh server (timer lebih dari 12 jam tanpa simpanan progres), atau saat komponen selesai padahal timernya dari hari sebelumnya.$t$,
  $t$Operator tidak menekan Selesai saat berhenti bekerja (pulang, pindah komponen, HP mati), sehingga timer tertinggal sampai ditutup paksa.$t$,
  $t$Jam kerja operator itu tidak tercatat (0 menit) di Tracking Pekerja dan ringkasan Manajemen WO, sehingga jam kerja dan beban per komponen terlihat lebih kecil dari kenyataan.$t$,
  array[
    $t$Lihat operator yang paling sering muncul di contoh baris.$t$,
    $t$Ingatkan operator tersebut menekan Selesai setiap berhenti bekerja.$t$,
    $t$Kalau jam kerjanya perlu dicatat, minta koreksi waktu selesai timer lewat SQL (id timer ada di contoh baris).$t$])
on conflict (kode) do update set nama = excluded.nama, kategori = excluded.kategori, penjelasan = excluded.penjelasan,
  frekuensi = excluded.frekuensi, ambang_peringatan = excluded.ambang_peringatan, ambang_kritis = excluded.ambang_kritis,
  urutan = excluded.urutan, aplikasi = excluded.aplikasi, apa_terjadi = excluded.apa_terjadi, penyebab_umum = excluded.penyebab_umum,
  dampak_aplikasi = excluded.dampak_aplikasi, langkah = excluded.langkah;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K1' then $q$
   select p.id as panel_id, trim(p.nama) as panel, w.wo, w.proyek
   from public.panels p join public.work_orders w on w.id = p.wo_id
   where coalesce(w.is_archived, false) = false and w.deleted_at is null and p.deleted_at is null
     and exists (select 1 from public.raw_schedule r where r.wo_id = w.id and r.deleted_at is null)
     and not exists (select 1 from public.raw_schedule r where r.panel_id = p.id and r.deleted_at is null)
   order by w.wo, p.id $q$
 when 'K5' then $q$
   select tabel, jumlah, case when jumlah >= 1000 then 'kritis' else 'peringatan' end as tingkat from (values
     ('permintaan_item non-hutang (PermintaanView in ids)', (select count(*) from public.permintaan_item where coalesce(is_hutang, false) = false)),
     ('panel_seksi_archived per seksi (Pasang Komponen arsip)', (select coalesce(max(c), 0) from (select count(*) c from public.panel_seksi_archived group by seksi) s)),
     ('renhar per tanggal+divisi (Tugas Saya operator)', (select coalesce(max(c), 0) from (select count(*) c from public.renhar where deleted_at is null group by tanggal, divisi) s)),
     ('raw_schedule per proses (cek kapasitas fcsService)', (select coalesce(max(c), 0) from (select count(*) c from public.raw_schedule where deleted_at is null group by proses) s))
   ) t(tabel, jumlah) where jumlah > 800 order by jumlah desc $q$
 when 'K7' then $q$
   select * from (
     select 'raw_schedule tanpa panel' as jenis, r.id::text as ref, r.panel_id::text as info from public.raw_schedule r
       where r.deleted_at is null and not exists (select 1 from public.panels p where p.id = r.panel_id)
     union all select 'renhar tanpa raw_schedule', h.id::text, h.raw_id::text from public.renhar h
       where h.deleted_at is null and not exists (select 1 from public.raw_schedule r where r.id = h.raw_id)
     union all select 'timer tanpa panel (aktif/arsip)', t.id::text, t.panel_id::text from public.fcs_timer_kerja t
       where not exists (select 1 from public.panels p where p.id = t.panel_id) and not exists (select 1 from public.panels_archived a where a.id = t.panel_id)
     union all select 'CCP tanpa panel', c.id::text, c.panel_id::text from public.component_process_progress c
       where not exists (select 1 from public.panels p where p.id = c.panel_id)
     union all select 'permintaan tanpa panel & tanpa panel_id_arsip', m.id::text, m.wo_number from public.permintaan m
       where m.panel_id is null and m.panel_id_arsip is null
     union all select 'permintaan_item tanpa permintaan', i.id::text, i.permintaan_id::text from public.permintaan_item i
       where not exists (select 1 from public.permintaan m where m.id = i.permintaan_id)
     union all select distinct 'mapping proses utk kode yang tidak ada di BOM', b.kode_komponen, b.tipe_panel from public.bom_proses_relevan b
       where not exists (select 1 from public.bom_master m where m.kode_komponen = b.kode_komponen and m.tipe_panel = b.tipe_panel)
     union all select 'kode checklist (qty>0) tidak ada di BOM tipenya', p.id::text || ' ' || e.key, p.tipe from public.panels p
       cross join lateral jsonb_each(case when jsonb_typeof(p.checklist) = 'object' then p.checklist else '{}'::jsonb end) e
       where jsonb_typeof(e.value) = 'object' and coalesce(nullif(e.value->>'qty', '')::numeric, 0) > 0
         and e.key !~ '^(LINE|NETRAL|GROUND|H-BUS|INCOMING|OUTGOING|_)'
         and exists (select 1 from public.bom_master m where m.tipe_panel = p.tipe)
         and not exists (select 1 from public.bom_master m where m.tipe_panel = p.tipe and m.kode_komponen = e.key)
   ) s order by jenis, ref $q$
 when 'K8' then $q$
   select * from (
     select 'timer basi (tidak ditutup sejak hari sebelumnya)' as jenis, t.id as timer_id, k.nama as operator, t.panel_id, t.kode_komponen, t.proses, t.tahap, t.tanggal::text, t.mulai, null::numeric as jam
       from public.fcs_timer_kerja t left join public.pekerja k on k.id = t.pekerja_id
       where t.selesai is null and t.tanggal < (now() at time zone 'Asia/Jakarta')::date
     union all select 'timer > 12 jam (30 hari terakhir)', t.id, k.nama, t.panel_id, t.kode_komponen, t.proses, t.tahap, t.tanggal::text, t.mulai, round(t.durasi_menit / 60.0, 1)
       from public.fcs_timer_kerja t left join public.pekerja k on k.id = t.pekerja_id
       where t.durasi_menit > 720 and t.mulai > now() - interval '30 days'
     union all select 'timer aktif dobel', min(t.id), max(k.nama), t.panel_id, t.kode_komponen, t.proses, t.tahap, max(t.tanggal)::text, min(t.mulai), count(*)::numeric
       from public.fcs_timer_kerja t left join public.pekerja k on k.id = t.pekerja_id
       where t.selesai is null group by t.pekerja_id, t.panel_id, t.kode_komponen, t.proses, t.tahap having count(*) > 1
   ) s order by jenis, mulai $q$
 when 'K9' then $q$
   select c.panel_id, trim(p.nama) as panel, c.kode_komponen, c.proses, c.progress_pct as ccp,
          (p.checklist->c.kode_komponen->'progress'->>c.proses)::numeric as checklist, c.last_operator_nama, c.updated_at
   from public.component_process_progress c join public.panels p on p.id = c.panel_id
   where coalesce(c.tahap_key, '') = ''
     and (p.checklist->c.kode_komponen->'progress'->>c.proses) ~ '^[0-9]+(\.[0-9]+)?$'
     and round((p.checklist->c.kode_komponen->'progress'->>c.proses)::numeric) <> round(c.progress_pct)
   order by c.panel_id, c.kode_komponen $q$
 when 'K10' then $q$
   select * from (
     select 'gambar WO tanpa panel' as jenis, w.id::text as ref, wo.wo as info from public.work_instructions w left join public.work_orders wo on wo.id = w.wo_id
       where w.panel_id is null
     union all select 'WO aktif tanpa panel', wo.id::text, wo.wo || ' ' || wo.proyek from public.work_orders wo
       where coalesce(wo.is_archived, false) = false and wo.deleted_at is null and not exists (select 1 from public.panels p where p.wo_id = wo.id)
   ) s order by jenis, ref $q$
 when 'K11' then $q$
   select 'backup terakhir' as jenis, max(waktu) as waktu_terakhir,
          round(extract(epoch from (now() - max(waktu))) / 3600.0, 1) as jam_lalu
   from public.kesehatan_backup
   having max(waktu) is null or max(waktu) < now() - interval '30 hours' $q$
 when 'K12' then $q$
   with akhir as (
     select distinct on (c.panel_id, c.kode_komponen, c.proses)
            c.panel_id, c.kode_komponen, c.proses, c.checkpoint, c.pekerja_nama, c.ts::timestamptz as ts
     from public.progress_checkpoint_log c
     where c.ts::timestamptz > now() - interval '14 days'
     order by c.panel_id, c.kode_komponen, c.proses, c.ts::timestamptz desc, c.id desc
   )
   select trim(p.nama) as panel, a.panel_id, a.kode_komponen, a.proses, a.checkpoint as disimpan,
          (p.checklist->a.kode_komponen->'progress'->>a.proses)::numeric as checklist, a.pekerja_nama as operator, a.ts as waktu
   from akhir a join public.panels p on p.id = a.panel_id
   where (p.checklist->a.kode_komponen->'progress'->>a.proses) ~ '^[0-9]+(\.[0-9]+)?$'
     and a.checkpoint::numeric > (p.checklist->a.kode_komponen->'progress'->>a.proses)::numeric + 0.5
   order by a.ts desc $q$
 when 'K13' then $q$
   select k.nama as operator, t.proses, t.tahap, t.kode_komponen, t.panel_id, t.mulai, t.id as timer_id
   from public.fcs_timer_kerja t left join public.pekerja k on k.id = t.pekerja_id
   where t.selesai = t.mulai and t.mulai > now() - interval '7 days'
   order by t.mulai desc $q$
end
$f$;

commit;

-- sesudahnya: Kesehatan Data > "Jalankan cek sekarang" (K12 & K13 muncul).
