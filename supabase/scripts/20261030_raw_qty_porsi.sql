-- PEMBERSIHAN PORSI QTY RAW SCHEDULE (30 Okt 2026) - DIBUAT OTOMATIS 2026-10-30T04:14:32.418Z oleh
-- supabase/scripts/raw_qty_porsi_buat_sql.mjs dari data live. SIAP JALAN: Run sekali. Satu transaksi.
-- 127 pasangan (komponen, proses) total terjadwal > qty; 111 entri pindahan diisi kembali porsinya
-- (22 baris raw_schedule); 16 pasangan TIDAK diubah (lihat daftar di bawah, perlu keputusan planner).
-- Setiap UPDATE dijaga: hanya berlaku bila entri di tanggal/indeks itu masih wp sama, masih memuat kode itu & masih TANPA porsi.
-- Entri yang sudah berubah sejak skrip dibuat dilewati otomatis (tidak menimpa editan planner). Tidak ada entri yang dihapus.
-- Cadangan: tabel cadangan_raw_qty_porsi_20261030 (schedule sebelum). Rollback: lihat bagian paling bawah.
begin;
create table if not exists public.cadangan_raw_qty_porsi_20261030 (raw_id bigint primary key, schedule jsonb not null, dicadangkan_pada timestamptz not null default now());
alter table public.cadangan_raw_qty_porsi_20261030 enable row level security;
revoke all on public.cadangan_raw_qty_porsi_20261030 from anon, authenticated;
insert into public.cadangan_raw_qty_porsi_20261030 (raw_id, schedule)
  select id, schedule from public.raw_schedule where id in (7538,7539,7542,7543,7544,7553,7555,7556,7557,7564,7565,7568,7569,7570,7577,7603,7604,7605,7607,7608,7609,7610) on conflict (raw_id) do nothing;

