-- FITUR (16 Agu 2026): kolom "tipe"/spesifikasi di komponen_bbmb_master (kolom B
-- di file upload database barang.xlsx, mis. "SEGI 6" buat "BAUT 10X100 KUNCI").
-- "satuan" TIDAK dihapus (tabel kosong jadi aman kalau mau, tapi gak ada alasan
-- destruktif buat sekadar field yang gak dipakai lagi) - cukup gak dibaca/ditulis
-- lagi dari kode upload/manual-add (satuan sudah pindah jadi input manual operator
-- di form Permintaan, lihat migration 20260814020000).

ALTER TABLE "public"."komponen_bbmb_master" ADD COLUMN IF NOT EXISTS "tipe" text;
