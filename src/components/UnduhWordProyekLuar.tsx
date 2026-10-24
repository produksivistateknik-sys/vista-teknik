// DIALOG "UNDUH WORD" PROYEK LUAR (24 Okt 2026). Satu proyek luar = beberapa record (satu record = satu tanggal kerja, nama
// diketik bebas - mis. Bali Tennis Court ada 5 ejaan) -> admin mencentang record yang digabung (awal: nama mirip dgn kartu
// yang diklik), menentukan judul proyek, dan memilih foto yang ikut (awal: semua foto, video tidak ikut). Pilihan tidak
// disimpan (per unduhan). Dokumen dibuat di browser: lib/laporanProyekLuarDocx. Hanya membaca data.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react'
import { Modal } from './ui/Primitives'
import { ThumbMedia } from './ui/ThumbMedia'
import { laporError } from '../lib/laporError'
import { buatDocxProyekLuar, namaBerkasPL, namaMirip, urutFoto, tglPanjang, labelDivisiPL, type RecordPL } from '../lib/laporanProyekLuarDocx'

export function UnduhWordProyekLuar({ awal, semua, onClose }: { awal: RecordPL; semua: RecordPL[]; onClose: () => void }) {
  const kandidat = useMemo(() => [...semua].sort((a, b) => (namaMirip(b.nama_lokasi, awal.nama_lokasi) ? 1 : 0) - (namaMirip(a.nama_lokasi, awal.nama_lokasi) ? 1 : 0) || a.tanggal.localeCompare(b.tanggal) || a.id - b.id), [semua, awal])
  const [pilihRec, setPilihRec] = useState<Set<number>>(() => new Set(semua.filter((r) => r.id === awal.id || namaMirip(r.nama_lokasi, awal.nama_lokasi)).map((r) => r.id)))
  const [pilihFoto, setPilihFoto] = useState<Set<string>>(() => new Set(semua.filter((r) => r.id === awal.id || namaMirip(r.nama_lokasi, awal.nama_lokasi)).flatMap((r) => urutFoto(r.foto).map((f) => f.url))))
  const [judul, setJudul] = useState(awal.nama_lokasi.trim().toUpperCase())
  const [tampilSemua, setTampilSemua] = useState(false)
  const [proses, setProses] = useState<string | null>(null)
  const dipilih = kandidat.filter((r) => pilihRec.has(r.id))
  const jmlFoto = dipilih.reduce((n, r) => n + urutFoto(r.foto).filter((f) => pilihFoto.has(f.url)).length, 0)
  const toggleRec = (r: RecordPL) => {
    const on = !pilihRec.has(r.id)
    setPilihRec((s) => { const n = new Set(s); if (on) n.add(r.id); else n.delete(r.id); return n })
    if (on) setPilihFoto((s) => { const n = new Set(s); urutFoto(r.foto).forEach((f) => n.add(f.url)); return n })
  }
  const toggleFoto = (url: string) => setPilihFoto((s) => { const n = new Set(s); if (n.has(url)) n.delete(url); else n.add(url); return n })
  const unduh = async () => {
    if (!dipilih.length) return
    setProses('Menyiapkan…')
    try {
      const blob = await buatDocxProyekLuar({ judulProyek: judul, records: dipilih, fotoDipilih: pilihFoto, onProgres: (a, b) => setProses(`Memproses foto ${a}/${b}…`) })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = namaBerkasPL(judul, dipilih); document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setProses(null); onClose()
    } catch (e: any) {
      console.error('[Word Proyek Luar] gagal membuat dokumen:', e); laporError('crash', e, { aksi: 'buat Word Proyek Luar', jumlahRecord: dipilih.length })
      alert('Gagal membuat dokumen Word: ' + (e?.message || e)); setProses(null)
    }
  }
  const daftar = tampilSemua ? kandidat : kandidat.filter((r) => pilihRec.has(r.id) || namaMirip(r.nama_lokasi, awal.nama_lokasi))
  return (
    <Modal title="Unduh Word – Laporan Proyek Luar" onClose={() => { if (!proses) onClose() }} width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
          Judul proyek di dokumen
          <input value={judul} onChange={(e) => setJudul(e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b' }} />
        </label>
        <div style={{ fontSize: 12, color: '#64748b' }}>Centang laporan (tanggal kerja) yang digabung jadi satu dokumen. Tiap tanggal menjadi satu bagian; foto bisa dilepas satu per satu. Video tidak dimasukkan.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>
          {daftar.map((r) => {
            const on = pilihRec.has(r.id), fs = urutFoto(r.foto)
            return (
              <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: on ? '#f8fafc' : '#fff' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggleRec(r)} style={{ marginTop: 3 }} />
                  <span style={{ fontSize: 13, color: '#1e293b' }}><b>{tglPanjang(r.tanggal)}</b> · {r.nama_lokasi}
                    <br /><span style={{ fontSize: 12, color: '#64748b' }}>{r.operator_nama} ({labelDivisiPL(r.divisi)}) · {fs.length} foto{r.status === 'berlangsung' ? ' · Berlangsung' : ''}</span></span>
                </label>
                {on && fs.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 6, marginTop: 8 }}>
                    {fs.map((f, i) => {
                      const ikut = pilihFoto.has(f.url)
                      return (
                        <button key={f.url} type="button" className="pilihFotoBtn" onClick={() => toggleFoto(f.url)} title={ikut ? 'Ikut dokumen - klik untuk lepas' : 'Tidak ikut - klik untuk pilih'}
                          style={{ position: 'relative', aspectRatio: '1', padding: 0, border: ikut ? '2px solid #2563eb' : '2px solid transparent', borderRadius: 8, overflow: 'hidden', opacity: ikut ? 1 : 0.35, cursor: 'pointer', background: '#f1f5f9' }}>
                          <ThumbMedia url={f.url} thumb={(f as any).thumb} video={false} />
                          <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px #000' }}>{ikut ? '✓' : ''} {i + 1}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setTampilSemua((x) => !x)} style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {tampilSemua ? 'Tampilkan hanya laporan bernama mirip' : `Tampilkan semua laporan (${kandidat.length}) untuk digabung`}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{dipilih.length} tanggal kerja · {jmlFoto} foto</span>
          <button type="button" onClick={unduh} disabled={!dipilih.length || !!proses}
            style={{ height: 36, padding: '0 16px', border: 0, borderRadius: 8, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: proses ? 'wait' : 'pointer', opacity: !dipilih.length ? 0.5 : 1 }}>
            {proses || 'Buat & unduh Word'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
