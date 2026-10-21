// Dialog peringatan "urutan proses terbalik" (21 Okt 2026) - PERINGATAN, bukan blokir: [Batal] / [Tetap pindahkan].
// Logika pelanggaran = lib/urutanProses.ts (satu sumber). Hanya pelanggaran BARU akibat aksi ini yang ditanyakan.
import { useRef, useState } from 'react'
import { Modal, Btn } from './ui/Primitives'
import { pelanggaranUrutanBaru, teksPelanggaran, type KonteksUrutan, type PelanggaranUrutan } from '../lib/urutanProses'

const MAKS_TAMPIL = 5

export type DepsKonfirmasiUrutan = KonteksUrutan & {
  rawData: any[]
  namaPanel: (panelId: number) => string
  namaKomponen: (panelId: number, kode: string) => string
}

export function useKonfirmasiUrutan(ambil: () => DepsKonfirmasiUrutan) {
  const [tampil, setTampil] = useState<{ daftar: PelanggaranUrutan[]; d: DepsKonfirmasiUrutan } | null>(null)
  const jawabRef = useRef<((ok: boolean) => void) | null>(null)

  // perubahan: rawId -> kolom baru ({schedule, ...}). true = lanjut simpan.
  const tanya = (perubahan: Map<number, any>): Promise<boolean> => {
    const d = ambil()
    let baru: PelanggaranUrutan[] = []
    try { baru = pelanggaranUrutanBaru(d.rawData, perubahan, d) }
    catch (e) { console.error('[urutan proses] gagal memeriksa - simpan tetap dilanjutkan:', e); return Promise.resolve(true) }
    if (baru.length === 0) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => { jawabRef.current?.(false); jawabRef.current = resolve; setTampil({ daftar: baru, d }) })
  }
  const jawab = (ok: boolean) => { const f = jawabRef.current; jawabRef.current = null; setTampil(null); f?.(ok) }

  const daftar = tampil?.daftar, d = tampil?.d
  const elemen = daftar && d ? (
    <Modal title="⚠ Urutan proses terbalik" onClose={() => jawab(false)} width={480}>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
        Perubahan ini membuat proses sesudahnya dijadwalkan <b>lebih awal</b> dari proses sebelumnya:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
        {daftar.slice(0, MAKS_TAMPIL).map((p, i) => (
          <div key={i} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: '#1e293b' }}>{d.namaKomponen(p.panelId, p.kode)} ({p.kode}) · {d.namaPanel(p.panelId)}</div>
            <div style={{ color: '#b91c1c', marginTop: 2 }}>{teksPelanggaran(p)}</div>
          </div>
        ))}
        {daftar.length > MAKS_TAMPIL && <div style={{ fontSize: 11, color: '#64748b' }}>+{daftar.length - MAKS_TAMPIL} lainnya</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn color="#64748b" onClick={() => jawab(false)}>Batal</Btn>
        <Btn color="#dc2626" onClick={() => jawab(true)}>Tetap pindahkan</Btn>
      </div>
    </Modal>
  ) : null

  return { tanya, elemen }
}

// Tombol toolbar "⚠ Urutan terbalik (N)" + daftar (dipakai tampilan lama & per WP). onPilih = saring ke panel itu.
export function TombolDaftarUrutan({ daftar, namaPanel, namaKomponen, onPilih }: {
  daftar: PelanggaranUrutan[]; namaPanel: (panelId: number) => string; namaKomponen: (panelId: number, kode: string) => string; onPilih: (p: PelanggaranUrutan) => void
}) {
  const [buka, setBuka] = useState(false)
  if (daftar.length === 0) return null
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setBuka(!buka)} title="Komponen yang proses sesudahnya dijadwalkan lebih awal dari proses sebelumnya" style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        ⚠ Urutan terbalik ({daftar.length}) ▾
      </button>
      {buka && (
        <>
          <div onClick={() => setBuka(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 41, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 8, width: 420, maxHeight: 380, overflow: 'auto' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Klik untuk menyaring ke panel itu. Proses sebelumnya yang sudah 100% tidak dihitung; hari yang sama boleh.</div>
            {[...daftar].sort((a, b) => a.tglSesudah.localeCompare(b.tglSesudah) || a.panelId - b.panelId).map((p, i) => (
              <div key={i} onClick={() => { onPilih(p); setBuka(false) }} style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{namaKomponen(p.panelId, p.kode)} ({p.kode}) · {namaPanel(p.panelId)}</div>
                <div style={{ color: '#b91c1c' }}>{teksPelanggaran(p)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
