-- PINDAH BANYAK SEL RAW SCHEDULE - V2 (9 Okt 2026): BUSBAR + QC/PACKING ikut, Minggu boleh bila kapasitas ada.
-- Rollback: supabase/rollback/20261009010000_pindah_multi_sel_v2_rollback.sql
-- Migrasi v1 (20261008020000) TIDAK diubah; fungsi v1 tetap ada utk tab lama yang belum dimuat ulang.
--
-- Beda dari v1:
-- 1. p_rows membawa 4 kolom per baris (sebelum & sesudah): schedule, busbar_schedule, busbar_jejak,
--    busbar_manual_pin. Jadwal baru tetap dihitung di aplikasi (lib/jadwalPindah.ts - helper yang sama
--    dgn drag 1 sel, termasuk BUSBAR). Server MENOLAK bila salah satu kolom di DB sudah berbeda dari
--    `sebelum` (diubah orang lain sejak layar dimuat) - tidak pernah menimpa.
-- 2. Hari Minggu: BOLEH bila kapasitas (fcs_kapasitas_override) utk tanggal+proses tsb ADA dan > 0.
--    Server hanya mengecek baris kapasitas ada (murah & pasti); hitungan PEMAKAIAN <= kapasitas dicek
--    di aplikasi dgn rumus yang sama dgn kartu Capacity Utilization (keputusan user 9 Okt 2026: risiko
--    overbook kecil bila 2 admin memindah ke Minggu yang sama bersamaan diterima).
-- 3. BUSBAR: ditolak bila ada timer BERJALAN (fcs_timer_kerja.selesai IS NULL) utk kode yang dipindah
--    - aturan yang sama dgn drag 1 sel BUSBAR.
-- 4. Renhar (termasuk wp BUSBAR / QC TEST / PACKING dgn komponen "MARKED") dipindah dgn logika yang
--    sama persis v1 (= lib/renharSinkron.ts). Semua 1 transaksi. Snapshot utk undo mencakup 4 kolom.
-- Tidak menambah trigger. Tabel/RLS tidak diubah.

