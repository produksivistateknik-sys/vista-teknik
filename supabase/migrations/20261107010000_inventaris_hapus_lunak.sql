-- ============================================================================================
-- INVENTARIS - HAPUS LUNAK, TEMPAT SAMPAH 30 HARI, HAPUS PERMANEN MANUAL, PERIKSA DOBEL IMPOR (7 Nov 2026, keputusan user).
-- Migrasi TAMBAHAN di atas migrasi inventaris yang sudah live. TIDAK mengubah data: hanya kolom baru, aturan baca, RPC.
--   * Semua barang bisa dihapus, tidak terkunci oleh data terkait. Hapus = barang + data terkaitnya disembunyikan LEWAT DATABASE
--     (RLS + view inv_jadwal_v), jadi admin, HP operator (termasuk PWA lama), QR, pengingat push ikut tanpa rilis aplikasi.
--     Jadwal/laporan/media TIDAK disentuh saat dihapus, maka pemulihan mengembalikan keadaan persis.
--   * Dipulihkan selama 30 hari. Sesudah itu terkunci "siap dihapus permanen" (dihitung dari waktu, tanpa pg_cron).
--   * Hapus permanen: manual, satu barang, ketik nomor + sandi akun (dicek bcrypt di server, sama dgn verify_admin_login).
--     Yang dimusnahkan: jadwal, riwayat selesai, laporan, update, baris media, notifikasi, log pengingat. Yang TINGGAL: baris nisan
--     inv_barang (nama, nomor, kunci impor; supaya nomor tidak terpakai lagi & impor tidak menghidupkannya) dan seluruh inv_log.
--     File di R2 tidak dihapus (keputusan user); URL-nya dicatat di inv_log.
--   * Pengaman "riwayat tidak bisa dihapus" (inv_tolak_ubah) dibuka hanya untuk: DELETE baris milik satu barang yang ditandai
--     fungsi hapus permanen DAN memang sudah > 30 hari di sampah. inv_log & inv_barang tetap tidak bisa dihapus sama sekali.
--   * Hak: akun divisi admin & hrga (Engineering ditolak). p_aktor tetap dikirim aplikasi: RPC memeriksa akun aktif & divisinya,
--     bukan orangnya. Hanya hapus permanen yang membuktikan orangnya (sandi).
--   * inv_impor: nama dicocokkan tanpa lokasi (huruf/spasi/tanda baca dinormalkan), juga dgn nama asli di inv_impor_cadangan.
--     Cocok barang aktif = penanda "dobel" (admin memutuskan). Cocok barang di sampah / nisan = selalu dilewati.
-- Satu file siap Run: cek di bawah memakai barang uji #263 lalu dibatalkan sendiri; gagal = seluruh transaksi batal. Rollback di
-- paling bawah. Galat VTSND = sandi salah (bukan 40001: PostgREST mengulang 40001 sampai timeout).
-- ============================================================================================
begin;

do $pra$ begin
  if to_regprocedure('extensions.crypt(text,text)') is null then raise exception 'DIBATALKAN: extensions.crypt tidak ada'; end if;
  if to_regprocedure('public.verify_admin_login(text,text)') is null
     or pg_get_functiondef('public.verify_admin_login(text,text)'::regprocedure) not like '%extensions.crypt(p_password, password)%' then
    raise exception 'DIBATALKAN: definisi verify_admin_login berbeda dari yang dibaca (backup 5 Nov), periksa dulu';
  end if;
  if not exists (select 1 from public.inv_barang where nama = 'UJI T2 (abaikan)') then raise exception 'DIBATALKAN: barang uji tidak ditemukan'; end if;
end $pra$;

-- ── 1. Kolom & aturan dasar ──────────────────────────────────────────────────────────────────
alter table public.inv_barang
  add column dihapus_pada timestamptz,
  add column dihapus_oleh text,
  add column dihapus_alasan text,
  add column dihapus_permanen_pada timestamptz,
  add column dihapus_permanen_oleh text,
  add constraint inv_barang_hapus_lengkap check ((dihapus_pada is null) = (dihapus_oleh is null) and (dihapus_pada is null) = (dihapus_alasan is null)),
  add constraint inv_barang_permanen_dari_sampah check (dihapus_permanen_pada is null or dihapus_pada is not null);
create index inv_barang_terhapus on public.inv_barang (dihapus_pada) where dihapus_pada is not null;

alter table public.inv_log drop constraint inv_log_jenis_check;
alter table public.inv_log add constraint inv_log_jenis_check
  check (jenis in ('kondisi','lokasi','nomor','aktif','data','hapus','pulihkan','hapus_permanen'));

create or replace function public.inv_sampah_hari() returns int language sql immutable as $$ select 30 $$;

create or replace function public.inv_barang_tampil(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.inv_barang b where b.id = p_id and b.dihapus_pada is null)
$$;

