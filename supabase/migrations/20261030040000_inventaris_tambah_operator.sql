-- ============================================================================================
-- INVENTARIS - OPERATOR MENAMBAH BARANG SENDIRI (DRAF 30 Okt 2026, spesifikasi tambahan user; BELUM dijalankan).
-- Migrasi TAMBAHAN di atas 20261030010000 (T1) & 20261030020000 (VTVER) yang sudah live - tidak mengubah data yang ada.
--   * inv_barang: ditambah_operator (default false), sudah_diperiksa (default TRUE -> 124+ barang lama dianggap sudah
--     diperiksa), diperiksa_oleh, diperiksa_pada, kunci_tambah (uuid anti-dobel: ketuk dua kali / kirim ulang = 1 barang,
--     tidak membakar nomor kedua; kiriman serempak dgn kunci sama diantrekan advisory lock).
--   * inv_tambah_barang_operator: lokasi TERKUNCI dari divisi login (inv_lokasi.tampil_operator & divisi_operator);
--     divisi tanpa lokasi -> ditolak; divisi dgn >1 lokasi -> p_lokasi_kode wajib salah satunya. Kondisi hanya
--     baik/tidak_maksimal/perlu_maintenance. Nomor dari penghitung atomik yang sama (trigger inv_barang_sebelum).
--     Barang langsung tampil (tanpa persetujuan), ditambah_operator = true, sudah_diperiksa = false.
--   * inv_tandai_diperiksa (admin): label "Baru dari operator" di admin hilang. Nonaktifkan/edit tetap lewat
--     inv_ubah_barang (patch {aktif}/kolom lain) yang sudah ada - TIDAK dibuat inv_set_aktif terpisah (satu jalur).
--   * Operator tetap TIDAK bisa mengubah nama/merk/nomor seri (inv_ubah_barang hanya admin, tidak berubah).
--   * inv_log.jenis + 'data' (barang baru / diperiksa); inv_media.peran + 'foto' (foto barang, operator divisi
--     sendiri & admin, hanya gambar/video) - inv_tambah_media diperluas, kombinasi lain tidak berubah.
-- Verifikasi: supabase/verifikasi/20261030040000_inventaris_tambah_operator_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261030040000_inventaris_tambah_operator_rollback.sql
-- ============================================================================================
begin;

alter table public.inv_barang
  add column ditambah_operator boolean not null default false,
  add column sudah_diperiksa boolean not null default true,
  add column diperiksa_oleh text,
  add column diperiksa_pada timestamptz,
  add column kunci_tambah uuid unique;

alter table public.inv_log drop constraint inv_log_jenis_check;
alter table public.inv_log add constraint inv_log_jenis_check check (jenis in ('kondisi','lokasi','nomor','aktif','data'));
alter table public.inv_media drop constraint inv_media_peran_check;
alter table public.inv_media add constraint inv_media_peran_check check (peran in ('datasheet','foto','sebelum','sesudah','update','selesai','lama'));

