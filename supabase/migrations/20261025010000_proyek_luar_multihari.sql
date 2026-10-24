-- ============================================================================================
-- PROYEK LUAR MULTI-HARI (24 Okt 2026, keputusan user): 1 proyek = beberapa ENTRI HARIAN.
--  proyek_luar        = PROYEK (id & baris lama dipertahankan -> penanda dilihat admin, path foto R2, Word lama tetap).
--                       + lokasi (data lama = nama_lokasi, WAJIB terisi), pembuat, selesai_oleh/pada, hapus lunak.
--  proyek_luar_entri  = ENTRI: tanggal hari kerja WIB (boleh pilih mundur, tidak boleh masa depan), penulis (pekerja),
--                       catatan, foto, jejak ubah, hapus lunak. SATU entri per proyek + tanggal + operator.
--  Hak akses (RPC security definer, konvensi aplikasi tanpa Supabase Auth - nama/peran dikirim aplikasi):
--   - operator hanya proyek DIVISI SENDIRI (kode divisi sama persis) yang Berlangsung & tidak dihapus;
--   - catatan/foto/hapus entri: penulis entri, selama proyek Berlangsung; admin: semua;
--   - Selesai: pembuat proyek / admin; buka kembali: admin; hapus proyek: pembuat (hanya bila belum ada entri operator
--     lain) / admin; pulihkan: admin. Semua aksi tercatat (proyek_luar_aksi_log / _catatan_log / _foto_log).
--  Data lama: tiap laporan -> 1 proyek + 1 entri legacy (foto ikut tanggal laporan, BUKAN tanggal unggah). Tanpa penggabungan.
--  Masa transisi: HP versi lama tetap menulis kolom lama proyek_luar.catatan/foto/insert (termasuk antrean foto di HP)
--  -> trigger CERMIN menyalin ke entri legacy. Pengetatan (cabut tulis langsung anon, buang cermin) = migrasi terpisah nanti.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi (uji dalam transaksi yang dibatalkan). Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja) - harap: sudah_ada = false; proyek = jumlah laporan sekarang; foto = total foto.
select to_regclass('public.proyek_luar_entri') is not null as sudah_ada,
       count(*) as proyek, count(*) filter (where status = 'berlangsung' and not is_archived) as berlangsung_aktif,
       sum(jsonb_array_length(coalesce(foto, '[]'::jsonb))) as foto,
       count(*) filter (where coalesce(btrim(nama_lokasi), '') = '') as nama_kosong
from public.proyek_luar;

-- (1) EKSEKUSI
begin;
-- ── A. kolom proyek ──
alter table public.proyek_luar
  add column lokasi             text,
  add column dibuat_pekerja_id  bigint,
  add column dibuat_oleh        text,
  add column selesai_oleh       text,
  add column selesai_pada       timestamptz,
  add column dihapus_oleh       text,
  add column dihapus_pada       timestamptz;
update public.proyek_luar set lokasi = nama_lokasi, dibuat_pekerja_id = pekerja_id, dibuat_oleh = operator_nama;
update public.proyek_luar set selesai_pada = updated_at where status = 'selesai';
alter table public.proyek_luar alter column lokasi set not null;

-- ── B. entri harian ──
create table public.proyek_luar_entri (
  id                  bigint generated always as identity primary key,
  proyek_id           bigint not null references public.proyek_luar(id) on delete cascade,
  tanggal             date not null,
  pekerja_id          bigint references public.pekerja(id),
  operator_nama       text not null,
  divisi              text not null,
  catatan             text,
  foto                jsonb not null default '[]'::jsonb,
  catatan_diubah_oleh text,
  catatan_diubah_pada timestamptz,
  dihapus_oleh        text,
  dihapus_pada        timestamptz,
  legacy              boolean not null default false,
  created_at          timestamptz not null default now(),
  aktivitas_pada      timestamptz not null default now()
);
create unique index proyek_luar_entri_unik on public.proyek_luar_entri (proyek_id, tanggal, pekerja_id) where dihapus_pada is null;
create index proyek_luar_entri_proyek on public.proyek_luar_entri (proyek_id, tanggal);
create index proyek_luar_entri_divisi on public.proyek_luar_entri (divisi);
alter table public.proyek_luar_entri enable row level security;
create policy baca_proyek_luar_entri on public.proyek_luar_entri for select to anon, authenticated using (true);

insert into public.proyek_luar_entri (proyek_id, tanggal, pekerja_id, operator_nama, divisi, catatan, foto,
  catatan_diubah_oleh, catatan_diubah_pada, legacy, created_at, aktivitas_pada)
select id, tanggal, pekerja_id, operator_nama, divisi, catatan, coalesce(foto, '[]'::jsonb),
       catatan_diubah_oleh, catatan_diubah_pada, true, created_at, aktivitas_pada
from public.proyek_luar;

-- ── C. log ──
alter table public.proyek_luar_catatan_log add column entri_id bigint;
alter table public.proyek_luar_foto_log add column entri_id bigint;
update public.proyek_luar_catatan_log l set entri_id = e.id from public.proyek_luar_entri e where e.proyek_id = l.proyek_luar_id and e.legacy;
create table public.proyek_luar_aksi_log (
  id         bigint generated always as identity primary key,
  proyek_id  bigint not null,
  entri_id   bigint,
  aksi       text not null,          -- selesai / buka_kembali / hapus_entri / hapus_proyek / pulihkan_entri / pulihkan_proyek / ubah_info
  oleh       text not null,
  peran      text not null check (peran in ('admin', 'operator')),
  data       jsonb,
  waktu      timestamptz not null default now()
);
create index proyek_luar_aksi_log_proyek on public.proyek_luar_aksi_log (proyek_id, waktu desc);
alter table public.proyek_luar_aksi_log enable row level security;
create policy baca_proyek_luar_aksi_log on public.proyek_luar_aksi_log for select to anon, authenticated using (true);

