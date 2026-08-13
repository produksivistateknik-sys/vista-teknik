-- Fitur baru: Login "Gudang" (vista-pekerja, full mobile, 5 tab) - tab "Tarik" butuh
-- penanda per-item apakah barang yang sudah disiapkan/tersedia sudah benar-benar diambil
-- fisik oleh operator peminta. Tabel permintaan/permintaan_item/komponen_bbmb_master
-- sendiri sudah ada (dari fitur Permintaan Barang vista-teknik sebelumnya, masih 0 baris)
-- - migration ini murni nambah 1 kolom, gak ada DROP/recreate apapun.

ALTER TABLE "public"."permintaan_item" ADD COLUMN IF NOT EXISTS "sudah_diambil" boolean NOT NULL DEFAULT false;
