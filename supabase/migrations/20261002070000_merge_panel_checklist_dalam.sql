-- ============================================================================================
-- RPC merge_panel_checklist_dalam (2 Okt 2026) - simpan progress operator PER PROSES, bukan per
-- komponen. Insiden 30 Sep 2026 P-VAC 2A WM.4: RAKIT 100% (LEO, M.TOHA 09:12) hilang karena Simpan
-- Section PAINTING 09:37 dari HP yang datanya basi - merge_panel_checklist (20260831020000) cuma
-- merge TOP-LEVEL per kode (`checklist || p_partial`), jadi seluruh entri komponen (semua proses)
-- diganti salinan lokal operator.
--
-- Fungsi ini merge 2 tingkat lebih dalam: kode -> kolom (progress/history/qtyProses/busbarTahap/
-- fotoPemasangan/...) -> kunci di dalam kolom itu (proses / tahap / tanggal). Vista Pekerja cuma
-- mengirim bagian yang BERUBAH (helper buatPatchKomponen), jadi simpan PAINTING tidak pernah
-- menyentuh progress.RAKIT dst. Aturan:
-- - kolom bernilai object & kolom lama object  -> merge per kunci; kunci bernilai null DIHAPUS
-- - kolom bernilai object & kolom lama belum ada -> ditulis (tanpa kunci null)
-- - kolom bernilai null -> kolom dihapus;   nilai lain (angka/array/teks) -> diganti
-- Baris panel dikunci (FOR UPDATE) - 2 simpanan bersamaan diproses bergiliran. Trigger cap
-- Mekanik/BUSBAR tetap jalan (UPDATE biasa). RPC lama TIDAK dihapus (HP yang belum muat versi
-- baru tetap bisa simpan). Aman dijalankan ulang.
-- ============================================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.merge_panel_checklist_dalam(p_panel_id bigint, p_patch jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_cl jsonb; v_kode text; v_ent jsonb; v_field text; v_val jsonb; v_hapus text[];
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'p_patch harus object {kode: {...}}'; END IF;
  SELECT checklist INTO v_cl FROM public.panels WHERE id = p_panel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Panel % tidak ditemukan', p_panel_id; END IF;
  v_cl := CASE WHEN jsonb_typeof(v_cl) = 'object' THEN v_cl ELSE '{}'::jsonb END;
  FOR v_kode IN SELECT jsonb_object_keys(p_patch) LOOP
    IF jsonb_typeof(p_patch -> v_kode) <> 'object' THEN RAISE EXCEPTION 'patch kode % harus object', v_kode; END IF;
    v_ent := CASE WHEN jsonb_typeof(v_cl -> v_kode) = 'object' THEN v_cl -> v_kode ELSE '{}'::jsonb END;
    FOR v_field, v_val IN SELECT key, value FROM jsonb_each(p_patch -> v_kode) LOOP
      IF jsonb_typeof(v_val) = 'object' THEN
        SELECT COALESCE(array_agg(key), '{}'::text[]) INTO v_hapus FROM jsonb_each(v_val) WHERE value = 'null'::jsonb;
        IF jsonb_typeof(v_ent -> v_field) = 'object' THEN
          v_ent := v_ent || jsonb_build_object(v_field, ((v_ent -> v_field) || v_val) - v_hapus);
        ELSE
          v_ent := v_ent || jsonb_build_object(v_field, v_val - v_hapus);
        END IF;
      ELSIF v_val = 'null'::jsonb THEN
        v_ent := v_ent - v_field;
      ELSE
        v_ent := v_ent || jsonb_build_object(v_field, v_val);
      END IF;
    END LOOP;
    v_cl := v_cl || jsonb_build_object(v_kode, v_ent);
  END LOOP;
  UPDATE public.panels SET checklist = v_cl WHERE id = p_panel_id;
END $$;

GRANT EXECUTE ON FUNCTION public.merge_panel_checklist_dalam(bigint, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
