-- ROLLBACK 20261018020000_tambah_foto_dokumentasi: hapus RPC. Foto yang SUDAH ditempel lewat RPC tetap ada (data biasa).
-- Jalankan HANYA setelah vista-pekerja versi antrean foto ditarik dari main - tanpa RPC, antrean foto gagal menempel
-- (foto tetap di antrean HP, tidak hilang).
begin;
drop function if exists public.tambah_foto_dokumentasi(text, bigint, text, jsonb, text, boolean);
commit;
