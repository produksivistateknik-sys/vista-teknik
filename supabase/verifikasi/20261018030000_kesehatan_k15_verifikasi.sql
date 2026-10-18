-- VERIFIKASI 20261018030000_kesehatan_k15 (jalankan SESUDAH migration). Semua di transaksi yang di-ROLLBACK (data uji &
-- hasil cek uji tidak tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
create or replace function pg_temp.cek_lama(p_kode text) returns jsonb language plpgsql as $$
declare v_c record; v_sql text; v_jumlah int; v_sampel jsonb; v_status text;
begin
  select * into v_c from public.kesehatan_cek where kode = p_kode;
  v_sql := public._sql_cek_kesehatan(p_kode);
  execute 'with q as (' || v_sql || ') select (select count(*) from q)::int, (select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from (select * from q limit 50) s)'
    into v_jumlah, v_sampel;
  v_status := case when v_c.ambang_kritis is not null and v_jumlah >= v_c.ambang_kritis then 'kritis'
                   when v_jumlah >= v_c.ambang_peringatan then 'peringatan'
                   when p_kode = 'K10' and v_jumlah > 0 then 'info'
                   else 'ok' end;
  if p_kode = 'K5' and exists (select 1 from jsonb_array_elements(v_sampel) e where e->>'tingkat' = 'kritis') then v_status := 'kritis'; end if;
  return jsonb_build_object('jumlah', v_jumlah, 'status', v_status);
exception when others then
  return jsonb_build_object('jumlah', null, 'status', 'error', 'pesan', sqlerrm);
end $$;

do $$
declare v_h jsonb; v_run uuid; r record; v_lama jsonb; v_beda text := ''; v_n int; v_id bigint; v_perm bigint; v_st text;
begin
  -- V1: K1-K14 runner LAMA vs BARU pada data yang sama -> jumlah & tingkat identik
  v_h := public.jalankan_cek_kesehatan('semua'); v_run := (v_h->>'run_id')::uuid;
  for r in select h.kode, h.jumlah, h.status from public.kesehatan_hasil h where h.run_id = v_run and h.kode <> 'K15' order by h.kode loop
    v_lama := pg_temp.cek_lama(r.kode);
    raise notice '   % lama: % / %  | baru: % / %', r.kode, v_lama->>'jumlah', v_lama->>'status', r.jumlah, r.status;
    if (v_lama->>'jumlah') is distinct from r.jumlah::text or (v_lama->>'status') is distinct from r.status then v_beda := v_beda || r.kode || ' '; end if;
  end loop;
  if v_beda <> '' then raise exception 'GAGAL V1: hasil berubah di %', v_beda; end if;
  raise notice 'LULUS V1: K1-K14 jumlah & tingkat identik runner lama vs baru';

  -- V2: K15 jalan, 9 permintaan lama (#51-59), tingkat peringatan, penyebab arsip lama
  select jumlah, status into v_n, v_st from public.kesehatan_hasil where run_id = v_run and kode = 'K15';
  raise notice '   K15: % baris, status %', v_n, v_st;
  if v_st = 'error' then raise exception 'GAGAL V2: K15 error'; end if;
  if exists (select 1 from public.kesehatan_hasil h, jsonb_array_elements(h.sampel) e where h.run_id = v_run and h.kode = 'K15'
             and (e->>'permintaan')::bigint between 51 and 59 and e->>'penyebab' <> 'data hilang, alur arsip lama') then
    raise exception 'GAGAL V2: penyebab #51-59 salah';
  end if;
  raise notice 'LULUS V2: K15 jalan (% baris, %)', v_n, v_st;

  -- V3: catatan wajib & penandaan mengecualikan baris
  begin perform public.tandai_kesehatan('temuan', 'K15', '51', 'diketahui', '  ', 'UJI'); raise exception 'GAGAL V3a: catatan kosong lolos';
  exception when sqlstate '22023' then null; end;
  begin perform public.tandai_kesehatan('cek', 'K15', null, 'tunda', 'uji tunda', 'UJI', now() + interval '1 day'); raise exception 'GAGAL V3b: sasaran cek lolos';
  exception when sqlstate '22023' then null; end;
  v_id := (public.tandai_kesehatan('temuan', 'K15', '51', 'diketahui', 'uji verifikasi', 'UJI')->>'id')::bigint;
  begin perform public.tandai_kesehatan('temuan', 'K15', '51', 'diketahui', 'uji dobel', 'UJI'); raise exception 'GAGAL V3c: tanda dobel lolos';
  exception when sqlstate '23505' then null; end;
  v_h := public.jalankan_cek_kesehatan('semua');
  if exists (select 1 from public.kesehatan_hasil h, jsonb_array_elements(h.sampel) e where h.run_id = (v_h->>'run_id')::uuid and h.kode = 'K15' and e->>'ref' = '51') then
    raise exception 'GAGAL V3d: #51 yang ditandai masih muncul';
  end if;
  if (select jumlah from public.kesehatan_hasil where run_id = (v_h->>'run_id')::uuid and kode = 'K15') <> v_n - 1 then raise exception 'GAGAL V3e: jumlah K15 tidak turun 1'; end if;
  raise notice 'LULUS V3: catatan wajib, sasaran lain ditolak, dobel ditolak, temuan ditandai dikecualikan';

  -- V4: buka lagi -> muncul lagi
  begin perform public.buka_tanda_kesehatan(v_id, '', 'UJI'); raise exception 'GAGAL V4a: alasan kosong lolos';
  exception when sqlstate '22023' then null; end;
  perform public.buka_tanda_kesehatan(v_id, 'uji buka lagi', 'UJI');
  v_h := public.jalankan_cek_kesehatan('semua');
  if (select jumlah from public.kesehatan_hasil where run_id = (v_h->>'run_id')::uuid and kode = 'K15') <> v_n then raise exception 'GAGAL V4b: setelah dibuka jumlah tidak kembali'; end if;
  raise notice 'LULUS V4: buka lagi -> temuan muncul lagi, riwayat tanda tetap ada (aktif=false)';

  -- V5: permintaan baru tanpa item -> < 10 menit diabaikan, > 10 menit & < 7 hari -> KRITIS
  insert into public.permintaan (jenis, divisi, operator_nama, created_at) values ('BBMB', 'uji', 'UJI', now() - interval '2 minutes') returning id into v_perm;
  v_h := public.jalankan_cek_kesehatan('semua');
  if exists (select 1 from public.kesehatan_hasil h, jsonb_array_elements(h.sampel) e where h.run_id = (v_h->>'run_id')::uuid and h.kode = 'K15' and e->>'ref' = v_perm::text) then
    raise exception 'GAGAL V5a: permintaan < 10 menit ikut';
  end if;
  update public.permintaan set created_at = now() - interval '1 hour' where id = v_perm;
  v_h := public.jalankan_cek_kesehatan('semua');
  select status into v_st from public.kesehatan_hasil where run_id = (v_h->>'run_id')::uuid and kode = 'K15';
  if v_st <> 'kritis' then raise exception 'GAGAL V5b: permintaan baru tanpa item tidak kritis (%)', v_st; end if;
  if not exists (select 1 from public.kesehatan_hasil h, jsonb_array_elements(h.sampel) e where h.run_id = (v_h->>'run_id')::uuid and h.kode = 'K15'
                 and e->>'ref' = v_perm::text and e->>'penyebab' = 'rincian tidak tersimpan saat dikirim') then raise exception 'GAGAL V5c: penyebab baru salah'; end if;
  raise notice 'LULUS V5: < 10 menit diabaikan; baru > 10 menit -> KRITIS, penyebab "rincian tidak tersimpan saat dikirim"';

  -- V6: hak akses
  if not has_function_privilege('anon', 'public.tandai_kesehatan(text,text,text,text,text,text,timestamptz)', 'execute') then raise exception 'GAGAL V6'; end if;
  raise notice 'LULUS V6: anon boleh memanggil RPC penandaan';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
