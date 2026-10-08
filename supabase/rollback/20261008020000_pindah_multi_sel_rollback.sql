-- ROLLBACK migrasi 20261008020000_pindah_multi_sel.sql
-- Hanya menghapus 3 function yang dibuat migrasi itu. Tidak ada tabel/kolom/trigger/RLS yang
-- dibuat atau diubah migrasi tsb, jadi tidak ada data yang ikut terhapus.
-- Catatan: setelah rollback, fitur multi-pindah di aplikasi akan gagal dgn pesan error (drag 1 sel
-- lama tetap jalan karena tidak memakai function ini).
drop function if exists public.pulihkan_multi_sel(jsonb, text);
drop function if exists public.pindah_multi_sel(jsonb, jsonb, jsonb, text);
drop function if exists public._renhar_snap(bigint);
