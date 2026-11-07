// TOKEN WARNA KARTU STATUS (7 Nov 2026) - SATU sumber warna lembut kartu per status utk tab Aktivitas Panel (.akp) & tab
// Kendala (.kda). Nilai dipindah apa adanya dari AktivitasPanelTab (tampilan Aktivitas Panel tidak berubah). Terang = :root,
// gelap = [data-theme="dark"] (sama dgn globalCss). Pemakai menyisipkan string ini di <style> miliknya; disisipkan dua kali aman.
// --ks-*penting (8 Nov 2026): kuning lembut catatan penting/disematkan (subtab Catatan).
export const TOKEN_KARTU_STATUS = `
:root{--ks-prog:#9a5500;--ks-prog-soft:#fff1d9;--ks-done:#117238;--ks-done-soft:#e2f5e9;--ks-nb-progres:#fff2e5;--ks-nb-selesai:#e7f7ee;
  --ks-penting:#8a5a00;--ks-penting-soft:#fdf0bf;--ks-nb-penting:#fffbe6}
[data-theme="dark"]{--ks-prog:#f2b45a;--ks-prog-soft:#3a2a10;--ks-done:#4cd07f;--ks-done-soft:#143323;--ks-nb-progres:#39290f;--ks-nb-selesai:#17362a;
  --ks-penting:#f5cf4a;--ks-penting-soft:#3d3511;--ks-nb-penting:#2e2a12}
`
