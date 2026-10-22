-- ============================================================================================
-- BATALKAN TIMER "SALAH PILIH" (22 Okt 2026, keputusan user - rancangan operator harian)
-- Aturan: daftar pengerja per komponen per hari = orang yang BENAR-BENAR mengerjakan = timer hari itu
-- (fcs_timer_kerja). Orang yang salah dipilih (mis. IFAL di panel 534 FS.4 WIRING CONTROL 22 Okt) tidak boleh
-- tercatat -> timernya DIPINDAH ke tabel log batal (bukan dihapus permanen), lengkap dgn alasan, pelaku, waktu,
-- dan bisa dipulihkan.
-- (1) Tabel fcs_timer_kerja_batal: salinan baris utuh (jsonb `data`, tahan perubahan kolom fcs_timer_kerja) +
--     kolom ringkas utk tampilan. Baca boleh (anon/authenticated); tulis HANYA lewat RPC (security definer).
-- (2) RPC batalkan_timer_salah_pilih(p_timer_ids, p_alasan, p_oleh, p_sumber):
--     - alasan min 5 huruf, pelaku wajib, semua id harus ada (kalau satu tidak ada -> seluruhnya ditolak);
--     - p_sumber 'operator' (vista-pekerja) hanya boleh timer bertanggal HARI INI (WIB); 'admin' boleh tanggal mana pun.
--       (Bukan keamanan keras - klien anon; pagar salah-pencet + jejak awet, sama spt koreksi_progres_admin.)
--     - baris dipindah: insert log -> delete dari fcs_timer_kerja, dicatat activity_log 'BATAL TIMER'.
-- (3) RPC pulihkan_timer_batal(p_batal_id, p_alasan, p_oleh): baris dikembalikan dgn id SAMA; ditolak bila
--     sudah dipulihkan atau bentrok dgn timer aktif lain (indeks unik fcs_timer_kerja_satu_aktif).
-- Tidak mengubah fcs_timer_kerja / fcs_timer_kerja_archived (skema tetap) -> tidak perlu sinkron arsip.
-- Dry-run   : supabase/verifikasi/20261022050000_timer_batal_dryrun.sql
-- Verifikasi: supabase/verifikasi/20261022050000_timer_batal_verifikasi.sql (harus 'SEMUA LULUS', tanpa sisa)
-- Rollback  : supabase/rollback/20261022050000_timer_batal_rollback.sql
-- Perbaikan : 20261022050100_timer_batal_pulihkan_fix.sql (durasi_menit generated - pemulihan tanpa kolom generated)
-- ============================================================================================
begin;

create table if not exists public.fcs_timer_kerja_batal (
  id bigserial primary key,
  timer_id bigint not null,
  pekerja_id bigint,
  panel_id bigint,
  kode_komponen text,
  proses text,
  tahap text,
  tanggal date,
  mulai timestamptz,
  selesai timestamptz,
  durasi_menit numeric,
  data jsonb not null,                -- baris fcs_timer_kerja utuh (to_jsonb) - sumber pemulihan
  alasan text not null,
  dibatalkan_oleh text not null,
  sumber text not null default 'admin',
  dibatalkan_at timestamptz not null default now(),
  dipulihkan_at timestamptz,
  dipulihkan_oleh text,
  alasan_pulih text
);
create index if not exists fcs_timer_kerja_batal_tgl on public.fcs_timer_kerja_batal (tanggal, panel_id, kode_komponen, proses);
create index if not exists fcs_timer_kerja_batal_timer on public.fcs_timer_kerja_batal (timer_id);

alter table public.fcs_timer_kerja_batal enable row level security;
drop policy if exists fcs_timer_kerja_batal_baca on public.fcs_timer_kerja_batal;
create policy fcs_timer_kerja_batal_baca on public.fcs_timer_kerja_batal for select to anon, authenticated using (true);
-- tidak ada policy insert/update/delete: tulis HANYA lewat RPC di bawah (security definer)

