CREATE OR REPLACE FUNCTION sync_fcs_from_panel_progress()
RETURNS TRIGGER AS $$
DECLARE
  komponen_key TEXT;
  komponen_data JSONB;
  proses_key TEXT;
  progress_val NUMERIC;
  new_status TEXT;
BEGIN
  -- Hanya proses kalau checklist berubah
  IF NEW.checklist IS DISTINCT FROM OLD.checklist THEN
    
    -- Loop setiap komponen di checklist
    FOR komponen_key, komponen_data IN SELECT * FROM jsonb_each(NEW.checklist)
    LOOP
      -- Loop setiap proses di progress komponen ini
      FOR proses_key, progress_val IN 
        SELECT key, value::numeric 
        FROM jsonb_each_text(komponen_data->'progress')
      LOOP
        -- Tentukan status baru berdasarkan progress
        IF progress_val >= 100 THEN
          new_status := 'completed';
        ELSIF progress_val > 0 THEN
          new_status := 'in_progress';
        ELSE
          new_status := NULL; -- tidak ubah apa-apa kalau progress 0
        END IF;

        -- Update fcs_schedule kalau ada status baru
        IF new_status IS NOT NULL THEN
          UPDATE fcs_schedule
          SET status = new_status
          WHERE panel_id = NEW.id
            AND kode_komponen = komponen_key
            AND jenis_pekerjaan = proses_key
            AND status NOT IN ('completed', 'cancelled'); -- jangan downgrade yang sudah completed
        END IF;

      END LOOP;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_fcs_from_panel ON panels;

CREATE TRIGGER trg_sync_fcs_from_panel
  AFTER UPDATE ON panels
  FOR EACH ROW
  EXECUTE FUNCTION sync_fcs_from_panel_progress();
