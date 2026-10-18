-- ============================================================================================
-- KESEHATAN DATA K15 "Permintaan tanpa item" + PENANDAAN UMUM (18 Okt 2026, disetujui user: opsi C + tambahan)
-- (1) Tabel kesehatan_temuan_diketahui - SATU mekanisme penandaan (temuan per baris sekarang; tunda cek & status
--     kelompok error nanti dipindah ke sini, tabel lama tidak diubah). Catatan wajib.
-- (2) RPC tandai_kesehatan / buka_tanda_kesehatan (SECURITY DEFINER, dicatat activity_log).
-- (3) _sql_cek_kesehatan: K1-K14 IDENTIK dgn 20261018010000, ditambah cabang K15.
-- (4) jalankan_cek_kesehatan: (a) baris yang punya kolom `ref` & sudah ditandai dikecualikan, (b) aturan "ada baris
--     tingkat=kritis -> cek kritis" yang dulu khusus K5 kini berlaku umum (dicek di seluruh hasil, bukan 50 sampel).
--     Di K1-K14 hanya K5 yang punya kolom tingkat & belum ada tanda -> hasil K1-K14 TIDAK berubah (dibuktikan di
--     verifikasi: runner lama vs baru pada data yang sama).
-- (5) Baris kesehatan_cek K15 (per jam, peringatan >=1, kritis per baris = dibuat 7 hari terakhir).
-- Dry-run   : supabase/verifikasi/20261018030000_kesehatan_k15_dryrun.sql (jalankan SEBELUM ini)
-- Verifikasi: supabase/verifikasi/20261018030000_kesehatan_k15_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261018030000_kesehatan_k15_rollback.sql
-- Tandai 9 permintaan lama: supabase/scripts/20261018_tandai_permintaan_tanpa_item_lama.sql (SESUDAH verifikasi)
-- ============================================================================================
begin;

-- ── (1) tabel penandaan UMUM ───────────────────────────────────────────────────────────────
-- Satu mekanisme untuk menandai sesuatu di Kesehatan Data (keputusan user 18 Okt: jangan buat mekanisme kedua):
--   sasaran 'temuan'         : 1 baris hasil cek (kode cek + ref baris)       -> status diketahui / diabaikan   [DIPAKAI SEKARANG]
--   sasaran 'cek'            : 1 cek utuh (kode cek, ref null)                 -> status tunda (sampai)          [nanti: pengganti kesehatan_tunda_cek]
--   sasaran 'kelompok_error' : 1 kelompok error (kode null, ref = sidik)       -> status selesai/diabaikan/tunda [nanti: pengganti kesehatan_status_error]
-- Tabel lama (kesehatan_tunda_cek, kesehatan_status_error) TIDAK diubah di migration ini; pemindahannya = tahap terpisah.
-- Catatan WAJIB (min 3 huruf). Riwayat tidak dihapus: "buka lagi" = aktif false + siapa/kapan/alasan.
create table if not exists public.kesehatan_temuan_diketahui (
  id bigint generated always as identity primary key,
  sasaran text not null check (sasaran in ('temuan', 'cek', 'kelompok_error')),
  kode text,
  ref text,
  status text not null check (status in ('diketahui', 'diabaikan', 'selesai', 'tunda')),
  sampai timestamptz,
  catatan text not null check (length(btrim(catatan)) >= 3),
  oleh text not null check (length(btrim(oleh)) >= 1),
  dibuat_pada timestamptz not null default now(),
  aktif boolean not null default true,
  dibuka_oleh text,
  dibuka_pada timestamptz,
  catatan_buka text,
  check (sasaran <> 'temuan' or (kode is not null and ref is not null)),
  check (status <> 'tunda' or sampai is not null)
);
create unique index if not exists uq_kesehatan_temuan_diketahui_aktif
  on public.kesehatan_temuan_diketahui (sasaran, coalesce(kode, ''), coalesce(ref, '')) where aktif;
