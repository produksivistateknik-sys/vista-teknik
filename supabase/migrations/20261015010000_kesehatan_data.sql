-- ============================================================================================
-- KESEHATAN DATA - MVP tahap 1 (15 Okt 2026, persetujuan user)
-- 1) kesehatan_cek     : daftar cek (metadata, ambang, frekuensi)
-- 2) kesehatan_hasil   : hasil tiap eksekusi (jumlah, status, sampel <= 50 baris, durasi)
-- 3) kesehatan_backup  : catatan backup harian (ditulis workflow GitHub backup-database) utk cek K11
-- 4) log_error_app     : error aplikasi terpusat (ditulis lewat RPC catat_error_app, dedupe per sidik)
-- 5) jalankan_cek_kesehatan(frekuensi) : SEMUA query cek BACA SAJA, tiap cek dibatasi waktunya &
--    kegagalan satu cek tidak membatalkan cek lain (status 'error').
-- 6) pg_cron: per jam (K1, K8) & harian 05:30 WIB (semua) + pembersihan (hasil 90 hari, error 30 hari).
-- Tidak mengubah tabel produksi mana pun. Rollback: supabase/rollback/20261015010000_kesehatan_data_rollback.sql
-- ============================================================================================
begin;

create table if not exists public.kesehatan_cek (
  kode text primary key,
  nama text not null,
  kategori text not null,
  penjelasan text,
  frekuensi text not null default 'harian' check (frekuensi in ('per_jam', 'harian')),
  ambang_peringatan int not null default 1,   -- jumlah >= ini -> peringatan
  ambang_kritis int,                          -- jumlah >= ini -> kritis (null = tidak pernah kritis)
  aktif boolean not null default true,
  urutan int not null default 0
);

create table if not exists public.kesehatan_hasil (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  kode text not null references public.kesehatan_cek(kode) on delete cascade,
  waktu timestamptz not null default now(),
  jumlah int,
  status text not null check (status in ('ok', 'info', 'peringatan', 'kritis', 'error')),
  sampel jsonb not null default '[]'::jsonb,
  pesan_error text,
  durasi_ms int
);
create index if not exists idx_kesehatan_hasil_kode_waktu on public.kesehatan_hasil (kode, waktu desc);

create table if not exists public.kesehatan_backup (
  id bigint generated always as identity primary key,
  waktu timestamptz not null default now(),
  file text,
  ukuran_byte bigint,
  sumber text default 'github-actions'
);

create table if not exists public.log_error_app (
  id bigint generated always as identity primary key,
  waktu_pertama timestamptz not null default now(),
  waktu_terakhir timestamptz not null default now(),
  jumlah int not null default 1,
  aplikasi text not null,              -- 'vista-teknik' | 'vista-pekerja'
  versi text,                          -- __BUILD_ID__
  jenis text not null,                 -- crash | chunk | unhandled | window_error | supabase_error | gagal_simpan | console_error
  sidik text not null,                 -- hash pesan + lokasi (dedupe)
  pesan text not null,
  halaman text,
  pengguna text,
  konteks jsonb not null default '{}'::jsonb
);
create index if not exists idx_log_error_sidik on public.log_error_app (sidik, waktu_terakhir desc);
create index if not exists idx_log_error_waktu on public.log_error_app (waktu_terakhir desc);

-- RLS: baca boleh (halaman Admin pakai anon key), tulis HANYA lewat fungsi SECURITY DEFINER di bawah.
alter table public.kesehatan_cek enable row level security;
alter table public.kesehatan_hasil enable row level security;
alter table public.kesehatan_backup enable row level security;
alter table public.log_error_app enable row level security;
drop policy if exists baca_kesehatan_cek on public.kesehatan_cek;
create policy baca_kesehatan_cek on public.kesehatan_cek for select to anon, authenticated using (true);
drop policy if exists baca_kesehatan_hasil on public.kesehatan_hasil;
create policy baca_kesehatan_hasil on public.kesehatan_hasil for select to anon, authenticated using (true);
drop policy if exists baca_kesehatan_backup on public.kesehatan_backup;
create policy baca_kesehatan_backup on public.kesehatan_backup for select to anon, authenticated using (true);
drop policy if exists baca_log_error_app on public.log_error_app;
create policy baca_log_error_app on public.log_error_app for select to anon, authenticated using (true);