create or replace function public.batalkan_timer_salah_pilih(p_timer_ids bigint[], p_alasan text, p_oleh text, p_sumber text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  v_n int; v_ada int; r record; v_ringkas text[] := '{}';
begin
  if coalesce(array_length(p_timer_ids, 1), 0) = 0 then raise exception 'Tidak ada timer yang dipilih.' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_alasan)), 0) < 5 then raise exception 'Alasan pembatalan wajib diisi (min 5 huruf).' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'Nama pelaku wajib.' using errcode = '22023'; end if;
  if coalesce(p_sumber, '') not in ('admin', 'operator') then raise exception 'Sumber % tidak dikenal.', p_sumber using errcode = '22023'; end if;
  select count(distinct x) into v_n from unnest(p_timer_ids) x;
  -- kunci baris dulu (anti dobel klik / dua HP bersamaan)
  perform 1 from public.fcs_timer_kerja t where t.id = any(p_timer_ids) for update;
  select count(*) into v_ada from public.fcs_timer_kerja t where t.id = any(p_timer_ids);
  if v_ada <> v_n then raise exception 'Sebagian timer tidak ditemukan (sudah dibatalkan / dihapus?). Muat ulang lalu coba lagi.' using errcode = '22023'; end if;
  if p_sumber = 'operator' and exists (select 1 from public.fcs_timer_kerja t where t.id = any(p_timer_ids) and t.tanggal <> v_hari_ini) then
    raise exception 'Dari aplikasi operator hanya timer hari ini yang bisa dibatalkan. Hubungi Admin Produksi.' using errcode = '42501';
  end if;
  for r in select t.*, to_jsonb(t) as j from public.fcs_timer_kerja t where t.id = any(p_timer_ids) order by t.id loop
    insert into public.fcs_timer_kerja_batal (timer_id, pekerja_id, panel_id, kode_komponen, proses, tahap, tanggal, mulai, selesai, durasi_menit,
      data, alasan, dibatalkan_oleh, sumber)
    values (r.id, r.pekerja_id, r.panel_id, r.kode_komponen, r.proses, r.tahap, r.tanggal, r.mulai, r.selesai, r.durasi_menit,
      r.j, btrim(p_alasan), btrim(p_oleh), p_sumber);
    v_ringkas := v_ringkas || format('timer %s (pekerja %s, panel %s %s %s, %s)', r.id, r.pekerja_id, r.panel_id, r.kode_komponen, r.proses, r.tanggal);
  end loop;
  delete from public.fcs_timer_kerja t where t.id = any(p_timer_ids);
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (btrim(p_oleh), 'BATAL TIMER', 'Batalkan timer salah pilih: ' || array_to_string(v_ringkas, '; ') || ' - alasan: ' || btrim(p_alasan),
    'produksi', case when p_sumber = 'operator' then 'Vista Pekerja' else 'Admin' end);
  return jsonb_build_object('dibatalkan', v_n, 'timer_ids', to_jsonb(p_timer_ids));
end $$;

create or replace function public.pulihkan_timer_batal(p_batal_id bigint, p_alasan text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record;
begin
  if coalesce(length(btrim(p_alasan)), 0) < 5 then raise exception 'Alasan pemulihan wajib diisi (min 5 huruf).' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'Nama pelaku wajib.' using errcode = '22023'; end if;
  select * into b from public.fcs_timer_kerja_batal where id = p_batal_id for update;
  if not found then raise exception 'Catatan batal % tidak ada.', p_batal_id using errcode = '22023'; end if;
  if b.dipulihkan_at is not null then raise exception 'Timer ini sudah dipulihkan % oleh %.', b.dipulihkan_at, b.dipulihkan_oleh using errcode = '22023'; end if;
  if exists (select 1 from public.fcs_timer_kerja where id = b.timer_id) then raise exception 'Timer id % sudah ada lagi.', b.timer_id using errcode = '22023'; end if;
  begin
    insert into public.fcs_timer_kerja overriding system value
      select * from jsonb_populate_record(null::public.fcs_timer_kerja, b.data);
  exception when unique_violation then
    raise exception 'Tidak bisa dipulihkan: pekerja ini sudah punya timer aktif lain untuk komponen/proses yang sama. Hentikan dulu timer itu.' using errcode = '23505';
  end;
  update public.fcs_timer_kerja_batal set dipulihkan_at = now(), dipulihkan_oleh = btrim(p_oleh), alasan_pulih = btrim(p_alasan) where id = p_batal_id;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (btrim(p_oleh), 'PULIHKAN TIMER', format('Pulihkan timer %s (pekerja %s, panel %s %s %s, %s) - alasan: %s', b.timer_id, b.pekerja_id, b.panel_id, b.kode_komponen, b.proses, b.tanggal, btrim(p_alasan)),
    'produksi', 'Admin');
  return jsonb_build_object('dipulihkan', b.timer_id);
end $$;

revoke all on function public.batalkan_timer_salah_pilih(bigint[], text, text, text) from public;
revoke all on function public.pulihkan_timer_batal(bigint, text, text) from public;
grant execute on function public.batalkan_timer_salah_pilih(bigint[], text, text, text) to anon, authenticated;
grant execute on function public.pulihkan_timer_batal(bigint, text, text) to anon, authenticated;
commit;
