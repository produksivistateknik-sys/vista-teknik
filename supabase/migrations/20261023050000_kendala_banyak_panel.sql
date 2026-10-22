-- ============================================================================================
-- KENDALA: catat ke BANYAK PANEL sekaligus (23 Okt 2026, tampilan operator "Kendala Operator Cepat").
-- Operator memilih N panel (atau "Umum" saja) -> N baris kendala terpisah (teks, waktu, pencatat sama) dalam SATU
-- transaksi: semua tersimpan atau tidak sama sekali. Status Selesai tetap PER BARIS/PANEL (tidak berubah).
-- grup_id (uuid, boleh kosong): penanda baris yang dicatat bersamaan - untuk tampilan "dicatat di N panel" & laporan;
-- tidak dipakai aturan apa pun. Baris lama / catat satu panel: grup_id kosong.
-- Keterangan wajib: teks kosong / hanya spasi / < 3 huruf ditolak dgn pesan jelas (selain check constraint tabel).
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja). Harap: kolom grup_id belum ada; fungsi catat_kendala_banyak belum ada.
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'kendala_produksi' and column_name = 'grup_id';
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'catat_kendala_banyak';

-- (1) EKSEKUSI
begin;
alter table public.kendala_produksi add column if not exists grup_id uuid;
create index if not exists kendala_produksi_grup on public.kendala_produksi (grup_id) where grup_id is not null;

-- p_panel_ids kosong/null = "Umum" (1 baris). Panel harus panel aktif milik proyek itu. Duplikat id diabaikan.
create or replace function public.catat_kendala_banyak(p_proyek text, p_panel_ids bigint[], p_teks text, p_oleh text, p_divisi text, p_sumber text default 'operator')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids bigint[]; v_grup uuid; v_id bigint; v_nama text; v_wo bigint; v_wo_no text; v_wo_proyek text;
        v_row public.kendala_produksi; v_hasil jsonb := '[]'::jsonb; v_sumber text;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pencatat wajib'; end if;
  if coalesce(btrim(p_proyek), '') = '' then raise exception 'Proyek wajib'; end if;
  if coalesce(btrim(p_teks), '') = '' then raise exception 'Keterangan kendala wajib diisi'; end if;
  if length(btrim(p_teks)) < 3 then raise exception 'Keterangan terlalu pendek (minimal 3 huruf)'; end if;
  v_sumber := case when p_sumber = 'admin' then 'admin' else 'operator' end;
  select array_agg(distinct x order by x) into v_ids from unnest(coalesce(p_panel_ids, '{}'::bigint[])) x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    -- Umum
    if not exists (select 1 from public.work_orders w where w.proyek = p_proyek and w.deleted_at is null) then raise exception 'Proyek % tidak ditemukan', p_proyek; end if;
    insert into public.kendala_produksi (proyek, teks, pencatat, divisi, sumber)
    values (p_proyek, btrim(p_teks), btrim(p_oleh), p_divisi, v_sumber) returning * into v_row;
    insert into public.kendala_produksi_log (kendala_id, aksi, oleh, sesudah) values (v_row.id, 'catat', v_row.pencatat, to_jsonb(v_row));
    return jsonb_build_array(to_jsonb(v_row));
  end if;
  if cardinality(v_ids) > 1 then v_grup := gen_random_uuid(); end if;
  foreach v_id in array v_ids loop
    select p.nama, p.wo_id into v_nama, v_wo from public.panels p where p.id = v_id and p.deleted_at is null;
    if not found then raise exception 'Panel % tidak ditemukan / sudah dihapus', v_id; end if;
    select w.wo, w.proyek into v_wo_no, v_wo_proyek from public.work_orders w where w.id = v_wo;
    if v_wo_proyek is distinct from p_proyek then raise exception 'Panel % bukan milik proyek %', v_nama, p_proyek; end if;
    insert into public.kendala_produksi (proyek, wo_id, wo_number, panel_id, panel_nama, teks, pencatat, divisi, sumber, grup_id)
    values (p_proyek, v_wo, v_wo_no, v_id, v_nama, btrim(p_teks), btrim(p_oleh), p_divisi, v_sumber, v_grup) returning * into v_row;
    insert into public.kendala_produksi_log (kendala_id, aksi, oleh, sesudah) values (v_row.id, 'catat', v_row.pencatat, to_jsonb(v_row));
    v_hasil := v_hasil || jsonb_build_array(to_jsonb(v_row));
  end loop;
  return v_hasil;
end $$;
revoke all on function public.catat_kendala_banyak(text, bigint[], text, text, text, text) from public;
grant execute on function public.catat_kendala_banyak(text, bigint[], text, text, text, text) to anon, authenticated;
commit;

-- (2) VERIFIKASI
--  a. kolom & fungsi ada (harap 1 baris tiap query)
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'kendala_produksi' and column_name = 'grup_id';
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'catat_kendala_banyak';
--  b. uji di transaksi yang DIBATALKAN (tidak meninggalkan data). Harap: TIDAK ada error.
--     2 panel -> 2 baris 1 grup; Umum -> 1 baris tanpa grup; teks kosong ditolak; panel proyek lain -> SEMUA batal.
begin;
do $$
declare v jsonb; v_proyek text; v_p1 bigint; v_p2 bigint; v_lain bigint; v_n0 int; v_n1 int;
begin
  select w.proyek, min(p.id), max(p.id) into v_proyek, v_p1, v_p2
    from public.work_orders w join public.panels p on p.wo_id = w.id and p.deleted_at is null
   where w.deleted_at is null and coalesce(w.is_archived, false) = false
   group by w.proyek having count(*) >= 2 order by w.proyek limit 1;
  select p.id into v_lain from public.panels p join public.work_orders w on w.id = p.wo_id
   where p.deleted_at is null and w.proyek <> v_proyek limit 1;
  v := public.catat_kendala_banyak(v_proyek, array[v_p1, v_p2], 'uji banyak panel', 'UJI', 'mekanik');
  if jsonb_array_length(v) <> 2 or (v->0->>'grup_id') is null or (v->0->>'grup_id') <> (v->1->>'grup_id') then raise exception 'SALAH: 2 panel tidak jadi 2 baris satu grup'; end if;
  v := public.catat_kendala_banyak(v_proyek, '{}', 'uji umum', 'UJI', 'mekanik');
  if jsonb_array_length(v) <> 1 or (v->0->>'panel_id') is not null or (v->0->>'grup_id') is not null then raise exception 'SALAH: Umum'; end if;
  begin perform public.catat_kendala_banyak(v_proyek, array[v_p1], '   ', 'UJI', 'mekanik'); raise exception 'SALAH: teks kosong diterima';
  exception when others then if sqlerrm like 'SALAH%' then raise; end if; end;
  select count(*) into v_n0 from public.kendala_produksi;
  begin perform public.catat_kendala_banyak(v_proyek, array[v_p1, v_lain], 'uji campur', 'UJI', 'mekanik'); raise exception 'SALAH: panel proyek lain diterima';
  exception when others then if sqlerrm like 'SALAH%' then raise; end if; end;
  select count(*) into v_n1 from public.kendala_produksi;
  if v_n1 <> v_n0 then raise exception 'SALAH: sebagian baris tersimpan walau gagal'; end if;
  raise notice 'UJI LULUS';
end $$;
rollback;

-- (3) ROLLBACK (bila keliru):
-- begin;
-- drop function if exists public.catat_kendala_banyak(text, bigint[], text, text, text, text);
-- drop index if exists public.kendala_produksi_grup;
-- alter table public.kendala_produksi drop column if exists grup_id;
-- commit;
