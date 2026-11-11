-- KOREKSI PORSI SEL RAW SCHEDULE - QTY NAIK TERTIMPA + PORSI > QTY (lapis 4, 11 Nov 2026)
-- Disetujui user: kelompok A (31 sel tertimpa, porsi = porsi sekarang + qty lama) + C (4 sel porsi > qty akibat pindah jadwal 9 Nov -> porsi = qty).
-- SIAP JALAN: Run sekali, di luar jam kerja. Satu blok; bila SATU sel saja sudah berubah sejak daftar dibuat
-- (wp/komponen/porsi beda, ada jejak digeserKe, baris dihapus) -> SEMUA dibatalkan, tidak ada yang berubah.
-- Hanya mengubah raw_schedule.schedule[tanggal][idx].qtyPerKomponen[kode] di 11 baris. Progres/checklist/renhar TIDAK disentuh.
-- Cadangan: public.cadangan_porsi_qty_naik_20261111 (schedule sebelum). Rollback: file 20261111_koreksi_porsi_qty_naik_ROLLBACK.sql.
-- Dibuat dari data live 2026-11-11T06:36:16.868Z (35/35 cocok saat dibuat).

do $$
declare
  t record; n int := 0; v jsonb;
begin
  create table if not exists public.cadangan_porsi_qty_naik_20261111 (raw_id bigint primary key, schedule jsonb not null, dicadangkan_pada timestamptz not null default now());
  alter table public.cadangan_porsi_qty_naik_20261111 enable row level security;
  revoke all on public.cadangan_porsi_qty_naik_20261111 from anon, authenticated;
  insert into public.cadangan_porsi_qty_naik_20261111 (raw_id, schedule)
    select id, schedule from public.raw_schedule where id in (7758,7771,7789,7795,7796,7797,7808,7809,7812,7813,7815) on conflict (raw_id) do nothing;

  for t in select * from (values
    (7789, '2026-11-12', 1, 'WP2', 'WM.4', 1, 2, 'A'), -- 596 PANEL SDP-LANTAI 2 PASANG KOMPONEN (qty 2) | 11-09 14:47 LUTVAN 1->2
    (7808, '2026-11-14', 0, 'WP4', 'FS.34', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 POTONG (qty 2) | 11-10 20:00 MUIS 1->2
    (7809, '2026-11-14', 0, 'WP4', 'FS.34', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 BENDING (qty 2) | 11-10 20:00 MUIS 1->2
    (7812, '2026-11-11', 1, 'WP2', 'FS.13', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 RENDAM (qty 2) | 11-10 20:00 MUIS 1->2
    (7812, '2026-11-11', 1, 'WP2', 'FS.15', 2, 3, 'A'), -- 598 PANEL SDP - LANTAI 1 RENDAM (qty 3) | 11-10 20:00 MUIS 1->3
    (7812, '2026-11-12', 1, 'WP3', 'FS.29', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 RENDAM (qty 2) | 11-10 20:00 MUIS 1->2
    (7812, '2026-11-12', 1, 'WP3', 'FS.30', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 RENDAM (qty 2) | 11-10 20:00 MUIS 1->2
    (7812, '2026-11-16', 0, 'WP4', 'FS.34', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 RENDAM (qty 2) | 11-10 20:00 MUIS 1->2
    (7813, '2026-11-11', 0, 'WP1', 'FS.1', 3, 4, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 4) | 11-10 20:00 MUIS 1->4
    (7813, '2026-11-11', 0, 'WP1', 'FS.2', 3, 4, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 4) | 11-10 20:00 MUIS 1->4
    (7813, '2026-11-11', 0, 'WP1', 'FS.3', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 2) | 11-10 20:00 MUIS 1->2
    (7813, '2026-11-11', 0, 'WP1', 'FS.9', 3, 4, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 4) | 11-10 20:00 MUIS 1->4
    (7813, '2026-11-13', 0, 'WP3', 'FS.29', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 2) | 11-10 20:00 MUIS 1->2
    (7813, '2026-11-13', 0, 'WP3', 'FS.30', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 2) | 11-10 20:00 MUIS 1->2
    (7813, '2026-11-16', 0, 'WP4', 'FS.34', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 PAINTING (qty 2) | 11-10 20:00 MUIS 1->2
    (7815, '2026-11-13', 0, 'WP2', 'FS.13', 1, 2, 'A'), -- 598 PANEL SDP - LANTAI 1 PASANG KOMPONEN (qty 2) | 11-10 20:00 MUIS 1->2
    (7795, '2026-11-11', 0, 'WP1', 'FS.3', 5, 6, 'A'), -- 597 PANEL LVMDP POTONG (qty 6) | 11-10 20:03 EDO 1->6
    (7795, '2026-11-11', 0, 'WP1', 'FS.4', 3, 4, 'A'), -- 597 PANEL LVMDP POTONG (qty 4) | 11-10 20:03 EDO 1->4
    (7795, '2026-11-11', 0, 'WP1', 'FS.6', 2, 3, 'A'), -- 597 PANEL LVMDP POTONG (qty 3) | 11-10 20:03 EDO 1->3
    (7795, '2026-11-11', 0, 'WP1', 'FS.7', 2, 3, 'A'), -- 597 PANEL LVMDP POTONG (qty 3) | 11-10 20:03 EDO 1->3
    (7795, '2026-11-11', 0, 'WP1', 'FS.8', 2, 3, 'A'), -- 597 PANEL LVMDP POTONG (qty 3) | 11-10 20:03 EDO 1->3
    (7795, '2026-11-11', 0, 'WP1', 'FS.9', 9, 10, 'A'), -- 597 PANEL LVMDP POTONG (qty 10) | 11-10 20:03 EDO 1->10
    (7796, '2026-11-11', 0, 'WP1', 'FS.1', 11, 12, 'A'), -- 597 PANEL LVMDP BENDING (qty 12) | 11-10 20:03 EDO 1->12
    (7796, '2026-11-11', 0, 'WP1', 'FS.3', 5, 6, 'A'), -- 597 PANEL LVMDP BENDING (qty 6) | 11-10 20:03 EDO 1->6
    (7796, '2026-11-11', 0, 'WP1', 'FS.4', 3, 4, 'A'), -- 597 PANEL LVMDP BENDING (qty 4) | 11-10 20:03 EDO 1->4
    (7796, '2026-11-11', 0, 'WP1', 'FS.5', 2, 3, 'A'), -- 597 PANEL LVMDP BENDING (qty 3) | 11-10 20:03 EDO 1->3
    (7796, '2026-11-11', 0, 'WP1', 'FS.6', 2, 3, 'A'), -- 597 PANEL LVMDP BENDING (qty 3) | 11-10 20:03 EDO 1->3
    (7796, '2026-11-11', 0, 'WP1', 'FS.7', 2, 3, 'A'), -- 597 PANEL LVMDP BENDING (qty 3) | 11-10 20:03 EDO 1->3
    (7796, '2026-11-11', 0, 'WP1', 'FS.8', 2, 3, 'A'), -- 597 PANEL LVMDP BENDING (qty 3) | 11-10 20:03 EDO 1->3
    (7796, '2026-11-11', 0, 'WP1', 'FS.9', 9, 10, 'A'), -- 597 PANEL LVMDP BENDING (qty 10) | 11-10 20:03 EDO 1->10
    (7797, '2026-11-11', 0, 'WP1', 'FS.10', 1, 2, 'A'), -- 597 PANEL LVMDP STEL (qty 2) | 11-10 20:03 EDO 1->2
    (7758, '2026-11-09', 0, 'WP2', 'WM.3', 2, 1, 'C'), -- 594 PANEL SDP - LANTAI ROOFTOP STEL (qty 1) | pindah jadwal 9 Nov, porsi > qty
    (7758, '2026-11-10', 0, 'WP2', 'WM.4', 4, 2, 'C'), -- 594 PANEL SDP - LANTAI ROOFTOP STEL (qty 2) | pindah jadwal 9 Nov, porsi > qty
    (7771, '2026-11-09', 0, 'WP2', 'WM.3', 2, 1, 'C'), -- 595 PANEL PP - LIFT STEL (qty 1) | pindah jadwal 9 Nov, porsi > qty
    (7771, '2026-11-10', 0, 'WP2', 'WM.4', 2, 1, 'C') -- 595 PANEL PP - LIFT STEL (qty 1) | pindah jadwal 9 Nov, porsi > qty
  ) as x(raw_id, tanggal, idx, wp, kode, dari, ke, kel) loop
    select schedule -> t.tanggal -> t.idx into v from public.raw_schedule where id = t.raw_id and deleted_at is null for update;
    if v is null or v->>'wp' is distinct from t.wp or not (v->'komponen') ? t.kode
       or coalesce(v->'digeserKe','{}'::jsonb) ? t.kode
       or (v->'qtyPerKomponen'->>t.kode) is distinct from t.dari::text then
      raise exception 'KOREKSI PORSI DIBATALKAN: raw % % idx % % % tidak cocok (porsi sekarang %, diharapkan %). Tidak ada yang diubah.',
        t.raw_id, t.tanggal, t.idx, t.wp, t.kode, v->'qtyPerKomponen'->>t.kode, t.dari;
    end if;
    update public.raw_schedule
       set schedule = jsonb_set(schedule, array[t.tanggal, t.idx::text, 'qtyPerKomponen', t.kode], to_jsonb(t.ke)), updated_at = now()
     where id = t.raw_id;
    n := n + 1;
  end loop;
  if n <> 35 then raise exception 'KOREKSI PORSI DIBATALKAN: hanya % dari 35 sel', n; end if;
  raise notice 'KOREKSI PORSI OK: % sel diubah', n;
end $$;

-- VERIFIKASI (hasil harus 35 baris, semua cocok = true):
select x.raw_id, x.tanggal, x.wp, x.kode, x.baru as diharapkan, r.schedule -> x.tanggal -> x.idx -> 'qtyPerKomponen' ->> x.kode as sekarang,
       (r.schedule -> x.tanggal -> x.idx -> 'qtyPerKomponen' ->> x.kode) = x.baru::text as cocok
from (values
  (7789, '2026-11-12', 1, 'WP2', 'WM.4', 1, 2),
  (7808, '2026-11-14', 0, 'WP4', 'FS.34', 1, 2),
  (7809, '2026-11-14', 0, 'WP4', 'FS.34', 1, 2),
  (7812, '2026-11-11', 1, 'WP2', 'FS.13', 1, 2),
  (7812, '2026-11-11', 1, 'WP2', 'FS.15', 2, 3),
  (7812, '2026-11-12', 1, 'WP3', 'FS.29', 1, 2),
  (7812, '2026-11-12', 1, 'WP3', 'FS.30', 1, 2),
  (7812, '2026-11-16', 0, 'WP4', 'FS.34', 1, 2),
  (7813, '2026-11-11', 0, 'WP1', 'FS.1', 3, 4),
  (7813, '2026-11-11', 0, 'WP1', 'FS.2', 3, 4),
  (7813, '2026-11-11', 0, 'WP1', 'FS.3', 1, 2),
  (7813, '2026-11-11', 0, 'WP1', 'FS.9', 3, 4),
  (7813, '2026-11-13', 0, 'WP3', 'FS.29', 1, 2),
  (7813, '2026-11-13', 0, 'WP3', 'FS.30', 1, 2),
  (7813, '2026-11-16', 0, 'WP4', 'FS.34', 1, 2),
  (7815, '2026-11-13', 0, 'WP2', 'FS.13', 1, 2),
  (7795, '2026-11-11', 0, 'WP1', 'FS.3', 5, 6),
  (7795, '2026-11-11', 0, 'WP1', 'FS.4', 3, 4),
  (7795, '2026-11-11', 0, 'WP1', 'FS.6', 2, 3),
  (7795, '2026-11-11', 0, 'WP1', 'FS.7', 2, 3),
  (7795, '2026-11-11', 0, 'WP1', 'FS.8', 2, 3),
  (7795, '2026-11-11', 0, 'WP1', 'FS.9', 9, 10),
  (7796, '2026-11-11', 0, 'WP1', 'FS.1', 11, 12),
  (7796, '2026-11-11', 0, 'WP1', 'FS.3', 5, 6),
  (7796, '2026-11-11', 0, 'WP1', 'FS.4', 3, 4),
  (7796, '2026-11-11', 0, 'WP1', 'FS.5', 2, 3),
  (7796, '2026-11-11', 0, 'WP1', 'FS.6', 2, 3),
  (7796, '2026-11-11', 0, 'WP1', 'FS.7', 2, 3),
  (7796, '2026-11-11', 0, 'WP1', 'FS.8', 2, 3),
  (7796, '2026-11-11', 0, 'WP1', 'FS.9', 9, 10),
  (7797, '2026-11-11', 0, 'WP1', 'FS.10', 1, 2),
  (7758, '2026-11-09', 0, 'WP2', 'WM.3', 2, 1),
  (7758, '2026-11-10', 0, 'WP2', 'WM.4', 4, 2),
  (7771, '2026-11-09', 0, 'WP2', 'WM.3', 2, 1),
  (7771, '2026-11-10', 0, 'WP2', 'WM.4', 2, 1)
) as x(raw_id, tanggal, idx, wp, kode, lama, baru) join public.raw_schedule r on r.id = x.raw_id order by cocok, x.raw_id, x.tanggal, x.kode;
