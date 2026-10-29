-- ============================================================================================
-- INVENTARIS & MAINTENANCE - T1 (skema + RPC). DRAF 29 Okt 2026, disetujui user sebagai dasar (laporan Tahap 0).
-- Pengganti tab Maintenance lama (mesin / maintenance_rutin / maintenance_rutin_log / maintenance_log) dan halaman QR
-- /mesin. Tabel lama TIDAK diubah / dihapus - tetap sumber sampai go-live (T2+T3 bersamaan), migrasi datanya lewat
-- inv_migrasi_data_lama() (idempoten via kolom *_lama, dijalankan ulang tepat sebelum go-live).
--
-- Aturan yang dijamin DATABASE (bukan aplikasi):
--   * Nomor inventaris VIT-<kode lokasi>-<urut 2 digit>: dibuat sekali oleh trigger dari penghitung per lokasi (baris
--     penghitung terkunci -> aman dari dua input bersamaan), UNIQUE, tidak bisa di-UPDATE. Lokasi tanpa nomor
--     (BELUM = Belum ditentukan, WR = Wiring belum dipecah) -> nomor kosong sampai lokasi pertama yang bernomor.
--     Nomor eksplisit hanya diterima dari inv_impor (file siap-impor).
--   * Setiap perubahan kondisi / lokasi / nomor / aktif dicatat PERMANEN di inv_log oleh trigger (siapa, kapan, dari->ke,
--     sumber operator/admin/otomatis/impor). inv_log tidak bisa di-UPDATE/DELETE/TRUNCATE.
--   * Riwayat (jadwal selesai, laporan, update laporan, media, barang, jadwal) tidak bisa DELETE - nonaktifkan.
--   * Tulis HANYA lewat RPC security definer (RLS: anon/authenticated cuma SELECT). Aplikasi tanpa Supabase Auth:
--     p_aktor = {"admin":"<username admins>"} atau {"pekerja_id":n,"divisi":"<kunci divisi>"} - divalidasi KONSISTENSINYA
--     (admin aktif ada; pekerja ada, tidak terhapus, divisinya sama, lokasi barang tampil untuk divisi itu), bukan
--     otorisasi sungguhan (konvensi sama Proyek Luar 20261025010000).
--   * Versi (optimistic lock): RPC ubah barang wajib kirim versi yang dibaca layar; beda -> ditolak "muat ulang".
--   * Kunci uuid anti-dobel (laporan & selesai jadwal): kirim ulang dengan kunci sama -> dikembalikan yang sudah ada.
--   * Laporan aktif -> kondisi Rusak (terkunci utk operator). Laporan ditutup & tidak ada laporan aktif lain ->
--     kondisi kembali "baik" (sumber otomatis). Menutup laporan wajib >=1 media 'sesudah'.
--   * Selesai jadwal: operator wajib >=1 media; admin boleh tanpa (tanpa_dokumentasi = true). Jatuh tempo berikutnya
--     dihitung di server (inv_jatuh_tempo_berikut, tanggal WIB) - satu sumber.
--   * Batas "Segera" = inv_pengaturan.batas_segera_hari (satu konstanta utk admin, operator, pengingat push).
--
-- Juga: cadangan permanen tabel lama (cadangan_*_20261030), cron maintenance-rutin-log-cleanup-harian DIMATIKAN
-- (riwayat harus permanen; JANGAN dihidupkan lagi), tabel baru masuk publikasi realtime.
-- Jalankan SEBELUMNYA: supabase/verifikasi/20261030010000_inventaris_t1_cek_cron.sql (baca saja).
-- Verifikasi: supabase/verifikasi/20261030010000_inventaris_t1_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261030010000_inventaris_t1_rollback.sql (hanya sebelum go-live)
-- ============================================================================================
begin;

-- ── 0. Cadangan permanen tabel lama + cron ───────────────────────────────────────────────────
create table public.cadangan_mesin_20261030 as select * from public.mesin;
create table public.cadangan_maintenance_rutin_20261030 as select * from public.maintenance_rutin;
create table public.cadangan_maintenance_rutin_log_20261030 as select * from public.maintenance_rutin_log;
create table public.cadangan_maintenance_log_20261030 as select * from public.maintenance_log;
-- command cron disimpan dengan header Authorization DISAMARKAN (jangan menyalin kunci ke tabel lain)
create table public.cadangan_cron_maintenance_20261030 as
  select jobid, jobname, schedule, active,
         regexp_replace(command, 'Bearer\s+[^''"]+', 'Bearer <DISAMARKAN>', 'g') as command_disamarkan
  from cron.job where jobname = 'maintenance-rutin-log-cleanup-harian';
