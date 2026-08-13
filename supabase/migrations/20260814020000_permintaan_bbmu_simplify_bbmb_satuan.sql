-- FIX (14 Agu 2026): 2 perubahan skema untuk fitur Permintaan Barang (BBMB/BBMU),
-- murni ALTER TABLE ADD COLUMN - tidak ada DROP/recreate, semua tabel masih 0 baris
-- (fitur belum dipakai produksi) jadi aman tanpa migrasi data.
--
-- 1. permintaan_item.satuan - field satuan bebas (pcs/meter/roll/dus) khusus BBMB,
--    ditambahkan operator saat pilih komponen.
-- 2. permintaan.catatan + permintaan.status - BBMU disederhanakan jadi CUMA 1 row di
--    permintaan header per submit (catatan bebas, status tersedia/belum_lengkap/
--    belum_datang), TIDAK LAGI pakai permintaan_item sama sekali. permintaan_item
--    sekarang eksklusif buat jenis='BBMB'.

ALTER TABLE "public"."permintaan_item" ADD COLUMN IF NOT EXISTS "satuan" text;
ALTER TABLE "public"."permintaan" ADD COLUMN IF NOT EXISTS "catatan" text;
ALTER TABLE "public"."permintaan" ADD COLUMN IF NOT EXISTS "status" text;
