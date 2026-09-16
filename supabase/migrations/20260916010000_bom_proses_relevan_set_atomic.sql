-- Fix latent bug: KapasitasPekerjaanTab.saveProsesRelevan() .delete() dari client selalu silent
-- no-op (16 Sep 2026, lihat investigasi 10-11 Sep 2026 - "bom_proses_relevan: anon .delete()
-- silent no-op").
--
-- Root cause: bom_proses_relevan RLS aktif TANPA policy DELETE utk anon - operasi
-- .delete().eq(kode_komponen,...).eq(tipe_panel,...) dari client "sukses" (gak ada error) tapi
-- 0 baris kena. saveProsesRelevan() (pola replace: delete lama lalu insert baru) jadi:
-- - Hapus mapping proses lewat UI TIDAK PERNAH beneran tersimpan (mapping lama tetap ada).
-- - Disimpan ulang dgn pilihan yang sama = mapping DUPLIKAT numpuk tiap kali (delete no-op,
--   insert tetap jalan).
-- Ini akar masalah YANG SAMA dengan histori bug "badge BUSBAR hantu" (10 Sep 2026) - 8 baris
-- bom_proses_relevan jenis_pekerjaan='BUSBAR' yang gak pernah bisa dihapus lewat client, cuma
-- berhasil lewat Supabase SQL Editor (service_role).
--
-- Fix: function SECURITY DEFINER - jalan pakai privilege OWNER (bukan privilege anon si
-- pemanggil), jadi delete BENERAN jalan. Scope SENGAJA disempitkan lewat parameter (cuma bisa
-- replace mapping utk 1 kode_komponen+tipe_panel per panggilan) - BUKAN buka akses DELETE bebas
-- ke seluruh tabel via anon key. RLS tabel bom_proses_relevan SENDIRI TIDAK diubah/dilonggarkan
-- sama sekali - tetap gak ada policy DELETE langsung utk anon, cuma nambah SATU jalur resmi yang
-- terkontrol lewat RPC ini.
create or replace function public.set_bom_proses_relevan(
  p_kode_komponen text, p_tipe_panel text, p_proses_list text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bom_proses_relevan
  where kode_komponen = p_kode_komponen and tipe_panel = p_tipe_panel;

  if array_length(p_proses_list, 1) > 0 then
    insert into public.bom_proses_relevan (kode_komponen, tipe_panel, jenis_pekerjaan)
    select p_kode_komponen, p_tipe_panel, unnest(p_proses_list);
  end if;
end;
$$;

grant execute on function public.set_bom_proses_relevan(text, text, text[]) to anon, authenticated;

comment on function public.set_bom_proses_relevan(text, text, text[]) is
  'Replace mapping proses-relevan (bom_proses_relevan) utk 1 kode_komponen+tipe_panel - SECURITY DEFINER khusus supaya DELETE beneran jalan (tabel ini gak punya policy DELETE utk anon), scope dibatasi 1 kombinasi kode+tipe per panggilan lewat parameter, RLS tabel TIDAK diubah.';
