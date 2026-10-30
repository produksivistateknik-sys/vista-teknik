-- ROLLBACK 20261030040000_inventaris_tambah_operator.
-- Barang yang sudah ditambah operator TETAP ada (data permanen, inv_barang tidak bisa DELETE) - hanya kolom label & fungsi
-- baru yang dicabut. Batasan inv_log.jenis 'data' & inv_media.peran 'foto' SENGAJA tetap (baris log permanen & media
-- yang sudah tercatat memakai nilai itu; mengecilkan batasan akan gagal). inv_tambah_media dikembalikan ke versi T1.
begin;
drop function if exists public.inv_tambah_barang_operator(jsonb, uuid, jsonb);
drop function if exists public.inv_tandai_diperiksa(bigint, jsonb);
alter table public.inv_barang drop column if exists kunci_tambah, drop column if exists diperiksa_pada,
  drop column if exists diperiksa_oleh, drop column if exists sudah_diperiksa, drop column if exists ditambah_operator;
create or replace function public.inv_tambah_media(p_tujuan text, p_ref_id bigint, p_peran text, p_media jsonb, p_aktor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; v_bid bigint; v_lok text;
begin
  select * into a from public.inv_aktor(p_aktor);
  perform public.inv_validasi_media(p_media);
  if (p_tujuan, p_peran) not in (('laporan','sebelum'),('laporan','sesudah'),('laporan_update','update'),
                                 ('jadwal_selesai','selesai'),('barang','datasheet')) then
    raise exception 'Kombinasi % / % tidak diizinkan', p_tujuan, p_peran using errcode = '22023';
  end if;
  if (p_peran in ('sesudah','datasheet')) and a.peran <> 'admin' then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  if p_peran = 'datasheet' and exists (select 1 from jsonb_array_elements(p_media) f
                                       where coalesce(f->>'mime', '') <> 'application/pdf') then
    raise exception 'Datasheet harus PDF' using errcode = '22023';
  end if;
  v_bid := case p_tujuan
    when 'barang' then (select id from public.inv_barang where id = p_ref_id)
    when 'laporan' then (select barang_id from public.inv_laporan where id = p_ref_id)
    when 'laporan_update' then (select l.barang_id from public.inv_laporan_update u join public.inv_laporan l on l.id = u.laporan_id where u.id = p_ref_id)
    when 'jadwal_selesai' then (select barang_id from public.inv_jadwal_selesai where id = p_ref_id) end;
  if v_bid is null then return jsonb_build_object('ditemukan', false, 'ditambah', 0); end if;
  if a.peran = 'operator' then
    select lokasi_kode into v_lok from public.inv_barang where id = v_bid;
    if not public.inv_operator_boleh(a.divisi, v_lok) then raise exception 'Barang ini bukan milik divisi Anda' using errcode = '42501'; end if;
  end if;
  return jsonb_build_object('ditemukan', true, 'ditambah', public.inv_simpan_media(p_tujuan, p_ref_id, p_peran, p_media, a.nama));
end $$;
select count(*) as sisa_fungsi_baru from pg_proc where proname in ('inv_tambah_barang_operator', 'inv_tandai_diperiksa');
commit;
