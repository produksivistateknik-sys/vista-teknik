-- VERIFIKASI 20261030010000_inventaris_t1. Bagian A+B dijalankan SESUDAH migrasi (boleh sebelum impor).
-- Bagian C dijalankan SESUDAH impor + inv_migrasi_data_lama. Semua uji perilaku di transaksi yang di-ROLLBACK
-- (barang/laporan/jadwal uji tidak tersisa; nomor uji tidak memakan penghitung). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare
  v_admin text; v_op bigint; v_op_lain bigint; v_ak jsonb; v_ok jsonb; v_lain jsonb; v_h jsonb; v_b jsonb; v_b2 jsonb;
  v_id bigint; v_id2 bigint; v_lap1 bigint; v_lap2 bigint; v_jad bigint; v_ver int; v_pt int; v_n int; v_t text;
  v_kunci uuid := gen_random_uuid();
  m1 jsonb := '[{"url":"https://uji.invalid/inventaris/a.jpg","mime":"image/jpeg"}]';
  m2 jsonb := '[{"url":"https://uji.invalid/inventaris/b.mp4","mime":"video/mp4"}]';
  m3 jsonb := '[{"url":"https://uji.invalid/inventaris/c.jpg","mime":"image/jpeg"}]';
  pdf jsonb := '[{"url":"https://uji.invalid/inventaris/d.pdf","mime":"application/pdf"}]';
