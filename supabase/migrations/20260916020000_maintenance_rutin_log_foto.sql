-- Fitur baru (16 Sep 2026): dokumentasi foto/video per eksekusi Maintenance Rutin.
--
-- Investigasi sebelumnya (lihat laporan) - form "Tandai Selesai" via QR (MesinPublic.tsx)
-- maupun admin (MaintenanceRutinTab.tsx) SAMA SEKALI gak punya input file, dan
-- maintenance_rutin_log gak punya kolom buat itu - 100% baris histori gak punya
-- foto/video, bukan karena kosong tapi karena memang gak ada tempat nyimpennya.
--
-- Kolom baru: jsonb array, ITEM shape {url, type: 'image'|'video', uploaded_at} - cermin dari
-- pola maintenance_log.foto (KerusakanTab.tsx) yang sudah terbukti jalan (upload ke Cloudflare
-- R2 lewat uploadToR2()), TAPI ditambah field "type" eksplisit (maintenance_log.foto gak
-- punya ini, cuma foto/image jadi gak perlu) - di sini mau dukung video juga, jadi consumer
-- (accordion histori) gak perlu nebak dari ekstensi URL buat milih <img> vs <video>.
-- Default '[]' (bukan null) - konsisten sama maintenance_log.foto, dan biar konsumen kode gak
-- perlu null-check terpisah dari empty-check.
alter table public.maintenance_rutin_log
  add column if not exists foto jsonb not null default '[]'::jsonb;

comment on column public.maintenance_rutin_log.foto is
  'Dokumentasi foto/video eksekusi maintenance rutin (via QR atau admin) - jsonb array of {url, type, uploaded_at}. Upload ke Cloudflare R2 lewat uploadToR2() (lib/r2Client.ts), sama seperti maintenance_log.foto.';
