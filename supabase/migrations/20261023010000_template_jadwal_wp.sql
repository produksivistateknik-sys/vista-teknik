-- TEMPLATE JADWAL WP untuk auto-tata FCS (22 Okt 2026). DIJALANKAN USER di SQL Editor per blok.
-- Sumber seed: TEMPLATE WP.xlsx (10 sheet = 4 pola). "-" di file = TIDAK ADA baris.
-- Satu baris = (tipe_panel, proses, wp) -> hari ke-n (Day n, hari kerja; Day 1 = tanggal mulai FCS).
-- BUSBAR / WIRING CONTROL / WIRING POWER / QC TEST / PACKING TIDAK di tabel ini (aturan turunan di kode:
-- wiring+busbar = hari PASANG KOMPONEN paling awal; QC/PACKING = H-1 target WO).
-- Baca: semua (anon). Tulis: HANYA lewat RPC simpan_template_jadwal_wp (validasi urutan + log).
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).

-- (0) DRY-RUN (baca saja). Harapan: 0 baris (tabel belum ada) dan 9 tipe ada di panel_type_meta.
select to_regclass('public.template_jadwal_wp') as tabel_sudah_ada, to_regclass('public.template_jadwal_wp_log') as log_sudah_ada;
select tipe_panel from public.panel_type_meta
 where tipe_panel in ('FS','F3B','FS_SS','OU_FS','WM_MS','WM_SS','BOX_KOSONG WM','OU_WM.MS','WM_POLY') order by 1;  -- harap 9 baris

-- (1) EKSEKUSI
begin;
create table if not exists public.template_jadwal_wp (
  tipe_panel  text not null,
  proses      text not null check (proses in ('POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','PASANG KOMPONEN')),
  wp          text not null check (wp ~ '^WP[1-9]$'),
  hari        smallint not null check (hari between 1 and 60),
  diubah_oleh text,
  diubah_pada timestamptz not null default now(),
  primary key (tipe_panel, proses, wp)
);
alter table public.template_jadwal_wp enable row level security;
drop policy if exists baca_template_jadwal_wp on public.template_jadwal_wp;
create policy baca_template_jadwal_wp on public.template_jadwal_wp for select to anon, authenticated using (true);

create table if not exists public.template_jadwal_wp_log (
  id          bigint generated always as identity primary key,
  tipe_panel  text not null,
  sebelum     jsonb not null,
  sesudah     jsonb not null,
  oleh        text not null,
  alasan      text,
  dibuat_pada timestamptz not null default now()
);
alter table public.template_jadwal_wp_log enable row level security;
drop policy if exists baca_template_jadwal_wp_log on public.template_jadwal_wp_log;
create policy baca_template_jadwal_wp_log on public.template_jadwal_wp_log for select to anon, authenticated using (true);

