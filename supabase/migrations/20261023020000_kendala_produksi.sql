-- ============================================================================================
-- KENDALA PRODUKSI (23 Okt 2026) - pengganti catatan kendala lama per tugas operator (tabel kendala).
-- Keputusan user 22-23 Okt 2026: dicatat per PROYEK (nama proyek, gabungan WO) > panel (kosong = "Umum"), hari/tanggal/
-- jam/pencatat OTOMATIS; pencatat boleh ubah/hapus miliknya di hari yang sama (WIB) lalu terkunci; Admin Produksi boleh
-- hapus; HANYA Admin Produksi menandai "Teratasi" (waktu & nama otomatis) dan boleh membatalkan (tercatat di log);
-- Admin juga boleh mencatat. Tidak ada Supabase Auth -> nama/peran dikirim aplikasi = KONVENSI APLIKASI, bukan
-- pengaman keras (sama dgn koreksi_progres_admin). Tulis HANYA lewat RPC di bawah; jejak awet di kendala_produksi_log.
-- Panel diarsip/dihapus: baris TIDAK dipindah/dihapus (snapshot proyek/WO/nama panel ikut disimpan; panel arsip
-- memakai id yang sama di panels_archived).
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).
-- Migrasi isi lama: skrip terpisah supabase/scripts/20261023_migrasi_kendala_lama.sql (sesudah file ini).
-- ============================================================================================

-- (0) DRY-RUN (baca saja). Harapan: tabel belum ada; kendala lama 0 baris, kendala_archived 124 baris.
select to_regclass('public.kendala_produksi') as tabel_sudah_ada, to_regclass('public.kendala_produksi_log') as log_sudah_ada;
select (select count(*) from public.kendala) as kendala_lama, (select count(*) from public.kendala_archived) as kendala_arsip_lama;

-- (1) EKSEKUSI
begin;
create table if not exists public.kendala_produksi (
  id            bigint generated always as identity primary key,
  proyek        text not null,
  wo_id         bigint,
  wo_number     text,
  panel_id      bigint,                    -- null = "Umum" (kendala proyek, tidak terkait satu panel)
  panel_nama    text,
  teks          text not null check (length(btrim(teks)) between 3 and 1000),
  pencatat      text not null,
  divisi        text,
  sumber        text not null default 'operator' check (sumber in ('operator', 'admin', 'migrasi')),
  dicatat_pada  timestamptz not null default now(),
  tanggal       date not null default ((now() at time zone 'Asia/Jakarta')::date), -- hari pencatatan (WIB)
  diubah_pada   timestamptz,
  teratasi_pada timestamptz,
  teratasi_oleh text,
  dihapus_pada  timestamptz,
  dihapus_oleh  text
);
create index if not exists kendala_produksi_proyek_panel on public.kendala_produksi (proyek, panel_id, id desc);
create index if not exists kendala_produksi_terbuka on public.kendala_produksi (proyek, panel_id) where teratasi_pada is null and dihapus_pada is null;
alter table public.kendala_produksi enable row level security;
drop policy if exists baca_kendala_produksi on public.kendala_produksi;
create policy baca_kendala_produksi on public.kendala_produksi for select to anon, authenticated using (true);

create table if not exists public.kendala_produksi_log (
  id         bigint generated always as identity primary key,
  kendala_id bigint not null,
  aksi       text not null check (aksi in ('catat', 'ubah', 'hapus', 'teratasi', 'batal_teratasi', 'migrasi')),
  oleh       text not null,
  alasan     text,
  sebelum    jsonb,
  sesudah    jsonb,
  waktu      timestamptz not null default now()
);
create index if not exists kendala_produksi_log_kendala on public.kendala_produksi_log (kendala_id, id);
alter table public.kendala_produksi_log enable row level security;
drop policy if exists baca_kendala_produksi_log on public.kendala_produksi_log;
create policy baca_kendala_produksi_log on public.kendala_produksi_log for select to anon, authenticated using (true);
-- tidak ada policy insert/update/delete di kedua tabel: tulis HANYA lewat RPC security definer di bawah.

