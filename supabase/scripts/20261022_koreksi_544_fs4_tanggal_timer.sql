-- KOREKSI TANGGAL TIMER 26169 (RIFKI) & 26170 (FAHRI) - panel 544 PANEL Y D PRESS 1&2 EXPANDER, FS.4 WIRING POWER
-- (blok B1 skrip 20261022_koreksi_544_fs4_timer_dobel.sql, dijadikan skrip sendiri atas permintaan user 22 Okt 2026;
-- pemantau otomatis DIHENTIKAN sebelum mengubah apa pun).
-- Kedua timer dimulai 22 Okt 10:31:40 WIB dari kartu 21 Okt (jadwal hari ini sudah dipindah ke 24 Okt), jadi tercatat
-- bertanggal 21 Okt padahal kerjanya 22 Okt. Koreksi: tanggal 21 -> 22.
-- SYARAT: JALANKAN SETELAH RIFKI & FAHRI MENEKAN SELESAI (kolom selesai terisi). Kalau tanggal diganti saat timer masih
-- berjalan, tombol Selesai di kartu 21 Okt tidak menemukannya lagi.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).

-- (0) DRY-RUN (baca saja) - NILAI SEBELUM. Harapan: 2 baris, tanggal 2026-10-21, selesai TERISI, mulai 2026-10-22 03:31:40 UTC.
--     Kalau selesai masih null -> BERHENTI, tunggu mereka menekan Selesai.
select id, pekerja_id, tanggal, mulai, selesai, durasi_menit,
       (mulai at time zone 'Asia/Jakarta')::date as tanggal_mulai_wib,
       case when selesai is null then 'MASIH BERJALAN - JANGAN DIJALANKAN' else 'siap' end as status
from public.fcs_timer_kerja where id in (26169, 26170) order by id;

-- (1) EKSEKUSI - satu transaksi: catat nilai sebelum ke activity_log, ubah, tampilkan nilai sesudah.
begin;
insert into public.activity_log (user_name, action, description, module, halaman)
select 'Admin (SQL koreksi 544 FS.4)', 'KOREKSI TANGGAL TIMER',
       'Timer ' || string_agg(format('%s (pekerja %s, mulai %s, selesai %s): tanggal %s -> 2026-10-22', id, pekerja_id, mulai, selesai, tanggal), '; ' order by id)
       || ' - dimulai 22 Okt dari kartu 21 Okt (jadwal 544 FS.4 dipindah ke 24 Okt), keputusan user 22 Okt',
       'produksi', 'Admin'
from public.fcs_timer_kerja
where id in (26169, 26170) and tanggal = date '2026-10-21' and selesai is not null
  and (mulai at time zone 'Asia/Jakarta')::date = date '2026-10-22';
update public.fcs_timer_kerja set tanggal = date '2026-10-22'
 where id in (26169, 26170) and tanggal = date '2026-10-21' and selesai is not null
   and (mulai at time zone 'Asia/Jakarta')::date = date '2026-10-22';
-- NILAI SESUDAH: harus 2 baris bertanggal 2026-10-22. Kalau kurang dari 2 -> ROLLBACK; (bukan commit) lalu kabari Claude.
select id, pekerja_id, tanggal, mulai, selesai, durasi_menit from public.fcs_timer_kerja where id in (26169, 26170) order by id;
commit;

-- (2) VERIFIKASI
--  a. kedua timer bertanggal 22 Okt & durasi tidak berubah (durasi_menit dihitung dari mulai/selesai, bukan tanggal)
select id, tanggal, durasi_menit from public.fcs_timer_kerja where id in (26169, 26170) order by id;
--  b. jejak log tercatat (1 baris)
select created_at, user_name, action, description from public.activity_log
 where action = 'KOREKSI TANGGAL TIMER' and description like '%26169%' order by created_at desc limit 1;
--  c. tidak ada sesi RIFKI/FAHRI hari ini yang tumpang tindih (harap 0 baris)
select a.id, b.id as overlap_dengan from public.fcs_timer_kerja a join public.fcs_timer_kerja b
  on a.pekerja_id = b.pekerja_id and a.id < b.id and a.mulai < coalesce(b.selesai, now()) and b.mulai < coalesce(a.selesai, now())
 where a.pekerja_id in (50, 51) and (a.mulai at time zone 'Asia/Jakarta')::date = date '2026-10-22';

-- (3) ROLLBACK (bila keliru) - kembalikan tanggal & catat:
-- begin;
-- update public.fcs_timer_kerja set tanggal = date '2026-10-21' where id in (26169, 26170) and tanggal = date '2026-10-22';
-- insert into public.activity_log (user_name, action, description, module, halaman)
--   values ('Admin (SQL koreksi 544 FS.4)', 'KOREKSI TANGGAL TIMER', 'ROLLBACK: timer 26169, 26170 tanggal 2026-10-22 -> 2026-10-21', 'produksi', 'Admin');
-- commit;
