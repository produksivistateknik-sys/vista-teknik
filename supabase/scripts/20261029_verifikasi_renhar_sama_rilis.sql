-- VERIFIKASI 20261029020000_renhar_sama_rilis - jalankan di SQL Editor SETELAH migrasi. Baca saja.
-- 1) Harapan: 2 baris, keduanya true (set_komponen menyamakan komponen_released; Undo memulihkan komponen_released).
select p.proname,
       case p.proname when 'ubah_jadwal_multi_v1' then pg_get_functiondef(p.oid) like '%komponen_released = array%'
                      else pg_get_functiondef(p.oid) like '%komponen_released = s.komponen_released%' end as versi_baru,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('ubah_jadwal_multi_v1', 'pulihkan_ubah_jadwal_v1') order by 1;
-- 2) Hak eksekusi tetap. Harapan: 4 baris, semua true.
select f, r, has_function_privilege(r, f, 'execute') as boleh
from (values ('public.ubah_jadwal_multi_v1(jsonb, jsonb, text, text)'), ('public.pulihkan_ubah_jadwal_v1(jsonb, text)')) a(f)
cross join (values ('anon'), ('authenticated')) b(r);
