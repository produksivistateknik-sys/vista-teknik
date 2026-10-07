// KOP SURAT RESMI PT. VISTA INTI TEKNIK - KONFIGURASI + VERSI HTML (7 Okt 2026).
// SATU tempat teks & warna kop untuk SEMUA dokumen cetak. File ini MURNI (tanpa jsPDF/React/Vite) supaya
// bisa disalin identik ke vista-pekerja (dan Edge Function) - kalau diubah, ubah juga salinannya.
// - Versi jsPDF (PDF Arsip dll): lib/kopSurat.ts, memakai konfigurasi dari sini.
// - Versi HTML (dokumen yang dicetak lewat jendela browser, mis. Rekap Permintaan Barang): fungsi di bawah.
// Ukuran dikonversi dari desain yang disetujui (lebar kop = lebar kertas A4 210 mm, "cqw" = 2,1 mm).

export const KOP_SURAT={
  namaPt:"PT. VISTA INTI TEKNIK",
  alamat:["Jln. Muncul, Komplek Pergudangan Ritz Gate blok BF-15,","Gedangan – Sidoarjo"],
  telepon:"031 – 85589496",
  website:"www.vistateknik.co.id",
  email:"vista.intiteknik@gmail.com",
  bidangUsaha:[
    ["ELECTRICAL SWITCHBOARD","MANUFACTURING"],
    ["ELECTRICAL POWER","SYSTEM DESIGN"],
    ["MECHANICAL, ELECTRICAL","& INSTRUMENTATION SUPPLIER"],
    ["AUTOMATION SYSTEM","CONTROL ENGINEERING"],
  ],
  warna:{latar:"#050505",emas:"#f3d887",teks:"#ddd09f",oranye:"#f37321",oranye2:"#f39a2e",poin:"#ee8a3c",titik:"#c9c3b0"},
};
// Baris alamat ke-2 & baris web/email persis susunan kop asli.
export const barisAlamatKop=()=>[KOP_SURAT.alamat[0],`${KOP_SURAT.alamat[1]}, Telp. : ${KOP_SURAT.telepon}`];
export const barisWebKop=()=>`${KOP_SURAT.website},  Email : ${KOP_SURAT.email}`;
export const RASIO_KOP_PENUH=389/1653;

// ===================== VERSI HTML (cetak lewat jendela browser) =====================
// Aset dikirim pemanggil sebagai URL ABSOLUT (logo PNG transparan 660x310 + font Carlito subset).
export type AsetKopHtml={logo:string;fontRegular:string;fontBold:string};

const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const LEBAR_MM=210;
const TINGGI_PENUH_MM=+(LEBAR_MM*RASIO_KOP_PENUH).toFixed(2); // 49,42 mm
export const TINGGI_KOP_RINGKAS_HTML_MM=20;

export function cssKopHtml(aset:AsetKopHtml):string{
  const w=KOP_SURAT.warna;
  return `
  @font-face{font-family:'KopCarlito';src:url('${aset.fontRegular}') format('truetype');font-weight:400;}
  @font-face{font-family:'KopCarlito';src:url('${aset.fontBold}') format('truetype');font-weight:700;}
  .kopv-penuh,.kopv-penuh *,.kopv-ringkas,.kopv-ringkas *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;}
  .kopv-penuh{position:relative;width:${LEBAR_MM}mm;height:${TINGGI_PENUH_MM}mm;background:${w.latar};overflow:hidden;font-family:'KopCarlito','Carlito',Calibri,Arial,sans-serif;}
  .kopv-dots{position:absolute;left:0;top:0;width:34%;height:100%;opacity:.22;background:radial-gradient(circle,${w.titik} .2mm,transparent .36mm) 0 0/4.41mm 4.41mm;-webkit-mask-image:linear-gradient(to right,#000 40%,transparent);mask-image:linear-gradient(to right,#000 40%,transparent);}
  .kopv-bul{position:absolute;left:1.9%;top:26%;width:22%;color:${w.poin};font-weight:700;font-size:2.415mm;line-height:1.55;letter-spacing:.01em;}
  .kopv-bul div{position:relative;padding-left:3.57mm;}
  .kopv-bul div::before{content:"";position:absolute;left:0;top:.34em;width:2mm;height:2mm;border-radius:50%;background:${w.poin};}
  .kopv-ctr{position:absolute;left:22%;width:56%;top:19%;text-align:center;}
  .kopv-nm{color:${w.emas};font-size:9.87mm;font-weight:400;letter-spacing:.012em;line-height:1.1;}
  .kopv-ad{color:${w.teks};font-size:4.83mm;line-height:1.34;margin-top:4.62mm;white-space:nowrap;}
  .kopv-wb{color:${w.teks};font-size:4.41mm;margin-top:3.15mm;white-space:nowrap;}
  .kopv-lg{position:absolute;left:76.8%;top:32%;width:20.5%;}
  .kopv-lg img{display:block;width:100%;height:auto;}
  .kopv-bar{position:absolute;left:0;right:0;bottom:0;height:2.4%;background:${w.oranye};}
  .kopv-tab{position:absolute;right:.6%;bottom:0;width:19.2%;height:9.8%;background:${w.oranye2};border-radius:2.94mm 2.94mm 0 0;}
  .kopv-ringkas{position:relative;display:flex;align-items:center;justify-content:space-between;width:${LEBAR_MM}mm;height:${TINGGI_KOP_RINGKAS_HTML_MM}mm;background:${w.latar};padding:0 7.35mm;font-family:'KopCarlito','Carlito',Calibri,Arial,sans-serif;}
  .kopv-ringkas::after{content:"";position:absolute;left:0;right:0;bottom:0;height:.9mm;background:${w.oranye};}
  .kopv-rt{color:${w.emas};font-size:5.46mm;letter-spacing:.01em;line-height:1.15;}
  .kopv-rs{color:${w.teks};font-size:3.57mm;margin-top:.2em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150mm;}
  .kopv-ringkas img{display:block;width:31.5mm;height:auto;flex-shrink:0;}`;
}

