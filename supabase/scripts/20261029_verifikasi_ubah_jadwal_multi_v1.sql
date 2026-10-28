-- VERIFIKASI migrasi 20261029010000_ubah_jadwal_multi_v1 - jalankan di SQL Editor SETELAH migrasi. Baca saja.
-- 1) Kedua fungsi ada, security definer, search_path terkunci. Harapan: 2 baris, prosecdef = true, proconfig berisi search_path=public.
select p.proname, pg_get_function_identity_arguments(p.oid) as argumen, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('ubah_jadwal_multi_v1', 'pulihkan_ubah_jadwal_v1')
order by 1;

-- 2) Hak eksekusi anon & authenticated. Harapan: 4 baris, semua true.
select f, r, has_function_privilege(r, f, 'execute') as boleh
from (values ('public.ubah_jadwal_multi_v1(jsonb, jsonb, text, text)'), ('public.pulihkan_ubah_jadwal_v1(jsonb, text)')) a(f)
cross join (values ('anon'), ('authenticated')) b(r);

-- 3) Fungsi lama tidak tersentuh. Harapan: 2 baris (pindah_multi_sel_v2, pulihkan_multi_sel_v2).
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('pindah_multi_sel_v2', 'pulihkan_multi_sel_v2') order by 1;

-- 4) Penolakan tanpa menulis apa pun: p_rows kosong & snapshot asing. Harapan: KEDUANYA error P0001
--    ("Tidak ada jadwal yang diubah." / "Snapshot bukan dari ubah_jadwal_multi_v1 ..."). Jalankan satu per satu.
-- select public.ubah_jadwal_multi_v1('[]'::jsonb, '[]'::jsonb, 'cek', 'VERIFIKASI');
-- select public.pulihkan_ubah_jadwal_v1('{"versi":2}'::jsonb, 'VERIFIKASI');
-- Uji tulis sungguhan dilakukan Claude lewat aplikasi/Node HANYA di WO uji "UJI RAW PER WP" (penjaga mode uji).
