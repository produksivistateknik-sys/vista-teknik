-- ============================================================================================
-- KESEHATAN DATA - kelompok error SELESAI OTOMATIS setelah 48 jam tanpa kejadian (16 Okt 2026, keputusan user:
-- "hilang otomatis jika sudah tidak ada errornya, tidak perlu aku yang tandai", batas 48 jam).
-- (1) kolom kesehatan_status_error.otomatis (true = ditandai selesai oleh sistem).
-- (2) selesaikan_error_otomatis(): kelompok (sidik) berstatus Baru / Sedang ditangani / belum pernah ditandai yang
--     kejadian TERAKHIRNYA lebih dari 48 jam lalu -> Selesai (otomatis). Versi patokan = versi TERBARU yang pernah
--     tercatat untuk aplikasi itu, sehingga kejadian dari HP/tab versi lama tidak membuka kembali; kejadian dari versi
--     sama/lebih baru membuka kembali lewat trigger yang sudah ada (status Baru + "Muncul lagi").
--     Diabaikan & Selesai (manual) tidak disentuh. Jalan di SERVER (pg_cron tiap jam menit 20), bukan di browser.
-- (3) tandai_status_error (manual) & trigger buka-kembali diperbarui: otomatis = false.
-- Rollback: supabase/rollback/20261016070000_status_error_otomatis_rollback.sql
-- ============================================================================================
begin;

alter table public.kesehatan_status_error add column if not exists otomatis boolean not null default false;

create or replace function public.selesaikan_error_otomatis()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int; v_ringkas text;
begin
  with grup as (
    select e.sidik, max(e.aplikasi) as aplikasi, max(e.waktu_terakhir) as terakhir, sum(e.jumlah)::int as jumlah,
           (array_agg(e.pesan order by e.waktu_terakhir desc))[1] as pesan
    from public.log_error_app e
    group by e.sidik
    having max(e.waktu_terakhir) < now() - interval '48 hours'
  ), kandidat as (
    select g.*, (select max(public._versi_angka(x.versi)) from public.log_error_app x where x.aplikasi = g.aplikasi) as versi_terbaru
    from grup g left join public.kesehatan_status_error s on s.sidik = g.sidik
    where s.sidik is null or s.status in ('baru', 'ditangani')
  ), tulis as (
    insert into public.kesehatan_status_error (sidik, aplikasi, status, catatan, versi_ditandai, jumlah_saat_ditandai, ditandai_oleh, ditandai_pada,
                                               muncul_lagi, muncul_lagi_pada, muncul_lagi_versi, otomatis)
    select k.sidik, k.aplikasi, 'selesai',
           'otomatis: tidak terjadi lagi 48 jam (terakhir ' || to_char(k.terakhir at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') || ' WIB)',
           k.versi_terbaru::text, k.jumlah, 'Sistem (otomatis)', now(), false, null, null, true
    from kandidat k
    on conflict (sidik) do update set status = 'selesai', catatan = excluded.catatan, versi_ditandai = excluded.versi_ditandai,
      jumlah_saat_ditandai = excluded.jumlah_saat_ditandai, ditandai_oleh = excluded.ditandai_oleh, ditandai_pada = excluded.ditandai_pada,
      muncul_lagi = false, muncul_lagi_pada = null, muncul_lagi_versi = null, otomatis = true
    returning sidik
  )
  select count(*), string_agg(format('%s %s (%s kejadian, terakhir %s)', k.aplikasi, left(k.pesan, 90), k.jumlah,
                                     to_char(k.terakhir at time zone 'Asia/Jakarta', 'DD Mon HH24:MI')), '; ')
    into v_n, v_ringkas
  from tulis t join kandidat k on k.sidik = t.sidik;

  if v_n > 0 then
    insert into public.activity_log (user_name, action, description, module, halaman)
    values ('Sistem (otomatis)', 'STATUS ERROR APLIKASI', left(v_n || ' kelompok error -> selesai (otomatis, 48 jam tanpa kejadian): ' || v_ringkas, 4000),
            'system_error', 'pg_cron kesehatan-error-otomatis');
  end if;
  return v_n;