create or replace function public.pindah_multi_sel_v2(p_sel jsonb, p_rows jsonb, p_renhar jsonb, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb; op jsonb; s jsonb;
  v_raw_id bigint; v_ke date; v_proses text; v_panel bigint; v_kode_bb text[]; v_n int;
  v_cur record;
  v_raw_out jsonb := '[]'::jsonb;
  v_seen bigint[] := '{}';
  v_sebelum jsonb := '[]'::jsonb;
  v_dibuat bigint[] := '{}';
  v_kode text[]; v_pindah text[]; v_sisa text[]; v_rel text[]; v_ppk jsonb;
  v_asal public.renhar%rowtype; v_tujuan public.renhar%rowtype;
  v_ada_tujuan boolean; v_baru_id bigint;
  v_dari date; v_wp text; v_n_sel int;
  v_sesudah jsonb := '[]'::jsonb; v_id bigint;
  v_cur_obj jsonb; v_seb_obj jsonb;
begin
  v_n_sel := jsonb_array_length(coalesce(p_sel, '[]'::jsonb));
  if v_n_sel = 0 then raise exception 'Tidak ada sel yang dipindah' using errcode = 'P0001'; end if;

  -- 1) Validasi tujuan (atomik: satu saja bentrok -> batal semua).
  for s in select * from jsonb_array_elements(p_sel) loop
    v_raw_id := (s->>'raw_id')::bigint; v_ke := (s->>'ke')::date;
    select proses, panel_id into v_proses, v_panel from public.raw_schedule where id = v_raw_id;
    if not found then
      raise exception 'Baris jadwal % tidak ditemukan (mungkin sudah diarsip/dihapus). Muat ulang halaman.', v_raw_id using errcode = 'P0001';
    end if;
    -- Minggu: wajib ada kapasitas > 0 utk tanggal+proses tsb.
    if extract(dow from v_ke) = 0 and not exists (
      select 1 from public.fcs_kapasitas_override k
      where k.tanggal = v_ke and k.jenis_pekerjaan = v_proses
        and (coalesce(k.kapasitas_menit, 0) > 0 or coalesce(k.jumlah_orang, 0) > 0)
    ) then
      raise exception 'Dibatalkan: kapasitas Minggu % untuk % belum diatur. Tidak ada yang dipindah.', v_ke, v_proses using errcode = 'P0001';
    end if;
    -- BUSBAR: timer berjalan utk kode yang dipindah = bentrok.
    if v_proses = 'BUSBAR' then
      v_kode_bb := array(select jsonb_array_elements_text(coalesce(s->'kode_busbar', '[]'::jsonb)));
      if cardinality(v_kode_bb) > 0 then
        select count(*) into v_n from public.fcs_timer_kerja t
          where t.panel_id = v_panel and t.proses = 'BUSBAR' and t.selesai is null and t.kode_komponen = any(v_kode_bb);
        if v_n > 0 then
          raise exception 'Dibatalkan: ada timer BUSBAR yang sedang berjalan (raw %). Tidak ada yang dipindah.', v_raw_id using errcode = 'P0001';
        end if;
      end if;
    end if;
  end loop;

  -- 2) raw_schedule (4 kolom): kunci, pastikan belum diubah orang lain, lalu tulis.
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_raw_id := (r->>'raw_id')::bigint;
    select coalesce(schedule, '{}'::jsonb) as schedule, coalesce(busbar_schedule, '{}'::jsonb) as busbar_schedule,
           coalesce(busbar_jejak, '{}'::jsonb) as busbar_jejak, coalesce(busbar_manual_pin, '{}'::jsonb) as busbar_manual_pin
      into v_cur from public.raw_schedule where id = v_raw_id for update;
    if not found then
      raise exception 'Baris jadwal % tidak ditemukan (mungkin sudah diarsip/dihapus). Muat ulang halaman.', v_raw_id using errcode = 'P0001';
    end if;
    v_cur_obj := jsonb_build_object('schedule', v_cur.schedule, 'busbar_schedule', v_cur.busbar_schedule,
                                    'busbar_jejak', v_cur.busbar_jejak, 'busbar_manual_pin', v_cur.busbar_manual_pin);
    v_seb_obj := jsonb_build_object(
      'schedule', coalesce(r->'sebelum'->'schedule', '{}'::jsonb),
      'busbar_schedule', coalesce(r->'sebelum'->'busbar_schedule', '{}'::jsonb),
      'busbar_jejak', coalesce(r->'sebelum'->'busbar_jejak', '{}'::jsonb),
      'busbar_manual_pin', coalesce(r->'sebelum'->'busbar_manual_pin', '{}'::jsonb));
    if v_cur_obj is distinct from v_seb_obj then
      raise exception 'Jadwal baris % sudah diubah orang lain sejak layar dimuat. Muat ulang halaman lalu ulangi. Tidak ada yang dipindah.', v_raw_id using errcode = 'P0001';
    end if;
    update public.raw_schedule set
      schedule = coalesce(r->'sesudah'->'schedule', '{}'::jsonb),
      busbar_schedule = coalesce(r->'sesudah'->'busbar_schedule', '{}'::jsonb),
      busbar_jejak = coalesce(r->'sesudah'->'busbar_jejak', '{}'::jsonb),
      busbar_manual_pin = coalesce(r->'sesudah'->'busbar_manual_pin', '{}'::jsonb),
      updated_at = now()
    where id = v_raw_id;
    v_raw_out := v_raw_out || jsonb_build_array(jsonb_build_object('raw_id', v_raw_id, 'sebelum', v_cur_obj, 'sesudah',
      jsonb_build_object('schedule', coalesce(r->'sesudah'->'schedule', '{}'::jsonb),
                         'busbar_schedule', coalesce(r->'sesudah'->'busbar_schedule', '{}'::jsonb),
                         'busbar_jejak', coalesce(r->'sesudah'->'busbar_jejak', '{}'::jsonb),
                         'busbar_manual_pin', coalesce(r->'sesudah'->'busbar_manual_pin', '{}'::jsonb))));
  end loop;

  -- 3) renhar: per (raw, wp, dari, ke, kode[]) - SAMA PERSIS v1 / lib/renharSinkron.ts.
  for op in select * from jsonb_array_elements(coalesce(p_renhar, '[]'::jsonb)) loop
    v_raw_id := (op->>'raw_id')::bigint; v_wp := op->>'wp';
    v_dari := (op->>'dari')::date; v_ke := (op->>'ke')::date;
    v_kode := array(select jsonb_array_elements_text(coalesce(op->'kode', '[]'::jsonb)));
    if v_dari = v_ke or cardinality(v_kode) = 0 then continue; end if;

    select * into v_asal from public.renhar
      where raw_id = v_raw_id and wp = v_wp and tanggal = v_dari
      order by updated_at desc nulls last limit 1 for update;
    if not found then continue; end if;
    v_pindah := array(select k from jsonb_array_elements_text(coalesce(v_asal.komponen, '[]'::jsonb)) k where k = any(v_kode));
    if cardinality(v_pindah) = 0 then continue; end if;
    v_sisa := array(select k from jsonb_array_elements_text(coalesce(v_asal.komponen, '[]'::jsonb)) k where not (k = any(v_kode)));
    v_rel := array(select k from unnest(v_pindah) k where k = any(coalesce(v_asal.komponen_released, '{}'::text[])));
    v_ppk := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
              from jsonb_each(coalesce(v_asal.pekerja_per_komponen, '{}'::jsonb)) where key = any(v_pindah));

    if not (v_asal.id = any(v_seen)) and not (v_asal.id = any(v_dibuat)) then
      v_seen := v_seen || v_asal.id; v_sebelum := v_sebelum || jsonb_build_array(public._renhar_snap(v_asal.id));
    end if;

    select * into v_tujuan from public.renhar
      where raw_id = v_raw_id and wp = v_wp and tanggal = v_ke
      order by updated_at desc nulls last limit 1 for update;
    v_ada_tujuan := found;

    if v_ada_tujuan then
      if not (v_tujuan.id = any(v_seen)) and not (v_tujuan.id = any(v_dibuat)) then
        v_seen := v_seen || v_tujuan.id; v_sebelum := v_sebelum || jsonb_build_array(public._renhar_snap(v_tujuan.id));
      end if;
      update public.renhar set
        komponen = coalesce(komponen, '[]'::jsonb)
                   || to_jsonb(array(select k from unnest(v_pindah) k where not (coalesce(komponen, '[]'::jsonb) ? k))),
        komponen_released = coalesce(komponen_released, '{}'::text[])
                   || array(select k from unnest(v_rel) k where not (k = any(coalesce(komponen_released, '{}'::text[])))),
        pekerja_per_komponen = coalesce(pekerja_per_komponen, '{}'::jsonb) || v_ppk,
        updated_at = now()
      where id = v_tujuan.id;
    elsif cardinality(v_sisa) = 0 then
      update public.renhar set tanggal = v_ke, komponen = to_jsonb(v_pindah), updated_at = now() where id = v_asal.id;
      continue;
    else
      insert into public.renhar (raw_id, wo_id, panel_id, proyek, panel, proses, prioritas, wp, komponen, tanggal,
                                 divisi, pekerja, komponen_released, pekerja_per_komponen)
      values (v_asal.raw_id, v_asal.wo_id, v_asal.panel_id, v_asal.proyek, v_asal.panel, v_asal.proses,
              coalesce(v_asal.prioritas, 'Sedang'), v_wp, to_jsonb(v_pindah), v_ke,
              v_asal.divisi, coalesce(v_asal.pekerja, '[]'::jsonb), v_rel, v_ppk)
      returning id into v_baru_id;
      v_dibuat := v_dibuat || v_baru_id;
    end if;

    update public.renhar set
      komponen = to_jsonb(array(select k from jsonb_array_elements_text(coalesce(komponen, '[]'::jsonb)) k where not (k = any(v_kode)))),
      komponen_released = array(select k from unnest(coalesce(komponen_released, '{}'::text[])) k where not (k = any(v_kode))),
      pekerja_per_komponen = (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
                              from jsonb_each(coalesce(pekerja_per_komponen, '{}'::jsonb)) where not (key = any(v_pindah))),
      updated_at = now()
    where id = v_asal.id;
  end loop;

  foreach v_id in array (v_seen || v_dibuat) loop
    v_sesudah := v_sesudah || jsonb_build_array(public._renhar_snap(v_id));
  end loop;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'PINDAH BANYAK SEL',
          format('Pindah %s sel Raw Schedule sekaligus (%s baris jadwal, %s baris rencana harian disentuh, %s dibuat)',
                 v_n_sel, jsonb_array_length(v_raw_out), cardinality(v_seen), cardinality(v_dibuat)),
          'raw', 'Raw Schedule');

  return jsonb_build_object('versi', 2, 'raw', v_raw_out, 'renhar_sebelum', v_sebelum,
                            'renhar_dibuat', to_jsonb(v_dibuat), 'renhar_sesudah', v_sesudah);
