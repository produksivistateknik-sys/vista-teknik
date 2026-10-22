-- PERBAIKAN pulihkan_timer_batal (22 Okt 2026). Verifikasi 20261022050000 gagal:
--   ERROR 428C9 cannot insert a non-DEFAULT value into column "durasi_menit" - kolom itu GENERATED.
-- Pemulihan kini menyisipkan HANYA kolom yang bukan generated (daftar diambil dari information_schema saat
-- dijalankan, jadi tetap benar bila kolom fcs_timer_kerja bertambah); kolom generated dihitung ulang DB.
-- Fungsi batalkan_timer_salah_pilih & tabel log tidak berubah.
-- Sesudah ini jalankan ULANG: supabase/verifikasi/20261022050000_timer_batal_verifikasi.sql (harus 'SEMUA LULUS').
begin;
create or replace function public.pulihkan_timer_batal(p_batal_id bigint, p_alasan text, p_oleh text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; v_cols text;
begin
  if coalesce(length(btrim(p_alasan)), 0) < 5 then raise exception 'Alasan pemulihan wajib diisi (min 5 huruf).' using errcode = '22023'; end if;
  if coalesce(length(btrim(p_oleh)), 0) < 1 then raise exception 'Nama pelaku wajib.' using errcode = '22023'; end if;
  select * into b from public.fcs_timer_kerja_batal where id = p_batal_id for update;
  if not found then raise exception 'Catatan batal % tidak ada.', p_batal_id using errcode = '22023'; end if;
  if b.dipulihkan_at is not null then raise exception 'Timer ini sudah dipulihkan % oleh %.', b.dipulihkan_at, b.dipulihkan_oleh using errcode = '22023'; end if;
  if exists (select 1 from public.fcs_timer_kerja where id = b.timer_id) then raise exception 'Timer id % sudah ada lagi.', b.timer_id using errcode = '22023'; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'fcs_timer_kerja' and is_generated = 'NEVER';
  begin
    execute format('insert into public.fcs_timer_kerja (%1$s) overriding system value select %1$s from jsonb_populate_record(null::public.fcs_timer_kerja, $1)', v_cols)
      using b.data;
  exception when unique_violation then
    raise exception 'Tidak bisa dipulihkan: pekerja ini sudah punya timer aktif lain untuk komponen/proses yang sama. Hentikan dulu timer itu.' using errcode = '23505';
  end;
  update public.fcs_timer_kerja_batal set dipulihkan_at = now(), dipulihkan_oleh = btrim(p_oleh), alasan_pulih = btrim(p_alasan) where id = p_batal_id;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values (btrim(p_oleh), 'PULIHKAN TIMER', format('Pulihkan timer %s (pekerja %s, panel %s %s %s, %s) - alasan: %s', b.timer_id, b.pekerja_id, b.panel_id, b.kode_komponen, b.proses, b.tanggal, btrim(p_alasan)),
    'produksi', 'Admin');
  return jsonb_build_object('dipulihkan', b.timer_id);
end $$;
revoke all on function public.pulihkan_timer_batal(bigint, text, text) from public;
grant execute on function public.pulihkan_timer_batal(bigint, text, text) to anon, authenticated;
commit;