-- ── D. trigger aktivitas ──
create or replace function public.proyek_luar_set_aktivitas() returns trigger language plpgsql as $$
begin
  if coalesce(btrim(new.lokasi), '') = '' then new.lokasi := new.nama_lokasi; end if;   -- lokasi tidak pernah kosong (aplikasi lama tidak mengirim)
  if tg_op = 'INSERT' then new.aktivitas_pada := now();
  elsif current_setting('vista.aktivitas_dari_entri', true) = '1' then null;            -- dinaikkan oleh entri
  elsif new.catatan is distinct from old.catatan or new.foto is distinct from old.foto or new.status is distinct from old.status
        or new.nama_lokasi is distinct from old.nama_lokasi or new.tanggal is distinct from old.tanggal
        or new.lokasi is distinct from old.lokasi or new.dihapus_pada is distinct from old.dihapus_pada then new.aktivitas_pada := now();
  else new.aktivitas_pada := old.aktivitas_pada;
  end if;
  return new;
end $$;

create or replace function public.proyek_luar_entri_set_aktivitas() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.aktivitas_pada := now();
  elsif new.catatan is distinct from old.catatan or new.foto is distinct from old.foto or new.tanggal is distinct from old.tanggal
        or new.dihapus_pada is distinct from old.dihapus_pada then new.aktivitas_pada := now();
  else new.aktivitas_pada := old.aktivitas_pada;
  end if;
  return new;
end $$;
create trigger proyek_luar_entri_aktivitas before insert or update on public.proyek_luar_entri for each row execute function public.proyek_luar_entri_set_aktivitas();

create or replace function public.proyek_luar_entri_naikkan_proyek() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.aktivitas_pada is not distinct from old.aktivitas_pada then return new; end if;
  perform set_config('vista.aktivitas_dari_entri', '1', true);
  update public.proyek_luar set aktivitas_pada = greatest(aktivitas_pada, new.aktivitas_pada), updated_at = now() where id = new.proyek_id;
  perform set_config('vista.aktivitas_dari_entri', '', true);
  return new;
end $$;
create trigger proyek_luar_entri_naikkan after insert or update on public.proyek_luar_entri for each row execute function public.proyek_luar_entri_naikkan_proyek();

-- ── E. CERMIN masa transisi (aplikasi lama -> entri legacy) ──
create or replace function public.proyek_luar_cermin_entri() returns trigger language plpgsql as $$
begin
  if current_setting('vista.proyek_baru', true) = '1' then return new; end if;   -- RPC baru membuat entri sendiri
  if tg_op = 'INSERT' then
    insert into public.proyek_luar_entri (proyek_id, tanggal, pekerja_id, operator_nama, divisi, catatan, foto, legacy)
    values (new.id, new.tanggal, new.pekerja_id, new.operator_nama, new.divisi, new.catatan, coalesce(new.foto, '[]'::jsonb), true);
    update public.proyek_luar set dibuat_pekerja_id = coalesce(dibuat_pekerja_id, new.pekerja_id), dibuat_oleh = coalesce(dibuat_oleh, new.operator_nama) where id = new.id;
  else
    update public.proyek_luar_entri set catatan = new.catatan, foto = coalesce(new.foto, '[]'::jsonb), tanggal = new.tanggal,
           catatan_diubah_oleh = new.catatan_diubah_oleh, catatan_diubah_pada = new.catatan_diubah_pada
     where proyek_id = new.id and legacy and dihapus_pada is null;
  end if;
  return new;
end $$;
create trigger proyek_luar_cermin_insert after insert on public.proyek_luar for each row execute function public.proyek_luar_cermin_entri();
create trigger proyek_luar_cermin_update after update of catatan, foto, tanggal on public.proyek_luar for each row execute function public.proyek_luar_cermin_entri();

-- ── F. RPC ──
create or replace function public.pl_hari_kerja() returns date language sql stable as $$
  select ((now() at time zone 'Asia/Jakarta') - interval '7 hours')::date   -- 00.00-06.59 WIB = hari sebelumnya
$$;