do $$ declare t text; begin
  foreach t in array array['cadangan_mesin_20261030','cadangan_maintenance_rutin_20261030',
    'cadangan_maintenance_rutin_log_20261030','cadangan_maintenance_log_20261030','cadangan_cron_maintenance_20261030'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'maintenance-rutin-log-cleanup-harian';

-- ── 1. Tabel ─────────────────────────────────────────────────────────────────────────────────
create table public.inv_pengaturan (
  kunci text primary key,
  nilai jsonb not null,
  keterangan text
);
insert into public.inv_pengaturan values
  ('batas_segera_hari', '2', 'Jadwal "Segera" = jatuh tempo <= hari ini + N hari (admin, operator, pengingat push)');

create table public.inv_lokasi (
  kode text primary key,
  nama text not null unique,
  boleh_nomor boolean not null default true,     -- false: BELUM, WR -> nomor kosong
  tampil_operator boolean not null default false,
  divisi_operator text[] not null default '{}',  -- kunci DIVISI_CONFIG vista-pekerja
  urut int not null default 0,
  aktif boolean not null default true            -- false: tidak bisa dipilih utk barang baru / pindah
);
insert into public.inv_lokasi (kode, nama, boleh_nomor, tampil_operator, divisi_operator, urut, aktif) values
  ('MKN',  'Mekanik',              true,  true,  '{mekanik}',     10, true),
  ('PT',   'Painting',             true,  true,  '{painting}',    20, true),
  ('ASB',  'Assembly',             true,  true,  '{assembling}',  30, true),
  ('WR.P', 'Wiring Power',         true,  true,  '{wiring_pwr}',  40, true),
  ('WR.C', 'Wiring Control',       true,  true,  '{wiring_ctrl}', 50, true),
  ('QC',   'QC',                   true,  true,  '{qc}',          60, true),
  ('NP',   'Nameplate',            true,  true,  '{nameplate}',   70, true),
  ('WH',   'Warehouse',            true,  false, '{}',            80, true),
  ('KTR',  'Ruang Kantor Lt 2',    true,  false, '{}',            90, true),
  ('HR',   'Ruang HR',             true,  false, '{}',           100, true),
  ('RM',   'Ruang Meeting',        true,  false, '{}',           110, true),
  ('WS',   'Area Workshop',        true,  false, '{}',           120, true),
  ('PKR',  'Area Parkir',          true,  false, '{}',           130, true),
  ('LBY',  'Lobby',                true,  false, '{}',           140, true),
  ('WR',   'Wiring (belum dipecah)', false, false, '{}',         900, false),
  ('BELUM','Belum ditentukan',     false, false, '{}',           999, true);

create table public.inv_nomor_penghitung (
  kode_lokasi text primary key references public.inv_lokasi(kode),
  terakhir int not null default 0
);

create table public.inv_impor_batch (
  id uuid primary key,
  file_nama text,
  oleh text not null,
  ringkasan jsonb,
  dibuat_pada timestamptz not null default now()
);

create table public.inv_barang (
  id bigserial primary key,
  nama text not null,
  nomor_inventaris text unique,
  lokasi_kode text not null default 'BELUM' references public.inv_lokasi(kode),
  pengguna text,
  kondisi text not null default 'belum_dinilai'
    check (kondisi in ('baik','tidak_maksimal','perlu_maintenance','rusak','belum_dinilai')),
  detail_kondisi text,
  merk_spesifikasi text,
  nomor_seri text,
  tanggal_perolehan date,
  tanggal_perolehan_teks text,            -- teks asli Excel bila bukan tanggal baku
  pelapor text,                           -- otomatis (trigger) kecuali impor
  diperbarui_pada timestamptz,            -- otomatis (trigger) kecuali impor
  kode_lama text unique,                  -- MSN-001, NP-001, BAK-1 ... (diisi inv_migrasi_data_lama)
  mesin_id_lama bigint unique,            -- mesin.id lama (tanpa FK: tabel lama tidak diikat)
  aktif boolean not null default true,
  impor_kunci text unique,                -- GA:<baris Excel> / BARU:<kode>
  impor_batch uuid references public.inv_impor_batch(id),
  versi int not null default 1,
  dibuat_oleh text,
  dibuat_pada timestamptz not null default now()
);
create index inv_barang_lokasi on public.inv_barang (lokasi_kode);

create table public.inv_impor_cadangan (
  batch_id uuid not null references public.inv_impor_batch(id),
  baris int not null,
  data_asli jsonb not null,
  hasil jsonb,
  primary key (batch_id, baris)
);

create table public.inv_padanan_lama (
  mesin_id_lama bigint primary key,
  kode_lama text not null unique,
  impor_kunci text not null unique,
  nama_lama text not null,
  nama_baru text not null
);
-- Disetujui user (jawaban no. 2-3). MSN-003 (mesin 9) sengaja TIDAK dipetakan.
insert into public.inv_padanan_lama values
  (1,  'MSN-001', 'GA:3',       'MESIN POTONG PLAT - MANUAL',              'Mesin Potong Manual'),
  (2,  'MSN-002', 'GA:4',       'MESIN BENDING',                           'Mesin Bending'),
  (3,  'NP-001',  'GA:68',      'MESIN LASER NAMEPLATE BESAR (INNOVATEC)', 'Mesin Gravir besar'),
  (4,  'MSN-004', 'GA:25',      'OVEN & SPRAY GUN',                        'Oven'),
  (5,  'BAK-1',   'BARU:BAK-1', 'BAK DEGREASING',                          'BAK DEGREASING'),
  (6,  'BAK-2',   'BARU:BAK-2', 'BAK AIR',                                 'BAK AIR'),
  (7,  'BAK-3',   'BARU:BAK-3', 'BAK PHOSPHATING',                         'BAK PHOSPHATING'),
  (8,  'NP-002',  'GA:67',      'MESIN LASER NAMEPLATE KECIL (INNOVATEC)', 'Mesin Gravir kecil'),
  (10, 'MSN-005', 'GA:2',       'MESIN LASER - BAISON',                    'Mesin CNC Laser');

create table public.inv_jadwal (
  id bigserial primary key,
  barang_id bigint not null references public.inv_barang(id),
  jenis text not null,
  frekuensi text not null check (frekuensi in ('harian','mingguan','bulanan','3bulan','tahunan')),
  jatuh_tempo date,
  terakhir_dilakukan date,
  teknisi text,
  catatan text,
  aktif boolean not null default true,
  rutin_id_lama bigint unique,
  dibuat_oleh text,
  dibuat_pada timestamptz not null default now()
);
create index inv_jadwal_barang on public.inv_jadwal (barang_id);

create table public.inv_jadwal_selesai (
  id bigserial primary key,
  jadwal_id bigint not null references public.inv_jadwal(id),
  barang_id bigint not null references public.inv_barang(id),
  tanggal date not null,
  oleh text not null,
  pekerja_id bigint,
  sumber text not null check (sumber in ('operator','admin','qr_lama')),
  tanpa_dokumentasi boolean not null default false,
  catatan text,
  kunci uuid unique,
  rutin_log_id_lama bigint unique,
  dibuat_pada timestamptz not null default now()
);
create index inv_jadwal_selesai_jadwal on public.inv_jadwal_selesai (jadwal_id, tanggal desc);
create index inv_jadwal_selesai_barang on public.inv_jadwal_selesai (barang_id, tanggal desc);

create table public.inv_laporan (
  id bigserial primary key,
  barang_id bigint not null references public.inv_barang(id),
  judul text not null,
  masalah text,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  pelapor text not null,
  pelapor_pekerja_id bigint,
  sumber text not null check (sumber in ('operator','admin','lama')),
  teknisi text,
  perbaikan text,
  catatan_lama text,
  dibuat_pada timestamptz not null default now(),
  ditutup_pada timestamptz,
  ditutup_oleh text,
  kunci uuid unique,
  maintenance_log_id_lama bigint unique
);
create index inv_laporan_barang_aktif on public.inv_laporan (barang_id) where status <> 'closed';

create table public.inv_laporan_update (
  id bigserial primary key,
  laporan_id bigint not null references public.inv_laporan(id),
  waktu timestamptz not null default now(),
  oleh text not null,
  catatan text,
  status_dari text,
  status_ke text,
  urut_lama int,                          -- indeks update_harian lama (migrasi)
  unique (laporan_id, urut_lama)
);

create table public.inv_media (
  id bigserial primary key,
  tujuan text not null check (tujuan in ('barang','laporan','laporan_update','jadwal_selesai')),
  ref_id bigint not null,
  peran text not null check (peran in ('datasheet','sebelum','sesudah','update','selesai','lama')),
  url text not null unique,
  mime text,
  thumb text,
  oleh text,
  dibuat_pada timestamptz not null default now(),
  dihapus_pada timestamptz,               -- hapus lunak (hanya datasheet)
  dihapus_oleh text
);
create index inv_media_ref on public.inv_media (tujuan, ref_id);

create table public.inv_log (
  id bigserial primary key,
  barang_id bigint not null references public.inv_barang(id),
  waktu timestamptz not null default now(),
  jenis text not null check (jenis in ('kondisi','lokasi','nomor','aktif')),
  dari text,
  ke text,
  detail text,                            -- detail kondisi saat itu
  oleh text not null,
  sumber text not null check (sumber in ('operator','admin','otomatis','impor','sistem')),
  laporan_id bigint,
  keterangan text
);
create index inv_log_barang on public.inv_log (barang_id, waktu desc);

-- ── 2. Hak akses: baca saja, tulis lewat RPC ─────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['inv_pengaturan','inv_lokasi','inv_nomor_penghitung','inv_impor_batch','inv_barang',
    'inv_impor_cadangan','inv_padanan_lama','inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update',
    'inv_media','inv_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', 'baca_' || t, t);
  end loop;
end $$;
-- isi baris impor (data_asli) tidak perlu dibaca aplikasi
revoke select on public.inv_impor_cadangan from anon, authenticated;

-- ── 3. Fungsi bantu ──────────────────────────────────────────────────────────────────────────
create or replace function public.inv_hari_ini() returns date language sql stable as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

create or replace function public.inv_batas_segera() returns int language sql stable as $$
  select coalesce((select (nilai #>> '{}')::int from public.inv_pengaturan where kunci = 'batas_segera_hari'), 2)
$$;

create or replace function public.inv_jatuh_tempo_berikut(p_dari date, p_frekuensi text) returns date
language sql immutable as $$
  select case p_frekuensi
    when 'harian'   then p_dari + 1
    when 'mingguan' then p_dari + 7
    when 'bulanan'  then (p_dari + interval '1 month')::date
    when '3bulan'   then (p_dari + interval '3 months')::date
    when 'tahunan'  then (p_dari + interval '1 year')::date
  end
$$;

-- Identitas pemanggil (lihat header). Hasil: peran 'admin'|'operator', nama, pekerja_id, divisi.
create or replace function public.inv_aktor(p_aktor jsonb, out peran text, out nama text, out pekerja_id bigint, out divisi text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_aktor is null or jsonb_typeof(p_aktor) <> 'object' then
    raise exception 'Identitas pengguna tidak dikirim' using errcode = '28000';
  end if;
  if coalesce(p_aktor->>'admin', '') <> '' then
    select a.nama into nama from public.admins a
      where a.username = p_aktor->>'admin' and coalesce(a.is_active, true);
    if nama is null then raise exception 'Admin % tidak dikenal / nonaktif', p_aktor->>'admin' using errcode = '28000'; end if;
    peran := 'admin';
  elsif coalesce(p_aktor->>'pekerja_id', '') ~ '^[0-9]+$' and coalesce(p_aktor->>'divisi', '') <> '' then
    select p.nama, p.id, p.divisi into nama, pekerja_id, divisi from public.pekerja p
      where p.id = (p_aktor->>'pekerja_id')::bigint and p.deleted_at is null;
    if nama is null then raise exception 'Operator tidak dikenal / sudah dihapus' using errcode = '28000'; end if;
    if divisi is distinct from p_aktor->>'divisi' then
      raise exception 'Operator % bukan divisi %', nama, p_aktor->>'divisi' using errcode = '28000';
    end if;
    peran := 'operator';
  else
    raise exception 'Identitas pengguna tidak lengkap' using errcode = '28000';
  end if;
end $$;

create or replace function public.inv_operator_boleh(p_divisi text, p_lokasi text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.inv_lokasi l
                 where l.kode = p_lokasi and l.tampil_operator and p_divisi = any(l.divisi_operator))
$$;

-- Konteks utk trigger log (berlaku sampai akhir transaksi RPC).
create or replace function public.inv_konteks(p_oleh text, p_sumber text, p_keterangan text default null,
  p_laporan_id bigint default null, p_impor boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('inv.oleh', coalesce(p_oleh, ''), true);
  perform set_config('inv.sumber', coalesce(p_sumber, ''), true);
  perform set_config('inv.keterangan', coalesce(p_keterangan, ''), true);
  perform set_config('inv.laporan_id', coalesce(p_laporan_id::text, ''), true);
  perform set_config('inv.impor', case when p_impor then '1' else '' end, true);
end $$;

create or replace function public.inv_validasi_media(p_media jsonb) returns int language plpgsql immutable as $$
begin
  if p_media is null or p_media = 'null'::jsonb then return 0; end if;
  if jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > 20 then
    raise exception 'Media harus berupa daftar maksimal 20 file' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_media) f
             where jsonb_typeof(f) <> 'object' or coalesce(f->>'url', '') !~ '^https?://' or length(f->>'url') > 1000
                or length(coalesce(f->>'mime', '')) > 100 or length(coalesce(f->>'thumb', '')) > 1000) then
    raise exception 'Tiap media wajib objek dengan url http(s)' using errcode = '22023';
  end if;
  return jsonb_array_length(p_media);
end $$;

create or replace function public.inv_simpan_media(p_tujuan text, p_ref bigint, p_peran text, p_media jsonb, p_oleh text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if public.inv_validasi_media(p_media) = 0 then return 0; end if;
  insert into public.inv_media (tujuan, ref_id, peran, url, mime, thumb, oleh)
    select p_tujuan, p_ref, p_peran, f->>'url', nullif(f->>'mime', ''), nullif(f->>'thumb', ''), p_oleh
    from jsonb_array_elements(p_media) f
  on conflict (url) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 4. Trigger ───────────────────────────────────────────────────────────────────────────────
create or replace function public.inv_barang_sebelum() returns trigger language plpgsql as $$
declare
  v_impor boolean := coalesce(current_setting('inv.impor', true), '') = '1';
  v_oleh text := nullif(current_setting('inv.oleh', true), '');
  v_boleh boolean; v_urut int; v_awalan text; v_akhir text;
begin
  new.nama := btrim(coalesce(new.nama, ''));
  if new.nama = '' then raise exception 'Nama barang wajib diisi' using errcode = '22023'; end if;

  if tg_op = 'UPDATE' then
    if old.nomor_inventaris is not null and new.nomor_inventaris is distinct from old.nomor_inventaris then
      raise exception 'Nomor inventaris % tidak bisa diubah', old.nomor_inventaris using errcode = '22023';
    end if;
    if new.impor_kunci is distinct from old.impor_kunci or new.impor_batch is distinct from old.impor_batch then
      raise exception 'Kunci impor tidak bisa diubah' using errcode = '22023';
    end if;
    new.versi := old.versi + 1;
    if not v_impor and (new.kondisi is distinct from old.kondisi or new.detail_kondisi is distinct from old.detail_kondisi
                        or new.lokasi_kode is distinct from old.lokasi_kode) then
      new.pelapor := coalesce(v_oleh, new.pelapor);
      new.diperbarui_pada := now();
    end if;
  else
    new.versi := 1;
    if not v_impor then
      new.pelapor := coalesce(v_oleh, new.pelapor);
      new.diperbarui_pada := now();
    end if;
  end if;

  select l.boleh_nomor into v_boleh from public.inv_lokasi l where l.kode = new.lokasi_kode;
  if new.nomor_inventaris is not null and (tg_op = 'INSERT' or old.nomor_inventaris is null) then
    -- nomor eksplisit: hanya dari impor (file siap-impor), formatnya harus cocok dengan lokasi
    if not v_impor then raise exception 'Nomor inventaris dibuat otomatis oleh sistem' using errcode = '22023'; end if;
    if not coalesce(v_boleh, false) then
      raise exception 'Lokasi % tidak memakai nomor inventaris (%)', new.lokasi_kode, new.nomor_inventaris using errcode = '22023';
    end if;
    v_awalan := 'VIT-' || new.lokasi_kode || '-';
    v_akhir := substr(new.nomor_inventaris, length(v_awalan) + 1);
    if left(new.nomor_inventaris, length(v_awalan)) <> v_awalan or v_akhir !~ '^[0-9]{2,}$' then
      raise exception 'Format nomor % tidak cocok dengan lokasi % (harus %NN)', new.nomor_inventaris, new.lokasi_kode, v_awalan
        using errcode = '22023';
    end if;
    insert into public.inv_nomor_penghitung (kode_lokasi, terakhir) values (new.lokasi_kode, v_akhir::int)
      on conflict (kode_lokasi) do update set terakhir = greatest(public.inv_nomor_penghitung.terakhir, excluded.terakhir);
  elsif new.nomor_inventaris is null and coalesce(v_boleh, false) then
    -- baris penghitung dikunci oleh UPDATE ini sampai transaksi selesai -> input serempak antre, tidak kembar
    insert into public.inv_nomor_penghitung (kode_lokasi, terakhir) values (new.lokasi_kode, 1)
      on conflict (kode_lokasi) do update set terakhir = public.inv_nomor_penghitung.terakhir + 1
      returning terakhir into v_urut;
    new.nomor_inventaris := 'VIT-' || new.lokasi_kode || '-' || case when v_urut < 10 then '0' || v_urut else v_urut::text end;
  end if;
  return new;
end $$;

create or replace function public.inv_barang_catat() returns trigger language plpgsql as $$
declare
  v_oleh text := coalesce(nullif(current_setting('inv.oleh', true), ''), 'sistem');
  v_sumber text := coalesce(nullif(current_setting('inv.sumber', true), ''), 'sistem');
  v_ket text := nullif(current_setting('inv.keterangan', true), '');
  v_lap bigint := nullif(current_setting('inv.laporan_id', true), '')::bigint;
begin
  if tg_op = 'INSERT' then
    insert into public.inv_log (barang_id, jenis, dari, ke, detail, oleh, sumber, laporan_id, keterangan) values
      (new.id, 'kondisi', null, new.kondisi, new.detail_kondisi, v_oleh, v_sumber, v_lap, v_ket),
      (new.id, 'lokasi', null, new.lokasi_kode, null, v_oleh, v_sumber, v_lap, v_ket);
    if new.nomor_inventaris is not null then
      insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, laporan_id, keterangan)
        values (new.id, 'nomor', null, new.nomor_inventaris, v_oleh, v_sumber, v_lap, v_ket);
    end if;
  else
    if new.kondisi is distinct from old.kondisi or new.detail_kondisi is distinct from old.detail_kondisi then
      insert into public.inv_log (barang_id, jenis, dari, ke, detail, oleh, sumber, laporan_id, keterangan)
        values (new.id, 'kondisi', old.kondisi, new.kondisi, new.detail_kondisi, v_oleh, v_sumber, v_lap, v_ket);
    end if;
    if new.lokasi_kode is distinct from old.lokasi_kode then
      insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, laporan_id, keterangan)
        values (new.id, 'lokasi', old.lokasi_kode, new.lokasi_kode, v_oleh, v_sumber, v_lap, v_ket);
    end if;
    if new.nomor_inventaris is distinct from old.nomor_inventaris then
      insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, laporan_id, keterangan)
        values (new.id, 'nomor', old.nomor_inventaris, new.nomor_inventaris, v_oleh, v_sumber, v_lap, v_ket);
    end if;
    if new.aktif is distinct from old.aktif then
      insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, laporan_id, keterangan)
        values (new.id, 'aktif', old.aktif::text, new.aktif::text, v_oleh, v_sumber, v_lap, v_ket);
    end if;
  end if;
  return null;
end $$;

create trigger inv_barang_sebelum before insert or update on public.inv_barang
  for each row execute function public.inv_barang_sebelum();
create trigger inv_barang_catat after insert or update on public.inv_barang
  for each row execute function public.inv_barang_catat();

create or replace function public.inv_tolak_ubah() returns trigger language plpgsql as $$
begin
  raise exception '%: data permanen, % tidak diizinkan', tg_table_name, tg_op using errcode = '42501';
end $$;
create trigger inv_log_permanen before update or delete on public.inv_log
  for each row execute function public.inv_tolak_ubah();
create trigger inv_log_permanen_truncate before truncate on public.inv_log
  for each statement execute function public.inv_tolak_ubah();
do $$ declare t text; begin
  foreach t in array array['inv_barang','inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update','inv_media'] loop
    execute format('create trigger %I before delete on public.%I for each row execute function public.inv_tolak_ubah()',
                   t || '_tanpa_hapus', t);
  end loop;
end $$;

-- ── 5. View status jadwal (satu sumber Terlambat/Segera/Normal) ─────────────────────────────
create view public.inv_jadwal_v with (security_invoker = true) as
  select j.*,
         case when not j.aktif or j.jatuh_tempo is null then 'normal'
              when j.jatuh_tempo < public.inv_hari_ini() then 'terlambat'
              when j.jatuh_tempo <= public.inv_hari_ini() + public.inv_batas_segera() then 'segera'
              else 'normal' end as status_jadwal,
         (j.terakhir_dilakukan = public.inv_hari_ini()) as selesai_hari_ini
  from public.inv_jadwal j;
grant select on public.inv_jadwal_v to anon, authenticated;

-- ── 6. RPC barang ────────────────────────────────────────────────────────────────────────────
create or replace function public.inv_tambah_barang(p_data jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; v_lok text := coalesce(nullif(p_data->>'lokasi_kode', ''), 'BELUM');
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin yang bisa menambah barang' using errcode = '42501'; end if;
  if not exists (select 1 from public.inv_lokasi where kode = v_lok and aktif) then
    raise exception 'Lokasi % tidak tersedia', v_lok using errcode = '22023';
  end if;
  perform public.inv_konteks(a.nama, 'admin');
  insert into public.inv_barang (nama, lokasi_kode, pengguna, kondisi, detail_kondisi, merk_spesifikasi, nomor_seri,
                                 tanggal_perolehan, dibuat_oleh)
  values (p_data->>'nama', v_lok, nullif(btrim(p_data->>'pengguna'), ''),
          coalesce(nullif(p_data->>'kondisi', ''), 'belum_dinilai'), nullif(btrim(p_data->>'detail_kondisi'), ''),
          nullif(btrim(p_data->>'merk_spesifikasi'), ''), nullif(btrim(p_data->>'nomor_seri'), ''),
          nullif(p_data->>'tanggal_perolehan', '')::date, a.nama)
  returning * into b;
  return to_jsonb(b);
end $$;

-- Admin: ubah kolom apa pun kecuali nomor (lokasi, kondisi, aktif ikut di sini). p_patch hanya kunci yang diubah.
create or replace function public.inv_ubah_barang(p_id bigint, p_versi int, p_patch jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record; b public.inv_barang; v_asing text[];
  v_boleh constant text[] := array['nama','lokasi_kode','pengguna','kondisi','detail_kondisi','merk_spesifikasi',
                                   'nomor_seri','tanggal_perolehan','tanggal_perolehan_teks','aktif'];
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin yang bisa mengubah data barang' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Perubahan kosong' using errcode = '22023'; end if;
  select array_agg(k) into v_asing from jsonb_object_keys(p_patch) k where k <> all(v_boleh);
  if v_asing is not null then raise exception 'Kolom tidak bisa diubah: %', v_asing using errcode = '22023'; end if;

  select * into b from public.inv_barang where id = p_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if b.versi <> p_versi then
    raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = '40001';
  end if;
  if p_patch ? 'lokasi_kode' and p_patch->>'lokasi_kode' is distinct from b.lokasi_kode
     and not exists (select 1 from public.inv_lokasi where kode = p_patch->>'lokasi_kode' and aktif) then
    raise exception 'Lokasi % tidak tersedia', p_patch->>'lokasi_kode' using errcode = '22023';
  end if;

  perform public.inv_konteks(a.nama, 'admin');
  update public.inv_barang set
    nama              = case when p_patch ? 'nama' then p_patch->>'nama' else nama end,
    lokasi_kode       = case when p_patch ? 'lokasi_kode' then p_patch->>'lokasi_kode' else lokasi_kode end,
    pengguna          = case when p_patch ? 'pengguna' then nullif(btrim(p_patch->>'pengguna'), '') else pengguna end,
    kondisi           = case when p_patch ? 'kondisi' then p_patch->>'kondisi' else kondisi end,
    detail_kondisi    = case when p_patch ? 'detail_kondisi' then nullif(btrim(p_patch->>'detail_kondisi'), '') else detail_kondisi end,
    merk_spesifikasi  = case when p_patch ? 'merk_spesifikasi' then nullif(btrim(p_patch->>'merk_spesifikasi'), '') else merk_spesifikasi end,
    nomor_seri        = case when p_patch ? 'nomor_seri' then nullif(btrim(p_patch->>'nomor_seri'), '') else nomor_seri end,
    tanggal_perolehan = case when p_patch ? 'tanggal_perolehan' then nullif(p_patch->>'tanggal_perolehan', '')::date else tanggal_perolehan end,
    tanggal_perolehan_teks = case when p_patch ? 'tanggal_perolehan_teks' then nullif(btrim(p_patch->>'tanggal_perolehan_teks'), '') else tanggal_perolehan_teks end,
    aktif             = case when p_patch ? 'aktif' then (p_patch->>'aktif')::boolean else aktif end
  where id = p_id
  returning * into b;
  return to_jsonb(b);
end $$;

-- Operator & admin: ubah kondisi (dropdown di sel / detail barang HP). p_detail null = detail tidak diubah.
create or replace function public.inv_set_kondisi(p_id bigint, p_versi int, p_kondisi text, p_detail text, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang;
begin
  select * into a from public.inv_aktor(p_aktor);
  select * into b from public.inv_barang where id = p_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if b.versi <> p_versi then
    raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = '40001';
  end if;
  if a.peran = 'operator' then
    if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
    if not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then
      raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501';
    end if;
    if p_kondisi not in ('baik','tidak_maksimal','perlu_maintenance') then
      raise exception 'Operator hanya bisa memilih Berfungsi baik / tidak maksimal / Perlu maintenance. Kerusakan dilaporkan lewat Lapor kerusakan.'
        using errcode = '42501';
    end if;
    if exists (select 1 from public.inv_laporan where barang_id = p_id and status <> 'closed') then
      raise exception 'Ada laporan kerusakan aktif - kondisi terkunci sampai laporan ditutup admin' using errcode = '42501';
    end if;
  elsif p_kondisi not in ('baik','tidak_maksimal','perlu_maintenance','rusak','belum_dinilai') then
    raise exception 'Kondisi % tidak dikenal', p_kondisi using errcode = '22023';
  end if;
  perform public.inv_konteks(a.nama, a.peran);
  update public.inv_barang
     set kondisi = p_kondisi,
         detail_kondisi = case when p_detail is null then detail_kondisi else nullif(btrim(p_detail), '') end
   where id = p_id
  returning * into b;
  return to_jsonb(b);
end $$;

-- ── 7. RPC laporan kerusakan ─────────────────────────────────────────────────────────────────
create or replace function public.inv_buat_laporan(p_barang_id bigint, p_judul text, p_masalah text, p_media jsonb,
  p_kunci uuid, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; l public.inv_laporan; v_n int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if p_kunci is not null then
    select * into l from public.inv_laporan where kunci = p_kunci;
    if found then return jsonb_build_object('laporan', to_jsonb(l), 'dobel', true); end if;
  end if;
  perform public.inv_validasi_media(p_media);
  if coalesce(btrim(p_judul), '') = '' or length(p_judul) > 200 then
    raise exception 'Judul masalah wajib diisi (maks 200 huruf)' using errcode = '22023';
  end if;
  select * into b from public.inv_barang where id = p_barang_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
  if a.peran = 'operator' and not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then
    raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501';
  end if;

  insert into public.inv_laporan (barang_id, judul, masalah, pelapor, pelapor_pekerja_id, sumber, kunci)
  values (p_barang_id, btrim(p_judul), nullif(btrim(p_masalah), ''), a.nama, a.pekerja_id, a.peran, p_kunci)
  on conflict (kunci) do nothing
  returning * into l;
  if l.id is null then  -- kiriman serempak dengan kunci sama
    select * into l from public.inv_laporan where kunci = p_kunci;
    return jsonb_build_object('laporan', to_jsonb(l), 'dobel', true);
  end if;
  v_n := public.inv_simpan_media('laporan', l.id, 'sebelum', p_media, a.nama);
  if b.kondisi <> 'rusak' then
    perform public.inv_konteks(a.nama, a.peran, 'Laporan kerusakan #' || l.id, l.id);
    update public.inv_barang set kondisi = 'rusak' where id = p_barang_id;
  end if;
  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n, 'dobel', false);
end $$;

-- Admin: ubah status (open/in_progress/closed) + catatan/perbaikan + media sesudah. Kondisi barang ikut otomatis.
create or replace function public.inv_ubah_status_laporan(p_laporan_id bigint, p_status text, p_catatan text,
  p_perbaikan text, p_teknisi text, p_media_sesudah jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; l public.inv_laporan; b public.inv_barang; v_lama text; v_bid bigint; v_n int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin yang bisa mengubah status laporan' using errcode = '42501'; end if;
  if p_status not in ('open','in_progress','closed') then raise exception 'Status % tidak dikenal', p_status using errcode = '22023'; end if;
  perform public.inv_validasi_media(p_media_sesudah);
  select barang_id into v_bid from public.inv_laporan where id = p_laporan_id;
  if v_bid is null then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  select * into b from public.inv_barang where id = v_bid for update;      -- urutan kunci: barang lalu laporan
  select * into l from public.inv_laporan where id = p_laporan_id for update;
  v_lama := l.status;

  v_n := public.inv_simpan_media('laporan', l.id, 'sesudah', p_media_sesudah, a.nama);
  if p_status = 'closed' and v_lama <> 'closed' and not exists (
       select 1 from public.inv_media where tujuan = 'laporan' and ref_id = l.id and peran = 'sesudah' and dihapus_pada is null) then
    raise exception 'Menutup laporan wajib dokumentasi sesudah perbaikan (foto/video)' using errcode = '22023';
  end if;

  update public.inv_laporan set
    status = p_status,
    perbaikan = coalesce(nullif(btrim(p_perbaikan), ''), perbaikan),
    teknisi = coalesce(nullif(btrim(p_teknisi), ''), teknisi),
    ditutup_pada = case when p_status = 'closed' then coalesce(case when v_lama = 'closed' then ditutup_pada end, now()) end,
    ditutup_oleh = case when p_status = 'closed' then coalesce(case when v_lama = 'closed' then ditutup_oleh end, a.nama) end
  where id = l.id
  returning * into l;

  if p_status <> v_lama or coalesce(btrim(p_catatan), '') <> '' then
    insert into public.inv_laporan_update (laporan_id, oleh, catatan, status_dari, status_ke)
    values (l.id, a.nama, nullif(btrim(p_catatan), ''),
            case when p_status <> v_lama then v_lama end, case when p_status <> v_lama then p_status end);
  end if;

  -- kondisi otomatis
  if p_status = 'closed' and v_lama <> 'closed' and b.kondisi = 'rusak'
     and not exists (select 1 from public.inv_laporan where barang_id = b.id and status <> 'closed') then
    perform public.inv_konteks(a.nama, 'otomatis', 'Laporan #' || l.id || ' ditutup', l.id);
    update public.inv_barang set kondisi = 'baik' where id = b.id;
  elsif p_status <> 'closed' and v_lama = 'closed' and b.kondisi <> 'rusak' then
    perform public.inv_konteks(a.nama, 'otomatis', 'Laporan #' || l.id || ' dibuka lagi', l.id);
    update public.inv_barang set kondisi = 'rusak' where id = b.id;
  end if;
  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n);
end $$;

create or replace function public.inv_tambah_update_laporan(p_laporan_id bigint, p_catatan text, p_media jsonb, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; l public.inv_laporan; v_lok text; u public.inv_laporan_update; v_n int;
begin
  select * into a from public.inv_aktor(p_aktor);
  perform public.inv_validasi_media(p_media);
  select * into l from public.inv_laporan where id = p_laporan_id;
  if not found then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  if a.peran = 'operator' then
    select lokasi_kode into v_lok from public.inv_barang where id = l.barang_id;
    if not public.inv_operator_boleh(a.divisi, v_lok) then raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501'; end if;
    if l.status = 'closed' then raise exception 'Laporan sudah ditutup' using errcode = '42501'; end if;
  end if;
  if coalesce(btrim(p_catatan), '') = '' and coalesce(jsonb_array_length(p_media), 0) = 0 then
    raise exception 'Isi catatan atau lampirkan media' using errcode = '22023';
  end if;
  insert into public.inv_laporan_update (laporan_id, oleh, catatan) values (l.id, a.nama, nullif(btrim(p_catatan), ''))
  returning * into u;
  v_n := public.inv_simpan_media('laporan_update', u.id, 'update', p_media, a.nama);
  return jsonb_build_object('update', to_jsonb(u), 'media', v_n);
end $$;

-- Tempel media susulan (antrean offline / unggah datasheet). URL yang sudah ada diabaikan (aman dikirim ulang).
create or replace function public.inv_tambah_media(p_tujuan text, p_ref_id bigint, p_peran text, p_media jsonb, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; v_bid bigint; v_lok text;
begin
  select * into a from public.inv_aktor(p_aktor);
  perform public.inv_validasi_media(p_media);
  if (p_tujuan, p_peran) not in (('laporan','sebelum'),('laporan','sesudah'),('laporan_update','update'),
                                 ('jadwal_selesai','selesai'),('barang','datasheet')) then
    raise exception 'Kombinasi % / % tidak diizinkan', p_tujuan, p_peran using errcode = '22023';
  end if;
  if (p_peran in ('sesudah','datasheet')) and a.peran <> 'admin' then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  if p_peran = 'datasheet' and exists (select 1 from jsonb_array_elements(p_media) f
                                       where coalesce(f->>'mime', '') <> 'application/pdf') then
    raise exception 'Datasheet harus PDF' using errcode = '22023';
  end if;
  v_bid := case p_tujuan
    when 'barang' then (select id from public.inv_barang where id = p_ref_id)
    when 'laporan' then (select barang_id from public.inv_laporan where id = p_ref_id)
    when 'laporan_update' then (select l.barang_id from public.inv_laporan_update u join public.inv_laporan l on l.id = u.laporan_id where u.id = p_ref_id)
    when 'jadwal_selesai' then (select barang_id from public.inv_jadwal_selesai where id = p_ref_id) end;
  if v_bid is null then return jsonb_build_object('ditemukan', false, 'ditambah', 0); end if;
  if a.peran = 'operator' then
    select lokasi_kode into v_lok from public.inv_barang where id = v_bid;
    if not public.inv_operator_boleh(a.divisi, v_lok) then raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501'; end if;
  end if;
  return jsonb_build_object('ditemukan', true, 'ditambah', public.inv_simpan_media(p_tujuan, p_ref_id, p_peran, p_media, a.nama));
end $$;

-- Hapus lunak - hanya datasheet (dokumentasi lain = bukti, tidak bisa dihapus).
create or replace function public.inv_hapus_media(p_media_id bigint, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; m public.inv_media;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  update public.inv_media set dihapus_pada = now(), dihapus_oleh = a.nama
   where id = p_media_id and peran = 'datasheet' and dihapus_pada is null
  returning * into m;
  if m.id is null then raise exception 'Media tidak ditemukan / bukan datasheet' using errcode = 'P0002'; end if;
  return to_jsonb(m);
end $$;

-- ── 8. RPC jadwal ────────────────────────────────────────────────────────────────────────────
create or replace function public.inv_simpan_jadwal(p_id bigint, p_data jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; j public.inv_jadwal;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin yang bisa mengatur jadwal' using errcode = '42501'; end if;
  if p_id is null then
    insert into public.inv_jadwal (barang_id, jenis, frekuensi, jatuh_tempo, teknisi, catatan, dibuat_oleh)
    values ((p_data->>'barang_id')::bigint, btrim(p_data->>'jenis'), p_data->>'frekuensi',
            nullif(p_data->>'jatuh_tempo', '')::date, nullif(btrim(p_data->>'teknisi'), ''),
            nullif(btrim(p_data->>'catatan'), ''), a.nama)
    returning * into j;
  else
    update public.inv_jadwal set
      jenis       = case when p_data ? 'jenis' then btrim(p_data->>'jenis') else jenis end,
      frekuensi   = case when p_data ? 'frekuensi' then p_data->>'frekuensi' else frekuensi end,
      jatuh_tempo = case when p_data ? 'jatuh_tempo' then nullif(p_data->>'jatuh_tempo', '')::date else jatuh_tempo end,
      teknisi     = case when p_data ? 'teknisi' then nullif(btrim(p_data->>'teknisi'), '') else teknisi end,
      catatan     = case when p_data ? 'catatan' then nullif(btrim(p_data->>'catatan'), '') else catatan end,
      aktif       = case when p_data ? 'aktif' then (p_data->>'aktif')::boolean else aktif end
    where id = p_id
    returning * into j;
    if j.id is null then raise exception 'Jadwal tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  if coalesce(j.jenis, '') = '' then raise exception 'Jenis maintenance wajib diisi' using errcode = '22023'; end if;
  return to_jsonb(j);
end $$;

create or replace function public.inv_selesai_jadwal(p_jadwal_id bigint, p_catatan text, p_media jsonb, p_kunci uuid, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; j public.inv_jadwal; b public.inv_barang; s public.inv_jadwal_selesai; v_n int; v_hari date := public.inv_hari_ini();
begin
  select * into a from public.inv_aktor(p_aktor);
  if p_kunci is not null then
    select * into s from public.inv_jadwal_selesai where kunci = p_kunci;
    if found then return jsonb_build_object('selesai', to_jsonb(s), 'dobel', true); end if;
  end if;
  v_n := public.inv_validasi_media(p_media);
  select * into j from public.inv_jadwal where id = p_jadwal_id for update;
  if not found then raise exception 'Jadwal tidak ditemukan' using errcode = 'P0002'; end if;
  if not j.aktif then raise exception 'Jadwal sudah nonaktif' using errcode = '42501'; end if;
  select * into b from public.inv_barang where id = j.barang_id;
  if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
  if a.peran = 'operator' then
    if not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501'; end if;
    if v_n = 0 then raise exception 'Wajib minimal 1 foto/video sebelum menandai selesai' using errcode = '22023'; end if;
    if j.terakhir_dilakukan = v_hari then raise exception 'Jadwal ini sudah ditandai selesai hari ini' using errcode = '42501'; end if;
  end if;

  insert into public.inv_jadwal_selesai (jadwal_id, barang_id, tanggal, oleh, pekerja_id, sumber, tanpa_dokumentasi, catatan, kunci)
  values (j.id, j.barang_id, v_hari, a.nama, a.pekerja_id, a.peran, v_n = 0, nullif(btrim(p_catatan), ''), p_kunci)
  on conflict (kunci) do nothing
  returning * into s;
  if s.id is null then
    select * into s from public.inv_jadwal_selesai where kunci = p_kunci;
    return jsonb_build_object('selesai', to_jsonb(s), 'dobel', true);
  end if;
  perform public.inv_simpan_media('jadwal_selesai', s.id, 'selesai', p_media, a.nama);
  update public.inv_jadwal set terakhir_dilakukan = v_hari, jatuh_tempo = public.inv_jatuh_tempo_berikut(v_hari, frekuensi)
   where id = j.id returning * into j;
  return jsonb_build_object('selesai', to_jsonb(s), 'jadwal', to_jsonb(j), 'dobel', false);
end $$;

-- ── 9. Impor massal (T1 awal & tombol "Impor dari Excel") ────────────────────────────────────
-- p_baris: [{kunci, nama, nomor_inventaris?, lokasi_kode, pengguna, kondisi, detail_kondisi, merk_spesifikasi, nomor_seri,
--            tanggal_perolehan (YYYY-MM-DD)?, tanggal_perolehan_teks?, pelapor?, diperbarui_pada?, baru?}]
-- Idempoten lewat kunci (impor_kunci): baris yang sudah ada DILEWATI (tidak ditimpa). baru=true -> pelapor = admin
-- pengimpor, diperbarui_pada = waktu impor. Selain itu pelapor/diperbarui_pada apa adanya (kosong tetap NULL).
-- p_dry_run = true: semua dikerjakan sungguhan (trigger, nomor, log) lalu DIBATALKAN, hasil ringkasan dikembalikan.
create or replace function public.inv_impor(p_baris jsonb, p_dry_run boolean, p_file text, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record; r jsonb; v_ord bigint; v_err text[] := '{}'; v_batch uuid := gen_random_uuid();
  v_dibuat int := 0; v_lewat int := 0; v_id bigint; v_nomor text; v_hasil jsonb; v_ringkasan jsonb;
  v_baru boolean; v_ada_nomor int; v_boleh_tanpa_nomor int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin yang bisa impor' using errcode = '42501'; end if;
  if p_baris is null or jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) = 0 or jsonb_array_length(p_baris) > 2000 then
    raise exception 'Data impor harus 1-2000 baris' using errcode = '22023';
  end if;

  -- validasi menyeluruh dulu
  select v_err || coalesce(array_agg('Kunci kembar: ' || k), '{}') into v_err
    from (select e->>'kunci' k from jsonb_array_elements(p_baris) x(e) group by 1 having count(*) > 1) y;
  select v_err || coalesce(array_agg('Nomor kembar di file: ' || n), '{}') into v_err
    from (select e->>'nomor_inventaris' n from jsonb_array_elements(p_baris) x(e)
          where coalesce(e->>'nomor_inventaris', '') <> '' group by 1 having count(*) > 1) y;
  for r, v_ord in select * from jsonb_array_elements(p_baris) with ordinality loop
    if coalesce(r->>'kunci', '') = '' then v_err := v_err || ('Baris ' || v_ord || ': kunci kosong'); end if;
    if coalesce(btrim(r->>'nama'), '') = '' then v_err := v_err || ('Baris ' || v_ord || ': nama kosong'); end if;
    if not exists (select 1 from public.inv_lokasi where kode = r->>'lokasi_kode') then
      v_err := v_err || ('Baris ' || v_ord || ': lokasi ' || coalesce(r->>'lokasi_kode', '(kosong)') || ' tidak dikenal');
    end if;
    if coalesce(r->>'kondisi', 'belum_dinilai') not in ('baik','tidak_maksimal','perlu_maintenance','rusak','belum_dinilai') then
      v_err := v_err || ('Baris ' || v_ord || ': kondisi ' || (r->>'kondisi') || ' tidak dikenal');
    end if;
    if coalesce(r->>'tanggal_perolehan', '') <> '' and r->>'tanggal_perolehan' !~ '^\d{4}-\d{2}-\d{2}$' then
      v_err := v_err || ('Baris ' || v_ord || ': tanggal perolehan bukan YYYY-MM-DD');
    end if;
    if exists (select 1 from public.inv_barang where nomor_inventaris = r->>'nomor_inventaris'
               and impor_kunci is distinct from r->>'kunci') then
      v_err := v_err || ('Baris ' || v_ord || ': nomor ' || (r->>'nomor_inventaris') || ' sudah dipakai barang lain');
    end if;
  end loop;
  -- nomor eksplisit: semua atau tidak sama sekali (campuran bisa bentrok dengan nomor otomatis)
  select count(*) filter (where coalesce(e->>'nomor_inventaris', '') <> ''),
         count(*) filter (where coalesce(e->>'nomor_inventaris', '') = '' and l.boleh_nomor)
    into v_ada_nomor, v_boleh_tanpa_nomor
    from jsonb_array_elements(p_baris) x(e) join public.inv_lokasi l on l.kode = e->>'lokasi_kode'
   where not exists (select 1 from public.inv_barang b where b.impor_kunci = e->>'kunci');
  if v_ada_nomor > 0 and v_boleh_tanpa_nomor > 0 then
    v_err := v_err || (v_boleh_tanpa_nomor || ' baris di lokasi bernomor tidak punya nomor, sementara baris lain punya');
  end if;
  if array_length(v_err, 1) > 0 then
    if p_dry_run then return jsonb_build_object('dry_run', true, 'galat', to_jsonb(v_err)); end if;
    raise exception 'Impor ditolak: %', array_to_string(v_err, '; ') using errcode = '22023';
  end if;

  begin
    perform public.inv_konteks(a.nama, 'impor', 'Impor ' || coalesce(p_file, ''), null, true);
    insert into public.inv_impor_batch (id, file_nama, oleh) values (v_batch, p_file, a.nama);
    for r, v_ord in select * from jsonb_array_elements(p_baris) with ordinality loop
      select id, nomor_inventaris into v_id, v_nomor from public.inv_barang where impor_kunci = r->>'kunci';
      if found then
        v_lewat := v_lewat + 1;
        v_hasil := jsonb_build_object('status', 'dilewati', 'barang_id', v_id, 'nomor', v_nomor);
      else
        v_baru := coalesce((r->>'baru')::boolean, false);
        insert into public.inv_barang (nama, nomor_inventaris, lokasi_kode, pengguna, kondisi, detail_kondisi, merk_spesifikasi,
               nomor_seri, tanggal_perolehan, tanggal_perolehan_teks, pelapor, diperbarui_pada, impor_kunci, impor_batch, dibuat_oleh)
        values (r->>'nama', nullif(r->>'nomor_inventaris', ''), r->>'lokasi_kode', nullif(btrim(r->>'pengguna'), ''),
               coalesce(nullif(r->>'kondisi', ''), 'belum_dinilai'), nullif(btrim(r->>'detail_kondisi'), ''),
               nullif(btrim(r->>'merk_spesifikasi'), ''), nullif(btrim(r->>'nomor_seri'), ''),
               nullif(r->>'tanggal_perolehan', '')::date, nullif(btrim(r->>'tanggal_perolehan_teks'), ''),
               case when v_baru then a.nama else nullif(btrim(r->>'pelapor'), '') end,
               case when v_baru then now() else nullif(r->>'diperbarui_pada', '')::timestamptz end,
               r->>'kunci', v_batch, a.nama)
        returning id, nomor_inventaris into v_id, v_nomor;
        v_dibuat := v_dibuat + 1;
        v_hasil := jsonb_build_object('status', 'dibuat', 'barang_id', v_id, 'nomor', v_nomor);
      end if;
      insert into public.inv_impor_cadangan (batch_id, baris, data_asli, hasil) values (v_batch, v_ord, r, v_hasil);
    end loop;

    select jsonb_build_object(
      'dibuat', v_dibuat, 'dilewati', v_lewat,
      'per_lokasi', (select jsonb_object_agg(lokasi_kode, jsonb_build_object('jumlah', n, 'nomor_awal', a1, 'nomor_akhir', a2))
                     from (select lokasi_kode, count(*) n, min(nomor_inventaris) a1, max(nomor_inventaris) a2
                           from public.inv_barang where impor_batch = v_batch group by 1) x),
      'per_kondisi', (select jsonb_object_agg(kondisi, n) from (select kondisi, count(*) n from public.inv_barang
                      where impor_batch = v_batch group by 1) x),
      'penghitung', (select jsonb_object_agg(kode_lokasi, terakhir) from public.inv_nomor_penghitung),
      'log_dibuat', (select count(*) from public.inv_log g join public.inv_barang b on b.id = g.barang_id where b.impor_batch = v_batch)
    ) into v_ringkasan;
    update public.inv_impor_batch set ringkasan = v_ringkasan where id = v_batch;
    if p_dry_run then raise exception 'dry-run' using errcode = 'VTDRY'; end if;
  exception when sqlstate 'VTDRY' then null;   -- semua perubahan di blok ini dibatalkan, ringkasan tetap
  end;
  return v_ringkasan || jsonb_build_object('dry_run', p_dry_run, 'batch', case when p_dry_run then null else v_batch end);
end $$;

-- ── 10. Migrasi data lama (idempoten; dijalankan ulang tepat sebelum go-live) ────────────────
-- Barang tujuan dicari lewat inv_padanan_lama.impor_kunci (jadi impor harus sudah jalan). Jadwal/riwayat/laporan
-- di-upsert lewat kolom *_lama (dijalankan ulang = memperbarui dari tabel lama, bukan menggandakan). Media: URL sama
-- (tidak unggah ulang), url unik -> tidak dobel. Laporan aktif -> kondisi Rusak (menimpa kondisi Excel, keputusan
-- user no. 4); bila laporan lama itu sudah ditutup saat dijalankan ulang -> kondisi kembali baik (otomatis).
create or replace function public.inv_migrasi_data_lama(p_dry_run boolean, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; v_ringkasan jsonb; v_err text[] := '{}'; x record; v_n int;
  v_jadwal int; v_selesai int; v_media_s int; v_lap int; v_upd int; v_media_l int; v_rusak int := 0; v_pulih int := 0;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  select coalesce(array_agg('Barang tujuan ' || p.kode_lama || ' (' || p.impor_kunci || ') belum diimpor'), '{}') into v_err
    from public.inv_padanan_lama p where not exists (select 1 from public.inv_barang b where b.impor_kunci = p.impor_kunci);
  select v_err || coalesce(array_agg('Barang ' || b.impor_kunci || ' sudah terhubung ke mesin lain (' || b.mesin_id_lama || ')'), '{}') into v_err
    from public.inv_padanan_lama p join public.inv_barang b on b.impor_kunci = p.impor_kunci
   where b.mesin_id_lama is not null and b.mesin_id_lama <> p.mesin_id_lama;
  if array_length(v_err, 1) > 0 then
    if p_dry_run then return jsonb_build_object('dry_run', true, 'galat', to_jsonb(v_err)); end if;
    raise exception 'Migrasi ditolak: %', array_to_string(v_err, '; ') using errcode = '22023';
  end if;

  begin
    perform public.inv_konteks(a.nama, 'impor', 'Migrasi data maintenance lama');
    update public.inv_barang b set kode_lama = p.kode_lama, mesin_id_lama = p.mesin_id_lama
      from public.inv_padanan_lama p
     where b.impor_kunci = p.impor_kunci and (b.kode_lama is distinct from p.kode_lama or b.mesin_id_lama is null);

    insert into public.inv_jadwal (barang_id, jenis, frekuensi, jatuh_tempo, terakhir_dilakukan, teknisi, catatan, aktif,
                                   rutin_id_lama, dibuat_oleh, dibuat_pada)
    select b.id, r.jenis_maintenance, r.frekuensi, r.jatuh_tempo, r.terakhir_dilakukan, r.teknisi, r.catatan,
           coalesce(r.is_active, true), r.id, 'migrasi', coalesce(r.created_at, now())
      from public.maintenance_rutin r join public.inv_barang b on b.mesin_id_lama = r.mesin_id
    on conflict (rutin_id_lama) do update set barang_id = excluded.barang_id, jenis = excluded.jenis,
      frekuensi = excluded.frekuensi, jatuh_tempo = excluded.jatuh_tempo, terakhir_dilakukan = excluded.terakhir_dilakukan,
      teknisi = excluded.teknisi, catatan = excluded.catatan, aktif = excluded.aktif;
    get diagnostics v_jadwal = row_count;

    insert into public.inv_jadwal_selesai (jadwal_id, barang_id, tanggal, oleh, sumber, tanpa_dokumentasi, catatan,
                                           rutin_log_id_lama, dibuat_pada)
    select j.id, j.barang_id, l.dilakukan_pada, coalesce(nullif(btrim(l.teknisi), ''), '(tidak tercatat)'),
           case when l.completed_via = 'qr_worker' then 'qr_lama' else 'admin' end,
           jsonb_array_length(coalesce(l.foto, '[]'::jsonb)) = 0, l.catatan, l.id, coalesce(l.created_at, now())
      from public.maintenance_rutin_log l join public.inv_jadwal j on j.rutin_id_lama = l.rutin_id
    on conflict (rutin_log_id_lama) do update set tanpa_dokumentasi = excluded.tanpa_dokumentasi,
      oleh = excluded.oleh, catatan = excluded.catatan;
    get diagnostics v_selesai = row_count;

    insert into public.inv_media (tujuan, ref_id, peran, url, mime, oleh, dibuat_pada)
    select 'jadwal_selesai', s.id, 'selesai', f->>'url', case when f->>'type' = 'video' then 'video/*' else 'image/*' end,
           s.oleh, coalesce(nullif(f->>'uploaded_at', '')::timestamptz, s.dibuat_pada)
      from public.maintenance_rutin_log l
      join public.inv_jadwal_selesai s on s.rutin_log_id_lama = l.id
      cross join lateral jsonb_array_elements(coalesce(l.foto, '[]'::jsonb)) f
     where coalesce(f->>'url', '') <> ''
    on conflict (url) do nothing;
    get diagnostics v_media_s = row_count;

    insert into public.inv_laporan (barang_id, judul, masalah, status, pelapor, sumber, teknisi, perbaikan, catatan_lama,
                                    dibuat_pada, ditutup_pada, ditutup_oleh, maintenance_log_id_lama)
    select b.id,
           coalesce(nullif(btrim(m.judul), ''), nullif(btrim(split_part(coalesce(m.kendala, ''), E'\n', 1)), ''), '(tanpa judul)'),
           m.kendala, coalesce(m.status, 'open'), '(data lama)', 'lama', m.teknisi, m.perbaikan, m.catatan,
           coalesce((m.tgl_kendala::timestamp at time zone 'Asia/Jakarta'), m.created_at, now()),
           case when m.status = 'closed' then coalesce((m.tgl_perbaikan::timestamp at time zone 'Asia/Jakarta'), m.created_at) end,
           case when m.status = 'closed' then '(data lama)' end,
           m.id
      from public.maintenance_log m join public.inv_barang b on b.mesin_id_lama = m.mesin_id
    on conflict (maintenance_log_id_lama) do update set judul = excluded.judul, masalah = excluded.masalah,
      status = excluded.status, teknisi = excluded.teknisi, perbaikan = excluded.perbaikan, catatan_lama = excluded.catatan_lama,
      ditutup_pada = excluded.ditutup_pada, ditutup_oleh = excluded.ditutup_oleh;
    get diagnostics v_lap = row_count;

    insert into public.inv_laporan_update (laporan_id, waktu, oleh, catatan, urut_lama)
    select l.id,
           case when u.e->>'tanggal' ~ '^\d{4}-\d{2}-\d{2}' then (left(u.e->>'tanggal', 10)::timestamp at time zone 'Asia/Jakarta')
                else l.dibuat_pada end,
           coalesce(nullif(btrim(u.e->>'oleh'), ''), '(data lama)'), u.e->>'catatan', u.i::int
      from public.maintenance_log m
      join public.inv_laporan l on l.maintenance_log_id_lama = m.id
      cross join lateral jsonb_array_elements(coalesce(m.update_harian, '[]'::jsonb)) with ordinality u(e, i)
    on conflict (laporan_id, urut_lama) do update set catatan = excluded.catatan, oleh = excluded.oleh;
    get diagnostics v_upd = row_count;

    insert into public.inv_media (tujuan, ref_id, peran, url, mime, thumb, oleh, dibuat_pada)
    select 'laporan', l.id, 'lama', f->>'url', case when f->>'type' = 'video' then 'video/*' else 'image/*' end,
           nullif(f->>'thumb', ''), '(data lama)', coalesce(nullif(f->>'uploaded_at', '')::timestamptz, l.dibuat_pada)
      from public.maintenance_log m
      join public.inv_laporan l on l.maintenance_log_id_lama = m.id
      cross join lateral jsonb_array_elements(coalesce(m.foto, '[]'::jsonb)) f
     where coalesce(f->>'url', '') <> ''
    on conflict (url) do nothing;
    get diagnostics v_media_l = row_count;

    -- kondisi: laporan lama aktif -> Rusak
    for x in select b.id, min(l.id) lap, min(l.maintenance_log_id_lama) lama from public.inv_barang b
             join public.inv_laporan l on l.barang_id = b.id
             where l.status <> 'closed' and l.sumber = 'lama' and b.kondisi <> 'rusak' group by b.id loop
      perform public.inv_konteks(a.nama, 'impor', 'laporan lama aktif #' || x.lap || ' (maintenance_log #' || x.lama
                                 || ', menimpa kondisi Excel)', x.lap);
      update public.inv_barang set kondisi = 'rusak' where id = x.id;
      v_rusak := v_rusak + 1;
    end loop;
    -- dijalankan ulang: Rusak hasil migrasi, laporannya kini sudah tutup semua -> kembali baik
    for x in select b.id from public.inv_barang b
             where b.kondisi = 'rusak'
               and not exists (select 1 from public.inv_laporan l where l.barang_id = b.id and l.status <> 'closed')
               and (select g.keterangan from public.inv_log g where g.barang_id = b.id and g.jenis = 'kondisi'
                    order by g.id desc limit 1) like 'laporan lama aktif #%' loop
      perform public.inv_konteks(a.nama, 'otomatis', 'Laporan lama sudah ditutup di sistem lama');
      update public.inv_barang set kondisi = 'baik' where id = x.id;
      v_pulih := v_pulih + 1;
    end loop;

    v_ringkasan := jsonb_build_object(
      'barang_terhubung', (select count(*) from public.inv_barang where mesin_id_lama is not null),
      'jadwal_upsert', v_jadwal, 'selesai_upsert', v_selesai, 'media_selesai_baru', v_media_s,
      'laporan_upsert', v_lap, 'update_laporan_upsert', v_upd, 'media_laporan_baru', v_media_l,
      'kondisi_jadi_rusak', v_rusak, 'kondisi_pulih', v_pulih,
      'total', jsonb_build_object(
        'jadwal', (select count(*) from public.inv_jadwal where rutin_id_lama is not null),
        'selesai', (select count(*) from public.inv_jadwal_selesai where rutin_log_id_lama is not null),
        'laporan', (select count(*) from public.inv_laporan where maintenance_log_id_lama is not null)),
      'lama_tidak_terpetakan', jsonb_build_object(
        'jadwal', (select count(*) from public.maintenance_rutin r where not exists (select 1 from public.inv_jadwal j where j.rutin_id_lama = r.id)),
        'selesai', (select count(*) from public.maintenance_rutin_log l where not exists (select 1 from public.inv_jadwal_selesai s where s.rutin_log_id_lama = l.id)),
        'laporan', (select count(*) from public.maintenance_log m where not exists (select 1 from public.inv_laporan l where l.maintenance_log_id_lama = m.id)),
        'mesin', (select coalesce(jsonb_agg(m.kode || ' ' || m.nama), '[]'::jsonb) from public.mesin m
                  where not exists (select 1 from public.inv_padanan_lama p where p.mesin_id_lama = m.id))));
    if p_dry_run then raise exception 'dry-run' using errcode = 'VTDRY'; end if;
  exception when sqlstate 'VTDRY' then null;
  end;
  return v_ringkasan || jsonb_build_object('dry_run', p_dry_run);
end $$;

-- ── 11. Hak eksekusi ─────────────────────────────────────────────────────────────────────────
revoke execute on function public.inv_aktor(jsonb), public.inv_konteks(text, text, text, bigint, boolean),
  public.inv_simpan_media(text, bigint, text, jsonb, text), public.inv_barang_sebelum(), public.inv_barang_catat(),
  public.inv_tolak_ubah() from public, anon, authenticated;
grant execute on function public.inv_hari_ini(), public.inv_batas_segera(), public.inv_jatuh_tempo_berikut(date, text),
  public.inv_operator_boleh(text, text), public.inv_validasi_media(jsonb),
  public.inv_tambah_barang(jsonb, jsonb), public.inv_ubah_barang(bigint, int, jsonb, jsonb),
  public.inv_set_kondisi(bigint, int, text, text, jsonb),
  public.inv_buat_laporan(bigint, text, text, jsonb, uuid, jsonb),
  public.inv_ubah_status_laporan(bigint, text, text, text, text, jsonb, jsonb),
  public.inv_tambah_update_laporan(bigint, text, jsonb, jsonb),
  public.inv_tambah_media(text, bigint, text, jsonb, jsonb), public.inv_hapus_media(bigint, jsonb),
  public.inv_simpan_jadwal(bigint, jsonb, jsonb), public.inv_selesai_jadwal(bigint, text, jsonb, uuid, jsonb),
  public.inv_impor(jsonb, boolean, text, jsonb), public.inv_migrasi_data_lama(boolean, jsonb)
  to anon, authenticated;

-- ── 12. Realtime ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.inv_barang, public.inv_jadwal, public.inv_jadwal_selesai,
  public.inv_laporan, public.inv_laporan_update, public.inv_media, public.inv_log, public.inv_lokasi;

commit;
