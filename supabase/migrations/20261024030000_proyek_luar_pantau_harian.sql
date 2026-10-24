-- ============================================================================================
-- PROYEK LUAR: ADMIN MEMANTAU HARIAN (DRAF 24 Okt 2026 - keputusan user "oke lanjut" atas usulan investigasi).
-- Bukti masalah: 7 dari 12 laporan nyata disimpan operator 1-3 hari SESUDAH tanggal kerja (#13 KAKA 12 Okt -> 15 Okt);
-- catatan & foto hanya di memori HP sampai "Simpan Laporan" ditekan.
--  A. aktivitas_pada: waktu terakhir ISI laporan berubah (dibuat / catatan / foto / status / nama). Diisi TRIGGER (semua jalur
--     tulis, termasuk aplikasi lama & RPC tambah_foto_dokumentasi). updated_at TIDAK dipakai: ikut berubah saat admin
--     mengarsip (20 Okt 21.43 sekaligus 9 laporan).
--  B. mulai_laporan_proyek_luar: laporan dibuat SAAT operator mulai (bukan di akhir). Satu laporan per operator per proyek
--     (nama dinormalkan) per tanggal - panggilan ulang (sinyal putus lalu dikirim lagi) mengembalikan laporan yang sama,
--     tidak dobel.
--  C. ubah_catatan_proyek_luar v2: + p_dasar/p_cek_dasar (catatan yang dilihat pengirim - bentrok bila sudah diubah orang lain,
--     tidak ditimpa diam-diam); log berturut-turut oleh orang yang sama dalam 15 menit DIGABUNG (simpan otomatis tidak membanjiri
--     log). Pemanggil lama (5 argumen, aplikasi yang belum dimuat ulang) tetap jalan.
--  D. hapus_foto_proyek_luar + proyek_luar_foto_log: operator (pemilik, selama Berlangsung) / admin menghapus foto; foto yang
--     dihapus disimpan utuh di log (file R2 TIDAK dihapus -> bisa dipulihkan).
--  E. proyek_luar_dilihat_admin + tandai_proyek_luar_dilihat: penanda per admin (pola wo_dilihat_admin).
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi (uji dalam transaksi yang dibatalkan). Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja) - harap: sudah_ada = false; laporan = 15 (atau jumlah sekarang); contoh_aktivitas = isian backfill.
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'proyek_luar' and column_name = 'aktivitas_pada') > 0
         or to_regclass('public.proyek_luar_dilihat_admin') is not null or to_regclass('public.proyek_luar_foto_log') is not null as sudah_ada,
       (select count(*) from public.proyek_luar) as laporan,
       (select string_agg(id || '=' || to_char(greatest(created_at, coalesce(catatan_diubah_pada, created_at),
                 coalesce((select max((f->>'uploaded_at')::timestamptz) from jsonb_array_elements(foto) f where f ? 'uploaded_at'), created_at))
                 at time zone 'Asia/Jakarta', 'DD Mon HH24:MI'), ', ' order by id) from public.proyek_luar) as contoh_aktivitas;

-- (1) EKSEKUSI
begin;
-- A. aktivitas_pada + trigger
alter table public.proyek_luar add column aktivitas_pada timestamptz;
update public.proyek_luar p set aktivitas_pada = greatest(p.created_at, coalesce(p.catatan_diubah_pada, p.created_at),
  coalesce((select max((f->>'uploaded_at')::timestamptz) from jsonb_array_elements(p.foto) f where f ? 'uploaded_at'), p.created_at));
alter table public.proyek_luar alter column aktivitas_pada set default now(), alter column aktivitas_pada set not null;
create index proyek_luar_aktivitas on public.proyek_luar (aktivitas_pada desc);

