-- ============================================================================================
-- RPC tambah_foto_dokumentasi (18 Okt 2026, antrean foto lokal vista-pekerja tahap 2, disetujui user: RPC atomik,
-- semua layar dokumentasi panel). Foto yang gagal terkirim disimpan di HP (IndexedDB) lalu dikirim ulang otomatis;
-- setelah file masuk R2, foto DITEMPEL lewat RPC ini dalam SATU perintah UPDATE (tidak membaca-lalu-menulis ulang
-- kolom dari HP) -> tidak bisa menimpa progres/foto yang ditulis HP lain di detik yang sama. URL yang sudah ada TIDAK
-- ditambah lagi (aman dikirim ulang). Panel yang sudah diarsip -> ditempel ke panels_archived (kolom sama).
--
-- p_tujuan:
--   'kolom'    : panels.<p_kunci> (array)   p_kunci IN nameplate_photos, yellowmark_photos, qs_photos, warehouse_photos,
--                pasang_komponen_photos
--   'qc'       : panels.qc_checklist -> <p_kunci = item QC> -> foto
--   'komponen' : panels.checklist -> <p_kunci = kode> -> fotoPemasangan (+ component_process_progress.photos
--                PASANG KOMPONEN tahap p_tahap, sama dgn updateComponentProcessProgressPhotos); p_ke_arsip = true ->
--                ikut ke panel_seksi_archived.data.fotoPemasangan (seksi assembling_luar & wiring_control, baris yang
--                ada saja - sama dgn simpanFotoArsipTambahan)
--   'proyek_luar' / 'mom_fat_poin' : <tabel>.foto, p_id = id baris
-- Hasil: {ditemukan, tabel, ditambah, total}. ditemukan=false -> panel/baris tidak ada (sudah dihapus).
-- SECURITY DEFINER: kebijakan RLS tabel-tabel ini tidak tercatat di repo (dibuat lewat dashboard) - tujuan/kolom
-- di-whitelist, isi wajib array objek ber-url http(s), maks 20 per panggilan.
-- Rollback: supabase/rollback/20261018020000_tambah_foto_dokumentasi_rollback.sql
-- Verifikasi: supabase/verifikasi/20261018020000_tambah_foto_dokumentasi_verifikasi.sql (harus 'SEMUA LULUS')
-- ============================================================================================
begin;

