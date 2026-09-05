import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib'
import { VISTA_LOGO_DATA_URI } from './logoAsset'

// Rotasi vektor 2D - dipakai BARENGAN oleh watermarkPdf() dan stampTidakBerlaku() buat
// kompensasi /Rotate halaman (lihat catatan riwayat di atas). Konvensi arah SUDAH divalidasi
// (contentRotationDeg = pageRotation, BUKAN 360-pageRotation) - jangan diubah tanpa tes ulang.
const rotateVec = (x: number, y: number, rad: number) => ({
  x: x * Math.cos(rad) - y * Math.sin(rad),
  y: x * Math.sin(rad) + y * Math.cos(rad),
})

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

export async function watermarkPdf(fileBytes: ArrayBuffer, revisionNote?: string): Promise<{ blob: Blob; pageCount: number }> {
  const pdfDoc = await PDFDocument.load(fileBytes)
  const logoBytes = dataUriToBytes(VISTA_LOGO_DATA_URI)
  const logoImage = await pdfDoc.embedPng(logoBytes)
  const logoRatio = logoImage.height / logoImage.width

  const pages = pdfDoc.getPages()
  pages.forEach((page) => {
    const { width, height } = page.getSize() // dimensi MENTAH (sebelum /Rotate halaman)
    const pageRotation = ((page.getRotation().angle % 360) + 360) % 360 // normalisasi ke 0-359
    const displayWidth = (pageRotation === 90 || pageRotation === 270) ? height : width
    const displayHeight = (pageRotation === 90 || pageRotation === 270) ? width : height

    const wmWidth = displayWidth * 0.6
    const wmHeight = wmWidth * logoRatio
    const shiftUp = displayHeight * 0.08 // "sedikit lebih ke atas" - ~8% tinggi halaman tampil

    // Rotasi konten yang MENIADAKAN rotasi halaman (net 0 = tegak normal pas ditampilkan) -
    // content-rotation yang bener = pageRotation itu sendiri (BUKAN 360-pageRotation, sempat
    // salah arah waktu nge-fix versi teks, sudah diuji ulang - lihat pdfWatermark.ts riwayat).
    const contentRotationDeg = pageRotation
    const rad = (contentRotationDeg * Math.PI) / 180
    // Offset dari titik anchor (x,y, sudut kiri-bawah gambar sebelum rotasi) ke titik TENGAH
    // gambar, diputar ikut arah rotasi konten - biar titik tengah watermark mendarat pas di
    // titik tengah halaman (yang invarian kena rotasi apapun), lalu digeser naik.
    const center = rotateVec(wmWidth / 2, wmHeight / 2, rad)
    const upShift = rotateVec(0, shiftUp, rad)

    page.drawImage(logoImage, {
      x: width / 2 - center.x + upShift.x,
      y: height / 2 - center.y + upShift.y,
      width: wmWidth,
      height: wmHeight,
      opacity: 0.15,
      rotate: degrees(contentRotationDeg),
    })
  })

  // Watermark keterangan revisi (6 Sep 2026) - HALAMAN PERTAMA SAJA, pojok kanan-atas, merah
  // tebal. Posisi dihitung dari titik TENGAH halaman (sama teknik kompensasi rotasi dengan
  // logo di atas: offset dari center, diputar ikut rotasi konten) - bukan formula sudut baru
  // yang belum tervalidasi terhadap /Rotate halaman gambar CAD.
  if (revisionNote && revisionNote.trim() && pages.length > 0) {
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const page = pages[0]
    const { width, height } = page.getSize()
    const pageRotation = ((page.getRotation().angle % 360) + 360) % 360
    const displayWidth = (pageRotation === 90 || pageRotation === 270) ? height : width
    const displayHeight = (pageRotation === 90 || pageRotation === 270) ? width : height
    const contentRotationDeg = pageRotation
    const rad = (contentRotationDeg * Math.PI) / 180

    const text = revisionNote.trim()
    const fontSize = Math.max(11, Math.min(16, displayWidth * 0.015))
    const textWidth = boldFont.widthOfTextAtSize(text, fontSize)
    const textHeight = boldFont.heightAtSize(fontSize)
    const marginRight = displayWidth * 0.04
    const marginTop = displayHeight * 0.035

    // Offset titik TENGAH teks dari titik tengah halaman, ke arah pojok kanan-atas tampilan.
    const offsetX = displayWidth / 2 - marginRight - textWidth / 2
    const offsetY = displayHeight / 2 - marginTop - textHeight / 2
    const halfText = rotateVec(textWidth / 2, textHeight / 2, rad)
    const centerOffset = rotateVec(offsetX, offsetY, rad)

    page.drawText(text, {
      x: width / 2 - halfText.x + centerOffset.x,
      y: height / 2 - halfText.y + centerOffset.y,
      size: fontSize,
      font: boldFont,
      color: rgb(0.75, 0, 0),
      rotate: degrees(contentRotationDeg),
    })
  }

  const outBytes = await pdfDoc.save()
  return { blob: new Blob([outBytes as BlobPart], { type: 'application/pdf' }), pageCount: pages.length }
}