create or replace function public.proyek_luar_set_aktivitas() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.aktivitas_pada := now();
  elsif new.catatan is distinct from old.catatan or new.foto is distinct from old.foto or new.status is distinct from old.status
        or new.nama_lokasi is distinct from old.nama_lokasi or new.tanggal is distinct from old.tanggal then new.aktivitas_pada := now();
  else new.aktivitas_pada := old.aktivitas_pada;   -- arsip / updated_at saja -> bukan aktivitas (klien tidak bisa menyetel sendiri)
  end if;
  return new;
end $$;
create trigger proyek_luar_aktivitas before insert or update on public.proyek_luar for each row execute function public.proyek_luar_set_aktivitas();

-- B. mulai laporan (idempoten per operator + tanggal + nama dinormalkan)
create or replace function public.mulai_laporan_proyek_luar(p_pekerja_id bigint, p_operator_nama text, p_divisi text, p_nama_lokasi text, p_tanggal date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.proyek_luar; v_nama text := regexp_replace(btrim(coalesce(p_nama_lokasi, '')), '\s+', ' ', 'g');
begin
  if p_pekerja_id is null or coalesce(btrim(p_operator_nama), '') = '' or coalesce(btrim(p_divisi), '') = '' then
    raise exception 'Data operator (id, nama, divisi) wajib diisi' using errcode = '22023'; end if;
  if v_nama = '' then raise exception 'Nama/lokasi proyek wajib diisi' using errcode = '22023'; end if;
  if length(v_nama) > 200 then raise exception 'Nama/lokasi proyek terlalu panjang (maksimal 200 huruf)' using errcode = '22023'; end if;
  if p_tanggal is null then raise exception 'Tanggal wajib diisi' using errcode = '22023'; end if;
  if p_tanggal > (now() at time zone 'Asia/Jakarta')::date + 1 then raise exception 'Tanggal % belum terjadi', p_tanggal using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('proyek_luar|' || p_pekerja_id || '|' || p_tanggal));
  select * into r from public.proyek_luar where pekerja_id = p_pekerja_id and tanggal = p_tanggal and is_archived = false
     and lower(regexp_replace(btrim(nama_lokasi), '\s+', ' ', 'g')) = lower(v_nama) order by id limit 1;
  if r.id is not null then return to_jsonb(r) || jsonb_build_object('baru', false); end if;
  insert into public.proyek_luar (nama_lokasi, tanggal, status, pekerja_id, operator_nama, divisi)
  values (v_nama, p_tanggal, 'berlangsung', p_pekerja_id, btrim(p_operator_nama), btrim(p_divisi)) returning * into r;
  return to_jsonb(r) || jsonb_build_object('baru', true);
end $$;
revoke all on function public.mulai_laporan_proyek_luar(bigint, text, text, text, date) from public;
grant execute on function public.mulai_laporan_proyek_luar(bigint, text, text, text, date) to anon, authenticated;

