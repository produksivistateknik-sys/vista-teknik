-- KOREKSI TIMER DOBEL panel 544 PANEL Y D PRESS 1&2 EXPANDER, FS.4 WIRING POWER, 22 Okt 2026 (keputusan user)
-- Kronologi (bukti DB): 08:32 WIB RIFKI(50)+FAHRI(51) mulai (26049, 26050, tanggal 22) -> 08:49 MUIS pindah jadwal
-- FS.4 22->24 Okt (renhar hari ini ikut geser, kartu hari ini hilang dari HP) -> 10:30 timer RIFKI 26049 berhenti,
-- timer FAHRI 26050 TIDAK ikut berhenti -> 10:31 keduanya mulai lagi dari kartu 21 Okt (26169, 26170, tanggal 21).
-- Akibat: FAHRI dua timer berjalan sejak 10:31 (jam dobel); kerja hari ini tercatat di tanggal 21.
-- Perbaikan:
--   A. Tutup 26050 FAHRI tepat saat dia mulai 26170 (10:31:40 WIB) -> jam tidak dobel. Bisa dijalankan SEKARANG.
--   B. 26169/26170: kerja HARI INI -> tanggal 21 diganti 22. JANGAN saat timer masih berjalan (operator
--      menghentikannya dari kartu 21 Okt; kalau tanggalnya diganti dulu, tombol Selesai di kartu itu tidak menemukannya).
--      B1 = setelah RIFKI & FAHRI menekan Selesai (pilihan utama). B2 = kalau mereka sudah berhenti bekerja tapi tidak
--      bisa menekan Selesai: tutup di jam yang Anda isi, sekaligus ganti tanggal.
-- durasi_menit = selisih menit 2 desimal (sama dgn aplikasi, mis. 26049: 118.44).
-- Jalankan per blok: dry-run -> eksekusi -> verifikasi. Rollback di akhir.

-- (0) DRY-RUN (baca saja). Harapan: 26049 selesai; 26050, 26169, 26170 selesai = null.
select t.id, p.nama, t.tanggal, t.mulai, t.selesai, t.durasi_menit
from public.fcs_timer_kerja t join public.pekerja p on p.id = t.pekerja_id
where t.id in (26049, 26050, 26169, 26170) order by t.id;

-- (A) EKSEKUSI: tutup 26050 di jam mulai 26170 (hanya bila 26050 masih berjalan & 26170 milik FAHRI)
begin;
update public.fcs_timer_kerja t
   set selesai = s.mulai,
       durasi_menit = round((extract(epoch from (s.mulai - t.mulai)) / 60.0)::numeric, 2)
  from public.fcs_timer_kerja s
 where t.id = 26050 and t.selesai is null and t.pekerja_id = 51
   and s.id = 26170 and s.pekerja_id = 51 and s.mulai > t.mulai;
-- harus tepat 1 baris berubah; kalau 0 -> sudah tidak berjalan / data berubah: ROLLBACK lalu kabari Claude
select id, selesai, durasi_menit from public.fcs_timer_kerja where id = 26050;  -- harapan selesai 2026-10-22 03:31:40.415+00, durasi ~119.2
commit;

-- (B1) EKSEKUSI SETELAH RIFKI & FAHRI MENEKAN SELESAI: ganti tanggal 21 -> 22 (hanya baris yang sudah selesai)
-- begin;
-- update public.fcs_timer_kerja set tanggal = date '2026-10-22'
--  where id in (26169, 26170) and tanggal = date '2026-10-21' and selesai is not null
--    and (mulai at time zone 'Asia/Jakarta')::date = date '2026-10-22';
-- select id, pekerja_id, tanggal, mulai, selesai, durasi_menit from public.fcs_timer_kerja where id in (26169, 26170);
-- commit;

-- (B2) ALTERNATIF bila mereka sudah berhenti tapi tidak bisa menekan Selesai: isi JAM_SELESAI (WIB) lalu jalankan.
-- begin;
-- update public.fcs_timer_kerja
--    set selesai = timestamp '2026-10-22 JAM_SELESAI' at time zone 'Asia/Jakarta',
--        durasi_menit = round((extract(epoch from ((timestamp '2026-10-22 JAM_SELESAI' at time zone 'Asia/Jakarta') - mulai)) / 60.0)::numeric, 2),
--        tanggal = date '2026-10-22'
--  where id in (26169, 26170) and selesai is null and tanggal = date '2026-10-21';
-- select id, pekerja_id, tanggal, mulai, selesai, durasi_menit from public.fcs_timer_kerja where id in (26169, 26170);
-- commit;

-- (V) VERIFIKASI. Harapan: tidak ada pekerja dgn >1 timer berjalan; FAHRI tidak overlap hari ini.
select pekerja_id, count(*) as timer_berjalan from public.fcs_timer_kerja where selesai is null group by pekerja_id having count(*) > 1;
select a.id, b.id as overlap_dengan from public.fcs_timer_kerja a join public.fcs_timer_kerja b
  on a.pekerja_id = b.pekerja_id and a.id < b.id and a.mulai < coalesce(b.selesai, now()) and b.mulai < coalesce(a.selesai, now())
 where a.pekerja_id in (50, 51) and (a.mulai at time zone 'Asia/Jakarta')::date = date '2026-10-22';

-- (R) ROLLBACK
-- A : update public.fcs_timer_kerja set selesai = null, durasi_menit = null where id = 26050;
--     (hanya bila tidak ada timer FAHRI lain yang berjalan utk komponen yg sama & tanggal 22 - indeks satu_aktif)
-- B1: update public.fcs_timer_kerja set tanggal = date '2026-10-21' where id in (26169, 26170);
-- B2: update public.fcs_timer_kerja set selesai = null, durasi_menit = null, tanggal = date '2026-10-21' where id in (26169, 26170);
