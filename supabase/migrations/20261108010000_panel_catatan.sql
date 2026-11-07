-- 20261108010000_panel_catatan.sql - CATATAN PANEL (Admin Produksi), subtab Catatan di menu "Kendala dan Catatan" (8 Nov 2026).
-- Jalankan SEKALI di Supabase SQL Editor (Run). Berhasil = NOTICE "Verifikasi LULUS (data uji dibatalkan)." dan commit.
-- Gagal di tengah = seluruh file batal (satu transaksi), database tidak berubah.
-- Pola mengikuti kendala_produksi (proyek = NAMA proyek, panel_id tanpa FK + panel_nama snapshot, tulis via RPC security definer,
-- tabel log awet) dan inventaris (p_aktor jsonb dicek ke admins, versi utk optimistic lock, errcode VTVER).
-- BEDA dgn kendala: tabel TIDAK bisa dibaca anon langsung (tanpa policy select); baca juga lewat RPC. Realtime lewat tabel
-- sinyal tanpa isi (panel_catatan_sinyal) karena postgres_changes menghormati RLS.
-- Batas jujur: p_aktor datang dari browser. Pemeriksaan di bawah memastikan akun admins aktif berdivisi 'admin', BUKAN bahwa
-- orangnya benar-benar login (username terbaca anon). Lihat laporan bagian Keamanan.

begin;

-- ---------- pra-cek ----------
do $$ begin
  if to_regclass('public.panel_catatan') is not null then raise exception 'panel_catatan sudah ada - batal'; end if;
  if to_regclass('public.admins') is null or to_regclass('public.work_orders') is null or to_regclass('public.panels') is null then
    raise exception 'tabel admins/work_orders/panels tidak ditemukan - batal';
  end if;
end $$;

-- ---------- tabel ----------
create table public.panel_catatan (
  id                   bigint generated always as identity primary key,
  proyek               text not null,
  wo_id                bigint,
  panel_id             bigint,               -- null = catatan umum proyek; TANPA FK (panel bisa diarsip/dihapus, catatan tetap)
  panel_nama           text,                 -- snapshot nama panel saat dicatat/diubah
  inti                 text not null check (length(btrim(inti)) between 2 and 80),
  isi                  text not null check (length(btrim(isi)) between 3 and 2000),
  sumber_info          text check (sumber_info is null or length(sumber_info) <= 120),
  penting              boolean not null default false,
  status               text not null default 'aktif' check (status in ('aktif', 'ditindaklanjuti')),
  dibuat_oleh          text not null,
  dibuat_username      text not null,
  dibuat_pada          timestamptz not null default now(),
  diubah_pada          timestamptz,
  diubah_oleh          text,
  ditindaklanjuti_pada timestamptz,
  ditindaklanjuti_oleh text,
  versi                integer not null default 1,
  constraint panel_catatan_status_konsisten check ((status = 'aktif') = (ditindaklanjuti_pada is null))
);
create index panel_catatan_proyek_panel on public.panel_catatan (proyek, panel_id, id desc);
create index panel_catatan_aktif on public.panel_catatan (proyek) where status = 'aktif';

create table public.panel_catatan_log (
  id         bigint generated always as identity primary key,
  catatan_id bigint not null,
  aksi       text not null check (aksi in ('catat', 'ubah', 'penting', 'tindaklanjut', 'aktifkan')),
  oleh       text not null,
  sebelum    jsonb,
  sesudah    jsonb,
  waktu      timestamptz not null default now()
);
create index panel_catatan_log_catatan on public.panel_catatan_log (catatan_id, id);

-- Sinyal realtime tanpa isi: satu baris, naik tiap ada perubahan. Boleh dibaca anon (tidak memuat catatan).
create table public.panel_catatan_sinyal (
  id          integer primary key default 1 check (id = 1),
  versi       bigint not null default 0,
  diubah_pada timestamptz not null default now()
);
insert into public.panel_catatan_sinyal (id) values (1);

alter table public.panel_catatan enable row level security;        -- tanpa policy = anon/authenticated tidak bisa baca/tulis
alter table public.panel_catatan_log enable row level security;
alter table public.panel_catatan_sinyal enable row level security;
create policy baca_panel_catatan_sinyal on public.panel_catatan_sinyal for select to anon, authenticated using (true);
revoke all on public.panel_catatan, public.panel_catatan_log from anon, authenticated;
revoke insert, update, delete, truncate on public.panel_catatan_sinyal from anon, authenticated;
grant select on public.panel_catatan_sinyal to anon, authenticated;   -- eksplisit, tidak mengandalkan hak bawaan Supabase

