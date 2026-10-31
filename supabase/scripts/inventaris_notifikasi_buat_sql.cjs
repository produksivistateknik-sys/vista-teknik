// Pembuat migrasi 20261031010000_inventaris_notifikasi.sql: menyalin definisi TERBARU tiap RPC operator dari migrasi yang
// sudah live, lalu menyisipkan pencatat notifikasi di titik jangkar (isi lain tidak berubah). Juga menulis rollback.
const fs = require('fs'); const R = require('path').resolve(__dirname, '..') + '/'
const baca = f => fs.readFileSync(R + 'migrations/' + f, 'utf8').replace(/\r\n/g, '\n')
// cari baris "create [or replace] function public.<nama>(" TERAKHIR (bukan baris grant/revoke yang juga memuat nama fungsi)
const ambil = (f, nama) => { const s = baca(f); const re = new RegExp('\\ncreate (or replace )?function public\\.' + nama + '\\(', 'g'); let m, a = -1
  while ((m = re.exec(s))) a = m.index + 1
  if (a < 0) throw new Error(nama); const z = s.indexOf('\nend $$;', a) + '\nend $$;'.length; return s.slice(a, z) }
const sisip = (teks, jangkar, baru, sebelum = false) => { if (teks.split(jangkar).length !== 2) throw new Error('jangkar: ' + jangkar.slice(0, 80)); return teks.replace(jangkar, sebelum ? baru + jangkar : jangkar + baru) }
const asal = {
  set_kondisi: ambil('20261030050000_inventaris_laporan_operator.sql', 'inv_set_kondisi'),
  tambah_op: ambil('20261030040000_inventaris_tambah_operator.sql', 'inv_tambah_barang_operator'),
  buat_lap: ambil('20261030010000_inventaris_t1.sql', 'inv_buat_laporan'),
  status_lap: ambil('20261030050000_inventaris_laporan_operator.sql', 'inv_ubah_status_laporan'),
  selesai: ambil('20261030010000_inventaris_t1.sql', 'inv_selesai_jadwal'),
  update_lap: ambil('20261030010000_inventaris_t1.sql', 'inv_tambah_update_laporan'),
  diperiksa: ambil('20261030040000_inventaris_tambah_operator.sql', 'inv_tandai_diperiksa'),
}
const orrep = s => s.replace(/^create function/, 'create or replace function')
let f = { ...asal }
// 1. inv_set_kondisi
f.set_kondisi = sisip(f.set_kondisi, 'declare a record; b public.inv_barang;', ' v_seb jsonb;')
f.set_kondisi = sisip(f.set_kondisi, '  perform public.inv_konteks(a.nama, a.peran);\n', '  v_seb := jsonb_build_object(\'kondisi\', b.kondisi, \'detail\', b.detail_kondisi);\n', true)
f.set_kondisi = sisip(f.set_kondisi, '   where id = p_id\n  returning * into b;\n', `  -- notifikasi admin (31 Okt 2026): hanya tindakan operator yang benar-benar mengubah kondisi/detail
  if a.peran = 'operator' and (v_seb->>'kondisi' is distinct from b.kondisi or v_seb->>'detail' is distinct from b.detail_kondisi) then
    perform public.inv_catat_notif(case when v_seb->>'kondisi' is distinct from b.kondisi then 'kondisi' else 'kondisi_detail' end,
      a.nama, a.pekerja_id, a.divisi, b.id, null,
      case when v_seb->>'kondisi' is distinct from b.kondisi
        then 'Kondisi ' || b.nama || ': ' || public.inv_label_kondisi(v_seb->>'kondisi') || ' → ' || public.inv_label_kondisi(b.kondisi)
        else 'Detail kondisi ' || b.nama || ': ' || coalesce(b.detail_kondisi, '(dikosongkan)') end,
      v_seb, jsonb_build_object('kondisi', b.kondisi, 'detail', b.detail_kondisi));
  end if;
`)
// 2. inv_tambah_barang_operator
f.tambah_op = sisip(f.tambah_op, `  return to_jsonb(b) || jsonb_build_object('dobel', false);`, `  perform public.inv_catat_notif('barang_baru', a.nama, a.pekerja_id, a.divisi, b.id, null,
    'Barang baru: ' || b.nama || coalesce(' (' || b.nomor_inventaris || ')', ''), null,
    jsonb_build_object('nama', b.nama, 'nomor', b.nomor_inventaris, 'lokasi', b.lokasi_kode, 'kondisi', b.kondisi));
`, true)
// 3. inv_buat_laporan (b = barang SEBELUM jadi rusak)
f.buat_lap = sisip(f.buat_lap, `  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n, 'dobel', false);`, `  if a.peran = 'operator' then
    perform public.inv_catat_notif('laporan_baru', a.nama, a.pekerja_id, a.divisi, b.id, l.id,
      'Laporan kerusakan ' || b.nama || ': ' || l.judul, jsonb_build_object('kondisi', b.kondisi),
      jsonb_build_object('kondisi', 'rusak', 'judul', l.judul, 'media', v_n));
  end if;
`, true)
// 4. inv_ubah_status_laporan (b = barang sebelum perubahan kondisi)
f.status_lap = sisip(f.status_lap, `  return jsonb_build_object('laporan', to_jsonb(l), 'media', v_n);`, `  if a.peran = 'operator' then
    perform public.inv_catat_notif(case when p_status <> v_lama then 'laporan_status' else 'laporan_update' end,
      a.nama, a.pekerja_id, a.divisi, b.id, l.id,
      case when p_status <> v_lama then 'Laporan ' || l.judul || ': ' || public.inv_label_status(v_lama) || ' → ' || public.inv_label_status(p_status)
        else 'Update laporan ' || l.judul || coalesce(': ' || nullif(btrim(p_catatan), ''), '') end,
      jsonb_build_object('status', v_lama, 'kondisi', b.kondisi),
      jsonb_build_object('status', p_status, 'kondisi', (select kondisi from public.inv_barang where id = b.id), 'catatan', nullif(btrim(p_catatan), ''), 'media', v_n));
  end if;
`, true)
// 5. inv_selesai_jadwal (ref = jadwal)
f.selesai = sisip(f.selesai, 'declare a record; j public.inv_jadwal;', ' v_jt_lama date;')
f.selesai = sisip(f.selesai, '  select * into b from public.inv_barang where id = j.barang_id;\n', '  v_jt_lama := j.jatuh_tempo;\n', true)
f.selesai = sisip(f.selesai, `  return jsonb_build_object('selesai', to_jsonb(s), 'jadwal', to_jsonb(j), 'dobel', false);`, `  if a.peran = 'operator' then
    perform public.inv_catat_notif('maintenance_selesai', a.nama, a.pekerja_id, a.divisi, j.barang_id, j.id,
      'Maintenance selesai: ' || j.jenis || ' - ' || b.nama, jsonb_build_object('jatuh_tempo', v_jt_lama),
      jsonb_build_object('jatuh_tempo', j.jatuh_tempo, 'selesai_id', s.id, 'media', v_n, 'catatan', s.catatan));
  end if;
`, true)
// 6. inv_tambah_update_laporan
f.update_lap = sisip(f.update_lap, `  return jsonb_build_object('update', to_jsonb(u), 'media', v_n);`, `  if a.peran = 'operator' then
    perform public.inv_catat_notif('laporan_update', a.nama, a.pekerja_id, a.divisi, l.barang_id, l.id,
      'Update laporan ' || l.judul || coalesce(': ' || nullif(btrim(p_catatan), ''), ''), null,
      jsonb_build_object('update_id', u.id, 'catatan', nullif(btrim(p_catatan), ''), 'media', v_n));
  end if;
`, true)
// 7. inv_tandai_diperiksa: notifikasi barang_baru barang itu ikut selesai (satu kebenaran: tombol lama & panel)
f.diperiksa = sisip(f.diperiksa, `  insert into public.inv_log (barang_id, jenis, dari, ke, oleh, sumber, keterangan)
  values (b.id, 'data', 'belum diperiksa', 'sudah diperiksa', a.nama, 'admin', 'diperiksa');`, `
  update public.inv_notifikasi set status = 'selesai', keputusan = 'disetujui', diputuskan_oleh = a.nama, diputuskan_pada = now(), versi = versi + 1
   where barang_id = b.id and jenis = 'barang_baru' and status <> 'selesai';`)