-- C. ubah catatan v2 (ganti fungsi 5 argumen; argumen baru ber-default -> pemanggil lama tetap cocok)
drop function public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean);
create function public.ubah_catatan_proyek_luar(p_id bigint, p_catatan text, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false,
  p_dasar text default null, p_cek_dasar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.proyek_luar; v_baru text := nullif(btrim(coalesce(p_catatan, '')), ''); v_peran text := case when coalesce(p_admin, false) then 'admin' else 'operator' end;
        v_log bigint;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  if length(coalesce(v_baru, '')) > 5000 then raise exception 'Catatan terlalu panjang (maksimal 5000 huruf)' using errcode = '22023'; end if;
  select * into r from public.proyek_luar where id = p_id for update;
  if r.id is null then raise exception 'Laporan Proyek Luar % tidak ada', p_id using errcode = 'P0002'; end if;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or r.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya pelapor laporan ini yang boleh mengubah catatannya' using errcode = '42501'; end if;
    if r.status <> 'berlangsung' then
      raise exception 'Laporan sudah Selesai - catatan tidak bisa diubah lagi dari aplikasi operator' using errcode = '42501'; end if;
  end if;
  if r.catatan is not distinct from v_baru then return to_jsonb(r); end if;  -- tidak ada perubahan
  if coalesce(p_cek_dasar, false) and r.catatan is distinct from nullif(btrim(coalesce(p_dasar, '')), '') then
    raise exception 'BENTROK: catatan sudah diubah % - muat versi terbaru dulu', coalesce(r.catatan_diubah_oleh, 'orang lain') using errcode = '40001';
  end if;
  select id into v_log from public.proyek_luar_catatan_log
   where proyek_luar_id = r.id and oleh = btrim(p_oleh) and peran = v_peran and waktu > now() - interval '15 minutes'
     and id = (select max(id) from public.proyek_luar_catatan_log where proyek_luar_id = r.id);
  if v_log is not null then update public.proyek_luar_catatan_log set catatan_baru = v_baru, waktu = now() where id = v_log;
  else insert into public.proyek_luar_catatan_log (proyek_luar_id, catatan_lama, catatan_baru, oleh, peran) values (r.id, r.catatan, v_baru, btrim(p_oleh), v_peran);
  end if;
  update public.proyek_luar set catatan = v_baru, catatan_diubah_oleh = btrim(p_oleh), catatan_diubah_pada = now(), updated_at = now()
   where id = r.id returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean, text, boolean) from public;
grant execute on function public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean, text, boolean) to anon, authenticated;

-- D. hapus foto + log awet
create table public.proyek_luar_foto_log (
  id              bigint generated always as identity primary key,
  proyek_luar_id  bigint not null,
  aksi            text not null check (aksi in ('hapus')),
  foto            jsonb not null,          -- objek foto utuh (url, mime, name, thumb, uploaded_at) -> bisa ditempel ulang
  oleh            text not null,
  peran           text not null check (peran in ('admin', 'operator')),
  waktu           timestamptz not null default now()
);
create index proyek_luar_foto_log_id on public.proyek_luar_foto_log (proyek_luar_id, waktu desc);
alter table public.proyek_luar_foto_log enable row level security;
create policy baca_proyek_luar_foto_log on public.proyek_luar_foto_log for select to anon, authenticated using (true);