-- Seed: 4 pola x pemetaan tipe. FS MS -> FS, FS FORM 3B -> F3B, FS SS -> FS_SS, OU FS -> OU_FS,
-- WM MS -> WM_MS, WM SS -> WM_SS, BOX KOSONG WM -> BOX_KOSONG WM, OU WM MS -> OU_WM.MS, WM POLY -> WM_POLY.
-- BOX KOSONG FS belum punya tipe di panel_type_meta -> tidak di-seed (pakai pola FS saat tipe dibuat).
with pola(pola, proses, wp, hari) as (values
  ('FS','POTONG','WP1',1),('FS','POTONG','WP2',2),('FS','POTONG','WP3',3),('FS','POTONG','WP4',5),
  ('FS','BENDING','WP1',1),('FS','BENDING','WP2',2),('FS','BENDING','WP3',3),('FS','BENDING','WP4',5),
  ('FS','STEL','WP1',2),('FS','STEL','WP2',3),('FS','STEL','WP3',4),
  ('FS','FINISHING','WP1',2),('FS','FINISHING','WP2',3),('FS','FINISHING','WP3',4),
  ('FS','RENDAM','WP1',3),('FS','RENDAM','WP2',4),('FS','RENDAM','WP3',5),('FS','RENDAM','WP4',6),
  ('FS','PAINTING','WP1',3),('FS','PAINTING','WP2',4),('FS','PAINTING','WP3',5),('FS','PAINTING','WP4',6),
  ('FS','RAKIT','WP1',4),('FS','RAKIT','WP2',5),('FS','RAKIT','WP3',6),('FS','RAKIT','WP4',7),
  ('FS','PASANG KOMPONEN','WP1',5),('FS','PASANG KOMPONEN','WP2',6),
  ('WM','POTONG','WP1',1),('WM','POTONG','WP2',1),('WM','POTONG','WP3',5),('WM','POTONG','WP4',2),
  ('WM','BENDING','WP1',1),('WM','BENDING','WP2',1),('WM','BENDING','WP3',5),('WM','BENDING','WP4',2),
  ('WM','STEL','WP2',2),('WM','STEL','WP4',3),
  ('WM','FINISHING','WP2',2),('WM','FINISHING','WP4',3),
  ('WM','RENDAM','WP1',2),('WM','RENDAM','WP2',2),('WM','RENDAM','WP3',5),('WM','RENDAM','WP4',3),
  ('WM','PAINTING','WP1',2),('WM','PAINTING','WP2',2),('WM','PAINTING','WP3',5),('WM','PAINTING','WP4',3),
  ('WM','RAKIT','WP1',3),('WM','RAKIT','WP2',3),('WM','RAKIT','WP3',6),('WM','RAKIT','WP4',4),
  ('WM','PASANG KOMPONEN','WP1',4),('WM','PASANG KOMPONEN','WP2',4),
  ('OUWM','POTONG','WP1',1),('OUWM','POTONG','WP2',1),('OUWM','POTONG','WP3',3),
  ('OUWM','BENDING','WP1',1),('OUWM','BENDING','WP2',1),('OUWM','BENDING','WP3',3),
  ('OUWM','STEL','WP2',2),('OUWM','STEL','WP3',4),
  ('OUWM','FINISHING','WP2',2),('OUWM','FINISHING','WP3',4),
  ('OUWM','RENDAM','WP1',2),('OUWM','RENDAM','WP2',2),('OUWM','RENDAM','WP3',5),
  ('OUWM','PAINTING','WP1',2),('OUWM','PAINTING','WP2',2),('OUWM','PAINTING','WP3',5),
  ('OUWM','RAKIT','WP1',3),('OUWM','RAKIT','WP2',3),('OUWM','RAKIT','WP3',6),
  ('OUWM','PASANG KOMPONEN','WP1',4),('OUWM','PASANG KOMPONEN','WP2',4),
  ('POLY','POTONG','WP1',1),('POLY','POTONG','WP2',1),('POLY','POTONG','WP3',3),('POLY','POTONG','WP4',4),
  ('POLY','BENDING','WP1',1),('POLY','BENDING','WP2',1),('POLY','BENDING','WP3',3),('POLY','BENDING','WP4',4),
  ('POLY','STEL','WP2',2),('POLY','STEL','WP3',4),('POLY','STEL','WP4',5),
  ('POLY','FINISHING','WP2',2),('POLY','FINISHING','WP3',4),('POLY','FINISHING','WP4',5),
  ('POLY','RENDAM','WP1',2),('POLY','RENDAM','WP2',2),('POLY','RENDAM','WP3',5),('POLY','RENDAM','WP4',6),
  ('POLY','PAINTING','WP1',2),('POLY','PAINTING','WP2',2),('POLY','PAINTING','WP3',5),('POLY','PAINTING','WP4',6),
  ('POLY','RAKIT','WP1',3),('POLY','RAKIT','WP2',3),('POLY','RAKIT','WP3',6),('POLY','RAKIT','WP4',7),
  ('POLY','PASANG KOMPONEN','WP1',4),('POLY','PASANG KOMPONEN','WP2',4)
), peta(tipe_panel, pola) as (values
  ('FS','FS'),('F3B','FS'),('FS_SS','FS'),('OU_FS','FS'),
  ('WM_MS','WM'),('WM_SS','WM'),('BOX_KOSONG WM','WM'),
  ('OU_WM.MS','OUWM'),('WM_POLY','POLY')
)
insert into public.template_jadwal_wp (tipe_panel, proses, wp, hari, diubah_oleh)
select m.tipe_panel, p.proses, p.wp, p.hari, 'seed TEMPLATE WP.xlsx'
  from peta m join pola p on p.pola = m.pola