alter table public.kesehatan_temuan_diketahui enable row level security;
drop policy if exists baca_kesehatan_temuan_diketahui on public.kesehatan_temuan_diketahui;
create policy baca_kesehatan_temuan_diketahui on public.kesehatan_temuan_diketahui for select to anon, authenticated using (true);

-- ── (2) RPC tandai / buka lagi (SATU-SATUNYA pintu tulis) ───────────────────────────────────
create or replace function public.tandai_kesehatan(p_sasaran text, p_kode text, p_ref text, p_status text, p_catatan text, p_oleh text, p_sampai timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_sasaran <> 'temuan' then
    raise exception 'sasaran % belum dipakai (tahap pemindahan tunda/status error terpisah)', p_sasaran using errcode = '22023';
  end if;
  if p_status not in ('diketahui', 'diabaikan') then raise exception 'status temuan harus diketahui/diabaikan' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_catatan)), 0) < 3 then raise exception 'catatan wajib diisi (min 3 huruf)' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'nama penanda wajib' using errcode = '22023'; end if;
  if not exists (select 1 from public.kesehatan_cek where kode = p_kode) then raise exception 'cek % tidak ada', p_kode using errcode = '22023'; end if;
  if coalesce(btrim(p_ref), '') = '' then raise exception 'ref temuan wajib' using errcode = '22023'; end if;
  if exists (select 1 from public.kesehatan_temuan_diketahui where aktif and sasaran = p_sasaran and kode = p_kode and ref = p_ref) then
    raise exception 'temuan % % sudah ditandai', p_kode, p_ref using errcode = '23505';
  end if;
  insert into public.kesehatan_temuan_diketahui (sasaran, kode, ref, status, sampai, catatan, oleh)
  values (p_sasaran, p_kode, p_ref, p_status, p_sampai, btrim(p_catatan), btrim(p_oleh)) returning id into v_id;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (btrim(p_oleh), 'TANDAI KESEHATAN', format('%s %s ref %s ditandai %s: %s', p_sasaran, p_kode, p_ref, p_status, btrim(p_catatan)), 'kesehatan', 'Kesehatan Data');
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.buka_tanda_kesehatan(p_id bigint, p_catatan text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_t record;
begin
  if coalesce(length(btrim(p_catatan)), 0) < 3 then raise exception 'alasan buka lagi wajib diisi (min 3 huruf)' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'nama wajib' using errcode = '22023'; end if;
  update public.kesehatan_temuan_diketahui set aktif = false, dibuka_oleh = btrim(p_oleh), dibuka_pada = now(), catatan_buka = btrim(p_catatan)
  where id = p_id and aktif returning * into v_t;
  if not found then raise exception 'tanda % tidak ada / sudah dibuka', p_id using errcode = '22023'; end if;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (btrim(p_oleh), 'BUKA TANDA KESEHATAN', format('%s %s ref %s dibuka lagi: %s', v_t.sasaran, v_t.kode, v_t.ref, btrim(p_catatan)), 'kesehatan', 'Kesehatan Data');
  return jsonb_build_object('id', p_id);
end $$;

revoke all on function public.tandai_kesehatan(text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.buka_tanda_kesehatan(bigint, text, text) from public;
grant execute on function public.tandai_kesehatan(text, text, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.buka_tanda_kesehatan(bigint, text, text) to anon, authenticated;

-- ── (3) query cek: K1-K14 identik dgn 20261018010000, + K15 ───────────────────────────────────
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
     ('permintaan_item per hari+jenis+divisi (Riwayat Permintaan operator)', (select coalesce(max(c), 0) from (
        select count(*) c from public.permintaan m join public.permintaan_item i on i.permintaan_id = m.id
        where coalesce(i.is_hutang, false) = false
        group by m.jenis, m.divisi, (m.created_at at time zone 'UTC')::date) s)),
     ('id permintaan per divisi di daftar Hutang operator (.in dipecah per 200)', (select coalesce(max(c), 0) from (
        select count(*) c from public.permintaan group by divisi) s)),
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
   with g as (
     select e.pengguna as operator, e.konteks->>'proses' as proses, e.konteks->>'tahap' as tahap, e.konteks->>'kode' as kode_komponen,
            nullif(e.konteks->>'panelId', '')::bigint as panel_id, sum(e.jumlah)::int as jumlah,
            min(e.waktu_pertama) as mulai, max(e.waktu_terakhir) as waktu, string_agg(distinct left(e.pesan, 90), ' | ') as info
     from public.log_error_app e
     where e.aplikasi = 'vista-pekerja' and e.jenis in ('gagal_simpan', 'upload') and e.waktu_terakhir > now() - interval '24 hours'
     group by 1, 2, 3, 4, 5
     having sum(e.jumlah) >= 3
   )
   select g.operator, g.proses, g.tahap, g.kode_komponen, g.panel_id, g.jumlah, g.mulai, g.waktu, g.info,
          case when g.kode_komponen is null or g.proses is null or g.panel_id is null then 'tidak diketahui (log lama tanpa data panel)'
               when exists (select 1 from public.progress_checkpoint_log c
                            where c.panel_id = g.panel_id and c.kode_komponen = g.kode_komponen and c.proses = g.proses
                              and c.ts::timestamptz >= g.mulai - interval '1 minute')
                 then 'tersimpan kemudian'
               else 'BELUM terlihat tersimpan' end as jenis
   from g
   order by g.waktu desc $q$
 when 'K15' then $q$
   select m.id::text as ref, m.id as permintaan, m.jenis, m.divisi, m.operator_nama as operator, m.created_at as dibuat,
          coalesce(trim(p.nama), trim(pa.nama), m.panel_nama) as panel, coalesce(w.wo, m.wo_number) as wo, coalesce(w.proyek, m.proyek) as proyek,
          case when m.created_at < timestamptz '2026-10-12 00:00:00+07' then 'data hilang, alur arsip lama'
               else 'rincian tidak tersimpan saat dikirim' end as penyebab,
          case when m.created_at > now() - interval '7 days' then 'kritis' else 'peringatan' end as tingkat
   from public.permintaan m
   left join public.panels p on p.id = m.panel_id
   left join public.panels_archived pa on pa.id = m.panel_id_arsip
   left join public.work_orders w on w.id = coalesce(p.wo_id, pa.wo_id, m.wo_id)
   where m.created_at < now() - interval '10 minutes'
     and not exists (select 1 from public.permintaan_item i where i.permintaan_id = m.id)
   order by (m.created_at > now() - interval '7 days') desc, m.id $q$
end
$f$;

-- ── (4) penjalan cek ────────────────────────────────────────────────────────────────────────
create or replace function public.jalankan_cek_kesehatan(p_frekuensi text default 'semua')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_run uuid := gen_random_uuid(); v_cek record; v_sql text; v_jumlah int; v_sampel jsonb; v_mulai timestamptz;
  v_status text; v_ringkas jsonb := '[]'::jsonb; v_ada_kritis boolean;
begin
  -- dipanggil dari halaman Admin juga: cegah dijalankan beruntun (maks 1x per menit)
  if p_frekuensi = 'manual' and exists (select 1 from public.kesehatan_hasil where waktu > now() - interval '1 minute') then
    raise exception 'Cek baru saja dijalankan, tunggu 1 menit.' using errcode = 'P0001';
  end if;
  perform set_config('statement_timeout', '20000', true);
  for v_cek in select * from public.kesehatan_cek where aktif
      and (p_frekuensi in ('semua', 'manual') or frekuensi = p_frekuensi) order by urutan loop
    v_mulai := clock_timestamp();
    begin
      v_sql := public._sql_cek_kesehatan(v_cek.kode);
      if v_sql is null then raise exception 'query cek % belum didefinisikan', v_cek.kode; end if;
      -- (sengaja konkatenasi, bukan format(): query cek boleh berisi tanda %)
      -- (18 Okt 2026) baris yang punya kolom `ref` & sudah ditandai di kesehatan_temuan_diketahui (sasaran 'temuan',
      -- aktif) DIKECUALIKAN. Cek tanpa kolom ref / tanpa tanda -> hasil persis sama dgn versi 15 Okt.
      execute 'with q0 as (' || v_sql || '), q as (select * from q0 where not exists (select 1 from public.kesehatan_temuan_diketahui d'
        || ' where d.aktif and d.sasaran = ''temuan'' and d.kode = $1 and d.ref = to_jsonb(q0) ->> ''ref''))'
        || ' select (select count(*) from q)::int, (select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from (select * from q limit 50) s),'
        || ' exists (select 1 from q where to_jsonb(q) ->> ''tingkat'' = ''kritis'')'
        into v_jumlah, v_sampel, v_ada_kritis using v_cek.kode;
      v_status := case when v_cek.ambang_kritis is not null and v_jumlah >= v_cek.ambang_kritis then 'kritis'
                       when v_jumlah >= v_cek.ambang_peringatan then 'peringatan'
                       when v_cek.kode = 'K10' and v_jumlah > 0 then 'info'
                       else 'ok' end;
      -- tingkat kritis per baris (dulu khusus K5, sejak 18 Okt 2026 berlaku utk cek apa pun yg punya kolom tingkat;
      -- di K1-K14 hanya K5 yang punya kolom ini)
      if v_ada_kritis then v_status := 'kritis'; end if;
      insert into public.kesehatan_hasil (run_id, kode, jumlah, status, sampel, durasi_ms)
      values (v_run, v_cek.kode, v_jumlah, v_status, v_sampel, (extract(epoch from clock_timestamp() - v_mulai) * 1000)::int);
    exception when others then
      v_status := 'error'; v_jumlah := null;
      insert into public.kesehatan_hasil (run_id, kode, jumlah, status, pesan_error, durasi_ms)
      values (v_run, v_cek.kode, null, 'error', sqlerrm, (extract(epoch from clock_timestamp() - v_mulai) * 1000)::int);
    end;
    v_ringkas := v_ringkas || jsonb_build_object('kode', v_cek.kode, 'jumlah', v_jumlah, 'status', v_status);
  end loop;
  return jsonb_build_object('run_id', v_run, 'hasil', v_ringkas);
end $$;
grant execute on function public.jalankan_cek_kesehatan(text) to anon, authenticated;

-- ── (5) baris cek K15 ───────────────────────────────────────────────────────────────────────
insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K15', 'Permintaan tanpa item', 'Permintaan',
  'Permintaan barang yang tidak punya satu pun item (status apa pun), umur lebih dari 10 menit.', 'per_jam', 1, null, 58,
  array['Admin','Operator','Gudang'],
  $t$Ada permintaan barang (BBMB/BBMU) yang kepalanya tersimpan tapi tidak punya satu pun item. Di Rekap per Panel dan Riwayat permintaan ini tampil sebagai "Permintaan tanpa rincian". Tingkat Kritis kalau ada yang dibuat dalam 7 hari terakhir (alur aktif sedang kehilangan rincian), Peringatan kalau lebih lama.$t$,
  $t$Sebelum 12 Okt 2026: alur Arsip Panel lama menghapus item lalu gagal menghapus kepala (kasus #51-59, 3 Sep, panel diarsip 28 Sep). Sesudah 12 Okt: simpan item gagal saat operator mengirim permintaan (kepala sudah tersimpan duluan).$t$,
  $t$Barang yang diminta tidak bisa dilihat & tidak ikut terhitung di Rekap per Panel. Gudang tidak tahu apa yang diminta.$t$,
  array[
    $t$Lihat nomor permintaan & panel di contoh baris.$t$,
    $t$Kalau baru (Kritis): tanyakan operator apa yang diminta, cek log Kesehatan Data jenis gagal_simpan di jam yang sama, lalu minta operator mengirim ulang.$t$,
    $t$Kalau lama dan isinya memang tidak bisa dipulihkan: tekan "Tandai diketahui" dengan catatan, supaya tidak muncul terus.$t$])
on conflict (kode) do nothing;

commit;
