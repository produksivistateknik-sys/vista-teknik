-- BACA SAJA - jalankan SEBELUM migrasi 20261030010000 (keputusan user: pastikan dulu kenapa cron pembersih log tidak
-- efektif). Kolom command DISAMARKAN supaya kunci di header Authorization tidak tampil di layar.
-- Temuan dari luar (29 Okt 2026): Edge Function maintenance-rutin-log-cleanup ter-deploy (OPTIONS 200), tetapi
-- maintenance_rutin_log masih punya 32 baris > 30 hari -> penyebab ada di job cron / pemanggilannya.

-- 1) Job yang terdaftar (aktif? jadwal? header kunci masih placeholder?)
select jobid, jobname, schedule, active,
       command ~ '<SERVICE_ROLE_KEY>' as kunci_masih_placeholder,
       regexp_replace(command, 'Bearer\s+[^''"]+', 'Bearer <DISAMARKAN>', 'g') as command_disamarkan
from cron.job
where jobname ilike '%maintenance%' or command ilike '%maintenance%';

-- 2) 20 eksekusi terakhir job pembersih (status, pesan)
select d.jobid, d.status, d.return_message, d.start_time, d.end_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'maintenance-rutin-log-cleanup-harian'
order by d.start_time desc limit 20;

-- 3) Respons HTTP dari pg_net (bila job sempat memanggil): kode status per hari
select r.id, r.status_code, left(r.content::text, 200) as isi, r.created
from net._http_response r
order by r.created desc limit 20;

-- 4) Umur riwayat yang akan dimigrasi
select count(*) filter (where dilakukan_pada < (now() at time zone 'Asia/Jakarta')::date - 30) as lebih_30_hari,
       count(*) as total, min(dilakukan_pada), max(dilakukan_pada)
from public.maintenance_rutin_log;
