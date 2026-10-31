// RIWAYAT LAPORAN OUTSTANDING BERSAMA (S2, 31 Okt 2026) - siapa, kapan, apa yang berubah (sebelum -> sesudah), permanen.
// "Kembalikan" memulihkan versi sebelum lewat RPC lo_kembalikan (ikut tercatat sbg 'kembalikan'). Buat / buat ulang / impor
// tidak bisa dikembalikan dari sini. Realtime + pemulih; per halaman 100 (Muat lagi).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { muatRiwayat, bisaDikembalikan, teksRiwayat, loKembalikan, type RiwayatLO } from '../lib/laporanOutstandingBersama'

const LABEL: Record<string, string> = { buat: 'Laporan dibuat', buat_ulang: 'Buat ulang', impor: 'Impor draf lama', tambah: 'Tambah', ubah: 'Ubah', urut: 'Urutan', hapus: 'Hapus', pulih: 'Pulih', header: 'Pengaturan / teks WA', kembalikan: 'Dikembalikan' }
const waktu = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'

export function RiwayatLaporan({ db, user, laporanId, onBerubah }: { db: any; user: any; laporanId: number; onBerubah: () => void }) {
  const [baris, setBaris] = useState<RiwayatLO[] | null>(null)
  const [halaman, setHalaman] = useState(1)
  const [adaLagi, setAdaLagi] = useState(false)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState<number | null>(null)
  const muat = useCallback(async () => {
    try { const r = await muatRiwayat(db, laporanId, halaman); setBaris(r.baris); setAdaLagi(r.adaLagi); setGalat('') }
    catch (e: any) { console.error('[laporan outstanding] riwayat gagal:', e); setGalat('Gagal memuat riwayat: ' + (e?.message || e)) }
  }, [db, laporanId, halaman])
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t) }, [muat])
  useEffect(() => pasangPemulihRealtime(db, { nama: 'lo-riwayat-' + Math.random().toString(36).slice(2), label: 'Riwayat laporan', jedaMs: 800, muat, tabel: 'laporan_outstanding_riwayat' }), [db, muat])
  const kembalikan = async (r: RiwayatLO) => {
    if (!window.confirm(`Kembalikan ke versi sebelum perubahan ini?\n\n${LABEL[r.jenis] || r.jenis} oleh ${r.oleh}, ${waktu(r.waktu)}\nSebelum: ${teksRiwayat(r.sebelum, !!r.bagian_id)}\n\nTercatat di riwayat dan langsung terlihat semua admin.`)) return
    setSibuk(r.id)
    try { await loKembalikan(db, user, r.id); onBerubah(); await muat() }
    catch (e: any) { console.error('[laporan outstanding] kembalikan gagal:', e); alert('Gagal mengembalikan: ' + (e?.message || e)) }
    finally { setSibuk(null) }
  }
  return (
    <section>
      <div className="lo-hint" style={{ marginBottom: 10 }}>Semua perubahan laporan ini oleh siapa pun - permanen, tidak bisa dihapus. “Kembalikan” memulihkan isi sebelum perubahan itu (ikut tercatat di sini).</div>
      {galat && <div className="lo-err">{galat} <button className="loBtn lnk" type="button" onClick={muat}>Coba lagi</button></div>}
      {!baris ? <div className="lo-meta">Memuat riwayat…</div> : !baris.length ? <div className="lo-empty">Belum ada riwayat.</div> : (
        <div className="lo-card" style={{ gap: 0, padding: 0 }}>
          {baris.map((r) => (
            <div key={r.id} className="lo-row wrap" style={{ alignItems: 'flex-start', padding: '9px 12px', borderBottom: '1px solid var(--lo-line)' }}>
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <div><b>{LABEL[r.jenis] || r.jenis}</b> · {r.oleh} <span className="lo-meta">· {waktu(r.waktu)}</span></div>
                {r.ringkasan && <div className="lo-meta" style={{ overflowWrap: 'anywhere' }}>{r.ringkasan}</div>}
                {(r.jenis === 'ubah' || r.jenis === 'header' || r.jenis === 'kembalikan') && <div style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>
                  <span className="lo-meta">Sebelum:</span> {teksRiwayat(r.sebelum, !!r.bagian_id)} <span className="lo-meta">→ Sesudah:</span> {teksRiwayat(r.sesudah, !!r.bagian_id)}</div>}
              </div>
              {bisaDikembalikan(r) && <button className="loBtn" type="button" disabled={sibuk != null} onClick={() => kembalikan(r)}>{sibuk === r.id ? 'Memproses…' : 'Kembalikan'}</button>}
            </div>
          ))}
        </div>
      )}
      {adaLagi && <div className="lo-links" style={{ marginTop: 8 }}><button className="loBtn" type="button" onClick={() => setHalaman((h) => h + 1)}>Muat lagi</button></div>}
    </section>
  )
}
