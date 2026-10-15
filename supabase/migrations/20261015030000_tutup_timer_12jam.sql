-- ============================================================================================
-- TUTUP OTOMATIS TIMER YANG JALAN > 12 JAM (15 Okt 2026, keputusan user: "timer ditutup otomatis jika kelewat 12 jam")
-- Latar: Kesehatan Data K8 - 27 timer basi (semua komponennya sudah 100%) & 19 timer >12 jam (total 557 jam)
-- membengkakkan jam kerja di Tracking Pekerja / ringkasan operator Manajemen WO.
-- Jalan di SERVER (pg_cron, tiap jam menit 5) - bukan di browser (CLAUDE.md D).
-- Aturan waktu selesai timer yang ditutup:
--   * ada simpanan progres (progress_checkpoint_log) komponen+proses yang sama dalam 12 jam sejak timer mulai
--     -> selesai = waktu simpanan TERAKHIR itu (bukti kerja terakhir yang nyata);
--   * tidak ada -> selesai = mulai (durasi 0, sama dengan Force Stop admin di Timer Aktif).
-- Setiap eksekusi yang menutup timer dicatat 1 baris activity_log 'TUTUP TIMER OTOMATIS' (daftar id + durasi),
-- jadi bisa dilacak/dibatalkan per id. Tidak ada perubahan skema tabel produksi.
-- Rollback: supabase/rollback/20261015030000_tutup_timer_12jam_rollback.sql
-- ============================================================================================
begin;

create or replace function public.tutup_timer_kelewat_12jam()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_ringkas text;
begin
  perform set_config('statement_timeout', '30000', true);
  with kandidat as (
    select t.id
    from public.fcs_timer_kerja t
    where t.selesai is null and t.mulai < now() - interval '12 hours'
    for update skip locked
  ), hitung as (
    select t.id, t.mulai,
      (select max(c.ts::timestamptz) from public.progress_checkpoint_log c
        where c.panel_id = t.panel_id and c.kode_komponen = t.kode_komponen and c.proses = t.proses
          and c.ts::timestamptz > t.mulai and c.ts::timestamptz <= t.mulai + interval '12 hours') as cp
    from public.fcs_timer_kerja t join kandidat k on k.id = t.id
  ), tutup as (
    update public.fcs_timer_kerja t set selesai = coalesce(h.cp, h.mulai)
    from hitung h where t.id = h.id and t.selesai is null
    returning t.id, t.pekerja_id, t.proses, t.tahap, t.kode_komponen, t.panel_id, (h.cp is not null) as pakai_cp,
              round(extract(epoch from (coalesce(h.cp, h.mulai) - h.mulai)) / 60.0) as menit
  )
  select count(*), string_agg(format('#%s %s %s%s %s panel %s: %s mnt%s', x.id, coalesce(k.nama, '?'), x.proses,
            coalesce('/' || x.tahap, ''), x.kode_komponen, x.panel_id, x.menit, case when x.pakai_cp then ' (s.d. simpanan terakhir)' else ' (tanpa simpanan, durasi 0)' end), '; ' order by x.id)
    into v_n, v_ringkas
  from tutup x left join public.pekerja k on k.id = x.pekerja_id;

  if v_n > 0 then
    insert into public.activity_log (user_name, action, description, module, halaman)
    values ('Sistem (otomatis)', 'TUTUP TIMER OTOMATIS',
            left(v_n || ' timer jalan >12 jam ditutup: ' || v_ringkas, 4000), 'wo', 'pg_cron tutup-timer-12jam');
  end if;
  return v_n;
end $$;
-- hanya untuk pg_cron / SQL Editor - tidak dibuka ke aplikasi
revoke execute on function public.tutup_timer_kelewat_12jam() from public, anon, authenticated;

do $$ begin perform cron.unschedule(jobname) from cron.job where jobname = 'tutup-timer-12jam'; end $$;
select cron.schedule('tutup-timer-12jam', '5 * * * *', $c$select public.tutup_timer_kelewat_12jam()$c$);

commit;
