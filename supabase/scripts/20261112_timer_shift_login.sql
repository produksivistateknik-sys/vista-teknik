-- TAHAP D: SHIFT SAAT LOGIN DISIMPAN DI TIMER (12 Nov 2026, keputusan user) - DRAF, BELUM DIJALANKAN.
-- Tujuan: tiap baris fcs_timer_kerja membawa shift yang dipilih operator di gerbang login HP ("Pilih shift kerja Anda
-- hari ini"), supaya Aktivitas Panel (lib/shiftSesi langkah 1) tidak pernah perlu menebak. Tanpa aturan jam.
-- Isi: kolom shift text ('1'/'2', nullable, tanpa default) di fcs_timer_kerja DAN fcs_timer_kerja_archived (WAJIB sama
-- persis - supabase/ARSIP-SCHEMA-SYNC.md: arsip_pindah_tabel menyusun kolom dinamis dari tabel sumber).
-- Baris lama tetap NULL (tidak di-backfill); admin memakai Simpan Progress / sesi lain operator utk baris lama.
-- Aman dijalankan ulang (idempoten). Tidak mengubah data, trigger, RLS, atau indeks yang ada.
-- Urutan rilis: (1) SQL ini -> (2) verifikasi di bawah -> (3) rilis vista-pekerja (startTimer mengisi shift) di luar jam
-- kerja. Admin (branch shift-login) sudah membaca kolom ini bila ada dan tetap jalan bila belum ada.
-- Waktu: DI LUAR JAM KERJA. ADD CONSTRAINT CHECK memasang kunci ACCESS EXCLUSIVE + memindai tabel (cepat, semua NULL),
-- tapi bila ada transaksi lain memegang tabel, ALTER antre & menahan mulai/stop timer HP. lock_timeout 5 dtk membatalkan
-- utuh bila kunci tak didapat -> cukup jalankan ulang.
-- Tinjauan data-migrasi-reviewer 12 Nov: lock_timeout, reload cache skema PostgREST, cek conrelid, verifikasi constraint.

begin;
set local lock_timeout = '5s';

alter table public.fcs_timer_kerja          add column if not exists shift text;
alter table public.fcs_timer_kerja_archived add column if not exists shift text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fcs_timer_kerja_shift_valid' and conrelid = 'public.fcs_timer_kerja'::regclass) then
    alter table public.fcs_timer_kerja add constraint fcs_timer_kerja_shift_valid check (shift is null or shift in ('1', '2'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fcs_timer_kerja_archived_shift_valid' and conrelid = 'public.fcs_timer_kerja_archived'::regclass) then
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
  -- cek_sync_skema_arsip hanya membandingkan nama & udt_name -> constraint dicek di sini.
  if (select count(*) from pg_constraint where (conname, conrelid) in (('fcs_timer_kerja_shift_valid', 'public.fcs_timer_kerja'::regclass),
        ('fcs_timer_kerja_archived_shift_valid', 'public.fcs_timer_kerja_archived'::regclass))) <> 2 then
    raise exception 'TAHAP D DIBATALKAN: constraint shift tidak terpasang di kedua tabel';
  end if;
end $$;

-- Muat ulang cache skema PostgREST supaya insert HP yang membawa kolom shift tidak ditolak (PGRST204).
notify pgrst, 'reload schema';

commit;

-- ── VERIFIKASI (jalankan SATU PER SATU setelah commit - SQL Editor hanya menampilkan hasil statement terakhir) ────────────────────────────────────────────────
-- 1) Kolom ada di kedua tabel, text, nullable, tanpa default -> 2 baris:
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns where table_schema = 'public' and column_name = 'shift'
   and table_name in ('fcs_timer_kerja', 'fcs_timer_kerja_archived') order by table_name;
-- 2) Drift arsip -> 0 baris untuk fcs_timer_kerja:
select * from public.cek_sync_skema_arsip() where tabel_sumber ilike 'fcs_timer_kerja%';
-- 3) Data lama tidak berubah -> semua NULL sebelum rilis vista-pekerja:
select count(*) total, count(shift) berisi_shift from public.fcs_timer_kerja;
-- 4) Constraint terpasang -> 2 baris CHECK (shift IS NULL OR shift = ANY (ARRAY['1','2'])):
select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
 where conname in ('fcs_timer_kerja_shift_valid', 'fcs_timer_kerja_archived_shift_valid');
-- ── CEK LIVE SEBELUM RUN (SELECT saja) ──
-- grant per kolom (kosong/tingkat tabel = kolom baru ikut bisa di-insert anon):
--   select grantee, privilege_type from information_schema.column_privileges where table_name = 'fcs_timer_kerja' and grantee in ('anon','authenticated') group by 1, 2;
-- trigger di luar migrations:  select tgname from pg_trigger where tgrelid in ('public.fcs_timer_kerja'::regclass, 'public.fcs_timer_kerja_archived'::regclass) and not tgisinternal;
-- event trigger reload PostgREST:  select evtname from pg_event_trigger;

-- ── ROLLBACK (hanya bila perlu; jalankan SETELAH vista-pekerja yang mengisi shift di-revert, kalau tidak insert HP gagal).
-- PERINGATAN: drop column MEMBUANG semua shift yang sudah terisi sejak rilis dan tidak bisa dikembalikan (kecuali dari
-- backup harian R2). Admin memakai select('*'), jadi tetap jalan tanpa kolom ini.
-- begin;
-- alter table public.fcs_timer_kerja          drop constraint if exists fcs_timer_kerja_shift_valid;
-- alter table public.fcs_timer_kerja_archived drop constraint if exists fcs_timer_kerja_archived_shift_valid;
-- alter table public.fcs_timer_kerja          drop column if exists shift;
-- alter table public.fcs_timer_kerja_archived drop column if exists shift;
-- notify pgrst, 'reload schema';
-- commit;
