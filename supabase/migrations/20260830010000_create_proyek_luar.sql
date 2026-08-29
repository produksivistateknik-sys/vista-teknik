-- Fitur baru "Proyek Luar" (30 Agu 2026) - laporan/dokumentasi pekerjaan operator di proyek
-- eksternal, BERDIRI SENDIRI (tidak terkait WO/panel manapun). Dipakai operator QC/Wiring
-- Control/Wiring Power/Assembling dari Vista Pekerja, dilihat admin dari Vista Teknik
-- (System > Proyek Luar).
--
-- FK ke pekerja(id), BUKAN operator_users(id) - dikonfirmasi lewat investigasi: QC/Wiring/
-- Assembling semuanya sudah pakai pola login "password bersama + pilih nama dari pekerja"
-- (lihat komentar di vista-pekerja/src/lib/panelTypes.ts), operator_users individual sudah
-- gak kepakai lagi buat divisi-divisi ini sejak migrasi sebelumnya.
--
-- foto disimpan JSONB array [{url,uploaded_at,name,mime}] - pola SAMA PERSIS dengan
-- maintenance_log.foto/panels.qc_checklist[item].foto, bukan tabel child terpisah (sesuai
-- skala kebutuhan: 1 laporan foto-fotonya sendiri, gak perlu relasi many-to-many apapun).
create table if not exists public.proyek_luar (
  id bigint generated always as identity primary key,
  nama_lokasi text not null,
  tanggal date not null,
  catatan text,
  foto jsonb not null default '[]'::jsonb,
  status text not null default 'berlangsung' check (status in ('berlangsung','selesai')),
  pekerja_id bigint references public.pekerja(id),
  operator_nama text not null,
  divisi text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proyek_luar_pekerja_id on public.proyek_luar(pekerja_id);
create index if not exists idx_proyek_luar_divisi on public.proyek_luar(divisi);
create index if not exists idx_proyek_luar_tanggal on public.proyek_luar(tanggal desc);
