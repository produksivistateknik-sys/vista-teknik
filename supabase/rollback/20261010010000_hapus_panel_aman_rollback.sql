-- ROLLBACK migration 20261010010000_hapus_panel_aman.sql
-- PERHATIAN: aplikasi versi baru (hotfix hapus panel) MEMANGGIL fungsi ini saat Edit WO menghapus panel. Jalankan
-- rollback hanya bersama rollback kode aplikasi; tanpa fungsi ini, simpan Edit WO yang menghapus panel akan GAGAL
-- dengan pesan error (tidak ada data yang terhapus).
drop function if exists public.hapus_panel_aman(bigint[], text, text, text);
