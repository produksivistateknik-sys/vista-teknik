-- Fitur baru (17 Sep 2026): banner broadcast lintas-app (Vista Teknik + Vista Pekerja) tiap kali
-- akun ber-role Engineering (admins.divisi='engineering') tambah/edit WO. Beda dari sistem
-- notifikasi yang sudah ada:
-- - Bel notifikasi (App.tsx) - agregat on-the-fly dari beberapa sumber, gak ada tabel event
--   sendiri, gak cocok buat "broadcast + status baca per akun".
-- - fcs_notifikasi.dibaca - boolean GLOBAL (1 orang tandai baca = hilang buat semua), bukan
--   per-akun.
-- - notify-wo-baru (edge function) - push notification OS-level (butuh izin browser), bukan
--   banner menempel di dalam UI.
-- Gak ada tabel "broadcast + status baca per akun" yang sudah ada buat direuse (dicek
-- gudang_read_state - cuma per-tab shared-login, bukan per akun individu) - jadi dibikin baru.
--
-- 2 tabel: wo_engineering_events (1 baris = 1 event tambah/edit WO oleh Engineering) dan
-- wo_engineering_events_dibaca (1 baris = 1 akun sudah menandai 1 event tertentu sebagai dibaca -
-- primary key gabungan (event_id, akun) biar 1 akun cuma bisa "dibaca" 1x per event, idempotent
-- kalau tombol kepencet dobel).
--
-- "akun" (text bebas, BUKAN foreign key - admins & operator_users itu 2 tabel independen dgn
-- namespace username terpisah, bisa kebetulan sama) - diisi client sebagai "teknik:<username>"
-- (dari admins.username) atau "pekerja:<username>" (dari operator_users.username), biar gak ada
-- ambiguitas identitas lintas app.
create table if not exists public.wo_engineering_events (
  id bigint generated always as identity primary key,
  wo_id integer references public.work_orders(id) on delete set null,
  wo_number text not null,
  proyek text not null,
  jenis_perubahan text not null check (jenis_perubahan in ('tambah','edit')),
  dilakukan_oleh text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wo_engineering_events_created_at on public.wo_engineering_events(created_at);

create table if not exists public.wo_engineering_events_dibaca (
  event_id bigint not null references public.wo_engineering_events(id) on delete cascade,
  akun text not null,
  dibaca_at timestamptz not null default now(),
  primary key (event_id, akun)
);
create index if not exists idx_wo_engineering_events_dibaca_akun on public.wo_engineering_events_dibaca(akun);

-- Sama seperti tabel lain di project ini - gak ada RLS restriktif, akses lewat anon key
-- (PostgREST) sepenuhnya diatur lewat GRANT biasa, bukan policy (lihat pola sama persis di
-- permintaan_item_koreksi, migration 20260907010000).
grant select, insert on table public.wo_engineering_events to anon, authenticated;
grant select, insert on table public.wo_engineering_events_dibaca to anon, authenticated;
