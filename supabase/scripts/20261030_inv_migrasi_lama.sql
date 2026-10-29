-- MIGRASI DATA MAINTENANCE LAMA -> inv_* (T1; dijalankan ULANG tepat sebelum go-live - idempoten lewat kolom *_lama).
-- Syarat: migrasi 20261030010000 sudah jalan DAN impor (20261030_inv_impor_awal.sql, p_dry_run=false) sudah jalan.
-- Ganti ISI_USERNAME_ADMIN, jalankan dgn true (dry-run) -> tinjau ringkasan -> ubah ke false -> jalankan lagi.
-- Ringkasan: *_upsert = baris dibuat/diperbarui; lama_tidak_terpetakan harus jadwal 0 / selesai 0 / laporan 0 dan
-- mesin ["MSN-003 JET CLEANER - KRISBOW"] (keputusan user: tidak dipetakan).
select jsonb_pretty(public.inv_migrasi_data_lama(
  true,                                   -- p_dry_run
  '{"admin":"ISI_USERNAME_ADMIN"}'::jsonb));
-- Sesudahnya: bagian C di supabase/verifikasi/20261030010000_inventaris_t1_verifikasi.sql
