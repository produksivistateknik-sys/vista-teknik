-- ROLLBACK TIMER BATAL. PERHATIAN: kalau sudah ada timer yang dibatalkan, pulihkan dulu semuanya (blok 1), baru
-- buang objek (blok 2) - kalau tidak, catatan timer yang dibatalkan ikut hilang.
-- Blok 1: pulihkan semua yang belum dipulihkan (lihat dulu daftarnya)
select id, timer_id, pekerja_id, panel_id, kode_komponen, proses, tanggal, alasan, dibatalkan_oleh, dibatalkan_at
from public.fcs_timer_kerja_batal where dipulihkan_at is null order by id;
-- select public.pulihkan_timer_batal(id, 'rollback fitur timer batal', 'Admin') from public.fcs_timer_kerja_batal where dipulihkan_at is null order by id;

-- Blok 2: buang objek
begin;
drop function if exists public.batalkan_timer_salah_pilih(bigint[], text, text, text);
drop function if exists public.pulihkan_timer_batal(bigint, text, text);
drop table if exists public.fcs_timer_kerja_batal;
commit;
