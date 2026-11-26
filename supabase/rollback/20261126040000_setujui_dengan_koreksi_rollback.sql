-- ROLLBACK Tahap 5 (setujui dengan koreksi). URUTAN: kembalikan aplikasi admin (vista-teknik) ke versi sebelum Tahap 5 DULU
-- (versi lama menulis qty langsung lewat tulisSetujui), baru jalankan ini. Riwayat koreksi admin_saat_setuju DIBIARKAN.
begin;
drop function if exists public.setujui_permintaan_dengan_koreksi(bigint, numeric, numeric, text, text);
notify pgrst, 'reload schema';
commit;
-- Periksa: harus 0 baris
select p.oid::regprocedure from pg_proc p where p.proname = 'setujui_permintaan_dengan_koreksi';
