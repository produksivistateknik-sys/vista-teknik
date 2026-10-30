-- ============================================================================================
-- INVENTARIS & MAINTENANCE - GO-LIVE (30 Okt 2026, izin user "rilis sekarang", 01.xx WIB di luar jam kerja).
-- SIAP JALAN: Run sekali (kapan saja, sebaiknya sebelum 07.00 WIB berikutnya). Satu transaksi; cek gagal = semua batal.
--  1. Tabel inv_pengingat_log - dedup pengingat push versi baru (maintenance_reminder_log lama ber-FK ke maintenance_rutin).
--  2. Cron pengingat lama DIJEDA (cron.alter_job active=false, perintah & kuncinya TIDAK diubah): setelah go-live jadwal lama
--     tidak maju lagi -> tanpa jeda HP operator dapat notifikasi "terlambat" palsu tiap pagi. Diaktifkan lagi (satu baris di
--     bawah) SETELAH Edge Function maintenance-reminder-check versi baru (baca inv_jadwal_v) di-deploy.
--  3. TIDAK ada sinkron data lama di sini (revisi 30 Okt 01.xx): dicek baca-saja sebelum push, data lama = inv_* identik
--     (jadwal/riwayat/laporan/media, 0 beda). inv_migrasi_data_lama JANGAN dijalankan lagi - jadwal baru maju dari HP/admin
--     baru, sinkron ulang akan menimpanya dgn tanggal tabel lama. File ini aman dijalankan kapan saja (sebelum/sesudah push).
-- Mengaktifkan lagi pengingat (setelah deploy fungsi baru):
--   select cron.alter_job(jobid, active := true) from cron.job where command ilike '%maintenance-reminder-check%';
-- Rollback: drop table public.inv_pengingat_log; + perintah aktifkan di atas (data hasil sinkron tetap - idempoten).
-- ============================================================================================
begin;

create table public.inv_pengingat_log (
  jadwal_id bigint not null references public.inv_jadwal(id),
  jatuh_tempo_saat_kirim date not null,
  tanggal_kirim date not null,
  jumlah_penerima int not null default 0,
  sent_at timestamptz not null default now(),
  primary key (jadwal_id, jatuh_tempo_saat_kirim, tanggal_kirim)
);
alter table public.inv_pengingat_log enable row level security;
revoke all on public.inv_pengingat_log from anon, authenticated;   -- hanya Edge Function (service role)

create table public.cadangan_cron_pengingat_20261030 as
  select jobid, jobname, schedule, active from cron.job where command ilike '%maintenance-reminder-check%';
alter table public.cadangan_cron_pengingat_20261030 enable row level security;
revoke all on public.cadangan_cron_pengingat_20261030 from anon, authenticated;
select cron.alter_job(jobid, active := false) from cron.job where command ilike '%maintenance-reminder-check%';

do $cek$ begin
  if exists (select 1 from cron.job where command ilike '%maintenance-reminder-check%' and active) then
    raise exception 'DIBATALKAN (tidak ada yang tersimpan): cron pengingat lama masih aktif';
  end if;
end $cek$;

select (select count(*) from cron.job where command ilike '%maintenance-reminder-check%' and not active) as cron_pengingat_dijeda,
       to_regclass('public.inv_pengingat_log') is not null as tabel_log_pengingat_ada,
       true as siap;
commit;
