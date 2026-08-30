-- Fitur baru "MOM FAT" (30 Agu 2026) - OCR checklist utk QC (Vista Pekerja) + read-only view
-- realtime di Vista Teknik (System > MOM FAT). BERDIRI SENDIRI, tidak terkait WO/panel manapun -
-- pola sama dengan proyek_luar (migration 20260830010000).
--
-- 2 tabel: mom_fat (record dokumen + metadata OCR), mom_fat_poin (checklist per-baris hasil OCR,
-- bisa dicentang/diedit/ditambah manual oleh operator QC manapun - dikonfirmasi dokumen ini
-- catatan tim/proyek, bukan personal per-operator seperti proyek_luar).
create table if not exists public.mom_fat (
  id bigint generated always as identity primary key,
  judul text not null,
  file_url text not null,
  file_type text not null check (file_type in ('pdf','image')),
  status text not null default 'processing' check (status in ('processing','ready','error')),
  pekerja_id bigint references public.pekerja(id),
  operator_nama text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mom_fat_poin (
  id bigint generated always as identity primary key,
  mom_fat_id bigint not null references public.mom_fat(id) on delete cascade,
  urutan int not null,
  teks text not null,
  selesai boolean not null default false,
  ocr_confidence numeric,
  dicentang_oleh text,
  dicentang_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_mom_fat_created_at on public.mom_fat(created_at desc);
create index if not exists idx_mom_fat_poin_mom_fat_id on public.mom_fat_poin(mom_fat_id);
