-- VERIFIKASI 20261030040000_inventaris_tambah_operator. Semua uji di transaksi yang di-ROLLBACK (barang uji tidak tersisa,
-- penghitung nomor tidak terpakai). Harus berakhir tanpa galat ('SEMUA LULUS' di NOTICE).
-- Catatan: "dua operator serempak" diuji BERURUTAN di sini (satu koneksi); penjamin serempaknya = kunci baris
-- inv_nomor_penghitung di trigger inv_barang_sebelum (sama dgn tambah admin & impor, T1).
begin;
do $$
declare
  v_op bigint; v_op2 bigint; v_lain bigint; v_admin text; v_ok jsonb; v_ok2 jsonb; v_lainA jsonb; v_ak jsonb;
  b1 jsonb; b2 jsonb; v_pt int; v_k uuid := gen_random_uuid(); v_n int; v_log int;
begin
  select id into v_op from public.pekerja where divisi = 'painting' and deleted_at is null order by id limit 1;
  select id into v_op2 from public.pekerja where divisi = 'painting' and deleted_at is null and id <> v_op order by id limit 1;
  select id into v_lain from public.pekerja where divisi = 'mekanik' and deleted_at is null order by id limit 1;
  select username into v_admin from public.admins where coalesce(is_active, true) order by id limit 1;
  if v_op is null or v_op2 is null or v_lain is null or v_admin is null then raise exception 'GAGAL V0: bahan uji (2 pekerja painting, 1 mekanik, 1 admin) tidak ada'; end if;
  v_ok := jsonb_build_object('pekerja_id', v_op, 'divisi', 'painting');
  v_ok2 := jsonb_build_object('pekerja_id', v_op2, 'divisi', 'painting');
  v_lainA := jsonb_build_object('pekerja_id', v_lain, 'divisi', 'mekanik');
  v_ak := jsonb_build_object('admin', v_admin);

  -- V1 dua operator menambah: nomor berurutan, lokasi terkunci PT, label baru
  v_pt := coalesce((select terakhir from public.inv_nomor_penghitung where kode_lokasi = 'PT'), 0);
  b1 := public.inv_tambah_barang_operator('{"nama":"UJI OP 1","merk_spesifikasi":"M","nomor_seri":"S1","kondisi":"perlu_maintenance","detail_kondisi":"d"}', v_k, v_ok);
  b2 := public.inv_tambah_barang_operator('{"nama":"UJI OP 2"}', gen_random_uuid(), v_ok2);
  if b1->>'nomor_inventaris' <> 'VIT-PT-' || lpad((v_pt + 1)::text, 2, '0') or b2->>'nomor_inventaris' <> 'VIT-PT-' || lpad((v_pt + 2)::text, 2, '0') then
    raise exception 'GAGAL V1a: nomor % %', b1->>'nomor_inventaris', b2->>'nomor_inventaris'; end if;
  if b1->>'lokasi_kode' <> 'PT' or not (b1->>'ditambah_operator')::boolean or (b1->>'sudah_diperiksa')::boolean or b2->>'kondisi' <> 'baik' then
    raise exception 'GAGAL V1b: %', b1; end if;
  if b1->>'pelapor' <> (select nama from public.pekerja where id = v_op) then raise exception 'GAGAL V1c: pelapor %', b1->>'pelapor'; end if;
  select count(*) into v_log from public.inv_log where barang_id = (b1->>'id')::bigint and jenis = 'data' and sumber = 'operator' and keterangan = 'barang baru';
  if v_log <> 1 then raise exception 'GAGAL V1d: log data barang baru %', v_log; end if;
  raise notice 'LULUS V1: nomor berurutan, lokasi terkunci, label baru dari operator, pelapor & log';

  -- V2 kunci sama = barang yang sama (tidak membakar nomor)
  v_n := (select terakhir from public.inv_nomor_penghitung where kode_lokasi = 'PT');
  if not (public.inv_tambah_barang_operator('{"nama":"UJI OP 1"}', v_k, v_ok)->>'dobel')::boolean
     or (select terakhir from public.inv_nomor_penghitung where kode_lokasi = 'PT') <> v_n then raise exception 'GAGAL V2: kirim ulang membuat barang/nomor baru'; end if;
  raise notice 'LULUS V2: kirim ulang (kunci sama) tidak dobel & tidak membakar nomor';

  -- V3 penolakan
  begin perform public.inv_tambah_barang_operator('{"nama":"  "}', gen_random_uuid(), v_ok); raise exception 'GAGAL V3a: nama kosong diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_barang_operator('{"nama":"X","lokasi_kode":"MKN"}', gen_random_uuid(), v_ok); raise exception 'GAGAL V3b: lokasi divisi lain diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_barang_operator('{"nama":"X","kondisi":"rusak"}', gen_random_uuid(), v_ok); raise exception 'GAGAL V3c: kondisi rusak diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_barang_operator('{"nama":"X"}', gen_random_uuid(), jsonb_build_object('pekerja_id', v_op, 'divisi', 'mekanik')); raise exception 'GAGAL V3d: divisi palsu diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_barang_operator('{"nama":"X"}', gen_random_uuid(), v_ak); raise exception 'GAGAL V3e: admin lewat jalur operator';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  if exists (select 1 from public.inv_lokasi where 'komponen' = any(divisi_operator)) then raise notice 'LEWATI V3f: komponen punya lokasi';
  elsif exists (select 1 from public.pekerja where divisi = 'komponen' and deleted_at is null) then
    begin perform public.inv_tambah_barang_operator('{"nama":"X"}', gen_random_uuid(), jsonb_build_object('pekerja_id', (select id from public.pekerja where divisi = 'komponen' and deleted_at is null limit 1), 'divisi', 'komponen'));
      raise exception 'GAGAL V3f: divisi tanpa lokasi diterima';
    exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  end if;
  raise notice 'LULUS V3: nama kosong, lokasi lain, kondisi rusak, divisi palsu, admin, divisi tanpa lokasi -> ditolak';

  -- V4 operator tetap tidak bisa ubah nama/merk/seri; mekanik tidak bisa sentuh barang PT
  begin perform public.inv_ubah_barang((b1->>'id')::bigint, (b1->>'versi')::int, '{"nama":"GANTI"}', v_ok); raise exception 'GAGAL V4a: operator ubah nama';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_set_kondisi((b1->>'id')::bigint, (select versi from public.inv_barang where id = (b1->>'id')::bigint), 'baik', null, v_lainA); raise exception 'GAGAL V4b: divisi lain ubah kondisi';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V4: operator tidak bisa ubah data barang, divisi lain ditolak';

  -- V5 foto barang: operator divisi sendiri boleh (gambar/video), bukan gambar ditolak, datasheet tetap admin
  if (public.inv_tambah_media('barang', (b1->>'id')::bigint, 'foto', '[{"url":"https://uji.invalid/inventaris/op.jpg","mime":"image/jpeg"}]', v_ok)->>'ditambah')::int <> 1 then raise exception 'GAGAL V5a: foto operator'; end if;
  begin perform public.inv_tambah_media('barang', (b1->>'id')::bigint, 'foto', '[{"url":"https://uji.invalid/inventaris/op.pdf","mime":"application/pdf"}]', v_ok); raise exception 'GAGAL V5b: PDF sbg foto';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_media('barang', (b1->>'id')::bigint, 'datasheet', '[{"url":"https://uji.invalid/inventaris/d.pdf","mime":"application/pdf"}]', v_ok); raise exception 'GAGAL V5c: operator datasheet';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V5: foto barang operator, datasheet tetap admin';

  -- V6 admin tandai diperiksa (sekali tercatat), nonaktifkan lewat ubah_barang
  perform public.inv_tandai_diperiksa((b1->>'id')::bigint, v_ak);
  perform public.inv_tandai_diperiksa((b1->>'id')::bigint, v_ak);
  if not (select sudah_diperiksa from public.inv_barang where id = (b1->>'id')::bigint)
     or (select count(*) from public.inv_log where barang_id = (b1->>'id')::bigint and keterangan = 'diperiksa') <> 1 then raise exception 'GAGAL V6a: tandai diperiksa'; end if;
  begin perform public.inv_tandai_diperiksa((b2->>'id')::bigint, v_ok); raise exception 'GAGAL V6b: operator tandai diperiksa';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  perform public.inv_ubah_barang((b2->>'id')::bigint, (select versi from public.inv_barang where id = (b2->>'id')::bigint), '{"aktif":false}', v_ak);
  if (select aktif from public.inv_barang where id = (b2->>'id')::bigint) then raise exception 'GAGAL V6c: nonaktifkan'; end if;
  raise notice 'LULUS V6: admin tandai diperiksa (sekali tercatat), operator ditolak, nonaktifkan via ubah_barang';

  -- V7 barang lama tidak berubah label
  if exists (select 1 from public.inv_barang where not ditambah_operator and not sudah_diperiksa) then raise exception 'GAGAL V7: barang lama berlabel belum diperiksa'; end if;
  raise notice 'SEMUA LULUS';
end $$;
rollback;
