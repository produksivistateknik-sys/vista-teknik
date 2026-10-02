-- ============================================================================================
-- STOK KOMPONEN - TANGGAL TRANSAKSI PAKAI WIB, BUKAN UTC (2 Okt 2026, permintaan user).
-- current_date di server Supabase = tanggal UTC -> transaksi yang terjadi jam 00:00-07:00 WIB
-- tercatat tanggal KEMARIN. Kena di: default kolom komponen_stok_transaksi.tanggal (dipakai trigger
-- koreksi), default/COALESCE di RPC catat_transaksi_stok (form keluar & koreksi Admin tidak kirim
-- tanggal), dan 2 fungsi Produksi Stok yang mengirim current_date eksplisit (masuk otomatis saat
-- batch selesai/batal). Dicek live sebelum migrasi: 0 dari 23 transaksi yang tanggalnya meleset,
-- jadi tidak ada data yang perlu dikoreksi.
--
-- SATU sumber "tanggal hari ini" di server: fungsi tanggal_wib(). Logika stok (kunci baris, cek
-- stok, update, catat) TIDAK berubah - cuma asal tanggal default. Aman dijalankan ulang.
-- ============================================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.tanggal_wib() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date $$;
GRANT EXECUTE ON FUNCTION public.tanggal_wib() TO anon, authenticated;

-- 1. Default kolom (dipakai trigger trg_komponen_stok_catat yang tidak mengisi tanggal)
ALTER TABLE public.komponen_stok_transaksi ALTER COLUMN tanggal SET DEFAULT public.tanggal_wib();

-- 2. RPC: default p_tanggal jadi NULL (-> tanggal_wib()). Default parameter tidak bisa diubah lewat
--    CREATE OR REPLACE, jadi DROP + CREATE dgn signature yang SAMA (9 parameter, urutan & tipe sama
--    -> pemanggil app tidak terpengaruh). Isi logika SAMA PERSIS dgn 20261002020000 kecuali COALESCE tanggal.
DROP FUNCTION IF EXISTS public.catat_transaksi_stok(bigint, text, integer, text, text, text, text, date, text);
CREATE FUNCTION public.catat_transaksi_stok(
  p_komponen_id bigint, p_tipe text, p_jumlah integer,
  p_sumber text DEFAULT 'manual', p_keterangan text DEFAULT NULL, p_referensi text DEFAULT NULL,
  p_created_by text DEFAULT NULL, p_tanggal date DEFAULT NULL, p_panel text DEFAULT NULL
) RETURNS public.komponen_stok_transaksi
LANGUAGE plpgsql AS $$
DECLARE v_lama integer; v_baru integer; v_jumlah integer; v_row public.komponen_stok_transaksi;
BEGIN
  SELECT COALESCE(stok,0) INTO v_lama FROM public.komponen_stok WHERE id = p_komponen_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Komponen stok % tidak ditemukan', p_komponen_id; END IF;
  IF p_tipe = 'masuk' THEN
    IF p_jumlah IS NULL OR p_jumlah <= 0 THEN RAISE EXCEPTION 'Jumlah masuk harus lebih dari 0'; END IF;
    v_jumlah := p_jumlah; v_baru := v_lama + p_jumlah;
  ELSIF p_tipe = 'keluar' THEN
    IF p_jumlah IS NULL OR p_jumlah <= 0 THEN RAISE EXCEPTION 'Jumlah keluar harus lebih dari 0'; END IF;
    IF p_jumlah > v_lama THEN RAISE EXCEPTION 'Stok tidak cukup! Stok tersedia: %', v_lama; END IF;
    v_jumlah := p_jumlah; v_baru := v_lama - p_jumlah;
  ELSIF p_tipe = 'koreksi' THEN
    IF p_jumlah IS NULL OR p_jumlah < 0 THEN RAISE EXCEPTION 'Stok koreksi tidak boleh negatif'; END IF;
    IF p_jumlah = v_lama THEN RETURN NULL; END IF;
    v_jumlah := p_jumlah - v_lama; v_baru := p_jumlah;
  ELSE
    RAISE EXCEPTION 'Tipe transaksi tidak dikenal: %', p_tipe;
  END IF;
  PERFORM set_config('app.stok_via_rpc', '1', true);
  UPDATE public.komponen_stok SET stok = v_baru, updated_at = now() WHERE id = p_komponen_id;
  PERFORM set_config('app.stok_via_rpc', '0', true);
  INSERT INTO public.komponen_stok_transaksi (komponen_id, tipe, sumber, jumlah, stok_sebelum, stok_sesudah, tanggal, keterangan, referensi, panel, created_by)
  VALUES (p_komponen_id, p_tipe, COALESCE(p_sumber, CASE WHEN p_tipe='koreksi' THEN 'koreksi_manual' ELSE 'manual' END),
          v_jumlah, v_lama, v_baru, COALESCE(p_tanggal, public.tanggal_wib()), p_keterangan, p_referensi, p_panel, p_created_by)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.catat_transaksi_stok(bigint, text, integer, text, text, text, text, date, text) TO anon, authenticated;

