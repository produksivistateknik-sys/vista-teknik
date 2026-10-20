-- ============================================================================================
-- JENIS PANEL BUSBAR -> 2 TAHAP, HANYA FABRIKASI + PLATING (20 Okt 2026, permintaan user: "hilangkan proses pasang di
-- jenis panel busbar, jadi hanya fabrikasi dan plating saja"). Untuk tiap batang busbar di panel jenis BUSBAR:
--   - membuang isian busbarTahap.PASANG (dan sisa HEATSHRINK), HANYA kalau progresnya 0 (kalau >0 batang itu DILEWATI &
--     dilaporkan - putuskan manual, jangan buang kerja operator diam-diam);
--   - menghitung ulang gabungan = rata-rata FABRIKASI+PLATING (rumus SAMA PERSIS hitungProgressBusbarGabungan
--     vista-pekerja: rata-rata, bulat 1 desimal) ke progress.BUSBAR + entri history.BUSBAR terbaru + progressByDate.BUSBAR
--     tanggal terakhir.
-- 20 Okt: panel 546 H-BUS FABRIKASI 100 + PLATING 100 -> gabungan 66.7 -> 100 (batang busbar SELESAI).
-- component_process_progress tidak diubah (546 tidak punya baris PASANG). progress_checkpoint_log tidak diubah.
-- Jalankan SESUDAH migration 20261020010000 (trigger). Aman diulang: batang yang sudah benar dilewati.
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback.
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select p.id panel_id, p.nama, e.key kode, e.value->'busbarTahap' tahap,
       (e.value->'progress'->>'BUSBAR')::numeric gabungan_sekarang,
       round((select sum(coalesce((e.value->'busbarTahap'->t->>'progress')::numeric, 0)) from unnest(array['FABRIKASI','PLATING']) t) / 2, 1) gabungan_benar,
       case when coalesce((e.value->'busbarTahap'->'PASANG'->>'progress')::numeric, 0) > 0
              or coalesce((e.value->'busbarTahap'->'HEATSHRINK'->>'progress')::numeric, 0) > 0 then 'DILEWATI: PASANG/HEATSHRINK > 0'
            when e.value->'busbarTahap' ?| array['PASANG','HEATSHRINK'] then 'PASANG 0 dibuang' else '-' end catatan
from public.panels p, jsonb_each(p.checklist) e
where p.tipe = 'BUSBAR' and jsonb_typeof(e.value->'busbarTahap') = 'object'
order by panel_id, kode;
-- 20 Okt: harus 1 baris -> panel 546 H-BUS, gabungan_sekarang 66.7, gabungan_benar 100, 'PASANG 0 dibuang'


-- ── BAGIAN 2: EKSEKUSI ──────────────────────────────────────────────────────────────────────
begin;
create table if not exists public._backup_busbar_2tahap_20261020 (panel_id int, kode text, entri jsonb, disimpan_pada timestamptz default now());
alter table public._backup_busbar_2tahap_20261020 enable row level security;
do $$
declare r record; v_n int := 0; v_baru numeric; v_e jsonb; v_hist jsonb; v_i int; v_tgl text; v_daftar text := ''; v_lewat text := '';
begin
  for r in
    select p.id panel_id, p.nama, e.key kode, e.value v
    from public.panels p, jsonb_each(p.checklist) e
    where p.tipe = 'BUSBAR' and jsonb_typeof(e.value->'busbarTahap') = 'object'
  loop
    if coalesce((r.v->'busbarTahap'->'PASANG'->>'progress')::numeric, 0) > 0 or coalesce((r.v->'busbarTahap'->'HEATSHRINK'->>'progress')::numeric, 0) > 0 then
      v_lewat := v_lewat || format('%s %s (PASANG %s, HEATSHRINK %s); ', r.nama, r.kode, r.v->'busbarTahap'->'PASANG'->>'progress', r.v->'busbarTahap'->'HEATSHRINK'->>'progress');
      continue;
    end if;
    v_baru := round((select sum(coalesce((r.v->'busbarTahap'->t->>'progress')::numeric, 0)) from unnest(array['FABRIKASI','PLATING']) t) / 2, 1);
    continue when not (r.v->'busbarTahap' ?| array['PASANG','HEATSHRINK']) and coalesce((r.v->'progress'->>'BUSBAR')::numeric, 0) = v_baru;
    insert into public._backup_busbar_2tahap_20261020 (panel_id, kode, entri) values (r.panel_id, r.kode, r.v);
    v_e := jsonb_set(r.v, '{busbarTahap}', (r.v->'busbarTahap') - 'PASANG' - 'HEATSHRINK');
    v_e := jsonb_set(v_e, '{progress}', coalesce(v_e->'progress', '{}'::jsonb) || jsonb_build_object('BUSBAR', v_baru));
    -- entri history.BUSBAR terbaru (urut ts) ikut nilai baru
    v_hist := r.v->'history'->'BUSBAR';
    if jsonb_typeof(v_hist) = 'array' and jsonb_array_length(v_hist) > 0 then
      select (o - 1)::int into v_i from jsonb_array_elements(v_hist) with ordinality x(h, o)
        order by coalesce(h->>'ts', h->>'tanggal', '') desc limit 1;
      v_e := jsonb_set(v_e, array['history','BUSBAR',v_i::text,'pct'], to_jsonb(v_baru));
    end if;
    -- progressByDate.BUSBAR tanggal terakhir ikut nilai baru
    if jsonb_typeof(r.v->'progressByDate'->'BUSBAR') = 'object' then
      select max(k) into v_tgl from jsonb_object_keys(r.v->'progressByDate'->'BUSBAR') k;
      if v_tgl is not null then v_e := jsonb_set(v_e, array['progressByDate','BUSBAR',v_tgl], to_jsonb(v_baru)); end if;
    end if;
    update public.panels set checklist = jsonb_set(checklist, array[r.kode], v_e) where id = r.panel_id;
    v_n := v_n + 1;
    v_daftar := v_daftar || format('%s %s: %s -> %s; ', r.nama, r.kode, coalesce(r.v->'progress'->>'BUSBAR', '0'), v_baru);
  end loop;
  if v_lewat <> '' then raise notice 'DILEWATI (PASANG/HEATSHRINK sudah dikerjakan, putuskan manual): %', v_lewat; end if;
  if v_n = 0 then raise notice 'Tidak ada yang perlu dikoreksi.'; return; end if;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'KOREKSI PROGRESS BUSBAR',
    'Jenis panel BUSBAR kini 2 tahap (Fabrikasi/Plating, tanpa Pasang): isian PASANG 0 dibuang, gabungan dihitung ulang. ' || v_daftar,
    'progress', 'SQL Editor');
