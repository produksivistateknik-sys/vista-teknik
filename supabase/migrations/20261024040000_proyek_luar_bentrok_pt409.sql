-- ============================================================================================
-- PERBAIKAN 20261024030000 (24 Okt 2026): BENTROK catatan Proyek Luar memakai errcode 'PT409', BUKAN '40001'.
-- Bukti verifikasi live 24 Okt: panggilan ubah_catatan_proyek_luar yang bentrok lewat PostgREST tidak pernah kembali
-- ("upstream request timeout" ~60 dtk) - PostgREST menganggap 40001 (serialization_failure) boleh diulang dan mengulang
-- transaksi terus. 'PT409' = errcode khusus PostgREST -> langsung HTTP 409, error.code 'PT409'.
-- Isi fungsi selain errcode IDENTIK dgn 20261024030000. Aplikasi (lib/proyekLuarPantau.bentrokCatatanPL) mengenali
-- PT409 / 40001 / kata BENTROK. Aplikasi yang sedang live belum memakai p_cek_dasar -> tidak terdampak.
-- Jalankan blok (1), lalu (2). Rollback: jalankan ulang blok C dari 20261024030000 (errcode 40001).
-- ============================================================================================

-- (1) EKSEKUSI
begin;
create or replace function public.ubah_catatan_proyek_luar(p_id bigint, p_catatan text, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false,
  p_dasar text default null, p_cek_dasar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.proyek_luar; v_baru text := nullif(btrim(coalesce(p_catatan, '')), ''); v_peran text := case when coalesce(p_admin, false) then 'admin' else 'operator' end;
        v_log bigint;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  if length(coalesce(v_baru, '')) > 5000 then raise exception 'Catatan terlalu panjang (maksimal 5000 huruf)' using errcode = '22023'; end if;
  select * into r from public.proyek_luar where id = p_id for update;
  if r.id is null then raise exception 'Laporan Proyek Luar % tidak ada', p_id using errcode = 'P0002'; end if;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or r.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya pelapor laporan ini yang boleh mengubah catatannya' using errcode = '42501'; end if;
    if r.status <> 'berlangsung' then
      raise exception 'Laporan sudah Selesai - catatan tidak bisa diubah lagi dari aplikasi operator' using errcode = '42501'; end if;
  end if;
  if r.catatan is not distinct from v_baru then return to_jsonb(r); end if;  -- tidak ada perubahan
  if coalesce(p_cek_dasar, false) and r.catatan is distinct from nullif(btrim(coalesce(p_dasar, '')), '') then
    raise exception 'BENTROK: catatan sudah diubah % - muat versi terbaru dulu', coalesce(r.catatan_diubah_oleh, 'orang lain') using errcode = 'PT409';
  end if;
  select id into v_log from public.proyek_luar_catatan_log
   where proyek_luar_id = r.id and oleh = btrim(p_oleh) and peran = v_peran and waktu > now() - interval '15 minutes'
     and id = (select max(id) from public.proyek_luar_catatan_log where proyek_luar_id = r.id);
  if v_log is not null then update public.proyek_luar_catatan_log set catatan_baru = v_baru, waktu = now() where id = v_log;
  else insert into public.proyek_luar_catatan_log (proyek_luar_id, catatan_lama, catatan_baru, oleh, peran) values (r.id, r.catatan, v_baru, btrim(p_oleh), v_peran);
  end if;
  update public.proyek_luar set catatan = v_baru, catatan_diubah_oleh = btrim(p_oleh), catatan_diubah_pada = now(), updated_at = now()
   where id = r.id returning * into r;
  return to_jsonb(r);
end $$;
commit;

-- (2) VERIFIKASI (baca saja) - harap: errcode_pt409 = true, errcode_40001 = false, argumen = 7
select position('PT409' in prosrc) > 0 as errcode_pt409, position('''40001''' in prosrc) > 0 as errcode_40001, pronargs as argumen
from pg_proc where proname = 'ubah_catatan_proyek_luar';
