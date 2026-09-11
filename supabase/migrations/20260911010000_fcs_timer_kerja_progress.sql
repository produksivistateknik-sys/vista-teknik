-- Fitur: histori persen busbar per record (11 Sep 2026).
--
-- fcs_timer_kerja (histori sesi kerja per tahap busbar: panel_id, kode_komponen, tahap,
-- pekerja_id, tanggal, durasi_menit) sebelumnya TIDAK punya kolom persen sama sekali.
-- Persen busbar cuma tersimpan di panels.checklist[kode].busbarTahap.<TAHAP>.progress -
-- SATU angka yang di-OVERWRITE tiap kali disimpan (bukan per-tanggal) - jadi accordion
-- histori harian (Renhar tab BUSBAR, RencanaHarian.tsx) gak bisa nampilin "progress SAAT
-- ITU" per baris histori, cuma progress TERKINI yang sama utk semua baris (menyesatkan).
--
-- Kolom `progress` (numeric, nullable, TANPA default) ditambahkan supaya tiap record
-- histori bisa punya snapshot persennya sendiri. Ini MURNI tambahan pencatatan - TIDAK
-- mengubah cara checklist.busbarTahap bekerja (progress terkini/gabungan tetap dihitung &
-- ditampilkan seperti sekarang). Diisi dari vista-pekerja (OperatorView.tsx,
-- simpanProgressTahapBusbar) ke baris sesi TERBARU per operator saat tombol "Simpan
-- [Tahap]" diklik - baris LAMA (sebelum kolom ini ada) akan NULL, ditangani di render
-- (RencanaHarian.tsx: sembunyikan "(%)" kalau null, jangan tampilkan "null%"/"0%").
--
-- Tipe numeric (bukan integer) - konsisten dengan progress_checkpoint_log.checkpoint yang
-- juga numeric & bisa desimal (mis. 83.3/93.8, hasil hitungProgressBusbarGabungan).
--
-- Sekalian ditambahkan ke fcs_timer_kerja_archived (tabel arsip pasangan, lihat
-- supabase/ARSIP-SCHEMA-SYNC.md) - WAJIB sinkron persis, kalau tidak arsip_panel() akan
-- gagal "column progress of relation fcs_timer_kerja_archived does not exist" (kelas bug
-- yang sama dengan insiden busbar_jejak/bobot_komponen/jumlah_cell).
--
-- Perlu dijalankan manual di Supabase SQL Editor (anon key gak bisa DDL). File ini
-- dicommit sebagai catatan riwayat + biar re-apply idempoten.
alter table public.fcs_timer_kerja
  add column if not exists progress numeric;

alter table public.fcs_timer_kerja_archived
  add column if not exists progress numeric;