create or replace function public.tambah_foto_dokumentasi(
  p_tujuan text, p_id bigint, p_kunci text, p_foto jsonb, p_tahap text default null, p_ke_arsip boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_kolom_ok constant text[] := array['nameplate_photos','yellowmark_photos','qs_photos','warehouse_photos','pasang_komponen_photos'];
  v_tabel text; v_lama jsonb; v_baru jsonb; v_tambah jsonb; v_n int; v_ada boolean;
begin
  -- ── validasi isi ──
  if p_foto is null or jsonb_typeof(p_foto) <> 'array' or jsonb_array_length(p_foto) = 0 or jsonb_array_length(p_foto) > 20 then
    raise exception 'tambah_foto_dokumentasi: p_foto harus array 1-20 foto' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_foto) f
             where jsonb_typeof(f) <> 'object' or coalesce(f->>'url', '') !~ '^https?://' or length(f->>'url') > 1000) then
    raise exception 'tambah_foto_dokumentasi: tiap foto wajib objek dgn url http(s)' using errcode = '22023';
  end if;
  if p_tujuan not in ('kolom','qc','komponen','proyek_luar','mom_fat_poin') then
    raise exception 'tambah_foto_dokumentasi: tujuan % tidak dikenal', p_tujuan using errcode = '22023';
  end if;
  if p_tujuan = 'kolom' and not (p_kunci = any(v_kolom_ok)) then
    raise exception 'tambah_foto_dokumentasi: kolom % tidak diizinkan', p_kunci using errcode = '22023';
  end if;
  if p_tujuan in ('qc','komponen') and coalesce(p_kunci, '') = '' then
    raise exception 'tambah_foto_dokumentasi: p_kunci (item QC / kode komponen) wajib' using errcode = '22023';
  end if;

  -- ── tabel tujuan: panels, kalau tidak ada -> panels_archived ──
  if p_tujuan in ('kolom','qc','komponen') then
    if exists (select 1 from public.panels where id = p_id) then v_tabel := 'panels';
    elsif exists (select 1 from public.panels_archived where id = p_id) then v_tabel := 'panels_archived';
    else return jsonb_build_object('ditemukan', false, 'ditambah', 0);
    end if;
  else
    v_tabel := p_tujuan;
    execute format('select exists (select 1 from public.%I where id = $1)', v_tabel) into v_ada using p_id;
    if not v_ada then return jsonb_build_object('ditemukan', false, 'ditambah', 0); end if;
  end if;

  -- ── ambil array lama (DIKUNCI baris: FOR UPDATE) ──
  if p_tujuan = 'kolom' then
    execute format('select coalesce(%I, ''[]''::jsonb) from public.%I where id = $1 for update', p_kunci, v_tabel) into v_lama using p_id;
  elsif p_tujuan = 'qc' then
    execute format('select coalesce(qc_checklist -> $2 -> ''foto'', ''[]''::jsonb) from public.%I where id = $1 for update', v_tabel) into v_lama using p_id, p_kunci;
  elsif p_tujuan = 'komponen' then
    execute format('select coalesce(checklist -> $2 -> ''fotoPemasangan'', ''[]''::jsonb) from public.%I where id = $1 for update', v_tabel) into v_lama using p_id, p_kunci;
  else
    execute format('select coalesce(foto, ''[]''::jsonb) from public.%I where id = $1 for update', v_tabel) into v_lama using p_id;
  end if;
  if jsonb_typeof(v_lama) <> 'array' then v_lama := '[]'::jsonb; end if;

  -- foto baru yang URL-nya belum ada (urutan dipertahankan, dobel di p_foto sendiri juga dibuang)
  select coalesce(jsonb_agg(f order by o), '[]'::jsonb) into v_tambah
  from (select distinct on (f->>'url') f, o from jsonb_array_elements(p_foto) with ordinality x(f, o) order by f->>'url', o) d
  where not exists (select 1 from jsonb_array_elements(v_lama) l where l->>'url' = d.f->>'url');
  v_n := jsonb_array_length(v_tambah);
  v_baru := v_lama || v_tambah;

  if v_n > 0 then
    if p_tujuan = 'kolom' then
      execute format('update public.%I set %I = $2 where id = $1', v_tabel, p_kunci) using p_id, v_baru;
    elsif p_tujuan = 'qc' then
      execute format($u$update public.%I set qc_checklist = jsonb_set(coalesce(qc_checklist, '{}'::jsonb), array[$2],
          coalesce(qc_checklist -> $2, '{"status":"to_do","catatan":""}'::jsonb) || jsonb_build_object('foto', $3::jsonb)) where id = $1$u$, v_tabel)
        using p_id, p_kunci, v_baru;
    elsif p_tujuan = 'komponen' then
      execute format($u$update public.%I set checklist = jsonb_set(coalesce(checklist, '{}'::jsonb), array[$2],
          coalesce(checklist -> $2, '{}'::jsonb) || jsonb_build_object('fotoPemasangan', $3::jsonb)) where id = $1$u$, v_tabel)
        using p_id, p_kunci, v_baru;
    else
      execute format('update public.%I set foto = $2 where id = $1', v_tabel) using p_id, v_baru;
    end if;
  end if;

  if p_tujuan = 'komponen' and v_n > 0 then
    -- sama dgn updateComponentProcessProgressPhotos (UPDATE saja, no-op kalau baris belum ada)
    update public.component_process_progress set photos = v_baru, updated_at = now()
    where panel_id = p_id and kode_komponen = p_kunci and proses = 'PASANG KOMPONEN' and tahap_key = coalesce(p_tahap, '');
    if p_ke_arsip then
      update public.panel_seksi_archived a
      set data = jsonb_set(coalesce(a.data, '{}'::jsonb), '{fotoPemasangan}',
                 coalesce(a.data -> 'fotoPemasangan', '[]'::jsonb)
                 || coalesce((select jsonb_agg(f) from jsonb_array_elements(v_tambah) f
                              where not exists (select 1 from jsonb_array_elements(coalesce(a.data -> 'fotoPemasangan', '[]'::jsonb)) l
                                                where l->>'url' = f->>'url')), '[]'::jsonb))
      where a.panel_id = p_id and a.kode = p_kunci and a.seksi in ('assembling_luar', 'wiring_control');
    end if;
  end if;

  return jsonb_build_object('ditemukan', true, 'tabel', v_tabel, 'ditambah', v_n, 'total', jsonb_array_length(v_baru));
end $$;

revoke all on function public.tambah_foto_dokumentasi(text, bigint, text, jsonb, text, boolean) from public;
grant execute on function public.tambah_foto_dokumentasi(text, bigint, text, jsonb, text, boolean) to anon, authenticated;

commit;
