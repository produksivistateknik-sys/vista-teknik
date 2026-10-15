-- VERIFIKASI cek operator K12/K13 (jalankan SESUDAH migration 20261016020000). Data uji ditanam di transaksi yang
-- di-ROLLBACK (tidak ada yang tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_pk bigint; v_panel bigint; v_timer bigint; v_hasil jsonb; v_s jsonb; v_kode text;
begin
  if (select count(*) from public.kesehatan_cek where kode in ('K12','K13') and apa_terjadi is not null) <> 2 then
    raise exception 'GAGAL U0: K12/K13 belum terdaftar lengkap';
  end if;
  -- panel uji: checklist FS.1 POTONG 20%, tapi simpanan terakhir operator 100% -> K12
  insert into public.work_orders (wo, proyek, target) values ('UJI-K12', 'UJI KESEHATAN', current_date + 30) returning id into v_panel;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_panel, 1, 'UJI K12', 'FS', 1,
    '{"FS.1":{"qty":2,"progress":{"POTONG":20,"BENDING":100}}}'::jsonb) returning id into v_panel;
  insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, ts)
    values (v_panel, 'FS.1', 'POTONG', 100, 'UJI', current_date, now() - interval '1 hour');
  -- koreksi turun: simpanan 100 lalu simpanan terakhir 60, checklist 60 -> TIDAK boleh tertangkap
  insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, ts)
    values (v_panel, 'FS.1', 'BENDING', 100, 'UJI', current_date, now() - interval '2 hour'),
           (v_panel, 'FS.1', 'BENDING', 60, 'UJI', current_date, now() - interval '1 hour');
  update public.panels set checklist = jsonb_set(checklist, '{FS.1,progress,BENDING}', '60') where id = v_panel;
  -- timer ditutup selesai = mulai -> K13
  select id into v_pk from public.pekerja order by id limit 1;
  insert into public.fcs_timer_kerja (pekerja_id, panel_id, kode_komponen, proses, tanggal, mulai, selesai)
    values (v_pk, v_panel, 'FS.1', 'POTONG', current_date, now() - interval '3 hour', now() - interval '3 hour') returning id into v_timer;

  v_hasil := public.jalankan_cek_kesehatan('semua');
  if exists (select 1 from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and status = 'error') then
    raise exception 'GAGAL U1: ada cek error: %', (select string_agg(kode || ': ' || pesan_error, '; ') from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and status = 'error');
  end if;
  raise notice 'LULUS U1: % cek jalan tanpa error', (select count(*) from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid);

  select sampel into v_s from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K12';
  if not exists (select 1 from jsonb_array_elements(v_s) e where (e->>'panel_id')::bigint = v_panel and e->>'proses' = 'POTONG') then
    raise exception 'GAGAL U2: K12 tidak menangkap simpanan 100 vs checklist 20';
  end if;
  if exists (select 1 from jsonb_array_elements(v_s) e where (e->>'panel_id')::bigint = v_panel and e->>'proses' = 'BENDING') then
    raise exception 'GAGAL U3: K12 salah menangkap koreksi turun (BENDING)';
  end if;
  raise notice 'LULUS U2/U3: K12 menangkap simpanan tidak lengkap, koreksi turun tidak ikut';

  select sampel into v_s from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K13';
  if not exists (select 1 from jsonb_array_elements(v_s) e where (e->>'timer_id')::bigint = v_timer)
     and (select jumlah from public.kesehatan_hasil where run_id = (v_hasil->>'run_id')::uuid and kode = 'K13') <= 50 then
    raise exception 'GAGAL U4: K13 tidak menangkap timer selesai = mulai';
  end if;
  raise notice 'LULUS U4: K13 menangkap timer ditutup tanpa durasi';

  -- K1-K11 tetap sama (fungsi diganti): query tiap cek masih bisa dijalankan
  foreach v_kode in array array['K1','K5','K7','K8','K9','K10','K11'] loop
    execute 'select count(*) from (' || public._sql_cek_kesehatan(v_kode) || ') q';
  end loop;
  raise notice 'LULUS U5: query K1-K11 tetap jalan';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
