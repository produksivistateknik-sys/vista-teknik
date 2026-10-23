// LAPORAN OUTSTANDING - DOKUMEN BERKOP (Tahap B, 23 Okt 2026). SATU pembentuk halaman berkop lengkap utk pratinjau
// (tab "Tampilan berkop", iframe) dan jendela cetak ("Cetak / Simpan PDF" - pola sama dgn Rekap Permintaan Barang:
// kop PENUH hal. 1, kop RINGKAS hal. lanjutan, lib/kopSuratKonfig halamanCetakBerkop). Isi dari htmlDokumenLaporan(draf)
// - draf yang sama dgn teks WhatsApp, jadi tidak ada jalur data kedua.
import { halamanCetakBerkop } from './kopSuratKonfig'
import { asetKopHtml } from './kopSuratAsetUrl'
import { bukaJendelaCetak } from './cetakBerkop'
import { CSS_DOKUMEN_LAPORAN, htmlDokumenLaporan, jamSekarangWib, tglPanjangLaporan, type DrafLaporan } from './laporanOutstanding'

const escT = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const judulBerkasLaporan = (d: DrafLaporan) => `Outstanding Pekerjaan ${d.tanggal.split('-').reverse().join('-')}`

export function htmlHalamanBerkop(d: DrafLaporan, o: { pratinjau?: boolean } = {}): string {
  const kop = halamanCetakBerkop({ aset: asetKopHtml(), subKopRingkas: `Outstanding Pekerjaan · ${tglPanjangLaporan(d.tanggal)}`, isiHtml: htmlDokumenLaporan(d, { dibuatJam: jamSekarangWib() }) })
  // pratinjau di layar: latar abu-abu + kertas berbayang selebar A4 (di kertas/PDF tidak berlaku - @media screen)
  const layar = o.pratinjau ? '@media screen{html{background:#e6e8ec}body{width:210mm;margin:0 auto;background:#fff;box-shadow:0 6px 24px rgba(11,26,61,.18);position:relative}}' : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escT(judulBerkasLaporan(d))}</title>
<style>${kop.css}
html,body{background:#fff;height:auto;overflow:visible}
${CSS_DOKUMEN_LAPORAN}
${layar}</style></head><body>${kop.body}</body></html>`
}
export const cetakLaporanBerkop = (d: DrafLaporan) => bukaJendelaCetak(htmlHalamanBerkop(d))
