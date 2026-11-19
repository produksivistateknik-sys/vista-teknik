-- PEMULIHAN SETELAH INSIDEN 19 Nov 2026 18.57 WIB + UJI FUNGSI BARU (hapus otomatis foto/video Maintenance Rutin).
-- Insiden: eksekusi manual pertama mati (pg_net #33519 -> 503) tepat setelah menghapus berkas pertama di R2:
--   media 15 (riwayat #26, BAK DEGREASING 18 Sep, maintenance-rutin/10/1789718413573_128109.jpeg). Berkas itu SUDAH HILANG di R2
--   (dicek HeadObject 404 lewat API R2), tapi belum tercatat 'berkas_terhapus' & belum ditandai -> Riwayat menunjuk berkas patah.
-- Jalankan SETELAH Edge Function versi aws4fetch ter-deploy. Tiga bagian, jalankan BERURUTAN (blok per blok):

-- (1) UJI fungsi baru tanpa menghapus apa pun: hanya mengecek satu kunci yang pasti tidak ada di R2.
select net.http_post(
  url := 'https://aoxhxfsqjnquwsxjrsmo.supabase.co/functions/v1/hapus-media-rutin',
  body := '{}'::jsonb,
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-uji', 'r2',
    'x-kunci-hapus', (select nilai from public.inv_rahasia_internal where kunci = 'hapus_media_rutin')),
  timeout_milliseconds := 60000) as permintaan_uji;
-- 10 detik kemudian - harus 200 & "kunci_tidak_ada":"tidak ada (404) - benar":
--   select id, status_code, content::text from net._http_response where content::text like '%"uji"%' order by id desc limit 1;

-- (2) TUNTASKAN media 15 dengan jejak log yang benar (proses yang sama: berkas_terhapus -> selesai -> proses ditutup).
do $$ declare v_run uuid; begin
  select run_id into v_run from public.inv_media_hapus_log where jenis = 'mulai' and media_id = 15 order by id desc limit 1;
  if v_run is null then raise exception 'Klaim media 15 tidak ditemukan - batal'; end if;
  if exists (select 1 from public.inv_media_hapus_log where media_id = 15 and jenis in ('berkas_terhapus', 'selesai')) then
    raise exception 'Media 15 sudah tuntas - tidak perlu dijalankan lagi';
  end if;
  if exists (select 1 from public.inv_media_hapus_log where jenis in ('berkas_terhapus', 'selesai', 'gagal') and run_id = v_run) then
    raise exception 'Proses % ternyata mencatat hal lain - cek log dulu', v_run;
  end if;
  perform public.inv_media_rutin_terhapus(v_run, 15, 0);
  perform public.inv_media_rutin_tandai(v_run, 15, 0);
  perform public.inv_media_rutin_akhiri(v_run, jsonb_build_object('catatan',
    'dituntaskan manual 19 Nov: fungsi mati (pg_net 503) setelah menghapus berkas pertama; berkas dicek 404 di R2'));
  raise notice 'Media 15 ditandai dihapus; proses % ditutup', v_run;
end $$;

-- (3) LANJUTKAN penghapusan (saklar masih 'manual', maks 20 berkas) - HANYA bila (1) hasilnya benar:
--   select public.inv_media_rutin_jalankan_manual();
-- 1-2 menit kemudian:
--   select jenis, count(*) from public.inv_media_hapus_log group by jenis order by jenis;
