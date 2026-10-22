-- KOREKSI FS.4 panel 534 PANEL MCC COOLING TOWER, WIRING CONTROL, 22 Okt 2026 (keputusan user)
-- IFAL (pekerja 62) salah pilih -> timer IFAL hari ini DIBATALKAN (dipindah ke fcs_timer_kerja_batal, bisa dipulihkan).
-- Prasyarat: migration 20261022050000_timer_batal.sql sudah dijalankan & verifikasinya 'SEMUA LULUS'.
-- Jalankan berurutan: (1) dry-run -> (2) eksekusi -> (3) verifikasi. Rollback di (4).

-- (1) DRY-RUN (baca saja). Harapan: 1 baris id 26043 IFAL, mulai 2026-10-22 01:22:24 UTC (08:22 WIB).
--     Kalau IFAL sudah menekan Selesai, kolom selesai terisi - tetap dibatalkan (durasinya ikut keluar dari KPI).
select t.id, p.nama as pekerja, t.tanggal, t.mulai, t.selesai, t.durasi_menit
from public.fcs_timer_kerja t join public.pekerja p on p.id = t.pekerja_id
where t.panel_id = 534 and t.kode_komponen = 'FS.4' and t.proses = 'WIRING CONTROL' and t.tanggal = date '2026-10-22'
order by t.id;

-- (2) EKSEKUSI - hanya timer IFAL bertanggal 22 Okt (id dari dry-run; dicek ulang di dalam)
select public.batalkan_timer_salah_pilih(
  (select array_agg(t.id) from public.fcs_timer_kerja t
    where t.panel_id = 534 and t.kode_komponen = 'FS.4' and t.proses = 'WIRING CONTROL' and t.tanggal = date '2026-10-22' and t.pekerja_id = 62),
  'Salah pilih operator: IFAL tidak mengerjakan FS.4 WIRING CONTROL 22 Okt (keputusan user, investigasi 22 Okt)',
  'Admin (SQL koreksi FS.4)', 'admin');

-- (3) VERIFIKASI. Harapan: (a) 0 baris IFAL di fcs_timer_kerja; (b) 1 baris di log batal; (c) FIRMAN tetap ada.
select 'a_timer_ifal_tersisa' as cek, count(*) from public.fcs_timer_kerja
 where panel_id = 534 and kode_komponen = 'FS.4' and proses = 'WIRING CONTROL' and tanggal = date '2026-10-22' and pekerja_id = 62
union all
select 'b_log_batal', count(*) from public.fcs_timer_kerja_batal
 where panel_id = 534 and kode_komponen = 'FS.4' and proses = 'WIRING CONTROL' and tanggal = date '2026-10-22' and pekerja_id = 62 and dipulihkan_at is null
union all
select 'c_timer_firman', count(*) from public.fcs_timer_kerja
 where panel_id = 534 and kode_komponen = 'FS.4' and proses = 'WIRING CONTROL' and tanggal = date '2026-10-22' and pekerja_id = 53;

-- (4) ROLLBACK (bila keliru): pulihkan baris IFAL persis seperti semula (id sama).
-- select public.pulihkan_timer_batal(b.id, 'rollback koreksi FS.4 IFAL', 'Admin (SQL koreksi FS.4)')
-- from public.fcs_timer_kerja_batal b
-- where b.panel_id = 534 and b.kode_komponen = 'FS.4' and b.proses = 'WIRING CONTROL' and b.tanggal = date '2026-10-22' and b.pekerja_id = 62 and b.dipulihkan_at is null;

-- (5) TIMER RAFIK (pekerja 4) - MENUNGGU jam mulai dari user. Akan disiapkan sebagai skrip terpisah dengan
--     dry-run/verifikasi/rollback setelah jamnya diberikan (dan dicek tidak bentrok dengan timer RAFIK lain hari itu).
