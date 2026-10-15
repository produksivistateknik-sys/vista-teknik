-- VERIFIKASI Kesehatan Data (jalankan SESUDAH migration 20261015010000_kesehatan_data.sql).
-- Menanam anomali UJI di dalam transaksi yang di-ROLLBACK -> tidak ada yang tersisa. Harus berakhir 'SEMUA LULUS'.
begin;

do $$
declare
  v_wo bigint; v_p1 bigint; v_p2 bigint; v_pk bigint; v_timer bigint; v_hasil jsonb; v_s jsonb; v_n int;
begin
  -- WO uji dgn 2 panel: P1 punya jadwal, P2 TIDAK (-> K1)
  insert into public.work_orders (wo, proyek, target) values ('UJI-KES', 'UJI KESEHATAN DATA', current_date + 30) returning id into v_wo;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo, 1, 'UJI KES P1', 'FS', 1,
    '{"FS.1":{"qty":2,"progress":{"POTONG":0}}}'::jsonb) returning id into v_p1;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo, 2, 'UJI KES P2', 'FS', 1, '{}'::jsonb) returning id into v_p2;
  insert into public.raw_schedule (wo_id, panel_id, proyek, panel, proses, prioritas, schedule)
    values (v_wo, v_p1, 'UJI KESEHATAN DATA', 'UJI KES P1', 'POTONG', 'Sedang', '{}'::jsonb);
  -- timer basi (kemarin, tidak ditutup) -> K8 ; CCP 100 vs checklist 0 -> K9
  select id into v_pk from public.pekerja order by id limit 1;
  insert into public.fcs_timer_kerja (pekerja_id, panel_id, kode_komponen, proses, tanggal, mulai)
    values (v_pk, v_p1, 'FS.1', 'POTONG', current_date - 2, now() - interval '2 days') returning id into v_timer;
  insert into public.component_process_progress (panel_id, kode_komponen, proses, tahap_key, status, progress_pct, qty_done, qty_total)
    values (v_p1, 'FS.1', 'POTONG', '', 'done', 100, 2, 2);

  v_hasil := public.jalankan_cek_kesehatan('semua');
  raise notice 'hasil: %', v_hasil;

  select count(*) into v_n from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid;
  if v_n <> (select count(*) from public.kesehatan_cek where aktif) then raise exception 'GAGAL U0: hasil tidak tercatat utk semua cek (%)', v_n; end if;
  if exists (select 1 from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and status = 'error') then
    raise exception 'GAGAL U0: ada cek berstatus error: %', (select string_agg(kode || ': ' || pesan_error, '; ') from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and status = 'error');
  end if;
  raise notice 'LULUS U0: % cek jalan tanpa error', v_n;

  select sampel into v_s from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K1';
  if not exists (select 1 from jsonb_array_elements(v_s) e where (e->>'panel_id')::bigint = v_p2) then raise exception 'GAGAL U1: K1 tidak menangkap panel tanpa jadwal'; end if;
  if exists (select 1 from jsonb_array_elements(v_s) e where (e->>'panel_id')::bigint = v_p1) then raise exception 'GAGAL U1: K1 salah menangkap panel yang punya jadwal'; end if;
  raise notice 'LULUS U1: K1 menangkap UJI KES P2 (tanpa jadwal), tidak menangkap P1';

  select sampel into v_s from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K8';
  if not exists (select 1 from jsonb_array_elements(v_s) e where (e->>'timer_id')::bigint = v_timer) and
     (select jumlah from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K8') <= 50 then
    raise exception 'GAGAL U2: K8 tidak menangkap timer basi uji';
  end if;
  raise notice 'LULUS U2: K8 menangkap timer basi';

  select sampel into v_s from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K9';
  if not exists (select 1 from jsonb_array_elements(v_s) e where (e->>'panel_id')::bigint = v_p1) then raise exception 'GAGAL U3: K9 tidak menangkap CCP vs checklist uji'; end if;
  raise notice 'LULUS U3: K9 menangkap CCP 100 vs checklist 0';

  if (select status from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K11') <> 'kritis' then
    raise exception 'GAGAL U4: K11 seharusnya kritis (belum ada catatan backup)';
  end if;
  insert into public.kesehatan_backup (file, ukuran_byte) values ('uji.sql', 1);
  v_hasil := public.jalankan_cek_kesehatan('harian');
  if (select status from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K11') <> 'ok' then
    raise exception 'GAGAL U4: K11 seharusnya ok setelah ada catatan backup';
  end if;
  raise notice 'LULUS U4: K11 kritis tanpa backup, ok setelah backup tercatat';

  -- pencatat error: 2 kiriman sidik sama -> 1 baris, jumlah 3
  perform public.catat_error_app('[{"aplikasi":"vista-teknik","versi":"uji","jenis":"unhandled","sidik":"uji-sidik-1","pesan":"uji error","halaman":"uji","jumlah":1}]'::jsonb);
  perform public.catat_error_app('[{"aplikasi":"vista-teknik","versi":"uji","jenis":"unhandled","sidik":"uji-sidik-1","pesan":"uji error","halaman":"uji","jumlah":2}]'::jsonb);
  if (select count(*) from public.log_error_app where sidik = 'uji-sidik-1') <> 1 or (select jumlah from public.log_error_app where sidik = 'uji-sidik-1') <> 3 then
    raise exception 'GAGAL U5: dedupe log error tidak sesuai';
  end if;
  raise notice 'LULUS U5: log error digabung per sidik (1 baris, jumlah 3)';

  -- manual dibatasi 1x per menit
  begin
    perform public.jalankan_cek_kesehatan('manual');
    raise exception 'GAGAL U6: manual beruntun tidak ditolak';
  exception when sqlstate 'P0001' then raise notice 'LULUS U6: jalankan manual beruntun ditolak';
  end;

  raise notice 'SEMUA LULUS';
end $$;

rollback;
