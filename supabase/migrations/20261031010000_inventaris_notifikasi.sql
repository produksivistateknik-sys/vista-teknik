-- ============================================================================================
-- INVENTARIS - NOTIFIKASI & PERSETUJUAN ADMIN ATAS TINDAKAN OPERATOR (31 Okt 2026, rancangan disetujui user 30 Okt).
-- Migrasi TAMBAHAN di atas 20261030010000..20261030050000 yang sudah live. Tidak mengubah data yang ada.
-- DIBUAT OTOMATIS oleh skrip pembuat dari definisi RPC TERBARU di migrasi sebelumnya + sisipan pencatat notifikasi
-- (isi lain tiap fungsi tidak berubah).
--   * inv_notifikasi (permanen, realtime, baca-saja utk anon): 1 baris per tindakan operator, dibuat DI DALAM RPC operator
--     (satu transaksi dgn perubahannya; RPC gagal = tidak ada notifikasi; kirim ulang ber-kunci keluar lebih awal = tidak dobel).
--     Jenis: kondisi, kondisi_detail, barang_baru, laporan_baru, laporan_status, laporan_update, maintenance_selesai.
--     Tindakan ADMIN tidak membuat notifikasi (maka tidak ada push utk tindakan admin).
--   * Perubahan operator tetap berlaku langsung; admin memutuskan sesudahnya (versi = kunci bentrok antar admin, VTVER):
--     inv_notif_dilihat(ids[]), inv_notif_setujui(id, versi), inv_notif_kembalikan(id, versi, catatan):
--       kondisi/kondisi_detail -> kondisi+detail kembali ke nilai_sebelum (inv_log sumber admin); ditolak bila sudah berubah lagi
--       barang_baru            -> keputusan 'ditolak' = barang dinonaktifkan (+ sudah diperiksa)
--       laporan_status         -> laporan kembali ke status sebelumnya (lewat inv_ubah_status_laporan admin); ditolak bila sudah berubah
--       laporan_baru / laporan_update / maintenance_selesai -> catatan WAJIB, data tidak diubah
--   * Push (T3): kolom push_status; inv_notif_ambil_push() HANYA service_role (Edge Function inv-notif-push, cron tiap menit):
--     klaim atomik per (operator, jenis) bila tindakan terakhir kelompok >= 30 dtk (atau tertua >= 3 mnt); > 60 mnt = dilewati.
--   * inv_tandai_diperiksa: notifikasi barang_baru barang itu ikut selesai/disetujui.
-- Verifikasi: supabase/verifikasi/20261031010000_inventaris_notifikasi_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261031010000_inventaris_notifikasi_rollback.sql
-- ============================================================================================
begin;

create table public.inv_notifikasi (
  id bigserial primary key,
  jenis text not null check (jenis in ('kondisi','kondisi_detail','barang_baru','laporan_baru','laporan_status','laporan_update','maintenance_selesai')),
  oleh text not null,
  pekerja_id bigint,
  divisi text,
  barang_id bigint not null references public.inv_barang(id),
  ref_id bigint,                          -- laporan (laporan_*) / jadwal (maintenance_selesai)
  teks text not null,
  nilai_sebelum jsonb,
  nilai_sesudah jsonb,
  status text not null default 'baru' check (status in ('baru','dilihat','selesai')),
  keputusan text check (keputusan in ('disetujui','dikembalikan','ditolak')),
  catatan_keputusan text,
  diputuskan_oleh text,
  diputuskan_pada timestamptz,
  dilihat_oleh text,
  dilihat_pada timestamptz,
  versi int not null default 1,
  push_status text not null default 'menunggu' check (push_status in ('menunggu','dikirim','dilewati')),
  push_pada timestamptz,
  dibuat_pada timestamptz not null default now(),
  check ((status = 'selesai') = (keputusan is not null))
);
create index inv_notifikasi_status on public.inv_notifikasi (status, id desc);
create index inv_notifikasi_barang on public.inv_notifikasi (barang_id);
create index inv_notifikasi_divisi on public.inv_notifikasi (divisi, id desc) where keputusan in ('dikembalikan','ditolak');
create index inv_notifikasi_push on public.inv_notifikasi (push_status, pekerja_id, jenis) where push_status = 'menunggu';
alter table public.inv_notifikasi enable row level security;
revoke all on public.inv_notifikasi from anon, authenticated;
grant select on public.inv_notifikasi to anon, authenticated;
create policy baca_inv_notifikasi on public.inv_notifikasi for select to anon, authenticated using (true);
create trigger inv_notifikasi_permanen before delete on public.inv_notifikasi for each row execute function public.inv_tolak_ubah();

