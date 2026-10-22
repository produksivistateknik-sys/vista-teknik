-- KOREKSI TANGGAL 9 TIMER BUSBAR panel 521 (PANEL KAPASITOR BANK 14 STEP 1400KVAR) - keputusan user 23 Okt 2026 (bug B:
-- vista-pekerja mengisi fcs_timer_kerja.tanggal dari tanggal KARTU yang dibuka (viewDate), bukan tanggal mulai).
-- Kesembilan timer dimulai & dihentikan 13 Okt 08.19-08.20 WIB (durasi 0 menit, ditandai dari kartu 12 Okt) tetapi
-- bertanggal 12 Okt. Koreksi: tanggal 12 -> 13 Okt (= HARI KERJA WIB kolom mulai: 00.00-06.59 WIB = hari sebelumnya; 08.19 -> 13 Okt). Durasi tidak berubah (dihitung dari mulai/selesai).
-- Dampak hari kerja (Tracking Pekerja/KPI menghitung tanggal timer): BAYU, AGUS, PIYONO kehilangan "hari kerja" 12 Okt
-- yang semu (satu-satunya timer mereka di 12 Okt adalah timer 0 menit ini); 13 Okt sudah terhitung (punya timer lain).
-- RONI tetap (punya 7 timer lain di 12 Okt). Menit kerja semua orang tidak berubah (0 menit).
-- Jejak tahan lama: tabel baru koreksi_data_log (activity_log hanya ~1 minggu) + activity_log.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).

-- (0) DRY-RUN (baca saja). Harap 9 baris, tanggal_lama 2026-10-12, tanggal_baru 2026-10-13, status 'siap'.
select t.id, p.nama as pekerja, t.panel_id, t.kode_komponen, t.proses, t.tahap,
       to_char(t.mulai at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as mulai_wib,
       to_char(t.selesai at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as selesai_wib, t.durasi_menit,
       t.tanggal as tanggal_lama, ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date as tanggal_baru,
       case when t.selesai is null then 'MASIH BERJALAN - jangan' when t.tanggal = ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date then 'sudah benar' else 'siap' end as status
  from public.fcs_timer_kerja t left join public.pekerja p on p.id = t.pekerja_id
 where t.id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953) order by t.id;
select to_regclass('public.koreksi_data_log') as tabel_log_sudah_ada;

-- (1) EKSEKUSI
begin;
create table if not exists public.koreksi_data_log (
  id          bigint generated always as identity primary key,
  tabel       text not null,
  ref_id      bigint not null,
  kolom       text not null,
  nilai_lama  text,
  nilai_baru  text,
  alasan      text not null,
  oleh        text not null,
  waktu       timestamptz not null default now()
);
create index if not exists koreksi_data_log_ref on public.koreksi_data_log (tabel, ref_id);
alter table public.koreksi_data_log enable row level security;
drop policy if exists baca_koreksi_data_log on public.koreksi_data_log;
create policy baca_koreksi_data_log on public.koreksi_data_log for select to anon, authenticated using (true);
-- tanpa policy tulis: hanya diisi skrip SQL admin (SQL Editor).

with target as (
  select id, tanggal as lama, ((mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date as baru
    from public.fcs_timer_kerja
   where id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953)
     and selesai is not null and tanggal = date '2026-10-12' and ((mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date = date '2026-10-13'
), ubah as (
  update public.fcs_timer_kerja t set tanggal = g.baru from target g where t.id = g.id returning t.id, g.lama, g.baru
), log as (
  insert into public.koreksi_data_log (tabel, ref_id, kolom, nilai_lama, nilai_baru, alasan, oleh)
  select 'fcs_timer_kerja', id, 'tanggal', lama::text, baru::text,
         'tanggal timer = tanggal kartu yg dibuka (viewDate) bukan hari kerja saat mulai; dikoreksi ke hari kerja WIB mulai (bug B, 23 Okt 2026)',
         'Admin (SQL koreksi timer BUSBAR 521)' from ubah returning ref_id
)
insert into public.activity_log (user_name, action, description, module, halaman)
select 'Admin (SQL koreksi timer BUSBAR 521)', 'KOREKSI TANGGAL TIMER',
       'Timer ' || string_agg(ref_id::text, ', ' order by ref_id) || ': tanggal 2026-10-12 -> 2026-10-13 (dimulai 13 Okt 08.19 WIB dari kartu 12 Okt; durasi 0 menit). Jejak per baris di koreksi_data_log.',
       'produksi', 'Admin'
  from log having count(*) > 0;
-- Harap 9 baris bertanggal 2026-10-13. Bila tidak -> ROLLBACK; (bukan commit) lalu kabari Claude.
select id, tanggal, durasi_menit from public.fcs_timer_kerja where id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953) order by id;
commit;

-- (2) VERIFIKASI
--  a. 9 timer kini 13 Okt, durasi tetap 0 (harap 9 / 0 / 0)
select count(*) filter (where tanggal = date '2026-10-13') as tgl_13,
       count(*) filter (where tanggal <> ((mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date) as masih_beda,
       coalesce(sum(durasi_menit), 0) as total_menit
  from public.fcs_timer_kerja where id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953);
--  b. jejak: 9 baris koreksi_data_log + 1 activity_log
select count(*) as log_9 from public.koreksi_data_log where tabel = 'fcs_timer_kerja' and kolom = 'tanggal' and nilai_baru = '2026-10-13'
   and ref_id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953);
select created_at, description from public.activity_log where action = 'KOREKSI TANGGAL TIMER' and description like 'Timer 22945%' order by created_at desc limit 1;
--  c. hari kerja 12 Okt per orang setelah koreksi (harap: BAYU/AGUS/PIYONO 0 timer, RONI 7)
select p.nama, count(t.id) as timer_12_okt from public.pekerja p
  left join public.fcs_timer_kerja t on t.pekerja_id = p.id and t.tanggal = date '2026-10-12'
 where p.id in (32, 36, 39, 40) group by p.nama order by p.nama;

-- (3) ROLLBACK - kembalikan tanggal dari koreksi_data_log & catat:
-- begin;
-- update public.fcs_timer_kerja t set tanggal = l.nilai_lama::date
--   from public.koreksi_data_log l
--  where l.tabel = 'fcs_timer_kerja' and l.kolom = 'tanggal' and l.ref_id = t.id
--    and l.ref_id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953);
-- insert into public.koreksi_data_log (tabel, ref_id, kolom, nilai_lama, nilai_baru, alasan, oleh)
-- select 'fcs_timer_kerja', id, 'tanggal', '2026-10-13', '2026-10-12', 'ROLLBACK koreksi tanggal timer BUSBAR 521', 'Admin (SQL rollback)'
--   from public.fcs_timer_kerja where id in (22945, 22946, 22947, 22948, 22949, 22950, 22951, 22952, 22953);
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('Admin (SQL rollback)', 'KOREKSI TANGGAL TIMER', 'ROLLBACK: timer 22945-22953 tanggal 2026-10-13 -> 2026-10-12', 'produksi', 'Admin');
-- commit;
-- (tabel koreksi_data_log sengaja TIDAK di-drop: jejak koreksi lain bisa memakainya.)
