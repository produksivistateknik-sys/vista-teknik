-- ============================================================================================
-- PRODUKSI STOK - FOTO TIDAK WAJIB (2 Okt 2026, permintaan user). Jalankan di SQL Editor SEBELUM
-- push vista-pekerja versi tanpa foto (app versi baru kirim p_foto_urls = [] dan akan ditolak RPC
-- lama). Aman dijalankan ulang. Kolom foto_urls TETAP ada (data lama utuh), cuma boleh kosong.
-- ============================================================================================
BEGIN;

-- 1. Buang CHECK "minimal 1 foto" di produksi_stok_log (nama constraint dicari dari definisinya,
--    gak diasumsikan), default jadi array kosong.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.produksi_stok_log'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%foto_urls%' LOOP
    EXECUTE format('ALTER TABLE public.produksi_stok_log DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.produksi_stok_log ALTER COLUMN foto_urls SET DEFAULT '{}'::text[];

-- 2. RPC simpan progress: tanpa validasi foto (signature SAMA, logika lain identik).
CREATE OR REPLACE FUNCTION public.simpan_progress_produksi_stok(
  p_batch_id bigint, p_tahap text, p_qty integer, p_qty_reject integer, p_foto_urls text[],
  p_operator_id bigint, p_operator_nama text, p_catatan text DEFAULT NULL, p_mulai_at timestamptz DEFAULT NULL
) RETURNS json LANGUAGE plpgsql AS $$
DECLARE b public.produksi_stok_batch; v_tersedia integer; v_reject integer := COALESCE(p_qty_reject, 0);
BEGIN
  SELECT * INTO b FROM public.produksi_stok_batch WHERE id = p_batch_id FOR UPDATE;  -- serialisasi per batch
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch produksi % tidak ditemukan', p_batch_id; END IF;
  IF b.status <> 'aktif' THEN RAISE EXCEPTION 'Batch produksi sudah %, tidak bisa ditambah progress', b.status; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Jumlah selesai sesi ini harus lebih dari 0'; END IF;
  IF v_reject < 0 OR v_reject > p_qty THEN RAISE EXCEPTION 'Jumlah reject harus antara 0 dan %', p_qty; END IF;
  SELECT k.tersedia INTO v_tersedia FROM public.produksi_stok_kondisi(p_batch_id) k WHERE k.tahap = p_tahap;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tahap % tidak berlaku untuk batch ini', p_tahap; END IF;
  IF p_qty > v_tersedia THEN
    RAISE EXCEPTION 'Jumlah melebihi yang tersedia di tahap % (maksimal % pcs saat ini)', p_tahap, v_tersedia;
  END IF;
  UPDATE public.produksi_stok_tahap
    SET qty_selesai = qty_selesai + p_qty, qty_reject = qty_reject + v_reject, updated_at = now()
  WHERE batch_id = p_batch_id AND tahap = p_tahap;
  INSERT INTO public.produksi_stok_log (batch_id, tahap, qty_sesi_ini, qty_reject_sesi_ini, foto_urls, operator_id, operator_nama, catatan, mulai_at)
  VALUES (p_batch_id, p_tahap, p_qty, v_reject, COALESCE(p_foto_urls, '{}'::text[]), p_operator_id, p_operator_nama, p_catatan, p_mulai_at);
  UPDATE public.produksi_stok_batch SET updated_at = now() WHERE id = p_batch_id;
  PERFORM public.produksi_stok_cek_selesai(p_batch_id, p_operator_nama);
  RETURN public.produksi_stok_ringkasan(p_batch_id);
END $$;
GRANT EXECUTE ON FUNCTION public.simpan_progress_produksi_stok(bigint, text, integer, integer, text[], bigint, text, text, timestamptz) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
