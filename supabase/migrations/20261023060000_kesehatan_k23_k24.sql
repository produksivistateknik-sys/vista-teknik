-- ============================================================================================
-- KESEHATAN DATA K23 & K24 - tanggal timer (23 Okt 2026, bug B: tanggal timer = tanggal kartu yang dibuka).
--  K23 "Timer bertanggal beda dari hari kerja saat mulai" - kolom tanggal fcs_timer_kerja tidak sama dgn HARI KERJA WIB
--      kolom mulai. Hari kerja: 00.00-06.59 WIB = hari sebelumnya (shift malam), sama dgn aplikasi (lib/tanggalWib
--      hariKerjaDari, getHariKerjaSekarang). Timer seperti ini terhitung di hari yang salah di Rencana Harian, Tracking
--      Pekerja & KPI (contoh 23 Okt: 9 timer BUSBAR panel 521 mulai 13 Okt 08.19 bertanggal 12 Okt).
--  K24 "Timer berjalan melewati pergantian hari kerja" - timer yang MASIH berjalan dan dimulai pada hari kerja sebelum hari
--      kerja sekarang (sudah melewati 07.00 WIB hari berikutnya). Batasnya pergantian HARI KERJA, bukan tengah malam:
--      timer shift malam yang wajar berjalan melewati 00.00 tidak ditandai. (K20 bagian b menilai kolom tanggal; K24 menilai
--      waktu mulai sebenarnya, jadi tetap menangkap timer basi walau kolom tanggal-nya diisi benar.)
-- Pola lapisan sama dgn K16-K22: fungsi sekarang di-rename _sql_cek_kesehatan_k1_k22; K1-K22 tidak berubah.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja). Harap: lapisan belum ada. Query temuan sama persis dgn isi migration:
--     K23 harap 9 baris (BUSBAR 521, mulai 13 Okt) bila skrip koreksi 20261023_koreksi_tanggal_timer_busbar_521 BELUM
--     dijalankan, 0 bila sudah. K24 tergantung timer yang sedang berjalan.
select case when to_regprocedure('public._sql_cek_kesehatan_k1_k22(text)') is not null then 'SUDAH ADA - jangan jalankan lagi' else 'ok, belum ada' end as lapisan_k1_k22;
select t.id, p.nama as pekerja, t.panel_id, t.kode_komponen, t.proses, t.tanggal,
       to_char(t.mulai at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as mulai_wib,
       ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date as hari_kerja_mulai
  from public.fcs_timer_kerja t left join public.pekerja p on p.id = t.pekerja_id
 where t.tanggal <> ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date order by t.mulai;
select t.id, p.nama as pekerja, t.panel_id, t.kode_komponen, t.proses, t.tanggal,
       to_char(t.mulai at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as mulai_wib
  from public.fcs_timer_kerja t left join public.pekerja p on p.id = t.pekerja_id
 where t.selesai is null
   and ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date < ((now() at time zone 'Asia/Jakarta') - interval '7 hours')::date
 order by t.mulai;

-- (1) EKSEKUSI
begin;
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k22;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K23' then $q$
   select t.id::text as ref, pk.nama as pekerja, t.panel_id, p.nama as panel, t.kode_komponen, t.proses, t.tahap,
          t.tanggal, to_char(t.mulai at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as mulai_wib,
          ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date as hari_kerja_mulai,
          case when t.selesai is null then 'berjalan' else 'selesai' end as keadaan, 'peringatan' as tingkat
   from public.fcs_timer_kerja t
   left join public.pekerja pk on pk.id = t.pekerja_id
   left join public.panels p on p.id = t.panel_id
   where t.tanggal <> ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date
   order by t.mulai desc $q$
 when 'K24' then $q$
   select t.id::text as ref, pk.nama as pekerja, t.panel_id, p.nama as panel, t.kode_komponen, t.proses, t.tahap,
          t.tanggal, to_char(t.mulai at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as mulai_wib,
          round(extract(epoch from (now() - t.mulai)) / 3600.0, 1) as jam_berjalan, 'peringatan' as tingkat
   from public.fcs_timer_kerja t
   left join public.pekerja pk on pk.id = t.pekerja_id
   left join public.panels p on p.id = t.panel_id
   where t.selesai is null
     and ((t.mulai at time zone 'Asia/Jakarta') - interval '7 hours')::date < ((now() at time zone 'Asia/Jakarta') - interval '7 hours')::date
   order by t.mulai $q$
 else public._sql_cek_kesehatan_k1_k22(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K23', 'Timer bertanggal beda dari hari kerja saat mulai', 'Timer',
  'Kolom tanggal timer tidak sama dengan hari kerja (WIB) saat timer dimulai. Pukul 00.00-06.59 WIB dihitung hari kerja sebelumnya (shift malam).', 'harian', 1, null, 66,
  array['Admin','Operator'],
  $t$Ada timer yang tercatat untuk hari lain dari hari ia sebenarnya dimulai.$t$,
  $t$Timer dimulai dari kartu tanggal lain di aplikasi operator (sebelum perbaikan 23 Okt 2026 tanggal timer diambil dari tanggal kartu yang dibuka), atau tanggal diubah manual.$t$,
  $t$Jam kerja & hari kerja orang itu terhitung di tanggal yang salah di Rencana Harian, Tracking Pekerja, dan KPI; kolom Operator Rencana Harian bisa menampilkan "belum mulai".$t$,
  array[
    $t$Lihat pekerja, komponen, tanggal, dan waktu mulai di contoh baris.$t$,
    $t$Pastikan hari kerja yang benar (waktu mulai; 00.00-06.59 = hari sebelumnya).$t$,
    $t$Koreksi lewat SQL dgn dry-run + verifikasi + rollback & catat ke koreksi_data_log (contoh: supabase/scripts/20261023_koreksi_tanggal_timer_busbar_521.sql).$t$]),
 ('K24', 'Timer berjalan melewati pergantian hari kerja', 'Timer',
  'Timer yang masih berjalan padahal dimulai pada hari kerja sebelumnya (sudah melewati pukul 07.00 WIB hari berikutnya).', 'per_jam', 1, null, 67,
  array['Admin','Operator'],
  $t$Ada timer yang masih menghitung sejak hari kerja sebelumnya.$t$,
  $t$Operator lupa menekan Selesai di akhir shift, HP mati/kehabisan baterai, atau timer dimulai dari perangkat lain.$t$,
  $t$Jam kerja orang itu terus bertambah (KPI membengkak) sampai timer ditutup; Rencana Harian menampilkan orang itu sedang mengerjakan.$t$,
  array[
    $t$Lihat pekerja, komponen, dan jam berjalan di contoh baris.$t$,
    $t$Tanyakan ke operator kapan sebenarnya berhenti.$t$,
    $t$Minta operator menekan Selesai, atau tutup lewat Kesehatan/SQL dengan jam selesai yang benar.$t$])
on conflict (kode) do nothing;
commit;

-- (2) VERIFIKASI - harus 'SEMUA LULUS' (tampil sbg notice) dan TIDAK ada error.
do $$
declare k text; n int; gagal text[] := '{}';
begin
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16','K17','K18','K19','K20','K21','K22'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k22(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  foreach k in array array['K23','K24'] loop
    begin
      execute 'select count(*) from (' || public._sql_cek_kesehatan(k) || ') s' into n;
      raise notice '% sekarang: % baris', k, n;
    exception when others then gagal := gagal || (k || ' error: ' || sqlerrm);
    end;
    if not exists (select 1 from public.kesehatan_cek where kode = k and aktif) then gagal := gagal || ('baris kesehatan_cek ' || k || ' tidak ada'); end if;
  end loop;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
select kode, nama, aktif from public.kesehatan_cek where kode in ('K23', 'K24') order by kode; -- harap 2 baris aktif

-- (3) ROLLBACK:
-- begin;
-- delete from public.kesehatan_hasil where kode in ('K23','K24');
-- delete from public.kesehatan_temuan_diketahui where kode in ('K23','K24');
-- delete from public.kesehatan_cek where kode in ('K23','K24');
-- drop function public._sql_cek_kesehatan(text);
-- alter function public._sql_cek_kesehatan_k1_k22(text) rename to _sql_cek_kesehatan;
-- commit;
