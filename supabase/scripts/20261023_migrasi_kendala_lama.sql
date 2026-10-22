-- MIGRASI CATATAN KENDALA LAMA -> kendala_produksi (23 Okt 2026, keputusan user: hanya 3 catatan nyata, langsung teratasi).
-- Jalankan SESUDAH migration 20261023020000_kendala_produksi.sql. Sumber: kendala_archived (tabel kendala live 0 baris).
-- 124 baris lama = 8 catatan yang dulu tersalin ke semua panel prosesnya; 5 candaan ("SEMANGAT"/"josjis") TIDAK dipindah.
-- Hasil 4 baris (tanggal & jam asli, sumber 'migrasi', teratasi_oleh 'migrasi (catatan lama)' -> tidak ikut Outstanding):
--  1. RS. TUNAS SUVARNA (Umum)          22 Jul VAIM  - belum bisa dilanjut karena menunggu busbar terpasang
--  2. RS. TUNAS SUVARNA (Umum)          24 Jul RONI  - Menunggu informasi jumlah kabel
--  3. CIMORY CITEUREUP (Umum)           24 Jul RONI  - Menunggu informasi jumlah kabel
--  4. CIMORY CITEUREUP / SDP-KOMPRESSOR 4 Agu  DWI   - Tutup samping (2 PCS)  (panel arsip #277 disebut di teksnya)
-- kendala_archived TIDAK diubah/dihapus (tetap dibaca Gantt Arsip sebagai riwayat).

-- (0) DRY-RUN (baca saja): harap 4 baris calon, dan 0 baris yang sudah dimigrasi.
with calon as (
  select distinct on (k.proyek, k.catatan) k.proyek, k.catatan, k.operator, k.divisi, k.tanggal, k.ts
    from public.kendala_archived k
   where k.catatan in ('belum bisa dilanjut karena menunggu busbar terpasang', 'Menunggu  informasi jumlah kabel')
   order by k.proyek, k.catatan, k.id)
select proyek, null::bigint as panel_id, catatan, operator, tanggal, ts from calon
union all
select k.proyek, k.panel_id, k.catatan, k.operator, k.tanggal, k.ts
  from public.kendala_archived k where k.panel_id = 277 and k.catatan like 'CIMORY SDP-KOMPRESSOR%'
order by ts, proyek;
select count(*) as sudah_dimigrasi from public.kendala_produksi where sumber = 'migrasi';

-- (1) EKSEKUSI
begin;
with calon as (
  select distinct on (k.proyek, k.catatan) k.proyek, null::bigint as panel_id, null::text as panel_nama, k.catatan, k.operator, k.divisi, k.tanggal, k.ts
    from public.kendala_archived k
   where k.catatan in ('belum bisa dilanjut karena menunggu busbar terpasang', 'Menunggu  informasi jumlah kabel')
   order by k.proyek, k.catatan, k.id
), panel_kompres as (
  select k.proyek, k.panel_id, k.panel as panel_nama, k.catatan, k.operator, k.divisi, k.tanggal, k.ts
    from public.kendala_archived k where k.panel_id = 277 and k.catatan like 'CIMORY SDP-KOMPRESSOR%' order by k.id limit 1
), semua as (select * from calon union all select * from panel_kompres),
baru as (
  insert into public.kendala_produksi (proyek, wo_id, wo_number, panel_id, panel_nama, teks, pencatat, divisi, sumber,
                                       dicatat_pada, tanggal, teratasi_pada, teratasi_oleh)
  select s.proyek, pa.wo_id, w.wo, s.panel_id, s.panel_nama, regexp_replace(btrim(s.catatan), '\s+', ' ', 'g'), s.operator, s.divisi, 'migrasi',
         s.ts, s.tanggal, s.ts, 'migrasi (catatan lama)'
    from semua s
    left join public.panels_archived pa on pa.id = s.panel_id
    left join public.work_orders w on w.id = pa.wo_id
   where not exists (select 1 from public.kendala_produksi x where x.sumber = 'migrasi')
  returning *)
insert into public.kendala_produksi_log (kendala_id, aksi, oleh, alasan, sesudah)
select b.id, 'migrasi', 'migrasi (catatan lama)', 'dipindah dari kendala_archived (fitur catatan per tugas operator)', to_jsonb(b) from baru b;
-- Harap 4 baris; bila tidak -> ROLLBACK; (bukan commit) lalu kabari Claude.
select id, proyek, panel_nama, teks, pencatat, tanggal, teratasi_oleh from public.kendala_produksi where sumber = 'migrasi' order by dicatat_pada;
commit;

-- (2) VERIFIKASI: 4 baris migrasi, 4 baris log, 0 yang belum teratasi.
select (select count(*) from public.kendala_produksi where sumber = 'migrasi') as migrasi_4,
       (select count(*) from public.kendala_produksi_log where aksi = 'migrasi') as log_4,
       (select count(*) from public.kendala_produksi where sumber = 'migrasi' and teratasi_pada is null) as belum_teratasi_0;

-- (3) ROLLBACK:
-- begin;
-- delete from public.kendala_produksi_log where aksi = 'migrasi';
-- delete from public.kendala_produksi where sumber = 'migrasi';
-- commit;