end $$;
revoke execute on function public.selesaikan_error_otomatis() from public, anon, authenticated;

-- tandai manual: otomatis = false (sisanya SAMA dgn 20261016060000)
create or replace function public.tandai_status_error(p_sidik text, p_status text, p_catatan text, p_versi text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_app text; v_pesan text; v_jumlah int; v_lama text;
begin
  if p_status not in ('baru', 'ditangani', 'selesai', 'diabaikan') then
    raise exception 'Status tidak dikenal: %', p_status using errcode = 'P0001';
  end if;
  select max(aplikasi), (array_agg(pesan order by waktu_terakhir desc))[1], coalesce(sum(jumlah), 0)::int
    into v_app, v_pesan, v_jumlah from public.log_error_app where sidik = p_sidik;
  if v_app is null then raise exception 'Kelompok error % tidak ditemukan', p_sidik using errcode = 'P0002'; end if;
  select status into v_lama from public.kesehatan_status_error where sidik = p_sidik;
  insert into public.kesehatan_status_error (sidik, aplikasi, status, catatan, versi_ditandai, jumlah_saat_ditandai, ditandai_oleh, ditandai_pada, muncul_lagi, muncul_lagi_pada, muncul_lagi_versi, otomatis)
  values (p_sidik, v_app, p_status, left(nullif(trim(p_catatan), ''), 500), left(nullif(trim(p_versi), ''), 40), v_jumlah,
          left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), now(), false, null, null, false)
  on conflict (sidik) do update set status = excluded.status, catatan = excluded.catatan, versi_ditandai = excluded.versi_ditandai,
    jumlah_saat_ditandai = excluded.jumlah_saat_ditandai, ditandai_oleh = excluded.ditandai_oleh, ditandai_pada = excluded.ditandai_pada,
    muncul_lagi = false, muncul_lagi_pada = null, muncul_lagi_versi = null, otomatis = false;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (left(coalesce(nullif(trim(p_oleh), ''), 'Unknown'), 100), 'STATUS ERROR APLIKASI',
    format('%s -> %s | %s | %s | versi %s | %s kejadian s.d. ditandai%s', coalesce(v_lama, 'baru'), p_status, v_app, left(v_pesan, 160),
           coalesce(nullif(trim(p_versi), ''), '-'), v_jumlah, case when nullif(trim(p_catatan), '') is not null then ' | catatan: ' || left(trim(p_catatan), 300) else '' end),
    'system_error', 'Kesehatan Data');
  return jsonb_build_object('sidik', p_sidik, 'status', p_status, 'jumlah_saat_ditandai', v_jumlah);
end $$;

-- buka kembali: otomatis = false (sisanya SAMA dgn 20261016060000)
create or replace function public._buka_lagi_status_error() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.kesehatan_status_error where sidik = new.sidik and status = 'selesai';
  if not found then return new; end if;
  if new.waktu_terakhir <= s.ditandai_pada then return new; end if;
  if public._versi_angka(s.versi_ditandai) is not null and public._versi_angka(new.versi) is not null
     and public._versi_angka(new.versi) < public._versi_angka(s.versi_ditandai) then
    return new;
  end if;
  update public.kesehatan_status_error set status = 'baru', muncul_lagi = true, muncul_lagi_pada = new.waktu_terakhir, muncul_lagi_versi = new.versi, otomatis = false
   where sidik = new.sidik;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('Sistem (otomatis)', 'STATUS ERROR APLIKASI',
    format('selesai -> baru (MUNCUL LAGI) | %s | %s | versi %s (ditandai selesai di versi %s oleh %s)', new.aplikasi, left(new.pesan, 160),
           coalesce(new.versi, '-'), coalesce(s.versi_ditandai, '-'), coalesce(s.ditandai_oleh, '-')),
    'system_error', 'Kesehatan Data');
  return new;
end $$;

do $$ begin perform cron.unschedule(jobname) from cron.job where jobname = 'kesehatan-error-otomatis'; end $$;
select cron.schedule('kesehatan-error-otomatis', '20 * * * *', $c$select public.selesaikan_error_otomatis()$c$);

commit;
