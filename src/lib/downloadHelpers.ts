import JSZip from 'jszip'

// Foto-foto di Supabase Storage adalah public URL cross-origin, jadi <a href download>
// tidak reliable di semua browser - pakai fetch+blob supaya benar-benar ke-trigger sebagai
// download, bukan cuma buka tab baru.
export async function downloadFotoTunggal(url: string, filename: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

export type FotoZipItem = { url: string; path: string }

// path = lokasi file di dalam zip (boleh pakai "/" buat subfolder, mis. "Panel A/Nameplate/foto1.jpg").
// Foto yang gagal di-fetch dilewati (bukan gagalkan seluruh zip) - dilaporkan lewat return value.
export async function downloadFotoSebagaiZip(
  items: FotoZipItem[],
  zipFilename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ gagal: number }> {
  const zip = new JSZip()
  let gagal = 0
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    try {
      const res = await fetch(it.url)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      zip.file(it.path, blob)
    } catch {
      gagal++
    }
    onProgress?.(i + 1, items.length)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  const blobUrl = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = zipFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
  return { gagal }
}

// Nama file/folder aman buat sistem file (hapus karakter yang biasanya bikin masalah di Windows/Mac).
export function sanitizeNamaFile(nama: string): string {
  return (nama || 'tanpa_nama').replace(/[\\/:*?"<>|]/g, '_').trim() || 'tanpa_nama'
}
