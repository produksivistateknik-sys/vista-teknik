-- ============================================================================================
-- PENANDA "BARU" (hijau) & "REVISI" (kuning) DI MANAJEMEN WO (DRAF 23 Okt 2026 - menunggu konfirmasi user, BELUM dijalankan).
--  Status dihitung di aplikasi PER ADMIN (nama akun login) PER RECORD WO:
--   - BARU   : lacak_baru = true  DAN admin belum punya baris di wo_dilihat_admin.
--   - REVISI : revisi_pada > dilihat_pada admin itu (atau belum pernah dilihat & revisi_pada terisi).
--   - normal : selain itu.
--  "Membuka" (klik ▶ / Edit) -> RPC tandai_wo_dilihat. Pelaku revisi/pembuat WO otomatis dianggap sudah melihat.
--  Revisi dicatat APLIKASI di titik simpan (Edit WO Manajemen WO & WO Digital) lewat RPC catat_revisi_wo - BUKAN trigger:
--  trigger tidak bisa membedakan split per tanggal kirim / pembuatan WO baru dari revisi (keduanya insert panel).
--  updated_at work_orders TIDAK dipakai (tidak pernah diisi: 0 dari 53 WO berbeda dari created_at).
--  WO lama (sebelum fitur): lacak_baru = false -> tidak ada yang hijau saat rilis.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi (uji dalam transaksi yang dibatalkan). Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja) - harap: kolom_sudah_ada=false, tabel_sudah_ada=false, wo_total = jumlah WO sekarang (53).
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'work_orders'
          and column_name in ('revisi_pada','revisi_oleh','revisi_ringkas','dibuat_oleh','lacak_baru')) > 0 as kolom_sudah_ada,
       to_regclass('public.wo_dilihat_admin') is not null as tabel_sudah_ada,
       (select count(*) from public.work_orders) as wo_total,
       (select count(*) from public.work_orders where is_archived is not true and deleted_at is null) as wo_aktif;

-- (1) EKSEKUSI
begin;
alter table public.work_orders
  add column revisi_pada    timestamptz,               -- revisi terakhir (deadline/proyek/qty panel/panel +-/WO revisi)
  add column revisi_oleh    text,
  add column revisi_ringkas text,                      -- mis. "deadline 26 Okt -> 2 Nov; +1 panel"
  add column dibuat_oleh    text,                      -- diisi aplikasi saat Tambah WO (dulu tidak ada kolom pembuat)
  add column lacak_baru     boolean not null default true;
update public.work_orders set lacak_baru = false;      -- semua WO yang SUDAH ada dianggap sudah dilihat (tidak hijau)

create table public.wo_dilihat_admin (
  wo_id        bigint not null references public.work_orders(id) on delete cascade,
  admin_nama   text not null,
  dilihat_pada timestamptz not null default now(),
  primary key (wo_id, admin_nama)
);
create table public.wo_revisi_log (                     -- jejak awet (activity_log hanya ~1 minggu)
  id       bigint generated always as identity primary key,
  wo_id    bigint not null,
  wo       text,
  proyek   text,
  oleh     text not null,
  ringkas  text,
  waktu    timestamptz not null default now()
);
create index wo_revisi_log_wo on public.wo_revisi_log (wo_id, waktu desc);
alter table public.wo_dilihat_admin enable row level security;
alter table public.wo_revisi_log enable row level security;
create policy baca_wo_dilihat_admin on public.wo_dilihat_admin for select to anon, authenticated using (true);
create policy baca_wo_revisi_log on public.wo_revisi_log for select to anon, authenticated using (true);

