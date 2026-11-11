-- 20261111010000_admin_dilihat.sql - PENANDA BARU/DIUBAH KENDALA & CATATAN per admin (11 Nov 2026).
-- Jalankan SEKALI di Supabase SQL Editor (Run). Berhasil = NOTICE "Verifikasi LULUS ...". Gagal di tengah = seluruh file batal.
-- Hanya Kendala & Catatan (keputusan user): wo_dilihat_admin & proyek_luar_dilihat_admin TIDAK disentuh.
-- Satu mekanisme GENERIK (jenis + ref_id) utk Kendala & Catatan (dan fitur berikutnya). Pola sama dgn wo_dilihat_admin /
-- proyek_luar_dilihat_admin (per nama admin, dilihat_pada); dua tabel lama itu TIDAK dipindah (risiko regresi).
-- Item BARU utk admin X = dibuat SESUDAH batas X utk jenis itu, BUKAN buatan X sendiri, dan belum punya baris admin_dilihat.
-- Batas (watermark) per admin per jenis: diisi saat rilis = now() utk semua admin -> item lama TIDAK mendadak BARU; admin baru
-- mendapat batas saat pertama membuka (mulai_lacak_dilihat) -> tidak dibanjiri riwayat. "Tandai semua" = majukan batas.
begin;

do $$ begin
  if to_regclass('public.admin_dilihat') is not null then raise exception 'admin_dilihat sudah ada - batal'; end if;
  if to_regclass('public.admins') is null then raise exception 'tabel admins tidak ditemukan - batal'; end if;
end $$;

create table public.admin_dilihat (
  jenis        text not null check (jenis in ('kendala', 'catatan')),
  ref_id       bigint not null,
  admin_nama   text not null check (length(btrim(admin_nama)) > 0),
  dilihat_pada timestamptz not null default now(),
  primary key (jenis, admin_nama, ref_id)
);
create table public.admin_dilihat_batas (
  jenis      text not null check (jenis in ('kendala', 'catatan')),
  admin_nama text not null check (length(btrim(admin_nama)) > 0),
  batas      timestamptz not null default now(),
  primary key (jenis, admin_nama)
);
alter table public.admin_dilihat enable row level security;
alter table public.admin_dilihat_batas enable row level security;
-- Hanya id & waktu (tanpa isi catatan) -> boleh dibaca anon, sama dgn wo_dilihat_admin. Tulis HANYA lewat RPC.
create policy baca_admin_dilihat on public.admin_dilihat for select to anon, authenticated using (true);
create policy baca_admin_dilihat_batas on public.admin_dilihat_batas for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.admin_dilihat, public.admin_dilihat_batas from anon, authenticated;
grant select on public.admin_dilihat, public.admin_dilihat_batas to anon, authenticated;

-- Nilai awal rilis: semua admin aktif divisi admin -> batas = sekarang utk kedua jenis (item lama tidak BARU).
insert into public.admin_dilihat_batas (jenis, admin_nama, batas)
select j, btrim(a.nama), now() from public.admins a cross join (values ('kendala'), ('catatan')) v(j)
 where coalesce(a.is_active, true) and coalesce(a.divisi, 'admin') = 'admin' and coalesce(btrim(a.nama), '') <> ''
on conflict do nothing;

create or replace function public.dilihat_cek_admin(p_admin text) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(btrim(p_admin), '') = '' then raise exception 'Nama admin wajib diisi' using errcode = '28000'; end if;
  return btrim(p_admin);
end $$;

