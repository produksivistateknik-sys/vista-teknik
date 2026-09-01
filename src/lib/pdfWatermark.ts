import { PDFDocument, degrees } from 'pdf-lib'
import { VISTA_LOGO_DATA_URI } from './logoAsset'

// Watermark PDF (31 Agu 2026, WO Digital) - tempel logo Vista Teknik transparan di TENGAH tiap
// halaman, proses full di browser (client-side, gak ada backend) pakai pdf-lib.
//
// RIWAYAT (1 Sep 2026): sempat diganti ke teks murni "VISTA TEKNIK" (drawText) karena
// watermark logo kelihatan "diagonal" - awalnya dikira gara-gara logo-nya sendiri PUNYA
// elemen checkmark yang emang diagonal by design. Ternyata itu cuma SEBAGIAN benar - akar
// masalah SEBENARNYA (baru ketemu belakangan): semua PDF construction drawing WO Digital
// punya properti HALAMAN /Rotate = -90 dari software CAD-nya (MediaBox mentah portrait
// 842x1191, ditampilkan landscape lewat rotasi ini). Watermark yang digambar tanpa
// kompensasi rotasi ikut ke-putar SAMA seperti halamannya - jadi logo yang aslinya cuma
// punya 1 elemen diagonal (checkmark-nya) keliatan TAMBAH miring (checkmark + ke-rotate
// halaman, numpuk).
//
// Balik pakai logo asli (checkmark-nya SENGAJA dipertahankan - itu identitas brand, bukan
// bug) TAPI sekarang dikompensasi rotasi halamannya - logo tetap tegak normal (gak ikut puter
// gara-gara /Rotate halaman), cuma checkmark-nya sendiri yang tetap diagonal (itu memang
// desain logo, wajar).
const dataUriToBytes = (dataUri: string): Uint8Array => {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function watermarkPdf(fileBytes: ArrayBuffer): Promise<{ blob: Blob; pageCount: number }> {
  const pdfDoc = await PDFDocument.load(fileBytes)
  const logoBytes = dataUriToBytes(VISTA_LOGO_DATA_URI)
  const logoImage = await pdfDoc.embedPng(logoBytes)
  const logoRatio = logoImage.height / logoImage.width

  const pages = pdfDoc.getPages()
  pages.forEach((page) => {
    const { width, height } = page.getSize() // dimensi MENTAH (sebelum /Rotate halaman)
    const pageRotation = ((page.getRotation().angle % 360) + 360) % 360 // normalisasi ke 0-359
    const displayWidth = (pageRotation === 90 || pageRotation === 270) ? height : width

    const wmWidth = displayWidth * 0.6
    const wmHeight = wmWidth * logoRatio

    // Rotasi konten yang MENIADAKAN rotasi halaman (net 0 = tegak normal pas ditampilkan) -
    // content-rotation yang bener = pageRotation itu sendiri (BUKAN 360-pageRotation, sempat
    // salah arah waktu nge-fix versi teks, sudah diuji ulang - lihat pdfWatermark.ts riwayat).
    const contentRotationDeg = pageRotation
    const rad = (contentRotationDeg * Math.PI) / 180
    // Offset dari titik anchor (x,y, sudut kiri-bawah gambar sebelum rotasi) ke titik TENGAH
    // gambar, diputar ikut arah rotasi konten - biar titik tengah watermark mendarat pas di
    // titik tengah halaman (yang invarian kena rotasi apapun).
    const halfW = wmWidth / 2
    const halfH = wmHeight / 2
    const offsetX = halfW * Math.cos(rad) - halfH * Math.sin(rad)
    const offsetY = halfW * Math.sin(rad) + halfH * Math.cos(rad)

    page.drawImage(logoImage, {
      x: width / 2 - offsetX,
      y: height / 2 - offsetY,
      width: wmWidth,
      height: wmHeight,
      opacity: 0.15,
      rotate: degrees(contentRotationDeg),
    })
  })

  const outBytes = await pdfDoc.save()
  return { blob: new Blob([outBytes as BlobPart], { type: 'application/pdf' }), pageCount: pages.length }
}
