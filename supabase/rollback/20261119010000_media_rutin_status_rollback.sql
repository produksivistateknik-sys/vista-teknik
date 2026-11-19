-- ROLLBACK 20261119010000_media_rutin_status.sql (Tahap 1 hapus otomatis media Maintenance Rutin, 19 Nov 2026).
-- Jalankan di Supabase SQL Editor (Run). Menghapus fungsi baca inv_media_rutin_status() dan kolom inv_jadwal_selesai.media_dihapus_pada.
-- Batal utuh bila kolom penanda SUDAH TERISI (artinya proses hapus Tahap 2 pernah berjalan - penandanya jangan dibuang diam-diam).
-- Aplikasi tetap jalan tanpa kolom ini (dibaca lewat select *, tidak ada = dianggap belum pernah dihapus).
begin;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inv_jadwal_selesai'
             and column_name = 'media_dihapus_pada')
     and exists (select 1 from public.inv_jadwal_selesai where media_dihapus_pada is not null) then
    raise exception 'media_dihapus_pada sudah terisi - rollback dibatalkan (tanya dulu sebelum membuang penanda)';
  end if;
end $$;

drop function if exists public.inv_media_rutin_status();
alter table public.inv_jadwal_selesai drop column if exists media_dihapus_pada;

do $$ begin
  if to_regprocedure('public.inv_media_rutin_status()') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inv_jadwal_selesai'
                and column_name = 'media_dihapus_pada') then
    raise exception 'Rollback GAGAL - fungsi/kolom masih ada';
  end if;
  raise notice 'Rollback LULUS - fungsi inv_media_rutin_status dan kolom media_dihapus_pada sudah dihapus';
end $$;

commit;
