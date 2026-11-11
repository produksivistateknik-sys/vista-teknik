-- TAHAP D: SHIFT SAAT LOGIN DISIMPAN DI TIMER (12 Nov 2026, keputusan user) - DRAF, BELUM DIJALANKAN.
-- Tujuan: tiap baris fcs_timer_kerja membawa shift yang dipilih operator di gerbang login HP ("Pilih shift kerja Anda
-- hari ini"), supaya Aktivitas Panel (lib/shiftSesi langkah 1) tidak pernah perlu menebak. Tanpa aturan jam.
-- Isi: kolom shift text ('1'/'2', nullable, tanpa default) di fcs_timer_kerja DAN fcs_timer_kerja_archived (WAJIB sama
-- persis - supabase/ARSIP-SCHEMA-SYNC.md: arsip_pindah_tabel menyusun kolom dinamis dari tabel sumber).
-- Baris lama tetap NULL (tidak di-backfill); admin memakai Simpan Progress / sesi lain operator utk baris lama.
-- Aman dijalankan ulang (idempoten). Tidak mengubah data, trigger, RLS, atau indeks yang ada.
-- Urutan rilis: (1) SQL ini -> (2) verifikasi di bawah -> (3) rilis vista-pekerja (startTimer mengisi shift) di luar jam
-- kerja. Admin (branch shift-login) sudah membaca kolom ini bila ada dan tetap jalan bila belum ada.
-- Waktu: kapan saja (ALTER ADD COLUMN nullable tanpa default = perubahan metadata, kunci singkat).

begin;

alter table public.fcs_timer_kerja          add column if not exists shift text;
alter table public.fcs_timer_kerja_archived add column if not exists shift text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fcs_timer_kerja_shift_valid') then
    alter table public.fcs_timer_kerja add constraint fcs_timer_kerja_shift_valid check (shift is null or shift in ('1', '2'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fcs_timer_kerja_archived_shift_valid') then
    alter table public.fcs_timer_kerja_archived add constraint fcs_timer_kerja_archived_shift_valid check (shift is null or shift in ('1', '2'));
  end if;
end $$;

comment on column public.fcs_timer_kerja.shift is 'Shift sesi kerja HP saat timer dimulai (pilihan login operator, 1/2). NULL = baris lama / operator tanpa gerbang shift.';
comment on column public.fcs_timer_kerja_archived.shift is 'Salinan fcs_timer_kerja.shift (wajib sinkron, ARSIP-SCHEMA-SYNC.md).';

-- Cek otomatis: batal utuh bila kolom tidak sama persis di kedua tabel.
do $$
declare a record; b record;
begin
  select data_type, is_nullable, column_default into a from information_schema.columns where table_schema = 'public' and table_name = 'fcs_timer_kerja' and column_name = 'shift';
  select data_type, is_nullable, column_default into b from information_schema.columns where table_schema = 'public' and table_name = 'fcs_timer_kerja_archived' and column_name = 'shift';
  if a is null or b is null or a.data_type <> 'text' or b.data_type <> 'text' or a.is_nullable <> 'YES' or b.is_nullable <> 'YES'
     or a.column_default is not null or b.column_default is not null then
    raise exception 'TAHAP D DIBATALKAN: kolom shift tidak sama persis di fcs_timer_kerja dan _archived';
  end if;
end $$;

commit;

-- ── VERIFIKASI (jalankan setelah commit, hasil diharapkan tertulis) ────────────────────────────────────────────────
-- 1) Kolom ada di kedua tabel, text, nullable, tanpa default -> 2 baris:
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns where table_schema = 'public' and column_name = 'shift'
   and table_name in ('fcs_timer_kerja', 'fcs_timer_kerja_archived') order by table_name;
-- 2) Drift arsip -> 0 baris untuk fcs_timer_kerja:
select * from public.cek_sync_skema_arsip() where tabel_sumber ilike 'fcs_timer_kerja%';
-- 3) Data lama tidak berubah -> semua NULL sebelum rilis vista-pekerja:
select count(*) total, count(shift) berisi_shift from public.fcs_timer_kerja;

-- ── ROLLBACK (hanya bila perlu; jalankan SETELAH vista-pekerja yang mengisi shift di-revert, kalau tidak insert HP gagal)
-- begin;
-- alter table public.fcs_timer_kerja          drop constraint if exists fcs_timer_kerja_shift_valid;
-- alter table public.fcs_timer_kerja_archived drop constraint if exists fcs_timer_kerja_archived_shift_valid;
-- alter table public.fcs_timer_kerja          drop column if exists shift;
-- alter table public.fcs_timer_kerja_archived drop column if exists shift;
-- commit;