create or replace function public.inv_label_kondisi(p text) returns text language sql immutable as $$
  select case p when 'baik' then 'Berfungsi baik' when 'tidak_maksimal' then 'Berfungsi tidak maksimal'
    when 'perlu_maintenance' then 'Perlu maintenance' when 'rusak' then 'Rusak' when 'belum_dinilai' then 'Belum dinilai' else coalesce(p, '-') end
$$;
create or replace function public.inv_label_status(p text) returns text language sql immutable as $$
  select case p when 'open' then 'Open' when 'in_progress' then 'In Progress' when 'closed' then 'Closed' else coalesce(p, '-') end
$$;

create or replace function public.inv_catat_notif(p_jenis text, p_oleh text, p_pekerja_id bigint, p_divisi text, p_barang_id bigint,
  p_ref_id bigint, p_teks text, p_sebelum jsonb, p_sesudah jsonb) returns bigint
language sql security definer set search_path = public as $$
  insert into public.inv_notifikasi (jenis, oleh, pekerja_id, divisi, barang_id, ref_id, teks, nilai_sebelum, nilai_sesudah)
  values (p_jenis, p_oleh, p_pekerja_id, p_divisi, p_barang_id, p_ref_id, left(p_teks, 300), p_sebelum, p_sesudah)
  returning id
$$;

-- ── RPC operator: definisi terbaru + pencatat notifikasi ─────────────────────────────────────
create or replace function public.inv_set_kondisi(p_id bigint, p_versi int, p_kondisi text, p_detail text, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; b public.inv_barang; v_seb jsonb;
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
  v_seb := jsonb_build_object('kondisi', b.kondisi, 'detail', b.detail_kondisi);
  perform public.inv_konteks(a.nama, a.peran);
  update public.inv_barang
     set kondisi = p_kondisi,
         detail_kondisi = case when p_detail is null then detail_kondisi else nullif(btrim(p_detail), '') end
   where id = p_id
  returning * into b;
  -- notifikasi admin (31 Okt 2026): hanya tindakan operator yang benar-benar mengubah kondisi/detail
  if a.peran = 'operator' and (v_seb->>'kondisi' is distinct from b.kondisi or v_seb->>'detail' is distinct from b.detail_kondisi) then
    perform public.inv_catat_notif(case when v_seb->>'kondisi' is distinct from b.kondisi then 'kondisi' else 'kondisi_detail' end,
      a.nama, a.pekerja_id, a.divisi, b.id, null,
      case when v_seb->>'kondisi' is distinct from b.kondisi
        then 'Kondisi ' || b.nama || ': ' || public.inv_label_kondisi(v_seb->>'kondisi') || ' → ' || public.inv_label_kondisi(b.kondisi)
        else 'Detail kondisi ' || b.nama || ': ' || coalesce(b.detail_kondisi, '(dikosongkan)') end,
      v_seb, jsonb_build_object('kondisi', b.kondisi, 'detail', b.detail_kondisi));
  end if;
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
  perform public.inv_catat_notif('barang_baru', a.nama, a.pekerja_id, a.divisi, b.id, null,
    'Barang baru: ' || b.nama || coalesce(' (' || b.nomor_inventaris || ')', ''), null,
    jsonb_build_object('nama', b.nama, 'nomor', b.nomor_inventaris, 'lokasi', b.lokasi_kode, 'kondisi', b.kondisi));
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
  if a.peran = 'operator' then
    perform public.inv_catat_notif('laporan_baru', a.nama, a.pekerja_id, a.divisi, b.id, l.id,
      'Laporan kerusakan ' || b.nama || ': ' || l.judul, jsonb_build_object('kondisi', b.kondisi),
      jsonb_build_object('kondisi', 'rusak', 'judul', l.judul, 'media', v_n));
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
  if a.peran = 'operator' then
    perform public.inv_catat_notif(case when p_status <> v_lama then 'laporan_status' else 'laporan_update' end,
      a.nama, a.pekerja_id, a.divisi, b.id, l.id,
      case when p_status <> v_lama then 'Laporan ' || l.judul || ': ' || public.inv_label_status(v_lama) || ' → ' || public.inv_label_status(p_status)
        else 'Update laporan ' || l.judul || coalesce(': ' || nullif(btrim(p_catatan), ''), '') end,
      jsonb_build_object('status', v_lama, 'kondisi', b.kondisi),
      jsonb_build_object('status', p_status, 'kondisi', (select kondisi from public.inv_barang where id = b.id), 'catatan', nullif(btrim(p_catatan), ''), 'media', v_n));
  end if;
  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n);