create or replace function public.hapus_foto_proyek_luar(p_id bigint, p_url text, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.proyek_luar; v_foto jsonb;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  select * into r from public.proyek_luar where id = p_id for update;
  if r.id is null then raise exception 'Laporan Proyek Luar % tidak ada', p_id using errcode = 'P0002'; end if;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or r.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya pelapor laporan ini yang boleh menghapus fotonya' using errcode = '42501'; end if;
    if r.status <> 'berlangsung' then
      raise exception 'Laporan sudah Selesai - foto tidak bisa dihapus dari aplikasi operator' using errcode = '42501'; end if;
  end if;
  select f into v_foto from jsonb_array_elements(coalesce(r.foto, '[]'::jsonb)) f where f->>'url' = p_url limit 1;
  if v_foto is null then return to_jsonb(r) || jsonb_build_object('dihapus', 0); end if;   -- sudah terhapus (kirim ulang) -> aman
  insert into public.proyek_luar_foto_log (proyek_luar_id, aksi, foto, oleh, peran)
  values (r.id, 'hapus', v_foto, btrim(p_oleh), case when coalesce(p_admin, false) then 'admin' else 'operator' end);
  update public.proyek_luar set foto = coalesce((select jsonb_agg(f order by o) from jsonb_array_elements(r.foto) with ordinality x(f, o) where f->>'url' <> p_url), '[]'::jsonb),
         updated_at = now()
   where id = r.id returning * into r;
  return to_jsonb(r) || jsonb_build_object('dihapus', 1);
end $$;
revoke all on function public.hapus_foto_proyek_luar(bigint, text, text, bigint, boolean) from public;
grant execute on function public.hapus_foto_proyek_luar(bigint, text, text, bigint, boolean) to anon, authenticated;

-- E. penanda dilihat per admin
create table public.proyek_luar_dilihat_admin (
  proyek_luar_id bigint not null references public.proyek_luar(id) on delete cascade,
  admin_nama     text not null,
  dilihat_pada   timestamptz not null default now(),
  primary key (proyek_luar_id, admin_nama)
);
alter table public.proyek_luar_dilihat_admin enable row level security;
create policy baca_proyek_luar_dilihat_admin on public.proyek_luar_dilihat_admin for select to anon, authenticated using (true);

create or replace function public.tandai_proyek_luar_dilihat(p_ids bigint[], p_admin text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v timestamptz := clock_timestamp();
begin
  if coalesce(btrim(p_admin), '') = '' then raise exception 'Nama admin wajib diisi' using errcode = '22023'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then return v; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'Maksimal 500 laporan sekali tandai' using errcode = '22023'; end if;
  insert into public.proyek_luar_dilihat_admin (proyek_luar_id, admin_nama, dilihat_pada)
  select p.id, btrim(p_admin), v from public.proyek_luar p where p.id = any(p_ids)
  on conflict (proyek_luar_id, admin_nama) do update set dilihat_pada = excluded.dilihat_pada;
  return v;
end $$;
revoke all on function public.tandai_proyek_luar_dilihat(bigint[], text) from public;
grant execute on function public.tandai_proyek_luar_dilihat(bigint[], text) to anon, authenticated;

-- realtime admin: tabel penanda ikut publikasi (proyek_luar sudah)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'proyek_luar_dilihat_admin') then
    alter publication supabase_realtime add table public.proyek_luar_dilihat_admin;
  end if;
end $$;
commit;

-- (2) VERIFIKASI - uji dalam transaksi yang DIBATALKAN (data tidak berubah). Harap notice 'UJI LULUS' tanpa error, lalu
--     perintah terakhir: aktivitas_kosong = 0, fungsi = 4, trigger = 1, log_foto = 0, dilihat = 0, laporan = sama dgn dry-run.
do $$
declare r jsonb; r2 jsonb; v_id bigint; v_pk bigint; t0 timestamptz; t1 timestamptz; n int;
begin
  select id into v_pk from public.pekerja order by id limit 1;
  -- B: mulai dua kali (nama beda spasi/huruf) -> laporan yang sama
  r  := public.mulai_laporan_proyek_luar(v_pk, '__UJI', 'qc', 'Proyek  Uji  Pantau', (now() at time zone 'Asia/Jakarta')::date);
  r2 := public.mulai_laporan_proyek_luar(v_pk, '__UJI', 'qc', 'proyek uji pantau ', (now() at time zone 'Asia/Jakarta')::date);
  if (r->>'id') <> (r2->>'id') or (r->>'baru')::boolean is not true or (r2->>'baru')::boolean then raise exception 'mulai laporan dobel'; end if;
  v_id := (r->>'id')::bigint;
  -- A: arsip/updated_at tidak menggeser aktivitas; catatan menggeser
  select aktivitas_pada into t0 from public.proyek_luar where id = v_id;
  update public.proyek_luar set updated_at = now() + interval '1 hour', aktivitas_pada = now() - interval '9 day' where id = v_id;
  select aktivitas_pada into t1 from public.proyek_luar where id = v_id;
  if t1 <> t0 then raise exception 'aktivitas berubah karena updated_at/klien'; end if;
  -- C: catatan pertama, lalu simpan otomatis beruntun -> 1 baris log; bentrok ditolak
  perform public.ubah_catatan_proyek_luar(v_id, 'a', '__UJI', v_pk, false, null, true);
  perform public.ubah_catatan_proyek_luar(v_id, 'ab', '__UJI', v_pk, false, 'a', true);
  select count(*) into n from public.proyek_luar_catatan_log where proyek_luar_id = v_id;
  if n <> 1 then raise exception 'log simpan otomatis harus digabung (1), dapat %', n; end if;
  begin perform public.ubah_catatan_proyek_luar(v_id, 'abc', '__UJI_ADMIN', null, true, 'a', true); raise exception 'bentrok seharusnya ditolak';
  exception when serialization_failure then null; end;
  perform public.ubah_catatan_proyek_luar(v_id, 'ab x', '__UJI_ADMIN', null, true);   -- pemanggil lama 5 argumen tetap jalan
  select count(*) into n from public.proyek_luar_catatan_log where proyek_luar_id = v_id;
  if n <> 2 then raise exception 'ganti pengubah harus baris log baru (2), dapat %', n; end if;
  -- D: hapus foto (pemilik), kirim ulang aman, operator lain ditolak
  update public.proyek_luar set foto = '[{"url":"https://x/1.jpg"},{"url":"https://x/2.jpg"}]'::jsonb where id = v_id;
  r := public.hapus_foto_proyek_luar(v_id, 'https://x/1.jpg', '__UJI', v_pk, false);
  r2 := public.hapus_foto_proyek_luar(v_id, 'https://x/1.jpg', '__UJI', v_pk, false);
  if (r->>'dihapus')::int <> 1 or (r2->>'dihapus')::int <> 0 or jsonb_array_length(r->'foto') <> 1 then raise exception 'hapus foto salah: %', r; end if;
  select count(*) into n from public.proyek_luar_foto_log where proyek_luar_id = v_id;
  if n <> 1 then raise exception 'log foto harus 1'; end if;
  begin perform public.hapus_foto_proyek_luar(v_id, 'https://x/2.jpg', '__UJI', -987654, false); raise exception 'operator lain seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  -- E: tandai dilihat
  perform public.tandai_proyek_luar_dilihat(array[v_id], '__UJI_ADMIN');
  select count(*) into n from public.proyek_luar_dilihat_admin where proyek_luar_id = v_id;
  if n <> 1 then raise exception 'tandai dilihat gagal'; end if;
  raise notice 'UJI LULUS';
  raise exception 'batalkan uji' using errcode = 'P0001';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'batalkan uji' then raise; end if;
end $$;
select (select count(*) from public.proyek_luar where aktivitas_pada is null) as aktivitas_kosong,
       (select count(*) from pg_proc where proname in ('mulai_laporan_proyek_luar','ubah_catatan_proyek_luar','hapus_foto_proyek_luar','tandai_proyek_luar_dilihat')) as fungsi,
       (select count(*) from pg_trigger where tgname = 'proyek_luar_aktivitas') as trigger,
       (select count(*) from public.proyek_luar_foto_log) as log_foto,
       (select count(*) from public.proyek_luar_dilihat_admin) as dilihat,
       (select count(*) from public.proyek_luar) as laporan;

-- (3) ROLLBACK (mengembalikan ubah_catatan_proyek_luar versi 20261024020000):
-- begin;
-- alter publication supabase_realtime drop table public.proyek_luar_dilihat_admin;
-- drop function if exists public.tandai_proyek_luar_dilihat(bigint[], text);
-- drop table if exists public.proyek_luar_dilihat_admin;
-- drop function if exists public.hapus_foto_proyek_luar(bigint, text, text, bigint, boolean);
-- drop table if exists public.proyek_luar_foto_log;
-- drop function if exists public.mulai_laporan_proyek_luar(bigint, text, text, text, date);
-- drop trigger if exists proyek_luar_aktivitas on public.proyek_luar;
-- drop function if exists public.proyek_luar_set_aktivitas();
-- alter table public.proyek_luar drop column if exists aktivitas_pada;
-- drop function if exists public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean, text, boolean);
-- -- lalu jalankan ulang blok "create or replace function public.ubah_catatan_proyek_luar ..." + revoke/grant dari
-- -- supabase/migrations/20261024020000_proyek_luar_edit_catatan.sql
-- commit;