end $$;
select p.id, e.key kode, e.value->'progress'->>'BUSBAR' gabungan, e.value->'progressByDate'->'BUSBAR' per_tanggal, e.value->'busbarTahap' tahap
from public.panels p, jsonb_each(p.checklist) e
where p.tipe = 'BUSBAR' and jsonb_typeof(e.value->'busbarTahap') = 'object';
-- 20 Okt: panel 546 H-BUS gabungan 100, tahap hanya FABRIKASI & PLATING
commit;


-- ── BAGIAN 3: ROLLBACK (kembalikan entri batang dari cadangan) ──────────────────────────────
-- Catatan: kalau trigger juga di-rollback, jalankan BAGIAN 3 ini DULU (isian PASANG kembali sebelum trigger 3 tahap aktif).
-- begin;
-- update public.panels p set checklist = jsonb_set(p.checklist, array[b.kode], b.entri)
-- from (select distinct on (panel_id, kode) panel_id, kode, entri from public._backup_busbar_2tahap_20261020 order by panel_id, kode, disimpan_pada) b
-- where p.id = b.panel_id;
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'KOREKSI PROGRESS BUSBAR', 'Rollback jenis BUSBAR 2 tahap (dari _backup_busbar_2tahap_20261020).', 'progress', 'SQL Editor');
-- commit;
