-- ============================================================================================
-- LAPORAN OUTSTANDING BERSAMA (S1, 31 Okt 2026; keputusan user 31 Okt). Satu laporan per hari kerja utk SEMUA admin,
-- realtime; dulu draf per admin di localStorage (vt_laporan_outstanding_v1:<nama>).
--   * laporan_outstanding        : 1 baris per tanggal (unik) - pengaturan (jam, varian, tampil teratasi) + teks_wa bersama
--                                  (null = ikut susunan; terisi = teks WA yang diedit tangan, terakhir menang).
--   * laporan_outstanding_bagian : 1 baris per bagian (proyek/panel/pekerjaan/kendala/catatan/prioritas), id = id draf
--                                  aplikasi. Konflik: TERAKHIR MENANG PER BAGIAN, tanpa kunci; RPC mengembalikan peringatan
--                                  bila bagian sudah diubah admin lain sejak versi yang dilihat pengirim. Hapus = lunak.
--   * laporan_outstanding_riwayat: PERMANEN (tanpa update/delete) - siapa, kapan, sebelum/sesudah. Diisi TRIGGER (semua
--                                  jalur tercatat); buat/buat ulang/impor dicatat 1 baris ringkasan (+ isi lama utk buat ulang).
--     lo_kembalikan(riwayat) memulihkan versi sebelumnya (ubah/hapus/tambah/header).
-- Tulis HANYA lewat RPC security definer lo_*; p_aktor {"admin": username} = admins aktif ber-divisi 'admin' (menu ini
-- hanya utk admin). Batas: tanpa Supabase Auth, RPC tidak bisa membuktikan pemanggil = pemilik username (sama dgn fitur lain).
-- Realtime: publikasi supabase_realtime FOR ALL TABLES (tabel baru otomatis ikut).
-- Verifikasi: supabase/verifikasi/20261031030000_laporan_outstanding_bersama_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261031030000_laporan_outstanding_bersama_rollback.sql
-- ============================================================================================
begin;

create table public.laporan_outstanding (
  id bigserial primary key,
  tanggal date not null unique,
  jam text not null default '16.00',
  varian text not null default 'V2' check (varian in ('V1','V2','V3')),
  tampil_teratasi boolean not null default true,
  teks_wa text,
  disusun_pada timestamptz,               -- waktu susun otomatis terakhir (draf.dibuatPada)
  versi int not null default 1,
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now(),
  diperbarui_oleh text,
  diperbarui_pada timestamptz
);

create table public.laporan_outstanding_bagian (
  id text primary key check (length(id) between 1 and 80),
  laporan_id bigint not null references public.laporan_outstanding(id),
  induk_id text,
  jenis text not null check (jenis in ('proyek','panel','pekerjaan','kendala','catatan','prioritas')),
  src text check (src in ('otomatis','arsip','manual')),
  urut double precision not null default 0,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  versi int not null default 1,
  dihapus_pada timestamptz,
  dihapus_oleh text,
  dibuat_oleh text,
  dibuat_pada timestamptz not null default now(),
  diperbarui_oleh text,
  diperbarui_pada timestamptz not null default now()
);
create index laporan_outstanding_bagian_lap on public.laporan_outstanding_bagian (laporan_id, id);

create table public.laporan_outstanding_riwayat (
  id bigserial primary key,
  laporan_id bigint not null references public.laporan_outstanding(id),
  bagian_id text,
  waktu timestamptz not null default now(),
  oleh text not null,
  jenis text not null check (jenis in ('buat','buat_ulang','impor','tambah','ubah','urut','hapus','pulih','header','kembalikan')),
  ringkasan text,
  sebelum jsonb,
  sesudah jsonb
);
create index laporan_outstanding_riwayat_lap on public.laporan_outstanding_riwayat (laporan_id, id desc);

