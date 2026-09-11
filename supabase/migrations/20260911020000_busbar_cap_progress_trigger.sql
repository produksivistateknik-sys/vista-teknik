-- Trigger DB: cap progress bertahap BUSBAR (11 Sep 2026, lapis kedua).
--
-- REVISI dari desain sebelumnya (gate "harus 100% dulu"): aturan final adalah CAPPING
-- BERTAHAP - progress tahap N TIDAK BOLEH MELEBIHI progress tahap N-1 di titik manapun,
-- bukan gate biner locked/unlocked. Tahap pertama (FABRIKASI) bebas 0-100, gak ada cap.
--
-- Root cause bug asli ("Heat-Shrink 100% padahal Plating 0%", panel 399/INCOMING - JANGAN
-- disentuh, masih nunggu tinjauan manual terpisah): validasi cuma ada di frontend (dan
-- itu pun bocor lewat 3 celah - rowHasActiveTimer salah prefix, gate 25% bukan mengikuti
-- progress aktual, canSimpanBusbarTahap gak cek urutan sama sekali). merge_panel_checklist()
-- RPC nerima payload apa pun tanpa validasi - siapa pun yang punya anon key bisa nulis
-- progress busbar sembarang urutan langsung lewat RPC, gak lewat UI sama sekali. Trigger
-- ini nutup celah itu di titik paling akhir sebelum data masuk DB - JALAN TERLEPAS dari
-- perbaikan frontend, gak ada bypass/escape hatch (reject keras).
--
-- Urutan tahap per kode direplikasi dari getUrutanTahapBusbar() (vista-pekerja/src/lib/
-- panelHelpers.tsx) - HARUS tetap sama persis: COUPLER/GROUND cuma 3 tahap (skip
-- HEATSHRINK), kode lain 4 tahap penuh.
--
-- Scope: HANYA memvalidasi kode komponen yang punya struktur `busbarTahap` di
-- checklist-nya (satu-satunya proses yang pakai struktur ini) - komponen/proses lain
-- (WIRING, PASANG KOMPONEN, dst, yang gak punya key `busbarTahap`) dilewati begitu saja,
-- gak divalidasi/gak kena pengaruh apa pun oleh trigger ini.
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

    if v_kode in ('COUPLER','GROUND') then
      v_urutan := array['FABRIKASI','PLATING','PASANG'];
    else
      v_urutan := array['FABRIKASI','PLATING','HEATSHRINK','PASANG'];
    end if;

    for i in 2..array_length(v_urutan,1) loop
      v_prev := coalesce((v_busbar_tahap #>> array[v_urutan[i-1],'progress'])::numeric, 0);
      v_cur  := coalesce((v_busbar_tahap #>> array[v_urutan[i],'progress'])::numeric, 0);
      if v_cur > v_prev then
        -- Gabung nilai+simbol persen jadi SATU string text dulu (v_cur_label/v_prev_label)
        -- sebelum di-RAISE - JANGAN taruh literal "%" langsung di format string RAISE
        -- (beda dari format()/printf: %% di RAISE selalu diperlakukan literal, gampang
        -- kebentrok sama placeholder lain dan bikin "too many/few parameters" - dicoba
        -- salah duluan, %% campur placeholder kacau).
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

drop trigger if exists trg_panels_validate_busbar_cap on public.panels;
create trigger trg_panels_validate_busbar_cap
  before update of checklist on public.panels
  for each row
  when (NEW.checklist is distinct from OLD.checklist)
  execute function public.panels_validate_busbar_cap_progress();

comment on function public.panels_validate_busbar_cap_progress() is
  'Cap progress bertahap BUSBAR: progress tahap N gak boleh > progress tahap N-1 (getUrutanTahapBusbar, COUPLER/GROUND skip HEATSHRINK). Reject keras, gak ada bypass. Lihat investigasi "Heat-Shrink 100% padahal Plating 0%", 11 Sep 2026.';
