-- ============================================================================================
-- KUNCI URUTAN PROGRES PER QTY + SATU SUMBER URUTAN PROSES + KOREKSI ADMIN (22 Okt 2026, keputusan user)
-- Temuan 21 Okt: panel 521 Box Control (FS.5) RENDAM 2/3 tapi PAINTING & RAKIT 3/3 - kuncian DB dulu
-- HANYA POTONG>BENDING>STEL>FINISHING (trg_panels_validate_mekanik_cap 21 Sep 2026) + tahap BUSBAR.
--
-- (1) public.urutan_proses = SATU-SATUNYA sumber urutan proses. Dibaca trigger ini, vista-teknik
--     (peringatan Raw Schedule lib/urutanProses.ts, K17, K18) & vista-pekerja (cap qty). Tidak ada salinan
--     konstanta lain di aplikasi (gagal baca -> peringatan/cap aplikasi mati sementara + log; trigger tetap).
--     pendahulu = kandidat berurutan; proses tak relevan utk kode (bom_proses_relevan) dilompati.
--     mode 'kunci' = ditolak trigger; 'peringatan' = hanya peringatan Raw Schedule & cek Kesehatan Data.
-- (2) Trigger trg_panels_validate_urutan_progres MENGGANTIKAN trg_panels_validate_mekanik_cap (fungsi lama
--     dibiarkan utk rollback). Hanya memeriksa komponen yang progress-nya BERUBAH (OLD vs NEW) dan hanya menolak
--     kalau perubahan itu MEMBUAT / MEMPERLEBAR selisih pasangan 'kunci' -> data lama yang sudah terbalik tidak
--     memblokir simpanan lain; perubahan yang memperbaiki (mis. RENDAM 2->3) diterima. Trigger BUSBAR tidak diubah.
-- (3) public.koreksi_progres_log - jejak koreksi AWET (tidak ikut pembersihan activity_log).
-- (4) RPC koreksi_progres_admin - SATU-SATUNYA jalur yang melewati kuncian (alasan wajib, divisi 'admin').
--     CATATAN KEAMANAN: tanpa Supabase Auth, RPC ini bisa dipanggil siapa pun yang memegang anon key dan nama/
--     divisi diisi oleh aplikasi -> ini KONTROL APLIKASI, bukan pengaman keras. Yang terjamin: setiap koreksi
--     tercatat permanen dengan alasan & nilai lama/baru.
-- Dry-run   : supabase/verifikasi/20261022010000_kunci_urutan_progres_dryrun.sql (SEBELUM)
-- Verifikasi: supabase/verifikasi/20261022010000_kunci_urutan_progres_verifikasi.sql (SESUDAH, harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261022010000_kunci_urutan_progres_rollback.sql
-- Jalankan di LUAR jam kerja, satu malam dengan rilis vista-pekerja (pesan penolakan yang jelas).
-- ============================================================================================
begin;

-- ── (1) satu sumber urutan proses ─────────────────────────────────────────────────────────────
create table if not exists public.urutan_proses (
  proses text primary key,
  pendahulu text[] not null default '{}',
  mode text not null check (mode in ('kunci', 'peringatan')),
  keterangan text,
  diubah_pada timestamptz not null default now()
);
alter table public.urutan_proses enable row level security;
drop policy if exists baca_urutan_proses on public.urutan_proses;
create policy baca_urutan_proses on public.urutan_proses for select to anon, authenticated using (true);

insert into public.urutan_proses (proses, pendahulu, mode, keterangan) values
 ('POTONG',          '{}',                                                          'kunci',      'proses pertama'),
 ('BENDING',         '{POTONG}',                                                    'kunci',      'Mekanik'),
 ('STEL',            '{BENDING,POTONG}',                                            'kunci',      'Mekanik'),
 ('FINISHING',       '{STEL,BENDING,POTONG}',                                       'kunci',      'Mekanik'),
 ('RENDAM',          '{FINISHING,STEL,BENDING,POTONG}',                             'kunci',      'keputusan user 21 Okt 2026'),
 ('PAINTING',        '{RENDAM,FINISHING,STEL,BENDING,POTONG}',                      'kunci',      'keputusan user 21 Okt 2026'),
 ('RAKIT',           '{PAINTING,RENDAM,FINISHING,STEL,BENDING,POTONG}',             'kunci',      'keputusan user 21 Okt 2026'),
 ('PASANG KOMPONEN', '{RAKIT,PAINTING,RENDAM,FINISHING,STEL,BENDING,POTONG}',       'peringatan', 'progres gabungan tahap - hanya peringatan'),
 ('WIRING CONTROL',  '{PAINTING,RENDAM,FINISHING,STEL,BENDING,POTONG}',             'peringatan', 'sejajar RAKIT - hanya peringatan'),
 ('WIRING POWER',    '{PAINTING,RENDAM,FINISHING,STEL,BENDING,POTONG}',             'peringatan', 'sejajar RAKIT & WIRING CONTROL - hanya peringatan')
on conflict (proses) do nothing;

-- ── (2) trigger kunci urutan (hanya yang berubah) ─────────────────────────────────────────────
create or replace function public._angka_progres(v text) returns numeric language sql immutable as $$
  select case when v ~ '^-?[0-9]+(\.[0-9]+)?$' then v::numeric else 0 end
$$;

create or replace function public.panels_validate_urutan_progres()
returns trigger language plpgsql as $$
declare
  v_kode text; v_baru jsonb; v_lama jsonb; v_ada_mapping boolean; r record; v_awal text;
  v_bc numeric; v_bp numeric; v_lc numeric; v_lp numeric; v_qty text;
begin
  if NEW.checklist is null then return NEW; end if;
  -- jalur koreksi admin (RPC koreksi_progres_admin) - dicatat di koreksi_progres_log
  if coalesce(current_setting('vista.koreksi_progres', true), '') = 'on' then return NEW; end if;

  for v_kode, v_baru in select key, value from jsonb_each(NEW.checklist) loop
    if jsonb_typeof(v_baru) <> 'object' or jsonb_typeof(v_baru->'progress') is distinct from 'object' then continue; end if;
    v_lama := case when OLD.checklist is not null and jsonb_typeof(OLD.checklist->v_kode) = 'object' then OLD.checklist->v_kode else '{}'::jsonb end;
    if (v_baru->'progress') is not distinct from (v_lama->'progress') then continue; end if; -- komponen tidak berubah

    select exists (select 1 from public.bom_proses_relevan where kode_komponen = v_kode and tipe_panel = NEW.tipe) into v_ada_mapping;

    for r in select * from public.urutan_proses where mode = 'kunci' and cardinality(pendahulu) > 0 loop
      if v_ada_mapping and not exists (select 1 from public.bom_proses_relevan where kode_komponen = v_kode and tipe_panel = NEW.tipe and jenis_pekerjaan = r.proses) then continue; end if;
      select u.p into v_awal from unnest(r.pendahulu) with ordinality u(p, n)
        where not v_ada_mapping or exists (select 1 from public.bom_proses_relevan where kode_komponen = v_kode and tipe_panel = NEW.tipe and jenis_pekerjaan = u.p)
        order by u.n limit 1;
      if v_awal is null then continue; end if;

      v_bc := public._angka_progres(v_baru->'progress'->>r.proses); v_bp := public._angka_progres(v_baru->'progress'->>v_awal);
      if v_bc <= v_bp then continue; end if;                           -- urutan baik
      v_lc := public._angka_progres(v_lama->'progress'->>r.proses); v_lp := public._angka_progres(v_lama->'progress'->>v_awal);
      if v_bc = v_lc and v_bp = v_lp then continue; end if;            -- pasangan ini tidak diubah
      if v_lc > v_lp and (v_bc - v_bp) <= (v_lc - v_lp) then continue; end if; -- data lama terbalik, tidak diperlebar

      v_qty := nullif(v_baru->>'qty', '');
      raise exception '%', format('Urutan proses: %s (%s) tidak boleh melebihi %s (%s) - komponen %s',
          r.proses, coalesce(nullif(v_baru->'qtyProses'->>r.proses, '') || '/' || v_qty, v_bc::text || '%'),
          v_awal, coalesce(nullif(v_baru->'qtyProses'->>v_awal, '') || '/' || v_qty, v_bp::text || '%'), v_kode)
        using errcode = 'P0001', hint = format('URUTAN_PROSES|%s|%s|%s', v_kode, r.proses, v_awal);
    end loop;
  end loop;
  return NEW;
end $$;

drop trigger if exists trg_panels_validate_mekanik_cap on public.panels;
drop trigger if exists trg_panels_validate_urutan_progres on public.panels;
create trigger trg_panels_validate_urutan_progres
  before update of checklist on public.panels
  for each row when (NEW.checklist is distinct from OLD.checklist)
  execute function public.panels_validate_urutan_progres();

-- ── (3) jejak koreksi awet ─────────────────────────────────────────────────────────────────────
create table if not exists public.koreksi_progres_log (
  id bigint generated always as identity primary key,
  waktu timestamptz not null default now(),
  panel_id bigint not null,
  panel_nama text,
  kode_komponen text not null,
  proses text not null,
  tanggal date not null,
  qty_lama numeric, qty_baru numeric not null, pct_lama numeric, pct_baru numeric not null,
  alasan text not null check (length(btrim(alasan)) >= 5),
  oleh text not null, divisi text not null
);
create index if not exists idx_koreksi_progres_log_panel on public.koreksi_progres_log (panel_id, kode_komponen, waktu desc);
alter table public.koreksi_progres_log enable row level security;
drop policy if exists baca_koreksi_progres_log on public.koreksi_progres_log;
create policy baca_koreksi_progres_log on public.koreksi_progres_log for select to anon, authenticated using (true);
-- tidak ada policy insert/update/delete: tulis HANYA lewat RPC koreksi_progres_admin (security definer)

-- ── (4) RPC koreksi admin ───────────────────────────────────────────────────────────────────────
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

commit;