const fungsiBaru = Object.values(f).map(orrep).join('\n\n')
const fungsiLama = Object.values(asal).map(orrep).join('\n\n')

const migrasi = `-- ============================================================================================
-- INVENTARIS - NOTIFIKASI & PERSETUJUAN ADMIN ATAS TINDAKAN OPERATOR (31 Okt 2026, rancangan disetujui user 30 Okt).
-- Migrasi TAMBAHAN di atas 20261030010000..20261030050000 yang sudah live. Tidak mengubah data yang ada.
-- DIBUAT OTOMATIS oleh skrip pembuat dari definisi RPC TERBARU di migrasi sebelumnya + sisipan pencatat notifikasi
-- (isi lain tiap fungsi tidak berubah).
--   * inv_notifikasi (permanen, realtime, baca-saja utk anon): 1 baris per tindakan operator, dibuat DI DALAM RPC operator
--     (satu transaksi dgn perubahannya; RPC gagal = tidak ada notifikasi; kirim ulang ber-kunci keluar lebih awal = tidak dobel).
--     Jenis: kondisi, kondisi_detail, barang_baru, laporan_baru, laporan_status, laporan_update, maintenance_selesai.
--     Tindakan ADMIN tidak membuat notifikasi (maka tidak ada push utk tindakan admin).
--   * Perubahan operator tetap berlaku langsung; admin memutuskan sesudahnya (versi = kunci bentrok antar admin, VTVER):
--     inv_notif_dilihat(ids[]), inv_notif_setujui(id, versi), inv_notif_kembalikan(id, versi, catatan):
--       kondisi/kondisi_detail -> kondisi+detail kembali ke nilai_sebelum (inv_log sumber admin); ditolak bila sudah berubah lagi
--       barang_baru            -> keputusan 'ditolak' = barang dinonaktifkan (+ sudah diperiksa)
--       laporan_status         -> laporan kembali ke status sebelumnya (lewat inv_ubah_status_laporan admin); ditolak bila sudah berubah
--       laporan_baru / laporan_update / maintenance_selesai -> catatan WAJIB, data tidak diubah
--   * Push (T3): kolom push_status; inv_notif_ambil_push() HANYA service_role (Edge Function inv-notif-push, cron tiap menit):
--     klaim atomik per (operator, jenis) bila tindakan terakhir kelompok >= 30 dtk (atau tertua >= 3 mnt); > 60 mnt = dilewati.
--   * inv_tandai_diperiksa: notifikasi barang_baru barang itu ikut selesai/disetujui.
-- Verifikasi: supabase/verifikasi/20261031010000_inventaris_notifikasi_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261031010000_inventaris_notifikasi_rollback.sql
-- ============================================================================================
begin;

create table public.inv_notifikasi (
  id bigserial primary key,
  jenis text not null check (jenis in ('kondisi','kondisi_detail','barang_baru','laporan_baru','laporan_status','laporan_update','maintenance_selesai')),
  oleh text not null,
  pekerja_id bigint,
  divisi text,
  barang_id bigint not null references public.inv_barang(id),
  ref_id bigint,                          -- laporan (laporan_*) / jadwal (maintenance_selesai)
  teks text not null,
  nilai_sebelum jsonb,
  nilai_sesudah jsonb,
  status text not null default 'baru' check (status in ('baru','dilihat','selesai')),
  keputusan text check (keputusan in ('disetujui','dikembalikan','ditolak')),
  catatan_keputusan text,
  diputuskan_oleh text,
  diputuskan_pada timestamptz,
  dilihat_oleh text,
  dilihat_pada timestamptz,
  versi int not null default 1,
  push_status text not null default 'menunggu' check (push_status in ('menunggu','dikirim','dilewati')),
  push_pada timestamptz,
  dibuat_pada timestamptz not null default now(),
  check ((status = 'selesai') = (keputusan is not null))
);
create index inv_notifikasi_status on public.inv_notifikasi (status, id desc);
create index inv_notifikasi_barang on public.inv_notifikasi (barang_id);
create index inv_notifikasi_divisi on public.inv_notifikasi (divisi, id desc) where keputusan in ('dikembalikan','ditolak');
create index inv_notifikasi_push on public.inv_notifikasi (push_status, pekerja_id, jenis) where push_status = 'menunggu';
alter table public.inv_notifikasi enable row level security;
revoke all on public.inv_notifikasi from anon, authenticated;
grant select on public.inv_notifikasi to anon, authenticated;
create policy baca_inv_notifikasi on public.inv_notifikasi for select to anon, authenticated using (true);
create trigger inv_notifikasi_permanen before delete on public.inv_notifikasi for each row execute function public.inv_tolak_ubah();

create or replace function public.inv_label_kondisi(p text) returns text language sql immutable as $$
  select case p when 'baik' then 'Berfungsi baik' when 'tidak_maksimal' then 'Berfungsi tidak maksimal'
    when 'perlu_maintenance' then 'Perlu maintenance' when 'rusak' then 'Rusak' when 'belum_dinilai' then 'Belum dinilai' else coalesce(p, '-') end
$$;
create or replace function public.inv_label_status(p text) returns text language sql immutable as $$
  select case p when 'open' then 'Open' when 'in_progress' then 'In Progress' when 'closed' then 'Closed' else coalesce(p, '-') end
$$;

create or replace function public.inv_catat_notif(p_jenis text, p_oleh text, p_pekerja_id bigint, p_divisi text, p_barang_id bigint,
  p_ref_id bigint, p_teks text, p_sebelum jsonb, p_sesudah jsonb) returns bigint
language sql security definer set search_path = public as $$
  insert into public.inv_notifikasi (jenis, oleh, pekerja_id, divisi, barang_id, ref_id, teks, nilai_sebelum, nilai_sesudah)
  values (p_jenis, p_oleh, p_pekerja_id, p_divisi, p_barang_id, p_ref_id, left(p_teks, 300), p_sebelum, p_sesudah)
  returning id
$$;

-- ── RPC operator: definisi terbaru + pencatat notifikasi ─────────────────────────────────────
${fungsiBaru}

-- ── RPC admin ────────────────────────────────────────────────────────────────────────────────
create or replace function public.inv_notif_kunci(p_id bigint, p_versi int, p_aktor jsonb, out a_nama text, out n public.inv_notifikasi)
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  select * into n from public.inv_notifikasi where id = p_id for update;
  if not found then raise exception 'Notifikasi tidak ditemukan' using errcode = 'P0002'; end if;
  if n.status = 'selesai' then
    raise exception 'Notifikasi ini sudah diputuskan (%) oleh % - muat ulang', n.keputusan, n.diputuskan_oleh using errcode = 'VTVER';
  end if;
  if n.versi <> p_versi then raise exception 'Notifikasi ini baru diubah admin lain - muat ulang dulu' using errcode = 'VTVER'; end if;
  a_nama := a.nama;
end $$;

create or replace function public.inv_notif_dilihat(p_ids bigint[], p_aktor jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare a record; v int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'admin' then raise exception 'Hanya admin' using errcode = '42501'; end if;
  -- tidak menaikkan versi: admin lain yang sedang memutuskan tidak terganggu
  update public.inv_notifikasi set status = 'dilihat', dilihat_oleh = a.nama, dilihat_pada = now()
   where id = any(p_ids) and status = 'baru';
  get diagnostics v = row_count;
  return v;
end $$;

create or replace function public.inv_notif_setujui(p_id bigint, p_versi int, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k record; n public.inv_notifikasi;
begin
  select * into k from public.inv_notif_kunci(p_id, p_versi, p_aktor);
  if (k.n).jenis = 'barang_baru' then
    perform public.inv_tandai_diperiksa((k.n).barang_id, p_aktor);   -- ikut menutup notifikasi barang_baru lain barang itu
  end if;
  update public.inv_notifikasi set status = 'selesai', keputusan = 'disetujui', diputuskan_oleh = k.a_nama, diputuskan_pada = now(),
         dilihat_oleh = coalesce(dilihat_oleh, k.a_nama), dilihat_pada = coalesce(dilihat_pada, now()), versi = versi + 1
   where id = p_id and status <> 'selesai';
  select * into n from public.inv_notifikasi where id = p_id;
  return to_jsonb(n);
end $$;

create or replace function public.inv_notif_kembalikan(p_id bigint, p_versi int, p_catatan text, p_aktor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k record; n public.inv_notifikasi; b public.inv_barang; l public.inv_laporan; g record; v_kep text := 'dikembalikan';
  v_cat text := nullif(btrim(p_catatan), '');
begin
  select * into k from public.inv_notif_kunci(p_id, p_versi, p_aktor);
  n := k.n;
  if n.jenis in ('kondisi', 'kondisi_detail') then
    select * into b from public.inv_barang where id = n.barang_id for update;
    if b.kondisi is distinct from n.nilai_sesudah->>'kondisi' or b.detail_kondisi is distinct from n.nilai_sesudah->>'detail' then
      select oleh, waktu into g from public.inv_log where barang_id = b.id and jenis = 'kondisi' order by id desc limit 1;
      raise exception 'Tidak bisa dikembalikan: kondisi % sudah diubah lagi oleh % (%). Tinjau notifikasi terbarunya.',
        b.nama, coalesce(g.oleh, '-'), to_char(g.waktu at time zone 'Asia/Jakarta', 'DD Mon HH24.MI') using errcode = 'VTVER';
    end if;
    if exists (select 1 from public.inv_laporan where barang_id = b.id and status <> 'closed') then
      raise exception 'Tidak bisa dikembalikan: ada laporan kerusakan aktif pada %', b.nama using errcode = '42501';
    end if;
    perform public.inv_konteks(k.a_nama, 'admin', 'Dikembalikan dari notifikasi #' || n.id || coalesce(': ' || v_cat, ''));
    update public.inv_barang set kondisi = n.nilai_sebelum->>'kondisi', detail_kondisi = n.nilai_sebelum->>'detail' where id = b.id;
  elsif n.jenis = 'barang_baru' then
    v_kep := 'ditolak';
    select * into b from public.inv_barang where id = n.barang_id for update;
    perform public.inv_konteks(k.a_nama, 'admin', 'Ditolak dari notifikasi #' || n.id || coalesce(': ' || v_cat, ''));
    update public.inv_barang set aktif = false, sudah_diperiksa = true, diperiksa_oleh = k.a_nama, diperiksa_pada = now() where id = b.id;
  elsif n.jenis = 'laporan_status' then
    select * into l from public.inv_laporan where id = n.ref_id;
    if l.status is distinct from n.nilai_sesudah->>'status' then
      raise exception 'Tidak bisa dikembalikan: status laporan sudah berubah lagi (sekarang %)', public.inv_label_status(l.status) using errcode = 'VTVER';
    end if;
    perform public.inv_ubah_status_laporan(l.id, n.nilai_sebelum->>'status', 'Dikembalikan admin' || coalesce(': ' || v_cat, ''),
      null, null, null, p_aktor);
  else
    if v_cat is null then raise exception 'Tuliskan catatan untuk operator' using errcode = '22023'; end if;
  end if;
  update public.inv_notifikasi set status = 'selesai', keputusan = v_kep, catatan_keputusan = v_cat, diputuskan_oleh = k.a_nama,
         diputuskan_pada = now(), dilihat_oleh = coalesce(dilihat_oleh, k.a_nama), dilihat_pada = coalesce(dilihat_pada, now()), versi = versi + 1
   where id = p_id
  returning * into n;
  return to_jsonb(n);
end $$;

-- ── Push (T3): klaim atomik utk Edge Function inv-notif-push (service_role saja) ──────────────────
create or replace function public.inv_notif_ambil_push(p_tenang_detik int default 30, p_maks_tunggu_detik int default 180,
  p_basi_menit int default 60) returns setof public.inv_notifikasi
language plpgsql security definer set search_path = public as $$
begin
  update public.inv_notifikasi set push_status = 'dilewati', push_pada = now()
   where push_status = 'menunggu' and dibuat_pada < now() - make_interval(mins => p_basi_menit);
  return query
  with kel as (
    select pekerja_id, jenis from public.inv_notifikasi where push_status = 'menunggu'
    group by pekerja_id, jenis
    having max(dibuat_pada) <= now() - make_interval(secs => p_tenang_detik) or min(dibuat_pada) <= now() - make_interval(secs => p_maks_tunggu_detik)
  ), ambil as (
    select x.id from public.inv_notifikasi x join kel on kel.pekerja_id is not distinct from x.pekerja_id and kel.jenis = x.jenis
     where x.push_status = 'menunggu' for update of x skip locked
  )
  update public.inv_notifikasi x set push_status = 'dikirim', push_pada = now() from ambil where x.id = ambil.id
  returning x.*;
end $$;

revoke execute on function public.inv_catat_notif(text, text, bigint, text, bigint, bigint, text, jsonb, jsonb),
  public.inv_notif_kunci(bigint, int, jsonb), public.inv_notif_ambil_push(int, int, int) from public, anon, authenticated;
grant execute on function public.inv_notif_ambil_push(int, int, int) to service_role;
grant execute on function public.inv_label_kondisi(text), public.inv_label_status(text),
  public.inv_notif_dilihat(bigint[], jsonb), public.inv_notif_setujui(bigint, int, jsonb),
  public.inv_notif_kembalikan(bigint, int, text, jsonb) to anon, authenticated;

commit;
`
const rollback = `-- ROLLBACK 20261031010000_inventaris_notifikasi: RPC operator & inv_tandai_diperiksa kembali ke definisi sebelumnya
-- (disalin otomatis), fungsi notifikasi dicabut. Tabel inv_notifikasi SENGAJA TIDAK dihapus (data permanen) - hanya
-- tidak diisi lagi. Rollback aplikasi (panel admin) dulu sebelum menjalankan ini.
begin;
${fungsiLama}

drop function if exists public.inv_notif_ambil_push(int, int, int);
drop function if exists public.inv_notif_kembalikan(bigint, int, text, jsonb);
drop function if exists public.inv_notif_setujui(bigint, int, jsonb);
drop function if exists public.inv_notif_dilihat(bigint[], jsonb);
drop function if exists public.inv_notif_kunci(bigint, int, jsonb);
drop function if exists public.inv_catat_notif(text, text, bigint, text, bigint, bigint, text, jsonb, jsonb);
select count(*) as sisa_fungsi_notif from pg_proc where proname like 'inv_notif%' or proname = 'inv_catat_notif';
commit;
`
fs.writeFileSync(R + 'migrations/20261031010000_inventaris_notifikasi.sql', migrasi)
fs.writeFileSync(R + 'rollback/20261031010000_inventaris_notifikasi_rollback.sql', rollback)
console.log('ok', migrasi.split('\n').length, 'baris; rollback', rollback.split('\n').length)
