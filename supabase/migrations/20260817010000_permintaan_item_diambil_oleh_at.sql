-- FITUR (17 Agu 2026): Konfirmasi pengambilan komponen pindah dari sisi Gudang ke
-- sisi OPERATOR (BBMB saja - BBMU gak punya konsep ini, statusnya cukup di header
-- permintaan tanpa tahap fisik terpisah). sudah_diambil sudah ada (migration lama);
-- diambil_oleh/diambil_at BARU, terpisah dari updated_by/updated_at (yang tetap
-- berarti "terakhir disentuh Gudang" - submit/reject) supaya event "operator
-- konfirmasi ambil" gak nyampur/menimpa jejak aksi Gudang.

ALTER TABLE "public"."permintaan_item" ADD COLUMN IF NOT EXISTS "diambil_oleh" text;
ALTER TABLE "public"."permintaan_item" ADD COLUMN IF NOT EXISTS "diambil_at" timestamptz;