create or replace function public.panel_catatan_bunyikan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.panel_catatan_sinyal set versi = versi + 1, diubah_pada = now() where id = 1;
  return null;
end $$;
create trigger panel_catatan_sinyal_tg after insert or update on public.panel_catatan
  for each statement execute function public.panel_catatan_bunyikan();

-- ---------- aktor: hanya akun admins aktif divisi 'admin' (Admin Produksi). Satu titik: nanti diganti cek token sesi. ----------
create or replace function public.catatan_aktor(p_aktor jsonb, out nama text, out username text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_aktor is null or jsonb_typeof(p_aktor) <> 'object' or coalesce(p_aktor->>'admin', '') = '' then
    raise exception 'Identitas pengguna tidak dikirim' using errcode = '28000';
  end if;
  select a.nama, a.username into nama, username from public.admins a
   where a.username = p_aktor->>'admin' and coalesce(a.is_active, true) and coalesce(a.divisi, 'admin') = 'admin';
  if username is null then raise exception 'Catatan hanya untuk Admin Produksi' using errcode = '42501'; end if;
  if coalesce(btrim(nama), '') = '' then nama := username; end if;   -- nama kosong -> username
end $$;

-- Validasi proyek/panel (sama aturan catat_kendala): panel wajib milik proyek, WO tidak dihapus.
create or replace function public.catatan_cek_panel(p_proyek text, p_panel_id bigint, out wo_id bigint, out panel_nama text)
language plpgsql stable security definer set search_path = public as $$
declare v_proyek text;
begin
  if coalesce(btrim(p_proyek), '') = '' then raise exception 'Proyek wajib'; end if;
  if p_panel_id is not null then
    select w.id, p.nama, w.proyek into wo_id, panel_nama, v_proyek
      from public.panels p join public.work_orders w on w.id = p.wo_id
     where p.id = p_panel_id and p.deleted_at is null and w.deleted_at is null;
    if not found then raise exception 'Panel % tidak ditemukan / sudah dihapus', p_panel_id; end if;
    if v_proyek is distinct from p_proyek then raise exception 'Panel % bukan milik proyek %', panel_nama, p_proyek; end if;
  else
    select w.id into wo_id from public.work_orders w where w.proyek = p_proyek and w.deleted_at is null order by w.id desc limit 1;
    if not found then raise exception 'Proyek % tidak ditemukan', p_proyek; end if;
  end if;
end $$;

-- ---------- RPC ----------
-- Daftar semua catatan (klien memakai .order('id').range() - PostgREST memotong setof juga di 1000 baris).
create or replace function public.catatan_daftar(p_aktor jsonb) returns setof public.panel_catatan
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.catatan_aktor(p_aktor);
  return query select * from public.panel_catatan;
end $$;

create or replace function public.catatan_simpan(p_aktor jsonb, p_proyek text, p_panel_id bigint, p_inti text, p_isi text,
  p_sumber_info text default null, p_penting boolean default false) returns public.panel_catatan
language plpgsql security definer set search_path = public as $$
declare a record; c record; v public.panel_catatan;
begin
  select * into a from public.catatan_aktor(p_aktor);
  select * into c from public.catatan_cek_panel(p_proyek, p_panel_id);
  insert into public.panel_catatan (proyek, wo_id, panel_id, panel_nama, inti, isi, sumber_info, penting, dibuat_oleh, dibuat_username)
  values (btrim(p_proyek), c.wo_id, p_panel_id, c.panel_nama, btrim(p_inti), btrim(p_isi), nullif(btrim(coalesce(p_sumber_info, '')), ''),
          coalesce(p_penting, false), a.nama, a.username)
  returning * into v;
  insert into public.panel_catatan_log (catatan_id, aksi, oleh, sesudah) values (v.id, 'catat', a.nama, to_jsonb(v));
  return v;
end $$;

-- Ambil baris terkunci + cek versi (dua admin bersamaan: yang kedua ditolak VTVER, klien memuat ulang).
create or replace function public.catatan_kunci(p_id bigint, p_versi integer) returns public.panel_catatan
language plpgsql security definer set search_path = public as $$
declare v public.panel_catatan;
begin
  select * into v from public.panel_catatan where id = p_id for update;
  if not found then raise exception 'Catatan % tidak ditemukan', p_id; end if;
  if v.versi <> p_versi then raise exception 'Catatan sudah diubah orang lain - muat ulang dulu' using errcode = 'VTVER'; end if;
  return v;
end $$;

create or replace function public.catatan_ubah(p_aktor jsonb, p_id bigint, p_versi integer, p_proyek text, p_panel_id bigint,
  p_inti text, p_isi text, p_sumber_info text default null, p_penting boolean default false) returns public.panel_catatan
language plpgsql security definer set search_path = public as $$
declare a record; v_wo bigint; v_pn text; l public.panel_catatan; v public.panel_catatan;
begin
  select * into a from public.catatan_aktor(p_aktor);
  l := public.catatan_kunci(p_id, p_versi);
  if l.proyek = p_proyek and l.panel_id is not distinct from p_panel_id then
    v_wo := l.wo_id; v_pn := l.panel_nama;             -- panel sama: tidak divalidasi ulang (panel boleh sudah diarsip)
  else
    select x.wo_id, x.panel_nama into v_wo, v_pn from public.catatan_cek_panel(p_proyek, p_panel_id) x;
  end if;
  update public.panel_catatan set proyek = btrim(p_proyek), wo_id = v_wo, panel_id = p_panel_id, panel_nama = v_pn,
    inti = btrim(p_inti), isi = btrim(p_isi), sumber_info = nullif(btrim(coalesce(p_sumber_info, '')), ''), penting = coalesce(p_penting, false),
    diubah_pada = now(), diubah_oleh = a.nama, versi = versi + 1
   where id = p_id returning * into v;
  insert into public.panel_catatan_log (catatan_id, aksi, oleh, sebelum, sesudah) values (p_id, 'ubah', a.nama, to_jsonb(l), to_jsonb(v));
  return v;
end $$;

-- Sematkan / lepas (tidak menandai "diubah": bukan perubahan isi).
create or replace function public.catatan_set_penting(p_aktor jsonb, p_id bigint, p_versi integer, p_penting boolean) returns public.panel_catatan
language plpgsql security definer set search_path = public as $$
declare a record; l public.panel_catatan; v public.panel_catatan;
begin
  select * into a from public.catatan_aktor(p_aktor);
  l := public.catatan_kunci(p_id, p_versi);
  update public.panel_catatan set penting = coalesce(p_penting, false), versi = versi + 1 where id = p_id returning * into v;
  insert into public.panel_catatan_log (catatan_id, aksi, oleh, sebelum, sesudah) values (p_id, 'penting', a.nama, jsonb_build_object('penting', l.penting), jsonb_build_object('penting', v.penting));
  return v;
end $$;

-- Sudah ditindaklanjuti / aktifkan lagi. Catatan tidak pernah dihapus.
create or replace function public.catatan_set_status(p_aktor jsonb, p_id bigint, p_versi integer, p_status text) returns public.panel_catatan
language plpgsql security definer set search_path = public as $$
declare a record; l public.panel_catatan; v public.panel_catatan;
begin
  select * into a from public.catatan_aktor(p_aktor);
  if p_status not in ('aktif', 'ditindaklanjuti') then raise exception 'Status tidak dikenal: %', p_status; end if;
  l := public.catatan_kunci(p_id, p_versi);
  if l.status = p_status then return l; end if;
  update public.panel_catatan set status = p_status,
    ditindaklanjuti_pada = case when p_status = 'ditindaklanjuti' then now() end,
    ditindaklanjuti_oleh = case when p_status = 'ditindaklanjuti' then a.nama end, versi = versi + 1
   where id = p_id returning * into v;
  insert into public.panel_catatan_log (catatan_id, aksi, oleh, sebelum, sesudah)
  values (p_id, case when p_status = 'ditindaklanjuti' then 'tindaklanjut' else 'aktifkan' end, a.nama,
          jsonb_build_object('status', l.status), jsonb_build_object('status', v.status));
  return v;
end $$;

-- Hak eksekusi: helper tertutup; RPC terbuka (memeriksa aktor sendiri).
revoke execute on function public.catatan_aktor(jsonb), public.catatan_cek_panel(text, bigint), public.catatan_kunci(bigint, integer),
  public.panel_catatan_bunyikan() from public, anon, authenticated;
revoke execute on function public.catatan_daftar(jsonb), public.catatan_simpan(jsonb, text, bigint, text, text, text, boolean),
  public.catatan_ubah(jsonb, bigint, integer, text, bigint, text, text, text, boolean), public.catatan_set_penting(jsonb, bigint, integer, boolean),
  public.catatan_set_status(jsonb, bigint, integer, text) from public;
grant execute on function public.catatan_daftar(jsonb), public.catatan_simpan(jsonb, text, bigint, text, text, text, boolean),
  public.catatan_ubah(jsonb, bigint, integer, text, bigint, text, text, text, boolean), public.catatan_set_penting(jsonb, bigint, integer, boolean),
  public.catatan_set_status(jsonb, bigint, integer, text) to anon, authenticated;

-- ---------- verifikasi otomatis (menulis lalu MEMBATALKAN sendiri lewat galat VTUJI; tidak ada data uji yang tersisa) ----------
do $$
declare adm text; eng text; pnl record; v public.panel_catatan; n int; sv bigint;
begin
  if (select count(*) from pg_policies where tablename in ('panel_catatan', 'panel_catatan_log')) <> 0 then raise exception 'CEK GAGAL: ada policy di tabel catatan'; end if;
  if has_table_privilege('anon', 'public.panel_catatan', 'select') then raise exception 'CEK GAGAL: anon punya hak select'; end if;
  select username into adm from public.admins where coalesce(is_active, true) and coalesce(divisi, 'admin') = 'admin' order by id limit 1;
  select username into eng from public.admins where coalesce(is_active, true) and divisi in ('engineering', 'hrga') order by id limit 1;
  select p.id, w.proyek into pnl from public.panels p join public.work_orders w on w.id = p.wo_id
   where p.deleted_at is null and w.deleted_at is null and not coalesce(w.is_archived, false) order by p.id limit 1;
  begin
    sv := (select versi from public.panel_catatan_sinyal);
    v := public.catatan_simpan(jsonb_build_object('admin', adm), pnl.proyek, pnl.id, 'Uji', 'Uji catatan otomatis', 'SQL', true);
    if v.versi <> 1 or v.status <> 'aktif' or v.panel_nama is null then raise exception 'CEK GAGAL: simpan'; end if;
    if (select versi from public.panel_catatan_sinyal) <= sv then raise exception 'CEK GAGAL: sinyal tidak naik'; end if;
    v := public.catatan_set_status(jsonb_build_object('admin', adm), v.id, 1, 'ditindaklanjuti');
    if v.ditindaklanjuti_oleh is null or v.versi <> 2 then raise exception 'CEK GAGAL: tindak lanjut'; end if;
    begin perform public.catatan_set_penting(jsonb_build_object('admin', adm), v.id, 1, false); raise exception 'CEK GAGAL: versi basi diterima';
    exception when sqlstate 'VTVER' then null; end;
    if eng is not null then
      begin perform public.catatan_daftar(jsonb_build_object('admin', eng)); raise exception 'CEK GAGAL: Engineering/HRGA bisa membaca';
      exception when sqlstate '42501' then null; end;
    end if;
    begin perform public.catatan_simpan(jsonb_build_object('pekerja_id', 1, 'divisi', 'wiring_ctrl'), pnl.proyek, null, 'x', 'operator', null, false);
      raise exception 'CEK GAGAL: identitas operator diterima';
    exception when sqlstate '28000' then null; end;
    select count(*) into n from public.panel_catatan_log where catatan_id = v.id;
    if n <> 2 then raise exception 'CEK GAGAL: log % baris', n; end if;
    raise exception 'uji selesai' using errcode = 'VTUJI';
  exception when sqlstate 'VTUJI' then raise notice 'Verifikasi LULUS (data uji dibatalkan).';
  end;
end $$;

commit;

-- Sesudah commit, cek cepat: (1) select count(*) from panel_catatan; -> 0
-- (2) select tablename, policyname from pg_policies where tablename like 'panel_catatan%'; -> hanya baca_panel_catatan_sinyal

-- ---------- ROLLBACK (hanya sebelum catatan sungguhan dipakai; menghapus semua catatan) ----------
-- begin;
-- drop function if exists public.catatan_set_status(jsonb, bigint, integer, text), public.catatan_set_penting(jsonb, bigint, integer, boolean),
--   public.catatan_ubah(jsonb, bigint, integer, text, bigint, text, text, text, boolean), public.catatan_simpan(jsonb, text, bigint, text, text, text, boolean),
--   public.catatan_daftar(jsonb), public.catatan_kunci(bigint, integer), public.catatan_cek_panel(text, bigint), public.catatan_aktor(jsonb);
-- drop table if exists public.panel_catatan cascade; drop table if exists public.panel_catatan_log; drop table if exists public.panel_catatan_sinyal;
-- drop function if exists public.panel_catatan_bunyikan();
-- commit;
