-- WO Digital (31 Agu 2026) - digitalisasi gambar teknik (construction drawing CAD, PDF dari
-- software eksternal) yang biasanya dicetak fisik buat panduan kerja operator. Admin upload
-- PDF, sistem tempel watermark logo Vista di server-side (browser admin, pdf-lib) sebelum
-- disimpan ke R2, operator akses/download versi digital dari Vista Pekerja.
--
-- work_instructions: 1 baris = 1 "slot" drawing, terikat ke WO dan/atau panel tertentu.
-- panel_id NULLABLE - null berarti drawing level-WO (bukan spesifik 1 panel).
create table if not exists public.work_instructions (
  id bigint generated always as identity primary key,
  wo_id bigint not null references public.work_orders(id) on delete cascade,
  panel_id bigint references public.panels(id) on delete cascade,
  judul text not null,
  created_at timestamptz not null default now()
);

-- wi_revisions: riwayat LENGKAP semua revisi tersimpan (audit trail), cuma SATU yang
-- is_current=true per work_instruction ("berlaku" - ini yang ditampilkan default ke operator).
-- Upload baru = revisi lama di-set is_current=false dulu, baru insert revisi baru is_current=true.
create table if not exists public.wi_revisions (
  id bigint generated always as identity primary key,
  work_instruction_id bigint not null references public.work_instructions(id) on delete cascade,
  revision_number int not null,
  rev_mark text,
  file_url text not null,
  page_count int,
  is_current boolean not null default true,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

-- Jamin di level DATABASE cuma ada 1 revisi "berlaku" per work_instruction - bukan cuma
-- konvensi aplikasi, race condition (2 admin upload nyaris bersamaan) gak bisa bikin 2 current.
create unique index if not exists wi_revisions_one_current
  on public.wi_revisions(work_instruction_id) where is_current;

create index if not exists work_instructions_wo_id_idx on public.work_instructions(wo_id);
create index if not exists work_instructions_panel_id_idx on public.work_instructions(panel_id);
create index if not exists wi_revisions_wi_id_idx on public.wi_revisions(work_instruction_id);
