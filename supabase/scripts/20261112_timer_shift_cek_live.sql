-- TAHAP D langkah a: CEK LIVE SEBELUM SQL kolom shift (12 Nov 2026). HANYA SELECT - tidak mengubah apa pun.
-- Jalankan sekali di SQL Editor (satu query, semua hasil dalam satu tabel), kirim hasilnya.
-- Yang dicari:
--   grant_kolom  : grant PER KOLOM di fcs_timer_kerja (pg_attribute.attacl). 0 baris = tidak ada grant per kolom (aman:
--                  kolom baru shift ikut grant tingkat tabel). Ada baris = perlu grant INSERT/SELECT shift tambahan.
--                  (information_schema.column_privileges TIDAK dipakai: ia juga menampilkan grant tingkat tabel per kolom.)
--   grant_tabel  : hak anon/authenticated di tingkat tabel fcs_timer_kerja (INSERT/SELECT/UPDATE diharapkan ada).
--   rls          : status RLS kedua tabel + policy yang ada (WITH CHECK yang menyebut kolom tertentu perlu dicek).
--   trigger      : trigger buatan (bukan internal) di fcs_timer_kerja / _archived yang mungkin menyalin kolom.
--   event_trigger: pemicu reload cache skema PostgREST (pgrst_ddl_watch / pgrst_drop_watch) - bila tidak ada,
--                  'notify pgrst, reload schema' di SQL tahap D yang memuat ulang.
--   kolom_shift  : apakah kolom shift SUDAH ada (diharapkan 0 baris sebelum tahap D).
--   jumlah_baris : ukuran kedua tabel (perkiraan lama kunci ALTER).
select 'grant_kolom' as cek, attname || ' acl=' || attacl::text as detail
  from pg_attribute
 where attrelid = 'public.fcs_timer_kerja'::regclass and attnum > 0 and not attisdropped and attacl is not null
union all
select 'grant_tabel', grantee || ' ' || string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'fcs_timer_kerja' and grantee in ('anon', 'authenticated')
 group by grantee
union all
select 'rls', c.relname || ' rls=' || c.relrowsecurity::text || ' force=' || c.relforcerowsecurity::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('fcs_timer_kerja', 'fcs_timer_kerja_archived')
union all
select 'policy', tablename || ': ' || policyname || ' [' || cmd || '] roles=' || array_to_string(roles, ',')
       || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-')
  from pg_policies
 where schemaname = 'public' and tablename in ('fcs_timer_kerja', 'fcs_timer_kerja_archived')
union all
select 'trigger', tgrelid::regclass::text || ': ' || tgname || ' -> ' || tgfoid::regproc::text
  from pg_trigger
 where tgrelid in ('public.fcs_timer_kerja'::regclass, 'public.fcs_timer_kerja_archived'::regclass) and not tgisinternal
union all
select 'event_trigger', evtname || ' (' || evtevent || ', enabled=' || evtenabled::text || ')'
  from pg_event_trigger
union all
select 'kolom_shift', table_name || '.' || column_name || ' ' || data_type
  from information_schema.columns
 where table_schema = 'public' and table_name in ('fcs_timer_kerja', 'fcs_timer_kerja_archived') and column_name = 'shift'
union all
select 'jumlah_baris', 'fcs_timer_kerja=' || (select count(*) from public.fcs_timer_kerja)
       || ', fcs_timer_kerja_archived=' || (select count(*) from public.fcs_timer_kerja_archived)
order by 1, 2;
