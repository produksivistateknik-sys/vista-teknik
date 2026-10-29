-- UBAH JADWAL BANYAK BARIS + UNDO (B3 Raw Schedule per WP, 29 Okt 2026): salin & hapus per chip.
-- Rollback  : supabase/rollback/20261029010000_ubah_jadwal_multi_v1_rollback.sql
-- Verifikasi: supabase/scripts/20261029_verifikasi_ubah_jadwal_multi_v1.sql
--
-- Pasangan RPC BARU, terpisah dari pindah_multi_sel_v2 / pulihkan_multi_sel_v2 (TIDAK diubah - alur pindah & Undo-nya sudah
-- lulus matriks B1). Keputusan user 29 Okt 2026.
--
-- ubah_jadwal_multi_v1(p_rows, p_renhar, p_aksi, p_user)
--  - p_rows : [{raw_id, sebelum:{schedule,busbar_schedule,busbar_jejak,busbar_manual_pin[,bobot_komponen]}, sesudah:{...}}]
--             Jadwal baru dihitung aplikasi (helper bersama). Server MENOLAK (P0001) bila isi baris di DB sudah berbeda dari
--             `sebelum` (tab basi / diubah orang lain sejak layar dimuat) - tidak pernah menimpa. Semua 1 transaksi.
--  - p_renhar: operasi rencana harian, SAMA dgn sinkron renhar aplikasi (ModalJadwalSel syncRenharKomp / syncRenharDel):
--             {op:'set_komponen', raw_id, wp, tanggal, komponen:[...]} -> kolom komponen renhar (raw, wp, tanggal) diganti
--             {op:'hapus',        raw_id, wp, tanggal}                 -> baris renhar (raw, wp, tanggal) dihapus
--             Renhar yang belum ada = dilewati (renhar baru hanya lahir lewat Rilis). raw_id wajib ada di p_rows.
--  - Kembali: snapshot utk Undo - raw sebelum/sesudah + BARIS RENHAR UTUH (to_jsonb) sebelum/sesudah + id yang dihapus.
-- pulihkan_ubah_jadwal_v1(p_snap, p_user)
--  - Menolak (P0001) bila raw / renhar sudah berubah lagi sejak diubah, atau sel renhar yang dihapus sudah terisi baris baru.
--  - Memulihkan raw (kolom yang sama), renhar yang diubah (komponen + updated_at asli), dan MENYISIPKAN KEMBALI renhar yang
--    dihapus dgn id & seluruh kolom aslinya (overriding system value - renhar.id GENERATED ALWAYS).
-- Keduanya mencatat activity_log. Tidak ada tabel/kolom/trigger/RLS yang diubah.

