-- ============================================================================================
-- SIMPAN SAAT KONEKSI PUTUS (16 Okt 2026, investigasi gagal simpan SISWOYO 16 Okt 10.43 - disetujui user)
-- (1) progress_checkpoint_log.kunci_simpan (uuid, unik) - aplikasi operator membuat 1 kunci per baris SEBELUM retry,
--     sehingga percobaan ulang di sinyal putus-sambung tidak lagi membuat baris dobel (kasus nyata: 3 baris STEL FS.13
--     panel 544 dalam 60 ms). Baris lama: kunci_simpan NULL (indeks unik parsial, tidak terpengaruh).
--     Kolom yang SAMA ditambahkan ke progress_checkpoint_log_archived (aturan B.4: RPC arsip panel menyalin kolom dari
--     tabel sumber - 3 insiden sebelumnya karena kolom arsip tertinggal).
-- (2) Kesehatan Data K14 "Gagal simpan berulang (operator)": log_error_app vista-pekerja jenis gagal_simpan/upload 24 jam,
--     per operator + panel + komponen + proses, >= 3 kejadian. Kolom jenis: "tersimpan kemudian" / "BELUM terlihat
--     tersimpan" (dibanding catatan simpanan sejak 1 menit sebelum kejadian pertama).
--     Fungsi _sql_cek_kesehatan diganti: K1-K13 TIDAK berubah, hanya ditambah cabang K14.
-- Rollback: supabase/rollback/20261016030000_simpan_koneksi_rollback.sql
-- ============================================================================================
begin;

alter table public.progress_checkpoint_log add column if not exists kunci_simpan text;
alter table public.progress_checkpoint_log_archived add column if not exists kunci_simpan text;
create unique index if not exists progress_checkpoint_log_kunci_simpan_key
  on public.progress_checkpoint_log (kunci_simpan) where kunci_simpan is not null;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K14', 'Gagal simpan berulang (operator)', 'Progres',
  'Operator gagal menyimpan komponen yang sama 3 kali atau lebih dalam 24 jam.', 'per_jam', 1, null, 57,
  array['Operator'],
  $t$Operator gagal menyimpan (progres, timer, atau upload foto) untuk komponen yang sama 3 kali atau lebih dalam 24 jam terakhir. Kolom "Jenis" menunjukkan apakah sesudahnya ada simpanan yang berhasil.$t$,
  $t$Hampir selalu sinyal HP operator putus-sambung (pesan "Failed to fetch", jenis koneksi). Contoh 16 Okt 10.43: SISWOYO menekan Kunci Progress STEL FS.13 tiga kali saat sinyal lemah, lalu tersimpan saat sinyal kembali. Kalau jenisnya penolakan server (ada kode error), penyebabnya data/aturan, bukan sinyal.$t$,
  $t$Selama gagal, angka hanya ada di layar HP operator. Kalau aplikasi ditutup sebelum berhasil terkirim, progres itu hilang dan komponen terlihat belum dikerjakan di Raw Schedule, Outstanding dan Rencana Harian.$t$,
  array[
    $t$Lihat kolom Jenis. "tersimpan kemudian" = aman, tidak perlu tindakan.$t$,
    $t$"BELUM terlihat tersimpan": hubungi operator, minta isi ulang progres komponen itu saat sinyal ada.$t$,
    $t$Kalau satu operator/lokasi sering muncul, periksa sinyal di area kerjanya (WiFi/titik akses).$t$])
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
 when 'K14' then $q$
   select e.pengguna as operator, e.konteks->>'proses' as proses, e.konteks->>'tahap' as tahap, e.konteks->>'kode' as kode_komponen,
          (e.konteks->>'panelId')::bigint as panel_id, sum(e.jumlah)::int as jumlah, min(e.waktu_pertama) as mulai, max(e.waktu_terakhir) as waktu,
          string_agg(distinct left(e.pesan, 90), ' | ') as info,
          case when e.konteks->>'kode' is null or e.konteks->>'proses' is null then 'tidak diketahui (log lama tanpa data panel)'
               when exists (select 1 from public.progress_checkpoint_log c
                             where c.panel_id = (e.konteks->>'panelId')::bigint and c.kode_komponen = e.konteks->>'kode'
                               and c.proses = e.konteks->>'proses' and c.ts::timestamptz >= min(e.waktu_pertama) - interval '1 minute')
                 then 'tersimpan kemudian'
               else 'BELUM terlihat tersimpan' end as jenis
   from public.log_error_app e
   where e.aplikasi = 'vista-pekerja' and e.jenis in ('gagal_simpan', 'upload') and e.waktu_terakhir > now() - interval '24 hours'
   group by e.pengguna, e.konteks->>'panelId', e.konteks->>'kode', e.konteks->>'proses', e.konteks->>'tahap'
   having sum(e.jumlah) >= 3
   order by max(e.waktu_terakhir) desc $q$
end
$f$;

commit;
