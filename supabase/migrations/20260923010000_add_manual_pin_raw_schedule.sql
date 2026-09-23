-- Manual pin permanen (23 Sep 2026) - fix "pengaturan manual di Raw Schedule ketimpa lagi oleh
-- auto-geser-harian". Root cause: drag manual (confirmDrag/confirmDragBusbar di RawSchedule.tsx)
-- tidak pernah ninggalin penanda apa pun di entry tujuan, jadi auto-geser-harian (Edge Function,
-- dipicu tombol "Tarik ke Hari Ini" yang diklik rutin tiap pagi oleh planner) gak bisa bedain kode
-- yang barusan diatur manual dari kode basi yang numpuk berhari-hari - keduanya sama-sama
-- dievaluasi ulang & bisa digeser lagi begitu tanggal itu jadi hariSumber di run berikutnya.
-- Kasus nyata pemicu: MCC PANEL (PT. MITRA ALAM SEGAR) / WIRING CONTROL WP1 - LUTVAN drag manual
-- ke 16 Sep 2026 06:16 UTC, lenyap tanpa jejak sama sekali keesokan paginya (run 17 Sep 01:07 UTC,
-- raw_schedule.schedule["2026-09-16"] jadi [] total).
--
-- Fix: proses biasa/WIRING pakai field BARU `entry.manualPin` (Record<kode,timestamp>) di dalam
-- kolom `schedule` (JSONB) yang SUDAH ADA - tidak perlu kolom baru. BUSBAR beda struktur
-- (busbar_schedule/busbar_jejak level-kolom, bukan nested di `schedule`) - butuh kolom baru
-- `busbar_manual_pin` yang mirror persis bentuk & default `busbar_jejak` yang sudah ada
-- (Record<tanggal, Record<kode,timestamp>>).
--
-- Keputusan user (23 Sep 2026): manual pin PERMANEN sampai progress kode itu 100% - bukan cuma
-- proteksi beberapa hari. Auto-geser-harian (index.ts, sudah dipatch bareng migration ini) skip
-- kode berpenanda manualPin/busbar_manual_pin selama-lamanya sampai progress>=100 (guard progress
-- yang sudah ada otomatis bikin pin ini jadi gak relevan lagi begitu selesai, gak perlu dibersihkan
-- eksplisit).

ALTER TABLE public.raw_schedule
  ADD COLUMN IF NOT EXISTS busbar_manual_pin jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Sinkron ke tabel arsip pasangannya (raw_schedule_archived, kalau ada) - CLAUDE.md B.4/
-- supabase/ARSIP-SCHEMA-SYNC.md: tiap add column ke tabel sumber WAJIB sekalian ke *_archived.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='raw_schedule_archived') THEN
    ALTER TABLE public.raw_schedule_archived
      ADD COLUMN IF NOT EXISTS busbar_manual_pin jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