-- 3. Produksi Stok selesai: logika SAMA dgn 20261002030000, tanggal NULL (-> tanggal_wib()).
CREATE OR REPLACE FUNCTION public.produksi_stok_cek_selesai(p_batch_id bigint, p_oleh text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE b public.produksi_stok_batch; v_baik_akhir integer; v_wip integer; v_trx public.komponen_stok_transaksi;
BEGIN
  SELECT * INTO b FROM public.produksi_stok_batch WHERE id = p_batch_id;
  IF b.status <> 'aktif' THEN RETURN; END IF;
  SELECT k.qty_baik INTO v_baik_akhir FROM public.produksi_stok_kondisi(p_batch_id) k ORDER BY k.urutan DESC LIMIT 1;
  SELECT COALESCE(SUM(k.tersedia),0) INTO v_wip FROM public.produksi_stok_kondisi(p_batch_id) k WHERE k.urutan > 1;
  IF v_baik_akhir < b.target_qty OR v_wip > 0 THEN RETURN; END IF;
  SELECT * INTO v_trx FROM public.catat_transaksi_stok(b.komponen_id, 'masuk', v_baik_akhir, 'otomatis_produksi',
    'Produksi stok batch #' || b.id || ' selesai', 'produksi_stok_batch:' || b.id, COALESCE(p_oleh, 'SISTEM'), NULL, NULL);
  UPDATE public.produksi_stok_batch SET status = 'selesai', selesai_at = now(), updated_at = now(), stok_transaksi_id = v_trx.id
  WHERE id = p_batch_id;
END $$;

-- 4. Batal batch: logika SAMA dgn 20261002050000 (termasuk tutup sesi), tanggal NULL (-> tanggal_wib()).
CREATE OR REPLACE FUNCTION public.batal_produksi_stok(p_batch_id bigint, p_oleh text, p_alasan text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE b public.produksi_stok_batch; v_baik_akhir integer; v_trx public.komponen_stok_transaksi;
BEGIN
  SELECT * INTO b FROM public.produksi_stok_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch produksi % tidak ditemukan', p_batch_id; END IF;
  IF b.status <> 'aktif' THEN RAISE EXCEPTION 'Batch produksi sudah %, tidak bisa dibatalkan', b.status; END IF;
  SELECT k.qty_baik INTO v_baik_akhir FROM public.produksi_stok_kondisi(p_batch_id) k ORDER BY k.urutan DESC LIMIT 1;
  IF COALESCE(v_baik_akhir, 0) > 0 THEN
    SELECT * INTO v_trx FROM public.catat_transaksi_stok(b.komponen_id, 'masuk', v_baik_akhir, 'otomatis_produksi',
      'Produksi stok batch #' || b.id || ' DIBATALKAN - barang jadi yang sudah ada dimasukkan', 'produksi_stok_batch:' || b.id,
      COALESCE(p_oleh, 'SISTEM'), NULL, NULL);
  END IF;
  UPDATE public.produksi_stok_batch
    SET status = 'batal', updated_at = now(), selesai_at = now(), dibatalkan_oleh = p_oleh, alasan_batal = p_alasan,
        stok_transaksi_id = v_trx.id
  WHERE id = p_batch_id;
  UPDATE public.produksi_stok_sesi SET selesai_at = now(), cara_selesai = 'batal', ditutup_oleh = COALESCE(p_oleh, 'SISTEM')
  WHERE batch_id = p_batch_id AND selesai_at IS NULL;
  RETURN public.produksi_stok_ringkasan(p_batch_id);
END $$;
GRANT EXECUTE ON FUNCTION public.batal_produksi_stok(bigint, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
