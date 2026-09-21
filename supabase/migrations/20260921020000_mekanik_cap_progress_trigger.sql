-- Trigger DB: cap progress bertahap POTONG->BENDING->STEL->FINISHING (21 Sep 2026).
--
-- Pola SAMA PERSIS panels_validate_busbar_cap_progress() (20260911020000) - progress tahap
-- N tidak boleh melebihi progress tahap N-1, reject keras di DB, jalan terlepas dari validasi
-- frontend, gak ada bypass. Bagian dari restrukturisasi navigasi "MEKANIK" (Potong/Bending/
-- Stel/Finishing digabung jadi 1 login, lihat commit terkait vista-pekerja).
--
-- BEDA STRUKTUR dari BUSBAR: BUSBAR nested (checklist[kode].busbarTahap.{TAHAP}.progress),
-- 4 proses ini FLAT sejajar (checklist[kode].progress.POTONG dst) - gak perlu traversal
-- nested, cukup baca key langsung dari objek progress.
--
-- SKIP-CASE (beda dari BUSBAR yang cuma hardcode 2 kode COUPLER/GROUND skip HEATSHRINK):
-- dicek live 21 Sep 2026, bom_proses_relevan PUNYA kasus nyata kode BOM yang skip salah satu
-- dari 4 proses ini (bukan cuma hipotetis) - 12 pasangan (kode_komponen,tipe_panel) ditemukan:
--   - WM_SS.1/2/6/7/8/9/10 (tipe WM_SS) & WM.4 (tipe WM_POLY): skip STEL (POTONG->BENDING->FINISHING)
--   - FS.10 (tipe FS) & F3B.12 (tipe F3B): skip BENDING (POTONG->STEL->FINISHING)
--   - WM_SS.5: cuma POTONG & FINISHING relevan (skip BENDING+STEL)
--   - WM_SS.11: cuma FINISHING relevan (skip POTONG+BENDING+STEL)
-- Trigger ini SENGAJA gak hardcode kode per kode (beda dari BUSBAR) - query bom_proses_relevan
-- LANGSUNG per (kode,tipe) saat validasi, biar otomatis ngikutin kalau admin ubah/tambah
-- pengecualian lewat "Atur Proses Relevan" (KapasitasPekerjaanTab.tsx) tanpa perlu migrasi
-- ulang. Kalau (kode,tipe) SAMA SEKALI gak punya mapping eksplisit di bom_proses_relevan
-- utk keempat proses ini, default AMAN: anggap semua 4 relevan (mayoritas kasus, cocok sama
-- fallback isKomponenRelevant() frontend "if(!relevanProses) return true").
create or replace function public.panels_validate_mekanik_cap_progress()
returns trigger
language plpgsql
as $$
declare
  v_kode text;
  v_komponen jsonb;
  v_progress jsonb;
  v_all_urutan text[] := array['POTONG','BENDING','STEL','FINISHING'];
  v_urutan text[];
  v_has_mapping boolean;
  v_p text;
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
    v_progress := v_komponen->'progress';
    if v_progress is null or jsonb_typeof(v_progress) <> 'object' then
      continue;
    end if;

    -- Cek apakah (kode,tipe) ini punya mapping eksplisit di bom_proses_relevan utk SALAH SATU
    -- dari 4 proses ini - kalau ada, relevansi tiap proses ditentukan STRIK dari keberadaan
    -- barisnya (persis logika isKomponenRelevant/GLOBAL_PROSES_RELEVAN_HAS_MAPPING frontend,
    -- di-scope ke 4 proses ini aja - bukan replikasi penuh 3 lapis fallback termasuk
    -- KOMPONEN_PROSES_MAP hardcoded TS yang gak bisa diakses dari SQL).
    select exists(
      select 1 from public.bom_proses_relevan
      where kode_komponen = v_kode and tipe_panel = NEW.tipe
        and jenis_pekerjaan = any(v_all_urutan)
    ) into v_has_mapping;

    v_urutan := array[]::text[];
    if v_has_mapping then
      foreach v_p in array v_all_urutan loop
        if exists(
          select 1 from public.bom_proses_relevan
          where kode_komponen = v_kode and tipe_panel = NEW.tipe and jenis_pekerjaan = v_p
        ) then
          v_urutan := array_append(v_urutan, v_p);
        end if;
      end loop;
    else
      v_urutan := v_all_urutan;
    end if;

    for i in 2..coalesce(array_length(v_urutan,1),0) loop
      v_prev := coalesce((v_progress->>v_urutan[i-1])::numeric, 0);
      v_cur  := coalesce((v_progress->>v_urutan[i])::numeric, 0);
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

-- Index penunjang - trigger ini query bom_proses_relevan per kode_komponen tiap update
-- checklist, panel dengan banyak kode (40+) bisa berarti ratusan lookup kecil per save.
create index if not exists bom_proses_relevan_kode_tipe_proses_idx
  on public.bom_proses_relevan(kode_komponen, tipe_panel, jenis_pekerjaan);

drop trigger if exists trg_panels_validate_mekanik_cap on public.panels;
create trigger trg_panels_validate_mekanik_cap
  before update of checklist on public.panels
  for each row
  when (NEW.checklist is distinct from OLD.checklist)
  execute function public.panels_validate_mekanik_cap_progress();

comment on function public.panels_validate_mekanik_cap_progress() is
  'Cap progress bertahap POTONG->BENDING->STEL->FINISHING, skip-aware lewat bom_proses_relevan per (kode,tipe). Reject keras, gak ada bypass. Bagian restrukturisasi navigasi MEKANIK, 21 Sep 2026.';