create temp table _hasil (raw_id bigint, tanggal text, kode text, porsi int, berlaku boolean) on commit drop;
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 1)), updated_at = now()
  where id = 7538 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7538, '2026-10-30', 'FS.34', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON POTONG FS.34 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 1)), updated_at = now()
  where id = 7539 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7539, '2026-10-30', 'FS.34', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON BENDING FS.34 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 3)), updated_at = now()
  where id = 7542 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7542, '2026-10-30', 'FS.27', 3, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RENDAM FS.27 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 1)), updated_at = now()
  where id = 7542 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7542, '2026-10-30', 'FS.28', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RENDAM FS.28 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7542 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7542, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RENDAM FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 1)), updated_at = now()
  where id = 7542 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7542, '2026-10-30', 'FS.34', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RENDAM FS.34 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 3)), updated_at = now()
  where id = 7543 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7543, '2026-10-30', 'FS.27', 3, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON PAINTING FS.27 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 1)), updated_at = now()
  where id = 7543 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7543, '2026-10-30', 'FS.28', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON PAINTING FS.28 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7543 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7543, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON PAINTING FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 1)), updated_at = now()
  where id = 7543 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7543, '2026-10-30', 'FS.34', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON PAINTING FS.34 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 5)), updated_at = now()
  where id = 7544 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7544, '2026-10-30', 'FS.14', 5, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RAKIT FS.14 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.19', 1)), updated_at = now()
  where id = 7544 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.19'
  returning id) insert into _hasil select 7544, '2026-10-30', 'FS.19', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RAKIT FS.19 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 3)), updated_at = now()
  where id = 7544 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7544, '2026-10-30', 'FS.27', 3, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RAKIT FS.27 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 1)), updated_at = now()
  where id = 7544 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7544, '2026-10-30', 'FS.28', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RAKIT FS.28 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7544 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7544, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RAKIT FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 1)), updated_at = now()
  where id = 7544 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7544, '2026-10-30', 'FS.34', 1, exists (select 1 from x); -- 085 575 SDP KOMPRESSOR GALLON RAKIT FS.34 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7553 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7553, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA STEL FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.1', 3)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.1'
  returning id) insert into _hasil select 7555, '2026-10-29', 'FS.1', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.1 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.2', 3)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.2'
  returning id) insert into _hasil select 7555, '2026-10-29', 'FS.2', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.2 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.3', 1)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.3'
  returning id) insert into _hasil select 7555, '2026-10-29', 'FS.3', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.3 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.9', 3)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.9'
  returning id) insert into _hasil select 7555, '2026-10-29', 'FS.9', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.9 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 5)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7555, '2026-10-30', 'FS.14', 5, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.14 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 3)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7555, '2026-10-30', 'FS.27', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.27 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 1)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7555, '2026-10-30', 'FS.28', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.28 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7555 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7555, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RENDAM FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.1', 3)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.1'
  returning id) insert into _hasil select 7556, '2026-10-29', 'FS.1', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.1 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.2', 3)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.2'
  returning id) insert into _hasil select 7556, '2026-10-29', 'FS.2', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.2 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.3', 1)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.3'
  returning id) insert into _hasil select 7556, '2026-10-29', 'FS.3', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.3 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.9', 3)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.9'
  returning id) insert into _hasil select 7556, '2026-10-29', 'FS.9', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.9 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 5)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7556, '2026-10-30', 'FS.14', 5, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.14 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.19', 1)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.19'
  returning id) insert into _hasil select 7556, '2026-10-30', 'FS.19', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.19 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 3)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7556, '2026-10-30', 'FS.27', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.27 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 1)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7556, '2026-10-30', 'FS.28', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.28 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7556 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7556, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA PAINTING FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.1', 3)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.1'
  returning id) insert into _hasil select 7557, '2026-10-29', 'FS.1', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.1 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.2', 3)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.2'
  returning id) insert into _hasil select 7557, '2026-10-29', 'FS.2', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.2 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.3', 1)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.3'
  returning id) insert into _hasil select 7557, '2026-10-29', 'FS.3', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.3 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.4', 6)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.4'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.4'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.4'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.4', 6, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.4 (qty 7, terjadwal 8) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.9', 3)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.9'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.9', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.9 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 5)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.14', 5, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.14 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.19', 1)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.19'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.19', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.19 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 3)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.27', 3, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.27 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 1)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.28', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.28 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 1)), updated_at = now()
  where id = 7557 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7557, '2026-10-30', 'FS.29', 1, exists (select 1 from x); -- 085 576 SDP LIGHTING PACKAGING & KOLOWA RAKIT FS.29 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('WM.9', 1)), updated_at = now()
  where id = 7564 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'WM.9'
  returning id) insert into _hasil select 7564, '2026-10-30', 'WM.9', 1, exists (select 1 from x); -- 085 577 SDP LIGHTING LOCAL BIOMASS POTONG WM.9 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('WM.9', 1)), updated_at = now()
  where id = 7565 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'WM.9'
  returning id) insert into _hasil select 7565, '2026-10-30', 'WM.9', 1, exists (select 1 from x); -- 085 577 SDP LIGHTING LOCAL BIOMASS BENDING WM.9 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('WM.9', 1)), updated_at = now()
  where id = 7568 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'WM.9'
  returning id) insert into _hasil select 7568, '2026-10-30', 'WM.9', 1, exists (select 1 from x); -- 085 577 SDP LIGHTING LOCAL BIOMASS RENDAM WM.9 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('WM.9', 1)), updated_at = now()
  where id = 7569 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'WM.9'
  returning id) insert into _hasil select 7569, '2026-10-30', 'WM.9', 1, exists (select 1 from x); -- 085 577 SDP LIGHTING LOCAL BIOMASS PAINTING WM.9 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('WM.5', 1)), updated_at = now()
  where id = 7570 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'WM.5'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'WM.5'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'WM.5'
  returning id) insert into _hasil select 7570, '2026-10-29', 'WM.5', 1, exists (select 1 from x); -- 085 577 SDP LIGHTING LOCAL BIOMASS RAKIT WM.5 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('WM.9', 1)), updated_at = now()
  where id = 7570 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'WM.9'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'WM.9'
  returning id) insert into _hasil select 7570, '2026-10-30', 'WM.9', 1, exists (select 1 from x); -- 085 577 SDP LIGHTING LOCAL BIOMASS RAKIT WM.9 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-31', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-31', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.33', 1)), updated_at = now()
  where id = 7577 and schedule #>> array['2026-10-31', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-31', '3', 'komponen']) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-31', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-31', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.33'
  returning id) insert into _hasil select 7577, '2026-10-31', 'FS.33', 1, exists (select 1 from x); -- 085 578 SDP PREFORM FOR GALON POTONG FS.33 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.33', 5)), updated_at = now()
  where id = 7603 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.33'
  returning id) insert into _hasil select 7603, '2026-10-30', 'FS.33', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK POTONG FS.33 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 7)), updated_at = now()
  where id = 7603 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7603, '2026-10-30', 'FS.34', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK POTONG FS.34 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.33', 5)), updated_at = now()
  where id = 7604 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.33'
  returning id) insert into _hasil select 7604, '2026-10-30', 'FS.33', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK BENDING FS.33 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 7)), updated_at = now()
  where id = 7604 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7604, '2026-10-30', 'FS.34', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK BENDING FS.34 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 3)), updated_at = now()
  where id = 7605 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7605, '2026-10-30', 'FS.29', 3, exists (select 1 from x); -- 084 580 PANEL CAP BANK STEL FS.29 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.2', 11)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.2'
  returning id) insert into _hasil select 7607, '2026-10-29', 'FS.2', 11, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.2 (qty 12, terjadwal 13) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.3', 5)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.3'
  returning id) insert into _hasil select 7607, '2026-10-29', 'FS.3', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.3 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.7', 2)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.7'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.7'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.7'
  returning id) insert into _hasil select 7607, '2026-10-29', 'FS.7', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.7 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.13', 4)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.13'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.13', 4, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.13 (qty 5, terjadwal 6) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 24)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.14', 24, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.14 (qty 25, terjadwal 26) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.15', 19)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.15'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.15'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.15'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.15', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.15 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.20', 2)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.20'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.20'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.20'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.20', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.20 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 19)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.27', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.27 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 14)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.28', 14, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.28 (qty 15, terjadwal 16) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 3)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.29', 3, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.29 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.30', 9)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.30'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.30'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.30'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.30', 9, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.30 (qty 10, terjadwal 11) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.33', 5)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.33'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.33', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.33 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 7)), updated_at = now()
  where id = 7607 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7607, '2026-10-30', 'FS.34', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK RENDAM FS.34 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.2', 11)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.2'
  returning id) insert into _hasil select 7608, '2026-10-29', 'FS.2', 11, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.2 (qty 12, terjadwal 13) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.3', 5)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.3'
  returning id) insert into _hasil select 7608, '2026-10-29', 'FS.3', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.3 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-29', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.7', 2)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-29', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-29', '0', 'komponen']) ? 'FS.7'
    and not coalesce(schedule #> array['2026-10-29', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.7'
    and not coalesce(schedule #> array['2026-10-29', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.7'
  returning id) insert into _hasil select 7608, '2026-10-29', 'FS.7', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.7 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.13', 4)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.13'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.13', 4, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.13 (qty 5, terjadwal 6) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 24)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.14', 24, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.14 (qty 25, terjadwal 26) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.15', 19)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.15'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.15'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.15'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.15', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.15 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.19', 5)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.19'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.19', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.19 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.20', 2)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.20'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.20'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.20'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.20', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.20 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 19)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.27', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.27 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 14)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.28', 14, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.28 (qty 15, terjadwal 16) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 3)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.29', 3, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.29 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.30', 9)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.30'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.30'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.30'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.30', 9, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.30 (qty 10, terjadwal 11) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.33', 5)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.33'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.33', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.33 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 7)), updated_at = now()
  where id = 7608 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7608, '2026-10-30', 'FS.34', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK PAINTING FS.34 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.1', 11)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.1'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.1'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.1', 11, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.1 (qty 12, terjadwal 13) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.2', 11)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.2'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.2'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.2', 11, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.2 (qty 12, terjadwal 13) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.3', 5)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.3'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.3'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.3', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.3 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.4', 7)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.4'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.4'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.4'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.4', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.4 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.5', 2)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.5'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.5'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.5'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.5', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.5 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.6', 2)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.6'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.6'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.6'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.6', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.6 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.7', 2)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.7'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.7'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.7'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.7', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.7 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.9', 11)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.9'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.9'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.9', 11, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.9 (qty 12, terjadwal 13) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.10', 2)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.10'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.10'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.10'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.10', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.10 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.11', 23)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.11'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.11'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.11'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.11', 23, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.11 (qty 24, terjadwal 25) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.12', 7)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.12'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.12'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.12'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.12', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.12 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.13', 4)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.13'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.13', 4, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.13 (qty 5, terjadwal 6) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.14', 24)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.14'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.14'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.14', 24, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.14 (qty 25, terjadwal 26) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.15', 19)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.15'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.15'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.15'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.15', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.15 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.19', 5)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.19'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.19'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.19', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.19 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.20', 2)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.20'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.20'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.20'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.20', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.20 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.21', 1)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.21'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.21'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.21'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.21', 1, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.21 (qty 2, terjadwal 3) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.36', 19)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.36'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.36'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.36'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.36', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.36 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.27', 19)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.27'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.27'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.27', 19, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.27 (qty 20, terjadwal 21) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.28', 14)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.28'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.28'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.28', 14, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.28 (qty 15, terjadwal 16) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.29', 3)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.29'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.29'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.29', 3, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.29 (qty 4, terjadwal 5) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '2', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.30', 9)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '2', 'wp'] = 'WP3'
    and (schedule #> array['2026-10-30', '2', 'komponen']) ? 'FS.30'
    and not coalesce(schedule #> array['2026-10-30', '2', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.30'
    and not coalesce(schedule #> array['2026-10-30', '2', 'digeserKe'], '{}'::jsonb) ? 'FS.30'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.30', 9, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.30 (qty 10, terjadwal 11) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.33', 5)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.33'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.33'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.33', 5, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.33 (qty 6, terjadwal 7) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '3', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.34', 7)), updated_at = now()
  where id = 7609 and schedule #>> array['2026-10-30', '3', 'wp'] = 'WP4'
    and (schedule #> array['2026-10-30', '3', 'komponen']) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.34'
    and not coalesce(schedule #> array['2026-10-30', '3', 'digeserKe'], '{}'::jsonb) ? 'FS.34'
  returning id) insert into _hasil select 7609, '2026-10-30', 'FS.34', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK RAKIT FS.34 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.4', 7)), updated_at = now()
  where id = 7610 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.4'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.4'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.4'
  returning id) insert into _hasil select 7610, '2026-10-30', 'FS.4', 7, exists (select 1 from x); -- 084 580 PANEL CAP BANK PASANG KOMPONEN FS.4 (qty 8, terjadwal 9) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.5', 2)), updated_at = now()
  where id = 7610 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.5'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.5'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.5'
  returning id) insert into _hasil select 7610, '2026-10-30', 'FS.5', 2, exists (select 1 from x); -- 084 580 PANEL CAP BANK PASANG KOMPONEN FS.5 (qty 3, terjadwal 4) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '0', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.11', 23)), updated_at = now()
  where id = 7610 and schedule #>> array['2026-10-30', '0', 'wp'] = 'WP1'
    and (schedule #> array['2026-10-30', '0', 'komponen']) ? 'FS.11'
    and not coalesce(schedule #> array['2026-10-30', '0', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.11'
    and not coalesce(schedule #> array['2026-10-30', '0', 'digeserKe'], '{}'::jsonb) ? 'FS.11'
  returning id) insert into _hasil select 7610, '2026-10-30', 'FS.11', 23, exists (select 1 from x); -- 084 580 PANEL CAP BANK PASANG KOMPONEN FS.11 (qty 24, terjadwal 25) | qty - porsi entri lain
with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array['2026-10-30', '1', 'qtyPerKomponen'],
    coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object('FS.13', 4)), updated_at = now()
  where id = 7610 and schedule #>> array['2026-10-30', '1', 'wp'] = 'WP2'
    and (schedule #> array['2026-10-30', '1', 'komponen']) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'qtyPerKomponen'], '{}'::jsonb) ? 'FS.13'
    and not coalesce(schedule #> array['2026-10-30', '1', 'digeserKe'], '{}'::jsonb) ? 'FS.13'
  returning id) insert into _hasil select 7610, '2026-10-30', 'FS.13', 4, exists (select 1 from x); -- 084 580 PANEL CAP BANK PASANG KOMPONEN FS.13 (qty 5, terjadwal 6) | qty - porsi entri lain

select count(*) filter (where berlaku) as entri_diperbaiki, count(*) filter (where not berlaku) as dilewati_karena_sudah_berubah,
       (select count(*) from public.cadangan_raw_qty_porsi_20261030) as baris_dicadangkan
from _hasil;
commit;

-- TIDAK DIUBAH (16) - entri ganda tanpa petunjuk porsi (mis. dua entri penuh utk qty 1), perlu dicek planner:
--   076 521 PANEL KAPASITOR BANK  14 STEP 1400KVAR POTONG FS.13 (qty 4, terjadwal 8): 10-09 penuh (geser dari 10-08), 10-10 penuh
--   076 521 PANEL KAPASITOR BANK  14 STEP 1400KVAR POTONG FS.30 (qty 6, terjadwal 12): 10-09 penuh (geser dari 10-08), 10-10 penuh
--   076 521 PANEL KAPASITOR BANK  14 STEP 1400KVAR BENDING FS.30 (qty 6, terjadwal 12): 10-10 penuh, 10-12 penuh
--   085 525 SDP FILLING GALLON POTONG FS.1 (qty 4, terjadwal 8): 10-14 penuh (geser dari 10-13), 10-29 penuh
--   085 525 SDP FILLING GALLON FINISHING FS.22 (qty 1, terjadwal 2): 10-31 penuh (geser dari 10-22), 11-02 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.23 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.24 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.25 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.26 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.27 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.28 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.29 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.30 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.31 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   085 525 SDP FILLING GALLON RAKIT FS.32 (qty 1, terjadwal 2): 10-30 penuh, 10-31 penuh
--   095 552 PANEL SPD-PREFORM HANDLING GALON 15L 350BPH RAKIT FS.25 (qty 16, terjadwal 32): 10-24 penuh, 10-27 penuh

-- ROLLBACK (bila perlu, kembalikan schedule baris yang diubah dari cadangan):
-- update public.raw_schedule r set schedule = c.schedule, updated_at = now() from public.cadangan_raw_qty_porsi_20261030 c where r.id = c.raw_id;