create or replace function public.inv_media_barang_id(p_tujuan text, p_ref bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select case p_tujuan
    when 'barang' then p_ref
    when 'laporan' then (select l.barang_id from public.inv_laporan l where l.id = p_ref)
    when 'laporan_update' then (select l.barang_id from public.inv_laporan_update u join public.inv_laporan l on l.id = u.laporan_id where u.id = p_ref)
    when 'jadwal_selesai' then (select s.barang_id from public.inv_jadwal_selesai s where s.id = p_ref) end
$$;

create or replace function public.inv_laporan_barang_id(p_laporan bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select l.barang_id from public.inv_laporan l where l.id = p_laporan
$$;

-- ── 2. Baca: barang di sampah & data terkaitnya tidak terlihat dari aplikasi mana pun ─────────
drop policy baca_inv_barang on public.inv_barang;
create policy baca_inv_barang on public.inv_barang for select to anon, authenticated using (dihapus_pada is null);
drop policy baca_inv_jadwal on public.inv_jadwal;
create policy baca_inv_jadwal on public.inv_jadwal for select to anon, authenticated using (public.inv_barang_tampil(barang_id));
drop policy baca_inv_jadwal_selesai on public.inv_jadwal_selesai;
create policy baca_inv_jadwal_selesai on public.inv_jadwal_selesai for select to anon, authenticated using (public.inv_barang_tampil(barang_id));
drop policy baca_inv_laporan on public.inv_laporan;
create policy baca_inv_laporan on public.inv_laporan for select to anon, authenticated using (public.inv_barang_tampil(barang_id));
drop policy baca_inv_laporan_update on public.inv_laporan_update;
create policy baca_inv_laporan_update on public.inv_laporan_update for select to anon, authenticated using (public.inv_barang_tampil(public.inv_laporan_barang_id(laporan_id)));
drop policy baca_inv_media on public.inv_media;
create policy baca_inv_media on public.inv_media for select to anon, authenticated using (public.inv_barang_tampil(public.inv_media_barang_id(tujuan, ref_id)));
drop policy baca_inv_notifikasi on public.inv_notifikasi;
create policy baca_inv_notifikasi on public.inv_notifikasi for select to anon, authenticated using (public.inv_barang_tampil(barang_id));
-- catatan penghapusan tetap terbaca (Riwayat admin) walau barangnya tersembunyi
drop policy baca_inv_log on public.inv_log;
create policy baca_inv_log on public.inv_log for select to anon, authenticated
  using (jenis in ('hapus','pulihkan','hapus_permanen') or public.inv_barang_tampil(barang_id));

-- Edge Function pengingat memakai service role (melewati RLS), jadi view juga menyaring. Kolom view tidak berubah.
create or replace view public.inv_jadwal_v with (security_invoker = true) as
  select j.*,
         case when not j.aktif or j.jatuh_tempo is null then 'normal'
              when j.jatuh_tempo < public.inv_hari_ini() then 'terlambat'
              when j.jatuh_tempo <= public.inv_hari_ini() + public.inv_batas_segera() then 'segera'
              else 'normal' end as status_jadwal,
         (j.terakhir_dilakukan = public.inv_hari_ini()) as selesai_hari_ini
  from public.inv_jadwal j
  where public.inv_barang_tampil(j.barang_id);

-- ── 3. Tulis: barang di sampah membeku, satu penjaga utk semua RPC lama ──────────────────────
-- inv.izin_sampah = '1' hanya dipasang inv_hapus_barang / inv_pulihkan_barang / inv_hapus_permanen (berlaku sampai akhir transaksi).
create or replace function public.inv_barang_jaga_sampah() returns trigger language plpgsql as $$
begin
  if old.dihapus_pada is null and new.dihapus_pada is null then return new; end if;
  if coalesce(current_setting('inv.izin_sampah', true), '') = '1' then return new; end if;
  raise exception 'Barang ini ada di tempat sampah - pulihkan dulu' using errcode = '42501';
end $$;
create trigger inv_barang_jaga_sampah before update on public.inv_barang
  for each row execute function public.inv_barang_jaga_sampah();

create or replace function public.inv_tolak_bila_dihapus() returns trigger language plpgsql as $$
declare v_bid bigint;
begin
  if tg_table_name = 'inv_laporan_update' then v_bid := public.inv_laporan_barang_id(new.laporan_id);
  elsif tg_table_name = 'inv_media' then v_bid := public.inv_media_barang_id(new.tujuan, new.ref_id);
  else v_bid := new.barang_id; end if;
  if exists (select 1 from public.inv_barang b where b.id = v_bid and b.dihapus_pada is not null) then
    raise exception 'Barang ini sudah dihapus - data tidak bisa diubah' using errcode = '42501';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update','inv_media'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.inv_tolak_bila_dihapus()',
                   t || '_jaga_sampah', t);
  end loop;
end $$;
-- notifikasi: hanya saat dibuat & diputuskan. Klaim push (ubah push_status) tidak boleh ikut, supaya cron push tidak gagal.
create trigger inv_notifikasi_jaga_sampah before insert or update of keputusan on public.inv_notifikasi
  for each row execute function public.inv_tolak_bila_dihapus();

-- Pengaman permanen. Pengecualian satu-satunya: DELETE baris milik barang yang ditandai inv.musnah_barang, dan barang itu benar-benar
-- sudah melewati masa sampah. Tanda sendirian tidak cukup; inv_log & inv_barang tidak pernah lolos; TRUNCATE tidak pernah lolos.
create or replace function public.inv_tolak_ubah() returns trigger language plpgsql as $$
declare v_izin bigint; v_bid bigint;
begin
  if tg_op = 'DELETE' and tg_table_name in ('inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update','inv_media','inv_notifikasi') then
    v_izin := nullif(current_setting('inv.musnah_barang', true), '')::bigint;
    if v_izin is not null then
      if tg_table_name = 'inv_laporan_update' then v_bid := public.inv_laporan_barang_id(old.laporan_id);
      elsif tg_table_name = 'inv_media' then v_bid := public.inv_media_barang_id(old.tujuan, old.ref_id);
      else v_bid := old.barang_id; end if;
      if v_bid = v_izin and exists (select 1 from public.inv_barang b where b.id = v_izin and b.dihapus_permanen_pada is null
          and b.dihapus_pada <= now() - make_interval(days => public.inv_sampah_hari())) then
        return old;
      end if;
    end if;
  end if;
  raise exception '%: data permanen, % tidak diizinkan', tg_table_name, tg_op using errcode = '42501';
end $$;

-- ── 4. Pembantu RPC ──────────────────────────────────────────────────────────────────────────
create or replace function public.inv_aktor_pengelola(p_aktor jsonb, out nama text, out username text, out divisi text)
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya akun admin atau HRGA' using errcode = '42501'; end if;
  select a.nama, adm.username, coalesce(adm.divisi, 'admin') into nama, username, divisi
    from public.admins adm where adm.username = p_aktor->>'admin';
  if divisi not in ('admin', 'hrga') then raise exception 'Hanya akun admin atau HRGA' using errcode = '42501'; end if;
end $$;

create or replace function public.inv_hitung_terkait(p_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'jadwal', (select count(*) from public.inv_jadwal j where j.barang_id = p_id),
    'jadwal_aktif', (select count(*) from public.inv_jadwal j where j.barang_id = p_id and j.aktif),
    'riwayat_selesai', (select count(*) from public.inv_jadwal_selesai s where s.barang_id = p_id),
    'laporan', (select count(*) from public.inv_laporan l where l.barang_id = p_id),
    'laporan_aktif', (select count(*) from public.inv_laporan l where l.barang_id = p_id and l.status <> 'closed'),
    'update_laporan', (select count(*) from public.inv_laporan_update u join public.inv_laporan l on l.id = u.laporan_id where l.barang_id = p_id),
    'datasheet', (select count(*) from public.inv_media m where m.tujuan = 'barang' and m.ref_id = p_id and m.peran = 'datasheet' and m.dihapus_pada is null),
    'media', (select count(*) from public.inv_media m where public.inv_media_barang_id(m.tujuan, m.ref_id) = p_id and m.dihapus_pada is null),
    'notifikasi', (select count(*) from public.inv_notifikasi n where n.barang_id = p_id))
$$;

create or replace function public.inv_ada_terkait(p_terkait jsonb) returns boolean language sql immutable as $$
  select (p_terkait->>'jadwal')::int + (p_terkait->>'riwayat_selesai')::int + (p_terkait->>'laporan')::int
       + (p_terkait->>'media')::int + (p_terkait->>'notifikasi')::int > 0
$$;

create or replace function public.inv_teks_konfirmasi(b public.inv_barang) returns text language sql immutable as $$
  select coalesce(b.nomor_inventaris, b.nama)
$$;

-- ── 5. RPC hapus / tempat sampah / pulihkan / hapus permanen ─────────────────────────────────
create or replace function public.inv_pratinjau_hapus(p_id bigint, p_aktor jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record; b public.inv_barang; t jsonb;
begin
  select * into a from public.inv_aktor_pengelola(p_aktor);
  select * into b from public.inv_barang where id = p_id;
  if not found or b.dihapus_pada is not null then raise exception 'Barang tidak ditemukan / sudah dihapus' using errcode = 'P0002'; end if;
  t := public.inv_hitung_terkait(p_id);
  return jsonb_build_object('terkait', t, 'ada_terkait', public.inv_ada_terkait(t), 'konfirmasi', public.inv_teks_konfirmasi(b), 'versi', b.versi);
end $$;

create or replace function public.inv_hapus_barang(p_id bigint, p_versi int, p_alasan text, p_konfirmasi text, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; t jsonb; v_alasan text := btrim(coalesce(p_alasan, ''));
begin
  select * into a from public.inv_aktor_pengelola(p_aktor);
  if length(v_alasan) < 5 then raise exception 'Alasan wajib diisi (minimal 5 huruf)' using errcode = '22023'; end if;
  select * into b from public.inv_barang where id = p_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if b.dihapus_pada is not null then raise exception 'Barang ini sudah dihapus oleh %', b.dihapus_oleh using errcode = 'VTVER'; end if;
  if b.versi <> p_versi then raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = 'VTVER'; end if;
  t := public.inv_hitung_terkait(p_id);
  if public.inv_ada_terkait(t) and btrim(coalesce(p_konfirmasi, '')) is distinct from public.inv_teks_konfirmasi(b) then
    raise exception 'Ketik % untuk mengonfirmasi', public.inv_teks_konfirmasi(b) using errcode = '22023';
  end if;
  -- push tindakan operator yang masih antre tidak dikirim lagi
  update public.inv_notifikasi set push_status = 'dilewati', push_pada = now() where barang_id = p_id and push_status = 'menunggu';
  perform set_config('inv.izin_sampah', '1', true);
  perform public.inv_konteks(a.nama, 'admin', v_alasan);
  update public.inv_barang set dihapus_pada = now(), dihapus_oleh = a.nama, dihapus_alasan = v_alasan where id = p_id returning * into b;
  perform set_config('inv.izin_sampah', '', true);
  insert into public.inv_log (barang_id, jenis, dari, ke, detail, oleh, sumber, keterangan)
  values (p_id, 'hapus', 'Tampil di daftar', 'Tempat sampah',
          jsonb_build_object('nomor', b.nomor_inventaris, 'nama', b.nama, 'lokasi', b.lokasi_kode, 'username', a.username, 'divisi', a.divisi, 'aktif', b.aktif, 'terkait', t)::text,
          a.nama, 'admin', v_alasan);
  return jsonb_build_object('id', b.id, 'dihapus_pada', b.dihapus_pada, 'terkait', t);
end $$;

create or replace function public.inv_sampah_daftar(p_aktor jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record; v_batas interval := make_interval(days => public.inv_sampah_hari());
begin
  select * into a from public.inv_aktor_pengelola(p_aktor);
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'versi', b.versi, 'nama', b.nama, 'nomor_inventaris', b.nomor_inventaris,
      'lokasi_kode', b.lokasi_kode, 'aktif', b.aktif, 'dihapus_pada', b.dihapus_pada, 'dihapus_oleh', b.dihapus_oleh, 'dihapus_alasan', b.dihapus_alasan,
      'bisa_dipulihkan_sampai', b.dihapus_pada + v_batas, 'siap_permanen', b.dihapus_pada <= now() - v_batas, 'konfirmasi', public.inv_teks_konfirmasi(b),
      'terkait', public.inv_hitung_terkait(b.id),
      'jadwal_lewat', (select count(*) from public.inv_jadwal j where j.barang_id = b.id and j.aktif and j.jatuh_tempo < public.inv_hari_ini())
    ) order by b.dihapus_pada desc)
    from public.inv_barang b where b.dihapus_pada is not null and b.dihapus_permanen_pada is null), '[]'::jsonb);
