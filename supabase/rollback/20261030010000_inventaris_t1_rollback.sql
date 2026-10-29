-- ROLLBACK 20261030010000_inventaris_t1 - HANYA SEBELUM GO-LIVE (setelah go-live tabel inv_* berisi data baru dari
-- admin/operator yang hanya ada di sana). Tabel lama (mesin, maintenance_*) TIDAK disentuh oleh migrasi, jadi tidak
-- ada yang perlu dikembalikan di sana. Tabel cadangan_*_20261030 SENGAJA dibiarkan (cadangan permanen).
-- Cron pembersih log SENGAJA TIDAK dihidupkan lagi (keputusan user: riwayat permanen). Definisinya ada di
-- cadangan_cron_maintenance_20261030 (header disamarkan) bila suatu saat benar-benar diminta.
begin;
-- FOR ALL TABLES (produksi): tabel lepas sendiri dari publikasi saat di-drop.
do $$ begin
  if not (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table public.inv_barang, public.inv_jadwal, public.inv_jadwal_selesai,
      public.inv_laporan, public.inv_laporan_update, public.inv_media, public.inv_log, public.inv_lokasi;
  end if;
end $$;
drop view if exists public.inv_jadwal_v;
drop function if exists public.inv_migrasi_data_lama(boolean, jsonb);
drop function if exists public.inv_impor(jsonb, boolean, text, jsonb);
drop function if exists public.inv_selesai_jadwal(bigint, text, jsonb, uuid, jsonb);
drop function if exists public.inv_simpan_jadwal(bigint, jsonb, jsonb);
drop function if exists public.inv_hapus_media(bigint, jsonb);
drop function if exists public.inv_tambah_media(text, bigint, text, jsonb, jsonb);
drop function if exists public.inv_tambah_update_laporan(bigint, text, jsonb, jsonb);
drop function if exists public.inv_ubah_status_laporan(bigint, text, text, text, text, jsonb, jsonb);
drop function if exists public.inv_buat_laporan(bigint, text, text, jsonb, uuid, jsonb);
drop function if exists public.inv_set_kondisi(bigint, int, text, text, jsonb);
drop function if exists public.inv_ubah_barang(bigint, int, jsonb, jsonb);
drop function if exists public.inv_tambah_barang(jsonb, jsonb);
drop table public.inv_log, public.inv_media, public.inv_laporan_update, public.inv_laporan, public.inv_jadwal_selesai,
  public.inv_jadwal, public.inv_padanan_lama, public.inv_impor_cadangan, public.inv_barang, public.inv_impor_batch,
  public.inv_nomor_penghitung, public.inv_lokasi, public.inv_pengaturan;
drop function if exists public.inv_barang_sebelum();
drop function if exists public.inv_barang_catat();
drop function if exists public.inv_tolak_ubah();
drop function if exists public.inv_simpan_media(text, bigint, text, jsonb, text);
drop function if exists public.inv_validasi_media(jsonb);
drop function if exists public.inv_konteks(text, text, text, bigint, boolean);
drop function if exists public.inv_operator_boleh(text, text);
drop function if exists public.inv_aktor(jsonb);
drop function if exists public.inv_jatuh_tempo_berikut(date, text);
drop function if exists public.inv_batas_segera();
drop function if exists public.inv_hari_ini();
-- verifikasi: dua-duanya harus 0
select count(*) as sisa_tabel from pg_tables where schemaname = 'public' and tablename like 'inv\_%';
select count(*) as sisa_fungsi from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'inv\_%';
commit;
