-- Fitur "Approval Koreksi Qty diarahkan ke Admin" (13 Sep 2026) - pengajuan koreksi qty dari
-- Gudang sekarang diputuskan Admin (PermintaanAdminTab.tsx tab "Koreksi Qty"), bukan lagi
-- divisi peminta (PermintaanView.tsx vista-pekerja, tab "Koreksi" - DIHAPUS). Reuse pola
-- approval BBMB/BBMU yang sudah ada, termasuk "Tolak wajib isi alasan" - tapi
-- permintaan_item_koreksi (beda dari permintaan_item) BELUM punya kolom buat nyimpen alasan
-- penolakan (desain lama cuma butuh status disetujui/ditolak, gak ada UI alasan tolak sama
-- sekali - lihat migration 20260907010000_permintaan_item_koreksi.sql).
--
-- Kolom baru, nullable, TANPA default - konsisten sama pola catatan_reject di permintaan_item.
-- Tidak ada tabel arsip pasangan buat permintaan_item_koreksi (gak masuk daftar
-- ARSIP-SCHEMA-SYNC.md), jadi gak perlu disinkronkan ke tabel lain.
alter table public.permintaan_item_koreksi
  add column if not exists catatan_reject text;
