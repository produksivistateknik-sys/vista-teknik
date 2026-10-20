-- ROLLBACK 20261020010000_busbar_jenis_busbar_tanpa_pasang: kembalikan trigger ke versi 19 Okt 2026 (jenis BUSBAR 3 tahap
-- Fabrikasi/Plating/Pasang). Jalankan BAGIAN 3 (rollback) skrip 20261020_busbar_jenis_busbar_2_tahap.sql DULU (kembalikan
-- isian PASANG), dan kembalikan vista-pekerja juga.
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
