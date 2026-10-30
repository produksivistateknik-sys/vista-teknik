-- ============================================================================================
-- INVENTARIS & MAINTENANCE - GO-LIVE (30 Okt 2026, izin user "rilis sekarang", 01.xx WIB di luar jam kerja).
-- SIAP JALAN: Run sekali, TEPAT SEBELUM aplikasi baru di-push. Satu transaksi; cek di akhir gagal = semua batal.
--  1. Tabel inv_pengingat_log - dedup pengingat push versi baru (maintenance_reminder_log lama ber-FK ke maintenance_rutin).
--  2. Cron pengingat lama DIJEDA (cron.alter_job active=false, perintah & kuncinya TIDAK diubah): setelah go-live jadwal lama
--     tidak maju lagi -> tanpa jeda HP operator dapat notifikasi "terlambat" palsu tiap pagi. Diaktifkan lagi (satu baris di
--     bawah) SETELAH Edge Function maintenance-reminder-check versi baru (baca inv_jadwal_v) di-deploy.
--  3. Sinkron terakhir data lama -> inv_* (inv_migrasi_data_lama, idempoten). Sesudah go-live JANGAN dijalankan lagi:
--     jadwal baru maju dari HP/admin baru, sinkron ulang akan menimpanya dengan tanggal tabel lama.
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

create temp table _sinkron on commit drop as
  select public.inv_migrasi_data_lama(false, '{"admin":"LUTVAN"}'::jsonb) as h;

do $cek$
declare h jsonb := (select h from _sinkron); v_gagal text[] := '{}';
begin
  if (h->'lama_tidak_terpetakan'->>'jadwal')::int <> 0 or (h->'lama_tidak_terpetakan'->>'selesai')::int <> 0
     or (h->'lama_tidak_terpetakan'->>'laporan')::int <> 0 then v_gagal := v_gagal || ('data lama tidak terpetakan ' || (h->>'lama_tidak_terpetakan')); end if;
  if exists (select 1 from public.inv_jadwal j join public.maintenance_rutin r on r.id = j.rutin_id_lama
             where j.jatuh_tempo is distinct from r.jatuh_tempo or j.aktif <> coalesce(r.is_active, true)) then v_gagal := v_gagal || 'jadwal beda dgn lama'::text; end if;
  if (select count(*) from public.inv_jadwal_selesai where rutin_log_id_lama is not null) <> (select count(*) from public.maintenance_rutin_log) then
    v_gagal := v_gagal || 'riwayat tidak lengkap'::text; end if;
  if exists (select 1 from public.inv_barang b where b.aktif and exists (select 1 from public.inv_laporan l where l.barang_id = b.id and l.status <> 'closed') and b.kondisi <> 'rusak') then
    v_gagal := v_gagal || 'laporan aktif belum Rusak'::text; end if;
  if exists (select 1 from cron.job where command ilike '%maintenance-reminder-check%' and active) then v_gagal := v_gagal || 'cron pengingat lama masih aktif'::text; end if;
  if array_length(v_gagal, 1) > 0 then raise exception 'DIBATALKAN (tidak ada yang tersimpan): %', array_to_string(v_gagal, '; '); end if;
end $cek$;

select (h->'total'->>'jadwal')::int as jadwal, (h->'total'->>'selesai')::int as riwayat_selesai, (h->'total'->>'laporan')::int as laporan,
       (h->>'media_selesai_baru')::int + (h->>'media_laporan_baru')::int as media_baru_sejak_t1,
       (h->>'kondisi_jadi_rusak')::int as jadi_rusak, (h->>'kondisi_pulih')::int as pulih,
       (select count(*) from cron.job where command ilike '%maintenance-reminder-check%' and not active) as cron_pengingat_dijeda,
       true as siap_go_live
from _sinkron;
commit;
