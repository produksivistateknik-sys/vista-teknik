-- ============================================================================================
-- HENTIKAN reset bulanan permintaan barang (17 Okt 2026, disetujui user)
-- Edge Function reset-permintaan-bulanan (dipicu pg_cron tiap tanggal 3) MENGHAPUS PERMANEN semua permintaan +
-- permintaan_item bulan lalu (backup ke R2 dulu). Bukti: 4 Okt 01.00 WIB 248 permintaan / 457 item September
-- terhapus (backup-permintaan/2026-09.json). Reset berikutnya 4 Nov 01.00 WIB akan menghapus 363 permintaan Oktober.
-- Jadwal ini dipasang manual (tidak ada di migration repo) -> dicari dari cron.job berdasarkan isi perintahnya.
-- Definisi job DISIMPAN dulu ke tabel _backup_cron_reset_permintaan (RLS aktif tanpa policy -> tidak bisa dibaca
-- aplikasi; perintahnya bisa berisi kunci) supaya bisa dikembalikan persis (BAGIAN 3).
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback.
-- ============================================================================================

-- ── BAGIAN 1: DRY-RUN (baca saja) ───────────────────────────────────────────────────────────
select jobid, jobname, schedule, active, left(command, 80) as awal_perintah
from cron.job where command ilike '%reset-permintaan-bulanan%' or jobname ilike '%reset%permintaan%';
-- HARUS minimal 1 baris (jadwal tanggal 3, mis. '0 18 3 * *' = 01.00 WIB tgl 4)


-- ── BAGIAN 2: EKSEKUSI ──────────────────────────────────────────────────────────────────────
begin;
create table if not exists public._backup_cron_reset_permintaan (
  jobname text, schedule text, command text, disimpan_pada timestamptz not null default now()
);
alter table public._backup_cron_reset_permintaan enable row level security;
do $$
declare v_n int; j record;
begin
  select count(*) into v_n from cron.job where command ilike '%reset-permintaan-bulanan%' or jobname ilike '%reset%permintaan%';
  if v_n = 0 then raise exception 'DIBATALKAN: jadwal reset permintaan tidak ditemukan (mungkin sudah dihentikan) - jalankan BAGIAN 1'; end if;
  for j in select jobid, jobname, schedule, command from cron.job where command ilike '%reset-permintaan-bulanan%' or jobname ilike '%reset%permintaan%' loop
    insert into public._backup_cron_reset_permintaan (jobname, schedule, command) values (j.jobname, j.schedule, j.command);
    perform cron.unschedule(j.jobid);
  end loop;
  if exists (select 1 from cron.job where command ilike '%reset-permintaan-bulanan%' or jobname ilike '%reset%permintaan%') then
    raise exception 'DIBATALKAN: jadwal masih ada sesudah unschedule';
  end if;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Admin (SQL)', 'HENTIKAN RESET PERMINTAAN',
    v_n || ' jadwal reset-permintaan-bulanan (hapus permanen permintaan bulan lalu tiap tgl 3) dihentikan - riwayat permintaan per panel harus utuh sampai arsip. Definisi disimpan di _backup_cron_reset_permintaan.',
    'permintaan', 'SQL Editor');
end $$;
select count(*) as jadwal_tersisa_harus_0 from cron.job where command ilike '%reset-permintaan-bulanan%';
select jobname, schedule, disimpan_pada from public._backup_cron_reset_permintaan;
commit;


-- ── BAGIAN 3: ROLLBACK (hanya kalau perlu - jadwal reset aktif lagi persis seperti semula) ──
-- begin;
-- select cron.schedule(jobname, schedule, command) from public._backup_cron_reset_permintaan;
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL)', 'HENTIKAN RESET PERMINTAAN', 'Rollback: jadwal reset-permintaan-bulanan diaktifkan lagi.', 'permintaan', 'SQL Editor');
-- commit;