do $$ declare t text; begin
  foreach t in array array['laporan_outstanding','laporan_outstanding_bagian','laporan_outstanding_riwayat'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', 'baca_' || t, t);
  end loop;
end $$;

create or replace function public.lo_tolak_ubah() returns trigger language plpgsql as $$
begin raise exception '%: riwayat permanen, % tidak diizinkan', tg_table_name, tg_op using errcode = '42501'; end $$;
create trigger laporan_outstanding_riwayat_permanen before update or delete on public.laporan_outstanding_riwayat
  for each row execute function public.lo_tolak_ubah();
create trigger laporan_outstanding_riwayat_permanen_truncate before truncate on public.laporan_outstanding_riwayat
  for each statement execute function public.lo_tolak_ubah();
-- laporan & bagian tidak pernah dihapus fisik (bagian dihapus lunak)
create trigger laporan_outstanding_tanpa_hapus before delete on public.laporan_outstanding for each row execute function public.lo_tolak_ubah();
create trigger laporan_outstanding_bagian_tanpa_hapus before delete on public.laporan_outstanding_bagian for each row execute function public.lo_tolak_ubah();

-- ── identitas & konteks ──────────────────────────────────────────────────────────────────────
create or replace function public.lo_aktor(p_aktor jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if p_aktor is null or coalesce(p_aktor->>'admin', '') = '' then raise exception 'Identitas admin tidak dikirim' using errcode = '28000'; end if;
  select a.nama into v from public.admins a
   where a.username = p_aktor->>'admin' and coalesce(a.is_active, true) and coalesce(a.divisi, 'admin') = 'admin';
  if v is null then raise exception 'Admin % tidak dikenal / nonaktif / bukan divisi admin', p_aktor->>'admin' using errcode = '28000'; end if;
  return v;
end $$;
-- konteks utk trigger riwayat (berlaku sampai akhir transaksi RPC). diam = jalur massal mencatat 1 ringkasan sendiri.
create or replace function public.lo_konteks(p_oleh text, p_diam boolean default false, p_ket text default null) returns void
language plpgsql as $$
begin
  perform set_config('lo.oleh', coalesce(p_oleh, ''), true);
  perform set_config('lo.diam', case when p_diam then '1' else '' end, true);
  perform set_config('lo.ket', coalesce(p_ket, ''), true);
end $$;
create or replace function public.lo_ringkas(p_jenis text, p_data jsonb) returns text language sql immutable as $$
  select left(p_jenis || ': ' || coalesce(nullif(btrim(coalesce(p_data->>'teks', p_data->>'nama', '')), ''), '(kosong)'), 160)
$$;

-- ── trigger riwayat ──────────────────────────────────────────────────────────────────────────
create or replace function public.lo_bagian_catat() returns trigger language plpgsql as $$
declare v_oleh text := coalesce(nullif(current_setting('lo.oleh', true), ''), 'sistem'); v_ket text := nullif(current_setting('lo.ket', true), '');
  v_jenis text; v_seb jsonb; v_ses jsonb;
begin
  if coalesce(current_setting('lo.diam', true), '') = '1' then return null; end if;
  v_ses := jsonb_build_object('induk_id', new.induk_id, 'jenis', new.jenis, 'src', new.src, 'urut', new.urut, 'data', new.data);
  if tg_op = 'INSERT' then v_jenis := 'tambah';
  else
    v_seb := jsonb_build_object('induk_id', old.induk_id, 'jenis', old.jenis, 'src', old.src, 'urut', old.urut, 'data', old.data);
    if old.dihapus_pada is null and new.dihapus_pada is not null then v_jenis := 'hapus';
    elsif old.dihapus_pada is not null and new.dihapus_pada is null then v_jenis := 'pulih';
    elsif old.data is distinct from new.data then v_jenis := 'ubah';
    elsif old.urut is distinct from new.urut or old.induk_id is distinct from new.induk_id then v_jenis := 'urut';
    else return null; end if;
  end if;
  insert into public.laporan_outstanding_riwayat (laporan_id, bagian_id, oleh, jenis, ringkasan, sebelum, sesudah)
  values (new.laporan_id, new.id, v_oleh, case when v_ket like 'kembalikan%' then 'kembalikan' else v_jenis end,
          coalesce(v_ket || ' · ', '') || public.lo_ringkas(new.jenis, new.data), v_seb, v_ses);
  return null;
end $$;
create trigger laporan_outstanding_bagian_catat after insert or update on public.laporan_outstanding_bagian
  for each row execute function public.lo_bagian_catat();

create or replace function public.lo_header_catat() returns trigger language plpgsql as $$
declare v_oleh text := coalesce(nullif(current_setting('lo.oleh', true), ''), 'sistem'); v_ket text := nullif(current_setting('lo.ket', true), '');
  v_seb jsonb := '{}'; v_ses jsonb := '{}';
begin
  if coalesce(current_setting('lo.diam', true), '') = '1' then return null; end if;
  if old.jam is distinct from new.jam then v_seb := v_seb || jsonb_build_object('jam', old.jam); v_ses := v_ses || jsonb_build_object('jam', new.jam); end if;
  if old.varian is distinct from new.varian then v_seb := v_seb || jsonb_build_object('varian', old.varian); v_ses := v_ses || jsonb_build_object('varian', new.varian); end if;
  if old.tampil_teratasi is distinct from new.tampil_teratasi then v_seb := v_seb || jsonb_build_object('tampil_teratasi', old.tampil_teratasi); v_ses := v_ses || jsonb_build_object('tampil_teratasi', new.tampil_teratasi); end if;
  if old.teks_wa is distinct from new.teks_wa then v_seb := v_seb || jsonb_build_object('teks_wa', old.teks_wa); v_ses := v_ses || jsonb_build_object('teks_wa', new.teks_wa); end if;
  if v_ses = '{}'::jsonb then return null; end if;
  insert into public.laporan_outstanding_riwayat (laporan_id, oleh, jenis, ringkasan, sebelum, sesudah)
  values (new.id, v_oleh, case when v_ket like 'kembalikan%' then 'kembalikan' else 'header' end,
          coalesce(v_ket || ' · ', '') || 'pengaturan: ' || (select string_agg(k, ', ') from jsonb_object_keys(v_ses) k), v_seb, v_ses);
  return null;
end $$;
create trigger laporan_outstanding_catat after update on public.laporan_outstanding
  for each row execute function public.lo_header_catat();

-- ── bantu: sisip bagian dari payload (dipakai buat/impor/buat ulang) ─────────────────────────
create or replace function public.lo_sisip_bagian(p_laporan_id bigint, p_b jsonb, p_oleh text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if jsonb_typeof(p_b->'data') is distinct from 'object' then raise exception 'Data bagian % tidak valid', p_b->>'id' using errcode = '22023'; end if;
  insert into public.laporan_outstanding_bagian (id, laporan_id, induk_id, jenis, src, urut, data, dibuat_oleh, diperbarui_oleh)
  values (p_b->>'id', p_laporan_id, nullif(p_b->>'induk_id', ''), p_b->>'jenis', nullif(p_b->>'src', ''),
          coalesce((p_b->>'urut')::double precision, 0), p_b->'data', p_oleh, p_oleh)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 and exists (select 1 from public.laporan_outstanding_bagian where id = p_b->>'id' and laporan_id <> p_laporan_id) then
    raise exception 'Bagian % milik laporan lain', p_b->>'id' using errcode = '23505';
  end if;
  return v_n = 1;
end $$;

-- ── RPC ──────────────────────────────────────────────────────────────────────────────────────
-- Buat laporan utk tanggal (hari kerja). Sudah ada (admin lain lebih dulu) -> kembalikan yang ada (dibuat=false), payload diabaikan.
create or replace function public.lo_buat(p_tanggal date, p_header jsonb, p_bagian jsonb, p_aktor jsonb, p_impor boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oleh text := public.lo_aktor(p_aktor); l public.laporan_outstanding; b jsonb; v_n int := 0;
begin
  if jsonb_typeof(coalesce(p_bagian, '[]')) <> 'array' then raise exception 'Bagian harus daftar' using errcode = '22023'; end if;
  insert into public.laporan_outstanding (tanggal, jam, varian, tampil_teratasi, teks_wa, disusun_pada, dibuat_oleh, diperbarui_oleh, diperbarui_pada)
  values (p_tanggal, coalesce(nullif(p_header->>'jam', ''), '16.00'), coalesce(nullif(p_header->>'varian', ''), 'V2'),
          coalesce((p_header->>'tampil_teratasi')::boolean, true), nullif(p_header->>'teks_wa', ''), nullif(p_header->>'disusun_pada', '')::timestamptz,
          v_oleh, v_oleh, now())
  on conflict (tanggal) do nothing
  returning * into l;
  if l.id is null then
    select * into l from public.laporan_outstanding where tanggal = p_tanggal;
    return jsonb_build_object('laporan', to_jsonb(l), 'dibuat', false);
  end if;
  perform public.lo_konteks(v_oleh, true);
  for b in select * from jsonb_array_elements(coalesce(p_bagian, '[]')) loop
    if public.lo_sisip_bagian(l.id, b, v_oleh) then v_n := v_n + 1; end if;
  end loop;
  insert into public.laporan_outstanding_riwayat (laporan_id, oleh, jenis, ringkasan, sesudah)
  values (l.id, v_oleh, case when p_impor then 'impor' else 'buat' end,
          case when p_impor then 'Laporan dibuat dari draf lama di browser' else 'Laporan dibuat' end || ' (' || v_n || ' bagian)',
          jsonb_build_object('bagian', v_n));
  return jsonb_build_object('laporan', to_jsonb(l), 'dibuat', true, 'bagian', v_n);
end $$;

-- Simpan perubahan per bagian (batch): {o:'tambah', id, induk_id, jenis, src, urut, data} | {o:'ubah', id, versi_dasar,
-- data?, urut?, induk_id?} | {o:'hapus', id}. Terakhir menang per bagian; peringatan bila versi_dasar < versi & pengubah lain.
-- Bagian yang sudah dihapus admin lain tidak dihidupkan lagi oleh 'ubah' (dilaporkan di 'hilang').
create or replace function public.lo_simpan(p_laporan_id bigint, p_ops jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oleh text := public.lo_aktor(p_aktor); op jsonb; r public.laporan_outstanding_bagian;
  v_versi jsonb := '{}'; v_per jsonb := '[]'; v_hilang jsonb := '[]';
begin
  if not exists (select 1 from public.laporan_outstanding where id = p_laporan_id) then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 2000 then raise exception 'Perubahan tidak valid' using errcode = '22023'; end if;
  perform public.lo_konteks(v_oleh);
  for op in select * from jsonb_array_elements(p_ops) loop
    if op->>'o' = 'tambah' then
      perform public.lo_sisip_bagian(p_laporan_id, op, v_oleh);
      select * into r from public.laporan_outstanding_bagian where id = op->>'id';
    else
      select * into r from public.laporan_outstanding_bagian where id = op->>'id' and laporan_id = p_laporan_id for update;
      if not found or r.dihapus_pada is not null then
        v_hilang := v_hilang || jsonb_build_object('id', op->>'id', 'oleh', r.dihapus_oleh, 'waktu', r.dihapus_pada);
        continue;
      end if;
      if op->>'o' = 'hapus' then
        update public.laporan_outstanding_bagian set dihapus_pada = now(), dihapus_oleh = v_oleh, versi = versi + 1,
               diperbarui_oleh = v_oleh, diperbarui_pada = now() where id = r.id returning * into r;
      elsif op->>'o' = 'ubah' then
        if (op->>'versi_dasar') is not null and (op->>'versi_dasar')::int < r.versi and r.diperbarui_oleh is distinct from v_oleh then
          v_per := v_per || jsonb_build_object('id', r.id, 'oleh', r.diperbarui_oleh, 'waktu', r.diperbarui_pada);
        end if;
        if op ? 'data' and jsonb_typeof(op->'data') is distinct from 'object' then raise exception 'Data bagian % tidak valid', r.id using errcode = '22023'; end if;
        update public.laporan_outstanding_bagian set
          data = case when op ? 'data' then op->'data' else data end,
          urut = case when op ? 'urut' then (op->>'urut')::double precision else urut end,
          induk_id = case when op ? 'induk_id' then nullif(op->>'induk_id', '') else induk_id end,
          versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now()
         where id = r.id returning * into r;
      else raise exception 'Operasi % tidak dikenal', op->>'o' using errcode = '22023';
      end if;
    end if;
    v_versi := v_versi || jsonb_build_object(r.id, r.versi);
  end loop;
  perform public.lo_konteks(v_oleh, true);   -- jejak waktu laporan tanpa riwayat header
  update public.laporan_outstanding set diperbarui_oleh = v_oleh, diperbarui_pada = now() where id = p_laporan_id;
  return jsonb_build_object('versi', v_versi, 'peringatan', v_per, 'hilang', v_hilang);
end $$;

-- Pengaturan & teks WA bersama (p_patch hanya kunci yang diubah; teks_wa null = ikut susunan). Terakhir menang + peringatan.
create or replace function public.lo_ubah_header(p_laporan_id bigint, p_patch jsonb, p_versi_dasar int, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oleh text := public.lo_aktor(p_aktor); l public.laporan_outstanding; v_per jsonb := null; v_asing text[];
begin
  select array_agg(k) into v_asing from jsonb_object_keys(coalesce(p_patch, '{}')) k where k <> all(array['jam','varian','tampil_teratasi','teks_wa']);
  if v_asing is not null then raise exception 'Kolom tidak bisa diubah: %', v_asing using errcode = '22023'; end if;
  select * into l from public.laporan_outstanding where id = p_laporan_id for update;
  if not found then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  if p_versi_dasar is not null and p_versi_dasar < l.versi and l.diperbarui_oleh is distinct from v_oleh then
    v_per := jsonb_build_object('oleh', l.diperbarui_oleh, 'waktu', l.diperbarui_pada);
  end if;
  perform public.lo_konteks(v_oleh);
  update public.laporan_outstanding set
    jam = case when p_patch ? 'jam' then coalesce(nullif(p_patch->>'jam', ''), jam) else jam end,
    varian = case when p_patch ? 'varian' then p_patch->>'varian' else varian end,
    tampil_teratasi = case when p_patch ? 'tampil_teratasi' then (p_patch->>'tampil_teratasi')::boolean else tampil_teratasi end,
    teks_wa = case when p_patch ? 'teks_wa' then p_patch->>'teks_wa' else teks_wa end,
    versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now()
  where id = p_laporan_id returning * into l;
  return jsonb_build_object('laporan', to_jsonb(l), 'peringatan', v_per);
end $$;

-- "Buat ulang laporan": p_bagian = SELURUH susunan baru dari aplikasi. Hanya bagian OTOMATIS (proyek otomatis & turunannya yang
-- otomatis/tanpa sumber, + prioritas) yang diganti isinya / dihapus bila tidak ada lagi. Bagian manual/arsip/catatan yang sudah
-- ada TIDAK ditimpa isinya (aman dari edit admin lain saat itu) - hanya urut/induknya diikutkan. Bagian baru disisipkan.
create or replace function public.lo_ganti_otomatis(p_laporan_id bigint, p_header jsonb, p_bagian jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oleh text := public.lo_aktor(p_aktor); l public.laporan_outstanding; b jsonb; r public.laporan_outstanding_bagian;
  v_lama jsonb; v_ids text[]; v_baru int := 0; v_ganti int := 0; v_hapus int := 0;
begin
  select * into l from public.laporan_outstanding where id = p_laporan_id for update;   -- buat ulang serempak diantrekan
  if not found then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_bagian) <> 'array' then raise exception 'Bagian harus daftar' using errcode = '22023'; end if;
  create temp table _lo_oto on commit drop as
    with recursive t as (
      select x.id from public.laporan_outstanding_bagian x
       where x.laporan_id = p_laporan_id and x.dihapus_pada is null and ((x.jenis = 'proyek' and x.src = 'otomatis') or x.jenis = 'prioritas')
      union
      select c.id from public.laporan_outstanding_bagian c join t on c.induk_id = t.id
       where c.laporan_id = p_laporan_id and c.dihapus_pada is null and coalesce(c.src, 'otomatis') = 'otomatis'
    ) select id from t;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'induk_id', x.induk_id, 'jenis', x.jenis, 'src', x.src, 'urut', x.urut, 'data', x.data) order by x.id), '[]')
    into v_lama from public.laporan_outstanding_bagian x where x.id in (select id from _lo_oto);
  perform public.lo_konteks(v_oleh, true);
  select array_agg(e->>'id') into v_ids from jsonb_array_elements(p_bagian) e;
  for b in select * from jsonb_array_elements(p_bagian) loop
    select * into r from public.laporan_outstanding_bagian where id = b->>'id' and laporan_id = p_laporan_id for update;
    if not found then
      if public.lo_sisip_bagian(p_laporan_id, b, v_oleh) then v_baru := v_baru + 1; end if;
    elsif r.id in (select id from _lo_oto) then
      if r.data is distinct from b->'data' or r.urut is distinct from (b->>'urut')::double precision or r.induk_id is distinct from nullif(b->>'induk_id', '') or r.src is distinct from nullif(b->>'src', '') then
        update public.laporan_outstanding_bagian set data = b->'data', urut = (b->>'urut')::double precision, induk_id = nullif(b->>'induk_id', ''),
               src = nullif(b->>'src', ''), versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now() where id = r.id;
        v_ganti := v_ganti + 1;
      end if;
    elsif r.dihapus_pada is null and (r.urut is distinct from (b->>'urut')::double precision or r.induk_id is distinct from nullif(b->>'induk_id', '')) then
      update public.laporan_outstanding_bagian set urut = (b->>'urut')::double precision, induk_id = nullif(b->>'induk_id', ''),
             versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now() where id = r.id;
    end if;
  end loop;
  update public.laporan_outstanding_bagian set dihapus_pada = now(), dihapus_oleh = v_oleh, versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now()
   where id in (select id from _lo_oto) and not (id = any(coalesce(v_ids, '{}')));
  get diagnostics v_hapus = row_count;
  update public.laporan_outstanding set
    varian = coalesce(nullif(p_header->>'varian', ''), varian), jam = coalesce(nullif(p_header->>'jam', ''), jam),
    disusun_pada = coalesce(nullif(p_header->>'disusun_pada', '')::timestamptz, now()), versi = versi + 1,
    diperbarui_oleh = v_oleh, diperbarui_pada = now()
  where id = p_laporan_id returning * into l;
  insert into public.laporan_outstanding_riwayat (laporan_id, oleh, jenis, ringkasan, sebelum, sesudah)
  values (p_laporan_id, v_oleh, 'buat_ulang', format('Buat ulang dari data terbaru: %s baru, %s diganti, %s dihapus', v_baru, v_ganti, v_hapus),
          jsonb_build_object('bagian_otomatis', v_lama), jsonb_build_object('baru', v_baru, 'ganti', v_ganti, 'hapus', v_hapus));
  return jsonb_build_object('laporan', to_jsonb(l), 'baru', v_baru, 'ganti', v_ganti, 'hapus', v_hapus);
end $$;

-- Impor draf lama dari browser (sekali, saat rilis). Laporan tanggal itu belum ada -> dibuat dari draf (lo_buat, riwayat 'impor').
-- Sudah ada -> hanya bagian yang BELUM ada (id) disisipkan; induknya harus ada (di payload atau laporan). Diulang = 0 baru.
create or replace function public.lo_impor(p_tanggal date, p_header jsonb, p_bagian jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oleh text := public.lo_aktor(p_aktor); l public.laporan_outstanding; b jsonb; v_n int := 0; v_lewat int := 0; h jsonb;
begin
  select * into l from public.laporan_outstanding where tanggal = p_tanggal for update;
  if not found then
    h := public.lo_buat(p_tanggal, p_header, p_bagian, p_aktor, true);
    if (h->>'dibuat')::boolean then return h || jsonb_build_object('mode', 'baru'); end if;
    select * into l from public.laporan_outstanding where tanggal = p_tanggal for update;
  end if;
  perform public.lo_konteks(v_oleh, true);
  for b in select * from jsonb_array_elements(coalesce(p_bagian, '[]')) loop
    if exists (select 1 from public.laporan_outstanding_bagian where id = b->>'id') then v_lewat := v_lewat + 1; continue; end if;
    if nullif(b->>'induk_id', '') is not null
       and not exists (select 1 from public.laporan_outstanding_bagian where id = b->>'induk_id' and laporan_id = l.id)
       and not exists (select 1 from jsonb_array_elements(p_bagian) e where e->>'id' = b->>'induk_id') then v_lewat := v_lewat + 1; continue; end if;
    if public.lo_sisip_bagian(l.id, b, v_oleh) then v_n := v_n + 1; end if;
  end loop;
  if v_n > 0 then
    insert into public.laporan_outstanding_riwayat (laporan_id, oleh, jenis, ringkasan, sesudah)
    values (l.id, v_oleh, 'impor', 'Impor draf lama dari browser: ' || v_n || ' bagian ditambahkan', jsonb_build_object('bagian', v_n, 'dilewati', v_lewat));
  end if;
  return jsonb_build_object('laporan', to_jsonb(l), 'dibuat', false, 'mode', 'gabung', 'bagian', v_n, 'dilewati', v_lewat);
end $$;

-- Kembalikan versi sebelum dari satu baris riwayat (ubah/urut/hapus/pulih/tambah/header/kembalikan). Buat/buat ulang/impor: tidak.
create or replace function public.lo_kembalikan(p_riwayat_id bigint, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oleh text := public.lo_aktor(p_aktor); h public.laporan_outstanding_riwayat; r public.laporan_outstanding_bagian; k text;
begin
  select * into h from public.laporan_outstanding_riwayat where id = p_riwayat_id;
  if not found then raise exception 'Riwayat tidak ditemukan' using errcode = 'P0002'; end if;
  if h.jenis in ('buat','buat_ulang','impor') then raise exception 'Riwayat jenis % tidak bisa dikembalikan dari sini', h.jenis using errcode = '22023'; end if;
  perform public.lo_konteks(v_oleh, false, 'kembalikan riwayat #' || h.id);
  if h.bagian_id is null then
    if h.sebelum is null or h.sebelum = '{}'::jsonb then raise exception 'Tidak ada versi sebelum' using errcode = '22023'; end if;
    for k in select jsonb_object_keys(h.sebelum) loop
      if k not in ('jam','varian','tampil_teratasi','teks_wa') then raise exception 'Kolom % tidak dikenal', k using errcode = '22023'; end if;
    end loop;
    update public.laporan_outstanding set
      jam = case when h.sebelum ? 'jam' then h.sebelum->>'jam' else jam end,
      varian = case when h.sebelum ? 'varian' then h.sebelum->>'varian' else varian end,
      tampil_teratasi = case when h.sebelum ? 'tampil_teratasi' then (h.sebelum->>'tampil_teratasi')::boolean else tampil_teratasi end,
      teks_wa = case when h.sebelum ? 'teks_wa' then h.sebelum->>'teks_wa' else teks_wa end,
      versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now()
    where id = h.laporan_id;
    return jsonb_build_object('dikembalikan', 'header');
  end if;
  select * into r from public.laporan_outstanding_bagian where id = h.bagian_id for update;
  if not found then raise exception 'Bagian tidak ditemukan' using errcode = 'P0002'; end if;
  if h.sebelum is null then   -- 'tambah' -> hapus lagi
    update public.laporan_outstanding_bagian set dihapus_pada = now(), dihapus_oleh = v_oleh, versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now()
     where id = r.id and dihapus_pada is null;
  else
    update public.laporan_outstanding_bagian set data = h.sebelum->'data', urut = (h.sebelum->>'urut')::double precision,
           induk_id = nullif(h.sebelum->>'induk_id', ''), dihapus_pada = case when h.jenis = 'pulih' then now() else null end,
           dihapus_oleh = case when h.jenis = 'pulih' then v_oleh end, versi = versi + 1, diperbarui_oleh = v_oleh, diperbarui_pada = now()
     where id = r.id;
  end if;
  return jsonb_build_object('dikembalikan', h.bagian_id);
end $$;

revoke execute on function public.lo_aktor(jsonb), public.lo_konteks(text, boolean, text), public.lo_sisip_bagian(bigint, jsonb, text),
  public.lo_bagian_catat(), public.lo_header_catat(), public.lo_tolak_ubah() from public, anon, authenticated;
grant execute on function public.lo_ringkas(text, jsonb),
  public.lo_buat(date, jsonb, jsonb, jsonb, boolean), public.lo_simpan(bigint, jsonb, jsonb), public.lo_ubah_header(bigint, jsonb, int, jsonb),
  public.lo_ganti_otomatis(bigint, jsonb, jsonb, jsonb), public.lo_impor(date, jsonb, jsonb, jsonb), public.lo_kembalikan(bigint, jsonb)
  to anon, authenticated;

do $$ begin
  if not (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.laporan_outstanding, public.laporan_outstanding_bagian, public.laporan_outstanding_riwayat;
  end if;
end $$;

commit;