export function htmlKopPenuh(aset:AsetKopHtml):string{
  return `<div class="kopv-penuh"><div class="kopv-dots"></div>
  <div class="kopv-bul">${KOP_SURAT.bidangUsaha.map(b=>`<div>${b.map(esc).join("<br>")}</div>`).join("")}</div>
  <div class="kopv-ctr"><div class="kopv-nm">${esc(KOP_SURAT.namaPt)}</div>
  <div class="kopv-ad">${barisAlamatKop().map(esc).join("<br>")}</div>
  <div class="kopv-wb">${esc(barisWebKop()).replace(",  ",",&nbsp; ")}</div></div>
  <div class="kopv-lg"><img alt="Vista Teknik" src="${aset.logo}"></div>
  <div class="kopv-bar"></div><div class="kopv-tab"></div></div>`;
}

export function htmlKopRingkas(aset:AsetKopHtml,sub:string):string{
  return `<div class="kopv-ringkas"><div style="min-width:0"><div class="kopv-rt">${esc(KOP_SURAT.namaPt)}</div><div class="kopv-rs">${esc(sub)}</div></div><img alt="Vista Teknik" src="${aset.logo}"></div>`;
}

// Halaman cetak berkop: kop PENUH menempel tepi atas & kiri-kanan halaman 1, kop RINGKAS di halaman
// lanjutan. Caranya: @page margin 0 + tabel pembungkus - <thead> (kop ringkas) & <tfoot> (ruang bawah)
// DIULANG browser di tiap halaman; kop penuh ditimpakan (absolute, z-index) di atas thead halaman 1, dan
// isi halaman 1 diberi jarak tambahan setinggi selisih kop penuh - kop ringkas. Isi tetap pakai margin biasa.
export function halamanCetakBerkop(o:{aset:AsetKopHtml;subKopRingkas:string;isiHtml:string;marginSampingMm?:number;marginBawahMm?:number;jarakMm?:number}):{css:string;body:string}{
  const samping=o.marginSampingMm??18,bawah=o.marginBawahMm??18,jarak=o.jarakMm??7;
  const css=`${cssKopHtml(o.aset)}
  @page{size:A4;margin:0;}
  html,body{margin:0;padding:0;}
  .kopv-wrap-penuh{position:absolute;left:0;top:0;z-index:5;}
  table.kopv-hal{width:${LEBAR_MM}mm;border-collapse:collapse;border-spacing:0;}
  table.kopv-hal>thead>tr>td,table.kopv-hal>tfoot>tr>td,table.kopv-hal>tbody>tr>td{padding:0;border:0;background:none;}
  table.kopv-hal>thead{display:table-header-group;}
  table.kopv-hal>tfoot{display:table-footer-group;}
  .kopv-isi{padding:0 ${samping}mm;}`;
  const body=`<div class="kopv-wrap-penuh">${htmlKopPenuh(o.aset)}</div>
  <table class="kopv-hal">
    <thead><tr><td>${htmlKopRingkas(o.aset,o.subKopRingkas)}<div style="height:${jarak}mm"></div></td></tr></thead>
    <tfoot><tr><td><div style="height:${bawah}mm"></div></td></tr></tfoot>
    <tbody><tr><td><div class="kopv-isi"><div style="height:${(TINGGI_PENUH_MM-TINGGI_KOP_RINGKAS_HTML_MM).toFixed(2)}mm"></div>${o.isiHtml}</div></td></tr></tbody>
  </table>`;
  return{css,body};
}