create or replace function public.inv_tambah_barang_operator(p_data jsonb, p_kunci uuid, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; v_lok text; v_lokasi text[]; v_kondisi text := coalesce(nullif(p_data->>'kondisi', ''), 'baik');
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'operator' then raise exception 'Fungsi ini untuk operator - admin memakai Tambah inventaris' using errcode = '42501'; end if;
  if p_kunci is not null then
    perform pg_advisory_xact_lock(hashtext('inv_tambah_op:' || p_kunci::text));  -- serempak kunci sama: antre, nomor tidak terbakar
    select * into b from public.inv_barang where kunci_tambah = p_kunci;
    if found then return to_jsonb(b) || jsonb_build_object('dobel', true); end if;
  end if;
  if coalesce(btrim(p_data->>'nama'), '') = '' then raise exception 'Nama barang wajib diisi' using errcode = '22023'; end if;
  if v_kondisi not in ('baik','tidak_maksimal','perlu_maintenance') then
    raise exception 'Kondisi hanya Berfungsi baik / tidak maksimal / Perlu maintenance' using errcode = '22023';
  end if;
  select array_agg(kode order by urut) into v_lokasi from public.inv_lokasi
   where tampil_operator and aktif and a.divisi = any(divisi_operator);
  if v_lokasi is null then raise exception 'Divisi % tidak punya lokasi inventaris', a.divisi using errcode = '42501'; end if;
  v_lok := coalesce(nullif(p_data->>'lokasi_kode', ''), case when array_length(v_lokasi, 1) = 1 then v_lokasi[1] end);
  if v_lok is null then raise exception 'Pilih lokasi barang' using errcode = '22023'; end if;
  if not (v_lok = any(v_lokasi)) then raise exception 'Lokasi % bukan lokasi divisi Anda', v_lok using errcode = '42501'; end if;

  perform public.inv_konteks(a.nama, 'operator', 'barang baru');
  insert into public.inv_barang (nama, lokasi_kode, kondisi, detail_kondisi, merk_spesifikasi, nomor_seri, pengguna,
                                 dibuat_oleh, ditambah_operator, sudah_diperiksa, kunci_tambah)
  values (p_data->>'nama', v_lok, v_kondisi, nullif(btrim(p_data->>'detail_kondisi'), ''), nullif(btrim(p_data->>'merk_spesifikasi'), ''),
          nullif(btrim(p_data->>'nomor_seri'), ''), nullif(btrim(p_data->>'pengguna'), ''), a.nama, true, false, p_kunci)
  on conflict (kunci_tambah) do nothing
  returning * into b;
  if b.id is null then   -- kiriman serempak dgn kunci sama
    select * into b from public.inv_barang where kunci_tambah = p_kunci;
    return to_jsonb(b) || jsonb_build_object('dobel', true);
  end if;
  insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, keterangan)
  values (b.id, 'data', null, b.nama, a.nama, 'operator', 'barang baru');
  return to_jsonb(b) || jsonb_build_object('dobel', false);
end $$;

create or replace function public.inv_tandai_diperiksa(p_id bigint, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  perform public.inv_konteks(a.nama, 'admin', 'diperiksa');
  update public.inv_barang set sudah_diperiksa = true, diperiksa_oleh = a.nama, diperiksa_pada = now()
   where id = p_id and not sudah_diperiksa
  returning * into b;
  if b.id is null then
    select * into b from public.inv_barang where id = p_id;
    if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
    return to_jsonb(b);   -- sudah diperiksa sebelumnya: tidak dicatat ulang
  end if;
  insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, keterangan)
  values (b.id, 'data', 'belum diperiksa', 'sudah diperiksa', a.nama, 'admin', 'diperiksa');
  return to_jsonb(b);
end $$;

-- inv_tambah_media: + (barang, foto) - operator divisi sendiri & admin, hanya gambar/video. Sisanya SAMA dgn T1.
create or replace function public.inv_tambah_media(p_tujuan text, p_ref_id bigint, p_peran text, p_media jsonb, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; v_bid bigint; v_lok text;
begin
  select * into a from public.inv_aktor(p_aktor);
  perform public.inv_validasi_media(p_media);
  if (p_tujuan, p_peran) not in (('laporan','sebelum'),('laporan','sesudah'),('laporan_update','update'),
                                 ('jadwal_selesai','selesai'),('barang','datasheet'),('barang','foto')) then
    raise exception 'Kombinasi % / % tidak diizinkan', p_tujuan, p_peran using errcode = '22023';
  end if;
  if (p_peran in ('sesudah','datasheet')) and a.peran <> 'admin' then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  if p_peran = 'datasheet' and exists (select 1 from jsonb_array_elements(p_media) f
                                       where coalesce(f->>'mime', '') <> 'application/pdf') then
    raise exception 'Datasheet harus PDF' using errcode = '22023';
  end if;
  if p_peran = 'foto' and exists (select 1 from jsonb_array_elements(p_media) f
                                  where coalesce(f->>'mime', '') !~ '^(image|video)/') then
    raise exception 'Foto barang harus gambar atau video' using errcode = '22023';
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

grant execute on function public.inv_tambah_barang_operator(jsonb, uuid, jsonb), public.inv_tandai_diperiksa(bigint, jsonb) to anon, authenticated;

commit;
