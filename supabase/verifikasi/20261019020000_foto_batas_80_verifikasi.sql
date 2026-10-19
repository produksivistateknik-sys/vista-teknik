-- VERIFIKASI 20261019020000_foto_batas_80 (jalankan SESUDAH migration). Semua di transaksi yang di-ROLLBACK (panel nyata
-- dipakai sbg bahan uji, perubahan tidak tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_p bigint; v_h jsonb; v_80 jsonb; v_81 jsonb; v_pesan text;
begin
  select id into v_p from public.panels order by id limit 1;
  select jsonb_agg(jsonb_build_object('url', 'https://uji.invalid/b80_' || g || '.jpg')) into v_80 from generate_series(1, 80) g;
  select jsonb_agg(jsonb_build_object('url', 'https://uji.invalid/b81_' || g || '.jpg')) into v_81 from generate_series(1, 81) g;

  -- V1: 80 foto sekali panggil diterima
  v_h := public.tambah_foto_dokumentasi('kolom', v_p, 'qs_photos', v_80);
  if (v_h->>'ditambah')::int <> 80 then raise exception 'GAGAL V1: %', v_h; end if;
  raise notice 'LULUS V1: 80 foto sekali panggil diterima';

  -- V2: 81 ditolak dgn pesan bahasa Indonesia
  begin perform public.tambah_foto_dokumentasi('kolom', v_p, 'qs_photos', v_81); raise exception 'GAGAL V2a: 81 foto lolos';
  exception when sqlstate '22023' then get stacked diagnostics v_pesan = message_text; end;
  if v_pesan not like 'Terlalu banyak foto dalam satu kali simpan: 81 foto, maksimal 80%' then raise exception 'GAGAL V2b: pesan %', v_pesan; end if;
  raise notice 'LULUS V2: 81 foto ditolak - "%"', v_pesan;

  -- V3: kosong ditolak; validasi lain & anti dobel tetap
  begin perform public.tambah_foto_dokumentasi('kolom', v_p, 'qs_photos', '[]'); raise exception 'GAGAL V3a: kosong lolos';
  exception when sqlstate '22023' then get stacked diagnostics v_pesan = message_text; end;
  if v_pesan <> 'Tidak ada foto yang dikirim untuk disimpan.' then raise exception 'GAGAL V3b: %', v_pesan; end if;
  begin perform public.tambah_foto_dokumentasi('kolom', v_p, 'checklist', '[{"url":"https://uji.invalid/x.jpg"}]'); raise exception 'GAGAL V3c: kolom checklist lolos';
  exception when sqlstate '22023' then null; end;
  v_h := public.tambah_foto_dokumentasi('kolom', v_p, 'qs_photos', v_80);
  if (v_h->>'ditambah')::int <> 0 then raise exception 'GAGAL V3d: kirim ulang menambah %', v_h; end if;
  raise notice 'LULUS V3: kosong ditolak (pesan Indonesia), kolom tak diizinkan ditolak, kirim ulang tidak dobel';

  -- V4: foto dgn thumb tersimpan apa adanya
  v_h := public.tambah_foto_dokumentasi('kolom', v_p, 'qs_photos', '[{"url":"https://uji.invalid/t.jpg","thumb":"https://uji.invalid/t_t.jpg"}]');
  if not exists (select 1 from public.panels p, jsonb_array_elements(p.qs_photos) f where p.id = v_p and f->>'thumb' = 'https://uji.invalid/t_t.jpg') then raise exception 'GAGAL V4'; end if;
  raise notice 'LULUS V4: kolom thumb ikut tersimpan';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
