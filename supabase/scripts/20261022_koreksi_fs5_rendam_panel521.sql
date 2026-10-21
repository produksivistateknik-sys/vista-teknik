-- ============================================================================================
-- BELUM FINAL - JANGAN DIJALANKAN sebelum operator Painting/Rendam MENGONFIRMASI box ke-3 Box Control (FS.5)
-- panel 521 (KAPASITOR BANK 14 STEP 1400KVAR, WO 076 HAS-MANYAR-CAP BANK) memang sudah direndam.
-- Keputusan user 22 Okt 2026: tahan perbaikan data; kerjakan paling akhir.
--
-- Data 21 Okt 2026: RENDAM 2/3 (67%, DWI 7 Okt 21:53 WIB; disimpan ulang 67% hampir tiap hari s.d. 21 Okt),
-- PAINTING 3/3 (RIZKI/SUYANTO/KHOLEL 8 Okt 09:46 WIB), RAKIT 3/3 (17 Okt). Timer RENDAM malam 7-8 Okt +-9 jam.
-- Perbaikan: RENDAM 3/3 per tanggal 8 Okt (hari PAINTING 100%) lewat RPC koreksi_progres_admin - jalur SAMA dgn
-- tombol "Koreksi progres" Admin (checklist progress/qtyProses/progressByDate/qtyProsesByDate/history + CCP RENDAM
-- done 3/3 + jejak awet koreksi_progres_log + activity_log). Alternatif tanpa SQL: Admin Produksi memakai tombol
-- "✎" di Detail Progres (isi tanggal = hari ini; kalau perlu tanggal 8 Okt pakai SQL ini).
-- Prasyarat: migration 20261022010000_kunci_urutan_progres.sql sudah dijalankan.
-- ============================================================================================

-- BAGIAN 0: CADANGAN (checklist FS.5 + CCP RENDAM) - wajib sebelum Bagian 2
create table if not exists public._bak_fs5_521_20261022 as
  select now() as dibackup, p.checklist->'FS.5' as checklist_fs5,
         (select to_jsonb(c) from public.component_process_progress c where c.panel_id = 521 and c.kode_komponen = 'FS.5' and c.proses = 'RENDAM' and c.tahap_key = '') as ccp_rendam
  from public.panels p where p.id = 521;
alter table public._bak_fs5_521_20261022 enable row level security;

-- BAGIAN 1: DRY-RUN (baca saja). Harapan: qty 3, RENDAM 67 / 2, PAINTING 100 / 3, RAKIT 100 / 3, CCP RENDAM in_progress 2/3.
select p.checklist->'FS.5'->>'qty' as qty,
       p.checklist->'FS.5'->'progress'->>'RENDAM' as pct_rendam, p.checklist->'FS.5'->'qtyProses'->>'RENDAM' as qty_rendam,
       p.checklist->'FS.5'->'progress'->>'PAINTING' as pct_painting, p.checklist->'FS.5'->'progress'->>'RAKIT' as pct_rakit,
       (select status || ' ' || qty_done || '/' || qty_total from public.component_process_progress c
         where c.panel_id = 521 and c.kode_komponen = 'FS.5' and c.proses = 'RENDAM' and c.tahap_key = '') as ccp_rendam
from public.panels p where p.id = 521;

-- BAGIAN 2: EKSEKUSI - isi <ALASAN> (sebut siapa yang mengonfirmasi) & <NAMA ADMIN> dulu.
-- select public.koreksi_progres_admin(521, 'FS.5', 'RENDAM', 3,
--   'Box ke-3 sudah direndam 8 Okt (konfirmasi <SIAPA>, <TANGGAL>), operator lupa input', '<NAMA ADMIN>', 'admin', date '2026-10-08');

-- BAGIAN 3: VERIFIKASI. Harapan: pct_rendam 100, qty_rendam 3, CCP done 3/3, ada 1 baris koreksi_progres_log baru,
-- K18 tidak lagi memuat 521:FS.5:RENDAM:PAINTING.
select p.checklist->'FS.5'->'progress'->>'RENDAM' as pct_rendam, p.checklist->'FS.5'->'qtyProses'->>'RENDAM' as qty_rendam,
       p.checklist->'FS.5'->'progressByDate'->'RENDAM' as pbd_rendam,
       (select status || ' ' || qty_done || '/' || qty_total from public.component_process_progress c
         where c.panel_id = 521 and c.kode_komponen = 'FS.5' and c.proses = 'RENDAM' and c.tahap_key = '') as ccp_rendam
from public.panels p where p.id = 521;
select * from public.koreksi_progres_log where panel_id = 521 and kode_komponen = 'FS.5' order by waktu desc limit 3;

-- BAGIAN 4: ROLLBACK (hanya kalau perlu) - kembalikan RENDAM ke 2/3 lewat jalur koreksi yang sama (tercatat juga):
-- select public.koreksi_progres_admin(521, 'FS.5', 'RENDAM', 2, 'Batalkan koreksi FS.5 22 Okt (rollback)', '<NAMA ADMIN>', 'admin', date '2026-10-08');
-- (Rollback lewat UPDATE langsung dari cadangan TIDAK bisa: RENDAM 3->2 dgn PAINTING 3/3 = membuat selisih baru -> ditolak
--  trigger. Jalur koreksi RPC di atas adalah satu-satunya jalan & ikut tercatat. Cadangan Bagian 0 = bukti nilai sebelum.)

-- BAGIAN 5: bersih-bersih setelah yakin: drop table public._bak_fs5_521_20261022;
