// GAYA KARTU PANEL (8 Nov 2026) - satu sumber CSS kelas .kda-* utk subtab Kendala (KendalaAdmin) & Catatan (CatatanAdmin),
// dipindah apa adanya dari KendalaAdmin. Pemakai membungkus isinya dgn class "kda" lalu menyisipkan string ini di <style>.
// Jebakan mode gelap (globalCss): kelas ber-kata "card" dipaksa latar --card-bg & tombol tanpa "Btn" di kelasnya ditimpa ->
// kartu = "kda-kt", semua tombol ber-class "kdaBtn". Warna status: styles/tokenKartuStatus (sama dgn Aktivitas Panel).
import { TOKEN_KARTU_STATUS } from './tokenKartuStatus'
import { aturanHp } from './responsif'

export const CSS_KARTU_PANEL = TOKEN_KARTU_STATUS + `
.kda{--kd-card:var(--card-bg,#fff);--kd-fg:var(--text-primary,#1b1f2a);--kd-mute:var(--text-secondary,#5d6679);--kd-line:var(--border-color,#e6e8ed);
  --kd-head:var(--bg-secondary,#f6f7f9);--kd-grp:var(--bg-tertiary,#f1f3f6);
  --kd-ok:var(--ks-done);--kd-ok-bg:var(--ks-done-soft);--kd-warn:var(--ks-prog);--kd-warn-bg:var(--ks-prog-soft);--kd-bad:#c0392b;--kd-ink:#1b1f2a;--kd-ink-fg:#fff;--kd-focus:#d97706;
  color:var(--kd-fg);text-align:left;width:100%;font-size:14px;line-height:1.45;display:flex;flex-direction:column;gap:14px}
[data-theme="dark"] .kda{--kd-bad:#f07b6e;--kd-ink:#e2e8f0;--kd-ink-fg:#0f1117;--kd-focus:#f0a04b}
.kda *{box-sizing:border-box}
.kda-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.kda h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;color:var(--kd-fg)}
.kda .kda-btn{height:36px;padding:0 16px;border:0;border-radius:8px;background:var(--kd-ink);color:var(--kd-ink-fg);font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;flex:none}
.kda .kda-btn:disabled{opacity:.3;cursor:default}
.kda .kda-ghost{height:34px;padding:0 12px;border:0;background:none;color:var(--kd-mute);font-weight:500;font-size:14px;font-family:inherit;cursor:pointer}
.kda-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.kda-sum>div{background:var(--kd-head);border:1px solid var(--kd-line);border-radius:12px;padding:10px 14px;min-width:0}
.kda-sum b{display:block;font-size:22px;font-variant-numeric:tabular-nums;color:var(--kd-fg)}
.kda-sum b.w{color:var(--kd-warn)}.kda-sum b.o{color:var(--kd-ok)}
.kda-sum span{font-size:11px;color:var(--kd-mute);text-transform:uppercase;letter-spacing:.05em}
.kda-tb{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kda-seg{display:flex;flex-wrap:wrap;border:1px solid var(--kd-line);border-radius:8px;overflow:hidden;max-width:100%}
.kda .kda-seg button{height:34px;padding:0 14px;border:0;border-right:1px solid var(--kd-line);background:var(--kd-card);color:var(--kd-fg);font-weight:500;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap}
.kda .kda-seg button:last-child{border-right:0}
.kda .kda-seg button[aria-selected="true"]{background:var(--kd-ink);color:var(--kd-ink-fg)}
.kda-seg span{opacity:.6;margin-left:4px;font-weight:400}
.kda select,.kda textarea,.kda input{font:inherit;font-size:13px;color:var(--kd-fg);background:var(--kd-card);border:1px solid var(--kd-line);border-radius:8px}
.kda select{height:34px;padding:0 10px;max-width:100%;min-width:0}
.kda select:focus,.kda textarea:focus,.kda input:focus{outline:2px solid var(--kd-focus);outline-offset:-1px}
.kda-cnt{margin-left:auto;color:var(--kd-mute);font-size:13px;white-space:nowrap}
.kda-kol{columns:2;column-gap:16px}
${aturanHp(820, `.kda-kol{columns:1}.kda-cnt{margin-left:0}`)}
.kda-kt{break-inside:avoid;-webkit-column-break-inside:avoid;display:block;width:100%;margin:0 0 16px;border:1px solid var(--kd-line);border-radius:16px;padding:16px 16px 12px;min-width:0}
.kda-kt.n-progres{background:var(--ks-nb-progres);box-shadow:inset 0 5px 0 var(--kd-warn)}
.kda-kt.n-selesai{background:var(--ks-nb-selesai);box-shadow:inset 0 5px 0 var(--kd-ok)}
.kda-kh{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.kda-kn{min-width:0}
.kda-nm{font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;overflow-wrap:anywhere}
.kda-pj{font-size:13px;font-weight:700;color:var(--kd-mute);overflow-wrap:anywhere}
.kda-pj small{font-weight:500}
.kda-pill{display:inline-flex;align-items:center;min-height:22px;padding:2px 10px;border-radius:11px;font-size:12px;font-weight:700;white-space:nowrap;flex:none}
.kda-pill.w{background:var(--kd-warn-bg);color:var(--kd-warn)}
.kda-pill.o{background:var(--kd-ok-bg);color:var(--kd-ok)}
/* Penanda BARU / DIUBAH per admin (11 Nov 2026, lib/adminDilihat): lencana teks + garis tepi tegas, beda dgn latar hijau
   "semua selesai". Item baru hijau lembut; DIUBAH (catatan) oranye bergaris. */
.kda-kt.ada-baru{outline:2px solid var(--ks-done);outline-offset:-2px;cursor:pointer}
.kda-it.baru{background:var(--ks-done-soft);border-color:var(--ks-done)}
.kda-it.diubah{border-color:var(--ks-prog)}
.kda-lbl{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.06em;border-radius:5px;padding:1px 6px;margin-right:6px;vertical-align:1px;white-space:nowrap}
.kda-lbl.baru{background:var(--ks-done);color:var(--kd-card)}
.kda-lbl.diubah{background:var(--ks-prog-soft);color:var(--ks-prog);border:1px solid var(--ks-prog)}
.kda-pill.baru{background:var(--ks-done);color:var(--kd-card)}
.kda .kda-semua{height:30px;padding:0 10px;border:1px solid var(--ks-done);border-radius:8px;background:var(--ks-done-soft);color:var(--ks-done);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.kda-it{background:var(--kd-card);border:1px solid var(--kd-line);border-radius:10px;padding:10px 12px;margin-bottom:8px}
.kda-ih{display:flex;gap:10px;justify-content:space-between;align-items:flex-start}
.kda-tx{font-weight:700;overflow-wrap:anywhere;white-space:pre-wrap;min-width:0}
.kda-it.done .kda-tx{color:var(--kd-mute);font-weight:500}
.kda-mt{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;color:var(--kd-mute);font-size:12.5px;margin-top:5px;overflow-wrap:anywhere}
.kda-chip{font-size:11px;border:1px solid var(--kd-line);background:var(--kd-head);border-radius:6px;padding:1px 7px;color:var(--kd-mute);white-space:nowrap}
.kda-chip.ub{border-style:dashed}
.kda-sd{color:var(--kd-ok);font-size:12px;margin-top:4px;overflow-wrap:anywhere}
.kda-ac{display:flex;gap:6px 14px;margin-top:8px;font-size:13px;flex-wrap:wrap;align-items:center}
.kda .kda-ac button{border:0;background:none;padding:2px 0;font-weight:600;font-size:13px;font-family:inherit;color:var(--kd-mute);cursor:pointer}
.kda .kda-ac button:hover{color:var(--kd-fg)}
.kda .kda-ac button:disabled{opacity:.5;cursor:wait}
.kda .kda-ac button.ok{color:var(--kd-ok)}
.kda .kda-ac .bad,.kda-ac .bad{color:var(--kd-bad)}
.kda .kda-ac .kda-more{margin-left:auto;font-size:18px;line-height:1;padding:0 6px;border-radius:6px}
.kda .kda-ac .kda-more:hover{background:var(--kd-grp)}
.kda-hs{margin-top:6px;color:var(--kd-mute);font-size:12.5px;border-top:1px dashed var(--kd-line);padding-top:6px}
.kda-ed{display:flex;gap:8px;flex-wrap:wrap;width:100%}
.kda-ed input{flex:1 1 200px;min-width:0;height:34px;padding:0 10px}
.kda .kda-lagi{border:1px dashed var(--kd-line);background:var(--kd-card);color:var(--kd-mute);border-radius:8px;width:100%;height:32px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.kda-empty{padding:44px 16px;color:var(--kd-mute);text-align:center;border:1px dashed var(--kd-line);border-radius:12px}
.kda-err{color:var(--kd-bad);font-size:13px;padding:10px 14px;border:1px solid var(--kd-line);border-radius:10px;background:var(--kd-card)}
.kda-form{padding:14px 16px;background:var(--kd-head);border:1px solid var(--kd-line);border-radius:10px;display:flex;flex-direction:column;gap:10px}
.kda-form .two{display:flex;gap:8px;flex-wrap:wrap}.kda-form .two select{flex:1 1 200px}
.kda-form textarea{width:100%;min-height:66px;padding:10px;resize:vertical}
.kda-form .foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--kd-mute);font-size:13px}
.kda-form .foot b{color:var(--kd-fg);font-weight:500}
.kda-fa{display:flex;gap:8px}
`
