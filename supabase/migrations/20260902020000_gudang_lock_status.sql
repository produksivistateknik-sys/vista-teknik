-- Lock/unlock Permintaan Barang dari Gudang (2 Sep 2026) - Gudang bisa "tutup" penerimaan
-- permintaan baru dari operator (BBMB & BBMU sekaligus, gak dipisah per jenis). Operator tetap
-- bisa lihat Riwayat Permintaan seperti biasa, cuma form kirim baru yang diblokir + muncul catatan.
-- Single-row settings table (pola sama gudang_read_state - gak ada RLS, akses langsung anon key
-- kayak semua tabel lain di project ini).
create table if not exists public.gudang_lock_status (
  id int primary key default 1,
  is_locked boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint gudang_lock_status_single_row check (id = 1)
);
insert into public.gudang_lock_status (id, is_locked) values (1, false)
  on conflict (id) do nothing;
