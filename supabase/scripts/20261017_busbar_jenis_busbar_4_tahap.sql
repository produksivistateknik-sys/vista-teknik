-- ============================================================================================
-- JENIS PANEL BUSBAR -> tahap busbar SAMA dgn jenis lain (17 Okt 2026 sore, keputusan user:
-- "samakan seperti rules busbar yang kita punya sekarang"). Versi awal jenis BUSBAR cuma kenal tahap
-- FABRIKASI, jadi operator menyimpan persen GABUNGAN = persen FABRIKASI (panel 546 H-BUS: FABRIKASI 100
-- -> BUSBAR 100). Dengan aturan normal (FABRIKASI/PLATING/HEATSHRINK/PASANG; COUPLER, GROUND, COUPLE-AN
-- tanpa HEATSHRINK) gabungan = rata-rata tahap -> H-BUS harus 25.
-- Skrip ini menghitung ulang gabungan SEMUA batang busbar di panel jenis BUSBAR dari checklist[kode].busbarTahap
-- (rumus SAMA PERSIS hitungProgressBusbarGabungan vista-pekerja: rata-rata, bulat 1 desimal) dan menulisnya ke
-- progress.BUSBAR + entri history.BUSBAR terbaru + progressByDate.BUSBAR tanggal terakhir. Data per tahap
-- (busbarTahap & component_process_progress) TIDAK diubah - itu sudah benar. progress_checkpoint_log tidak
-- diubah (riwayat simpan, tidak dipakai sebagai batas bawah progres).
-- Jalankan SETELAH kode admin+operator versi 4 tahap live (branch busbar-tanpa-nameplate). Aman diulang:
-- hanya menyentuh batang yang gabungannya beda dari hasil hitung.
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback.
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
with b as (
  select p.id panel_id, p.nama, e.key kode, e.value v,
         case when e.key in ('COUPLER','GROUND','COUPLE-AN') then array['FABRIKASI','PLATING','PASANG']
              else array['FABRIKASI','PLATING','HEATSHRINK','PASANG'] end urutan
  from public.panels p, jsonb_each(p.checklist) e
  where p.tipe = 'BUSBAR' and jsonb_typeof(e.value->'busbarTahap') = 'object'
)
select panel_id, nama, kode, v->'busbarTahap' tahap, (v->'progress'->>'BUSBAR')::numeric gabungan_sekarang,
       round((select sum(coalesce((v->'busbarTahap'->t->>'progress')::numeric, 0)) from unnest(urutan) t) / cardinality(urutan), 1) gabungan_benar
from b order by panel_id, kode;
-- 17 Okt: harus 1 baris -> panel 546 H-BUS, gabungan_sekarang 100, gabungan_benar 25


-- ── BAGIAN 2: EKSEKUSI ──────────────────────────────────────────────────────────────────────
begin;
create table if not exists public._backup_busbar_gabungan_20261017 (panel_id int, kode text, entri jsonb, disimpan_pada timestamptz default now());
alter table public._backup_busbar_gabungan_20261017 enable row level security;
do $$
declare r record; v_n int := 0; v_baru numeric; v_e jsonb; v_hist jsonb; v_i int; v_tgl text; v_daftar text := '';
begin
  for r in
    select p.id panel_id, p.nama, e.key kode, e.value v,
           case when e.key in ('COUPLER','GROUND','COUPLE-AN') then array['FABRIKASI','PLATING','PASANG']
                else array['FABRIKASI','PLATING','HEATSHRINK','PASANG'] end urutan
    from public.panels p, jsonb_each(p.checklist) e
    where p.tipe = 'BUSBAR' and jsonb_typeof(e.value->'busbarTahap') = 'object'
  loop
    v_baru := round((select sum(coalesce((r.v->'busbarTahap'->t->>'progress')::numeric, 0)) from unnest(r.urutan) t) / cardinality(r.urutan), 1);
    continue when coalesce((r.v->'progress'->>'BUSBAR')::numeric, 0) = v_baru;
    insert into public._backup_busbar_gabungan_20261017 (panel_id, kode, entri) values (r.panel_id, r.kode, r.v);
    v_e := jsonb_set(r.v, '{progress}', coalesce(r.v->'progress', '{}'::jsonb) || jsonb_build_object('BUSBAR', v_baru));
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
  if v_n = 0 then raise notice 'Tidak ada yang perlu dikoreksi.'; return; end if;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'KOREKSI PROGRESS BUSBAR',
    'Jenis panel BUSBAR kini pakai tahap busbar normal (4 tahap / 3 utk COUPLER-GROUND-COUPLE-AN): gabungan dihitung ulang dari tahap. ' || v_daftar,
    'progress', 'SQL Editor');
end $$;
select p.id, e.key kode, e.value->'progress'->>'BUSBAR' gabungan, e.value->'progressByDate'->'BUSBAR' per_tanggal, e.value->'busbarTahap' tahap
from public.panels p, jsonb_each(p.checklist) e
where p.tipe = 'BUSBAR' and jsonb_typeof(e.value->'busbarTahap') = 'object';
-- 17 Okt: panel 546 H-BUS gabungan 25, per_tanggal {"2026-10-17": 25}
commit;


-- ── BAGIAN 3: ROLLBACK (kembalikan entri batang dari cadangan) ──────────────────────────────
-- begin;
-- update public.panels p set checklist = jsonb_set(p.checklist, array[b.kode], b.entri)
-- from (select distinct on (panel_id, kode) panel_id, kode, entri from public._backup_busbar_gabungan_20261017 order by panel_id, kode, disimpan_pada) b
-- where p.id = b.panel_id;
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'KOREKSI PROGRESS BUSBAR', 'Rollback koreksi gabungan busbar jenis BUSBAR (dari _backup_busbar_gabungan_20261017).', 'progress', 'SQL Editor');
-- commit;
