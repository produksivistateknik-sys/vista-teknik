-- VERIFIKASI 20261031030000_laporan_outstanding_bersama. Semua uji di transaksi yang di-ROLLBACK (laporan uji tanggal
-- 1900-01-0x tidak tersisa). Harus berakhir tanpa galat ('SEMUA LULUS' di NOTICE).
begin;
do $$
declare
  a1 text; a2 text; n1 text; n2 text; k1 jsonb; k2 jsonb; kop jsonb; h jsonb; v_l bigint; v_t text; v_id bigint; v_n int;
  bag constant jsonb := '[
    {"id":"uji-p1","jenis":"proyek","src":"otomatis","urut":0,"data":{"nama":"PROYEK A","deadline":"","ringkas":""}},
    {"id":"uji-n1","induk_id":"uji-p1","jenis":"panel","src":"otomatis","urut":0,"data":{"nama":"PANEL 1","panelId":1}},
    {"id":"uji-j1","induk_id":"uji-n1","jenis":"pekerjaan","urut":0,"data":{"teks":"POTONG","selesai":false}},
    {"id":"uji-j2","induk_id":"uji-n1","jenis":"pekerjaan","urut":1,"data":{"teks":"BENDING","selesai":false}},
    {"id":"uji-m1","jenis":"proyek","src":"manual","urut":1,"data":{"nama":"MANUAL","deadline":"","ringkas":""}},
    {"id":"uji-mn","induk_id":"uji-m1","jenis":"panel","src":"manual","urut":0,"data":{"nama":"PANEL M"}},
    {"id":"uji-mj","induk_id":"uji-mn","jenis":"pekerjaan","urut":0,"data":{"teks":"BELI BAUT","selesai":false}},
    {"id":"uji-c1","jenis":"catatan","urut":0,"data":{"teks":"SEWA FORKLIFT"}},
    {"id":"uji-r1","jenis":"prioritas","urut":0,"data":{"nama":"PROYEK A","deadline":"","panels":["PANEL 1"]}}]';
