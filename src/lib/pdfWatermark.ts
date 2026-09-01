import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

// Watermark PDF (31 Agu 2026, WO Digital) - tempel tanda "VISTA TEKNIK" transparan di TENGAH
// tiap halaman, proses full di browser (client-side, gak ada backend) pakai pdf-lib.
//
// FIX (1 Sep 2026): sebelumnya pakai GAMBAR logo penuh (logoAsset.ts) - ternyata logo itu
// sendiri PUNYA elemen diagonal (checkmark besar miring + teks yang agak italic), jadi
// watermark selalu kelihatan miring gak peduli rotate di-set 0 atau enggak (itu soal isi
// gambarnya, bukan rotasinya). Ganti jadi TEKS murni "VISTA TEKNIK" yang digambar langsung
// (drawText) - horizontal sempurna (rotate 0 beneran ngaruh sekarang), ukuran gampang diatur
// via font size, warna oranye Vista biar tetap kerasa brand-nya. Lebar target dinaikkan dari
// ~60% (logo lama) ke ~75% lebar halaman (~25% lebih besar) sesuai permintaan.
export async function watermarkPdf(fileBytes: ArrayBuffer): Promise<{ blob: Blob; pageCount: number }> {
  const pdfDoc = await PDFDocument.load(fileBytes)
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const text = 'VISTA TEKNIK'
  const orange = rgb(244 / 255, 121 / 255, 32 / 255) // #f47920, sama warna aksen Vista di app

  const pages = pdfDoc.getPages()
  pages.forEach((page) => {
    const { width, height } = page.getSize()
    const targetWidth = width * 0.75
    const refWidthAt100 = font.widthOfTextAtSize(text, 100)
    const fontSize = (targetWidth / refWidthAt100) * 100
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = font.heightAtSize(fontSize)
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: (height - textHeight) / 2,
      size: fontSize,
      font,
      color: orange,
      opacity: 0.15,
      rotate: degrees(0),
    })
  })

  const outBytes = await pdfDoc.save()
  return { blob: new Blob([outBytes as BlobPart], { type: 'application/pdf' }), pageCount: pages.length }
}
