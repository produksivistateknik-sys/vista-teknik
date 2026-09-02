-- Titik merah "belum dibaca" per sub-tab BBMB/BBMU di Permintaan Masuk Gudang (2 Sep 2026).
-- Gudang cuma 1 login SHARED (operator_users gak punya baris per-individu buat divisi gudang) -
-- status "sudah dibaca" gak bisa disimpan di localStorage (beda device/sesi = beda status),
-- harus di tabel ini biar konsisten buat siapapun yang pakai login itu. 1 baris per tab
-- (BBMB/BBMU), di-upsert tiap kali tab itu dibuka di Vista Pekerja.
create table if not exists public.gudang_read_state (
  tab text primary key,
  last_read_at timestamptz not null default now()
);
insert into public.gudang_read_state(tab,last_read_at) values ('BBMB',now()),('BBMU',now())
  on conflict (tab) do nothing;
