-- Ganti kolom "Kesulitan" jadi "Jumlah Cell" di form Edit WO (30 Agu 2026) - dikonfirmasi
-- panels.tingkat_kesulitan TIDAK terhubung ke sistem bobot wiring (itu tokennya di
-- fcs_schedule.kode_komponen, format __wiring_{qty_hari}org_{bobot}, diatur ulang di Raw
-- Schedule - beda sistem total). Kolom tingkat_kesulitan lama SENGAJA dibiarkan (bukan
-- di-drop), cuma gak dipakai lagi di form ini.
alter table public.panels add column if not exists jumlah_cell integer;