-- CATAT. p_panel_id null = Umum (proyek harus ada di WO yang belum dihapus). Panel: harus panel aktif milik proyek itu.
create or replace function public.catat_kendala(p_proyek text, p_panel_id bigint, p_teks text, p_oleh text, p_divisi text, p_sumber text default 'operator')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_wo_id bigint; v_wo_no text; v_wo_proyek text; v_panel_nama text; v_panel_wo bigint; v_row public.kendala_produksi;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pencatat wajib'; end if;
  if coalesce(btrim(p_proyek), '') = '' then raise exception 'Proyek wajib'; end if;
  if p_panel_id is not null then
    select p.nama, p.wo_id into v_panel_nama, v_panel_wo from public.panels p where p.id = p_panel_id and p.deleted_at is null;
    if not found then raise exception 'Panel % tidak ditemukan / sudah dihapus', p_panel_id; end if;
    select w.id, w.wo, w.proyek into v_wo_id, v_wo_no, v_wo_proyek from public.work_orders w where w.id = v_panel_wo;
    if v_wo_proyek is distinct from p_proyek then raise exception 'Panel % bukan milik proyek %', v_panel_nama, p_proyek; end if;
  elsif not exists (select 1 from public.work_orders w where w.proyek = p_proyek and w.deleted_at is null) then
    raise exception 'Proyek % tidak ditemukan', p_proyek;
  end if;
  insert into public.kendala_produksi (proyek, wo_id, wo_number, panel_id, panel_nama, teks, pencatat, divisi, sumber)
  values (p_proyek, v_wo_id, v_wo_no, p_panel_id, v_panel_nama, btrim(p_teks), btrim(p_oleh), p_divisi,
          case when p_sumber = 'admin' then 'admin' else 'operator' end)
  returning * into v_row;
  insert into public.kendala_produksi_log (kendala_id, aksi, oleh, sesudah) values (v_row.id, 'catat', v_row.pencatat, to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

-- UBAH: hanya pencatatnya sendiri, di hari yang sama (WIB), belum teratasi & belum dihapus.
create or replace function public.ubah_kendala(p_id bigint, p_teks text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lama public.kendala_produksi; v_baru public.kendala_produksi;
begin
  select * into v_lama from public.kendala_produksi where id = p_id for update;
  if not found or v_lama.dihapus_pada is not null then raise exception 'Kendala tidak ditemukan'; end if;
  if v_lama.pencatat is distinct from btrim(p_oleh) then raise exception 'Hanya pencatat yang boleh mengubah'; end if;
  if v_lama.tanggal <> (now() at time zone 'Asia/Jakarta')::date then raise exception 'Kendala sudah terkunci (hanya bisa diubah di hari yang sama)'; end if;
  if v_lama.teratasi_pada is not null then raise exception 'Kendala sudah ditandai teratasi'; end if;
  update public.kendala_produksi set teks = btrim(p_teks), diubah_pada = now() where id = p_id returning * into v_baru;
  insert into public.kendala_produksi_log (kendala_id, aksi, oleh, sebelum, sesudah) values (p_id, 'ubah', btrim(p_oleh), to_jsonb(v_lama), to_jsonb(v_baru));
  return to_jsonb(v_baru);
end $$;

-- HAPUS (lunak): pencatat di hari yang sama & belum teratasi, ATAU Admin Produksi (p_admin, konvensi aplikasi) kapan saja.
create or replace function public.hapus_kendala(p_id bigint, p_oleh text, p_admin boolean default false, p_alasan text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lama public.kendala_produksi; v_baru public.kendala_produksi;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama wajib'; end if;
  select * into v_lama from public.kendala_produksi where id = p_id for update;
  if not found or v_lama.dihapus_pada is not null then raise exception 'Kendala tidak ditemukan'; end if;
  if not coalesce(p_admin, false) then
    if v_lama.pencatat is distinct from btrim(p_oleh) then raise exception 'Hanya pencatat atau Admin Produksi yang boleh menghapus'; end if;
    if v_lama.tanggal <> (now() at time zone 'Asia/Jakarta')::date then raise exception 'Kendala sudah terkunci (hanya bisa dihapus di hari yang sama)'; end if;
    if v_lama.teratasi_pada is not null then raise exception 'Kendala sudah ditandai teratasi'; end if;
  end if;
  update public.kendala_produksi set dihapus_pada = now(), dihapus_oleh = btrim(p_oleh) where id = p_id returning * into v_baru;
  insert into public.kendala_produksi_log (kendala_id, aksi, oleh, alasan, sebelum, sesudah) values (p_id, 'hapus', btrim(p_oleh), p_alasan, to_jsonb(v_lama), to_jsonb(v_baru));
  return to_jsonb(v_baru);
end $$;

-- TERATASI (Admin Produksi, konvensi aplikasi): waktu & nama otomatis.
create or replace function public.tandai_kendala_teratasi(p_id bigint, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lama public.kendala_produksi; v_baru public.kendala_produksi;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama admin wajib'; end if;
  select * into v_lama from public.kendala_produksi where id = p_id for update;
  if not found or v_lama.dihapus_pada is not null then raise exception 'Kendala tidak ditemukan'; end if;
  if v_lama.teratasi_pada is not null then raise exception 'Kendala sudah ditandai teratasi oleh % pada %', v_lama.teratasi_oleh, v_lama.teratasi_pada; end if;
  update public.kendala_produksi set teratasi_pada = now(), teratasi_oleh = btrim(p_oleh) where id = p_id returning * into v_baru;
  insert into public.kendala_produksi_log (kendala_id, aksi, oleh, sebelum, sesudah) values (p_id, 'teratasi', btrim(p_oleh), to_jsonb(v_lama), to_jsonb(v_baru));
  return to_jsonb(v_baru);
end $$;

-- BATAL TERATASI (salah klik): alasan wajib, tercatat di log.
create or replace function public.batal_kendala_teratasi(p_id bigint, p_oleh text, p_alasan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lama public.kendala_produksi; v_baru public.kendala_produksi;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama admin wajib'; end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi'; end if;
  select * into v_lama from public.kendala_produksi where id = p_id for update;
  if not found or v_lama.dihapus_pada is not null then raise exception 'Kendala tidak ditemukan'; end if;
  if v_lama.teratasi_pada is null then raise exception 'Kendala belum ditandai teratasi'; end if;
  update public.kendala_produksi set teratasi_pada = null, teratasi_oleh = null where id = p_id returning * into v_baru;
  insert into public.kendala_produksi_log (kendala_id, aksi, oleh, alasan, sebelum, sesudah) values (p_id, 'batal_teratasi', btrim(p_oleh), btrim(p_alasan), to_jsonb(v_lama), to_jsonb(v_baru));
  return to_jsonb(v_baru);
end $$;

revoke all on function public.catat_kendala(text, bigint, text, text, text, text) from public;
revoke all on function public.ubah_kendala(bigint, text, text) from public;
revoke all on function public.hapus_kendala(bigint, text, boolean, text) from public;
revoke all on function public.tandai_kendala_teratasi(bigint, text) from public;
revoke all on function public.batal_kendala_teratasi(bigint, text, text) from public;
grant execute on function public.catat_kendala(text, bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.ubah_kendala(bigint, text, text) to anon, authenticated;
grant execute on function public.hapus_kendala(bigint, text, boolean, text) to anon, authenticated;
grant execute on function public.tandai_kendala_teratasi(bigint, text) to anon, authenticated;
grant execute on function public.batal_kendala_teratasi(bigint, text, text) to anon, authenticated;

-- Realtime (badge admin & HP operator ikut berubah tanpa muat ulang).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kendala_produksi') then
    alter publication supabase_realtime add table public.kendala_produksi;
  end if;
end $$;
commit;

-- (2) VERIFIKASI
--  a. struktur & hak akses (harap: 2 tabel, rls aktif keduanya, 5 fungsi)
select c.relname, c.relrowsecurity from pg_class c where c.relname in ('kendala_produksi', 'kendala_produksi_log') order by 1;
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('catat_kendala','ubah_kendala','hapus_kendala','tandai_kendala_teratasi','batal_kendala_teratasi') order by 1;
--  b. masuk publikasi realtime (harap 1 baris)
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kendala_produksi';
--  c. uji alur di dalam transaksi yang DIBATALKAN (tidak meninggalkan data): catat -> ubah -> teratasi -> batal -> hapus admin.
--     Harap: notice 'UJI LULUS'; sesudahnya kendala_produksi tetap kosong.
begin;
do $$
declare v jsonb; v_id bigint; v_proyek text;
begin
  select proyek into v_proyek from public.work_orders where deleted_at is null and coalesce(is_archived, false) = false order by id desc limit 1;
  v := public.catat_kendala(v_proyek, null, 'uji verifikasi kendala', 'UJI', 'admin', 'admin'); v_id := (v->>'id')::bigint;
  v := public.ubah_kendala(v_id, 'uji verifikasi kendala diubah', 'UJI');
  begin perform public.ubah_kendala(v_id, 'oleh orang lain', 'ORANG LAIN'); raise exception 'SALAH: orang lain bisa mengubah';
  exception when others then if sqlerrm like 'SALAH%' then raise; end if; end;
  v := public.tandai_kendala_teratasi(v_id, 'ADMIN UJI');
  v := public.batal_kendala_teratasi(v_id, 'ADMIN UJI', 'salah klik uji');
  v := public.hapus_kendala(v_id, 'ADMIN UJI', true, 'uji');
  if (select count(*) from public.kendala_produksi_log where kendala_id = v_id) <> 5 then raise exception 'SALAH: log tidak 5 baris'; end if;
  raise notice 'UJI LULUS';
end $$;
rollback;
select count(*) as harus_0 from public.kendala_produksi;

-- (3) ROLLBACK (bila keliru) - tabel & fungsi baru saja; tabel kendala lama tidak disentuh:
-- begin;
-- alter publication supabase_realtime drop table public.kendala_produksi;
-- drop function if exists public.catat_kendala(text, bigint, text, text, text, text);
-- drop function if exists public.ubah_kendala(bigint, text, text);
-- drop function if exists public.hapus_kendala(bigint, text, boolean, text);
-- drop function if exists public.tandai_kendala_teratasi(bigint, text);
-- drop function if exists public.batal_kendala_teratasi(bigint, text, text);
-- drop table if exists public.kendala_produksi_log;
-- drop table if exists public.kendala_produksi;
-- commit;
