-- Fitur "Pengajuan Koreksi Qty" (7 Sep 2026) - Gudang kadang salah input qty saat submit
-- permintaan (kasus nyata: "STREP TEMBAGA ROUNDED 40X10X4000 (mm) x5400 CM" statusnya sudah
-- Diambil dengan qty salah). Gudang TIDAK bisa langsung ubah qty sendiri - harus diajukan dulu
-- (qty ASLI belum berubah sampai disetujui), disetujui/ditolak pihak divisi peminta.
--
-- CATATAN ARSITEKTUR (dikonfirmasi lewat investigasi sebelum tabel ini dibuat): sistem
-- notifikasi/login Vista Pekerja HANYA bisa menarget per DIVISI (push_subscriptions.divisi),
-- BUKAN per orang - device/login shared per divisi (lihat notify-permintaan/index.ts). Jadi
-- "siapa yang berwenang approve" di sini bukan operator_nama/diambil_oleh SPESIFIK, tapi
-- SIAPA PUN yang login di divisi peminta (target_divisi) - konsisten sama pola existing
-- "Konfirmasi Sudah Diambil" yang juga gak dibatasi harus operator yang sama persis.
create table if not exists public.permintaan_item_koreksi (
  id bigint generated always as identity primary key,
  permintaan_item_id bigint not null references public.permintaan_item(id) on delete cascade,
  qty_lama numeric not null,
  qty_diusulkan numeric not null,
  alasan text not null,
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  diajukan_oleh text not null,
  diajukan_at timestamptz not null default now(),
  target_divisi text not null,
  disetujui_oleh text,
  diputuskan_at timestamptz
);
create index if not exists idx_permintaan_item_koreksi_item_id on public.permintaan_item_koreksi(permintaan_item_id);
create index if not exists idx_permintaan_item_koreksi_status on public.permintaan_item_koreksi(status);
create index if not exists idx_permintaan_item_koreksi_target_divisi on public.permintaan_item_koreksi(target_divisi);

-- Sama seperti tabel lain di project ini - gak ada RLS restriktif, akses lewat anon key
-- (PostgREST) sepenuhnya diatur lewat GRANT biasa, bukan policy.
grant select, insert, update, delete on table public.permintaan_item_koreksi to anon, authenticated;