end $$;

create or replace function public.inv_pulihkan_barang(p_id bigint, p_versi int, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; v_seb public.inv_barang;
begin
  select * into a from public.inv_aktor_pengelola(p_aktor);
  select * into b from public.inv_barang where id = p_id for update;
  if not found or b.dihapus_pada is null then raise exception 'Barang ini tidak ada di tempat sampah' using errcode = 'VTVER'; end if;
  if b.dihapus_permanen_pada is not null then raise exception 'Barang ini sudah dihapus permanen' using errcode = '42501'; end if;
  if b.versi <> p_versi then raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = 'VTVER'; end if;
  if b.dihapus_pada <= now() - make_interval(days => public.inv_sampah_hari()) then
    raise exception 'Masa pemulihan % hari sudah lewat - barang hanya bisa dihapus permanen', public.inv_sampah_hari() using errcode = '42501';
  end if;
  v_seb := b;
  perform set_config('inv.izin_sampah', '1', true);
  perform public.inv_konteks(a.nama, 'admin', 'Dipulihkan');
  update public.inv_barang set dihapus_pada = null, dihapus_oleh = null, dihapus_alasan = null where id = p_id returning * into b;
  perform set_config('inv.izin_sampah', '', true);
  insert into public.inv_log (barang_id, jenis, dari, ke, detail, oleh, sumber, keterangan)
  values (p_id, 'pulihkan', 'Tempat sampah', 'Tampil di daftar',
          jsonb_build_object('nomor', b.nomor_inventaris, 'nama', b.nama, 'lokasi', b.lokasi_kode, 'username', a.username, 'divisi', a.divisi,
                             'dihapus_oleh', v_seb.dihapus_oleh, 'dihapus_pada', v_seb.dihapus_pada, 'alasan_hapus', v_seb.dihapus_alasan)::text,
          a.nama, 'admin', 'Dihapus sebelumnya: ' || v_seb.dihapus_alasan);
  return jsonb_build_object('id', b.id, 'jadwal_lewat', (select count(*) from public.inv_jadwal j where j.barang_id = p_id and j.aktif and j.jatuh_tempo < public.inv_hari_ini()));
end $$;

-- Sandi dicek persis seperti verify_admin_login: bcrypt di server, akun harus is_active = true. Sandi tidak disimpan & tidak dicatat.
create or replace function public.inv_hapus_permanen(p_id bigint, p_versi int, p_konfirmasi text, p_sandi text, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; t jsonb; v_url jsonb;
begin
  select * into a from public.inv_aktor_pengelola(p_aktor);
  if not exists (select 1 from public.admins adm where adm.username = a.username and adm.is_active = true
                 and adm.password = extensions.crypt(coalesce(p_sandi, ''), adm.password)) then
    raise exception 'Sandi salah' using errcode = 'VTSND';
  end if;
  select * into b from public.inv_barang where id = p_id for update;
  if not found or b.dihapus_pada is null then raise exception 'Barang ini tidak ada di tempat sampah' using errcode = 'VTVER'; end if;
  if b.dihapus_permanen_pada is not null then raise exception 'Barang ini sudah dihapus permanen' using errcode = 'VTVER'; end if;
  if b.versi <> p_versi then raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = 'VTVER'; end if;
  if b.dihapus_pada > now() - make_interval(days => public.inv_sampah_hari()) then
    raise exception 'Hapus permanen baru bisa setelah % hari di tempat sampah', public.inv_sampah_hari() using errcode = '42501';
  end if;
  if btrim(coalesce(p_konfirmasi, '')) is distinct from public.inv_teks_konfirmasi(b) then
    raise exception 'Ketik % untuk mengonfirmasi', public.inv_teks_konfirmasi(b) using errcode = '22023';
  end if;
  t := public.inv_hitung_terkait(p_id);
  select coalesce(jsonb_agg(m.url order by m.id), '[]'::jsonb) into v_url from public.inv_media m where public.inv_media_barang_id(m.tujuan, m.ref_id) = p_id;

  perform set_config('inv.musnah_barang', p_id::text, true);
  -- urutan: media dulu (pemilik media dicari lewat induknya), lalu anak sebelum induk
  delete from public.inv_media m where public.inv_media_barang_id(m.tujuan, m.ref_id) = p_id;
  delete from public.inv_laporan_update u where public.inv_laporan_barang_id(u.laporan_id) = p_id;
  delete from public.inv_notifikasi where barang_id = p_id;
  delete from public.inv_jadwal_selesai where barang_id = p_id;
  delete from public.inv_pengingat_log p where p.jadwal_id in (select j.id from public.inv_jadwal j where j.barang_id = p_id);
  delete from public.inv_laporan where barang_id = p_id;
  delete from public.inv_jadwal where barang_id = p_id;
  perform set_config('inv.musnah_barang', '', true);

  perform set_config('inv.izin_sampah', '1', true);
  perform public.inv_konteks(a.nama, 'admin', 'Hapus permanen');
  update public.inv_barang set pengguna = null, detail_kondisi = null, merk_spesifikasi = null, nomor_seri = null,
         dihapus_permanen_pada = now(), dihapus_permanen_oleh = a.nama where id = p_id returning * into b;
  perform set_config('inv.izin_sampah', '', true);
  insert into public.inv_log (barang_id, jenis, dari, ke, detail, oleh, sumber, keterangan)
  values (p_id, 'hapus_permanen', 'Tempat sampah', 'Dihapus permanen',
          jsonb_build_object('nomor', b.nomor_inventaris, 'nama', b.nama, 'lokasi', b.lokasi_kode, 'username', a.username, 'divisi', a.divisi,
                             'terkait', t, 'berkas_r2', v_url, 'dihapus_oleh', b.dihapus_oleh, 'dihapus_pada', b.dihapus_pada)::text,
          a.nama, 'admin', b.dihapus_alasan);
  return jsonb_build_object('id', b.id, 'terkait', t, 'berkas_r2', jsonb_array_length(v_url));
end $$;

-- ── 6. Impor: pencocokan nama + nama asli ────────────────────────────────────────────────────
create or replace function public.inv_norm_nama(p text) returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(p, '')), '[^[:alnum:]]+', '', 'g')
$$;