create or replace function public.ubah_jadwal_multi_v1(p_rows jsonb, p_renhar jsonb, p_aksi text, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb; op jsonb;
  v_raw_id bigint; v_bobot boolean;
  v_cur record; v_cur_obj jsonb; v_seb_obj jsonb; v_ses_obj jsonb;
  v_raw_ids bigint[] := '{}';
  v_raw_out jsonb := '[]'::jsonb;
  v_ren public.renhar%rowtype;
  v_seen bigint[] := '{}'; v_dihapus bigint[] := '{}'; v_diubah int := 0;
  v_ren_sebelum jsonb := '[]'::jsonb; v_ren_sesudah jsonb := '[]'::jsonb;
  v_id bigint;
begin
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then
    raise exception 'Tidak ada jadwal yang diubah.' using errcode = 'P0001';
  end if;

  -- 1) raw_schedule: kunci, pastikan belum diubah orang lain (isi = `sebelum`), lalu tulis `sesudah`.
  for r in select * from jsonb_array_elements(p_rows) loop
    v_raw_id := (r->>'raw_id')::bigint;
    if v_raw_id = any(v_raw_ids) then
      raise exception 'Baris jadwal % muncul 2x dalam satu perubahan.', v_raw_id using errcode = 'P0001';
    end if;
    v_raw_ids := v_raw_ids || v_raw_id;
    v_bobot := (r->'sebelum') ? 'bobot_komponen';
    select coalesce(schedule, '{}'::jsonb) as schedule, coalesce(busbar_schedule, '{}'::jsonb) as busbar_schedule,
           coalesce(busbar_jejak, '{}'::jsonb) as busbar_jejak, coalesce(busbar_manual_pin, '{}'::jsonb) as busbar_manual_pin,
           coalesce(bobot_komponen, '{}'::jsonb) as bobot_komponen
      into v_cur from public.raw_schedule where id = v_raw_id for update;
    if not found then
      raise exception 'Baris jadwal % tidak ditemukan (mungkin sudah diarsip/dihapus). Muat ulang halaman.', v_raw_id using errcode = 'P0001';
    end if;
    v_cur_obj := jsonb_build_object('schedule', v_cur.schedule, 'busbar_schedule', v_cur.busbar_schedule,
                                    'busbar_jejak', v_cur.busbar_jejak, 'busbar_manual_pin', v_cur.busbar_manual_pin)
                 || case when v_bobot then jsonb_build_object('bobot_komponen', v_cur.bobot_komponen) else '{}'::jsonb end;
    v_seb_obj := jsonb_build_object(
                   'schedule', coalesce(r->'sebelum'->'schedule', '{}'::jsonb),
                   'busbar_schedule', coalesce(r->'sebelum'->'busbar_schedule', '{}'::jsonb),
                   'busbar_jejak', coalesce(r->'sebelum'->'busbar_jejak', '{}'::jsonb),
                   'busbar_manual_pin', coalesce(r->'sebelum'->'busbar_manual_pin', '{}'::jsonb))
                 || case when v_bobot then jsonb_build_object('bobot_komponen', coalesce(r->'sebelum'->'bobot_komponen', '{}'::jsonb)) else '{}'::jsonb end;
    if v_cur_obj is distinct from v_seb_obj then
      raise exception 'Jadwal baris % sudah diubah orang lain sejak layar dimuat. Muat ulang halaman lalu ulangi. Tidak ada yang diubah.', v_raw_id using errcode = 'P0001';
    end if;
    v_ses_obj := jsonb_build_object(
                   'schedule', coalesce(r->'sesudah'->'schedule', '{}'::jsonb),
                   'busbar_schedule', coalesce(r->'sesudah'->'busbar_schedule', '{}'::jsonb),
                   'busbar_jejak', coalesce(r->'sesudah'->'busbar_jejak', '{}'::jsonb),
                   'busbar_manual_pin', coalesce(r->'sesudah'->'busbar_manual_pin', '{}'::jsonb))
                 || case when v_bobot then jsonb_build_object('bobot_komponen', coalesce(r->'sesudah'->'bobot_komponen', '{}'::jsonb)) else '{}'::jsonb end;
    update public.raw_schedule set
      schedule = v_ses_obj->'schedule',
      busbar_schedule = v_ses_obj->'busbar_schedule',
      busbar_jejak = v_ses_obj->'busbar_jejak',
      busbar_manual_pin = v_ses_obj->'busbar_manual_pin',
      bobot_komponen = case when v_bobot then v_ses_obj->'bobot_komponen' else bobot_komponen end,
      updated_at = now()
    where id = v_raw_id;
    v_raw_out := v_raw_out || jsonb_build_array(jsonb_build_object('raw_id', v_raw_id, 'sebelum', v_cur_obj, 'sesudah', v_ses_obj));
  end loop;

  -- 2) renhar: set_komponen / hapus (sel raw+wp+tanggal; baris terbaru, sama dgn antrean renhar aplikasi).
  for op in select * from jsonb_array_elements(coalesce(p_renhar, '[]'::jsonb)) loop
    v_raw_id := (op->>'raw_id')::bigint;
    if not (v_raw_id = any(v_raw_ids)) then
      raise exception 'Operasi rencana harian utk baris % yang tidak ikut diubah.', v_raw_id using errcode = 'P0001';
    end if;
    select * into v_ren from public.renhar
      where raw_id = v_raw_id and wp = op->>'wp' and tanggal = (op->>'tanggal')::date
      order by updated_at desc nulls last limit 1 for update;
    if not found then continue; end if;
    if v_ren.id = any(v_dihapus) then continue; end if;
    if not (v_ren.id = any(v_seen)) then
      v_seen := v_seen || v_ren.id;
      v_ren_sebelum := v_ren_sebelum || jsonb_build_array(to_jsonb(v_ren));
    end if;
    if op->>'op' = 'set_komponen' then
      update public.renhar set komponen = coalesce(op->'komponen', '[]'::jsonb), updated_at = now() where id = v_ren.id;
      v_diubah := v_diubah + 1;
    elsif op->>'op' = 'hapus' then
      delete from public.renhar where id = v_ren.id;
      v_dihapus := v_dihapus || v_ren.id;
    else
      raise exception 'Operasi rencana harian tidak dikenal: %', op->>'op' using errcode = 'P0001';
    end if;
  end loop;

  foreach v_id in array v_seen loop
    if not (v_id = any(v_dihapus)) then
      v_ren_sesudah := v_ren_sesudah || jsonb_build_array((select to_jsonb(x) from public.renhar x where x.id = v_id));
    end if;
  end loop;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'UBAH JADWAL',
          format('%s: %s baris jadwal diubah, %s rencana harian diubah, %s rencana harian dihapus',
                 coalesce(nullif(p_aksi, ''), 'ubah'), jsonb_array_length(v_raw_out), v_diubah, cardinality(v_dihapus)),
          'raw', 'Raw Schedule per WP');

  return jsonb_build_object('versi', 'ubah1', 'aksi', p_aksi, 'raw', v_raw_out,
                            'renhar_sebelum', v_ren_sebelum, 'renhar_sesudah', v_ren_sesudah, 'renhar_dihapus', to_jsonb(v_dihapus));
end;
$$;


