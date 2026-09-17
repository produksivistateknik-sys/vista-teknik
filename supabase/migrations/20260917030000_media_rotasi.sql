-- Fitur baru (17 Sep 2026): rotate PERMANEN foto/video di viewer, TANPA re-proses file asli.
-- File di R2 TIDAK diubah sama sekali - orientasi disimpan sbg METADATA (rotasi_derajat), lalu
-- SEMUA viewer (FotoZoomViewer di vista-teknik, FotoZoomViewerPekerja di vista-pekerja, +
-- thumbnail Maintenance Rutin/Kerusakan Mesin) baca metadata ini dan terapkan
-- transform:rotate() pas render <img>/<video>.
--
-- Kenapa TABEL TERPISAH (bukan kolom baru di tiap tabel yang nyimpen foto) - dicek live:
-- foto/video tersebar di PULUHAN kolom/tabel berbeda, beberapa di antaranya NESTED di dalam
-- jsonb (mis. panels.checklist[kode].fotoPemasangan, bukan cuma kolom top-level
-- panels.pasang_komponen_photos) - nambah kolom di semua lokasi itu jauh lebih rumit &
-- rawan miss. Tabel ini di-key oleh URL FILE (unik per objek R2 by design, nama file
-- di-generate timestamp+random pas upload) - viewer mana pun tinggal lookup rotasi by URL,
-- terlepas dari tabel/struktur data asal foto itu (satu sumber logika, CLAUDE.md B.1).
--
-- Skip re-encode video sungguhan (dicek: gak ada infra ffmpeg/video-processing di project ini,
-- Vercel serverless gak cocok proses video berat) - video pakai mekanisme SAMA PERSIS kayak
-- foto (transform:rotate() di elemen <video>), bukan re-encode.
create table public.media_rotasi (
  url text primary key,
  rotasi_derajat smallint not null default 0 check (rotasi_derajat in (0,90,180,270)),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Sama seperti tabel lain di project ini - gak ada RLS restriktif, akses lewat anon key
-- (PostgREST) sepenuhnya diatur lewat GRANT biasa, bukan policy (lihat pola sama persis di
-- permintaan_item_koreksi, migration 20260907010000, dan wo_engineering_events, 20260917010000).
grant select, insert, update on table public.media_rotasi to anon, authenticated;
