-- VERIFIKASI tambah_foto_dokumentasi (jalankan SESUDAH migration 20261018020000). Semua uji di transaksi yang
-- di-ROLLBACK (panel nyata dipakai sbg bahan uji, perubahan tidak tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_p bigint; v_kode text; v_h jsonb; v_n int; v_lama int;
  f1 jsonb := '[{"url":"https://uji.invalid/a.jpg","name":"a.jpg","mime":"image/jpeg","uploaded_by":"UJI"}]';
  f2 jsonb := '[{"url":"https://uji.invalid/a.jpg"},{"url":"https://uji.invalid/b.jpg"},{"url":"https://uji.invalid/b.jpg"}]';
begin
  select id into v_p from public.panels order by id limit 1;
  if v_p is null then raise exception 'GAGAL V0: tidak ada panel utk uji'; end if;

  -- V1: kolom array + anti-dobel
  v_lama := coalesce(jsonb_array_length((select nameplate_photos from public.panels where id = v_p)), 0);
  v_h := public.tambah_foto_dokumentasi('kolom', v_p, 'nameplate_photos', f1);
  if (v_h->>'ditambah')::int <> 1 then raise exception 'GAGAL V1a: %', v_h; end if;
  v_h := public.tambah_foto_dokumentasi('kolom', v_p, 'nameplate_photos', f2);
  if (v_h->>'ditambah')::int <> 1 then raise exception 'GAGAL V1b (a.jpg dobel & b.jpg dobel harus jadi 1): %', v_h; end if;
  if jsonb_array_length((select nameplate_photos from public.panels where id = v_p)) <> v_lama + 2 then raise exception 'GAGAL V1c: jumlah foto salah'; end if;
  raise notice 'LULUS V1: kolom array, URL dobel tidak ditambah';

  -- V2: QC item (item baru dibuat dgn status to_do; status/catatan item lama tidak berubah)
  v_h := public.tambah_foto_dokumentasi('qc', v_p, 'uji_item_qc', f1);
  if (select qc_checklist->'uji_item_qc'->>'status' from public.panels where id = v_p) <> 'to_do'
     or jsonb_array_length((select qc_checklist->'uji_item_qc'->'foto' from public.panels where id = v_p)) <> 1 then
    raise exception 'GAGAL V2: %', (select qc_checklist->'uji_item_qc' from public.panels where id = v_p);
  end if;
  raise notice 'LULUS V2: foto QC per item';

  -- V3: komponen - progress & kolom lain checklist tidak berubah
  select key into v_kode from public.panels p, jsonb_each(p.checklist) where p.id = v_p limit 1;
  if v_kode is not null then
    v_lama := coalesce(jsonb_array_length((select checklist->v_kode->'fotoPemasangan' from public.panels where id = v_p)), 0);
    create temp table _uji_cl on commit drop as select (checklist->v_kode) - 'fotoPemasangan' as isi from public.panels where id = v_p;
    v_h := public.tambah_foto_dokumentasi('komponen', v_p, v_kode, f1, null, true);
    if jsonb_array_length((select checklist->v_kode->'fotoPemasangan' from public.panels where id = v_p)) <> v_lama + 1 then raise exception 'GAGAL V3a: %', v_h; end if;
    if (select (checklist->v_kode) - 'fotoPemasangan' from public.panels where id = v_p) is distinct from (select isi from _uji_cl) then
      raise exception 'GAGAL V3b: isi checklist selain fotoPemasangan ikut berubah';
    end if;
    raise notice 'LULUS V3: foto komponen %, isi checklist lain utuh', v_kode;
  else raise notice 'LEWATI V3: panel % tanpa checklist', v_p;
  end if;

  -- V4: tidak ditemukan & input ditolak
  v_h := public.tambah_foto_dokumentasi('kolom', -1, 'qs_photos', f1);
  if (v_h->>'ditemukan')::boolean then raise exception 'GAGAL V4a: panel -1 dianggap ada'; end if;
  begin perform public.tambah_foto_dokumentasi('kolom', v_p, 'checklist', f1); raise exception 'GAGAL V4b: kolom checklist lolos';
  exception when sqlstate '22023' then null; end;
  begin perform public.tambah_foto_dokumentasi('kolom', v_p, 'qs_photos', '[{"url":"javascript:alert(1)"}]'); raise exception 'GAGAL V4c: url bukan http lolos';
  exception when sqlstate '22023' then null; end;
  begin perform public.tambah_foto_dokumentasi('proyek_luar', 1, null, '[]'); raise exception 'GAGAL V4d: array kosong lolos';
  exception when sqlstate '22023' then null; end;
  raise notice 'LULUS V4: tidak ditemukan -> ditemukan=false; kolom/url/array tidak sah ditolak (22023)';

  -- V5: hak akses
  if not has_function_privilege('anon', 'public.tambah_foto_dokumentasi(text,bigint,text,jsonb,text,boolean)', 'execute') then
    raise exception 'GAGAL V5: anon tidak bisa memanggil';
  end if;
  raise notice 'LULUS V5: anon boleh memanggil';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
