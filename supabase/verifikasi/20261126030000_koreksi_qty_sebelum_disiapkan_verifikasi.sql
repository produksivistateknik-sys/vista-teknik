-- VERIFIKASI Tahap 3 (koreksi sebelum disiapkan + K19 ketat) - jalankan SESUDAH migration 20261126030000.
-- Uji memakai baris BUATAN di dalam begin..ROLLBACK (tidak ada sisa, tidak ada notifikasi). Harus NOTICE 'SEMUA LULUS'.
begin;
do $$
declare v_perm bigint; v_a bigint; v_h bigint; j jsonb; gagal text[] := '{}'; n_lama int; n_baru int; k text; u timestamptz;
  procedure_tolak text;
begin
  if not has_function_privilege('anon', 'public.koreksi_qty_sebelum_disiapkan(bigint,numeric,numeric,text,text)', 'execute') then gagal := gagal || 'anon tidak bisa execute RPC'::text; end if;

  -- K1-K27 selain K19 tidak berubah; K19 lama vs baru sama hasilnya sebelum ada koreksi admin
  for i in 1..30 loop
    continue when i = 19;
    k := 'K' || i;
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k27(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  execute 'select count(*) from (' || public._sql_cek_kesehatan_k1_k27('K19') || ') s' into n_lama;
  execute 'select count(*) from (' || public._sql_cek_kesehatan('K19') || ') s' into n_baru;
  if n_lama <> n_baru then gagal := gagal || ('K19 lama ' || n_lama || ' <> baru ' || n_baru); end if;

  select id into v_perm from public.permintaan order by id desc limit 1;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status, disetujui_admin_at, disetujui_admin_oleh)
    values (v_perm, 'UJI VERIFIKASI', 10, 'pending', now(), 'UJI') returning id into v_a;
  select updated_at into u from public.permintaan_item where id = v_a;

  -- penolakan: catatan kosong / "ab", qty 0, naik, sama, qty_lama basi
  foreach procedure_tolak in array array['catatan_kosong','catatan_pendek','nol','naik','sama','qty_lama_basi'] loop
    begin
      case procedure_tolak
        when 'catatan_kosong' then j := public.koreksi_qty_sebelum_disiapkan(v_a, 10, 6, '   ', 'UJI');
        when 'catatan_pendek' then j := public.koreksi_qty_sebelum_disiapkan(v_a, 10, 6, 'ab', 'UJI');
        when 'nol' then j := public.koreksi_qty_sebelum_disiapkan(v_a, 10, 0, 'salah pencet', 'UJI');
        when 'naik' then j := public.koreksi_qty_sebelum_disiapkan(v_a, 10, 12, 'salah pencet', 'UJI');
        when 'sama' then j := public.koreksi_qty_sebelum_disiapkan(v_a, 10, 10, 'salah pencet', 'UJI');
        when 'qty_lama_basi' then j := public.koreksi_qty_sebelum_disiapkan(v_a, 9, 6, 'salah pencet', 'UJI');
      end case;
      gagal := gagal || ('tidak ditolak: ' || procedure_tolak);
    exception when sqlstate '22023' or sqlstate 'P0001' then null; end;
  end loop;
  if (select qty from public.permintaan_item where id = v_a) <> 10 or exists (select 1 from public.permintaan_item_koreksi where permintaan_item_id = v_a)
    then gagal := gagal || 'penolakan meninggalkan perubahan'::text; end if;

  -- sah: 10 -> 6, lalu berantai 6 -> 4
  j := public.koreksi_qty_sebelum_disiapkan(v_a, 10, 6, 'salah pencet', 'UJI');
  j := public.koreksi_qty_sebelum_disiapkan(v_a, 6, 4, 'dicek ulang operator', 'UJI');
  if (select qty from public.permintaan_item where id = v_a) <> 4 then gagal := gagal || 'qty item bukan 4'::text; end if;
  if (select count(*) from public.permintaan_item_koreksi where permintaan_item_id = v_a and sumber = 'admin_sebelum_siap' and status = 'disetujui') <> 2
    then gagal := gagal || 'riwayat koreksi bukan 2 baris'::text; end if;
  if (select updated_at from public.permintaan_item where id = v_a) is distinct from u then gagal := gagal || 'updated_at item tersentuh'::text; end if;

  -- K19 ketat: dipenuhi sebagian 3 (hutang 1) -> TIDAK ditandai; lalu qty dirusak -> ditandai
  j := public.proses_pemenuhan_permintaan(v_a, 3, 'UJI', 4);
  v_h := (j->>'hutang_id')::bigint;
  execute 'select count(*) from (' || public._sql_cek_kesehatan('K19') || ') s where ref = $1' into n_baru using v_a::text;
  if n_baru <> 0 then gagal := gagal || 'K19 menandai pemenuhan sebagian yang sah'::text; end if;
  update public.permintaan_item set qty = 5 where id = v_h;
  execute 'select count(*) from (' || public._sql_cek_kesehatan('K19') || ') s where ref = $1' into n_baru using v_a::text;
  if n_baru <> 1 then gagal := gagal || 'K19 tidak menandai selisih nyata'::text; end if;

  -- sudah disiapkan -> ditolak
  begin
    j := public.koreksi_qty_sebelum_disiapkan(v_a, 3, 2, 'salah pencet', 'UJI');
    gagal := gagal || 'item submit tidak ditolak'::text;
  exception when sqlstate 'P0001' then null; end;
  -- baris hutang -> ditolak
  begin
    j := public.koreksi_qty_sebelum_disiapkan(v_h, 5, 2, 'salah pencet', 'UJI');
    gagal := gagal || 'item hutang tidak ditolak'::text;
  exception when sqlstate 'P0001' then null; end;

  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
