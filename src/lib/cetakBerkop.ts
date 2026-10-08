// CETAK BAGIAN HALAMAN DENGAN KOP SURAT RESMI (8 Okt 2026) - dipakai tombol "Print Laporan" Quality
// Center (Laporan QC/Nameplate/Pasang Komponen/Wiring/Warehouse-QS). Dulu window.print() mencetak
// SELURUH halaman aplikasi (sidebar & top bar ikut tercetak, tanpa kop). Sekarang: elemen laporan
// DISALIN (tanpa .no-print) ke jendela cetak baru yang berkop (halamanCetakBerkop - kop penuh hal. 1,
// kop ringkas hal. lanjutan; pola sama dgn Print Rekap Permintaan). Gaya aplikasi (<style>/<link>)
// ikut disalin supaya tampilan laporan sama dgn di layar.
import { halamanCetakBerkop } from './kopSuratKonfig'
import { asetKopHtml } from './kopSuratAsetUrl'

const BATAS_TUNGGU_GAMBAR_MS=10000

// Buka jendela cetak berisi HTML lengkap, lalu print() SETELAH font & semua gambar selesai dimuat
// (atau batas waktu habis - foto R2 yang lambat tidak boleh membuat cetak macet selamanya).
export function bukaJendelaCetak(html:string){
  const win=window.open('','_blank','width=900,height=1100')
  if(!win){alert('Popup diblokir browser - izinkan popup buat halaman ini supaya bisa print.');return}
  win.document.open()
  win.document.write(html)
  win.document.close()
  let sudahCetak=false
  const cetak=async()=>{
    if(sudahCetak)return
    sudahCetak=true
    try{await (win.document as any).fonts?.ready}catch{/* abaikan - tetap cetak */}
    const belum=[...win.document.images].filter(i=>!i.complete)
    if(belum.length){
      await Promise.race([
        Promise.all(belum.map(i=>new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true})}))),
        new Promise(r=>setTimeout(r,BATAS_TUNGGU_GAMBAR_MS)),
      ])
    }
    win.focus();win.print()
  }
  if(win.document.readyState==='complete')cetak();else win.onload=cetak
}

// Salin `el` (tanpa elemen .no-print) ke jendela cetak berkop.
export function cetakElemenBerkop(el:HTMLElement|null,o:{judulJendela:string;subKopRingkas:string}){
  if(!el){alert('Bagian laporan tidak ditemukan - muat ulang halaman lalu coba lagi.');return}
  const klon=el.cloneNode(true) as HTMLElement
  klon.querySelectorAll('.no-print').forEach(n=>n.remove())
  // Gambar lazy di jendela cetak bisa tidak pernah dimuat (di luar layar) -> paksa langsung dimuat.
  klon.querySelectorAll('img').forEach(i=>{i.setAttribute('loading','eager');i.removeAttribute('decoding')})
  // Video: tampilkan frame awal (preload metadata) - di kertas cukup sebagai gambar diam.
  klon.querySelectorAll('video').forEach(v=>{v.setAttribute('preload','metadata');v.removeAttribute('autoplay')})
  const gayaApp=[...document.querySelectorAll('style,link[rel="stylesheet"]')].map(n=>
    n.tagName==='LINK'?`<link rel="stylesheet" href="${(n as HTMLLinkElement).href}">`:`<style>${n.textContent||''}</style>`).join('\n')
  const kop=halamanCetakBerkop({aset:asetKopHtml(),subKopRingkas:o.subKopRingkas,isiHtml:klon.outerHTML})
  const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const html=`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(o.judulJendela)}</title>
${gayaApp}
<style>
  ${kop.css}
  /* CSS global aplikasi memasang html,body{height:100%;overflow-x:hidden} - overflow-x:hidden membuat body
     jadi area gulir sehingga cetakan terpotong 1 halaman. Dikembalikan normal khusus jendela cetak. */
  html,body{background:#fff!important;height:auto!important;overflow:visible!important;}
  /* jangan potong kartu/foto di tengah antar halaman bila memungkinkan */
  .kopv-isi img,.kopv-isi video{max-width:100%;break-inside:avoid;}
  .kopv-isi *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .kopv-isi .fi{animation:none!important;opacity:1!important;transform:none!important;}
</style>
</head>
<body>
${kop.body}
</body>
</html>`
  bukaJendelaCetak(html)
}
