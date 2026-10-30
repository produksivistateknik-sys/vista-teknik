-- VERIFIKASI 20261030050000_inventaris_laporan_operator. Semua uji di transaksi yang di-ROLLBACK (barang/laporan uji
-- tidak tersisa, penghitung nomor tidak terpakai). Harus berakhir tanpa galat ('SEMUA LULUS' di NOTICE).
begin;
do $$
declare
  v_op bigint; v_lain bigint; v_admin text; v_ok jsonb; v_lainA jsonb; v_ak jsonb; v_b bigint; v_l1 bigint; v_l2 bigint; v_l3 bigint;
  v_foto constant jsonb := '[{"url":"https://uji.invalid/inventaris/sesudah.jpg","mime":"image/jpeg"}]';
  v_foto2 constant jsonb := '[{"url":"https://uji.invalid/inventaris/sesudah2.jpg","mime":"image/jpeg"}]';
begin
  select id into v_op from public.pekerja where divisi = 'painting' and deleted_at is null order by id limit 1;
  select id into v_lain from public.pekerja where divisi = 'mekanik' and deleted_at is null order by id limit 1;
  select username into v_admin from public.admins where coalesce(is_active, true) order by id limit 1;
  if v_op is null or v_lain is null or v_admin is null then raise exception 'GAGAL V0: bahan uji (pekerja painting & mekanik, admin) tidak ada'; end if;
  v_ok := jsonb_build_object('pekerja_id', v_op, 'divisi', 'painting');
  v_lainA := jsonb_build_object('pekerja_id', v_lain, 'divisi', 'mekanik');
  v_ak := jsonb_build_object('admin', v_admin);

  v_b := (public.inv_tambah_barang('{"nama":"UJI LAPORAN OP","lokasi_kode":"PT","kondisi":"baik"}', v_ak)->>'id')::bigint;
  v_l1 := (public.inv_buat_laporan(v_b, null, 'uji satu', null, gen_random_uuid(), v_ok)->'laporan'->>'id')::bigint;
  v_l2 := (public.inv_buat_laporan(v_b, null, 'uji dua', null, gen_random_uuid(), v_ok)->'laporan'->>'id')::bigint;
  if (select kondisi from public.inv_barang where id = v_b) <> 'rusak' then raise exception 'GAGAL V0b: laporan tidak membuat rusak'; end if;

  -- V1 operator divisi lain ditolak; kondisi tidak dikenal ditolak
  begin perform public.inv_ubah_status_laporan(v_l1, 'in_progress', null, null, null, null, v_lainA); raise exception 'GAGAL V1a: divisi lain diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_ubah_status_laporan(v_l1, 'closed', null, null, null, v_foto, v_ok, 'rusak'); raise exception 'GAGAL V1b: kondisi rusak diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V1: operator divisi lain & kondisi tidak dikenal ditolak';

  -- V2 operator ubah ke in_progress + catatan -> tercatat di update
  perform public.inv_ubah_status_laporan(v_l1, 'in_progress', 'mulai dikerjakan', null, null, null, v_ok);
  if (select status from public.inv_laporan where id = v_l1) <> 'in_progress'
     or not exists (select 1 from public.inv_laporan_update where laporan_id = v_l1 and status_dari = 'open' and status_ke = 'in_progress' and catatan = 'mulai dikerjakan') then
    raise exception 'GAGAL V2: status/update operator'; end if;
  raise notice 'LULUS V2: operator ubah status + catatan tercatat';

  -- V3 menutup tanpa media sesudah ditolak (status tetap)
  begin perform public.inv_ubah_status_laporan(v_l1, 'closed', null, null, null, null, v_ok, 'baik'); raise exception 'GAGAL V3: tutup tanpa media diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  if (select status from public.inv_laporan where id = v_l1) <> 'in_progress' then raise exception 'GAGAL V3b: status berubah'; end if;
  raise notice 'LULUS V3: tutup tanpa media sesudah ditolak';

  -- V4 dua laporan aktif, satu ditutup -> kondisi tetap rusak
  perform public.inv_ubah_status_laporan(v_l1, 'closed', null, 'ganti selang', null, v_foto, v_ok, 'tidak_maksimal');
  if (select status from public.inv_laporan where id = v_l1) <> 'closed' or (select kondisi from public.inv_barang where id = v_b) <> 'rusak'
     or (select ditutup_oleh from public.inv_laporan where id = v_l1) <> (select nama from public.pekerja where id = v_op) then
    raise exception 'GAGAL V4: %', (select kondisi from public.inv_barang where id = v_b); end if;
  raise notice 'LULUS V4: satu dari dua laporan ditutup -> kondisi tetap rusak';

  -- V5 keduanya ditutup -> kondisi sesuai pilihan, log sumber operator
  perform public.inv_ubah_status_laporan(v_l2, 'closed', null, null, null, v_foto2, v_ok, 'perlu_maintenance');
  if (select kondisi from public.inv_barang where id = v_b) <> 'perlu_maintenance' then raise exception 'GAGAL V5a: kondisi %', (select kondisi from public.inv_barang where id = v_b); end if;
  if not exists (select 1 from public.inv_log where barang_id = v_b and jenis = 'kondisi' and dari = 'rusak' and ke = 'perlu_maintenance'
                 and sumber = 'operator' and keterangan = 'Laporan #' || v_l2 || ' ditutup') then raise exception 'GAGAL V5b: log kondisi'; end if;
  raise notice 'LULUS V5: keduanya ditutup -> kondisi pilihan, log sumber operator';

  -- V6 operator tidak bisa membuka kembali; admin bisa (-> rusak, sumber admin)
  begin perform public.inv_ubah_status_laporan(v_l2, 'open', null, null, null, null, v_ok); raise exception 'GAGAL V6a: operator membuka kembali';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  perform public.inv_ubah_status_laporan(v_l2, 'open', 'belum beres', null, null, null, v_ak);
  if (select kondisi from public.inv_barang where id = v_b) <> 'rusak'
     or not exists (select 1 from public.inv_log where barang_id = v_b and ke = 'rusak' and sumber = 'admin' and keterangan = 'Laporan #' || v_l2 || ' dibuka lagi') then
    raise exception 'GAGAL V6b: buka kembali admin'; end if;
  raise notice 'LULUS V6: buka kembali hanya admin (kondisi rusak lagi)';

  -- V7 admin menutup TANPA p_kondisi_setelah (pemanggilan aplikasi admin lama) -> baik
  perform public.inv_ubah_status_laporan(p_laporan_id => v_l2, p_status => 'closed', p_catatan => null, p_perbaikan => null,
    p_teknisi => null, p_media_sesudah => null, p_aktor => v_ak);
  if (select kondisi from public.inv_barang where id = v_b) <> 'baik' then raise exception 'GAGAL V7: kondisi %', (select kondisi from public.inv_barang where id = v_b); end if;
  raise notice 'LULUS V7: panggilan admin lama (tanpa kondisi) tetap jalan, kondisi baik';

  -- V8 operator: update laporan aktif boleh, barang nonaktif ditolak
  v_l3 := (public.inv_buat_laporan(v_b, null, 'uji tiga', null, gen_random_uuid(), v_ok)->'laporan'->>'id')::bigint;
  perform public.inv_tambah_update_laporan(v_l3, 'cek awal', null, v_ok);
  perform public.inv_ubah_barang(v_b, (select versi from public.inv_barang where id = v_b), '{"aktif":false}', v_ak);
  begin perform public.inv_ubah_status_laporan(v_l3, 'in_progress', null, null, null, null, v_ok); raise exception 'GAGAL V8: barang nonaktif diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V8: update laporan operator jalan, barang nonaktif ditolak';

  if (select count(*) from pg_proc where proname = 'inv_ubah_status_laporan') <> 1 then raise exception 'GAGAL V9: fungsi ganda (overload)'; end if;
  raise notice 'SEMUA LULUS';
end $$;
rollback;