-- ── daftar cek ─────────────────────────────────────────────────────────────────────────────
insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan) values
 ('K1',  'Panel aktif tanpa jadwal', 'Jadwal', 'Panel di WO aktif yang SUDAH di-FCS (WO punya raw_schedule) tapi panel ini tidak punya baris raw_schedule sama sekali. Kelas insiden hapus panel WO 076/521 (10 Okt).', 'per_jam', 1, 1, 10),
 ('K5',  'Tabel mendekati batas 1000 baris', 'Query', 'Kelompok data yang masih dibaca sebagian aplikasi tanpa paginasi. >800 = peringatan, >=1000 = kritis (bisa terpotong diam-diam). Insiden OU_FS.1 (15 Okt).', 'harian', 1, null, 20),
 ('K7',  'Data yatim / referensi putus', 'Integritas', 'Jadwal/renhar/timer/CCP/permintaan/item yang induknya tidak ada; mapping proses utk kode yang tidak ada di BOM; kode checklist (qty>0) yang tidak ada di BOM tipenya.', 'harian', 1, null, 30),
 ('K8',  'Timer tidak wajar', 'Timer', 'Timer tidak ditutup sejak hari sebelumnya (basi), timer >12 jam, dan timer aktif dobel (operator+komponen+proses sama). Memengaruhi durasi/jam kerja di Tracking Pekerja & Manajemen WO.', 'per_jam', 1, null, 40),
 ('K9',  'Progres CCP berbeda dengan checklist', 'Progres', 'component_process_progress berbeda dgn panels.checklist utk proses non-tahap. Halaman yang membaca CCP dan yang membaca checklist menampilkan angka berbeda.', 'harian', 1, null, 50),
 ('K10', 'Gambar WO tanpa panel / WO kosong', 'Integritas', 'Info: dokumen gambar WO Digital yang panel_id-nya kosong (panel diarsip/dihapus) dan WO aktif tanpa panel.', 'harian', 1000000, null, 60),
 ('K11', 'Backup database harian', 'Operasional', 'Backup terakhir (dicatat workflow GitHub) lebih dari 30 jam lalu atau belum pernah tercatat.', 'harian', 1, 1, 70)
on conflict (kode) do update set nama = excluded.nama, kategori = excluded.kategori, penjelasan = excluded.penjelasan,
  frekuensi = excluded.frekuensi, ambang_peringatan = excluded.ambang_peringatan, ambang_kritis = excluded.ambang_kritis, urutan = excluded.urutan;

-- ── query tiap cek (BACA SAJA). Tiap query mengembalikan baris temuan; jumlah = jumlah baris. ──
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
     ('bom_proses_relevan (vista-pekerja Pasang Komponen, sampai rilis paginasi)', (select count(*) from public.bom_proses_relevan)),
     ('bom_master (vista-pekerja, sampai rilis paginasi)', (select count(*) from public.bom_master)),
     ('permintaan per jenis (vista-pekerja Gudang, sampai rilis paginasi)', (select coalesce(max(c), 0) from (select count(*) c from public.permintaan group by jenis) s)),
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
end
$f$;

