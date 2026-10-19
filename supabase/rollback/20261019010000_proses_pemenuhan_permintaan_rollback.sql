-- ROLLBACK 20261019010000_proses_pemenuhan_permintaan: hapus RPC. Data yang sudah diproses lewat RPC tetap (data biasa).
-- Jalankan HANYA setelah vista-pekerja versi RPC ditarik dari main - tanpa RPC, tombol konfirmasi Gudang gagal (pesan error).
begin;
drop function if exists public.proses_pemenuhan_permintaan(bigint, numeric, text);
commit;
