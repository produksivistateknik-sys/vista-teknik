// LAPORAN PROYEK LUAR -> WORD (.docx) (24 Okt 2026, keputusan user). Dibuat di browser (pustaka `docx`, dimuat hanya saat
// tombol "Unduh Word" ditekan - lewat import() di bawah, tidak memperbesar bundle utama). Tanpa kop & logo.
// Isi: judul "Laporan Proyek Luar" -> tabel informasi (proyek/lokasi, rentang tanggal kerja, status, pelapor/divisi) ->
// bagian PER TANGGAL KERJA (proyek_luar.tanggal; satu record = satu tanggal kerja): judul tanggal, "Catatan Pekerjaan"
// (teks Word asli, satu paragraf per baris catatan) per record/pelapor, lalu foto record-record tanggal itu dalam grid
// 2 kolom berketerangan "Foto N" (N mulai 1 lagi di tiap tanggal). Baris foto tidak terpotong antar halaman (cantSplit).
// Foto: urut waktu unggah, dikecilkan (sisi terpanjang 1280 px, JPEG 0,8) satu per satu; gagal dimuat -> tulisan
// "Foto N tidak dapat dimuat" (dokumen tetap jadi). Video tidak dimasukkan. Hanya membaca data (tanpa tulis DB).
// (25 Okt 2026, multi-hari) satu record = satu ENTRI hari (proyek_luar_entri); baris "Lokasi" dari proyek_luar.lokasi.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { poinCatatanPL } from './proyekLuarPantau'

export type FotoPL = { url: string; uploaded_at?: string; mime?: string; name?: string }
// Satu RecordPL = satu ENTRI hari (multi-hari, 25 Okt 2026): nama/lokasi/status dari proyeknya, sisanya dari entri.
export type RecordPL = { id: number; proyek_id?: number; nama_lokasi: string; lokasi?: string | null; tanggal: string; catatan: string | null; status: string; operator_nama: string; divisi: string; foto: FotoPL[] }

const SISI_MAKS = 1280
const LEBAR_FOTO_PX = 300 // lebar gambar di sel tabel (2 kolom A4 berbatas 2 cm)
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const tglPanjang = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return Number.isNaN(d.getTime()) ? iso : `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const tglPendek = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return Number.isNaN(d.getTime()) ? iso : `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export const isVideo = (f: FotoPL) => String(f?.mime || '').startsWith('video/') || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(String(f?.url || ''))
export const urutFoto = (fs: FotoPL[]) => [...(fs || [])].filter((f) => f?.url && !isVideo(f)).sort((a, b) => String(a.uploaded_at || '').localeCompare(String(b.uploaded_at || '')))

// Nama mirip utk pilihan awal record yang digabung (admin tetap bisa mencentang/melepas): huruf kecil, hanya huruf+angka.
export const kunciNama = (s: string) => String(s || '').toLowerCase().replace(/tenis/g, 'tennis').replace(/[^a-z0-9]/g, '')
// "mengandung" hanya bila nama terpendek >= 6 huruf ("tas" tidak ikut mencocokkan "Test Proyek TAS")
export const namaMirip = (a: string, b: string) => { const x = kunciNama(a), y = kunciNama(b); return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x)))) }

// Unduh + kecilkan satu foto -> {data, w, h} JPEG. cache no-store: cache <img> lama tanpa header CORS bisa membuat fetch gagal.
async function siapkanFoto(url: string): Promise<{ data: ArrayBuffer; w: number; h: number }> {
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const bmp = await createImageBitmap(blob)
  try {
    const s = Math.min(1, SISI_MAKS / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s))
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d'); if (!ctx) throw new Error('canvas tidak tersedia')
    ctx.drawImage(bmp, 0, 0, w, h)
    const jpg: Blob = await new Promise((ok, gagal) => cv.toBlob((b) => (b ? ok(b) : gagal(new Error('gagal mengubah ke JPEG'))), 'image/jpeg', 0.8))
    cv.width = cv.height = 0
    return { data: await jpg.arrayBuffer(), w, h }
  } finally { bmp.close?.() }
}

