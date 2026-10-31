-- ROLLBACK 20261031010000_inventaris_notifikasi: RPC operator & inv_tandai_diperiksa kembali ke definisi sebelumnya
-- (disalin otomatis), fungsi notifikasi dicabut. Tabel inv_notifikasi SENGAJA TIDAK dihapus (data permanen) - hanya
-- tidak diisi lagi. Rollback aplikasi (panel admin) dulu sebelum menjalankan ini.
begin;
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
      raise exception 'Ada laporan kerusakan aktif - kondisi terkunci sampai laporan ditutup' using errcode = '42501';
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

create or replace function public.inv_buat_laporan(p_barang_id bigint, p_judul text, p_masalah text, p_media jsonb,
  p_kunci uuid, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; l public.inv_laporan; v_n int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if p_kunci is not null then
    select * into l from public.inv_laporan where kunci = p_kunci;
    if found then return jsonb_build_object('laporan', to_jsonb(l), 'dobel', true); end if;
  end if;
  perform public.inv_validasi_media(p_media);
  -- judul boleh kosong (form HP hanya "Apa masalahnya?") -> baris pertama masalah, maks 200 huruf
  p_judul := left(coalesce(nullif(btrim(p_judul), ''), btrim(split_part(btrim(coalesce(p_masalah, '')), E'\n', 1))), 200);
  if p_judul = '' then
    raise exception 'Tuliskan masalahnya' using errcode = '22023';
  end if;
  select * into b from public.inv_barang where id = p_barang_id for update;
  if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
  if a.peran = 'operator' and not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then
    raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501';
  end if;

  insert into public.inv_laporan (barang_id, judul, masalah, pelapor, pelapor_pekerja_id, sumber, kunci)
  values (p_barang_id, btrim(p_judul), nullif(btrim(p_masalah), ''), a.nama, a.pekerja_id, a.peran, p_kunci)
  on conflict (kunci) do nothing
  returning * into l;
  if l.id is null then  -- kiriman serempak dengan kunci sama
    select * into l from public.inv_laporan where kunci = p_kunci;
    return jsonb_build_object('laporan', to_jsonb(l), 'dobel', true);
  end if;
  v_n := public.inv_simpan_media('laporan', l.id, 'sebelum', p_media, a.nama);
  if b.kondisi <> 'rusak' then
    perform public.inv_konteks(a.nama, a.peran, 'Laporan kerusakan #' || l.id, l.id);
    update public.inv_barang set kondisi = 'rusak' where id = p_barang_id;
  end if;
  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n, 'dobel', false);
end $$;

create or replace function public.inv_ubah_status_laporan(p_laporan_id bigint, p_status text, p_catatan text,
  p_perbaikan text, p_teknisi text, p_media_sesudah jsonb, p_aktor jsonb, p_kondisi_setelah text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a record; l public.inv_laporan; b public.inv_barang; v_lama text; v_bid bigint; v_n int;
  v_kondisi text := coalesce(nullif(btrim(p_kondisi_setelah), ''), 'baik');
begin
  select * into a from public.inv_aktor(p_aktor);
  if p_status not in ('open','in_progress','closed') then raise exception 'Status % tidak dikenal', p_status using errcode = '22023'; end if;
  if v_kondisi not in ('baik','tidak_maksimal','perlu_maintenance') then
    raise exception 'Kondisi setelah perbaikan hanya Berfungsi baik / tidak maksimal / Perlu maintenance' using errcode = '22023';
  end if;
  perform public.inv_validasi_media(p_media_sesudah);
  select barang_id into v_bid from public.inv_laporan where id = p_laporan_id;
  if v_bid is null then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  select * into b from public.inv_barang where id = v_bid for update;      -- urutan kunci: barang lalu laporan
  select * into l from public.inv_laporan where id = p_laporan_id for update;
  v_lama := l.status;
  if a.peran = 'operator' then
    if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
    if not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then
      raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501';
    end if;
    if v_lama = 'closed' then
      raise exception 'Laporan sudah ditutup - membuka kembali hanya lewat admin' using errcode = '42501';
    end if;
  end if;

  v_n := public.inv_simpan_media('laporan', l.id, 'sesudah', p_media_sesudah, a.nama);
  if p_status = 'closed' and v_lama <> 'closed' and not exists (
       select 1 from public.inv_media where tujuan = 'laporan' and ref_id = l.id and peran = 'sesudah' and dihapus_pada is null) then
    raise exception 'Menutup laporan wajib dokumentasi sesudah perbaikan (foto/video)' using errcode = '22023';
  end if;

  update public.inv_laporan set
    status = p_status,
    perbaikan = coalesce(nullif(btrim(p_perbaikan), ''), perbaikan),
    teknisi = coalesce(nullif(btrim(p_teknisi), ''), teknisi),
    ditutup_pada = case when p_status = 'closed' then coalesce(case when v_lama = 'closed' then ditutup_pada end, now()) end,
    ditutup_oleh = case when p_status = 'closed' then coalesce(case when v_lama = 'closed' then ditutup_oleh end, a.nama) end
  where id = l.id
  returning * into l;

  if p_status <> v_lama or coalesce(btrim(p_catatan), '') <> '' then
    insert into public.inv_laporan_update (laporan_id, oleh, catatan, status_dari, status_ke)
    values (l.id, a.nama, nullif(btrim(p_catatan), ''),
            case when p_status <> v_lama then v_lama end, case when p_status <> v_lama then p_status end);
  end if;

  -- kondisi barang: ditutup & tidak ada laporan aktif lain -> kondisi pilihan; dibuka lagi -> rusak. Log sumber = peran.
  if p_status = 'closed' and v_lama <> 'closed'
     and not exists (select 1 from public.inv_laporan where barang_id = b.id and status <> 'closed') then
    perform public.inv_konteks(a.nama, a.peran, 'Laporan #' || l.id || ' ditutup', l.id);
    update public.inv_barang set kondisi = v_kondisi where id = b.id;
  elsif p_status <> 'closed' and v_lama = 'closed' and b.kondisi <> 'rusak' then
    perform public.inv_konteks(a.nama, a.peran, 'Laporan #' || l.id || ' dibuka lagi', l.id);
    update public.inv_barang set kondisi = 'rusak' where id = b.id;
  end if;
  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n);
