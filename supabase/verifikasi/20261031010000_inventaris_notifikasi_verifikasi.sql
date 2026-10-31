-- VERIFIKASI 20261031010000_inventaris_notifikasi. Semua uji di transaksi yang di-ROLLBACK (barang/laporan/notifikasi uji
-- tidak tersisa, penghitung nomor tidak terpakai). Harus berakhir tanpa galat ('SEMUA LULUS' di NOTICE).
begin;
do $$
declare
  v_op bigint; v_lain bigint; v_admin text; v_admin2 text; v_ok jsonb; v_lainA jsonb; v_ak jsonb; v_ak2 jsonb;
  v_b bigint; v_b2 bigint; v_l bigint; v_j bigint; v_n0 bigint; v_n bigint; r jsonb; v_id bigint; v_k uuid := gen_random_uuid();
  v_foto constant jsonb := '[{"url":"https://uji.invalid/inventaris/n.jpg","mime":"image/jpeg"}]';
  hitung int; v_t text;
begin
  select id into v_op from public.pekerja where divisi = 'painting' and deleted_at is null order by id limit 1;
  select id into v_lain from public.pekerja where divisi = 'mekanik' and deleted_at is null order by id limit 1;
  select username into v_admin from public.admins where coalesce(is_active, true) order by id limit 1;
  select username into v_admin2 from public.admins where coalesce(is_active, true) and username <> v_admin order by id limit 1;
  if v_op is null or v_lain is null or v_admin is null then raise exception 'GAGAL V0: bahan uji tidak ada'; end if;
  v_ok := jsonb_build_object('pekerja_id', v_op, 'divisi', 'painting');
  v_lainA := jsonb_build_object('pekerja_id', v_lain, 'divisi', 'mekanik');
  v_ak := jsonb_build_object('admin', v_admin); v_ak2 := jsonb_build_object('admin', coalesce(v_admin2, v_admin));
  v_n0 := coalesce((select max(id) from public.inv_notifikasi), 0);

  -- V1 tiap RPC operator membuat TEPAT satu notifikasi, jenis & isi benar
  r := public.inv_tambah_barang_operator('{"nama":"UJI NOTIF"}', v_k, v_ok); v_b := (r->>'id')::bigint;
  perform public.inv_tambah_barang_operator('{"nama":"UJI NOTIF"}', v_k, v_ok);                       -- kirim ulang: tidak dobel
  perform public.inv_set_kondisi(v_b, (select versi from public.inv_barang where id = v_b), 'perlu_maintenance', 'bocor', v_ok);
  perform public.inv_set_kondisi(v_b, (select versi from public.inv_barang where id = v_b), 'perlu_maintenance', 'bocor besar', v_ok);
  perform public.inv_set_kondisi(v_b, (select versi from public.inv_barang where id = v_b), 'perlu_maintenance', 'bocor besar', v_ok); -- tanpa perubahan
  v_l := (public.inv_buat_laporan(v_b, null, 'uji notif', null, gen_random_uuid(), v_ok)->'laporan'->>'id')::bigint;
  perform public.inv_tambah_update_laporan(v_l, 'cek', null, v_ok);
  perform public.inv_ubah_status_laporan(v_l, 'in_progress', null, null, null, null, v_ok);
  perform public.inv_ubah_status_laporan(v_l, 'closed', null, null, null, v_foto, v_ok, 'tidak_maksimal');
  v_j := (public.inv_simpan_jadwal(null, jsonb_build_object('barang_id', v_b, 'jenis', 'UJI cek', 'frekuensi', 'mingguan'), v_ak)->>'id')::bigint;
  v_id := (public.inv_selesai_jadwal(v_j, null, v_foto, gen_random_uuid(), v_ok)->'selesai'->>'id')::bigint;
  select string_agg(jenis, ',' order by id) into v_t from public.inv_notifikasi where id > v_n0 and barang_id = v_b;
  if v_t is distinct from 'barang_baru,kondisi,kondisi_detail,laporan_baru,laporan_update,laporan_status,laporan_status,maintenance_selesai' then
    raise exception 'GAGAL V1a: %', v_t; end if;
  if exists (select 1 from public.inv_notifikasi where id > v_n0 and barang_id = v_b
             and (status <> 'baru' or push_status <> 'menunggu' or oleh <> (select nama from public.pekerja where id = v_op) or divisi <> 'painting')) then
    raise exception 'GAGAL V1b: atribut notifikasi'; end if;
  if (select nilai_sebelum->>'kondisi' || '>' || (nilai_sesudah->>'kondisi') from public.inv_notifikasi where id > v_n0 and jenis = 'kondisi' and barang_id = v_b) <> 'baik>perlu_maintenance' then
    raise exception 'GAGAL V1c: nilai kondisi'; end if;
  if (select ref_id from public.inv_notifikasi where id > v_n0 and jenis = 'maintenance_selesai' and barang_id = v_b) <> v_j then raise exception 'GAGAL V1d: ref jadwal'; end if;
  raise notice 'LULUS V1: 6 jalur operator -> tepat 1 notifikasi per tindakan nyata (kirim ulang & simpan tanpa perubahan tidak)';

  -- V2 RPC gagal tidak meninggalkan notifikasi; tindakan admin tidak membuat notifikasi
  hitung := (select count(*) from public.inv_notifikasi);
  begin perform public.inv_set_kondisi(v_b, (select versi from public.inv_barang where id = v_b), 'baik', null, v_lainA); exception when others then null; end;
  begin perform public.inv_ubah_status_laporan(v_l, 'open', null, null, null, null, v_ok); exception when others then null; end;
  perform public.inv_set_kondisi(v_b, (select versi from public.inv_barang where id = v_b), 'baik', null, v_ak);
  perform public.inv_tambah_barang('{"nama":"UJI ADMIN","lokasi_kode":"PT"}', v_ak);
  if (select count(*) from public.inv_notifikasi) <> hitung then raise exception 'GAGAL V2: ada notifikasi dari RPC gagal/admin'; end if;
  raise notice 'LULUS V2: RPC gagal & tindakan admin tidak membuat notifikasi';

  -- V3 kembalikan kondisi: ditolak bila sudah berubah lagi; berhasil pada notifikasi terbaru
  v_id := (select id from public.inv_notifikasi where id > v_n0 and jenis = 'kondisi' and barang_id = v_b);
  begin perform public.inv_notif_kembalikan(v_id, 1, 'salah pilih', v_ak); raise exception 'GAGAL V3a: diterima padahal sudah berubah';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  perform public.inv_set_kondisi(v_b, (select versi from public.inv_barang where id = v_b), 'tidak_maksimal', 'agak lemah', v_ok);
  v_id := (select max(id) from public.inv_notifikasi where barang_id = v_b and jenis = 'kondisi');
  r := public.inv_notif_kembalikan(v_id, 1, 'cek ulang', v_ak);
  if r->>'keputusan' <> 'dikembalikan' or (select kondisi || '|' || coalesce(detail_kondisi, '') from public.inv_barang where id = v_b) <> 'baik|bocor besar' then
    raise exception 'GAGAL V3b: %', (select kondisi || '|' || coalesce(detail_kondisi, '') from public.inv_barang where id = v_b); end if;
  if not exists (select 1 from public.inv_log where barang_id = v_b and sumber = 'admin' and ke = 'baik' and keterangan like 'Dikembalikan dari notifikasi #' || v_id || '%') then
    raise exception 'GAGAL V3c: log admin'; end if;
  raise notice 'LULUS V3: kembalikan ditolak bila kondisi sudah berubah, berhasil & tercatat sumber admin';

  -- V4 dua admin memutuskan notifikasi yang sama: yang kedua kena VTVER
  v_id := (select id from public.inv_notifikasi where id > v_n0 and jenis = 'laporan_baru' and barang_id = v_b);
  perform public.inv_notif_dilihat(array[v_id], v_ak2);                                  -- dilihat tidak menaikkan versi
  perform public.inv_notif_setujui(v_id, 1, v_ak);
  begin perform public.inv_notif_setujui(v_id, 1, v_ak2); raise exception 'GAGAL V4a: keputusan kedua diterima';
  exception when sqlstate 'VTVER' then null; end;
  begin perform public.inv_notif_kembalikan(v_id, 1, 'x', v_ak2); raise exception 'GAGAL V4b: kembalikan sesudah setujui diterima';
  exception when sqlstate 'VTVER' then null; end;
  if (select keputusan || '/' || versi || '/' || dilihat_oleh from public.inv_notifikasi where id = v_id) <> 'disetujui/2/' || (select nama from public.admins where username = coalesce(v_admin2, v_admin)) then
    raise exception 'GAGAL V4c: %', (select keputusan || '/' || versi || '/' || dilihat_oleh from public.inv_notifikasi where id = v_id); end if;
  raise notice 'LULUS V4: keputusan kedua (admin lain) ditolak VTVER';

  -- V5 laporan_status dikembalikan -> laporan dibuka lagi (kondisi rusak); maintenance & update wajib catatan; operator ditolak
  v_id := (select max(id) from public.inv_notifikasi where id > v_n0 and jenis = 'laporan_status' and barang_id = v_b);
  begin perform public.inv_notif_setujui(v_id, 1, v_ok); raise exception 'GAGAL V5a: operator memutuskan';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  perform public.inv_notif_kembalikan(v_id, 1, 'foto kurang jelas', v_ak);
  if (select status from public.inv_laporan where id = v_l) <> 'in_progress' or (select kondisi from public.inv_barang where id = v_b) <> 'rusak' then
    raise exception 'GAGAL V5b: laporan tidak dibuka lagi'; end if;
  v_id := (select id from public.inv_notifikasi where id > v_n0 and jenis = 'maintenance_selesai' and barang_id = v_b);
  begin perform public.inv_notif_kembalikan(v_id, 1, '  ', v_ak); raise exception 'GAGAL V5c: tanpa catatan diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  perform public.inv_notif_kembalikan(v_id, 1, 'foto bukan barang ini', v_ak);
  raise notice 'LULUS V5: laporan_status dikembalikan membuka laporan, catatan wajib utk jenis tanpa perubahan data';

  -- V6 barang baru: setujui = sudah diperiksa (lewat tombol lama juga menutup notifikasi); tolak = nonaktif
  v_b2 := (public.inv_tambah_barang_operator('{"nama":"UJI NOTIF 2"}', gen_random_uuid(), v_ok)->>'id')::bigint;
  perform public.inv_tandai_diperiksa(v_b2, v_ak);
  if (select status || keputusan from public.inv_notifikasi where barang_id = v_b2 and jenis = 'barang_baru') <> 'selesaidisetujui' then raise exception 'GAGAL V6a'; end if;
  v_id := (select id from public.inv_notifikasi where id > v_n0 and jenis = 'barang_baru' and barang_id = v_b);
  perform public.inv_notif_kembalikan(v_id, 1, 'barang tidak ada', v_ak);
  if (select aktif from public.inv_barang where id = v_b) or (select keputusan from public.inv_notifikasi where id = v_id) <> 'ditolak' then raise exception 'GAGAL V6b'; end if;
  raise notice 'LULUS V6: barang baru setujui/tolak';

  -- V7 klaim push: kelompok per (operator, jenis), tenang 30 dtk; basi -> dilewati; tidak dobel
  update public.inv_notifikasi set dibuat_pada = now() - interval '2 minutes' where id > v_n0 and jenis = 'kondisi_detail';
  update public.inv_notifikasi set dibuat_pada = now() - interval '2 hours' where id > v_n0 and jenis = 'barang_baru' and barang_id = v_b2;
  if (select count(*) from public.inv_notif_ambil_push() x where x.id > v_n0) <> 1 then raise exception 'GAGAL V7a: klaim'; end if;
  if (select count(*) from public.inv_notif_ambil_push() x where x.id > v_n0) <> 0 then raise exception 'GAGAL V7b: klaim dobel'; end if;
  if (select push_status from public.inv_notifikasi where barang_id = v_b2 and jenis = 'barang_baru') <> 'dilewati' then raise exception 'GAGAL V7c: basi'; end if;
  if (select count(*) from public.inv_notifikasi where id > v_n0 and push_status = 'menunggu') = 0 then raise exception 'GAGAL V7d: yang baru ikut terklaim'; end if;
  raise notice 'LULUS V7: klaim push per kelompok, basi dilewati, tidak dobel';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
