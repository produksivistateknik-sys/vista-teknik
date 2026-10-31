-- ROLLBACK 20261031030000_laporan_outstanding_bersama. Rollback APLIKASI dulu (kembali ke versi localStorage) sebelum ini.
-- Bagian 1 (bawaan): cabut RPC tulis -> laporan bersama menjadi baca-saja; tabel & datanya TETAP (riwayat permanen).
begin;
drop function if exists public.lo_kembalikan(bigint, jsonb);
drop function if exists public.lo_impor(date, jsonb, jsonb, jsonb);
drop function if exists public.lo_ganti_otomatis(bigint, jsonb, jsonb, jsonb);
drop function if exists public.lo_ubah_header(bigint, jsonb, int, jsonb);
drop function if exists public.lo_simpan(bigint, jsonb, jsonb);
drop function if exists public.lo_buat(date, jsonb, jsonb, jsonb, boolean);
select count(*) as sisa_rpc_tulis from pg_proc where proname in ('lo_buat','lo_simpan','lo_ubah_header','lo_ganti_otomatis','lo_impor','lo_kembalikan');
commit;

-- Bagian 2 (OPSIONAL, menghapus SEMUA data laporan bersama & riwayatnya - hanya bila yakin; jalankan terpisah):
-- begin;
-- drop table public.laporan_outstanding_riwayat, public.laporan_outstanding_bagian, public.laporan_outstanding cascade;
-- drop function if exists public.lo_aktor(jsonb), public.lo_konteks(text, boolean, text), public.lo_ringkas(text, jsonb),
--   public.lo_sisip_bagian(bigint, jsonb, text), public.lo_bagian_catat(), public.lo_header_catat(), public.lo_tolak_ubah();
-- commit;
