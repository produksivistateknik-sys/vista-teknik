-- VERIFIKASI hapus_panel_aman (jalankan SESUDAH migration 20261010010000_hapus_panel_aman.sql).
-- Memakai DATA UJI di dalam transaksi yang di-ROLLBACK di akhir -> tidak ada yang tersisa di database.
-- Hasil: baris NOTICE di tab "Messages"/"Results"; harus berakhir 'SEMUA LULUS'. Bila ada yang gagal -> exception.

begin;

do $$
declare
  v_wo bigint; v_a bigint; v_b bigint; v_raw_a bigint; v_raw_b bigint; v_hasil jsonb; v_tolak boolean := false; v_pesan text;
begin
  -- data uji: 1 WO, panel A (punya permintaan) & panel B (tanpa permintaan), masing2 1 jadwal + 1 renhar
  insert into public.work_orders (wo, proyek, target) values ('UJI-HPA', 'UJI HAPUS PANEL AMAN', current_date + 30) returning id into v_wo;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo, 1, 'UJI PANEL A', 'FS', 1, '{}'::jsonb) returning id into v_a;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo, 2, 'UJI PANEL B', 'FS', 1, '{}'::jsonb) returning id into v_b;
  insert into public.raw_schedule (wo_id, panel_id, proyek, panel, proses, prioritas, schedule)
    values (v_wo, v_a, 'UJI HAPUS PANEL AMAN', 'UJI PANEL A', 'POTONG', 'Sedang', '{"2030-01-02":[{"wp":"WP1","komponen":["FS.1"]}]}'::jsonb) returning id into v_raw_a;
  insert into public.raw_schedule (wo_id, panel_id, proyek, panel, proses, prioritas, schedule)
    values (v_wo, v_b, 'UJI HAPUS PANEL AMAN', 'UJI PANEL B', 'POTONG', 'Sedang', '{"2030-01-02":[{"wp":"WP1","komponen":["FS.1"]}]}'::jsonb) returning id into v_raw_b;
  insert into public.renhar (raw_id, wo_id, panel_id, proyek, panel, proses, prioritas, wp, komponen, tanggal, divisi)
    values (v_raw_a, v_wo, v_a, 'UJI HAPUS PANEL AMAN', 'UJI PANEL A', 'POTONG', 'Sedang', 'WP1', '["FS.1"]'::jsonb, '2030-01-02', 'mekanik'),
           (v_raw_b, v_wo, v_b, 'UJI HAPUS PANEL AMAN', 'UJI PANEL B', 'POTONG', 'Sedang', 'WP1', '["FS.1"]'::jsonb, '2030-01-02', 'mekanik');
  insert into public.permintaan (jenis, operator_nama, divisi, wo_id, panel_id) values ('BBMB', 'UJI', 'mekanik', v_wo, v_a);

  -- U1: hapus A+B sekaligus -> DITOLAK (A punya permintaan), TIDAK ADA yang terhapus (termasuk B)
  begin
    perform public.hapus_panel_aman(array[v_a, v_b], 'UJI', 'UJI-HPA', 'UJI HAPUS PANEL AMAN');
  exception when sqlstate 'P0001' then v_tolak := true; v_pesan := sqlerrm;
  end;
  if not v_tolak then raise exception 'GAGAL U1: hapus panel ber-permintaan tidak ditolak'; end if;
  if (select count(*) from public.raw_schedule where panel_id in (v_a, v_b)) <> 2
     or (select count(*) from public.renhar where panel_id in (v_a, v_b)) <> 2
     or (select count(*) from public.panels where id in (v_a, v_b)) <> 2 then
    raise exception 'GAGAL U1: ada data yang terhapus padahal ditolak';
  end if;
  raise notice 'LULUS U1: ditolak, data utuh. Pesan: %', v_pesan;

  -- U2: hapus B saja -> berhasil, jadwal+renhar+panel B terhapus, A utuh
  v_hasil := public.hapus_panel_aman(array[v_b], 'UJI', 'UJI-HPA', 'UJI HAPUS PANEL AMAN');
  if (v_hasil->>'panel')::int <> 1 or (v_hasil->>'raw_schedule')::int <> 1 or (v_hasil->>'renhar')::int <> 1 then
    raise exception 'GAGAL U2: hasil tidak sesuai %', v_hasil;
  end if;
  if exists (select 1 from public.panels where id = v_b) or exists (select 1 from public.raw_schedule where panel_id = v_b) then
    raise exception 'GAGAL U2: panel B masih tersisa';
  end if;
  if (select count(*) from public.raw_schedule where panel_id = v_a) <> 1 then raise exception 'GAGAL U2: panel A ikut tersentuh'; end if;
  if not exists (select 1 from public.activity_log where action = 'HAPUS PANEL (EDIT WO)' and description like '%UJI PANEL B%') then
    raise exception 'GAGAL U2: activity_log tidak tercatat';
  end if;
  raise notice 'LULUS U2: panel tanpa permintaan terhapus atomik, hasil %', v_hasil;

  -- U3: daftar kosong -> no-op
  v_hasil := public.hapus_panel_aman(array[]::bigint[], 'UJI');
  if (v_hasil->>'panel')::int <> 0 then raise exception 'GAGAL U3'; end if;
  raise notice 'LULUS U3: daftar kosong tidak menghapus apa pun';

  raise notice 'SEMUA LULUS';
end $$;

rollback; -- data uji & log uji dibuang
