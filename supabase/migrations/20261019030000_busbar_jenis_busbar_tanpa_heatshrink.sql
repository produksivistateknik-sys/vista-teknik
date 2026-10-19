-- JENIS PANEL BUSBAR TANPA HEAT-SHRINK (19 Okt 2026, permintaan user: "hapus heat shrink di jenis panel busbar").
-- Panel jenis BUSBAR (tipe = 'BUSBAR', lihat TIPE_PANEL_BUSBAR_SAJA) -> SEMUA komponen busbar 3 tahap:
-- Fabrikasi/Plating/Pasang. Jenis panel lain TIDAK berubah (COUPLER/GROUND/COUPLE-AN tetap 3 tahap, sisanya 4).
--
-- Trigger ini WAJIB tetap sama persis dengan getUrutanTahapBusbar(kode, tipe) (vista-pekerja/src/lib/panelHelpers.tsx,
-- diubah bareng di branch busbar-tanpa-heatshrink) - kalau beda, operator bisa kekunci progress PASANG.
-- Jalankan migration ini SEBELUM vista-pekerja versi baru live: dengan trigger lama, simpan PASANG di panel jenis
-- BUSBAR yang tak punya HEATSHRINK akan DITOLAK (PASANG dibandingkan HEATSHRINK = 0). Aplikasi lama tetap aman
-- dengan trigger baru (tahap HEATSHRINK yang masih terkirim diabaikan untuk jenis BUSBAR).
--
-- CREATE OR REPLACE persis fungsi 20260923020000_busbar_couple_an_skip_heatshrink.sql (dicek identik dgn backup DB
-- 9 Okt 2026), satu-satunya perubahan: syarat 3 tahap ditambah "or NEW.tipe = 'BUSBAR'".
-- Verifikasi: supabase/verifikasi/20261019030000_busbar_jenis_busbar_tanpa_heatshrink_verifikasi.sql
-- Rollback  : supabase/rollback/20261019030000_busbar_jenis_busbar_tanpa_heatshrink_rollback.sql
create or replace function public.panels_validate_busbar_cap_progress()
returns trigger
language plpgsql
as $$
declare
  v_kode text;
  v_komponen jsonb;
  v_busbar_tahap jsonb;
  v_urutan text[];
  i int;
  v_prev numeric;
  v_cur numeric;
  v_cur_label text;
  v_prev_label text;
begin
  if NEW.checklist is null then
    return NEW;
  end if;

  for v_kode, v_komponen in
    select key, value from jsonb_each(NEW.checklist)
  loop
    if jsonb_typeof(v_komponen) <> 'object' then
      continue;
    end if;
    v_busbar_tahap := v_komponen->'busbarTahap';
    if v_busbar_tahap is null or jsonb_typeof(v_busbar_tahap) <> 'object' then
      continue;
    end if;

    if v_kode in ('COUPLER','GROUND','COUPLE-AN') or NEW.tipe = 'BUSBAR' then
      v_urutan := array['FABRIKASI','PLATING','PASANG'];
    else
      v_urutan := array['FABRIKASI','PLATING','HEATSHRINK','PASANG'];
    end if;

    for i in 2..array_length(v_urutan,1) loop
      v_prev := coalesce((v_busbar_tahap #>> array[v_urutan[i-1],'progress'])::numeric, 0);
      v_cur  := coalesce((v_busbar_tahap #>> array[v_urutan[i],'progress'])::numeric, 0);
      if v_cur > v_prev then
        v_cur_label := v_cur::text || '%';
        v_prev_label := v_prev::text || '%';
        raise exception 'Panel id % - komponen %: % (%) tidak boleh melebihi % (%)',
          NEW.id, v_kode, v_urutan[i], v_cur_label, v_urutan[i-1], v_prev_label;
      end if;
    end loop;
  end loop;

  return NEW;
end;
$$;

comment on function public.panels_validate_busbar_cap_progress() is
  'Cap progress bertahap BUSBAR: progress tahap N gak boleh > progress tahap N-1 (getUrutanTahapBusbar, COUPLER/GROUND/COUPLE-AN skip HEATSHRINK; panel jenis BUSBAR semua komponen skip HEATSHRINK sejak 19 Okt 2026). Reject keras, gak ada bypass. Lihat investigasi "Heat-Shrink 100% padahal Plating 0%", 11 Sep 2026; COUPLE-AN ditambah 23 Sep 2026.';
