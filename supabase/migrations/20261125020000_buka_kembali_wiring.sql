-- ============================================================================================
-- BUKA KEMBALI WIRING CONTROL/POWER lewat koreksi_progres_admin (25 Nov 2026, Tahap 4.1, keputusan user)
-- Latar: Tahap 4.2 akan mengunci tombol Mulai di HP untuk komponen WIRING yang sudah tuntas. Syarat user: Admin Produksi
-- (divisi 'admin' saja) harus bisa membuka kembali komponen yang salah progres / ada revisi pekerjaan. Jalur ini sudah ada
-- untuk proses mekanik (koreksi_progres_admin, 22 Okt) tapi menolak WIRING. Diperluas, BUKAN jalur kembar.
--
-- Perubahan (signature fungsi TIDAK berubah - tidak ada drop/grant ulang/overload):
--   * p_proses boleh 'WIRING CONTROL'/'WIRING POWER'. Untuk WIRING (proses mode persen, tanpa qtyProses) p_qty DIBACA
--     SEBAGAI PERSEN BARU, bilangan bulat 0..99 (buka kembali = di bawah 100).
--   * Alasan WIRING wajib diawali 'Salah progres' atau 'Revisi pekerjaan' (dipilih di modal admin).
--   * Yang ditulis utk WIRING: progress[proses], progressByDate[proses][tanggal], history[proses] DITAMBAH 1 entri
--     {koreksi:true, alasan, updatedBy, bukaKembali (bila sebelumnya >=100)} - riwayat lama & durasi timer TIDAK disentuh,
--     qtyProses/qtyProsesByDate TIDAK ditulis (WIRING tidak memakainya). CCP ikut (qty_done null, sudah_disimpan_100 false).
--   * Log: koreksi_progres_log (qty_lama/qty_baru = setara unit persen x qty komponen, pct_lama/pct_baru persen asli)
--     + activity_log 'BUKA KEMBALI' (sebelumnya >=100) / 'KOREKSI PROGRES'.
--   * Cabang proses mekanik (POTONG..RAKIT) SAMA PERSIS dgn versi 20261022010000.
-- Rumus tuntas tidak berubah: progres terkini < 100 -> penyaring kartu & selesaiSebelumTanggal otomatis menganggap belum tuntas.
-- Jadwal TIDAK diubah (keputusan user opsi a): komponen WIRING 100% sudah dibersihkan dari raw_schedule oleh HP; admin
-- menjadwalkan ulang lewat Raw Schedule bila perlu (modal admin menampilkan pengingat).
-- Rollback: supabase/rollback/20261125020000_buka_kembali_wiring_rollback.sql (definisi 22 Okt apa adanya).
-- ============================================================================================
begin;

