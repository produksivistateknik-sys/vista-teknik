-- Fase 2 (21 Sep 2026) - tabel baru component_process_progress, domain percobaan pertama:
-- Pasang Komponen (proses='PASANG KOMPONEN'). Lihat supabase/FASE2_COMPONENT_PROCESS_PROGRESS_DESIGN.md
-- utk desain lengkap + rasional tiap kolom. Skema di bawah SAMA PERSIS yang diusulkan di situ,
-- dengan 1 penyesuaian implementasi (lihat catatan tahap_key).
--
-- Histori per-tanggal/shift TIDAK disimpan di sini - reuse progress_checkpoint_log (tabel yang
-- sudah ada, sudah proses-agnostik, sudah dipakai simpanProgress() Pasang Komponen sejak 8 Agu
-- 2026). Timer TIDAK punya tabel baru - reuse fcs_timer_kerja (sudah proses-agnostik, kolom
-- `tahap` sudah dipakai persis buat Pasang Komponen sejak 18 Sep 2026). CLAUDE.md B.1 - satu
-- sumber logika, jangan duplikasi tabel yang fungsinya sudah ada.
CREATE TABLE public.component_process_progress (
  id bigint generated always as identity primary key,
  panel_id bigint not null references public.panels(id) on delete cascade,
  kode_komponen text not null,
  proses text not null,              -- nilai dari ALL_PROSES (fase ini cuma 'PASANG KOMPONEN')
  tahap text,                        -- NULL utk kode tanpa sub-tahap (mayoritas kode Pasang
                                      -- Komponen, mis. Groundplate). Diisi 'WIRING' utk kode
                                      -- tahap (Box Control/Pintu) - CUMA WIRING yang valid
                                      -- setelah fix 18 Sep 2026 (ASSEMBLING dikeluarkan dari
                                      -- scope Pintu/Box Control, lihat komentar komponenRelevanPanel
                                      -- di KomponenPasangView.tsx). Kolom ini disiapkan generik
                                      -- (bukan enum khusus WIRING) buat proses lain nanti (Fase 3+,
                                      -- BUSBAR pakai FABRIKASI/PLATING/HEATSHRINK/PASANG).
  -- Kolom bantu buat unique index - Postgres perlu KOLOM ASLI (bukan ekspresi langsung) supaya
  -- ON CONFLICT dari PostgREST upsert (dipakai KomponenPasangView.tsx) bisa nunjuk index ini.
  -- NULL diperlakukan "beda" oleh unique constraint biasa (2 baris NULL dianggap TIDAK
  -- duplikat) - makanya perlu kolom collapsed non-NULL ini, bukan cuma unique(panel_id,
  -- kode_komponen,proses,tahap) polos.
  tahap_key text generated always as (coalesce(tahap,'')) stored,
  status text not null default 'not_started'
    check (status in ('not_applicable','not_started','in_progress','done')),
  progress_pct numeric(5,1) not null default 0
    check (progress_pct >= 0 and progress_pct <= 100),
  qty_done integer,                  -- nullable, Pasang Komponen fase ini pct-only (gak qty-based)
  qty_total integer,                 -- snapshot qty komponen dari checklist[kode].qty
  photos jsonb not null default '[]',        -- [{url,uploaded_by,uploaded_at}] - salinan fotoPemasangan
  last_operator_nama text,
  last_operator_at timestamptz,
  sudah_disimpan_100 boolean not null default false,  -- checkpoint EKSPLISIT "Simpan/Arsipkan"
                                                        -- (match panel_seksi_archived), beda dari
                                                        -- progress_pct kebetulan 100 tanpa disimpan
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

CREATE UNIQUE INDEX component_process_progress_unique
  ON public.component_process_progress(panel_id, kode_komponen, proses, tahap_key);
CREATE INDEX component_process_progress_panel_idx ON public.component_process_progress(panel_id);
CREATE INDEX component_process_progress_status_idx ON public.component_process_progress(proses, status);

-- status & progress_pct WAJIB konsisten (bukan 2 sumber kebenaran independen kayak checklist
-- lama, itu sendiri sumber bug - lihat DATABASE_AUDIT_2026-09-20.md poin E.4).
ALTER TABLE public.component_process_progress ADD CONSTRAINT ccp_status_progress_consistent
  CHECK (
    (status = 'not_applicable' AND progress_pct = 0) OR
    (status = 'not_started' AND progress_pct = 0) OR
    (status = 'in_progress' AND progress_pct > 0 AND progress_pct < 100) OR
    (status = 'done' AND progress_pct = 100)
  );

-- RLS: ikutin pola tabel progress lain yang sudah ada (fcs_timer_kerja, progress_checkpoint_log,
-- panel_seksi_archived) - anon key baca+tulis bebas (aplikasi ini otentikasi di level app,
-- bukan lewat Supabase auth/RLS policy).
ALTER TABLE public.component_process_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY component_process_progress_anon_all ON public.component_process_progress
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.component_process_progress IS
  'Fase 2 (21 Sep 2026) - state terkini progress per (panel,kode,proses,tahap). Domain aktif:
  PASANG KOMPONEN saja (dual-write dari KomponenPasangView.tsx vista-pekerja, bersamaan dengan
  panels.checklist - checklist TETAP sumber kebenaran yang dibaca semua consumer lama selama
  masa transisi Fase 2). Proses lain BELUM ditulis ke sini - lihat
  supabase/FASE2_COMPONENT_PROCESS_PROGRESS_DESIGN.md.';
