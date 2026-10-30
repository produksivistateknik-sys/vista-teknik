-- PATCH 20261030020000 (30 Okt 2026, temuan uji live T2): galat "versi basi" (data barang sudah diubah orang lain) dulu
-- memakai SQLSTATE 40001 (serialization_failure) -> PostgREST MENGULANG transaksi otomatis untuk kode itu sampai gateway
-- timeout (terukur 127 dtk, "upstream request timeout"; data tidak berubah). Diganti kode khusus VTVER (langsung kembali
-- sebagai galat biasa). Isi fungsi lain TIDAK berubah - disalin dari 20261030010000, hanya errcode.
-- SIAP JALAN: Run sekali. Cek otomatis di akhir (pakai barang uji T2 #263 yang nonaktif, tidak mengubah data).
-- Rollback: jalankan ulang definisi kedua fungsi dari 20261030010000_inventaris_t1.sql (errcode 40001).
begin;

create or replace function public.inv_ubah_barang(p_id bigint, p_versi int, p_patch jsonb, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record; b public.inv_barang; v_asing text[];
  v_boleh constant text[] := array['nama','lokasi_kode','pengguna','kondisi','detail_kondisi','merk_spesifikasi',
                                   'nomor_seri','tanggal_perolehan','tanggal_perolehan_teks','aktif'];
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin yang bisa mengubah data barang' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Perubahan kosong' using errcode = '22023'; end if;
  select array_agg(k) into v_asing from jsonb_object_keys(p_patch) k where k <> all(v_boleh);
  if v_asing is not null then raise exception 'Kolom tidak bisa diubah: %', v_asing using errcode = '22023'; end if;

  select * into b from public.inv_barang where id = p_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if b.versi <> p_versi then
    raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = 'VTVER';
  end if;
  if p_patch ? 'kondisi' and p_patch->>'kondisi' is distinct from b.kondisi
     and exists (select 1 from public.inv_laporan where barang_id = p_id and status <> 'closed') then
    raise exception 'Ada laporan kerusakan aktif - tutup laporan dulu' using errcode = '42501';
  end if;
  if p_patch ? 'lokasi_kode' and p_patch->>'lokasi_kode' is distinct from b.lokasi_kode
     and not exists (select 1 from public.inv_lokasi where kode = p_patch->>'lokasi_kode' and aktif) then
    raise exception 'Lokasi % tidak tersedia', p_patch->>'lokasi_kode' using errcode = '22023';
  end if;

  perform public.inv_konteks(a.nama, 'admin');
  update public.inv_barang set
    nama              = case when p_patch ? 'nama' then p_patch->>'nama' else nama end,
    lokasi_kode       = case when p_patch ? 'lokasi_kode' then p_patch->>'lokasi_kode' else lokasi_kode end,
    pengguna          = case when p_patch ? 'pengguna' then nullif(btrim(p_patch->>'pengguna'), '') else pengguna end,
    kondisi           = case when p_patch ? 'kondisi' then p_patch->>'kondisi' else kondisi end,
    detail_kondisi    = case when p_patch ? 'detail_kondisi' then nullif(btrim(p_patch->>'detail_kondisi'), '') else detail_kondisi end,
    merk_spesifikasi  = case when p_patch ? 'merk_spesifikasi' then nullif(btrim(p_patch->>'merk_spesifikasi'), '') else merk_spesifikasi end,
    nomor_seri        = case when p_patch ? 'nomor_seri' then nullif(btrim(p_patch->>'nomor_seri'), '') else nomor_seri end,
    tanggal_perolehan = case when p_patch ? 'tanggal_perolehan' then nullif(p_patch->>'tanggal_perolehan', '')::date else tanggal_perolehan end,
    tanggal_perolehan_teks = case when p_patch ? 'tanggal_perolehan_teks' then nullif(btrim(p_patch->>'tanggal_perolehan_teks'), '') else tanggal_perolehan_teks end,
    aktif             = case when p_patch ? 'aktif' then (p_patch->>'aktif')::boolean else aktif end
  where id = p_id
  returning * into b;
  return to_jsonb(b);
end $$;

create or replace function public.inv_set_kondisi(p_id bigint, p_versi int, p_kondisi text, p_detail text, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang;
begin
  select * into a from public.inv_aktor(p_aktor);
  select * into b from public.inv_barang where id = p_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if b.versi <> p_versi then
    raise exception 'Barang ini baru diubah orang lain - muat ulang dulu' using errcode = 'VTVER';
  end if;
  if a.peran = 'operator' then
    if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
    if not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then
      raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501';
    end if;
    if p_kondisi not in ('baik','tidak_maksimal','perlu_maintenance') then
      raise exception 'Operator hanya bisa memilih Berfungsi baik / tidak maksimal / Perlu maintenance. Kerusakan dilaporkan lewat Lapor kerusakan.'
        using errcode = '42501';
    end if;
    if exists (select 1 from public.inv_laporan where barang_id = p_id and status <> 'closed') then
      raise exception 'Ada laporan kerusakan aktif - kondisi terkunci sampai laporan ditutup admin' using errcode = '42501';
    end if;
  else
    if p_kondisi not in ('baik','tidak_maksimal','perlu_maintenance','rusak','belum_dinilai') then
      raise exception 'Kondisi % tidak dikenal', p_kondisi using errcode = '22023';
    end if;
    -- keputusan user: admin juga terkunci selama ada laporan aktif (Rusak tanpa laporan tetap bebas diubah)
    if p_kondisi is distinct from b.kondisi
       and exists (select 1 from public.inv_laporan where barang_id = p_id and status <> 'closed') then
      raise exception 'Ada laporan kerusakan aktif - tutup laporan dulu' using errcode = '42501';
    end if;
  end if;
  perform public.inv_konteks(a.nama, a.peran);
  update public.inv_barang
     set kondisi = p_kondisi,
         detail_kondisi = case when p_detail is null then detail_kondisi else nullif(btrim(p_detail), '') end
   where id = p_id
  returning * into b;
  return to_jsonb(b);
end $$;

do $cek$ begin
  begin
    perform public.inv_set_kondisi((select id from public.inv_barang where nama = 'UJI T2 (abaikan)' order by id limit 1), -1, 'baik', null, '{"admin":"LUTVAN"}'::jsonb);
    raise exception 'GAGAL: versi basi tidak ditolak';
  exception when sqlstate 'VTVER' then null;
  end;
  if exists (select 1 from pg_proc where proname in ('inv_ubah_barang','inv_set_kondisi') and prosrc like '%40001%') then
    raise exception 'GAGAL: masih ada 40001';
  end if;
end $cek$;
select 'versi basi sekarang langsung ditolak (VTVER)' as hasil;
commit;
