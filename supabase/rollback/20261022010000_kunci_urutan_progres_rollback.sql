-- ROLLBACK kunci urutan progres: kembali ke trigger Mekanik lama (POTONG>BENDING>STEL>FINISHING, memeriksa SEMUA komponen).
-- Tabel koreksi_progres_log TIDAK dihapus kalau sudah berisi koreksi (jejak awet); urutan_proses dihapus
-- (aplikasi otomatis mematikan peringatan/cap & mencatat log kalau tabel tidak ada).
-- PERHATIAN: K17/K18 (migration 20261022020000) membaca urutan_proses - rollback migration itu DULU.
begin;
drop trigger if exists trg_panels_validate_urutan_progres on public.panels;
drop trigger if exists trg_panels_validate_mekanik_cap on public.panels;
create trigger trg_panels_validate_mekanik_cap
  before update of checklist on public.panels
  for each row when (NEW.checklist is distinct from OLD.checklist)
  execute function public.panels_validate_mekanik_cap_progress();
drop function if exists public.koreksi_progres_admin(bigint, text, text, numeric, text, text, text, date);
drop function if exists public.panels_validate_urutan_progres();
drop table if exists public.urutan_proses;
do $$ begin
  if not exists (select 1 from public.koreksi_progres_log) then drop table public.koreksi_progres_log; end if;
end $$;
drop function if exists public._angka_progres(text);
commit;
