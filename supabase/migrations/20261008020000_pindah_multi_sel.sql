-- PINDAH BANYAK SEL RAW SCHEDULE SEKALIGUS - ATOMIK + UNDO (8 Okt 2026)
-- Rollback: supabase/rollback/20261008020000_pindah_multi_sel_rollback.sql
--
-- Dipakai fitur multi-pilih Raw Schedule (drag >=2 sel & Ctrl+X/Ctrl+V). Drag 1 sel lama TIDAK
-- memakai ini (tetap jalur confirmDrag + lib/renharSinkron.ts).
--
-- Pembagian kerja (supaya logika jadwal tetap SATU sumber):
-- - schedule raw_schedule BARU dihitung di aplikasi dgn helper yang SAMA dgn drag 1 sel
--   (jejak digeserKe bila ada pengerjaan di tanggal asal, manualPin di tujuan, komponen selesai
--   tidak ikut). RPC menerima {raw_id, sebelum, sesudah} per baris dan MENOLAK kalau jadwal di DB
--   sudah berbeda dari `sebelum` (diubah orang lain sejak layar dimuat) - tidak pernah menimpa.
-- - renhar dipindah di SINI (setara lib/renharSinkron.ts pindahKomponenRenhar: tambah ke tujuan
--   dulu baru kurangi asal; tujuan sudah ada -> digabung; pindah semua & tujuan kosong -> baris
--   asal digeser tanggalnya; kode dibersihkan dari komponen/komponen_released/pekerja_per_komponen
--   asal; baris tidak pernah dihapus). Ubah keduanya bersamaan kalau salah satu diubah.
-- - Hari Minggu sebagai tujuan DITOLAK (aturan khusus multi-pindah, keputusan user 8 Okt 2026).
-- Semua dalam 1 transaksi: satu saja gagal/ditolak = tidak ada yang berubah.
--
-- Mengembalikan SNAPSHOT utk undo: raw (sebelum & sesudah), renhar_sebelum (keadaan PERSIS baris yang
-- disentuh sebelum dipindah), renhar_dibuat (id baris baru), renhar_sesudah (keadaan setelah pindah).
-- pulihkan_multi_sel(snapshot) MEMULIHKAN keadaan persis sebelum (bukan pindah balik - pindah balik
-- akan menambah jejak baru), dan MENOLAK bila ada data yang sudah berubah lagi sejak dipindah.
--
-- Tidak menambah trigger. Tabel/RLS tidak diubah. SECURITY DEFINER (pola set_bom_proses_relevan):
-- undo perlu menghapus baris renhar yang dibuat oleh pindah ini.

create or replace function public._renhar_snap(p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id, 'raw_id', r.raw_id, 'wp', r.wp, 'tanggal', r.tanggal,
    'komponen', coalesce(r.komponen, '[]'::jsonb),
    'komponen_released', to_jsonb(coalesce(r.komponen_released, '{}'::text[])),
    'pekerja_per_komponen', coalesce(r.pekerja_per_komponen, '{}'::jsonb))
  from public.renhar r where r.id = p_id;
$$;


