-- ROLLBACK migrasi 20261009010000_pindah_multi_sel_v2.sql
-- Hanya menghapus 2 function v2. Fungsi v1 (pindah_multi_sel, pulihkan_multi_sel, _renhar_snap) dan
-- semua tabel/data TIDAK disentuh. Setelah rollback, aplikasi versi v2 akan gagal memindah banyak sel
-- (dgn pesan error); drag 1 sel lama tetap jalan.
drop function if exists public.pulihkan_multi_sel_v2(jsonb, text);
drop function if exists public.pindah_multi_sel_v2(jsonb, jsonb, jsonb, text);
