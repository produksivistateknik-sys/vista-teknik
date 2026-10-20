-- JENIS PANEL BUSBAR TANPA PASANG (20 Okt 2026, permintaan user: "hilangkan proses pasang di jenis panel busbar, jadi hanya
-- fabrikasi dan plating saja"). Panel jenis BUSBAR (tipe = 'BUSBAR') -> SEMUA komponen busbar 2 tahap: Fabrikasi/Plating.
-- Jenis panel lain TIDAK berubah (COUPLER/GROUND/COUPLE-AN 3 tahap, sisanya 4).
--
-- Trigger ini WAJIB sama persis dengan getUrutanTahapBusbar(kode, tipe) (vista-pekerja/src/lib/panelHelpers.tsx, branch
-- busbar-tanpa-pasang). Aman dijalankan SEBELUM vista-pekerja versi baru: aturan 2 tahap lebih longgar dari 3 tahap
-- (PASANG yang masih terkirim aplikasi lama diabaikan untuk jenis BUSBAR).
--
-- CREATE OR REPLACE persis fungsi 20261019030000_busbar_jenis_busbar_tanpa_heatshrink.sql, satu-satunya perubahan: cabang
-- NEW.tipe = 'BUSBAR' -> array['FABRIKASI','PLATING'] (diperiksa duluan).
-- Verifikasi: supabase/verifikasi/20261020010000_busbar_jenis_busbar_tanpa_pasang_verifikasi.sql
-- Rollback  : supabase/rollback/20261020010000_busbar_jenis_busbar_tanpa_pasang_rollback.sql (= versi 19 Okt, 3 tahap)
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

    if NEW.tipe = 'BUSBAR' then
      v_urutan := array['FABRIKASI','PLATING'];
    elsif v_kode in ('COUPLER','GROUND','COUPLE-AN') then
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
  'Cap progress bertahap BUSBAR: progress tahap N gak boleh > progress tahap N-1 (getUrutanTahapBusbar, COUPLER/GROUND/COUPLE-AN skip HEATSHRINK; panel jenis BUSBAR semua komponen HANYA FABRIKASI+PLATING sejak 20 Okt 2026, sebelumnya tanpa HEATSHRINK 19 Okt). Reject keras, gak ada bypass. Lihat investigasi "Heat-Shrink 100% padahal Plating 0%", 11 Sep 2026; COUPLE-AN ditambah 23 Sep 2026.';
