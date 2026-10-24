-- ============================================================================================
-- PROYEK LUAR: DESKRIPSI (CATATAN) BISA DIEDIT + JEJAK UBAH (24 Okt 2026, keputusan user).
--  - Admin (vista-teknik) boleh mengedit catatan laporan mana pun.
--  - Operator (vista-pekerja) hanya laporan MILIKNYA (proyek_luar.pekerja_id) dan hanya selama status 'berlangsung'.
--  - Jejak: kolom catatan_diubah_oleh / catatan_diubah_pada (tampil di kartu) + log awet proyek_luar_catatan_log
--    (isi lama & baru; activity_log hanya ~1 minggu). Tanpa perubahan isi -> tidak dicatat.
--  - Konvensi aplikasi (tanpa Supabase Auth): nama & peran dikirim aplikasi, sama seperti RPC kendala/koreksi lain.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi (uji dalam transaksi yang dibatalkan). Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja) - harap: kolom_sudah_ada=false, log_sudah_ada=false, laporan = jumlah baris proyek_luar sekarang.
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'proyek_luar'
          and column_name in ('catatan_diubah_oleh', 'catatan_diubah_pada')) > 0 as kolom_sudah_ada,
       to_regclass('public.proyek_luar_catatan_log') is not null as log_sudah_ada,
       (select count(*) from public.proyek_luar) as laporan,
       (select count(*) from public.proyek_luar where status = 'berlangsung') as berlangsung;

-- (1) EKSEKUSI
begin;
alter table public.proyek_luar
  add column catatan_diubah_oleh text,
  add column catatan_diubah_pada timestamptz;

create table public.proyek_luar_catatan_log (
  id              bigint generated always as identity primary key,
  proyek_luar_id  bigint not null,
  catatan_lama    text,
  catatan_baru    text,
  oleh            text not null,
  peran           text not null check (peran in ('admin', 'operator')),
  waktu           timestamptz not null default now()
);
create index proyek_luar_catatan_log_id on public.proyek_luar_catatan_log (proyek_luar_id, waktu desc);
alter table public.proyek_luar_catatan_log enable row level security;
create policy baca_proyek_luar_catatan_log on public.proyek_luar_catatan_log for select to anon, authenticated using (true);
-- tanpa policy tulis: log hanya diisi RPC di bawah.

create or replace function public.ubah_catatan_proyek_luar(p_id bigint, p_catatan text, p_oleh text, p_pekerja_id bigint default null, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.proyek_luar; v_baru text := nullif(btrim(coalesce(p_catatan, '')), '');
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi' using errcode = '22023'; end if;
  if length(coalesce(v_baru, '')) > 5000 then raise exception 'Catatan terlalu panjang (maksimal 5000 huruf)' using errcode = '22023'; end if;
  select * into r from public.proyek_luar where id = p_id for update;
  if r.id is null then raise exception 'Laporan Proyek Luar % tidak ada', p_id using errcode = 'P0002'; end if;
  if not coalesce(p_admin, false) then
    if p_pekerja_id is null or r.pekerja_id is distinct from p_pekerja_id then
      raise exception 'Hanya pelapor laporan ini yang boleh mengubah catatannya' using errcode = '42501';
    end if;
    if r.status <> 'berlangsung' then
      raise exception 'Laporan sudah Selesai - catatan tidak bisa diubah lagi dari aplikasi operator' using errcode = '42501';
    end if;
  end if;
  if r.catatan is not distinct from v_baru then return to_jsonb(r); end if;  -- tidak ada perubahan
  insert into public.proyek_luar_catatan_log (proyek_luar_id, catatan_lama, catatan_baru, oleh, peran)
  values (r.id, r.catatan, v_baru, btrim(p_oleh), case when coalesce(p_admin, false) then 'admin' else 'operator' end);
  update public.proyek_luar set catatan = v_baru, catatan_diubah_oleh = btrim(p_oleh), catatan_diubah_pada = now(), updated_at = now()
   where id = r.id returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean) from public;
grant execute on function public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean) to anon, authenticated;
commit;

-- (2) VERIFIKASI - uji aturan dalam transaksi yang DIBATALKAN (data tidak berubah). Harap notice 'UJI LULUS' tanpa error,
--     lalu perintah terakhir: kolom_ada = 2, fungsi_ada = 1, log = 0.
do $$
declare r public.proyek_luar; lama text; n int; hasil jsonb;
begin
  select * into r from public.proyek_luar order by id limit 1;
  lama := r.catatan;
  -- admin boleh mengubah laporan apa pun
  hasil := public.ubah_catatan_proyek_luar(r.id, coalesce(lama, '') || ' (uji)', '__UJI_ADMIN', null, true);
  if hasil->>'catatan_diubah_oleh' <> '__UJI_ADMIN' then raise exception 'jejak diubah_oleh tidak terisi'; end if;
  select count(*) into n from public.proyek_luar_catatan_log where proyek_luar_id = r.id and oleh = '__UJI_ADMIN';
  if n <> 1 then raise exception 'log admin harus 1 baris, dapat %', n; end if;
  -- isi sama -> tidak dicatat lagi
  perform public.ubah_catatan_proyek_luar(r.id, coalesce(lama, '') || ' (uji)', '__UJI_ADMIN', null, true);
  select count(*) into n from public.proyek_luar_catatan_log where proyek_luar_id = r.id and oleh = '__UJI_ADMIN';
  if n <> 1 then raise exception 'isi sama tidak boleh menambah log'; end if;
  -- operator lain ditolak
  begin perform public.ubah_catatan_proyek_luar(r.id, 'x', '__UJI_OP', -987654, false); raise exception 'operator lain seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  -- pemilik: boleh bila berlangsung, ditolak bila selesai
  update public.proyek_luar set status = 'berlangsung' where id = r.id;
  if r.pekerja_id is not null then
    perform public.ubah_catatan_proyek_luar(r.id, 'uji pemilik', '__UJI_OP', r.pekerja_id, false);
    update public.proyek_luar set status = 'selesai' where id = r.id;
    begin perform public.ubah_catatan_proyek_luar(r.id, 'uji pemilik 2', '__UJI_OP', r.pekerja_id, false); raise exception 'laporan selesai seharusnya ditolak utk operator';
    exception when insufficient_privilege then null; end;
  end if;
  raise notice 'UJI LULUS';
  raise exception 'batalkan uji' using errcode = 'P0001';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'batalkan uji' then raise; end if;
end $$;
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'proyek_luar'
          and column_name in ('catatan_diubah_oleh', 'catatan_diubah_pada')) as kolom_ada,
       (select count(*) from pg_proc where proname = 'ubah_catatan_proyek_luar') as fungsi_ada,
       (select count(*) from public.proyek_luar_catatan_log) as log;

-- (3) ROLLBACK:
-- begin;
-- drop function if exists public.ubah_catatan_proyek_luar(bigint, text, text, bigint, boolean);
-- drop table if exists public.proyek_luar_catatan_log;
-- alter table public.proyek_luar drop column if exists catatan_diubah_oleh, drop column if exists catatan_diubah_pada;
-- commit;