create or replace function public.buka_entri_proyek_luar(p_proyek_id bigint, p_pekerja_id bigint, p_operator_nama text, p_divisi text, p_tanggal date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.proyek_luar; e public.proyek_luar_entri;
begin
  if p_pekerja_id is null or coalesce(btrim(p_operator_nama), '') = '' or coalesce(btrim(p_divisi), '') = '' then
    raise exception 'Data operator (id, nama, divisi) wajib diisi' using errcode = '22023'; end if;
  if p_tanggal is null then raise exception 'Tanggal wajib diisi' using errcode = '22023'; end if;
  if p_tanggal > public.pl_hari_kerja() then raise exception 'Tanggal % belum terjadi (hari kerja sekarang %)', p_tanggal, public.pl_hari_kerja() using errcode = '22023'; end if;
  select * into p from public.proyek_luar where id = p_proyek_id for update;
  if p.id is null then raise exception 'Proyek Luar % tidak ada', p_proyek_id using errcode = 'P0002'; end if;
  if p.dihapus_pada is not null then raise exception 'Proyek ini sudah dihapus' using errcode = '42501'; end if;
  if p.status <> 'berlangsung' then raise exception 'Proyek sudah Selesai - tidak bisa menambah pekerjaan' using errcode = '42501'; end if;
  if p.divisi <> btrim(p_divisi) then raise exception 'Proyek ini milik divisi lain' using errcode = '42501'; end if;
  select * into e from public.proyek_luar_entri where proyek_id = p.id and tanggal = p_tanggal and pekerja_id = p_pekerja_id and dihapus_pada is null;
  if e.id is not null then return to_jsonb(e) || jsonb_build_object('baru', false); end if;
  insert into public.proyek_luar_entri (proyek_id, tanggal, pekerja_id, operator_nama, divisi)
  values (p.id, p_tanggal, p_pekerja_id, btrim(p_operator_nama), btrim(p_divisi)) returning * into e;
  return to_jsonb(e) || jsonb_build_object('baru', true);
end $$;

create or replace function public.buat_proyek_luar(p_pekerja_id bigint, p_operator_nama text, p_divisi text, p_nama text, p_lokasi text, p_tanggal date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.proyek_luar; v_nama text := regexp_replace(btrim(coalesce(p_nama, '')), '\s+', ' ', 'g');
        v_lok text := regexp_replace(btrim(coalesce(p_lokasi, '')), '\s+', ' ', 'g'); v_baru boolean := false; e jsonb;
begin
  if p_pekerja_id is null or coalesce(btrim(p_operator_nama), '') = '' or coalesce(btrim(p_divisi), '') = '' then
    raise exception 'Data operator (id, nama, divisi) wajib diisi' using errcode = '22023'; end if;
  if v_nama = '' then raise exception 'Nama proyek wajib diisi' using errcode = '22023'; end if;
  if v_lok = '' then raise exception 'Lokasi proyek wajib diisi' using errcode = '22023'; end if;
  if length(v_nama) > 200 or length(v_lok) > 200 then raise exception 'Nama/lokasi terlalu panjang (maksimal 200 huruf)' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal > public.pl_hari_kerja() then raise exception 'Tanggal tidak valid' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('proyek_luar_buat|' || p_pekerja_id));
  -- kirim ulang (sinyal putus) -> proyek Berlangsung yang sama milik operator ini, tidak dobel
  select * into p from public.proyek_luar where dibuat_pekerja_id = p_pekerja_id and divisi = btrim(p_divisi) and status = 'berlangsung'
     and dihapus_pada is null and lower(regexp_replace(btrim(nama_lokasi), '\s+', ' ', 'g')) = lower(v_nama) order by id desc limit 1;
  if p.id is null then
    perform set_config('vista.proyek_baru', '1', true);
    insert into public.proyek_luar (nama_lokasi, lokasi, tanggal, status, pekerja_id, operator_nama, divisi, dibuat_pekerja_id, dibuat_oleh)
    values (v_nama, v_lok, p_tanggal, 'berlangsung', p_pekerja_id, btrim(p_operator_nama), btrim(p_divisi), p_pekerja_id, btrim(p_operator_nama)) returning * into p;
    perform set_config('vista.proyek_baru', '', true);
    v_baru := true;
  end if;
  e := public.buka_entri_proyek_luar(p.id, p_pekerja_id, p_operator_nama, p_divisi, p_tanggal);
  select * into p from public.proyek_luar where id = p.id;
  return jsonb_build_object('proyek', to_jsonb(p), 'entri', e, 'proyek_baru', v_baru);
end $$;

create or replace function public.ubah_catatan_entri_proyek_luar(p_entri_id bigint, p_catatan text, p_oleh text, p_pekerja_id bigint default null,
  p_admin boolean default false, p_dasar text default null, p_cek_dasar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.proyek_luar_entri; p public.proyek_luar; v_baru text := nullif(btrim(coalesce(p_catatan, '')), '');
        v_peran text := case when coalesce(p_admin, false) then 'admin' else 'operator' end; v_log bigint;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  if length(coalesce(v_baru, '')) > 5000 then raise exception 'Catatan terlalu panjang (maksimal 5000 huruf)' using errcode = '22023'; end if;
  select * into e from public.proyek_luar_entri where id = p_entri_id for update;
  if e.id is null then raise exception 'Entri Proyek Luar % tidak ada', p_entri_id using errcode = 'P0002'; end if;
  if e.dihapus_pada is not null then raise exception 'Entri ini sudah dihapus' using errcode = '42501'; end if;
  select * into p from public.proyek_luar where id = e.proyek_id;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or e.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya penulis entri ini yang boleh mengubah catatannya' using errcode = '42501'; end if;
    if p.status <> 'berlangsung' or p.dihapus_pada is not null then
      raise exception 'Proyek sudah Selesai - catatan tidak bisa diubah lagi dari aplikasi operator' using errcode = '42501'; end if;
  end if;
  if e.catatan is not distinct from v_baru then return to_jsonb(e); end if;
  if coalesce(p_cek_dasar, false) and e.catatan is distinct from nullif(btrim(coalesce(p_dasar, '')), '') then
    raise exception 'BENTROK: catatan sudah diubah % - muat versi terbaru dulu', coalesce(e.catatan_diubah_oleh, 'orang lain') using errcode = 'PT409';
  end if;
  select id into v_log from public.proyek_luar_catatan_log
   where entri_id = e.id and oleh = btrim(p_oleh) and peran = v_peran and waktu > now() - interval '15 minutes'
     and id = (select max(id) from public.proyek_luar_catatan_log where entri_id = e.id);
  if v_log is not null then update public.proyek_luar_catatan_log set catatan_baru = v_baru, waktu = now() where id = v_log;
  else insert into public.proyek_luar_catatan_log (proyek_luar_id, entri_id, catatan_lama, catatan_baru, oleh, peran) values (e.proyek_id, e.id, e.catatan, v_baru, btrim(p_oleh), v_peran);
  end if;
  update public.proyek_luar_entri set catatan = v_baru, catatan_diubah_oleh = btrim(p_oleh), catatan_diubah_pada = now() where id = e.id returning * into e;
  return to_jsonb(e);
end $$;

create or replace function public.hapus_foto_entri_proyek_luar(p_entri_id bigint, p_url text, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.proyek_luar_entri; p public.proyek_luar; v_foto jsonb;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  select * into e from public.proyek_luar_entri where id = p_entri_id for update;
  if e.id is null then raise exception 'Entri Proyek Luar % tidak ada', p_entri_id using errcode = 'P0002'; end if;
  select * into p from public.proyek_luar where id = e.proyek_id;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or e.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya penulis entri ini yang boleh menghapus fotonya' using errcode = '42501'; end if;
    if p.status <> 'berlangsung' or p.dihapus_pada is not null or e.dihapus_pada is not null then
      raise exception 'Proyek sudah Selesai - foto tidak bisa dihapus dari aplikasi operator' using errcode = '42501'; end if;
  end if;
  select f into v_foto from jsonb_array_elements(e.foto) f where f->>'url' = p_url limit 1;
  if v_foto is null then return to_jsonb(e) || jsonb_build_object('dihapus', 0); end if;
  insert into public.proyek_luar_foto_log (proyek_luar_id, entri_id, aksi, foto, oleh, peran)
  values (e.proyek_id, e.id, 'hapus', v_foto, btrim(p_oleh), case when coalesce(p_admin, false) then 'admin' else 'operator' end);
  update public.proyek_luar_entri set foto = coalesce((select jsonb_agg(f order by o) from jsonb_array_elements(e.foto) with ordinality x(f, o) where f->>'url' <> p_url), '[]'::jsonb)
   where id = e.id returning * into e;
  return to_jsonb(e) || jsonb_build_object('dihapus', 1);
end $$;

create or replace function public.ubah_status_proyek_luar(p_proyek_id bigint, p_status text, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.proyek_luar; v_peran text := case when coalesce(p_admin, false) then 'admin' else 'operator' end;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  if p_status not in ('selesai', 'berlangsung') then raise exception 'Status % tidak dikenal', p_status using errcode = '22023'; end if;
  select * into p from public.proyek_luar where id = p_proyek_id for update;
  if p.id is null then raise exception 'Proyek Luar % tidak ada', p_proyek_id using errcode = 'P0002'; end if;
  if p.dihapus_pada is not null then raise exception 'Proyek ini sudah dihapus' using errcode = '42501'; end if;
  if p.status = p_status then return to_jsonb(p); end if;
  if p_status = 'selesai' and not coalesce(p_admin, false) and p.dibuat_pekerja_id is distinct from p_pekerja_id then
    raise exception 'Hanya pembuat proyek (%) atau admin yang boleh menandai Selesai', coalesce(p.dibuat_oleh, '-') using errcode = '42501'; end if;
  if p_status = 'berlangsung' and not coalesce(p_admin, false) then
    raise exception 'Proyek yang sudah Selesai hanya bisa dibuka kembali oleh admin' using errcode = '42501'; end if;
  update public.proyek_luar set status = p_status, updated_at = now(),
         selesai_oleh = case when p_status = 'selesai' then btrim(p_oleh) end, selesai_pada = case when p_status = 'selesai' then now() end
   where id = p.id returning * into p;
  insert into public.proyek_luar_aksi_log (proyek_id, aksi, oleh, peran) values (p.id, case when p_status = 'selesai' then 'selesai' else 'buka_kembali' end, btrim(p_oleh), v_peran);
  return to_jsonb(p);
end $$;

create or replace function public.hapus_entri_proyek_luar(p_entri_id bigint, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.proyek_luar_entri; p public.proyek_luar;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  select * into e from public.proyek_luar_entri where id = p_entri_id for update;
  if e.id is null then raise exception 'Entri Proyek Luar % tidak ada', p_entri_id using errcode = 'P0002'; end if;
  if e.dihapus_pada is not null then return to_jsonb(e); end if;
  select * into p from public.proyek_luar where id = e.proyek_id;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or e.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya penulis entri ini yang boleh menghapusnya' using errcode = '42501'; end if;
    if p.status <> 'berlangsung' or p.dihapus_pada is not null then
      raise exception 'Proyek sudah Selesai - entri tidak bisa dihapus dari aplikasi operator' using errcode = '42501'; end if;
  end if;
  update public.proyek_luar_entri set dihapus_oleh = btrim(p_oleh), dihapus_pada = now() where id = e.id returning * into e;
  insert into public.proyek_luar_aksi_log (proyek_id, entri_id, aksi, oleh, peran, data)
  values (e.proyek_id, e.id, 'hapus_entri', btrim(p_oleh), case when coalesce(p_admin, false) then 'admin' else 'operator' end,
          jsonb_build_object('tanggal', e.tanggal, 'operator', e.operator_nama, 'foto', jsonb_array_length(e.foto)));
  return to_jsonb(e);
end $$;

create or replace function public.hapus_proyek_luar(p_proyek_id bigint, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.proyek_luar; v_lain int;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  select * into p from public.proyek_luar where id = p_proyek_id for update;
  if p.id is null then raise exception 'Proyek Luar % tidak ada', p_proyek_id using errcode = 'P0002'; end if;
  if p.dihapus_pada is not null then return to_jsonb(p); end if;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or p.dibuat_pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya pembuat proyek yang boleh menghapusnya' using errcode = '42501'; end if;
    if p.status <> 'berlangsung' then raise exception 'Proyek sudah Selesai - tidak bisa dihapus dari aplikasi operator' using errcode = '42501'; end if;
    select count(*) into v_lain from public.proyek_luar_entri where proyek_id = p.id and dihapus_pada is null and pekerja_id is distinct from p_pekerja_id;
    if v_lain > 0 then raise exception 'Proyek tidak bisa dihapus: sudah ada % entri dari operator lain. Hapus entri Anda saja, atau minta admin.', v_lain using errcode = '42501'; end if;
  end if;
  update public.proyek_luar set dihapus_oleh = btrim(p_oleh), dihapus_pada = now(), updated_at = now() where id = p.id returning * into p;
  insert into public.proyek_luar_aksi_log (proyek_id, aksi, oleh, peran) values (p.id, 'hapus_proyek', btrim(p_oleh), case when coalesce(p_admin, false) then 'admin' else 'operator' end);
  return to_jsonb(p);
end $$;

create or replace function public.pulihkan_proyek_luar(p_proyek_id bigint, p_entri_id bigint, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.proyek_luar; e public.proyek_luar_entri;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama admin wajib diisi' using errcode = '22023'; end if;
  if p_entri_id is not null then
    select * into e from public.proyek_luar_entri where id = p_entri_id for update;
    if e.id is null then raise exception 'Entri % tidak ada', p_entri_id using errcode = 'P0002'; end if;
    if exists (select 1 from public.proyek_luar_entri where proyek_id = e.proyek_id and tanggal = e.tanggal and pekerja_id = e.pekerja_id and dihapus_pada is null and id <> e.id) then
      raise exception 'Tidak bisa dipulihkan: % sudah membuat entri baru untuk tanggal %', e.operator_nama, e.tanggal using errcode = '23505'; end if;
    update public.proyek_luar_entri set dihapus_oleh = null, dihapus_pada = null where id = e.id returning * into e;
    insert into public.proyek_luar_aksi_log (proyek_id, entri_id, aksi, oleh, peran) values (e.proyek_id, e.id, 'pulihkan_entri', btrim(p_oleh), 'admin');
    return to_jsonb(e);
  end if;
  update public.proyek_luar set dihapus_oleh = null, dihapus_pada = null, updated_at = now() where id = p_proyek_id returning * into p;
  if p.id is null then raise exception 'Proyek Luar % tidak ada', p_proyek_id using errcode = 'P0002'; end if;
  insert into public.proyek_luar_aksi_log (proyek_id, aksi, oleh, peran) values (p.id, 'pulihkan_proyek', btrim(p_oleh), 'admin');
  return to_jsonb(p);
end $$;

create or replace function public.ubah_info_proyek_luar(p_proyek_id bigint, p_nama text, p_lokasi text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.proyek_luar; v_nama text := regexp_replace(btrim(coalesce(p_nama, '')), '\s+', ' ', 'g'); v_lok text := regexp_replace(btrim(coalesce(p_lokasi, '')), '\s+', ' ', 'g');
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama admin wajib diisi' using errcode = '22023'; end if;
  if v_nama = '' or v_lok = '' then raise exception 'Nama dan lokasi proyek wajib diisi' using errcode = '22023'; end if;
  select * into p from public.proyek_luar where id = p_proyek_id for update;
  if p.id is null then raise exception 'Proyek Luar % tidak ada', p_proyek_id using errcode = 'P0002'; end if;
  if p.nama_lokasi = v_nama and p.lokasi = v_lok then return to_jsonb(p); end if;
  insert into public.proyek_luar_aksi_log (proyek_id, aksi, oleh, peran, data)
  values (p.id, 'ubah_info', btrim(p_oleh), 'admin', jsonb_build_object('nama_lama', p.nama_lokasi, 'lokasi_lama', p.lokasi, 'nama', v_nama, 'lokasi', v_lok));
  update public.proyek_luar set nama_lokasi = v_nama, lokasi = v_lok, updated_at = now() where id = p.id returning * into p;
  return to_jsonb(p);
end $$;

do $$ declare f text; begin
  foreach f in array array['buka_entri_proyek_luar(bigint, bigint, text, text, date)', 'buat_proyek_luar(bigint, text, text, text, text, date)',
    'ubah_catatan_entri_proyek_luar(bigint, text, text, bigint, boolean, text, boolean)', 'hapus_foto_entri_proyek_luar(bigint, text, text, bigint, boolean)',
    'ubah_status_proyek_luar(bigint, text, text, bigint, boolean)', 'hapus_entri_proyek_luar(bigint, text, bigint, boolean)',
    'hapus_proyek_luar(bigint, text, bigint, boolean)', 'pulihkan_proyek_luar(bigint, bigint, text)', 'ubah_info_proyek_luar(bigint, text, text, text)'] loop
    execute 'revoke all on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to anon, authenticated';
  end loop;
end $$;

-- ── G. foto entri: tambah_foto_dokumentasi menerima tujuan 'proyek_luar_entri' (isi lain IDENTIK 20261019020000) ──
create or replace function public.tambah_foto_dokumentasi(
  p_tujuan text, p_id bigint, p_kunci text, p_foto jsonb, p_tahap text default null, p_ke_arsip boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_kolom_ok constant text[] := array['nameplate_photos','yellowmark_photos','qs_photos','warehouse_photos','pasang_komponen_photos'];
  v_tabel text; v_lama jsonb; v_baru jsonb; v_tambah jsonb; v_n int; v_ada boolean;
begin
  -- ── validasi isi ──
  -- (19 Okt 2026) batas 20 -> 80 per panggilan (= MAKS_FOTO_PER_SIMPAN klien vista-pekerja lib/siapkanMedia). Insiden 19 Okt
  -- 09.30: BAGAS 57 foto Proyek Luar 14 terunggah tapi ditolak "1-20 foto". Pesan dalam bahasa Indonesia (tampil ke operator).
  if p_foto is null or jsonb_typeof(p_foto) <> 'array' or jsonb_array_length(p_foto) = 0 then
    raise exception 'Tidak ada foto yang dikirim untuk disimpan.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_foto) > 80 then
    raise exception 'Terlalu banyak foto dalam satu kali simpan: % foto, maksimal 80. Simpan sebagian dulu, lalu tambahkan sisanya.', jsonb_array_length(p_foto) using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_foto) f
             where jsonb_typeof(f) <> 'object' or coalesce(f->>'url', '') !~ '^https?://' or length(f->>'url') > 1000) then
    raise exception 'tambah_foto_dokumentasi: tiap foto wajib objek dgn url http(s)' using errcode = '22023';
  end if;
  if p_tujuan not in ('kolom','qc','komponen','proyek_luar','proyek_luar_entri','mom_fat_poin') then
    raise exception 'tambah_foto_dokumentasi: tujuan % tidak dikenal', p_tujuan using errcode = '22023';
  end if;
  if p_tujuan = 'kolom' and not (p_kunci = any(v_kolom_ok)) then
    raise exception 'tambah_foto_dokumentasi: kolom % tidak diizinkan', p_kunci using errcode = '22023';
  end if;
  if p_tujuan in ('qc','komponen') and coalesce(p_kunci, '') = '' then
    raise exception 'tambah_foto_dokumentasi: p_kunci (item QC / kode komponen) wajib' using errcode = '22023';
  end if;

  -- ── tabel tujuan: panels, kalau tidak ada -> panels_archived ──
  if p_tujuan in ('kolom','qc','komponen') then
    if exists (select 1 from public.panels where id = p_id) then v_tabel := 'panels';
    elsif exists (select 1 from public.panels_archived where id = p_id) then v_tabel := 'panels_archived';
    else return jsonb_build_object('ditemukan', false, 'ditambah', 0);
    end if;
  else
    v_tabel := p_tujuan;
    execute format('select exists (select 1 from public.%I where id = $1)', v_tabel) into v_ada using p_id;
    if not v_ada then return jsonb_build_object('ditemukan', false, 'ditambah', 0); end if;
  end if;

  -- ── ambil array lama (DIKUNCI baris: FOR UPDATE) ──
  if p_tujuan = 'kolom' then
    execute format('select coalesce(%I, ''[]''::jsonb) from public.%I where id = $1 for update', p_kunci, v_tabel) into v_lama using p_id;
  elsif p_tujuan = 'qc' then
    execute format('select coalesce(qc_checklist -> $2 -> ''foto'', ''[]''::jsonb) from public.%I where id = $1 for update', v_tabel) into v_lama using p_id, p_kunci;
  elsif p_tujuan = 'komponen' then
    execute format('select coalesce(checklist -> $2 -> ''fotoPemasangan'', ''[]''::jsonb) from public.%I where id = $1 for update', v_tabel) into v_lama using p_id, p_kunci;
  else
    execute format('select coalesce(foto, ''[]''::jsonb) from public.%I where id = $1 for update', v_tabel) into v_lama using p_id;
  end if;
  if jsonb_typeof(v_lama) <> 'array' then v_lama := '[]'::jsonb; end if;

  -- foto baru yang URL-nya belum ada (urutan dipertahankan, dobel di p_foto sendiri juga dibuang)
  select coalesce(jsonb_agg(f order by o), '[]'::jsonb) into v_tambah
  from (select distinct on (f->>'url') f, o from jsonb_array_elements(p_foto) with ordinality x(f, o) order by f->>'url', o) d
  where not exists (select 1 from jsonb_array_elements(v_lama) l where l->>'url' = d.f->>'url');
  v_n := jsonb_array_length(v_tambah);
  v_baru := v_lama || v_tambah;

  if v_n > 0 then
    if p_tujuan = 'kolom' then
      execute format('update public.%I set %I = $2 where id = $1', v_tabel, p_kunci) using p_id, v_baru;
    elsif p_tujuan = 'qc' then
      execute format($u$update public.%I set qc_checklist = jsonb_set(coalesce(qc_checklist, '{}'::jsonb), array[$2],
          coalesce(qc_checklist -> $2, '{"status":"to_do","catatan":""}'::jsonb) || jsonb_build_object('foto', $3::jsonb)) where id = $1$u$, v_tabel)
        using p_id, p_kunci, v_baru;
    elsif p_tujuan = 'komponen' then
      execute format($u$update public.%I set checklist = jsonb_set(coalesce(checklist, '{}'::jsonb), array[$2],
          coalesce(checklist -> $2, '{}'::jsonb) || jsonb_build_object('fotoPemasangan', $3::jsonb)) where id = $1$u$, v_tabel)
        using p_id, p_kunci, v_baru;
    else
      execute format('update public.%I set foto = $2 where id = $1', v_tabel) using p_id, v_baru;
    end if;
  end if;

  if p_tujuan = 'komponen' and v_n > 0 then
    -- sama dgn updateComponentProcessProgressPhotos (UPDATE saja, no-op kalau baris belum ada)
    update public.component_process_progress set photos = v_baru, updated_at = now()
    where panel_id = p_id and kode_komponen = p_kunci and proses = 'PASANG KOMPONEN' and tahap_key = coalesce(p_tahap, '');
    if p_ke_arsip then
      update public.panel_seksi_archived a
      set data = jsonb_set(coalesce(a.data, '{}'::jsonb), '{fotoPemasangan}',
                 coalesce(a.data -> 'fotoPemasangan', '[]'::jsonb)
                 || coalesce((select jsonb_agg(f) from jsonb_array_elements(v_tambah) f
                              where not exists (select 1 from jsonb_array_elements(coalesce(a.data -> 'fotoPemasangan', '[]'::jsonb)) l
                                                where l->>'url' = f->>'url')), '[]'::jsonb))
      where a.panel_id = p_id and a.kode = p_kunci and a.seksi in ('assembling_luar', 'wiring_control');
    end if;
  end if;

  return jsonb_build_object('ditemukan', true, 'tabel', v_tabel, 'ditambah', v_n, 'total', jsonb_array_length(v_baru));
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'proyek_luar_entri') then
    alter publication supabase_realtime add table public.proyek_luar_entri;
  end if;
end $$;
commit;

-- (2) VERIFIKASI - uji aturan dalam transaksi yang DIBATALKAN (data tidak berubah). Harap notice 'UJI LULUS' tanpa error,
--     lalu perintah terakhir: entri = proyek, foto_entri = foto_proyek, beda = 0, tanpa_entri = 0, lokasi_kosong = 0, fungsi = 10.
do $$
declare v_a bigint; v_b bigint; r jsonb; v_p bigint; v_e bigint; v_e2 bigint; n int; v_div text := '__uji_div';
begin
  select id into v_a from public.pekerja order by id limit 1;
  select id into v_b from public.pekerja where id <> v_a order by id limit 1;
  r := public.buat_proyek_luar(v_a, '__A', v_div, 'Proyek  Uji', 'Lokasi Uji', public.pl_hari_kerja() - 1);
  v_p := (r->'proyek'->>'id')::bigint; v_e := (r->'entri'->>'id')::bigint;
  if (r->>'proyek_baru')::boolean is not true or (select count(*) from public.proyek_luar_entri where proyek_id = v_p) <> 1 then raise exception 'buat proyek: entri harus 1'; end if;
  r := public.buat_proyek_luar(v_a, '__A', v_div, 'proyek uji', 'Lokasi Uji', public.pl_hari_kerja() - 1);
  if (r->>'proyek_baru')::boolean or (r->'entri'->>'id')::bigint <> v_e then raise exception 'buat ulang harus idempoten'; end if;
  -- operator lain divisi sama menambah hari ini; divisi lain ditolak; tanggal depan ditolak
  v_e2 := (public.buka_entri_proyek_luar(v_p, v_b, '__B', v_div, public.pl_hari_kerja())->>'id')::bigint;
  if (public.buka_entri_proyek_luar(v_p, v_b, '__B', v_div, public.pl_hari_kerja())->>'id')::bigint <> v_e2 then raise exception 'buka entri harus idempoten'; end if;
  begin perform public.buka_entri_proyek_luar(v_p, v_b, '__B', '__div_lain', public.pl_hari_kerja()); raise exception 'divisi lain seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  begin perform public.buka_entri_proyek_luar(v_p, v_b, '__B', v_div, public.pl_hari_kerja() + 1); raise exception 'tanggal depan seharusnya ditolak';
  exception when invalid_parameter_value then null; end;
  -- catatan: penulis boleh, orang lain ditolak, bentrok PT409, log digabung
  perform public.ubah_catatan_entri_proyek_luar(v_e2, 'b1', '__B', v_b, false, null, true);
  perform public.ubah_catatan_entri_proyek_luar(v_e2, 'b12', '__B', v_b, false, 'b1', true);
  select count(*) into n from public.proyek_luar_catatan_log where entri_id = v_e2; if n <> 1 then raise exception 'log harus digabung'; end if;
  begin perform public.ubah_catatan_entri_proyek_luar(v_e2, 'x', '__A', v_a, false); raise exception 'bukan penulis seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  begin perform public.ubah_catatan_entri_proyek_luar(v_e2, 'y', '__ADM', null, true, 'salah', true); raise exception 'bentrok seharusnya ditolak';
  exception when sqlstate 'PT409' then null; end;
  -- foto entri lewat tambah_foto_dokumentasi + hapus foto
  perform public.tambah_foto_dokumentasi('proyek_luar_entri', v_e2, null, '[{"url":"https://x/1.jpg"},{"url":"https://x/2.jpg"}]'::jsonb);
  r := public.hapus_foto_entri_proyek_luar(v_e2, 'https://x/1.jpg', '__B', v_b, false);
  if (r->>'dihapus')::int <> 1 or jsonb_array_length(r->'foto') <> 1 then raise exception 'hapus foto entri salah'; end if;
  -- hapus proyek oleh pembuat ditolak (ada entri __B); hapus entri __B oleh penulis; lalu boleh
  begin perform public.hapus_proyek_luar(v_p, '__A', v_a, false); raise exception 'hapus proyek seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  perform public.hapus_entri_proyek_luar(v_e2, '__B', v_b, false);
  -- Selesai: bukan pembuat ditolak, pembuat boleh; buka kembali hanya admin; tambah hari setelah Selesai ditolak
  begin perform public.ubah_status_proyek_luar(v_p, 'selesai', '__B', v_b, false); raise exception 'selesai bukan pembuat seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  perform public.ubah_status_proyek_luar(v_p, 'selesai', '__A', v_a, false);
  begin perform public.buka_entri_proyek_luar(v_p, v_b, '__B', v_div, public.pl_hari_kerja()); raise exception 'tambah setelah selesai seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  begin perform public.ubah_status_proyek_luar(v_p, 'berlangsung', '__A', v_a, false); raise exception 'buka kembali operator seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  perform public.ubah_status_proyek_luar(v_p, 'berlangsung', '__ADM', null, true);
  perform public.hapus_proyek_luar(v_p, '__A', v_a, false);
  perform public.pulihkan_proyek_luar(v_p, null, '__ADM');
  perform public.pulihkan_proyek_luar(v_p, v_e2, '__ADM');
  select count(*) into n from public.proyek_luar_aksi_log where proyek_id = v_p; if n <> 6 then raise exception 'aksi log harus 6, dapat %', n; end if;
  -- cermin: aplikasi lama (insert langsung + ubah_catatan_proyek_luar)
  insert into public.proyek_luar (nama_lokasi, tanggal, status, pekerja_id, operator_nama, divisi) values ('__Lama', public.pl_hari_kerja(), 'berlangsung', v_a, '__A', v_div) returning id into v_p;
  perform public.ubah_catatan_proyek_luar(v_p, 'catatan lama', '__A', v_a, false);
  if (select catatan from public.proyek_luar_entri where proyek_id = v_p and legacy) is distinct from 'catatan lama'
     or (select lokasi from public.proyek_luar where id = v_p) <> '__Lama' then raise exception 'cermin aplikasi lama gagal'; end if;
  raise notice 'UJI LULUS';
  raise exception 'batalkan uji' using errcode = 'P0001';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'batalkan uji' then raise; end if;
end $$;
select (select count(*) from public.proyek_luar) as proyek,
       (select count(*) from public.proyek_luar_entri) as entri,
       (select coalesce(sum(jsonb_array_length(foto)), 0) from public.proyek_luar) as foto_proyek,
       (select coalesce(sum(jsonb_array_length(foto)), 0) from public.proyek_luar_entri) as foto_entri,
       (select count(*) from public.proyek_luar p join public.proyek_luar_entri e on e.proyek_id = p.id and e.legacy
         where p.catatan is distinct from e.catatan or p.foto is distinct from e.foto or p.tanggal <> e.tanggal or p.pekerja_id is distinct from e.pekerja_id) as beda,
       (select count(*) from public.proyek_luar p where not exists (select 1 from public.proyek_luar_entri e where e.proyek_id = p.id)) as tanpa_entri,
       (select count(*) from public.proyek_luar where coalesce(btrim(lokasi), '') = '') as lokasi_kosong,
       (select count(*) from pg_proc where proname in ('pl_hari_kerja','buka_entri_proyek_luar','buat_proyek_luar','ubah_catatan_entri_proyek_luar','hapus_foto_entri_proyek_luar',
          'ubah_status_proyek_luar','hapus_entri_proyek_luar','hapus_proyek_luar','pulihkan_proyek_luar','ubah_info_proyek_luar')) as fungsi;

-- (3) ROLLBACK (data entri BARU yang ditulis setelah migrasi ikut hilang - jalankan hanya bila perlu):
-- begin;
-- alter publication supabase_realtime drop table public.proyek_luar_entri;
-- drop function if exists public.buka_entri_proyek_luar(bigint, bigint, text, text, date);
-- drop function if exists public.buat_proyek_luar(bigint, text, text, text, text, date);
-- drop function if exists public.ubah_catatan_entri_proyek_luar(bigint, text, text, bigint, boolean, text, boolean);
-- drop function if exists public.hapus_foto_entri_proyek_luar(bigint, text, text, bigint, boolean);
-- drop function if exists public.ubah_status_proyek_luar(bigint, text, text, bigint, boolean);
-- drop function if exists public.hapus_entri_proyek_luar(bigint, text, bigint, boolean);
-- drop function if exists public.hapus_proyek_luar(bigint, text, bigint, boolean);
-- drop function if exists public.pulihkan_proyek_luar(bigint, bigint, text);
-- drop function if exists public.ubah_info_proyek_luar(bigint, text, text, text);
-- drop function if exists public.pl_hari_kerja();
-- drop trigger if exists proyek_luar_cermin_insert on public.proyek_luar;
-- drop trigger if exists proyek_luar_cermin_update on public.proyek_luar;
-- drop function if exists public.proyek_luar_cermin_entri();
-- drop table if exists public.proyek_luar_entri;
-- drop function if exists public.proyek_luar_entri_set_aktivitas();
-- drop function if exists public.proyek_luar_entri_naikkan_proyek();
-- drop table if exists public.proyek_luar_aksi_log;
-- alter table public.proyek_luar_catatan_log drop column if exists entri_id;
-- alter table public.proyek_luar_foto_log drop column if exists entri_id;
-- alter table public.proyek_luar drop column if exists lokasi, drop column if exists dibuat_pekerja_id, drop column if exists dibuat_oleh,
--   drop column if exists selesai_oleh, drop column if exists selesai_pada, drop column if exists dihapus_oleh, drop column if exists dihapus_pada;
-- -- lalu jalankan ulang: definisi proyek_luar_set_aktivitas (blok A 20261024030000) & tambah_foto_dokumentasi (20261019020000)
-- commit;