create or replace function public.pindah_multi_sel(p_sel jsonb, p_rows jsonb, p_renhar jsonb, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb; op jsonb;
  v_raw_id bigint; v_cur jsonb;
  v_raw_out jsonb := '[]'::jsonb;
  v_seen bigint[] := '{}';          -- id renhar yang sudah dicatat keadaan "sebelum"-nya
  v_sebelum jsonb := '[]'::jsonb;
  v_dibuat bigint[] := '{}';
  v_kode text[]; v_pindah text[]; v_sisa text[]; v_rel text[]; v_ppk jsonb;
  v_asal public.renhar%rowtype; v_tujuan public.renhar%rowtype;
  v_ada_tujuan boolean; v_baru_id bigint;
  v_dari date; v_ke date; v_wp text;
  v_minggu int := 0; v_n_sel int;
  v_sesudah jsonb := '[]'::jsonb; v_id bigint;
begin
  v_n_sel := jsonb_array_length(coalesce(p_sel, '[]'::jsonb));
  if v_n_sel = 0 then raise exception 'Tidak ada sel yang dipindah' using errcode = 'P0001'; end if;

  -- 1) Validasi tujuan (atomik: satu saja bentrok -> batal semua).
  select count(*) into v_minggu from jsonb_array_elements(p_sel) e
    where extract(dow from (e->>'ke')::date) = 0;
  if v_minggu > 0 then
    raise exception 'Dibatalkan: % sel jatuh di hari Minggu. Tidak ada yang dipindah.', v_minggu using errcode = 'P0001';
  end if;

  -- 2) raw_schedule: kunci, pastikan belum diubah orang lain, lalu tulis jadwal baru.
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_raw_id := (r->>'raw_id')::bigint;
    select coalesce(schedule, '{}'::jsonb) into v_cur from public.raw_schedule where id = v_raw_id for update;
    if not found then
      raise exception 'Baris jadwal % tidak ditemukan (mungkin sudah diarsip/dihapus). Muat ulang halaman.', v_raw_id using errcode = 'P0001';
    end if;
    if v_cur is distinct from coalesce(r->'sebelum', '{}'::jsonb) then
      raise exception 'Jadwal baris % sudah diubah orang lain sejak layar dimuat. Muat ulang halaman lalu ulangi. Tidak ada yang dipindah.', v_raw_id using errcode = 'P0001';
    end if;
    update public.raw_schedule set schedule = r->'sesudah', updated_at = now() where id = v_raw_id;
    v_raw_out := v_raw_out || jsonb_build_array(jsonb_build_object('raw_id', v_raw_id, 'sebelum', v_cur, 'sesudah', r->'sesudah'));
  end loop;

  -- 3) renhar: per (raw, wp, dari, ke, kode[]) - setara pindahKomponenRenhar.
  for op in select * from jsonb_array_elements(coalesce(p_renhar, '[]'::jsonb)) loop
    v_raw_id := (op->>'raw_id')::bigint; v_wp := op->>'wp';
    v_dari := (op->>'dari')::date; v_ke := (op->>'ke')::date;
    v_kode := array(select jsonb_array_elements_text(coalesce(op->'kode', '[]'::jsonb)));
    if v_dari = v_ke or cardinality(v_kode) = 0 then continue; end if;

    select * into v_asal from public.renhar
      where raw_id = v_raw_id and wp = v_wp and tanggal = v_dari
      order by updated_at desc nulls last limit 1 for update;
    if not found then continue; end if;
    v_pindah := array(select k from jsonb_array_elements_text(coalesce(v_asal.komponen, '[]'::jsonb)) k where k = any(v_kode));
    if cardinality(v_pindah) = 0 then continue; end if;
    v_sisa := array(select k from jsonb_array_elements_text(coalesce(v_asal.komponen, '[]'::jsonb)) k where not (k = any(v_kode)));
    v_rel := array(select k from unnest(v_pindah) k where k = any(coalesce(v_asal.komponen_released, '{}'::text[])));
    v_ppk := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
              from jsonb_each(coalesce(v_asal.pekerja_per_komponen, '{}'::jsonb)) where key = any(v_pindah));

    if not (v_asal.id = any(v_seen)) and not (v_asal.id = any(v_dibuat)) then
      v_seen := v_seen || v_asal.id; v_sebelum := v_sebelum || jsonb_build_array(public._renhar_snap(v_asal.id));
    end if;

    select * into v_tujuan from public.renhar
      where raw_id = v_raw_id and wp = v_wp and tanggal = v_ke
      order by updated_at desc nulls last limit 1 for update;
    v_ada_tujuan := found;

    if v_ada_tujuan then
      if not (v_tujuan.id = any(v_seen)) and not (v_tujuan.id = any(v_dibuat)) then
        v_seen := v_seen || v_tujuan.id; v_sebelum := v_sebelum || jsonb_build_array(public._renhar_snap(v_tujuan.id));
      end if;
      update public.renhar set
        komponen = coalesce(komponen, '[]'::jsonb)
                   || to_jsonb(array(select k from unnest(v_pindah) k where not (coalesce(komponen, '[]'::jsonb) ? k))),
        komponen_released = coalesce(komponen_released, '{}'::text[])
                   || array(select k from unnest(v_rel) k where not (k = any(coalesce(komponen_released, '{}'::text[])))),
        pekerja_per_komponen = coalesce(pekerja_per_komponen, '{}'::jsonb) || v_ppk,
        updated_at = now()
      where id = v_tujuan.id;
    elsif cardinality(v_sisa) = 0 then
      -- Pindah semua & tujuan kosong -> geser baris asal (id & riwayat ikut), selesai utk op ini.
      update public.renhar set tanggal = v_ke, komponen = to_jsonb(v_pindah), updated_at = now() where id = v_asal.id;
      continue;
    else
      insert into public.renhar (raw_id, wo_id, panel_id, proyek, panel, proses, prioritas, wp, komponen, tanggal,
                                 divisi, pekerja, komponen_released, pekerja_per_komponen)
      values (v_asal.raw_id, v_asal.wo_id, v_asal.panel_id, v_asal.proyek, v_asal.panel, v_asal.proses,
              coalesce(v_asal.prioritas, 'Sedang'), v_wp, to_jsonb(v_pindah), v_ke,
              v_asal.divisi, coalesce(v_asal.pekerja, '[]'::jsonb), v_rel, v_ppk)
      returning id into v_baru_id;
      v_dibuat := v_dibuat || v_baru_id;
    end if;

    -- Kurangi asal (baca keadaan terkini di transaksi ini).
    update public.renhar set
      komponen = to_jsonb(array(select k from jsonb_array_elements_text(coalesce(komponen, '[]'::jsonb)) k where not (k = any(v_kode)))),
      komponen_released = array(select k from unnest(coalesce(komponen_released, '{}'::text[])) k where not (k = any(v_kode))),
      pekerja_per_komponen = (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
                              from jsonb_each(coalesce(pekerja_per_komponen, '{}'::jsonb)) where not (key = any(v_pindah))),
      updated_at = now()
    where id = v_asal.id;
  end loop;

  -- 4) Keadaan "sesudah" semua baris renhar yang disentuh/dibuat (utk cek undo).
  foreach v_id in array (v_seen || v_dibuat) loop
    v_sesudah := v_sesudah || jsonb_build_array(public._renhar_snap(v_id));
  end loop;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'PINDAH BANYAK SEL',
          format('Pindah %s sel Raw Schedule sekaligus (%s baris jadwal, %s baris rencana harian disentuh, %s dibuat)',
                 v_n_sel, jsonb_array_length(v_raw_out), cardinality(v_seen), cardinality(v_dibuat)),
          'raw', 'Raw Schedule');

  return jsonb_build_object('raw', v_raw_out, 'renhar_sebelum', v_sebelum,
                            'renhar_dibuat', to_jsonb(v_dibuat), 'renhar_sesudah', v_sesudah);