// Stempel "TIDAK BERLAKU" (6 Sep 2026) - ditempel ke file revisi LAMA begitu revisi baru
// berhasil diupload (lihat useWoDigitalDocs.ts, uploadDoc()). Kotak border merah + teks miring
// -12 derajat (gaya stempel dokumen resmi, bukan diagonal 45 derajat penuh) di TENGAH SETIAP
// halaman, DI ATAS watermark logo yang sudah ada di file (file lama di-load apa adanya, logo
// lama TETAP ada, cuma ditambah layer stempel). Sama teknik kompensasi rotasi kayak
// watermarkPdf() - tilt -12 derajat digabung LANGSUNG ke contentRotationDeg, bukan rotasi
// terpisah, biar tetap satu operasi drawRectangle/drawText per halaman.
export async function stampTidakBerlaku(fileBytes: ArrayBuffer): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(fileBytes)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const TEXT = 'TIDAK BERLAKU'
  const TILT_DEG = -12
  const red = rgb(0.75, 0, 0)

  pdfDoc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    const pageRotation = ((page.getRotation().angle % 360) + 360) % 360
    const displayWidth = (pageRotation === 90 || pageRotation === 270) ? height : width
    const contentRotationDeg = pageRotation + TILT_DEG
    const rad = (contentRotationDeg * Math.PI) / 180

    const fontSize = Math.max(28, Math.min(64, displayWidth * 0.07))
    const textWidth = boldFont.widthOfTextAtSize(TEXT, fontSize)
    const textHeight = boldFont.heightAtSize(fontSize)
    const padX = fontSize * 0.6
    const padY = fontSize * 0.45
    const boxWidth = textWidth + padX * 2
    const boxHeight = textHeight + padY * 2

    // Semua elemen dipusatkan PERSIS di titik tengah halaman (invarian kena rotasi apapun) -
    // gak ada offset tambahan kayak watermark logo, biar stempel selalu di tengah walau ukuran
    // halaman beda-beda.
    const halfBox = rotateVec(boxWidth / 2, boxHeight / 2, rad)
    const halfText = rotateVec(textWidth / 2, textHeight / 2, rad)

    page.drawRectangle({
      x: width / 2 - halfBox.x,
      y: height / 2 - halfBox.y,
      width: boxWidth,
      height: boxHeight,
      borderColor: red,
      borderWidth: Math.max(3, fontSize * 0.09),
      opacity: 0.65,
      borderOpacity: 0.65,
      rotate: degrees(contentRotationDeg),
    })
    page.drawText(TEXT, {
      x: width / 2 - halfText.x,
      y: height / 2 - halfText.y,
      size: fontSize,
      font: boldFont,
      color: red,
      opacity: 0.65,
      rotate: degrees(contentRotationDeg),
    })
  })

  const outBytes = await pdfDoc.save()
  return new Blob([outBytes as BlobPart], { type: 'application/pdf' })
}