-- Admin pertama kali membuka (akun baru): batas = sekarang bila belum ada. Mengembalikan batas.
create or replace function public.mulai_lacak_dilihat(p_jenis text, p_admin text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare a text := public.dilihat_cek_admin(p_admin); v timestamptz;
begin
  insert into public.admin_dilihat_batas (jenis, admin_nama) values (p_jenis, a) on conflict do nothing;
  select batas into v from public.admin_dilihat_batas where jenis = p_jenis and admin_nama = a;
  return v;
end $$;

-- Klik kartu (semua item kartu) / tombol aksi item (satu item). Idempoten.
create or replace function public.tandai_dilihat(p_jenis text, p_ref_ids bigint[], p_admin text) returns integer
language plpgsql security definer set search_path = public as $$
declare a text := public.dilihat_cek_admin(p_admin); n int;
begin
  if p_ref_ids is null or cardinality(p_ref_ids) = 0 then return 0; end if;
  if cardinality(p_ref_ids) > 500 then raise exception 'Maksimal 500 item sekali tandai'; end if;
  insert into public.admin_dilihat (jenis, ref_id, admin_nama)
  select distinct p_jenis, x, a from unnest(p_ref_ids) x where x is not null   -- id dobel dibuang (ON CONFLICT tidak boleh menyentuh baris 2x)
  on conflict (jenis, admin_nama, ref_id) do update set dilihat_pada = excluded.dilihat_pada;
  get diagnostics n = row_count;
  return n;
end $$;

-- "Tandai semua sudah dilihat": batas maju ke sekarang, baris per item lama tidak diperlukan lagi (dibersihkan).
create or replace function public.tandai_semua_dilihat(p_jenis text, p_admin text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare a text := public.dilihat_cek_admin(p_admin); v timestamptz := clock_timestamp();
begin
  insert into public.admin_dilihat_batas (jenis, admin_nama, batas) values (p_jenis, a, v)
  on conflict (jenis, admin_nama) do update set batas = greatest(admin_dilihat_batas.batas, excluded.batas);
  delete from public.admin_dilihat where jenis = p_jenis and admin_nama = a;
  return v;
end $$;

revoke execute on function public.dilihat_cek_admin(text) from public, anon, authenticated;
grant execute on function public.mulai_lacak_dilihat(text, text), public.tandai_dilihat(text, bigint[], text),
  public.tandai_semua_dilihat(text, text) to anon, authenticated;

-- verifikasi (menulis lalu MEMBATALKAN sendiri lewat VTUJI)
do $$
declare n_batas int; v timestamptz; n int;
begin
  select count(*) into n_batas from public.admin_dilihat_batas;
  if n_batas = 0 then raise exception 'CEK GAGAL: batas awal tidak terisi'; end if;
  if has_table_privilege('anon', 'public.admin_dilihat', 'insert') then raise exception 'CEK GAGAL: anon bisa insert'; end if;
  begin
    v := public.mulai_lacak_dilihat('kendala', 'UJI_VERIFIKASI');
    if v is null then raise exception 'CEK GAGAL: mulai_lacak'; end if;
    n := public.tandai_dilihat('kendala', array[1, 2, 2]::bigint[], 'UJI_VERIFIKASI');
    if (select count(*) from public.admin_dilihat where admin_nama = 'UJI_VERIFIKASI') <> 2 then raise exception 'CEK GAGAL: tandai_dilihat'; end if;
    perform public.tandai_semua_dilihat('kendala', 'UJI_VERIFIKASI');
    if exists (select 1 from public.admin_dilihat where admin_nama = 'UJI_VERIFIKASI') then raise exception 'CEK GAGAL: tandai semua tidak membersihkan'; end if;
    begin perform public.tandai_dilihat('lain', array[1]::bigint[], 'UJI_VERIFIKASI'); raise exception 'CEK GAGAL: jenis tak dikenal diterima';
    exception when check_violation then null; end;
    raise exception 'uji selesai' using errcode = 'VTUJI';
  exception when sqlstate 'VTUJI' then null;
  end;
  raise notice 'Verifikasi LULUS: % baris batas awal (item lama tidak BARU), RPC jalan, data uji dibatalkan.', n_batas;
end $$;

commit;

-- ROLLBACK (penanda BARU hilang; data kendala/catatan tidak tersentuh). Hapus tanda '-- ' lalu Run:
-- begin;
-- drop function if exists public.tandai_semua_dilihat(text, text), public.tandai_dilihat(text, bigint[], text),
--   public.mulai_lacak_dilihat(text, text), public.dilihat_cek_admin(text);
-- drop table if exists public.admin_dilihat, public.admin_dilihat_batas;
-- commit;