end;
$$;


create or replace function public.pulihkan_multi_sel(p_snap jsonb, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb; v_cur jsonb; v_raw_id bigint; v_id bigint; v_i int := 0;
  v_dibuat bigint[] := array(select (jsonb_array_elements_text(coalesce(p_snap->'renhar_dibuat', '[]'::jsonb)))::bigint);
begin
  -- 1) Cek: semua yang disentuh masih PERSIS seperti setelah dipindah. Kalau tidak -> tolak, jangan timpa.
  for r in select * from jsonb_array_elements(coalesce(p_snap->'raw', '[]'::jsonb)) loop
    v_raw_id := (r->>'raw_id')::bigint;
    select coalesce(schedule, '{}'::jsonb) into v_cur from public.raw_schedule where id = v_raw_id for update;
    if not found or v_cur is distinct from coalesce(r->'sesudah', '{}'::jsonb) then
      raise exception 'Tidak bisa dibatalkan: jadwal baris % sudah diubah lagi sejak dipindah. Tidak ada yang diubah.', v_raw_id using errcode = 'P0001';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sesudah', '[]'::jsonb)) loop
    v_id := (r->>'id')::bigint;
    perform 1 from public.renhar where id = v_id for update;
    if public._renhar_snap(v_id) is distinct from r then
      raise exception 'Tidak bisa dibatalkan: rencana harian (id %) sudah berubah lagi sejak dipindah (mis. dirilis/diubah orang lain). Tidak ada yang diubah.', v_id using errcode = 'P0001';
    end if;
  end loop;

  -- 2) Pulihkan. Baris yang tanggalnya akan dikembalikan diparkir dulu di tanggal sementara supaya
  --    tidak bentrok constraint unik (raw_id, wp, tanggal) saat beberapa baris bertukar tanggal.
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)) loop
    v_i := v_i + 1;
    update public.renhar set tanggal = date '1000-01-01' + v_i
      where id = (r->>'id')::bigint and tanggal is distinct from (r->>'tanggal')::date;
  end loop;
  delete from public.renhar where id = any(v_dibuat);
  for r in select * from jsonb_array_elements(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)) loop
    update public.renhar set
      tanggal = (r->>'tanggal')::date,
      komponen = r->'komponen',
      komponen_released = array(select jsonb_array_elements_text(r->'komponen_released')),
      pekerja_per_komponen = r->'pekerja_per_komponen',
      updated_at = now()
    where id = (r->>'id')::bigint;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_snap->'raw', '[]'::jsonb)) loop
    update public.raw_schedule set schedule = r->'sebelum', updated_at = now() where id = (r->>'raw_id')::bigint;
  end loop;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values (coalesce(nullif(p_user, ''), 'Unknown User'), 'BATALKAN PINDAH BANYAK SEL',
          format('Batalkan pindah banyak sel: %s baris jadwal & %s baris rencana harian dipulihkan, %s baris dibuat dihapus',
                 jsonb_array_length(coalesce(p_snap->'raw', '[]'::jsonb)),
                 jsonb_array_length(coalesce(p_snap->'renhar_sebelum', '[]'::jsonb)), cardinality(v_dibuat)),
          'raw', 'Raw Schedule');
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.pindah_multi_sel(jsonb, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.pulihkan_multi_sel(jsonb, text) to anon, authenticated;
revoke all on function public._renhar_snap(bigint) from public;
grant execute on function public._renhar_snap(bigint) to anon, authenticated;
