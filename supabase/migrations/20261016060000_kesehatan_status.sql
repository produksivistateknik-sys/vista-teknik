-- ============================================================================================
-- KESEHATAN DATA - status kelompok error & tunda cek (16 Okt 2026, permintaan user: "supaya daftar tidak terus penuh")
-- (1) kesehatan_status_error : status per kelompok error (sidik log_error_app): baru | ditangani | selesai | diabaikan,
--     + catatan, versi build saat ditandai, siapa/kapan, jumlah kejadian saat ditandai, tanda "muncul lagi".
-- (2) Buka kembali otomatis (trigger di log_error_app): kelompok berstatus SELESAI yang terjadi lagi SESUDAH waktu
--     ditandai pada versi build SAMA ATAU LEBIH BARU dari versi saat ditandai -> status kembali BARU + muncul_lagi.
--     Kejadian dari versi LEBIH LAMA (HP/tab yang belum dimuat ulang) tidak membuka kembali.
-- (3) kesehatan_tunda_cek : tunda cek Peringatan/Info sampai 7 hari, Kritis maks 24 jam (dipaksa di server), + jumlah
--     temuan saat ditunda. Halaman menampilkan lagi cek yang ditunda kalau jumlah naik melebihi jumlah saat ditunda
--     atau masa tunda habis.
-- (4) Semua penulisan lewat RPC SECURITY DEFINER (tabel hanya bisa dibaca aplikasi) & dicatat di activity_log.
-- Tabel produksi tidak berubah (log_error_app hanya diberi trigger; isinya tidak diubah).
-- Rollback: supabase/rollback/20261016060000_kesehatan_status_rollback.sql
-- ============================================================================================
begin;

create table if not exists public.kesehatan_status_error (
  sidik text primary key,
  aplikasi text,
  status text not null default 'baru' check (status in ('baru', 'ditangani', 'selesai', 'diabaikan')),
  catatan text,
  versi_ditandai text,
  jumlah_saat_ditandai int not null default 0,
  ditandai_oleh text,
  ditandai_pada timestamptz,
  muncul_lagi boolean not null default false,
  muncul_lagi_pada timestamptz,
  muncul_lagi_versi text
);

create table if not exists public.kesehatan_tunda_cek (
  kode text primary key references public.kesehatan_cek(kode) on delete cascade,
  sampai timestamptz not null,
  jumlah_saat_tunda int,
  status_saat_tunda text,
  catatan text,
  ditunda_oleh text,
  ditunda_pada timestamptz not null default now()
);

alter table public.kesehatan_status_error enable row level security;
alter table public.kesehatan_tunda_cek enable row level security;
drop policy if exists baca_kesehatan_status_error on public.kesehatan_status_error;
create policy baca_kesehatan_status_error on public.kesehatan_status_error for select to anon, authenticated using (true);
drop policy if exists baca_kesehatan_tunda_cek on public.kesehatan_tunda_cek;
create policy baca_kesehatan_tunda_cek on public.kesehatan_tunda_cek for select to anon, authenticated using (true);

-- versi build = cap waktu (angka); bukan angka -> dianggap tidak bisa dibandingkan
create or replace function public._versi_angka(p text) returns numeric language sql immutable as $$
  select case when p ~ '^[0-9]{6,20}$' then p::numeric else null end
$$;

-- ── tandai status kelompok error ───────────────────────────────────────────────────────────
create or replace function public.tandai_status_error(p_sidik text, p_status text, p_catatan text, p_versi text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_app text; v_pesan text; v_jumlah int; v_lama text;
begin
  if p_status not in ('baru', 'ditangani', 'selesai', 'diabaikan') then
    raise exception 'Status tidak dikenal: %', p_status using errcode = 'P0001';
  end if;
  select max(aplikasi), (array_agg(pesan order by waktu_terakhir desc))[1], coalesce(sum(jumlah), 0)::int
    into v_app, v_pesan, v_jumlah from public.log_error_app where sidik = p_sidik;
  if v_app is null then raise exception 'Kelompok error % tidak ditemukan', p_sidik using errcode = 'P0002'; end if;
  select status into v_lama from public.kesehatan_status_error where sidik = p_sidik;
  insert into public.kesehatan_status_error (sidik, aplikasi, status, catatan, versi_ditandai, jumlah_saat_ditandai, ditandai_oleh, ditandai_pada, muncul_lagi, muncul_lagi_pada, muncul_lagi_versi)
  values (p_sidik, v_app, p_status, left(nullif(trim(p_catatan), ''), 500), left(nullif(trim(p_versi), ''), 40), v_jumlah,
          left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), now(), false, null, null)
  on conflict (sidik) do update set status = excluded.status, catatan = excluded.catatan, versi_ditandai = excluded.versi_ditandai,
    jumlah_saat_ditandai = excluded.jumlah_saat_ditandai, ditandai_oleh = excluded.ditandai_oleh, ditandai_pada = excluded.ditandai_pada,
    muncul_lagi = false, muncul_lagi_pada = null, muncul_lagi_versi = null;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), 'STATUS ERROR APLIKASI',
    format('%s -> %s | %s | %s | versi %s | %s kejadian s.d. ditandai%s', coalesce(v_lama, 'baru'), p_status, v_app, left(v_pesan, 160),
           coalesce(nullif(trim(p_versi), ''), '-'), v_jumlah, case when nullif(trim(p_catatan), '') is not null then ' | catatan: ' || left(trim(p_catatan), 300) else '' end),
    'system_error', 'Kesehatan Data');
  return jsonb_build_object('sidik', p_sidik, 'status', p_status, 'jumlah_saat_ditandai', v_jumlah);
