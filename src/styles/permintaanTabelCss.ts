// GAYA TABEL PERMINTAAN BARANG ADMIN (18 Nov 2026, tampilan saja - keputusan user). Dipakai tab Riwayat (Tahap 1) &
// Menunggu Persetujuan (Tahap 2) di PermintaanAdminTab.tsx. Senada tabel Riwayat Inventaris & Maintenance (token tema,
// header huruf kapital kecil abu, lencana bulat bertitik, teks sekunder abu).
// - Nama kelas berawalan "pbt-" (tanpa "card"/"modal": aturan gelap globalCss.ts memaksa elemen ber-nama itu).
// - globalCss.ts memaksa SEMUA <table> di tema gelap dgn !important (th navy #1e3a8a, baris selang-seling, garis td
//   #1e2330 yg nyaris tak terlihat). Di sini ditimpa HANYA untuk tabel .pbt-tbl (spesifisitas lebih tinggi + !important)
//   supaya garis antar baris tetap jelas & header abu lembut - aturan global tidak disentuh.
// - HP (<=768px & html[data-mobile]): baris jadi blok bertumpuk lewat aturanHp (satu sumber, lihat styles/responsif.ts).
import { aturanHp } from './responsif'

export const PERMINTAAN_TABEL_CSS = `
.pbt{--pbt-card:var(--card-bg,#fff);--pbt-fg:var(--text-primary,#16202e);--pbt-mute:#5d6b7e;--pbt-line:#cdd5e1;--pbt-head:#f1f4f8;--pbt-grp:#f7f9fc;
  --pbt-ok:#15803d;--pbt-no:#b91c1c;color:var(--pbt-fg);font-size:13px;line-height:1.4;text-align:left}
[data-theme="dark"] .pbt{--pbt-mute:#9aa6bd;--pbt-line:#3a4260;--pbt-head:#232739;--pbt-grp:#1f2333;--pbt-ok:#4ade80;--pbt-no:#f87171}
.pbt *{box-sizing:border-box}
.pbt .pbt-tw{overflow:auto;max-height:max(560px,calc(100vh - 300px));background:var(--pbt-card);border:1px solid var(--pbt-line);border-radius:10px}
.pbt .pbt-tbl{border-collapse:separate;border-spacing:0;width:100%}
.pbt .pbt-tbl th,.pbt .pbt-tbl td{padding:8px 10px;border-bottom:1px solid var(--pbt-line);text-align:left;vertical-align:top;background:var(--pbt-card)}
.pbt .pbt-tbl th{position:sticky;top:0;z-index:2;background:var(--pbt-head);color:var(--pbt-mute);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.pbt .pbt-tbl tr.pbt-grp td{background:var(--pbt-grp);color:var(--pbt-mute);font-size:11.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:7px 10px}
.pbt .pbt-tbl tbody:last-child tr:last-child td{border-bottom:0}
.pbt .pbt-nw{white-space:nowrap}
.pbt .pbt-mute{color:var(--pbt-mute);font-size:12px}
.pbt .pbt-jam{display:block;color:var(--pbt-mute);font-size:12px}
.pbt .pbt-wrap{overflow-wrap:anywhere;min-width:120px}
.pbt .pbt-nama{font-weight:700}
.pbt .pbt-jenis{display:inline-block;margin-left:6px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;border:1px solid var(--pbt-line);color:var(--pbt-mute);vertical-align:1px;white-space:nowrap}
.pbt .pbt-qty{white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
.pbt .pbt-st{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:99px;white-space:nowrap}
.pbt .pbt-st::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.pbt .st-menunggu{color:#92400e;background:#fef3c7}
.pbt .st-disetujui{color:#1d4ed8;background:#e3ebff}
.pbt .st-siap{color:#0f766e;background:#d5f5ee}
.pbt .st-selesai{color:#166534;background:#dcf5e5}
.pbt .st-ditolak_admin,.pbt .st-ditolak_gudang{color:#b91c1c;background:#fde0e0}
.pbt .st-lain{color:#475569;background:#eef1f5}
[data-theme="dark"] .pbt .st-menunggu{color:#fcd34d;background:#3b2c0e}
[data-theme="dark"] .pbt .st-disetujui{color:#93b4ff;background:#1b2a4d}
[data-theme="dark"] .pbt .st-siap{color:#5eead4;background:#123a36}
[data-theme="dark"] .pbt .st-selesai{color:#86efac;background:#143522}
[data-theme="dark"] .pbt .st-ditolak_admin,[data-theme="dark"] .pbt .st-ditolak_gudang{color:#fca5a5;background:#431b1b}
[data-theme="dark"] .pbt .st-lain{color:#cbd5e1;background:#2a2f42}
.pbt .pbt-alur{display:flex;flex-direction:column;gap:2px;font-size:12px;min-width:175px}
.pbt .pbt-alur .ok{color:var(--pbt-ok)}
.pbt .pbt-alur .no{color:var(--pbt-no)}
.pbt .pbt-alur .belum{color:var(--pbt-mute)}
.pbt .pbt-wkt{white-space:nowrap}
.pbt .pbt-alur b{font-weight:700}
.pbt .pbt-alasan{color:var(--pbt-mute);font-size:11.5px;padding-left:14px;overflow-wrap:anywhere}
.pbt-pilih{height:36px}
.pbt-hitung{margin-left:auto;font-size:12.5px;font-weight:600;color:#475569}
[data-theme="dark"] .pbt-hitung{color:#9aa6bd}
[data-theme="dark"] .pbt .pbt-tbl th{background:var(--pbt-head)!important;color:var(--pbt-mute)!important;border-color:var(--pbt-line)!important}
[data-theme="dark"] .pbt .pbt-tbl td{background:var(--pbt-card)!important;color:var(--pbt-fg)!important;border-color:var(--pbt-line)!important}
[data-theme="dark"] .pbt .pbt-tbl tr.pbt-grp td{background:var(--pbt-grp)!important;color:var(--pbt-mute)!important}
[data-theme="dark"] .pbt .pbt-tbl thead tr{background:transparent!important}
/* Layar <=1200px: kolom Divisi disembunyikan (sudah tertera di baris judul kelompok) supaya tabel muat tanpa gulir di 1100px. */
@media (max-width:1200px){.pbt .pbt-tbl th.c-divisi,.pbt .pbt-tbl td.c-divisi{display:none}}
${aturanHp(768, `
.pbt .pbt-tw{max-height:none;overflow:visible}
.pbt .pbt-tbl thead{display:none}
.pbt .pbt-tbl,.pbt .pbt-tbl tbody{display:block}
.pbt .pbt-tbl tr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"barang qty status" "proyek proyek proyek" "diminta peminta peminta" "alur alur alur";column-gap:8px;row-gap:3px;padding:10px 12px;border-bottom:1px solid var(--pbt-line)}
.pbt .pbt-tbl tbody:last-child tr:last-child{border-bottom:0}
.pbt .pbt-tbl tr.pbt-grp{display:block;padding:7px 12px;background:var(--pbt-grp)}
.pbt .pbt-tbl td{display:block;border:0;padding:0;background:transparent;min-width:0}
.pbt .pbt-tbl tr.pbt-grp td{padding:0}
.pbt .pbt-tbl td.c-barang{grid-area:barang}
.pbt .pbt-tbl td.c-qty{grid-area:qty;text-align:right}
.pbt .pbt-tbl td.c-status{grid-area:status}
.pbt .pbt-tbl td.c-proyek{grid-area:proyek}
.pbt .pbt-tbl td.c-diminta{grid-area:diminta}
.pbt .pbt-tbl td.c-peminta{grid-area:peminta;text-align:right;color:var(--pbt-mute)!important;font-size:12px}
.pbt .pbt-tbl td.c-peminta::before{content:"oleh ";color:var(--pbt-mute)}
.pbt .pbt-tbl td.c-divisi{display:none}
.pbt .pbt-tbl td.c-alur{grid-area:alur;margin-top:4px}
.pbt .pbt-alur{min-width:0}
.pbt .pbt-wrap{min-width:0}
.pbt .pbt-jam{display:inline;margin-left:4px}
.pbt-pilih{height:40px}
.pbt .pbt-konfirmasi{min-height:40px}
`)}
`
