// GAYA RANGKA MOBILE ADMIN (12 Nov 2026, T0). SEMUA selektor WAJIB diawali html[data-mobile="1"] (lib/modeMobile) ->
// saat mode mati tidak ada satu aturan pun yang berlaku, desktop tidak bergeser. Dicek otomatis: setiap aturan file ini
// harus lolos uraikanCssDatar + diawali ATRIBUT_MOBILE (lihat uji di laporan T0).
// !important hanya utk menimpa gaya inline lama (tombol topbar 26px, Modal bersama) - tetap di bawah atribut mobile.
import { ATRIBUT_MOBILE as M } from './responsif'

const B = `${M}[data-mobile-bingkai="1"]`

export const CSS_MOBILE = `
${B} body{background:#d9dee7}
${B} .erp-wrap{left:calc(50% - 215px);right:auto;width:430px;transform:translateZ(0);box-shadow:0 0 0 1px #c7cfdc,0 12px 40px rgba(15,23,42,.18)}
${M} .erp-sb{position:fixed;top:0;left:0;bottom:0;height:auto;width:264px;min-width:264px;z-index:10600;transform:translateX(-105%);transition:transform .2s ease;box-shadow:4px 0 24px rgba(0,0,0,.25)}
${M} .erp-sb.buka{transform:none}
${M} .erp-laci-latar{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10590}
${M} .erp-nav-item{min-height:44px;font-size:13px}
${M} .erp-nav-label{font-size:13px}
${M} .erp-topbar{height:52px;padding:0 8px;gap:6px}
${M} .erp-toggle{width:44px;height:44px;font-size:16px}
${M} .erp-search{max-width:none;min-width:0;height:36px;font-size:13px}
${M} .erp-topbar-right{gap:2px}
${M} .erp-topbar-right>button,${M} .erp-topbar-right .erp-bell{width:40px!important;height:40px!important}
${M} .erp-notif-pop{position:fixed!important;top:56px!important;left:8px!important;right:8px!important;width:auto!important;max-height:70vh;overflow:auto}
${M} .erp-body{padding:8px}
${M} .vt-tabbar{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-mask-image:linear-gradient(to right,#000 82%,transparent);mask-image:linear-gradient(to right,#000 82%,transparent)}
${M} .vt-tabbar::-webkit-scrollbar{display:none}
${M} .vt-tabbar>*{flex:none;white-space:nowrap;min-height:44px;display:flex;align-items:center}
${M} .vt-modal{display:flex;flex-direction:column;justify-content:flex-end}
${M} .vt-modal-panel{width:100%!important;margin:auto 0 0!important;border-radius:16px 16px 0 0!important;max-height:92%;overflow:auto}
${M} .vt-modal-tutup{min-width:44px;min-height:44px}
${M} .vt-banner-desktop{display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:8px 10px;border-radius:10px;background:var(--bg-secondary,#eef2f8);color:var(--text-secondary,#475569);font-size:12.5px;border:1px solid var(--border-color,#dde3ec)}
${M} .vt-banner-desktop button{margin-left:auto;min-width:44px;min-height:44px;border:none;background:none;color:inherit;font-size:16px;cursor:pointer}
`
