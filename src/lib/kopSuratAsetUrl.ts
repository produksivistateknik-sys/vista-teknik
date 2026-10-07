// URL aset kop surat utk dokumen cetak HTML (7 Okt 2026). Diproses Vite -> file ber-hash di /assets/
// (cache browser jangka panjang, tidak tertanam di bundle maupun di tiap jendela cetak). URL dibuat
// ABSOLUT karena dokumen cetak ditulis ke jendela baru (about:blank).
import logo from '../assets/kop/vista-logo-clean.png?url'
import fontRegular from '../assets/kop/Carlito-Regular.ttf?url'
import fontBold from '../assets/kop/Carlito-Bold.ttf?url'
import type { AsetKopHtml } from './kopSuratKonfig'

export const asetKopHtml=():AsetKopHtml=>({
  logo:new URL(logo,window.location.href).href,
  fontRegular:new URL(fontRegular,window.location.href).href,
  fontBold:new URL(fontBold,window.location.href).href,
})
