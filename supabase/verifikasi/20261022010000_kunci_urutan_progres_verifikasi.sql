-- VERIFIKASI kunci urutan progres - jalankan SESUDAH migration 20261022010000_kunci_urutan_progres.sql.
-- Semua tes berjalan di dalam begin ... ROLLBACK (tidak ada perubahan yang tertinggal). Harus berakhir 'SEMUA LULUS'.
-- Komponen uji dipilih otomatis dari panel AKTIF (lihat NOTICE), kecuali tes FS.5 panel 521 (data terbalik nyata).
begin;
do $$
declare
  gagal text[] := '{}'; v_pid bigint; v_kode text; v_r numeric; v_p numeric; n_log int;
begin
  -- 0. objek & aturan
  if to_regclass('public.urutan_proses') is null then gagal := gagal || 'tabel urutan_proses tidak ada'::text; end if;
  if (select count(*) from public.urutan_proses where mode = 'kunci') <> 7 then gagal := gagal || 'jumlah aturan kunci <> 7'::text; end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_panels_validate_mekanik_cap' and not tgisinternal) then gagal := gagal || 'trigger mekanik lama masih aktif'::text; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_panels_validate_urutan_progres' and not tgisinternal) then gagal := gagal || 'trigger baru tidak ada'::text; end if;

  -- T1. Data lama terbalik (521 FS.5) TIDAK memblokir simpanan komponen lain di panel yang sama
  select e.key into v_kode from public.panels p, jsonb_each(p.checklist) e
    where p.id = 521 and e.key <> 'FS.5' and jsonb_typeof(e.value->'progress') = 'object' limit 1;
  begin
    -- progress komponen lain BERUBAH (kunci uji) -> trigger memeriksa panel ini; FS.5 tidak berubah -> tidak diperiksa
    update public.panels set checklist = jsonb_set(checklist, array[v_kode, 'progress', 'UJI_TRIGGER'], '1', true) where id = 521;
    raise notice 'T1 lolos (komponen lain % di panel 521)', v_kode;
  exception when others then gagal := gagal || ('T1 simpan komponen lain di panel 521 ditolak: ' || sqlerrm);
  end;

  -- T2. FS.5 sendiri: ubah proses lain (PASANG KOMPONEN) tanpa memperlebar RENDAM<PAINTING -> lolos
  begin
    update public.panels set checklist = jsonb_set(checklist, '{FS.5,progress,PASANG KOMPONEN}', '91', true) where id = 521;
    raise notice 'T2 lolos';
  exception when others then gagal := gagal || ('T2 FS.5 proses lain ditolak: ' || sqlerrm);
  end;

  -- T3. PAINTING dinaikkan melebihi RENDAM (pelanggaran BARU) -> ditolak
  select p.id, e.key, coalesce(nullif(e.value->'progress'->>'RENDAM','')::numeric,0) into v_pid, v_kode, v_r
    from public.panels p, jsonb_each(p.checklist) e
    where jsonb_typeof(e.value->'progress') = 'object'
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'RENDAM')
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'PAINTING')
      and coalesce(nullif(e.value->'progress'->>'RENDAM','')::numeric,0) < 100
      and coalesce(nullif(e.value->'progress'->>'PAINTING','')::numeric,0) <= coalesce(nullif(e.value->'progress'->>'RENDAM','')::numeric,0)
    limit 1;
  if v_pid is null then raise notice 'T3 dilewati: tidak ada komponen RENDAM<100 yang cocok';
  else
    begin
      update public.panels set checklist = jsonb_set(checklist, array[v_kode, 'progress', 'PAINTING'], to_jsonb(v_r + 1), true) where id = v_pid;
      gagal := gagal || ('T3 PAINTING > RENDAM TIDAK ditolak (panel ' || v_pid || ' ' || v_kode || ')');
    exception when others then
      if sqlerrm like 'Urutan proses:%' then raise notice 'T3 ditolak dgn benar: %', sqlerrm; else gagal := gagal || ('T3 ditolak oleh hal lain: ' || sqlerrm); end if;
    end;
  end if;

  -- T4. Koreksi TURUN RENDAM di bawah PAINTING -> ditolak
  v_pid := null;
  select p.id, e.key, coalesce(nullif(e.value->'progress'->>'PAINTING','')::numeric,0) into v_pid, v_kode, v_p
    from public.panels p, jsonb_each(p.checklist) e
    where jsonb_typeof(e.value->'progress') = 'object'
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'RENDAM')
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'PAINTING')
      and coalesce(nullif(e.value->'progress'->>'PAINTING','')::numeric,0) > 0
      and coalesce(nullif(e.value->'progress'->>'RENDAM','')::numeric,0) >= coalesce(nullif(e.value->'progress'->>'PAINTING','')::numeric,0)
    limit 1;
  if v_pid is null then raise notice 'T4 dilewati: tidak ada komponen PAINTING>0 yang cocok';
  else
    begin
      update public.panels set checklist = jsonb_set(checklist, array[v_kode, 'progress', 'RENDAM'], to_jsonb(v_p - 1), true) where id = v_pid;
      gagal := gagal || ('T4 RENDAM turun di bawah PAINTING TIDAK ditolak (panel ' || v_pid || ' ' || v_kode || ')');
    exception when others then
      if sqlerrm like 'Urutan proses:%' then raise notice 'T4 ditolak dgn benar: %', sqlerrm; else gagal := gagal || ('T4 ditolak oleh hal lain: ' || sqlerrm); end if;
    end;
  end if;

  -- T5. Pasangan 'peringatan' (RAKIT -> PASANG KOMPONEN) tidak dikunci -> lolos
  v_pid := null;
  select p.id, e.key into v_pid, v_kode from public.panels p, jsonb_each(p.checklist) e
    where jsonb_typeof(e.value->'progress') = 'object'
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'PASANG KOMPONEN')
      and coalesce(nullif(e.value->'progress'->>'RAKIT','')::numeric,0) < 100
    limit 1;
  if v_pid is null then raise notice 'T5 dilewati';
  else
    begin
      update public.panels set checklist = jsonb_set(checklist, array[v_kode, 'progress', 'PASANG KOMPONEN'], '100', true) where id = v_pid;
      raise notice 'T5 lolos (panel % %)', v_pid, v_kode;
    exception when others then gagal := gagal || ('T5 pasangan peringatan ditolak: ' || sqlerrm);
    end;
  end if;

  -- T6. Mekanik tetap dikunci: BENDING > POTONG -> ditolak
  v_pid := null;
  select p.id, e.key, coalesce(nullif(e.value->'progress'->>'POTONG','')::numeric,0) into v_pid, v_kode, v_r
    from public.panels p, jsonb_each(p.checklist) e
    where jsonb_typeof(e.value->'progress') = 'object'
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'POTONG')
      and exists (select 1 from public.bom_proses_relevan b where b.kode_komponen = e.key and b.tipe_panel = p.tipe and b.jenis_pekerjaan = 'BENDING')
      and coalesce(nullif(e.value->'progress'->>'POTONG','')::numeric,0) < 100
      and coalesce(nullif(e.value->'progress'->>'BENDING','')::numeric,0) <= coalesce(nullif(e.value->'progress'->>'POTONG','')::numeric,0)
    limit 1;
  if v_pid is null then raise notice 'T6 dilewati';
  else
    begin
      update public.panels set checklist = jsonb_set(checklist, array[v_kode, 'progress', 'BENDING'], to_jsonb(v_r + 1), true) where id = v_pid;
      gagal := gagal || ('T6 BENDING > POTONG TIDAK ditolak (panel ' || v_pid || ' ' || v_kode || ')');
    exception when others then
      if sqlerrm like 'Urutan proses:%' then raise notice 'T6 ditolak dgn benar: %', sqlerrm; else gagal := gagal || ('T6 ditolak oleh hal lain: ' || sqlerrm); end if;
    end;
  end if;

  -- T7. Perbaikan yang menutup selisih (FS.5 RENDAM 2 -> 3) -> lolos lewat jalur operator biasa
  begin
    update public.panels set checklist = jsonb_set(checklist, '{FS.5,progress,RENDAM}', '100', true) where id = 521;
    raise notice 'T7 lolos';
  exception when others then gagal := gagal || ('T7 perbaikan RENDAM FS.5 ditolak: ' || sqlerrm);
  end;

  -- T8. Koreksi admin melewati kuncian + tercatat di koreksi_progres_log; divisi bukan admin ditolak
  select count(*) into n_log from public.koreksi_progres_log;
  begin
    perform public.koreksi_progres_admin(521, 'FS.5', 'RENDAM', 1, 'UJI verifikasi (di-rollback)', 'UJI', 'admin');
    if (select count(*) from public.koreksi_progres_log) <> n_log + 1 then gagal := gagal || 'T8 koreksi tidak tercatat di log'::text; end if;
    if (select checklist->'FS.5'->'qtyProses'->>'RENDAM' from public.panels where id = 521) <> '1' then gagal := gagal || 'T8 qtyProses RENDAM tidak berubah'::text; end if;
    if (select status from public.component_process_progress where panel_id = 521 and kode_komponen = 'FS.5' and proses = 'RENDAM' and tahap_key = '') <> 'in_progress' then gagal := gagal || 'T8 CCP tidak ikut'::text; end if;
    raise notice 'T8 koreksi admin lolos (RENDAM 1/3 walau PAINTING 3/3) & tercatat';
  exception when others then gagal := gagal || ('T8 koreksi admin gagal: ' || sqlerrm);
  end;
  begin
    perform public.koreksi_progres_admin(521, 'FS.5', 'RENDAM', 3, 'UJI verifikasi (di-rollback)', 'UJI', 'engineering');
    gagal := gagal || 'T8b divisi engineering TIDAK ditolak'::text;
  exception when others then raise notice 'T8b divisi non-admin ditolak dgn benar: %', sqlerrm;
  end;

  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