export async function buatDocxProyekLuar(o: {
  judulProyek: string
  records: RecordPL[]
  fotoDipilih: Set<string> // url foto yang ikut
  onProgres?: (selesai: number, total: number) => void
}): Promise<Blob> {
  const D = await import('docx')
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, AlignmentType, HeadingLevel, BorderStyle } = D
  const recs = [...o.records].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id - b.id)
  const tglList = [...new Set(recs.map((r) => r.tanggal))]
  const pelapor = [...new Set(recs.map((r) => `${r.operator_nama} (${labelDivisiPL(r.divisi)})`))]
  const namaProyek = [...new Set(recs.map((r) => r.nama_lokasi.trim()))]
  const lokasi = [...new Set(recs.map((r) => String(r.lokasi || r.nama_lokasi).trim()))]
  const status = recs.some((r) => r.status === 'berlangsung') ? 'Berlangsung' : 'Selesai'
  const rentang = tglList.length ? (tglList.length === 1 ? tglPendek(tglList[0]) : `${tglPendek(tglList[0])} – ${tglPendek(tglList[tglList.length - 1])}`) : '-'
  const totalFoto = recs.reduce((n, r) => n + urutFoto(r.foto).filter((f) => o.fotoDipilih.has(f.url)).length, 0)
  let selesai = 0

  const tanpaGaris = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const garisTipis = { style: BorderStyle.SINGLE, size: 4, color: 'BFC5CE' }
  const sel = (teks: string, tebal = false, lebar = 30) => new TableCell({
    width: { size: lebar, type: WidthType.PERCENTAGE }, borders: { top: garisTipis, bottom: garisTipis, left: garisTipis, right: garisTipis },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: teks.split('\n').map((t) => new Paragraph({ children: [new TextRun({ text: t, bold: tebal })] })),
  })
  const infoBaris = (k: string, v: string) => new TableRow({ cantSplit: true, children: [sel(k, true, 30), sel(v, false, 70)] })
  const isi: any[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'Laporan Proyek Luar' })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoBaris('Proyek', o.judulProyek.trim() || namaProyek[0] || '-'),
        infoBaris('Lokasi', lokasi.join('\n')),
        ...(namaProyek.length > 1 ? [infoBaris('Nama di laporan', namaProyek.join('\n'))] : []),
        infoBaris('Tanggal kerja', `${rentang} (${tglList.length} hari)`),
        infoBaris('Status', status),
        infoBaris('Pelapor / divisi', pelapor.join('\n')),
      ],
    }),
  ]

  for (const tgl of tglList) {
    const recTgl = recs.filter((r) => r.tanggal === tgl)
    isi.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, keepNext: true, children: [new TextRun({ text: tglPanjang(tgl) })] }))
    for (const r of recTgl) {
      isi.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: recTgl.length > 1 ? `Catatan Pekerjaan – ${r.operator_nama} (${labelDivisiPL(r.divisi)})` : 'Catatan Pekerjaan' })] }))
      if (recTgl.length === 1) isi.push(new Paragraph({ keepNext: true, children: [new TextRun({ text: `Pelapor: ${r.operator_nama} (${labelDivisiPL(r.divisi)})`, italics: true, color: '64748B', size: 18 })] }))
      const baris = poinCatatanPL(r.catatan)  // nomor yang diketik operator dibuang (lib/proyekLuarPantau)
      if (!baris.length) isi.push(new Paragraph({ children: [new TextRun({ text: '(tidak ada catatan)', italics: true, color: '94A3B8' })] }))
      else baris.forEach((b) => isi.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: b })] })))
    }
    // foto tanggal ini (semua record tanggal itu), urut waktu unggah, nomor mulai 1
    const fotos = recTgl.flatMap((r) => urutFoto(r.foto)).filter((f) => o.fotoDipilih.has(f.url))
      .sort((a, b) => String(a.uploaded_at || '').localeCompare(String(b.uploaded_at || '')))
    if (!fotos.length) continue
    isi.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: 'Foto Dokumentasi' })] }))
    // unduh + kecilkan PARALEL terbatas (3 sekaligus - cepat tapi memori tetap rendah), urutan hasil tetap
    const siap: ({ data: ArrayBuffer; w: number; h: number } | Error)[] = new Array(fotos.length)
    let berikut = 0
    await Promise.all(Array.from({ length: Math.min(3, fotos.length) }, async () => {
      while (berikut < fotos.length) {
        const i = berikut++
        try { siap[i] = await siapkanFoto(fotos[i].url) } catch (e: any) { siap[i] = e instanceof Error ? e : new Error(String(e)) }
        selesai++; o.onProgres?.(selesai, totalFoto)
      }
    }))
    const selFoto: any[] = []
    for (let i = 0; i < fotos.length; i++) {
      let anak: any[]
      try {
        const g = siap[i]; if (g instanceof Error) throw g
        const tinggi = Math.round((LEBAR_FOTO_PX * g.h) / g.w)
        anak = [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: g.data, transformation: { width: LEBAR_FOTO_PX, height: tinggi } })] })]
      } catch (e) {
        console.error(`[Word Proyek Luar] foto ${i + 1} (${tgl}) gagal dimuat:`, e)
        anak = [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Foto ${i + 1} tidak dapat dimuat`, italics: true, color: 'B91C1C' })] })]
      }
      anak.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: `Foto ${i + 1}`, size: 18, color: '475569' })] }))
      selFoto.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: { top: tanpaGaris, bottom: tanpaGaris, left: tanpaGaris, right: tanpaGaris }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: anak }))
      // (progres dihitung saat foto selesai disiapkan di atas)
    }
    if (selFoto.length % 2) selFoto.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: { top: tanpaGaris, bottom: tanpaGaris, left: tanpaGaris, right: tanpaGaris }, children: [new Paragraph('')] }))
    const rows: any[] = []
    for (let i = 0; i < selFoto.length; i += 2) rows.push(new TableRow({ cantSplit: true, children: [selFoto[i], selFoto[i + 1]] }))
    isi.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  }

  const doc = new Document({
    creator: 'Vista Teknik ERP', title: `Laporan Proyek Luar - ${o.judulProyek}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: isi }],
  })
  return Packer.toBlob(doc)
}

const LABEL_DIV: Record<string, string> = { qc: 'QC', assembling: 'Assembling', wiring_ctrl: 'Wiring Control', wiring_pwr: 'Wiring Power', mekanik: 'Mekanik', painting: 'Painting' }
export const labelDivisiPL = (d: string) => LABEL_DIV[d] || d || '-'
export const namaBerkasPL = (judul: string, records: RecordPL[]) => {
  const t = [...records.map((r) => r.tanggal)].sort()
  const aman = (judul || 'Proyek Luar').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `Laporan Proyek Luar - ${aman}${t.length ? ` (${t[0]}${t.length > 1 && t[t.length - 1] !== t[0] ? ` sd ${t[t.length - 1]}` : ''})` : ''}.docx`
}