-- Admin membuka WO (klik ▶ / Edit).
create or replace function public.tandai_wo_dilihat(p_wo_id bigint, p_admin text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v timestamptz := clock_timestamp();
begin
  if coalesce(btrim(p_admin), '') = '' then raise exception 'Nama admin wajib diisi'; end if;
  if not exists (select 1 from public.work_orders where id = p_wo_id) then raise exception 'WO % tidak ada', p_wo_id; end if;
  insert into public.wo_dilihat_admin (wo_id, admin_nama, dilihat_pada) values (p_wo_id, btrim(p_admin), v)
  on conflict (wo_id, admin_nama) do update set dilihat_pada = excluded.dilihat_pada;
  return v;
end $$;

-- Revisi WO (dipanggil aplikasi setelah simpan berhasil, hanya bila ada perubahan yang dihitung revisi).
-- Pelaku langsung dianggap sudah melihat (dilihat_pada sedikit sesudah revisi_pada).
create or replace function public.catat_revisi_wo(p_wo_id bigint, p_oleh text, p_ringkas text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v timestamptz := clock_timestamp(); w public.work_orders;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi'; end if;
  update public.work_orders set revisi_pada = v, revisi_oleh = btrim(p_oleh), revisi_ringkas = nullif(btrim(p_ringkas), '')
   where id = p_wo_id returning * into w;
  if w.id is null then raise exception 'WO % tidak ada', p_wo_id; end if;
  insert into public.wo_revisi_log (wo_id, wo, proyek, oleh, ringkas) values (w.id, w.wo, w.proyek, btrim(p_oleh), nullif(btrim(p_ringkas), ''));
  insert into public.wo_dilihat_admin (wo_id, admin_nama, dilihat_pada) values (w.id, btrim(p_oleh), v + interval '1 millisecond')
  on conflict (wo_id, admin_nama) do update set dilihat_pada = excluded.dilihat_pada;
  return to_jsonb(w);
end $$;

-- WO baru dibuat (Tambah WO / split per tanggal kirim). p_split = true -> record pecahan tidak ditandai BARU.
-- Pembuat langsung dianggap sudah melihat.
create or replace function public.catat_wo_dibuat(p_wo_id bigint, p_oleh text, p_split boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pembuat wajib diisi'; end if;
  update public.work_orders set dibuat_oleh = coalesce(dibuat_oleh, btrim(p_oleh)), lacak_baru = not coalesce(p_split, false) where id = p_wo_id;
  if not found then raise exception 'WO % tidak ada', p_wo_id; end if;
  insert into public.wo_dilihat_admin (wo_id, admin_nama, dilihat_pada) values (p_wo_id, btrim(p_oleh), clock_timestamp())
  on conflict (wo_id, admin_nama) do update set dilihat_pada = excluded.dilihat_pada;
end $$;

revoke all on function public.tandai_wo_dilihat(bigint, text) from public;
revoke all on function public.catat_revisi_wo(bigint, text, text) from public;
revoke all on function public.catat_wo_dibuat(bigint, text, boolean) from public;
grant execute on function public.tandai_wo_dilihat(bigint, text) to anon, authenticated;
grant execute on function public.catat_revisi_wo(bigint, text, text) to anon, authenticated;
grant execute on function public.catat_wo_dibuat(bigint, text, boolean) to anon, authenticated;

-- Realtime: status kartu & badge ikut berubah tanpa muat ulang (aplikasi juga polling cadangan - lib/pemulihRealtime).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wo_dilihat_admin') then
    alter publication supabase_realtime add table public.wo_dilihat_admin;
  end if;
end $$;
commit;

-- (2) VERIFIKASI - uji alur dalam transaksi yang DIBATALKAN (tidak meninggalkan data). Harap notice 'UJI LULUS' tanpa error,
--     lalu perintah terakhir: wo_lama_lacak_baru = 0, kolom_ada = 5, fungsi_ada = 3.
do $$
declare w bigint; d1 timestamptz; r timestamptz; dl timestamptz;
begin
  select id into w from public.work_orders order by id limit 1;
  d1 := public.tandai_wo_dilihat(w, '__UJI_A');
  perform public.catat_revisi_wo(w, '__UJI_B', 'uji');
  select revisi_pada into r from public.work_orders where id = w;
  if not (r > d1) then raise exception 'revisi_pada harus sesudah dilihat A'; end if;                       -- A melihat REVISI
  select dilihat_pada into dl from public.wo_dilihat_admin where wo_id = w and admin_nama = '__UJI_B';
  if not (dl > r) then raise exception 'pelaku revisi harus dianggap sudah melihat'; end if;              -- B normal
  perform public.tandai_wo_dilihat(w, '__UJI_A');
  select dilihat_pada into d1 from public.wo_dilihat_admin where wo_id = w and admin_nama = '__UJI_A';
  if not (d1 > r) then raise exception 'setelah dibuka A harus normal'; end if;
  begin perform public.tandai_wo_dilihat(w, ' '); raise exception 'nama kosong seharusnya ditolak'; exception when raise_exception then
    if sqlerrm not like 'Nama admin%' then raise; end if; end;
  raise notice 'UJI LULUS';
  raise exception 'batalkan uji' using errcode = 'P0001';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'batalkan uji' then raise; end if;
end $$;
select (select count(*) from public.work_orders where lacak_baru) as wo_lama_lacak_baru,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'work_orders'
          and column_name in ('revisi_pada','revisi_oleh','revisi_ringkas','dibuat_oleh','lacak_baru')) as kolom_ada,
       (select count(*) from pg_proc where proname in ('tandai_wo_dilihat','catat_revisi_wo','catat_wo_dibuat')) as fungsi_ada;

-- (3) ROLLBACK:
-- begin;
-- drop function if exists public.tandai_wo_dilihat(bigint, text);
-- drop function if exists public.catat_revisi_wo(bigint, text, text);
-- drop function if exists public.catat_wo_dibuat(bigint, text, boolean);
-- drop table if exists public.wo_dilihat_admin;
-- drop table if exists public.wo_revisi_log;
-- alter table public.work_orders drop column if exists revisi_pada, drop column if exists revisi_oleh,
--   drop column if exists revisi_ringkas, drop column if exists dibuat_oleh, drop column if exists lacak_baru;
-- commit;
