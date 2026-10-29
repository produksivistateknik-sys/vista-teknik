-- ROLLBACK 20261029010000_ubah_jadwal_multi_v1 (B3 Raw Schedule per WP).
-- Menghapus kedua fungsi. Tidak ada tabel/kolom/trigger/RLS yang perlu dikembalikan.
-- Catatan: snapshot Undo yang masih di memori tab terbuka tidak bisa dipakai lagi setelah ini (tombol Batalkan akan gagal
-- dgn pesan "function ... does not exist"); jadwal & renhar yang sudah tersimpan TIDAK berubah.
-- pindah_multi_sel_v2 / pulihkan_multi_sel_v2 TIDAK disentuh.
begin;
drop function if exists public.ubah_jadwal_multi_v1(jsonb, jsonb, text, text);
drop function if exists public.pulihkan_ubah_jadwal_v1(jsonb, text);
-- verifikasi: harus 0 baris
select proname from pg_proc where proname in ('ubah_jadwal_multi_v1', 'pulihkan_ubah_jadwal_v1');
commit;