end $$;
grant execute on function public.tandai_status_error(text, text, text, text, text) to anon, authenticated;

-- ── buka kembali otomatis ───────────────────────────────────────────────────────────────────
create or replace function public._buka_lagi_status_error() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.kesehatan_status_error where sidik = new.sidik and status = 'selesai';
  if not found then return new; end if;
  -- hanya kejadian SESUDAH ditandai
  if new.waktu_terakhir <= s.ditandai_pada then return new; end if;
  -- versi lebih lama dari versi saat ditandai (HP/tab belum dimuat ulang) -> tidak membuka kembali
  if public._versi_angka(s.versi_ditandai) is not null and public._versi_angka(new.versi) is not null
     and public._versi_angka(new.versi) < public._versi_angka(s.versi_ditandai) then
    return new;
  end if;
  update public.kesehatan_status_error set status = 'baru', muncul_lagi = true, muncul_lagi_pada = new.waktu_terakhir, muncul_lagi_versi = new.versi
   where sidik = new.sidik;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Sistem (otomatis)', 'STATUS ERROR APLIKASI',
    format('selesai -> baru (MUNCUL LAGI) | %s | %s | versi %s (ditandai selesai di versi %s oleh %s)', new.aplikasi, left(new.pesan, 160),
           coalesce(new.versi, '-'), coalesce(s.versi_ditandai, '-'), coalesce(s.ditandai_oleh, '-')),
    'system_error', 'Kesehatan Data');
  return new;
end $$;
drop trigger if exists trg_buka_lagi_status_error on public.log_error_app;
create trigger trg_buka_lagi_status_error after insert or update of jumlah, waktu_terakhir on public.log_error_app
  for each row execute function public._buka_lagi_status_error();

-- ── tunda cek ───────────────────────────────────────────────────────────────────────────────
-- p_jam: lama tunda (jam). Peringatan/Info maks 168 (7 hari); Kritis (atau Cek gagal) maks 24 - dipaksa di sini.
create or replace function public.tunda_cek_kesehatan(p_kode text, p_jam int, p_catatan text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hasil record; v_maks int; v_jam int;
begin
  select status, jumlah into v_hasil from public.kesehatan_hasil where kode = p_kode order by waktu desc, id desc limit 1;
  if not found then raise exception 'Cek % belum pernah dijalankan', p_kode using errcode = 'P0002'; end if;
  if v_hasil.status = 'ok' then raise exception 'Cek % sedang Aman, tidak perlu ditunda', p_kode using errcode = 'P0001'; end if;
  v_maks := case when v_hasil.status in ('kritis', 'error') then 24 else 168 end;
  v_jam := greatest(1, least(coalesce(p_jam, v_maks), v_maks));
  insert into public.kesehatan_tunda_cek (kode, sampai, jumlah_saat_tunda, status_saat_tunda, catatan, ditunda_oleh, ditunda_pada)
  values (p_kode, now() + make_interval(hours => v_jam), v_hasil.jumlah, v_hasil.status, left(nullif(trim(p_catatan), ''), 500),
          left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), now())
  on conflict (kode) do update set sampai = excluded.sampai, jumlah_saat_tunda = excluded.jumlah_saat_tunda, status_saat_tunda = excluded.status_saat_tunda,
    catatan = excluded.catatan, ditunda_oleh = excluded.ditunda_oleh, ditunda_pada = excluded.ditunda_pada;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), 'TUNDA CEK KESEHATAN',
    format('%s ditunda %s jam (status %s, %s temuan)%s', p_kode, v_jam, v_hasil.status, coalesce(v_hasil.jumlah::text, '-'),
           case when nullif(trim(p_catatan), '') is not null then ' | catatan: ' || left(trim(p_catatan), 300) else '' end),
    'system_error', 'Kesehatan Data');
  return jsonb_build_object('kode', p_kode, 'jam', v_jam, 'jumlah_saat_tunda', v_hasil.jumlah);
end $$;
grant execute on function public.tunda_cek_kesehatan(text, int, text, text) to anon, authenticated;

create or replace function public.batal_tunda_cek_kesehatan(p_kode text, p_oleh text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.kesehatan_tunda_cek where kode = p_kode;
  if found then
    insert into public.activity_log (user_name, action, description, module, halaman)
    values (left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), 'TUNDA CEK KESEHATAN', p_kode || ' tunda dibatalkan', 'system_error', 'Kesehatan Data');
  end if;
end $$;
grant execute on function public.batal_tunda_cek_kesehatan(text, text) to anon, authenticated;

commit;
