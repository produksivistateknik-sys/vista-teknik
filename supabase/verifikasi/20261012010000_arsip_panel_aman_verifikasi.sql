-- VERIFIKASI arsip_panel_aman / unarsip_panel_aman (jalankan SESUDAH migration 20261012010000_arsip_panel_aman.sql).
-- Memakai DATA UJI di dalam transaksi yang di-ROLLBACK di akhir -> tidak ada yang tersisa di database.
-- Harus berakhir 'SEMUA LULUS'. Bila ada yang gagal -> exception (pesan 'GAGAL Ux: ...').

begin;

do $$
declare
  v_wo bigint; v_p bigint; v_perm bigint; v_hasil jsonb; v_tolak boolean := false; v_ftk int;
begin
  insert into public.work_orders (wo, proyek, target) values ('UJI-APA', 'UJI ARSIP PANEL AMAN', current_date + 30) returning id into v_wo;
  insert into public.panels (wo_id, no_pnl, nama, tipe, qty, checklist) values (v_wo, 1, 'UJI PANEL ARSIP', 'FS', 1, '{}'::jsonb) returning id into v_p;
  insert into public.raw_schedule (wo_id, panel_id, proyek, panel, proses, prioritas, schedule)
    values (v_wo, v_p, 'UJI ARSIP PANEL AMAN', 'UJI PANEL ARSIP', 'POTONG', 'Sedang', '{"2030-01-02":[{"wp":"WP1","komponen":["FS.1"]}]}'::jsonb);
  insert into public.permintaan (jenis, operator_nama, divisi, wo_id, panel_id, wo_number, proyek, panel_nama)
    values ('BBMB', 'UJI', 'mekanik', v_wo, v_p, 'UJI-APA', 'UJI ARSIP PANEL AMAN', 'UJI PANEL ARSIP') returning id into v_perm;
  insert into public.permintaan_item (permintaan_id, nama_komponen, qty, status) values (v_perm, 'UJI KABEL', 2, 'submit'), (v_perm, 'UJI BAUT', 10, 'submit');
  insert into public.fcs_tracking_komponen (wo_id, panel_id, sub_bagian, operator_name, catatan) values (v_wo, v_p, 'Warehouse', 'UJI', 'uji');

  -- U1: arsip panel ber-permintaan -> BERHASIL, permintaan + item UTUH, dilepas ke panel_id_arsip
  v_hasil := public.arsip_panel_aman(v_p, 'UJI', 42.6);
  if (v_hasil->>'permintaan_dilepas')::int <> 1 then raise exception 'GAGAL U1: hasil %', v_hasil; end if;
  if exists (select 1 from public.panels where id = v_p) then raise exception 'GAGAL U1: panel masih aktif'; end if;
  if not exists (select 1 from public.panels_archived where id = v_p) then raise exception 'GAGAL U1: panel tidak ada di panels_archived'; end if;
  if not exists (select 1 from public.permintaan where id = v_perm and panel_id is null and panel_id_arsip = v_p) then raise exception 'GAGAL U1: permintaan tidak utuh/tidak dilepas'; end if;
  if (select count(*) from public.permintaan_item where permintaan_id = v_perm) <> 2 then raise exception 'GAGAL U1: item permintaan hilang'; end if;
  if exists (select 1 from public.fcs_tracking_komponen where panel_id = v_p) then raise exception 'GAGAL U1: fcs_tracking_komponen masih di tabel aktif'; end if;
  select count(*) into v_ftk from public.fcs_tracking_komponen_archived where panel_id = v_p;
  raise notice 'LULUS U1: diarsip, permintaan+2 item utuh (panel_id_arsip=%), fcs_tracking_komponen_archived=% baris, hasil %', v_p, v_ftk, v_hasil;

  -- U2: arsip panel yang sudah tidak aktif -> ditolak P0001
  begin
    perform public.arsip_panel_aman(v_p, 'UJI', 0);
  exception when sqlstate 'P0001' then v_tolak := true;
  end;
  if not v_tolak then raise exception 'GAGAL U2: arsip ulang tidak ditolak'; end if;
  raise notice 'LULUS U2: arsip panel yang tidak aktif ditolak';

  -- U3: unarsip -> panel kembali, permintaan tersambung lagi
  v_hasil := public.unarsip_panel_aman(v_p);
  if not exists (select 1 from public.panels where id = v_p) then raise exception 'GAGAL U3: panel tidak kembali'; end if;
  if not exists (select 1 from public.permintaan where id = v_perm and panel_id = v_p and panel_id_arsip is null) then raise exception 'GAGAL U3: permintaan tidak tersambung kembali'; end if;
  if (select count(*) from public.permintaan_item where permintaan_id = v_perm) <> 2 then raise exception 'GAGAL U3: item permintaan hilang'; end if;
  if (select count(*) from public.raw_schedule where panel_id = v_p) <> 1 then raise exception 'GAGAL U3: jadwal tidak kembali'; end if;
  raise notice 'LULUS U3: unarsip, panel+jadwal kembali, permintaan tersambung, hasil %', v_hasil;

  raise notice 'SEMUA LULUS';
end $$;

rollback; -- data uji dibuang
