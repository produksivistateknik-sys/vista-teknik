-- ============================================================================================
-- INVENTARIS - OPERATOR MENGUBAH STATUS LAPORAN KERUSAKAN (DRAF 30 Okt 2026, spesifikasi tambahan user).
-- Migrasi TAMBAHAN di atas T1 (20261030010000) & patch versi (20261030020000) yang sudah live. Tidak mengubah data.
--   * inv_ubah_status_laporan: + parameter p_kondisi_setelah (default null = baik). Fungsi lama di-DROP dulu (bukan
--     overload) supaya PostgREST tidak ambigu; aplikasi admin lama tetap jalan (parameter baru ber-default).
--   * Operator boleh: pekerja aktif (inv_aktor), barang aktif, divisi cocok lokasi barang (inv_operator_boleh).
--     Membuka kembali laporan yang sudah closed = HANYA admin (keputusan user 30 Okt; sama dgn update laporan).
--   * Menutup (operator & admin): wajib >=1 media 'sesudah' (aturan T1, tidak berubah) + kondisi setelah perbaikan
--     baik/tidak_maksimal/perlu_maintenance (default baik) - diterapkan HANYA bila tidak ada laporan aktif lain pada
--     barang itu. Log kondisi: sumber = peran penutup ('operator'/'admin'), dulu 'otomatis'. Dibuka lagi -> rusak.
--   * inv_set_kondisi: hanya pesan "ditutup admin" -> "ditutup" (isi lain SAMA dgn patch 20261030020000).
-- Media 'sesudah' operator dikirim BERSAMA perintah tutup (unggah R2 dulu, butuh sinyal - keputusan user), jadi
-- inv_tambah_media tidak diubah (peran 'sesudah' tetap admin).
-- Verifikasi: supabase/verifikasi/20261030050000_inventaris_laporan_operator_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261030050000_inventaris_laporan_operator_rollback.sql
-- ============================================================================================
begin;

drop function public.inv_ubah_status_laporan(bigint, text, text, text, text, jsonb, jsonb);

create function public.inv_ubah_status_laporan(p_laporan_id bigint, p_status text, p_catatan text,
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
grant execute on function public.inv_ubah_status_laporan(bigint, text, text, text, text, jsonb, jsonb, text) to anon, authenticated;

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

commit;
