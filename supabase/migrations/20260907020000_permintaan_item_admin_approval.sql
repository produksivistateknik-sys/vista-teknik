-- Fitur "Wajib Approval Admin Sebelum Sampai ke Gudang" (7 Sep 2026) - permintaan operator
-- sekarang harus disetujui admin (Vista Teknik) dulu sebelum masuk alur Gudang. Status baru
-- ditambahkan ke kolom permintaan_item.status yang sudah ada (text bebas, TANPA CHECK
-- constraint - tidak perlu migrasi buat nilai baru, konsisten cara kerja kolom ini sejak awal):
--   'menunggu_admin' - default awal saat submit (GANTI dari 'pending' langsung)
--   'pending'        - SETELAH admin setuju (masuk alur Gudang existing TANPA ubah kode sama
--                       sekali - semua query Gudang sudah strict filter status='pending')
--   'ditolak_admin'  - admin tolak di tahap ini - SENGAJA beda dari 'reject' (itu tetap berarti
--                       "Gudang menolak", jangan tertukar/ambigu di data maupun tampilan)
--
-- 2 kolom baru (bukan tabel audit terpisah - ini gerbang SEKALI, beda dari fitur Koreksi Qty
-- yang emang didesain buat riwayat cicilan berkali-kali) - pola sama persis diambil_oleh/
-- diambil_at yang sudah ada, dipakai juga sebagai sumber tanggal buat dot "unread"/kalender
-- Gudang (kapan item BENAR-BENAR baru muncul ke Gudang, bukan kapan operator submit).
alter table public.permintaan_item add column if not exists disetujui_admin_oleh text;
alter table public.permintaan_item add column if not exists disetujui_admin_at timestamptz;
