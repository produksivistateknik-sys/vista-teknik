-- Rollback role HRGA. Batal utuh bila masih ada akun ber-role hrga (ubah/hapus akun itu dulu di menu Database).
begin;
do $$ begin
  if exists (select 1 from public.admins where divisi = 'hrga') then
    raise exception 'Masih ada akun role hrga - ubah dulu sebelum rollback';
  end if;
end $$;
alter table public.admins drop constraint if exists admins_divisi_check;
alter table public.admins add constraint admins_divisi_check check (divisi is null or divisi in ('admin','engineering'));
commit;