create or replace function public.koreksi_progres_admin(p_panel_id bigint, p_kode text, p_proses text, p_qty numeric,
  p_alasan text, p_oleh text, p_divisi text, p_tanggal date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tgl date := coalesce(p_tanggal, (now() at time zone 'Asia/Jakarta')::date); v_t text;
  v_panel record; v_cl jsonb; v_qty numeric; v_pct numeric; v_qty_lama numeric; v_pct_lama numeric; v_status text;
  v_wiring boolean := p_proses in ('WIRING CONTROL','WIRING POWER');
  v_entri jsonb; v_aksi text;
begin
  if coalesce(p_divisi, '') <> 'admin' then raise exception 'Koreksi progres hanya untuk Admin Produksi.' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_alasan)), 0) < 5 then raise exception 'Alasan koreksi wajib diisi (min 5 huruf).' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'Nama admin wajib.' using errcode = '22023'; end if;
  if p_proses not in ('POTONG','BENDING','STEL','FINISHING','RENDAM','PAINTING','RAKIT','WIRING CONTROL','WIRING POWER') then
    raise exception 'Proses % tidak bisa dikoreksi lewat jalur ini.', p_proses using errcode = '22023';
  end if;
  if v_wiring then
    if not (btrim(p_alasan) ilike 'salah progres%' or btrim(p_alasan) ilike 'revisi pekerjaan%') then
      raise exception 'Alasan buka kembali WIRING wajib "Salah progres" atau "Revisi pekerjaan".' using errcode = '22023';
    end if;
    if length(p_alasan) > 500 or length(p_oleh) > 100 then
      raise exception 'Alasan maks 500 huruf, nama admin maks 100 huruf.' using errcode = '22023';
    end if;
    -- tanggal = hari kerja WIB (modal mengirim hari kerja: 00.00-06.59 = kemarin) -> hanya hari ini atau kemarin
    if v_tgl > (now() at time zone 'Asia/Jakarta')::date or v_tgl < (now() at time zone 'Asia/Jakarta')::date - 1 then
      raise exception 'Tanggal buka kembali WIRING harus hari kerja ini.' using errcode = '22023';
    end if;
  end if;
  v_t := v_tgl::text;
  select id, nama, checklist into v_panel from public.panels where id = p_panel_id for update;
  if not found then raise exception 'Panel % tidak ada.', p_panel_id using errcode = '22023'; end if;
  v_cl := v_panel.checklist -> p_kode;
  if v_cl is null or jsonb_typeof(v_cl) <> 'object' then raise exception 'Komponen % tidak ada di panel ini.', p_kode using errcode = '22023'; end if;
  v_qty := public._angka_progres(v_cl->>'qty');
  if v_qty <= 0 then raise exception 'Qty komponen % = 0.', p_kode using errcode = '22023'; end if;

  if v_wiring then
    -- ── WIRING: p_qty = persen baru 0..99 ──
    if p_qty is null or p_qty < 0 or p_qty > 99 or p_qty <> trunc(p_qty) then
      raise exception 'Persen baru WIRING harus bilangan bulat 0..99.' using errcode = '22023';
    end if;
    if not coalesce((v_cl->'progress') ? p_proses, false) then
      raise exception 'Komponen % belum punya progres %.', p_kode, p_proses using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(case when jsonb_typeof(v_cl->'progressByDate'->p_proses) = 'object'
                 then v_cl->'progressByDate'->p_proses else '{}'::jsonb end) k where k > v_t) then
      raise exception 'Ada progres % bertanggal setelah %; koreksi tidak akan terlihat.', p_proses, v_t using errcode = '22023';
    end if;
    v_pct := p_qty;
    v_pct_lama := public._angka_progres(v_cl->'progress'->>p_proses);
    v_qty_lama := round(v_pct_lama / 100 * v_qty);
    v_entri := jsonb_build_object('tanggal', v_t, 'pct', v_pct, 'ts', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                 'updatedBy', btrim(p_oleh), 'koreksi', true, 'alasan', btrim(p_alasan));
    if v_pct_lama >= 100 then v_entri := v_entri || jsonb_build_object('bukaKembali', true); end if;
    v_cl := jsonb_set(v_cl, array['progress', p_proses], to_jsonb(v_pct), true);
    v_cl := jsonb_set(v_cl, '{progressByDate}', coalesce(v_cl->'progressByDate', '{}'::jsonb)
              || jsonb_build_object(p_proses, coalesce(v_cl->'progressByDate'->p_proses, '{}'::jsonb) || jsonb_build_object(v_t, v_pct)), true);
    v_cl := jsonb_set(v_cl, '{history}', coalesce(v_cl->'history', '{}'::jsonb)
              || jsonb_build_object(p_proses, coalesce(v_cl->'history'->p_proses, '[]'::jsonb) || jsonb_build_array(v_entri)), true);
  else
    -- ── Mekanik: SAMA PERSIS dgn 20261022010000 ──
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
  end if;

  perform set_config('vista.koreksi_progres', 'on', true);
  update public.panels set checklist = jsonb_set(checklist, array[p_kode], v_cl, false) where id = p_panel_id;
  perform set_config('vista.koreksi_progres', 'off', true);

  v_status := case when v_pct >= 100 then 'done' when v_pct > 0 then 'in_progress' else 'not_started' end;
  insert into public.component_process_progress (panel_id, kode_komponen, proses, tahap, status, progress_pct, qty_done, qty_total,
      sudah_disimpan_100, last_operator_nama, last_operator_at, updated_at, updated_by)
  values (p_panel_id, p_kode, p_proses, null, v_status, v_pct, case when v_wiring then null else p_qty end, v_qty, v_pct >= 100,
          btrim(p_oleh), now(), now(), btrim(p_oleh))
  on conflict (panel_id, kode_komponen, proses, tahap_key) do update set status = excluded.status, progress_pct = excluded.progress_pct,
      qty_done = excluded.qty_done, qty_total = excluded.qty_total, sudah_disimpan_100 = excluded.sudah_disimpan_100,
      last_operator_nama = excluded.last_operator_nama, last_operator_at = excluded.last_operator_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  insert into public.koreksi_progres_log (panel_id, panel_nama, kode_komponen, proses, tanggal, qty_lama, qty_baru, pct_lama, pct_baru, alasan, oleh, divisi)
  values (p_panel_id, btrim(v_panel.nama), p_kode, p_proses, v_tgl, v_qty_lama,
          case when v_wiring then round(v_pct / 100 * v_qty) else p_qty end, v_pct_lama, v_pct, btrim(p_alasan), btrim(p_oleh), p_divisi);

  if v_wiring then
    v_aksi := case when v_pct_lama >= 100 then 'BUKA KEMBALI' else 'KOREKSI PROGRES' end;
    insert into public.activity_log (user_name, action, description, module, halaman, panel)
    values (btrim(p_oleh), v_aksi, format('%s %s %s %s: %s%% -> %s%% tgl %s. Alasan: %s',
            case when v_aksi = 'BUKA KEMBALI' then 'Buka kembali' else 'Koreksi' end,
            btrim(v_panel.nama), p_kode, p_proses, v_pct_lama, v_pct, v_t, btrim(p_alasan)), 'wo', 'Detail Progres', btrim(v_panel.nama));
  else
    insert into public.activity_log (user_name, action, description, module, halaman, panel)
    values (btrim(p_oleh), 'KOREKSI PROGRES', format('Koreksi %s %s %s: %s/%s (%s%%) -> %s/%s (%s%%) tgl %s. Alasan: %s',
            btrim(v_panel.nama), p_kode, p_proses, v_qty_lama, v_qty, v_pct_lama, p_qty, v_qty, v_pct, v_t, btrim(p_alasan)), 'wo', 'Detail Progres', btrim(v_panel.nama));
  end if;
  return jsonb_build_object('pct', v_pct, 'qty', case when v_wiring then round(v_pct / 100 * v_qty) else p_qty end, 'qty_komponen', v_qty,
                            'pct_lama', v_pct_lama, 'buka_kembali', v_wiring and v_pct_lama >= 100);
end $$;
revoke all on function public.koreksi_progres_admin(bigint, text, text, numeric, text, text, text, date) from public;
grant execute on function public.koreksi_progres_admin(bigint, text, text, numeric, text, text, text, date) to anon, authenticated;

-- verifikasi: fungsi menerima WIRING (cek teks definisi), satu versi saja
do $$ begin
  if (select count(*) from pg_proc where proname = 'koreksi_progres_admin' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'Batal: koreksi_progres_admin harus tepat 1 versi';
  end if;
  if position('WIRING CONTROL' in (select prosrc from pg_proc where proname = 'koreksi_progres_admin' and pronamespace = 'public'::regnamespace)) = 0 then
    raise exception 'Batal: definisi baru tidak terpasang';
  end if;
  if position('Qty koreksi harus bilangan bulat 0..%.' in (select prosrc from pg_proc where proname = 'koreksi_progres_admin' and pronamespace = 'public'::regnamespace)) = 0 then
    raise exception 'Batal: cabang mekanik berubah';
  end if;
  if not has_function_privilege('anon', 'public.koreksi_progres_admin(bigint,text,text,numeric,text,text,text,date)', 'execute') then
    raise exception 'Batal: grant anon hilang';
  end if;
end $$;

commit;