on conflict (tipe_panel, proses, wp) do nothing;

-- RPC simpan (editor admin): ganti seluruh baris satu tipe, tolak bila urutan terbalik, catat log.
create or replace function public.simpan_template_jadwal_wp(p_tipe text, p_baris jsonb, p_oleh text, p_alasan text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_sebelum jsonb; v_salah text; v_n integer;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'p_oleh wajib'; end if;
  if jsonb_typeof(p_baris) <> 'array' then raise exception 'p_baris harus array'; end if;
  perform pg_advisory_xact_lock(hashtext('template_jadwal_wp|' || p_tipe));
  select coalesce(jsonb_agg(jsonb_build_object('proses', proses, 'wp', wp, 'hari', hari) order by proses, wp), '[]')
    into v_sebelum from public.template_jadwal_wp where tipe_panel = p_tipe;
  delete from public.template_jadwal_wp where tipe_panel = p_tipe;
  insert into public.template_jadwal_wp (tipe_panel, proses, wp, hari, diubah_oleh)
  select p_tipe, b->>'proses', b->>'wp', (b->>'hari')::smallint, p_oleh from jsonb_array_elements(p_baris) b;
  get diagnostics v_n = row_count;
  -- urutan: proses tidak boleh lebih awal dari pendahulunya (tabel urutan_proses) di WP yang sama
  select string_agg(format('%s %s hari %s < %s hari %s', t.wp, t.proses, t.hari, p.proses, p.hari), '; ') into v_salah
    from public.template_jadwal_wp t
    join public.urutan_proses u on u.proses = t.proses
    join public.template_jadwal_wp p on p.tipe_panel = t.tipe_panel and p.wp = t.wp and p.proses = any(u.pendahulu)
   where t.tipe_panel = p_tipe and p.hari > t.hari;
  if v_salah is not null then raise exception 'Urutan proses terbalik: %', v_salah; end if;
  insert into public.template_jadwal_wp_log (tipe_panel, sebelum, sesudah, oleh, alasan)
  values (p_tipe, v_sebelum, coalesce(p_baris, '[]'), p_oleh, p_alasan);
  return v_n;
end $$;
revoke all on function public.simpan_template_jadwal_wp(text, jsonb, text, text) from public;
grant execute on function public.simpan_template_jadwal_wp(text, jsonb, text, text) to anon, authenticated;
commit;

-- (2) VERIFIKASI
--  a. jumlah baris per tipe. Harap: FS 28, F3B 28, FS_SS 28, OU_FS 28, WM_MS 26, WM_SS 26, BOX_KOSONG WM 26,
--     OU_WM.MS 21, WM_POLY 28 (total 239).
select tipe_panel, count(*) from public.template_jadwal_wp group by 1 order by 1;
--  b. urutan terbalik di seed (harap 0 baris)
select t.tipe_panel, t.wp, t.proses, t.hari, p.proses as pendahulu, p.hari as hari_pendahulu
  from public.template_jadwal_wp t join public.urutan_proses u on u.proses = t.proses
  join public.template_jadwal_wp p on p.tipe_panel = t.tipe_panel and p.wp = t.wp and p.proses = any(u.pendahulu)
 where p.hari > t.hari;
--  c. contoh pola FS (bandingkan dgn file): WP1..WP4 per proses
select proses, string_agg(wp || '=' || hari, ' ' order by wp) from public.template_jadwal_wp where tipe_panel = 'FS' group by proses order by min(hari), proses;
--  d. RPC menolak urutan terbalik (harap ERROR "Urutan proses terbalik", tidak ada perubahan krn transaksi batal)
-- select public.simpan_template_jadwal_wp('FS', '[{"proses":"POTONG","wp":"WP1","hari":3},{"proses":"BENDING","wp":"WP1","hari":1}]', 'uji', 'uji tolak');

-- (3) ROLLBACK (bila keliru) - tabel baru, tidak ada data lain yang disentuh:
-- begin;
-- drop function if exists public.simpan_template_jadwal_wp(text, jsonb, text, text);
-- drop table if exists public.template_jadwal_wp_log;
-- drop table if exists public.template_jadwal_wp;
-- commit;