begin
  -- ── A. struktur & hak akses ──
  foreach v_t in array array['inv_pengaturan','inv_lokasi','inv_nomor_penghitung','inv_impor_batch','inv_barang','inv_impor_cadangan',
      'inv_padanan_lama','inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update','inv_media','inv_log'] loop
    if has_table_privilege('anon', 'public.' || v_t, 'INSERT') or has_table_privilege('anon', 'public.' || v_t, 'UPDATE')
       or has_table_privilege('anon', 'public.' || v_t, 'DELETE') then raise exception 'GAGAL A1: anon bisa menulis %', v_t; end if;
    if v_t <> 'inv_impor_cadangan' and not has_table_privilege('anon', 'public.' || v_t, 'SELECT') then raise exception 'GAGAL A1: anon tidak bisa baca %', v_t; end if;
  end loop;
  if has_table_privilege('anon', 'public.inv_impor_cadangan', 'SELECT') then raise exception 'GAGAL A1: cadangan impor terbaca anon'; end if;
  if has_function_privilege('anon', 'public.inv_konteks(text,text,text,bigint,boolean)', 'EXECUTE') then raise exception 'GAGAL A1: inv_konteks terbuka'; end if;
  if not has_function_privilege('anon', 'public.inv_set_kondisi(bigint,integer,text,text,jsonb)', 'EXECUTE') then raise exception 'GAGAL A1: RPC tertutup'; end if;
  raise notice 'LULUS A1: tabel baca-saja utk anon, tulis hanya lewat RPC';
  if exists (select 1 from cron.job where jobname = 'maintenance-rutin-log-cleanup-harian') then raise exception 'GAGAL A2: cron pembersih log masih terjadwal'; end if;
  if (select count(*) from public.cadangan_maintenance_rutin_log_20261030) < 56 then raise exception 'GAGAL A2: cadangan log < 56'; end if;
  raise notice 'LULUS A2: cron pembersih dimatikan, cadangan ada (% log)', (select count(*) from public.cadangan_maintenance_rutin_log_20261030);
  select count(*) into v_n from pg_publication_tables where pubname = 'supabase_realtime' and tablename in
    ('inv_barang','inv_jadwal','inv_jadwal_selesai','inv_laporan','inv_laporan_update','inv_media','inv_log','inv_lokasi');
  if v_n <> 8 then raise exception 'GAGAL A3: realtime baru % dari 8 tabel', v_n; end if;
  raise notice 'LULUS A3: 8 tabel di publikasi realtime';

  -- ── B. perilaku ──
  select username into v_admin from public.admins where coalesce(is_active, true) order by id limit 1;
  select id into v_op from public.pekerja where divisi = 'painting' and deleted_at is null order by id limit 1;
  select id into v_op_lain from public.pekerja where divisi = 'mekanik' and deleted_at is null order by id limit 1;
  if v_admin is null or v_op is null or v_op_lain is null then raise exception 'GAGAL B0: admin/pekerja painting/mekanik utk uji tidak ada'; end if;
  v_ak := jsonb_build_object('admin', v_admin);
  v_ok := jsonb_build_object('pekerja_id', v_op, 'divisi', 'painting');
  v_lain := jsonb_build_object('pekerja_id', v_op_lain, 'divisi', 'mekanik');

  -- B1 nomor
  v_pt := coalesce((select terakhir from public.inv_nomor_penghitung where kode_lokasi = 'PT'), 0);
  v_b := public.inv_tambah_barang('{"nama":"UJI BARANG 1","lokasi_kode":"PT"}', v_ak);
  v_b2 := public.inv_tambah_barang('{"nama":"UJI BARANG 2","lokasi_kode":"PT"}', v_ak);
  if v_b->>'nomor_inventaris' <> 'VIT-PT-' || lpad((v_pt + 1)::text, 2, '0') or v_b2->>'nomor_inventaris' <> 'VIT-PT-' || lpad((v_pt + 2)::text, 2, '0') then
    raise exception 'GAGAL B1a: nomor % %', v_b->>'nomor_inventaris', v_b2->>'nomor_inventaris'; end if;
  if v_b->>'pelapor' is null or v_b->>'diperbarui_pada' is null then raise exception 'GAGAL B1b: pelapor/tanggal update tidak otomatis'; end if;
  v_id := (v_b->>'id')::bigint; v_id2 := (v_b2->>'id')::bigint;
  v_h := public.inv_tambah_barang('{"nama":"UJI TANPA LOKASI"}', v_ak);
  if v_h->>'nomor_inventaris' is not null then raise exception 'GAGAL B1c: lokasi Belum ditentukan bernomor'; end if;
  v_n := coalesce((select terakhir from public.inv_nomor_penghitung where kode_lokasi = 'WR.C'), 0);
  v_h := public.inv_ubah_barang((v_h->>'id')::bigint, (v_h->>'versi')::int, '{"lokasi_kode":"WR.C"}', v_ak);
  if v_h->>'nomor_inventaris' <> 'VIT-WR.C-' || lpad((v_n + 1)::text, 2, '0') then raise exception 'GAGAL B1d: nomor saat lokasi pertama %', v_h->>'nomor_inventaris'; end if;
  v_h := public.inv_ubah_barang(v_id2, (v_b2->>'versi')::int, '{"lokasi_kode":"MKN"}', v_ak);
  if v_h->>'nomor_inventaris' <> v_b2->>'nomor_inventaris' then raise exception 'GAGAL B1e: nomor berubah saat pindah lokasi'; end if;
  begin update public.inv_barang set nomor_inventaris = 'VIT-PT-99' where id = v_id; raise exception 'GAGAL B1f: nomor bisa diubah';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_barang('{"nama":"X","lokasi_kode":"WR"}', v_ak); raise exception 'GAGAL B1g: lokasi WR (nonaktif) bisa dipilih';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS B1: nomor otomatis berurutan, kosong utk Belum ditentukan, dibuat saat lokasi pertama, tetap saat pindah, tidak bisa diubah';

  -- B2 kondisi operator
  v_ver := (select versi from public.inv_barang where id = v_id);
  v_h := public.inv_set_kondisi(v_id, v_ver, 'perlu_maintenance', 'uji detail', v_ok);
  if v_h->>'kondisi' <> 'perlu_maintenance' or v_h->>'pelapor' <> (select nama from public.pekerja where id = v_op) then raise exception 'GAGAL B2a: %', v_h; end if;
  if not exists (select 1 from public.inv_log where barang_id = v_id and jenis = 'kondisi' and ke = 'perlu_maintenance' and sumber = 'operator') then raise exception 'GAGAL B2b: log kondisi'; end if;
  begin perform public.inv_set_kondisi(v_id, v_ver, 'baik', null, v_ok); raise exception 'GAGAL B2c: versi basi diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_set_kondisi(v_id, v_ver + 1, 'rusak', null, v_ok); raise exception 'GAGAL B2d: operator bisa pilih Rusak';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_set_kondisi(v_id, v_ver + 1, 'baik', null, v_lain); raise exception 'GAGAL B2e: divisi lain bisa ubah';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_set_kondisi(v_id, v_ver + 1, 'baik', null, jsonb_build_object('pekerja_id', v_op, 'divisi', 'mekanik')); raise exception 'GAGAL B2f: divisi palsu diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS B2: kondisi operator (3 pilihan, divisi sendiri, versi basi ditolak), pelapor & log otomatis';

  -- B3 laporan
  v_h := public.inv_buat_laporan(v_id, 'UJI masalah 1', 'detail', m1, v_kunci, v_ok);
  v_lap1 := (v_h->'laporan'->>'id')::bigint;
  v_h := public.inv_buat_laporan(v_id, 'UJI masalah 1', 'detail', m1, v_kunci, v_ok);
  if not (v_h->>'dobel')::boolean or (v_h->'laporan'->>'id')::bigint <> v_lap1 then raise exception 'GAGAL B3a: kunci dobel membuat laporan baru'; end if;
  if (select kondisi from public.inv_barang where id = v_id) <> 'rusak' then raise exception 'GAGAL B3b: laporan tidak membuat Rusak'; end if;
  begin perform public.inv_set_kondisi(v_id, (select versi from public.inv_barang where id = v_id), 'baik', null, v_ok); raise exception 'GAGAL B3c: kondisi tidak terkunci';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  v_lap2 := (public.inv_buat_laporan(v_id, 'UJI masalah 2', null, null, null, v_ak)->'laporan'->>'id')::bigint;
  begin perform public.inv_ubah_status_laporan(v_lap1, 'closed', null, null, null, null, v_ak); raise exception 'GAGAL B3d: tutup tanpa media sesudah';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_ubah_status_laporan(v_lap1, 'in_progress', null, null, null, null, v_ok); raise exception 'GAGAL B3e: operator ubah status';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  perform public.inv_ubah_status_laporan(v_lap1, 'closed', 'beres', 'ganti part', null, m2, v_ak);
  if (select kondisi from public.inv_barang where id = v_id) <> 'rusak' then raise exception 'GAGAL B3f: kembali baik padahal laporan lain aktif'; end if;
  perform public.inv_ubah_status_laporan(v_lap2, 'closed', null, null, null, m3, v_ak);
  if (select kondisi from public.inv_barang where id = v_id) <> 'baik' then raise exception 'GAGAL B3g: tidak kembali baik'; end if;
  if not exists (select 1 from public.inv_log where barang_id = v_id and jenis = 'kondisi' and ke = 'baik' and sumber = 'otomatis' and laporan_id = v_lap2) then raise exception 'GAGAL B3h: log otomatis'; end if;
  if (select count(*) from public.inv_media where tujuan = 'laporan' and ref_id = v_lap1 and peran in ('sebelum','sesudah')) <> 2 then raise exception 'GAGAL B3i: media sebelum/sesudah'; end if;
  if (select count(*) from public.inv_laporan_update where laporan_id = v_lap1) <> 1 then raise exception 'GAGAL B3j: riwayat status'; end if;
  raise notice 'LULUS B3: laporan -> Rusak terkunci, anti-dobel, tutup wajib media sesudah, kembali baik hanya bila tidak ada laporan aktif lain';

  -- B4 jadwal
  v_jad := (public.inv_simpan_jadwal(null, jsonb_build_object('barang_id', v_id, 'jenis', 'UJI cek', 'frekuensi', 'mingguan',
            'jatuh_tempo', public.inv_hari_ini() - 1), v_ak)->>'id')::bigint;
  if (select status_jadwal from public.inv_jadwal_v where id = v_jad) <> 'terlambat' then raise exception 'GAGAL B4a: status terlambat'; end if;
  perform public.inv_simpan_jadwal(v_jad, jsonb_build_object('jatuh_tempo', public.inv_hari_ini() + public.inv_batas_segera()), v_ak);
  if (select status_jadwal from public.inv_jadwal_v where id = v_jad) <> 'segera' then raise exception 'GAGAL B4b: status segera'; end if;
  begin perform public.inv_selesai_jadwal(v_jad, null, null, gen_random_uuid(), v_ok); raise exception 'GAGAL B4c: operator selesai tanpa foto';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_selesai_jadwal(v_jad, null, m1, gen_random_uuid(), v_lain); raise exception 'GAGAL B4d: divisi lain menyelesaikan';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  v_kunci := gen_random_uuid();
  v_h := public.inv_selesai_jadwal(v_jad, 'ok', '[{"url":"https://uji.invalid/inventaris/e.jpg"}]', v_kunci, v_ok);
  if (select jatuh_tempo from public.inv_jadwal where id = v_jad) <> public.inv_hari_ini() + 7
     or not (select selesai_hari_ini from public.inv_jadwal_v where id = v_jad) then raise exception 'GAGAL B4e: jatuh tempo berikut'; end if;
  if not (public.inv_selesai_jadwal(v_jad, 'ok', '[{"url":"https://uji.invalid/inventaris/e.jpg"}]', v_kunci, v_ok)->>'dobel')::boolean then raise exception 'GAGAL B4f: kunci dobel'; end if;
  begin perform public.inv_selesai_jadwal(v_jad, null, '[{"url":"https://uji.invalid/inventaris/f.jpg"}]', gen_random_uuid(), v_ok); raise exception 'GAGAL B4g: dua kali sehari';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  v_h := public.inv_selesai_jadwal(v_jad, null, null, null, v_ak);
  if not (v_h->'selesai'->>'tanpa_dokumentasi')::boolean then raise exception 'GAGAL B4h: admin tanpa dokumentasi'; end if;
  raise notice 'LULUS B4: status Terlambat/Segera, operator wajib foto & divisi sendiri, jatuh tempo di server, admin tanpa dokumentasi';

  -- B5 permanen & media
  begin delete from public.inv_log where barang_id = v_id; raise exception 'GAGAL B5a: log bisa dihapus';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin delete from public.inv_barang where id = v_id; raise exception 'GAGAL B5b: barang bisa dihapus';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_media('barang', v_id, 'datasheet', pdf, v_ok); raise exception 'GAGAL B5c: operator unggah datasheet';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.inv_tambah_media('barang', v_id, 'datasheet', m1, v_ak); raise exception 'GAGAL B5d: datasheet bukan PDF';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  if (public.inv_tambah_media('barang', v_id, 'datasheet', pdf, v_ak)->>'ditambah')::int <> 1
     or (public.inv_tambah_media('barang', v_id, 'datasheet', pdf, v_ak)->>'ditambah')::int <> 0 then raise exception 'GAGAL B5e: datasheet / anti-dobel url'; end if;
  raise notice 'LULUS B5: log & barang tidak bisa dihapus, datasheet hanya admin & PDF, url tidak dobel';

  -- B6 impor dry-run tidak meninggalkan apa pun
  v_n := (select count(*) from public.inv_barang);
  v_h := public.inv_impor('[{"kunci":"UJI:1","nama":"UJI IMPOR","lokasi_kode":"QC","kondisi":"baik"},{"kunci":"UJI:2","nama":"UJI IMPOR 2","lokasi_kode":"BELUM"}]', true, 'uji', v_ak);
  if (v_h->>'dibuat')::int <> 2 or (select count(*) from public.inv_barang) <> v_n or exists (select 1 from public.inv_impor_batch where file_nama = 'uji') then
    raise exception 'GAGAL B6: dry-run %', v_h; end if;
  raise notice 'LULUS B6: impor dry-run menghitung tanpa menyimpan';

  raise notice 'SEMUA LULUS (A+B)';