create or replace function public.pulihkan_ubah_jadwal_v1(p_snap jsonb, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb; v_raw_id bigint; v_bobot boolean; v_cur record; v_cur_obj jsonb; v_id bigint; v_kini jsonb;
  v_dihapus bigint[] := array(select (jsonb_array_elements_text(coalesce(p_snap->'renhar_dihapus', '[]'::jsonb)))::bigint);
begin
  if coalesce(p_snap->>'versi', '') <> 'ubah1' then
    raise exception 'Snapshot bukan dari ubah_jadwal_multi_v1 - tidak bisa dibatalkan di sini.' using errcode = 'P0001';
  end if;

  -- 1) Cek: semua yang disentuh masih PERSIS seperti setelah diubah.
  for r in select * from jsonb_array_elements(coalesce(p_snap->'raw', '[]'::jsonb)) loop
    v_raw_id := (r->>'raw_id')::bigint;
    v_bobot := (r->'sesudah') ? 'bobot_komponen';
    select coalesce(schedule, '{}'::jsonb) as schedule, coalesce(busbar_schedule, '{}'::jsonb) as busbar_schedule,
           coalesce(busbar_jejak, '{}'::jsonb) as busbar_jejak, coalesce(busbar_manual_pin, '{}'::jsonb) as busbar_manual_pin,
           coalesce(bobot_komponen, '{}'::jsonb) as bobot_komponen
      into v_cur from public.raw_schedule where id = v_raw_id for update;
    if found then
      v_cur_obj := jsonb_build_object('schedule', v_cur.schedule, 'busbar_schedule', v_cur.busbar_schedule,
                                      'busbar_jejak', v_cur.busbar_jejak, 'busbar_manual_pin', v_cur.busbar_manual_pin)
                   || case when v_bobot then jsonb_build_object('bobot_komponen', v_cur.bobot_komponen) else '{}'::jsonb end;
    end if;
    if not found or v_cur_obj is distinct from (r->'sesudah') then
      raise exception 'Tidak bisa dibatalkan: jadwal baris % sudah diubah lagi sejak itu. Tidak ada yang diubah.', v_raw_id using errcode = 'P0001';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sesudah', '[]'::jsonb)) loop
    v_id := (r->>'id')::bigint;
    select to_jsonb(x) - 'updated_at' into v_kini from public.renhar x where x.id = v_id for update;
    if v_kini is null or v_kini is distinct from (r - 'updated_at') then
      raise exception 'Tidak bisa dibatalkan: rencana harian (id %) sudah berubah lagi sejak itu (mis. dirilis/diubah orang lain). Tidak ada yang diubah.', v_id using errcode = 'P0001';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)) loop
    v_id := (r->>'id')::bigint;
    if not (v_id = any(v_dihapus)) then continue; end if;
    if exists (select 1 from public.renhar x where x.id = v_id) then
      raise exception 'Tidak bisa dibatalkan: rencana harian id % sudah ada lagi. Tidak ada yang diubah.', v_id using errcode = 'P0001';
    end if;
    if exists (select 1 from public.renhar x where x.raw_id = (r->>'raw_id')::bigint and x.wp = r->>'wp' and x.tanggal = (r->>'tanggal')::date) then
      raise exception 'Tidak bisa dibatalkan: sel rencana harian % % % sudah terisi baris baru (dirilis lagi?). Tidak ada yang diubah.',
        r->>'raw_id', r->>'wp', r->>'tanggal' using errcode = 'P0001';
    end if;
  end loop;

  -- 2) Pulihkan renhar: yang diubah -> komponen & updated_at asli; yang dihapus -> disisipkan kembali utuh (id asli).
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)) loop
    v_id := (r->>'id')::bigint;
    if v_id = any(v_dihapus) then
      insert into public.renhar overriding system value
      select * from jsonb_populate_record(null::public.renhar, r);
    else
      update public.renhar t set komponen = s.komponen, updated_at = s.updated_at
        from jsonb_populate_record(null::public.renhar, r) s where t.id = s.id;
    end if;
  end loop;

  -- 3) Pulihkan raw_schedule.
  for r in select * from jsonb_array_elements(coalesce(p_snap->'raw', '[]'::jsonb)) loop
    update public.raw_schedule set
      schedule = r->'sebelum'->'schedule',
      busbar_schedule = r->'sebelum'->'busbar_schedule',
      busbar_jejak = r->'sebelum'->'busbar_jejak',
      busbar_manual_pin = r->'sebelum'->'busbar_manual_pin',
      bobot_komponen = case when (r->'sebelum') ? 'bobot_komponen' then r->'sebelum'->'bobot_komponen' else bobot_komponen end,
      updated_at = now()
    where id = (r->>'raw_id')::bigint;
  end loop;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'BATALKAN UBAH JADWAL',
          format('Batalkan %s: %s baris jadwal & %s rencana harian dipulihkan (%s disisipkan kembali)',
                 coalesce(p_snap->>'aksi', 'ubah'), jsonb_array_length(coalesce(p_snap->'raw', '[]'::jsonb)),
                 jsonb_array_length(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)), cardinality(v_dihapus)),
          'raw', 'Raw Schedule per WP');
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ubah_jadwal_multi_v1(jsonb, jsonb, text, text) to anon, authenticated;
grant execute on function public.pulihkan_ubah_jadwal_v1(jsonb, text) to anon, authenticated;
