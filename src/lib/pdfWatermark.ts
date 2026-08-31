import { PDFDocument, degrees } from 'pdf-lib'
import { VISTA_LOGO_DATA_URI } from './logoAsset'

// Watermark PDF (31 Agu 2026, WO Digital) - tempel logo Vista transparan di TENGAH tiap
// halaman, proses full di browser (client-side, gak ada backend) pakai pdf-lib. Logo di-embed
// dari data URI yang sudah ada (logoAsset.ts, satu sumber sama landing page/sidebar), diagonal
// + opacity rendah biar gak nutupin isi drawing tapi tetap jelas sebagai tanda dokumen digital.
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
    const { width, height } = page.getSize()
    const wmWidth = width * 0.6
    const wmHeight = wmWidth * logoRatio
    page.drawImage(logoImage, {
      x: (width - wmWidth) / 2,
      y: (height - wmHeight) / 2,
      width: wmWidth,
      height: wmHeight,
      opacity: 0.15,
      rotate: degrees(0),
    })
  })

  const outBytes = await pdfDoc.save()
  return { blob: new Blob([outBytes as BlobPart], { type: 'application/pdf' }), pageCount: pages.length }
}
