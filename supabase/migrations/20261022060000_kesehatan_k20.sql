-- ============================================================================================
-- KESEHATAN DATA K20 "Timer berjalan di luar daftar operator hari itu" (22 Okt 2026, rancangan operator harian)
-- Aturan: daftar operator per komponen per hari (renhar.pekerja_per_komponen) dan timer hari itu harus sinkron -
-- memulai timer menambah orang ke daftar, menghapus orang dari daftar menghentikan timernya. Temuan:
--  (a) timer BERJALAN milik orang yang tidak ada di daftar renhar komponen+proses+tanggal itu (mis. IFAL di
--      534 FS.4 WIRING CONTROL 22 Okt: daftar diganti saat timer berjalan, tombol Selesai hanya menghentikan
--      timer orang di daftar -> timer yatim terus menghitung);
--  (b) timer BERJALAN yang bertanggal sebelum hari ini (WIB) - mis. dimulai dari kartu tanggal lampau atau lupa
--      ditutup (cron tutup 12 jam menutup yang >12 jam).
-- BUSBAR: daftar per tahap ({tahap:[ids]}); timer tanpa tahap dianggap tahap ASSEMBLING (sama dgn aplikasi).
-- Pola lapisan sama dgn K16-K19: fungsi sekarang di-rename _sql_cek_kesehatan_k1_k19, fungsi baru menangani K20
-- lalu mendelegasikan (K1-K19 tidak berubah). Tingkat Peringatan, per jam.
-- Dry-run   : supabase/verifikasi/20261022060000_kesehatan_k20_dryrun.sql
-- Verifikasi: supabase/verifikasi/20261022060000_kesehatan_k20_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261022060000_kesehatan_k20_rollback.sql
-- ============================================================================================
begin;
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k19;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K20' then $q$
   select t.id::text as ref, pk.nama as pekerja, t.panel_id, p.nama as panel, t.kode_komponen, t.proses, t.tahap,
          t.tanggal, t.mulai,
          case when t.tanggal < (now() at time zone 'Asia/Jakarta')::date then 'timer bertanggal sebelum hari ini masih berjalan'
               else 'tidak ada di daftar operator hari itu' end as alasan,
          (select string_agg(coalesce(pk2.nama, x.v), ', ')
             from public.renhar r2
             cross join lateral jsonb_array_elements_text(case
                  when jsonb_typeof(r2.pekerja_per_komponen -> t.kode_komponen) = 'array' then r2.pekerja_per_komponen -> t.kode_komponen
                  when jsonb_typeof(r2.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')) = 'array' then r2.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')
                  else '[]'::jsonb end) as x(v)
             left join public.pekerja pk2 on pk2.id::text = x.v
            where r2.panel_id = t.panel_id and r2.proses = t.proses and r2.tanggal = t.tanggal and r2.deleted_at is null) as daftar_hari_itu,
          'peringatan' as tingkat
   from public.fcs_timer_kerja t
   left join public.pekerja pk on pk.id = t.pekerja_id
   left join public.panels p on p.id = t.panel_id
   where t.selesai is null
     and (t.tanggal < (now() at time zone 'Asia/Jakarta')::date
          or not exists (
            select 1 from public.renhar r
            where r.panel_id = t.panel_id and r.proses = t.proses and r.tanggal = t.tanggal and r.deleted_at is null
              and (
                (jsonb_typeof(r.pekerja_per_komponen -> t.kode_komponen) = 'array'
                   and (r.pekerja_per_komponen -> t.kode_komponen) @> to_jsonb(t.pekerja_id))
                or (jsonb_typeof(r.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')) = 'array'
                   and (r.pekerja_per_komponen -> t.kode_komponen -> coalesce(t.tahap, 'ASSEMBLING')) @> to_jsonb(t.pekerja_id)))))
   order by t.mulai $q$
 else public._sql_cek_kesehatan_k1_k19(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K20', 'Timer berjalan di luar daftar operator', 'Timer',
  'Timer yang masih berjalan milik operator yang tidak ada di daftar operator komponen itu pada hari itu, atau timer bertanggal sebelum hari ini yang masih berjalan.', 'per_jam', 1, null, 63,
  array['Admin','Operator'],
  $t$Ada timer yang masih menghitung jam kerja untuk orang yang tidak tercantum sebagai operator komponen itu hari ini, atau timer dari tanggal lampau yang belum dihentikan.$t$,
  $t$Daftar operator diganti (Edit Operator) saat timer masih berjalan - tombol Selesai hanya menghentikan timer orang yang ada di daftar; jadwal komponen dipindah ke hari lain lalu operator memulai dari kartu tanggal lampau.$t$,
  $t$Jam kerja (KPI) orang itu terus bertambah padahal tidak mengerjakan; satu orang bisa punya dua timer berjalan sekaligus (jam terhitung dobel); Rencana Harian menampilkan operator yang tidak sesuai aplikasi operator.$t$,
  array[
    $t$Lihat pekerja, panel, komponen, proses, dan daftar operator hari itu di contoh baris.$t$,
    $t$Tanyakan ke operator apakah orang itu memang masih mengerjakan.$t$,
    $t$Masih mengerjakan: tambahkan ke daftar lewat Edit Operator. Sudah berhenti: tambahkan ke daftar lalu tekan Selesai. Salah pilih: batalkan timernya (batalkan_timer_salah_pilih, timer dipindah ke log batal dan bisa dipulihkan).$t$])
on conflict (kode) do nothing;
commit;