-- Isi fungsi sama dgn 20261030010000 kecuali bagian bertanda (7 Nov). Hasil tambahan:
--   cocok: [{baris, kunci, nama, status 'dobel'|'sampah', lewat 'nama'|'nama_asli', barang {id, nomor, nama, lokasi, permanen}}]
--   dilewati_sampah: jumlah baris yang dilewati karena barangnya di tempat sampah / sudah dihapus permanen.
-- Tiap barang hanya dipakai satu baris file, jadi barang kembar yang sah (dua Gerinda Mesin) tetap terhitung benar.
create or replace function public.inv_impor(p_baris jsonb, p_dry_run boolean, p_file text, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record; r jsonb; v_ord bigint; v_err text[] := '{}'; v_batch uuid := gen_random_uuid();
  v_dibuat int := 0; v_lewat int := 0; v_id bigint; v_nomor text; v_hasil jsonb; v_ringkasan jsonb;
  v_baru boolean; v_ada_nomor int; v_boleh_tanpa_nomor int;
  v_peta jsonb; v_pakai bigint[]; v_cocok jsonb := '[]'; v_sampah int := 0; v_c jsonb; v_terhapus boolean;
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

  -- (7 Nov) peta nama ternormalkan -> barang: nama sekarang + nama asli di cadangan impor; barang tampil diutamakan
  select coalesce(jsonb_object_agg(norm, daftar), '{}') into v_peta from (
    select norm, jsonb_agg(jsonb_build_object('id', id, 'nomor', nomor_inventaris, 'nama', nama, 'lokasi', lokasi_kode, 'terhapus', terhapus,
             'permanen', permanen, 'lewat', lewat) order by terhapus, id) daftar
    from (select b.id, b.nomor_inventaris, b.nama, b.lokasi_kode, b.dihapus_pada is not null terhapus, b.dihapus_permanen_pada is not null permanen,
                 public.inv_norm_nama(x.nm) norm, min(x.lewat) lewat
          from public.inv_barang b
          cross join lateral (select b.nama nm, 'nama' lewat
                              union all select c.data_asli->>'nama', 'nama_asli' from public.inv_impor_cadangan c where c.hasil->>'barang_id' = b.id::text) x
          where public.inv_norm_nama(x.nm) <> ''
          group by 1, 2, 3, 4, 5, 6, 7) y
    group by norm) z;
  -- barang yang sudah terikat kunci baris file ini tidak boleh dipakai baris lain
  select coalesce(array_agg(b.id), '{}') into v_pakai from public.inv_barang b
   where b.impor_kunci in (select e->>'kunci' from jsonb_array_elements(p_baris) x(e));

  begin
    perform public.inv_konteks(a.nama, 'impor', 'Impor ' || coalesce(p_file, ''), null, true);
    insert into public.inv_impor_batch (id, file_nama, oleh) values (v_batch, p_file, a.nama);
    for r, v_ord in select * from jsonb_array_elements(p_baris) with ordinality loop
      v_c := null;
      select id, nomor_inventaris, dihapus_pada is not null into v_id, v_nomor, v_terhapus from public.inv_barang where impor_kunci = r->>'kunci';
      if found then
        if v_terhapus then   -- (7 Nov)
          v_sampah := v_sampah + 1;
          v_cocok := v_cocok || jsonb_build_object('baris', v_ord, 'kunci', r->>'kunci', 'nama', r->>'nama', 'status', 'sampah', 'lewat', 'kunci',
            'barang', (select jsonb_build_object('id', b.id, 'nomor', b.nomor_inventaris, 'nama', b.nama, 'lokasi', b.lokasi_kode, 'permanen', b.dihapus_permanen_pada is not null)
                       from public.inv_barang b where b.id = v_id));
          v_hasil := jsonb_build_object('status', 'dilewati_sampah', 'barang_id', v_id, 'nomor', v_nomor);
        else
          v_lewat := v_lewat + 1;
          v_hasil := jsonb_build_object('status', 'dilewati', 'barang_id', v_id, 'nomor', v_nomor);
        end if;
      else
        -- (7 Nov) barang pertama dgn nama sama yang belum dipakai baris lain
        select e into v_c from jsonb_array_elements(coalesce(v_peta->(public.inv_norm_nama(r->>'nama')), '[]'::jsonb)) with ordinality x(e, u)
         where not ((e->>'id')::bigint = any(v_pakai)) order by u limit 1;
        if v_c is not null then
          v_pakai := v_pakai || (v_c->>'id')::bigint;
          v_cocok := v_cocok || jsonb_build_object('baris', v_ord, 'kunci', r->>'kunci', 'nama', r->>'nama',
            'status', case when (v_c->>'terhapus')::boolean then 'sampah' else 'dobel' end, 'lewat', v_c->>'lewat',
            'barang', v_c - 'terhapus' - 'lewat');
        end if;
        if v_c is not null and (v_c->>'terhapus')::boolean then
          v_sampah := v_sampah + 1;
          v_hasil := jsonb_build_object('status', 'dilewati_sampah', 'barang_id', (v_c->>'id')::bigint, 'nomor', v_c->>'nomor');
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
      end if;
      insert into public.inv_impor_cadangan (batch_id, baris, data_asli, hasil) values (v_batch, v_ord, r, v_hasil);
    end loop;

    select jsonb_build_object(
      'dibuat', v_dibuat, 'dilewati', v_lewat, 'dilewati_sampah', v_sampah,
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
  return v_ringkasan || jsonb_build_object('dry_run', p_dry_run, 'batch', case when p_dry_run then null else v_batch end, 'cocok', v_cocok);
end $$;

-- ── 7. Hak eksekusi (Supabase memberi hak fungsi baru ke anon lewat default privileges) ──────
revoke execute on function public.inv_aktor_pengelola(jsonb), public.inv_hitung_terkait(bigint), public.inv_barang_jaga_sampah(),
  public.inv_tolak_bila_dihapus(), public.inv_tolak_ubah(), public.inv_ada_terkait(jsonb), public.inv_teks_konfirmasi(public.inv_barang)
  from public, anon, authenticated;
grant execute on function public.inv_barang_tampil(bigint), public.inv_media_barang_id(text, bigint), public.inv_laporan_barang_id(bigint),
  public.inv_sampah_hari(), public.inv_norm_nama(text) to anon, authenticated, service_role;
grant execute on function public.inv_pratinjau_hapus(bigint, jsonb), public.inv_hapus_barang(bigint, int, text, text, jsonb),
  public.inv_sampah_daftar(jsonb), public.inv_pulihkan_barang(bigint, int, jsonb), public.inv_hapus_permanen(bigint, int, text, text, jsonb)
  to anon, authenticated;

-- ── 8. Cek otomatis. Blok ini dibatalkan sendiri (VTUJI), barang uji & log kembali seperti semula ─
do $cek$
declare v_admin jsonb; v_id bigint; b public.inv_barang; v_awal public.inv_barang; v_n int; t text; v_sisa int;
  v_sebelum jsonb; v_sesudah jsonb;
begin
  select jsonb_build_object('admin', username) into v_admin from public.admins where divisi = 'admin' and is_active order by id limit 1;
  select * into v_awal from public.inv_barang where nama = 'UJI T2 (abaikan)' order by id limit 1;
  v_id := v_awal.id;
  if (select count(*) from public.inv_barang where dihapus_pada is not null) <> 0 then raise exception 'GAGAL: tempat sampah harus kosong'; end if;
  begin
    v_sebelum := public.inv_hitung_terkait(v_id);
    begin
      perform public.inv_hapus_barang(v_id, v_awal.versi, 'ab', v_awal.nomor_inventaris, v_admin);
      raise exception 'GAGAL: alasan pendek diterima';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.inv_hapus_barang(v_id, -1, 'cek otomatis', v_awal.nomor_inventaris, v_admin);
      raise exception 'GAGAL: versi basi diterima';
    exception when sqlstate 'VTVER' then null; end;
    perform public.inv_hapus_barang(v_id, v_awal.versi, 'cek otomatis', public.inv_teks_konfirmasi(v_awal), v_admin);

    execute 'set local role anon';
    select count(*) into v_n from public.inv_barang where id = v_id;
    if v_n <> 0 then raise exception 'GAGAL: barang di sampah masih terbaca anon'; end if;
    select count(*) into v_n from public.inv_jadwal where barang_id = v_id;
    if v_n <> 0 then raise exception 'GAGAL: jadwal barang di sampah masih terbaca anon'; end if;
    select count(*) into v_n from public.inv_jadwal_v where barang_id = v_id;
    if v_n <> 0 then raise exception 'GAGAL: view jadwal masih menampilkan barang di sampah'; end if;
    select count(*) into v_n from public.inv_laporan where barang_id = v_id;
    if v_n <> 0 then raise exception 'GAGAL: laporan barang di sampah masih terbaca anon'; end if;
    select count(*) into v_n from public.inv_log where barang_id = v_id and jenis = 'hapus';
    if v_n <> 1 then raise exception 'GAGAL: catatan hapus harus terbaca (dapat %)', v_n; end if;
    foreach t in array array['inv_barang','inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update','inv_media','inv_log','inv_notifikasi'] loop
      begin
        execute format('delete from public.%I where id = -1', t);
        raise exception 'GAGAL: anon boleh DELETE %', t;
      exception when insufficient_privilege then null; end;
    end loop;
    execute 'reset role';

    begin
      perform public.inv_set_kondisi(v_id, (select versi from public.inv_barang where id = v_id), 'baik', null, v_admin);
      raise exception 'GAGAL: barang di sampah bisa diubah';
    exception when insufficient_privilege then null; end;
    begin
      delete from public.inv_jadwal where barang_id = v_id;
      if found then raise exception 'GAGAL: pengaman DELETE terbuka'; end if;
    exception when insufficient_privilege then null; end;
    begin
      perform public.inv_hapus_permanen(v_id, (select versi from public.inv_barang where id = v_id), public.inv_teks_konfirmasi(v_awal), 'sandi-yang-salah', v_admin);
      raise exception 'GAGAL: sandi salah diterima';
    exception when sqlstate 'VTSND' then null; end;

    perform public.inv_pulihkan_barang(v_id, (select versi from public.inv_barang where id = v_id), v_admin);
    select * into b from public.inv_barang where id = v_id;
    v_sesudah := public.inv_hitung_terkait(v_id);
    if b.dihapus_pada is not null or b.aktif is distinct from v_awal.aktif or b.kondisi is distinct from v_awal.kondisi
       or b.nomor_inventaris is distinct from v_awal.nomor_inventaris or v_sesudah <> v_sebelum then
      raise exception 'GAGAL: pemulihan tidak mengembalikan keadaan semula';
    end if;
    raise exception 'batal uji' using errcode = 'VTUJI';
  exception when sqlstate 'VTUJI' then null;
  end;
  if (select count(*) from public.inv_barang where dihapus_pada is not null) <> 0 then raise exception 'GAGAL: sisa uji di tempat sampah'; end if;
  if (select versi from public.inv_barang where id = v_id) <> v_awal.versi then raise exception 'GAGAL: barang uji berubah'; end if;
  raise notice 'SEMUA LULUS';
end $cek$;

select 'SEMUA LULUS' as hasil,
       (select count(*) from public.inv_barang) as barang_total,
       (select count(*) from public.inv_barang where dihapus_pada is not null) as di_tempat_sampah,
       (select count(*) from pg_policies where schemaname = 'public' and policyname like 'baca_inv_%' and qual like '%inv_barang_tampil%') as aturan_baca_tersaring;
commit;

-- ROLLBACK (hanya bila tempat sampah kosong: barang di sampah akan muncul lagi di semua layar, nisan tidak bisa dikembalikan):
-- begin;
-- do $$ begin if exists (select 1 from public.inv_barang where dihapus_pada is not null) then raise exception 'Tempat sampah belum kosong, pulihkan dulu'; end if; end $$;
-- drop function public.inv_pratinjau_hapus(bigint, jsonb);
-- drop function public.inv_hapus_barang(bigint, int, text, text, jsonb);
-- drop function public.inv_sampah_daftar(jsonb);
-- drop function public.inv_pulihkan_barang(bigint, int, jsonb);
-- drop function public.inv_hapus_permanen(bigint, int, text, text, jsonb);
-- drop trigger inv_barang_jaga_sampah on public.inv_barang;
-- drop trigger inv_notifikasi_jaga_sampah on public.inv_notifikasi;
-- drop trigger inv_jadwal_jaga_sampah on public.inv_jadwal;
-- drop trigger inv_jadwal_selesai_jaga_sampah on public.inv_jadwal_selesai;
-- drop trigger inv_laporan_jaga_sampah on public.inv_laporan;
-- drop trigger inv_laporan_update_jaga_sampah on public.inv_laporan_update;
-- drop trigger inv_media_jaga_sampah on public.inv_media;
-- drop function public.inv_barang_jaga_sampah();
-- drop function public.inv_tolak_bila_dihapus();
-- create or replace function public.inv_tolak_ubah() returns trigger language plpgsql as $f$
-- begin
--   raise exception '%: data permanen, % tidak diizinkan', tg_table_name, tg_op using errcode = '42501';
-- end $f$;
-- create or replace view public.inv_jadwal_v with (security_invoker = true) as
--   select j.*,
--          case when not j.aktif or j.jatuh_tempo is null then 'normal'
--               when j.jatuh_tempo < public.inv_hari_ini() then 'terlambat'
--               when j.jatuh_tempo <= public.inv_hari_ini() + public.inv_batas_segera() then 'segera'
--               else 'normal' end as status_jadwal,
--          (j.terakhir_dilakukan = public.inv_hari_ini()) as selesai_hari_ini
--   from public.inv_jadwal j;
-- drop policy baca_inv_barang on public.inv_barang;
-- create policy baca_inv_barang on public.inv_barang for select to anon, authenticated using (true);
-- drop policy baca_inv_jadwal on public.inv_jadwal;
-- create policy baca_inv_jadwal on public.inv_jadwal for select to anon, authenticated using (true);
-- drop policy baca_inv_jadwal_selesai on public.inv_jadwal_selesai;
-- create policy baca_inv_jadwal_selesai on public.inv_jadwal_selesai for select to anon, authenticated using (true);
-- drop policy baca_inv_laporan on public.inv_laporan;
-- create policy baca_inv_laporan on public.inv_laporan for select to anon, authenticated using (true);
-- drop policy baca_inv_laporan_update on public.inv_laporan_update;
-- create policy baca_inv_laporan_update on public.inv_laporan_update for select to anon, authenticated using (true);
-- drop policy baca_inv_media on public.inv_media;
-- create policy baca_inv_media on public.inv_media for select to anon, authenticated using (true);
-- drop policy baca_inv_notifikasi on public.inv_notifikasi;
-- create policy baca_inv_notifikasi on public.inv_notifikasi for select to anon, authenticated using (true);
-- drop policy baca_inv_log on public.inv_log;
-- create policy baca_inv_log on public.inv_log for select to anon, authenticated using (true);
-- drop function public.inv_barang_tampil(bigint);
-- drop function public.inv_media_barang_id(text, bigint);
-- drop function public.inv_laporan_barang_id(bigint);
-- drop function public.inv_sampah_hari();
-- drop function public.inv_ada_terkait(jsonb);
-- drop function public.inv_teks_konfirmasi(public.inv_barang);
-- drop function public.inv_hitung_terkait(bigint);
-- drop function public.inv_aktor_pengelola(jsonb);
-- -- inv_impor: jalankan ulang definisinya dari 20261030010000_inventaris_t1.sql, lalu:
-- drop function public.inv_norm_nama(text);
-- alter table public.inv_log drop constraint inv_log_jenis_check;
-- alter table public.inv_log add constraint inv_log_jenis_check check (jenis in ('kondisi','lokasi','nomor','aktif','data'));   -- gagal bila ada log hapus: biarkan constraint baru
-- alter table public.inv_barang drop constraint inv_barang_hapus_lengkap, drop constraint inv_barang_permanen_dari_sampah,
--   drop column dihapus_pada, drop column dihapus_oleh, drop column dihapus_alasan, drop column dihapus_permanen_pada, drop column dihapus_permanen_oleh;
-- commit;
