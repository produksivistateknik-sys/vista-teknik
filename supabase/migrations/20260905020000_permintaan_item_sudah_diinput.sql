-- Checklist manual "Sudah Diinput" di Riwayat Gudang (5 Sep 2026) - penanda internal MURNI
-- (gak terhubung sistem/proses lain apa pun) bahwa transaksi ini sudah dicatat gudang ke
-- pembukuan/laporan di luar sistem (mis. Excel manual). Per-ITEM (bukan per-permintaan), sama
-- pola kolom sudah_diambil yang sudah ada.
alter table public.permintaan_item add column if not exists sudah_diinput boolean not null default false;
