-- Fix checkpoint jadi numeric (1 Sep 2026) - root cause "Gagal Simpan Progress" BUSBAR
-- (Assembling Dalam) & PASANG KOMPONEN (Assembling Luar): progress_checkpoint_log.checkpoint
-- didefinisikan integer, padahal hitungProgressBusbarGabungan() (panelHelpers.tsx) SENGAJA
-- membulatkan ke 1 angka desimal (rata-rata progress 3-4 tahap BUSBAR, atau 2 tahap PASANG
-- KOMPONEN - mis. (100+100+50+0)/4 = 62.5). Server nolak insert dengan error 22P02 "invalid
-- input syntax for type integer" tiap kali rata-ratanya gak pas bulat - operator ngira ini
-- masalah koneksi padahal server nolak DATA-nya. Diperlebar ke numeric, BUKAN dibulatkan di
-- kode, biar presisi progress gabungan di log audit gak hilang. Kolom lain (RAKIT/WIRING/dll)
-- selalu kirim PCT_STEPS mentah (25/50/75/90/100, selalu bulat) - tetap valid di numeric.
alter table public.progress_checkpoint_log
  alter column checkpoint type numeric(5,1);