end $$;
rollback;

-- ── C. SESUDAH impor + migrasi data lama (baca saja) ─────────────────────────────────────────
-- C1 jumlah: 124 barang, per lokasi, per kondisi
select lokasi_kode, count(*) jumlah, count(nomor_inventaris) bernomor, min(nomor_inventaris) nomor_awal, max(nomor_inventaris) nomor_akhir
from public.inv_barang group by 1 order by 1;
select kondisi, count(*) from public.inv_barang group by 1 order by 1;
-- C2 hasil cek (semua kolom harus true)
select
  (select count(*) from public.inv_barang) = 124                                                        as c2a_124_barang,
  (select count(*) from public.inv_barang where impor_kunci like 'GA:%') = 121                          as c2b_121_dari_excel,
  (select count(*) from public.inv_barang where impor_kunci like 'BARU:BAK-%') = 3                      as c2c_3_bak,
  not exists (select 1 from public.inv_barang b join public.inv_lokasi l on l.kode = b.lokasi_kode
              where (l.boleh_nomor and b.nomor_inventaris is null) or (not l.boleh_nomor and b.nomor_inventaris is not null)) as c2d_nomor_sesuai_lokasi,
  not exists (select 1 from public.inv_nomor_penghitung p where p.terakhir <> (select coalesce(max(substr(nomor_inventaris, length('VIT-' || p.kode_lokasi || '-') + 1)::int), 0)
              from public.inv_barang where lokasi_kode = p.kode_lokasi and nomor_inventaris like 'VIT-' || p.kode_lokasi || '-%'))
    and not exists (select 1 from public.inv_barang b where b.nomor_inventaris is not null and not exists (select 1 from public.inv_nomor_penghitung p
              where b.nomor_inventaris like 'VIT-' || p.kode_lokasi || '-%'))                           as c2e_penghitung_sama_nomor_maks,
  (select count(*) from public.inv_barang where mesin_id_lama is not null) = 9                          as c2f_9_barang_terhubung_kode_lama,
  (select count(*) from public.inv_jadwal where rutin_id_lama is not null) = (select count(*) from public.maintenance_rutin r join public.inv_padanan_lama p on p.mesin_id_lama = r.mesin_id) as c2g_jadwal_lengkap,
  (select count(*) from public.inv_jadwal_selesai where rutin_log_id_lama is not null) = (select count(*) from public.maintenance_rutin_log l join public.maintenance_rutin r on r.id = l.rutin_id join public.inv_padanan_lama p on p.mesin_id_lama = r.mesin_id) as c2h_riwayat_lengkap,
  (select count(*) from public.inv_laporan where maintenance_log_id_lama is not null) = (select count(*) from public.maintenance_log m join public.inv_padanan_lama p on p.mesin_id_lama = m.mesin_id) as c2i_laporan_lengkap,
  (select count(*) from public.inv_media where peran in ('selesai','lama')) = (select coalesce(sum(jsonb_array_length(coalesce(l.foto, '[]'))), 0) from public.maintenance_rutin_log l join public.maintenance_rutin r on r.id = l.rutin_id join public.inv_padanan_lama p on p.mesin_id_lama = r.mesin_id)
    + (select coalesce(sum(jsonb_array_length(coalesce(m.foto, '[]'))), 0) from public.maintenance_log m join public.inv_padanan_lama p on p.mesin_id_lama = m.mesin_id) as c2j_media_lengkap,
  not exists (select 1 from public.inv_barang b where exists (select 1 from public.inv_laporan l where l.barang_id = b.id and l.status <> 'closed') and b.kondisi <> 'rusak') as c2k_laporan_aktif_rusak,
  not exists (select 1 from public.inv_jadwal j join public.maintenance_rutin r on r.id = j.rutin_id_lama
              where j.jatuh_tempo is distinct from r.jatuh_tempo or j.aktif <> coalesce(r.is_active, true)) as c2l_jadwal_sama_lama,
  not exists (select 1 from cron.job where jobname = 'maintenance-rutin-log-cleanup-harian')             as c2m_cron_mati;
-- C3 padanan (tinjau): kode lama -> barang, jumlah jadwal/riwayat/laporan
select p.kode_lama, b.nomor_inventaris, b.nama, b.lokasi_kode, b.kondisi,
       (select count(*) from public.inv_jadwal j where j.barang_id = b.id) jadwal,
       (select count(*) from public.inv_jadwal_selesai s where s.barang_id = b.id) riwayat,
       (select count(*) from public.inv_laporan l where l.barang_id = b.id) laporan,
       (select count(*) from public.inv_laporan l where l.barang_id = b.id and l.status <> 'closed') laporan_aktif
from public.inv_padanan_lama p left join public.inv_barang b on b.impor_kunci = p.impor_kunci order by p.kode_lama;
