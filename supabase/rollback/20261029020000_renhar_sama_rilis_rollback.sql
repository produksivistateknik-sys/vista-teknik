-- ROLLBACK 20261029020000_renhar_sama_rilis: kembalikan kedua fungsi B3 ke isi 20261029010000_ubah_jadwal_multi_v1.sql.
-- Cara: jalankan ULANG seluruh isi file supabase/migrations/20261029010000_ubah_jadwal_multi_v1.sql di SQL Editor
-- (create or replace - aman dijalankan ulang, grant ikut). Data renhar yang sudah ditulis TIDAK berubah.
-- Verifikasi setelahnya (harus 0 = versi lama, tanpa komponen_released di set_komponen):
select count(*) as versi_baru_masih_aktif from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'ubah_jadwal_multi_v1' and pg_get_functiondef(p.oid) like '%komponen_released = array%';
