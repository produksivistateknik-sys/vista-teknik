import JSZip from 'jszip'

// FIX (27 Sep 2026, Download foto QC gagal CORS "No 'Access-Control-Allow-Origin'"): foto yang
// sama sudah dimuat duluan lewat <img> (FotoZoomViewer) TANPA header Origin -> respons R2 tanpa
// header CORS & tanpa Vary: Origin, disimpan cache browser, lalu dipakai ulang oleh fetch() di
// bawah -> diblok. CORS R2 sendiri sudah benar utk request ber-Origin (dicek live). `no-store`
// = selalu minta respons baru ber-Origin, gak pernah ambil dari cache <img>.
const FETCH_DOWNLOAD: RequestInit = { cache: 'no-store' }

// Pesan gagal yang bisa dimengerti user (TypeError "Failed to fetch" = jaringan/CORS, bukan HTTP).
function alasanGagal(err: any): string {
  if (err instanceof TypeError) return 'koneksi terputus atau akses file diblokir browser'
  return String(err?.message || err)
}

// Foto-foto di R2/Supabase Storage adalah public URL cross-origin, jadi <a href download>
// tidak reliable di semua browser - pakai fetch+blob supaya benar-benar ke-trigger sebagai
// download, bukan cuma buka tab baru. Error ditangani DI SINI (console.error + alert, return
// false) - dulu gak ada try/catch sama sekali, gagal = "Uncaught TypeError" diam-diam di console.
export async function downloadFotoTunggal(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url, FETCH_DOWNLOAD)
    if (!res.ok) throw new Error(`server membalas HTTP ${res.status}${res.status === 404 ? ' (file tidak ditemukan)' : ''}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
    return true
  } catch (err) {
    console.error('downloadFotoTunggal gagal:', url, err)
    alert(`Gagal download "${filename}": ${alasanGagal(err)}.`)
    return false
  }
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
      const res = await fetch(it.url, FETCH_DOWNLOAD)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      zip.file(it.path, blob)
    } catch (err) {
      console.error('downloadFotoSebagaiZip: foto dilewati', it.url, err)
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
