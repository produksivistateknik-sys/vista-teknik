-- ============================================================================================
-- HOTFIX (2 Okt 2026) - samakan production dgn versi FINAL 20261002010000_komponen_stok_transaksi.sql.
-- Yang dijalankan di SQL Editor ternyata versi AWAL (sebelum kolom panel / stok awal = koreksi /
-- realtime) -> app (commit 33e8dfd) memanggil catat_transaksi_stok(..., p_panel) dan gagal
-- PGRST202. Aman dijalankan ulang (idempoten). Satu transaksi: gagal = batal semua.
-- ============================================================================================
BEGIN;

-- 1. Kolom panel (dipakai transaksi keluar manual)
ALTER TABLE public.komponen_stok_transaksi ADD COLUMN IF NOT EXISTS panel text;

-- 2. RPC: buang signature lama (8 parameter, tanpa p_panel) biar gak jadi overload ganda yang
--    ambigu, lalu buat versi final (9 parameter). Isi logika SAMA PERSIS dgn file migrasi final.
DROP FUNCTION IF EXISTS public.catat_transaksi_stok(bigint, text, integer, text, text, text, text, date);
CREATE OR REPLACE FUNCTION public.catat_transaksi_stok(
  p_komponen_id bigint, p_tipe text, p_jumlah integer,
  p_sumber text DEFAULT 'manual', p_keterangan text DEFAULT NULL, p_referensi text DEFAULT NULL,
  p_created_by text DEFAULT NULL, p_tanggal date DEFAULT current_date, p_panel text DEFAULT NULL
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
          v_jumlah, v_lama, v_baru, COALESCE(p_tanggal, current_date), p_keterangan, p_referensi, p_panel, p_created_by)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.catat_transaksi_stok(bigint, text, integer, text, text, text, text, date, text) TO anon, authenticated;

-- 3. Trigger: stok awal komponen baru = 'koreksi' (bukan 'masuk') - versi final.
CREATE OR REPLACE FUNCTION public.trg_komponen_stok_catat() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.stok_via_rpc', true), '0') = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.stok,0) > 0 THEN
      INSERT INTO public.komponen_stok_transaksi (komponen_id, tipe, sumber, jumlah, stok_sebelum, stok_sesudah, keterangan, created_by)
      VALUES (NEW.id, 'koreksi', 'koreksi_manual', NEW.stok, 0, NEW.stok, 'Stok awal saat komponen ditambahkan', NEW.created_by);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.stok,0) IS DISTINCT FROM COALESCE(OLD.stok,0) THEN
    INSERT INTO public.komponen_stok_transaksi (komponen_id, tipe, sumber, jumlah, stok_sebelum, stok_sesudah, keterangan, created_by)
    VALUES (NEW.id, 'koreksi', 'koreksi_manual', COALESCE(NEW.stok,0) - COALESCE(OLD.stok,0), COALESCE(OLD.stok,0), COALESCE(NEW.stok,0),
            'Perubahan stok langsung (di luar RPC) - dicatat otomatis', 'edit-langsung');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_komponen_stok_catat ON public.komponen_stok;
CREATE TRIGGER trg_komponen_stok_catat AFTER INSERT OR UPDATE OF stok ON public.komponen_stok
  FOR EACH ROW EXECUTE FUNCTION public.trg_komponen_stok_catat();

-- 4. Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'komponen_stok_transaksi') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.komponen_stok_transaksi;
  END IF;
END $$;

-- 5. Minta PostgREST muat ulang cache skema (biar signature RPC baru langsung dikenali)
NOTIFY pgrst, 'reload schema';

COMMIT;