end $$;

create or replace function public.inv_selesai_jadwal(p_jadwal_id bigint, p_catatan text, p_media jsonb, p_kunci uuid, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; j public.inv_jadwal; b public.inv_barang; s public.inv_jadwal_selesai; v_n int; v_hari date := public.inv_hari_ini();
begin
  select * into a from public.inv_aktor(p_aktor);
  if p_kunci is not null then
    select * into s from public.inv_jadwal_selesai where kunci = p_kunci;
    if found then return jsonb_build_object('selesai', to_jsonb(s), 'dobel', true); end if;
  end if;
  v_n := public.inv_validasi_media(p_media);
  select * into j from public.inv_jadwal where id = p_jadwal_id for update;
  if not found then raise exception 'Jadwal tidak ditemukan' using errcode = 'P0002'; end if;
  if not j.aktif then raise exception 'Jadwal sudah nonaktif' using errcode = '42501'; end if;
  select * into b from public.inv_barang where id = j.barang_id;
  if not b.aktif then raise exception 'Barang sudah nonaktif' using errcode = '42501'; end if;
  if a.peran = 'operator' then
    if not public.inv_operator_boleh(a.divisi, b.lokasi_kode) then raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501'; end if;
    if v_n = 0 then raise exception 'Wajib minimal 1 foto/video sebelum menandai selesai' using errcode = '22023'; end if;
    if j.terakhir_dilakukan = v_hari then raise exception 'Jadwal ini sudah ditandai selesai hari ini' using errcode = '42501'; end if;
  end if;

  insert into public.inv_jadwal_selesai (jadwal_id, barang_id, tanggal, oleh, pekerja_id, sumber, tanpa_dokumentasi, catatan, kunci)
  values (j.id, j.barang_id, v_hari, a.nama, a.pekerja_id, a.peran, v_n = 0, nullif(btrim(p_catatan), ''), p_kunci)
  on conflict (kunci) do nothing
  returning * into s;
  if s.id is null then
    select * into s from public.inv_jadwal_selesai where kunci = p_kunci;
    return jsonb_build_object('selesai', to_jsonb(s), 'dobel', true);
  end if;
  perform public.inv_simpan_media('jadwal_selesai', s.id, 'selesai', p_media, a.nama);
  update public.inv_jadwal set terakhir_dilakukan = v_hari, jatuh_tempo = public.inv_jatuh_tempo_berikut(v_hari, frekuensi)
   where id = j.id returning * into j;
  return jsonb_build_object('selesai', to_jsonb(s), 'jadwal', to_jsonb(j), 'dobel', false);
end $$;

create or replace function public.inv_tambah_update_laporan(p_laporan_id bigint, p_catatan text, p_media jsonb, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; l public.inv_laporan; v_lok text; u public.inv_laporan_update; v_n int;
begin
  select * into a from public.inv_aktor(p_aktor);
  perform public.inv_validasi_media(p_media);
  select * into l from public.inv_laporan where id = p_laporan_id;
  if not found then raise exception 'Laporan tidak ditemukan' using errcode = 'P0002'; end if;
  if a.peran = 'operator' then
    select lokasi_kode into v_lok from public.inv_barang where id = l.barang_id;
    if not public.inv_operator_boleh(a.divisi, v_lok) then raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501'; end if;
    if l.status = 'closed' then raise exception 'Laporan sudah ditutup' using errcode = '42501'; end if;
  end if;
  if coalesce(btrim(p_catatan), '') = '' and coalesce(jsonb_array_length(p_media), 0) = 0 then
    raise exception 'Isi catatan atau lampirkan media' using errcode = '22023';
  end if;
  insert into public.inv_laporan_update (laporan_id, oleh, catatan) values (l.id, a.nama, nullif(btrim(p_catatan), ''))
  returning * into u;
  v_n := public.inv_simpan_media('laporan_update', u.id, 'update', p_media, a.nama);
  return jsonb_build_object('update', to_jsonb(u), 'media', v_n);
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

drop function if exists public.inv_notif_ambil_push(int, int, int);
drop function if exists public.inv_notif_kembalikan(bigint, int, text, jsonb);
drop function if exists public.inv_notif_setujui(bigint, int, jsonb);
drop function if exists public.inv_notif_dilihat(bigint[], jsonb);
drop function if exists public.inv_notif_kunci(bigint, int, jsonb);
drop function if exists public.inv_catat_notif(text, text, bigint, text, bigint, bigint, text, jsonb, jsonb);
select count(*) as sisa_fungsi_notif from pg_proc where proname like 'inv_notif%' or proname = 'inv_catat_notif';
commit;