end;
$$;


create or replace function public.pulihkan_multi_sel_v2(p_snap jsonb, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb; v_cur record; v_cur_obj jsonb; v_raw_id bigint; v_id bigint; v_i int := 0;
  v_dibuat bigint[] := array(select (jsonb_array_elements_text(coalesce(p_snap->'renhar_dibuat', '[]'::jsonb)))::bigint);
begin
  -- 1) Cek: semua yang disentuh masih PERSIS seperti setelah dipindah (4 kolom raw + renhar).
  for r in select * from jsonb_array_elements(coalesce(p_snap->'raw', '[]'::jsonb)) loop
    v_raw_id := (r->>'raw_id')::bigint;
    select coalesce(schedule, '{}'::jsonb) as schedule, coalesce(busbar_schedule, '{}'::jsonb) as busbar_schedule,
           coalesce(busbar_jejak, '{}'::jsonb) as busbar_jejak, coalesce(busbar_manual_pin, '{}'::jsonb) as busbar_manual_pin
      into v_cur from public.raw_schedule where id = v_raw_id for update;
    if found then
      v_cur_obj := jsonb_build_object('schedule', v_cur.schedule, 'busbar_schedule', v_cur.busbar_schedule,
                                      'busbar_jejak', v_cur.busbar_jejak, 'busbar_manual_pin', v_cur.busbar_manual_pin);
    end if;
    if not found or v_cur_obj is distinct from (r->'sesudah') then
      raise exception 'Tidak bisa dibatalkan: jadwal baris % sudah diubah lagi sejak dipindah. Tidak ada yang diubah.', v_raw_id using errcode = 'P0001';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sesudah', '[]'::jsonb)) loop
    v_id := (r->>'id')::bigint;
    perform 1 from public.renhar where id = v_id for update;
    if public._renhar_snap(v_id) is distinct from r then
      raise exception 'Tidak bisa dibatalkan: rencana harian (id %) sudah berubah lagi sejak dipindah (mis. dirilis/diubah orang lain). Tidak ada yang diubah.', v_id using errcode = 'P0001';
    end if;
  end loop;

  -- 2) Pulihkan (tanggal renhar diparkir dulu supaya tidak bentrok constraint unik).
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)) loop
    v_i := v_i + 1;
    update public.renhar set tanggal = date '1000-01-01' + v_i
      where id = (r->>'id')::bigint and tanggal is distinct from (r->>'tanggal')::date;
  end loop;
  delete from public.renhar where id = any(v_dibuat);
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)) loop
    update public.renhar set
      tanggal = (r->>'tanggal')::date,
      komponen = r->'komponen',
      komponen_released = array(select jsonb_array_elements_text(r->'komponen_released')),
      pekerja_per_komponen = r->'pekerja_per_komponen',
      updated_at = now()
    where id = (r->>'id')::bigint;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_snap->'raw', '[]'::jsonb)) loop
    update public.raw_schedule set
      schedule = r->'sebelum'->'schedule',
      busbar_schedule = r->'sebelum'->'busbar_schedule',
      busbar_jejak = r->'sebelum'->'busbar_jejak',
      busbar_manual_pin = r->'sebelum'->'busbar_manual_pin',
      updated_at = now()
    where id = (r->>'raw_id')::bigint;
  end loop;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'BATALKAN PINDAH BANYAK SEL',
          format('Batalkan pindah banyak sel: %s baris jadwal & %s baris rencana harian dipulihkan, %s baris dibuat dihapus',
                 jsonb_array_length(coalesce(p_snap->'raw', '[]'::jsonb)),
                 jsonb_array_length(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)), cardinality(v_dibuat)),
          'raw', 'Raw Schedule');
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.pindah_multi_sel_v2(jsonb, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.pulihkan_multi_sel_v2(jsonb, text) to anon, authenticated;
