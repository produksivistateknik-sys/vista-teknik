-- FITUR (15 Agu 2026): Notifikasi status permintaan (submit/reject dari Gudang) ke
-- operator. Kolom "dilihat_operator" = flag baca per baris, dipisah dari kolom
-- "status" yang sudah ada - default false (belum dibaca), di-set true oleh sisi
-- operator begitu dia buka tab Riwayat/Permintaan (lihat PermintaanView.tsx).
-- Ditambahkan di KEDUA tabel karena skema BBMB vs BBMU beda level:
-- - BBMB: status per item (permintaan_item.status: pending/submit/reject)
-- - BBMU: status per header (permintaan.status: pending/tersedia/belum_lengkap/belum_datang)
-- Murni ADD COLUMN, tidak ada DROP/recreate - aman tanpa migrasi data.

ALTER TABLE "public"."permintaan_item" ADD COLUMN IF NOT EXISTS "dilihat_operator" boolean NOT NULL DEFAULT false;
ALTER TABLE "public"."permintaan" ADD COLUMN IF NOT EXISTS "dilihat_operator" boolean NOT NULL DEFAULT false;
