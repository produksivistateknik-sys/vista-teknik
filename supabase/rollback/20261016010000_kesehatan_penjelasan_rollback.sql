-- ROLLBACK penjelasan Kesehatan Data: hapus 5 kolom baru (halaman kembali memakai kolom 'penjelasan' lama).
begin;
alter table public.kesehatan_cek
  drop column if exists apa_terjadi,
  drop column if exists penyebab_umum,
  drop column if exists dampak_aplikasi,
  drop column if exists langkah,
  drop column if exists aplikasi;
commit;
