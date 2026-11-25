-- ROLLBACK Tahap 4.1 (25 Nov 2026): kembalikan koreksi_progres_admin ke definisi 22 Okt 2026 (supabase/migrations/20261022010000_kunci_urutan_progres.sql bagian (4)) APA ADANYA.
-- Data yang sudah ditulis lewat buka kembali (checklist, CCP, koreksi_progres_log, activity_log) TIDAK dihapus - itu jejak sah.
begin;
create or replace function public.koreksi_progres_admin(p_panel_id bigint, p_kode text, p_proses text, p_qty numeric,
  p_alasan text, p_oleh text, p_divisi text, p_tanggal date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tgl date := coalesce(p_tanggal, (now() at time zone 'Asia/Jakarta')::date); v_t text;
  v_panel record; v_cl jsonb; v_qty numeric; v_pct numeric; v_qty_lama numeric; v_pct_lama numeric; v_status text;
begin
  if coalesce(p_divisi, '') <> 'admin' then raise exception 'Koreksi progres hanya untuk Admin Produksi.' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_alasan)), 0) < 5 then raise exception 'Alasan koreksi wajib diisi (min 5 huruf).' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'Nama admin wajib.' using errcode = '22023'; end if;
  if p_proses not in ('POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT') then
    raise exception 'Proses % tidak bisa dikoreksi lewat jalur ini.', p_proses using errcode = '22023';
  end if;
  v_t := v_tgl::text;
  select id, nama, checklist into v_panel from public.panels where id = p_panel_id for update;
  if not found then raise exception 'Panel % tidak ada.', p_panel_id using errcode = '22023'; end if;
  v_cl := v_panel.checklist -> p_kode;
  if v_cl is null or jsonb_typeof(v_cl) <> 'object' then raise exception 'Komponen % tidak ada di panel ini.', p_kode using errcode = '22023'; end if;
  v_qty := public._angka_progres(v_cl->>'qty');
  if v_qty <= 0 then raise exception 'Qty komponen % = 0.', p_kode using errcode = '22023'; end if;
  if p_qty is null or p_qty < 0 or p_qty > v_qty or p_qty <> trunc(p_qty) then
    raise exception 'Qty koreksi harus bilangan bulat 0..%.', v_qty using errcode = '22023';
  end if;
  v_pct := round(p_qty / v_qty * 100);                                   -- sama dgn rumus app (Math.round)
  v_qty_lama := public._angka_progres(v_cl->'qtyProses'->>p_proses);
  v_pct_lama := public._angka_progres(v_cl->'progress'->>p_proses);

  v_cl := jsonb_set(v_cl, array['progress', p_proses], to_jsonb(v_pct), true);
  v_cl := jsonb_set(v_cl, '{qtyProses}', coalesce(v_cl->'qtyProses', '{}'::jsonb) || jsonb_build_object(p_proses, p_qty), true);
  v_cl := jsonb_set(v_cl, '{progressByDate}', coalesce(v_cl->'progressByDate', '{}'::jsonb)
            || jsonb_build_object(p_proses, coalesce(v_cl->'progressByDate'->p_proses, '{}'::jsonb) || jsonb_build_object(v_t, v_pct)), true);
  v_cl := jsonb_set(v_cl, '{qtyProsesByDate}', coalesce(v_cl->'qtyProsesByDate', '{}'::jsonb)
            || jsonb_build_object(p_proses, coalesce(v_cl->'qtyProsesByDate'->p_proses, '{}'::jsonb) || jsonb_build_object(v_t, p_qty)), true);
  v_cl := jsonb_set(v_cl, '{history}', coalesce(v_cl->'history', '{}'::jsonb)
            || jsonb_build_object(p_proses, coalesce(v_cl->'history'->p_proses, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                 'tanggal', v_t, 'pct', v_pct, 'ts', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                 'updatedBy', btrim(p_oleh), 'koreksi', true, 'alasan', btrim(p_alasan)))), true);

  perform set_config('vista.koreksi_progres', 'on', true);
  update public.panels set checklist = jsonb_set(checklist, array[p_kode], v_cl, false) where id = p_panel_id;
  perform set_config('vista.koreksi_progres', 'off', true);

  v_status := case when v_pct >= 100 then 'done' when v_pct > 0 then 'in_progress' else 'not_started' end;
  insert into public.component_process_progress (panel_id, kode_komponen, proses, tahap, status, progress_pct, qty_done, qty_total,
      sudah_disimpan_100, last_operator_nama, last_operator_at, updated_at, updated_by)
  values (p_panel_id, p_kode, p_proses, null, v_status, v_pct, p_qty, v_qty, v_pct >= 100, btrim(p_oleh), now(), now(), btrim(p_oleh))
  on conflict (panel_id, kode_komponen, proses, tahap_key) do update set status = excluded.status, progress_pct = excluded.progress_pct,
      qty_done = excluded.qty_done, qty_total = excluded.qty_total, sudah_disimpan_100 = excluded.sudah_disimpan_100,
      last_operator_nama = excluded.last_operator_nama, last_operator_at = excluded.last_operator_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  insert into public.koreksi_progres_log (panel_id, panel_nama, kode_komponen, proses, tanggal, qty_lama, qty_baru, pct_lama, pct_baru, alasan, oleh, divisi)
  values (p_panel_id, btrim(v_panel.nama), p_kode, p_proses, v_tgl, v_qty_lama, p_qty, v_pct_lama, v_pct, btrim(p_alasan), btrim(p_oleh), p_divisi);
  insert into public.activity_log (user_name, action, description, module, halaman, panel)
  values (btrim(p_oleh), 'KOREKSI PROGRES', format('Koreksi %s %s %s: %s/%s (%s%%) -> %s/%s (%s%%) tgl %s. Alasan: %s',
          btrim(v_panel.nama), p_kode, p_proses, v_qty_lama, v_qty, v_pct_lama, p_qty, v_qty, v_pct, v_t, btrim(p_alasan)), 'wo', 'Detail Progres', btrim(v_panel.nama));
  return jsonb_build_object('pct', v_pct, 'qty', p_qty, 'qty_komponen', v_qty);
end $$;
revoke all on function public.koreksi_progres_admin(bigint, text, text, numeric, text, text, text, date) from public;
grant execute on function public.koreksi_progres_admin(bigint, text, text, numeric, text, text, text, date) to anon, authenticated;
do $$ begin
  if position('WIRING CONTROL' in (select prosrc from pg_proc where proname = 'koreksi_progres_admin' and pronamespace = 'public'::regnamespace)) > 0 then
    raise exception 'Batal: rollback tidak terpasang';
  end if;
  if (select count(*) from pg_proc where proname = 'koreksi_progres_admin' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'Batal: koreksi_progres_admin harus tepat 1 versi';
  end if;
  if not has_function_privilege('anon', 'public.koreksi_progres_admin(bigint,text,text,numeric,text,text,text,date)', 'execute') then
    raise exception 'Batal: grant anon hilang';
  end if;
end $$;
commit;
