-- VERIFIKASI hapus_wo_aman (jalankan SESUDAH migration 20261012020000_hapus_wo_aman.sql).
-- DATA UJI dalam transaksi yang di-ROLLBACK -> tidak ada yang tersisa. Harus berakhir 'SEMUA LULUS'.

begin;

do $$
declare
  v_wo1 bigint; v_wo2 bigint; v_p1 bigint; v_p2 bigint; v_raw bigint; v_hasil jsonb; v_tolak boolean; v_pesan text;
begin
  -- WO1: panel ber-permintaan.  WO2: panel + jadwal + renhar + tracking komponen, tanpa permintaan.
  insert into public.work_orders (wo, proyek, target) values ('UJI-HWA1', 'UJI HAPUS WO AMAN', current_date + 30) returning id into v_wo1;
  insert into public.work_orders (wo, proyek, target) values ('UJI-HWA2', 'UJI HAPUS WO AMAN', current_date + 30) returning id into v_wo2;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo1, 1, 'UJI HWA P1', 'FS', 1, '{}'::jsonb) returning id into v_p1;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo2, 1, 'UJI HWA P2', 'FS', 1, '{}'::jsonb) returning id into v_p2;
  insert into public.permintaan (jenis, operator_nama, divisi, wo_id, panel_id) values ('BBMB', 'UJI', 'mekanik', v_wo1, v_p1);
  insert into public.raw_schedule (wo_id, panel_id, proyek, panel, proses, prioritas, schedule)
    values (v_wo2, v_p2, 'UJI HAPUS WO AMAN', 'UJI HWA P2', 'POTONG', 'Sedang', '{"2030-01-02":[{"wp":"WP1","komponen":["FS.1"]}]}'::jsonb) returning id into v_raw;
  insert into public.renhar (raw_id, wo_id, panel_id, proyek, panel, proses, prioritas, wp, komponen, tanggal, divisi)
    values (v_raw, v_wo2, v_p2, 'UJI HAPUS WO AMAN', 'UJI HWA P2', 'POTONG', 'Sedang', 'WP1', '["FS.1"]'::jsonb, '2030-01-02', 'mekanik');
  insert into public.fcs_tracking_komponen (wo_id, panel_id, sub_bagian, operator_name, catatan) values (v_wo2, v_p2, 'Warehouse', 'UJI', 'uji');

  -- U1: WO ber-permintaan -> DITOLAK, data utuh
  v_tolak := false;
  begin
    perform public.hapus_wo_aman(v_wo1, 'UJI', 'Verifikasi');
  exception when sqlstate 'P0001' then v_tolak := true; v_pesan := sqlerrm;
  end;
  if not v_tolak then raise exception 'GAGAL U1: WO ber-permintaan tidak ditolak'; end if;
  if not exists (select 1 from public.work_orders where id = v_wo1) or not exists (select 1 from public.panels where id = v_p1)
     or not exists (select 1 from public.permintaan where wo_id = v_wo1) then
    raise exception 'GAGAL U1: ada data yang terhapus';
  end if;
  raise notice 'LULUS U1: ditolak, data utuh. Pesan: %', v_pesan;

  -- U2: WO tanpa permintaan -> semua terhapus dalam 1 transaksi
  v_hasil := public.hapus_wo_aman(v_wo2, 'UJI', 'Verifikasi');
  if (v_hasil->>'panel')::int <> 1 or (v_hasil->>'raw_schedule')::int <> 1 or (v_hasil->>'renhar')::int <> 1
     or (v_hasil->>'fcs_tracking_komponen')::int <> 1 then
    raise exception 'GAGAL U2: hasil %', v_hasil;
  end if;
  if exists (select 1 from public.work_orders where id = v_wo2) or exists (select 1 from public.panels where wo_id = v_wo2) then
    raise exception 'GAGAL U2: WO/panel masih ada';
  end if;
  if not exists (select 1 from public.activity_log where action = 'HAPUS WO' and wo_number = 'UJI-HWA2') then
    raise exception 'GAGAL U2: activity_log tidak tercatat';
  end if;
  if not exists (select 1 from public.work_orders where id = v_wo1) then raise exception 'GAGAL U2: WO lain ikut terhapus'; end if;
  raise notice 'LULUS U2: WO tanpa permintaan terhapus atomik, hasil %', v_hasil;

  -- U3: WO yang sudah tidak ada -> ditolak
  v_tolak := false;
  begin
    perform public.hapus_wo_aman(v_wo2, 'UJI');
  exception when sqlstate 'P0001' then v_tolak := true;
  end;
  if not v_tolak then raise exception 'GAGAL U3: WO yang tidak ada tidak ditolak'; end if;
  raise notice 'LULUS U3: WO yang tidak ada ditolak';

  raise notice 'SEMUA LULUS';
end $$;

rollback; -- data uji & log uji dibuang