end $$;

create or replace function public.inv_selesai_jadwal(p_jadwal_id bigint, p_catatan text, p_media jsonb, p_kunci uuid, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; j public.inv_jadwal; v_jt_lama date; b public.inv_barang; s public.inv_jadwal_selesai; v_n int; v_hari date := public.inv_hari_ini();
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
  v_jt_lama := j.jatuh_tempo;
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
  if a.peran = 'operator' then
    perform public.inv_catat_notif('maintenance_selesai', a.nama, a.pekerja_id, a.divisi, j.barang_id, j.id,
      'Maintenance selesai: ' || j.jenis || ' - ' || b.nama, jsonb_build_object('jatuh_tempo', v_jt_lama),
      jsonb_build_object('jatuh_tempo', j.jatuh_tempo, 'selesai_id', s.id, 'media', v_n, 'catatan', s.catatan));
  end if;
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
  if a.peran = 'operator' then
    perform public.inv_catat_notif('laporan_update', a.nama, a.pekerja_id, a.divisi, l.barang_id, l.id,
      'Update laporan ' || l.judul || coalesce(': ' || nullif(btrim(p_catatan), ''), ''), null,
      jsonb_build_object('update_id', u.id, 'catatan', nullif(btrim(p_catatan), ''), 'media', v_n));
  end if;
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
  update public.inv_notifikasi set status = 'selesai', keputusan = 'disetujui', diputuskan_oleh = a.nama, diputuskan_pada = now(), versi = versi + 1
   where barang_id = b.id and jenis = 'barang_baru' and status <> 'selesai';
  return to_jsonb(b);
end $$;

-- ── RPC admin ────────────────────────────────────────────────────────────────────────────────
create or replace function public.inv_notif_kunci(p_id bigint, p_versi int, p_aktor jsonb, out a_nama text, out n public.inv_notifikasi)
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  select * into n from public.inv_notifikasi where id = p_id for update;
  if not found then raise exception 'Notifikasi tidak ditemukan' using errcode = 'P0002'; end if;
  if n.status = 'selesai' then
    raise exception 'Notifikasi ini sudah diputuskan (%) oleh % - muat ulang', n.keputusan, n.diputuskan_oleh using errcode = 'VTVER';
  end if;
  if n.versi <> p_versi then raise exception 'Notifikasi ini baru diubah admin lain - muat ulang dulu' using errcode = 'VTVER'; end if;
  a_nama := a.nama;
end $$;

create or replace function public.inv_notif_dilihat(p_ids bigint[], p_aktor jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare a record; v int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  -- tidak menaikkan versi: admin lain yang sedang memutuskan tidak terganggu
  update public.inv_notifikasi set status = 'dilihat', dilihat_oleh = a.nama, dilihat_pada = now()
   where id = any(p_ids) and status = 'baru';
  get diagnostics v = row_count;
  return v;
end $$;

create or replace function public.inv_notif_setujui(p_id bigint, p_versi int, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k record; n public.inv_notifikasi;
begin
  select * into k from public.inv_notif_kunci(p_id, p_versi, p_aktor);
  if (k.n).jenis = 'barang_baru' then
    perform public.inv_tandai_diperiksa((k.n).barang_id, p_aktor);   -- ikut menutup notifikasi barang_baru lain barang itu
  end if;
  update public.inv_notifikasi set status = 'selesai', keputusan = 'disetujui', diputuskan_oleh = k.a_nama, diputuskan_pada = now(),
         dilihat_oleh = coalesce(dilihat_oleh, k.a_nama), dilihat_pada = coalesce(dilihat_pada, now()), versi = versi + 1
   where id = p_id and status <> 'selesai';
  select * into n from public.inv_notifikasi where id = p_id;
  return to_jsonb(n);
end $$;

create or replace function public.inv_notif_kembalikan(p_id bigint, p_versi int, p_catatan text, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k record; n public.inv_notifikasi; b public.inv_barang; l public.inv_laporan; g record; v_kep text := 'dikembalikan';
  v_cat text := nullif(btrim(p_catatan), '');
begin
  select * into k from public.inv_notif_kunci(p_id, p_versi, p_aktor);
  n := k.n;
  if n.jenis in ('kondisi', 'kondisi_detail') then
    select * into b from public.inv_barang where id = n.barang_id for update;
    if b.kondisi is distinct from n.nilai_sesudah->>'kondisi' or b.detail_kondisi is distinct from n.nilai_sesudah->>'detail' then
      select oleh, waktu into g from public.inv_log where barang_id = b.id and jenis = 'kondisi' order by id desc limit 1;
      raise exception 'Tidak bisa dikembalikan: kondisi % sudah diubah lagi oleh % (%). Tinjau notifikasi terbarunya.',
        b.nama, coalesce(g.oleh, '-'), to_char(g.waktu at time zone 'Asia/Jakarta', 'DD Mon HH24.MI') using errcode = 'VTVER';
    end if;
    if exists (select 1 from public.inv_laporan where barang_id = b.id and status <> 'closed') then
      raise exception 'Tidak bisa dikembalikan: ada laporan kerusakan aktif pada %', b.nama using errcode = '42501';
    end if;
    perform public.inv_konteks(k.a_nama, 'admin', 'Dikembalikan dari notifikasi #' || n.id || coalesce(': ' || v_cat, ''));
    update public.inv_barang set kondisi = n.nilai_sebelum->>'kondisi', detail_kondisi = n.nilai_sebelum->>'detail' where id = b.id;
  elsif n.jenis = 'barang_baru' then
    v_kep := 'ditolak';
    select * into b from public.inv_barang where id = n.barang_id for update;
    perform public.inv_konteks(k.a_nama, 'admin', 'Ditolak dari notifikasi #' || n.id || coalesce(': ' || v_cat, ''));
    update public.inv_barang set aktif = false, sudah_diperiksa = true, diperiksa_oleh = k.a_nama, diperiksa_pada = now() where id = b.id;
  elsif n.jenis = 'laporan_status' then
    select * into l from public.inv_laporan where id = n.ref_id;
    if l.status is distinct from n.nilai_sesudah->>'status' then
      raise exception 'Tidak bisa dikembalikan: status laporan sudah berubah lagi (sekarang %)', public.inv_label_status(l.status) using errcode = 'VTVER';
    end if;
    perform public.inv_ubah_status_laporan(l.id, n.nilai_sebelum->>'status', 'Dikembalikan admin' || coalesce(': ' || v_cat, ''),
      null, null, null, p_aktor);
  else
    if v_cat is null then raise exception 'Tuliskan catatan untuk operator' using errcode = '22023'; end if;
  end if;
  update public.inv_notifikasi set status = 'selesai', keputusan = v_kep, catatan_keputusan = v_cat, diputuskan_oleh = k.a_nama,
         diputuskan_pada = now(), dilihat_oleh = coalesce(dilihat_oleh, k.a_nama), dilihat_pada = coalesce(dilihat_pada, now()), versi = versi + 1
   where id = p_id
  returning * into n;
  return to_jsonb(n);
end $$;

-- ── Push (T3): klaim atomik utk Edge Function inv-notif-push (service_role saja) ──────────────────
create or replace function public.inv_notif_ambil_push(p_tenang_detik int default 30, p_maks_tunggu_detik int default 180,
  p_basi_menit int default 60) returns setof public.inv_notifikasi
language plpgsql security definer set search_path = public as $$
begin
  update public.inv_notifikasi set push_status = 'dilewati', push_pada = now()
   where push_status = 'menunggu' and dibuat_pada < now() - make_interval(mins => p_basi_menit);
  return query
  with kel as (
    select pekerja_id, jenis from public.inv_notifikasi where push_status = 'menunggu'
    group by pekerja_id, jenis
    having max(dibuat_pada) <= now() - make_interval(secs => p_tenang_detik) or min(dibuat_pada) <= now() - make_interval(secs => p_maks_tunggu_detik)
  ), ambil as (
    select x.id from public.inv_notifikasi x join kel on kel.pekerja_id is not distinct from x.pekerja_id and kel.jenis = x.jenis
     where x.push_status = 'menunggu' for update of x skip locked
  )
  update public.inv_notifikasi x set push_status = 'dikirim', push_pada = now() from ambil where x.id = ambil.id
  returning x.*;
end $$;

revoke execute on function public.inv_catat_notif(text, text, bigint, text, bigint, bigint, text, jsonb, jsonb),
  public.inv_notif_kunci(bigint, int, jsonb), public.inv_notif_ambil_push(int, int, int) from public, anon, authenticated;
grant execute on function public.inv_notif_ambil_push(int, int, int) to service_role;
grant execute on function public.inv_label_kondisi(text), public.inv_label_status(text),
  public.inv_notif_dilihat(bigint[], jsonb), public.inv_notif_setujui(bigint, int, jsonb),
  public.inv_notif_kembalikan(bigint, int, text, jsonb) to anon, authenticated;

commit;
