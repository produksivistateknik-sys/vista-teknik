-- BUSDUCT/COUPLE-AN (23 Sep 2026) - 2 jenis busbar baru, FS/F3B saja (BUSBAR_KOMPONEN,
-- vista-teknik/src/constants/panelTypes.ts). COUPLE-AN skip tahap HEATSHRINK (3 tahap:
-- Fabrikasi/Plating/Pasang, sama persis pola COUPLER/GROUND yang sudah ada) - keputusan
-- eksplisit user. BUSDUCT TIDAK ditambahkan ke daftar ini - tetap 4 tahap penuh (default).
--
-- Trigger ini WAJIB tetap sama persis dengan getUrutanTahapBusbar() (vista-pekerja/src/lib/
-- panelHelpers.tsx, sudah diupdate bareng migration ini) - kalau beda, operator bisa kekunci
-- progress PASANG (trigger reject keras kalau tahap N > tahap N-1, gak ada bypass).
--
-- CREATE OR REPLACE persis fungsi 20260911020000_busbar_cap_progress_trigger.sql, satu-satunya
-- perubahan baris 54 (daftar pengecualian): ('COUPLER','GROUND') -> ('COUPLER','GROUND','COUPLE-AN').
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

    if v_kode in ('COUPLER','GROUND','COUPLE-AN') then
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
  'Cap progress bertahap BUSBAR: progress tahap N gak boleh > progress tahap N-1 (getUrutanTahapBusbar, COUPLER/GROUND/COUPLE-AN skip HEATSHRINK). Reject keras, gak ada bypass. Lihat investigasi "Heat-Shrink 100% padahal Plating 0%", 11 Sep 2026; COUPLE-AN ditambah 23 Sep 2026.';