-- ── eksekutor ─────────────────────────────────────────────────────────────────────────────
create or replace function public.jalankan_cek_kesehatan(p_frekuensi text default 'semua')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_run uuid := gen_random_uuid(); v_cek record; v_sql text; v_jumlah int; v_sampel jsonb; v_mulai timestamptz;
  v_status text; v_ringkas jsonb := '[]'::jsonb;
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
      execute 'with q as (' || v_sql || ') select (select count(*) from q)::int, (select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from (select * from q limit 50) s)'
        into v_jumlah, v_sampel;
      v_status := case when v_cek.ambang_kritis is not null and v_jumlah >= v_cek.ambang_kritis then 'kritis'
                       when v_jumlah >= v_cek.ambang_peringatan then 'peringatan'
                       when v_cek.kode = 'K10' and v_jumlah > 0 then 'info'
                       else 'ok' end;
      -- K5: tingkat kritis ditentukan per baris (>=1000)
      if v_cek.kode = 'K5' and exists (select 1 from jsonb_array_elements(v_sampel) e where e->>'tingkat' = 'kritis') then v_status := 'kritis'; end if;
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

-- ── pencatat error terpusat ─────────────────────────────────────────────────────────────────
-- p_batch: [{aplikasi, versi, jenis, sidik, pesan, halaman, pengguna, konteks, jumlah}] maks 50 item.
-- Sidik sama dalam 1 jam terakhir -> jumlah ditambah (bukan baris baru). Teks dipotong.
create or replace function public.catat_error_app(p_batch jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_n int := 0; v_id bigint;
begin
  if jsonb_typeof(p_batch) <> 'array' then return 0; end if;
  -- batas server: maks 300 baris/kejadian baru per menit utk seluruh aplikasi (jaring pengaman banjir error)
  if (select count(*) from public.log_error_app where waktu_terakhir > now() - interval '1 minute') > 300 then return 0; end if;
  for v_item in select * from jsonb_array_elements(p_batch) limit 50 loop
    continue when coalesce(v_item->>'sidik', '') = '' or coalesce(v_item->>'pesan', '') = '';
    select id into v_id from public.log_error_app
      where sidik = left(v_item->>'sidik', 64) and waktu_terakhir > now() - interval '1 hour'
      order by waktu_terakhir desc limit 1;
    if found then
      update public.log_error_app set jumlah = jumlah + greatest(1, least(coalesce((v_item->>'jumlah')::int, 1), 1000)),
        waktu_terakhir = now(), versi = coalesce(left(v_item->>'versi', 40), versi) where id = v_id;
    else
      insert into public.log_error_app (aplikasi, versi, jenis, sidik, pesan, halaman, pengguna, konteks, jumlah)
      values (left(coalesce(v_item->>'aplikasi', '?'), 30), left(v_item->>'versi', 40), left(coalesce(v_item->>'jenis', 'lain'), 30),
              left(v_item->>'sidik', 64), left(v_item->>'pesan', 1000), left(v_item->>'halaman', 200), left(v_item->>'pengguna', 100),
              case when jsonb_typeof(v_item->'konteks') = 'object' and length((v_item->'konteks')::text) < 4000 then v_item->'konteks' else '{}'::jsonb end,
              greatest(1, least(coalesce((v_item->>'jumlah')::int, 1), 1000)));
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
grant execute on function public.catat_error_app(jsonb) to anon, authenticated;

-- ── jadwal (pg_cron, waktu UTC) ─────────────────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('kesehatan-per-jam', 'kesehatan-harian', 'kesehatan-bersih');
end $$;
select cron.schedule('kesehatan-per-jam', '7 * * * *', $c$select public.jalankan_cek_kesehatan('per_jam')$c$);
select cron.schedule('kesehatan-harian', '30 22 * * *', $c$select public.jalankan_cek_kesehatan('semua')$c$);       -- 05:30 WIB
select cron.schedule('kesehatan-bersih', '45 22 * * *', $c$delete from public.kesehatan_hasil where waktu < now() - interval '90 days'; delete from public.log_error_app where waktu_terakhir < now() - interval '30 days'$c$);

commit;

-- eksekusi pertama (boleh dijalankan terpisah): select public.jalankan_cek_kesehatan('semua');