begin
  select username, nama into a1, n1 from public.admins where coalesce(is_active, true) and coalesce(divisi, 'admin') = 'admin' order by id limit 1;
  select username, nama into a2, n2 from public.admins where coalesce(is_active, true) and coalesce(divisi, 'admin') = 'admin' and username <> a1 order by id limit 1;
  if a1 is null or a2 is null then raise exception 'GAGAL V0: perlu 2 admin aktif divisi admin'; end if;
  k1 := jsonb_build_object('admin', a1); k2 := jsonb_build_object('admin', a2);

  -- V1 buat; buat kedua (admin lain, tanggal sama) -> laporan yang ada, payload diabaikan
  h := public.lo_buat('1900-01-01', '{"jam":"16.00","varian":"V2"}', bag, k1); v_l := (h->'laporan'->>'id')::bigint;
  if not (h->>'dibuat')::boolean or (h->>'bagian')::int <> 9 then raise exception 'GAGAL V1a: %', h; end if;
  h := public.lo_buat('1900-01-01', '{}', '[{"id":"uji-x","jenis":"catatan","urut":9,"data":{"teks":"X"}}]', k2);
  if (h->>'dibuat')::boolean or exists (select 1 from public.laporan_outstanding_bagian where id = 'uji-x') then raise exception 'GAGAL V1b'; end if;
  if (select count(*) from public.laporan_outstanding_riwayat where laporan_id = v_l) <> 1 then raise exception 'GAGAL V1c: riwayat buat harus 1 ringkasan'; end if;
  raise notice 'LULUS V1: buat laporan, buat serempak tanggal sama -> laporan yang ada';

  -- V2 dua admin mengedit bagian BERBEDA (versi dasar sama) -> keduanya tersimpan, tanpa peringatan
  h := public.lo_simpan(v_l, '[{"o":"ubah","id":"uji-j1","versi_dasar":1,"data":{"teks":"POTONG (PROSES)","selesai":false}}]', k1);
  if jsonb_array_length(h->'peringatan') <> 0 then raise exception 'GAGAL V2a'; end if;
  h := public.lo_simpan(v_l, '[{"o":"ubah","id":"uji-j2","versi_dasar":1,"data":{"teks":"BENDING (PROSES)","selesai":false}}]', k2);
  if (select string_agg(data->>'teks', '|' order by id) from public.laporan_outstanding_bagian where id in ('uji-j1','uji-j2')) <> 'POTONG (PROSES)|BENDING (PROSES)' then raise exception 'GAGAL V2b'; end if;
  raise notice 'LULUS V2: bagian berbeda tidak saling menimpa';

  -- V3 bagian SAMA: terakhir menang + peringatan "diubah oleh X"; riwayat menyimpan kedua versi
  h := public.lo_simpan(v_l, '[{"o":"ubah","id":"uji-j1","versi_dasar":1,"data":{"teks":"POTONG SELESAI","selesai":true}}]', k2);
  if (h->'peringatan'->0->>'oleh') is distinct from n1 or (h->'versi'->>'uji-j1')::int <> 3 then raise exception 'GAGAL V3a: %', h; end if;
  if (select data->>'teks' from public.laporan_outstanding_bagian where id = 'uji-j1') <> 'POTONG SELESAI' then raise exception 'GAGAL V3b'; end if;
  if (select count(*) from public.laporan_outstanding_riwayat where bagian_id = 'uji-j1' and jenis = 'ubah') <> 2 then raise exception 'GAGAL V3c'; end if;
  h := public.lo_simpan(v_l, '[{"o":"ubah","id":"uji-j1","versi_dasar":3,"data":{"teks":"POTONG SELESAI","selesai":true}}]', k2);
  if jsonb_array_length(h->'peringatan') <> 0 then raise exception 'GAGAL V3d: pengubah sama tidak boleh diperingatkan'; end if;
  raise notice 'LULUS V3: bagian sama terakhir menang, peringatan nama pengubah lain, riwayat dua versi';

  -- V4 hapus oleh admin 1, admin 2 masih mengubah -> tidak hidup lagi, dilaporkan 'hilang'; tambah idempoten
  perform public.lo_simpan(v_l, '[{"o":"hapus","id":"uji-j2"}]', k1);
  h := public.lo_simpan(v_l, '[{"o":"ubah","id":"uji-j2","versi_dasar":2,"data":{"teks":"Z","selesai":false}},{"o":"tambah","id":"uji-j3","induk_id":"uji-n1","jenis":"pekerjaan","urut":2,"data":{"teks":"STEL","selesai":false}},{"o":"tambah","id":"uji-j3","induk_id":"uji-n1","jenis":"pekerjaan","urut":2,"data":{"teks":"STEL","selesai":false}}]', k2);
  if (h->'hilang'->0->>'id') <> 'uji-j2' or (select dihapus_pada from public.laporan_outstanding_bagian where id = 'uji-j2') is null
     or (select count(*) from public.laporan_outstanding_bagian where id = 'uji-j3') <> 1 then raise exception 'GAGAL V4: %', h; end if;
  raise notice 'LULUS V4: hapus menang atas edit basi (dilaporkan), tambah ulang tidak dobel';

  -- V5 teks WA bersama: terakhir menang + peringatan; kembalikan dari riwayat
  h := public.lo_ubah_header(v_l, '{"teks_wa":"VERSI A"}', 1, k1);
  h := public.lo_ubah_header(v_l, '{"teks_wa":"VERSI B"}', 1, k2);
  if (h->'peringatan'->>'oleh') is distinct from n1 or (select teks_wa from public.laporan_outstanding where id = v_l) <> 'VERSI B' then raise exception 'GAGAL V5a: %', h; end if;
  v_id := (select max(id) from public.laporan_outstanding_riwayat where laporan_id = v_l and jenis = 'header');
  perform public.lo_kembalikan(v_id, k1);
  if (select teks_wa from public.laporan_outstanding where id = v_l) <> 'VERSI A' then raise exception 'GAGAL V5b'; end if;
  begin perform public.lo_ubah_header(v_l, '{"tanggal":"2000-01-01"}', null, k1); raise exception 'GAGAL V5c: kolom asing diterima';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V5: teks WA bersama terakhir menang + peringatan, bisa dikembalikan dari riwayat';

  -- V6 kembalikan edit bagian & hapus
  v_id := (select max(id) from public.laporan_outstanding_riwayat where bagian_id = 'uji-j1' and jenis = 'ubah' and oleh = n2);
  perform public.lo_kembalikan(v_id, k1);
  if (select data->>'teks' from public.laporan_outstanding_bagian where id = 'uji-j1') <> 'POTONG (PROSES)' then raise exception 'GAGAL V6a'; end if;
  v_id := (select max(id) from public.laporan_outstanding_riwayat where bagian_id = 'uji-j2' and jenis = 'hapus');
  perform public.lo_kembalikan(v_id, k1);
  if (select dihapus_pada from public.laporan_outstanding_bagian where id = 'uji-j2') is not null then raise exception 'GAGAL V6b: tidak pulih'; end if;
  if not exists (select 1 from public.laporan_outstanding_riwayat where bagian_id = 'uji-j2' and jenis = 'kembalikan') then raise exception 'GAGAL V6c'; end if;
  raise notice 'LULUS V6: kembalikan versi sebelum & pulihkan bagian terhapus (tercatat jenis kembalikan)';

  -- V7 buat ulang: otomatis diganti/dihapus, manual/catatan yang diedit admin lain TIDAK tertimpa payload basi
  perform public.lo_simpan(v_l, '[{"o":"ubah","id":"uji-mj","versi_dasar":1,"data":{"teks":"BELI BAUT M10","selesai":false}}]', k2);
  h := public.lo_ganti_otomatis(v_l, '{"varian":"V3"}', '[
    {"id":"uji-p9","jenis":"proyek","src":"otomatis","urut":0,"data":{"nama":"PROYEK A","deadline":"","ringkas":""}},
    {"id":"uji-n9","induk_id":"uji-p9","jenis":"panel","src":"otomatis","urut":0,"data":{"nama":"PANEL 1","panelId":1}},
    {"id":"uji-j9","induk_id":"uji-n9","jenis":"pekerjaan","urut":0,"data":{"teks":"RAKIT","selesai":false}},
    {"id":"uji-m1","jenis":"proyek","src":"manual","urut":1,"data":{"nama":"MANUAL","deadline":"","ringkas":""}},
    {"id":"uji-mn","induk_id":"uji-m1","jenis":"panel","src":"manual","urut":0,"data":{"nama":"PANEL M"}},
    {"id":"uji-mj","induk_id":"uji-mn","jenis":"pekerjaan","urut":0,"data":{"teks":"BELI BAUT","selesai":false}},
    {"id":"uji-c1","jenis":"catatan","urut":0,"data":{"teks":"SEWA FORKLIFT"}},
    {"id":"uji-r9","jenis":"prioritas","urut":0,"data":{"nama":"PROYEK A","deadline":"","panels":["PANEL 1"]}}]', k1);
  if (select data->>'teks' from public.laporan_outstanding_bagian where id = 'uji-mj') <> 'BELI BAUT M10' then raise exception 'GAGAL V7a: manual tertimpa'; end if;
  if exists (select 1 from public.laporan_outstanding_bagian where id in ('uji-p1','uji-n1','uji-j1','uji-j2','uji-j3','uji-r1') and dihapus_pada is null) then raise exception 'GAGAL V7b: otomatis lama masih ada'; end if;
  if (select count(*) from public.laporan_outstanding_bagian where laporan_id = v_l and dihapus_pada is null) <> 8
     or (select varian from public.laporan_outstanding where id = v_l) <> 'V3' then raise exception 'GAGAL V7c: % %', (select count(*) from public.laporan_outstanding_bagian where laporan_id = v_l and dihapus_pada is null), h; end if;
  if (select jsonb_array_length(sebelum->'bagian_otomatis') from public.laporan_outstanding_riwayat where laporan_id = v_l and jenis = 'buat_ulang') <> 6 then raise exception 'GAGAL V7d: isi lama tidak disimpan'; end if;
  raise notice 'LULUS V7: buat ulang mengganti otomatis saja; edit manual admin lain aman; isi lama di riwayat';

  -- V8 impor draf lama: tanggal baru -> laporan dibuat; diulang / admin lain -> tidak dobel; induk tak dikenal dilewati
  h := public.lo_impor('1900-01-02', '{"jam":"15.00"}', '[{"id":"imp-c1","jenis":"catatan","urut":0,"data":{"teks":"A"}}]', k1);
  if h->>'mode' <> 'baru' then raise exception 'GAGAL V8a: %', h; end if;
  h := public.lo_impor('1900-01-02', '{}', '[{"id":"imp-c1","jenis":"catatan","urut":0,"data":{"teks":"A"}},{"id":"imp-c2","jenis":"catatan","urut":1,"data":{"teks":"B"}},{"id":"imp-yatim","induk_id":"tidak-ada","jenis":"pekerjaan","urut":0,"data":{"teks":"Y"}}]', k2);
  if (h->>'bagian')::int <> 1 or (h->>'dilewati')::int <> 2 then raise exception 'GAGAL V8b: %', h; end if;
  h := public.lo_impor('1900-01-02', '{}', '[{"id":"imp-c2","jenis":"catatan","urut":1,"data":{"teks":"B"}}]', k2);
  if (h->>'bagian')::int <> 0 then raise exception 'GAGAL V8c'; end if;
  begin perform public.lo_impor('1900-01-03', '{}', '[{"id":"uji-c1","jenis":"catatan","urut":0,"data":{"teks":"curi"}}]', k1);
    if (select laporan_id from public.laporan_outstanding_bagian where id = 'uji-c1') <> v_l then raise exception 'GAGAL V8d: bagian pindah laporan'; end if;
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V8: impor sekali, diulang/admin lain tidak dobel, bagian laporan lain tidak bisa dicuri';

  -- V9 riwayat permanen; bukan admin ditolak; laporan/bagian tidak bisa dihapus fisik
  begin delete from public.laporan_outstanding_riwayat where laporan_id = v_l; raise exception 'GAGAL V9a';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin update public.laporan_outstanding_riwayat set oleh = 'x' where laporan_id = v_l; raise exception 'GAGAL V9b';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin delete from public.laporan_outstanding_bagian where id = 'uji-c1'; raise exception 'GAGAL V9c';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.lo_simpan(v_l, '[]', '{"admin":"__tidak_ada__"}'); raise exception 'GAGAL V9d';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  begin perform public.lo_simpan(v_l, '[]', '{"pekerja_id":1,"divisi":"mekanik"}'); raise exception 'GAGAL V9e';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
  raise notice 'LULUS V9: riwayat permanen, hapus fisik ditolak, bukan admin ditolak';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
