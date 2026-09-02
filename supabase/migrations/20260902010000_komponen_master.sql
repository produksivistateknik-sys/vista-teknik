-- Master komponen BBMB+BBMU baru (2 Sep 2026) - import dari "DATABASE_BARU - REVISI.xlsx"
-- (1.978 baris valid: 550 BBMB, 1.424 BBMU, sisanya di-skip - lihat laporan import terpisah).
-- GANTIKAN komponen_bbmb_master untuk pemakaian baru (BBMB+BBMU sekaligus, bukan BBMB-only) -
-- tabel lama TIDAK di-drop/disentuh, berhenti dipakai aplikasi tapi aman sebagai arsip 537 baris
-- yang sudah ada (gak ada data BBMU lama yang perlu dimigrasi - permintaan jenis BBMU masih 0
-- baris waktu perubahan ini dibuat).
create table if not exists public.komponen_master (
  id bigint generated always as identity primary key,
  kode_barang text,
  nama text not null,
  tipe text,
  merk text,
  kategori text not null check (kategori in ('BBMB','BBMU')),
  satuan_utama text,
  satuan_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists komponen_master_kategori_idx on public.komponen_master(kategori);
create index if not exists komponen_master_nama_idx on public.komponen_master(nama);

-- BBMU sekarang pakai permintaan_item juga (struktur penuh per-item, bukan catatan bebas di
-- header permintaan) - additive, kolom lama permintaan.catatan/status TETAP ADA (dibiarkan
-- nullable/gak dipakai lagi buat BBMU baru, gak ada data lama yang perlu ditangani).
alter table public.permintaan_item add column if not exists komponen_master_id bigint references public.komponen_master(id);
alter table public.permintaan_item add column if not exists satuan_dipilih text;
