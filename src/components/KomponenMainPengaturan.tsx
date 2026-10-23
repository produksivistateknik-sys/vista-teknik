// PENGATURAN KOMPONEN MAIN / PRINTILAN (23 Okt 2026) - dipakai HANYA oleh Laporan Outstanding: proses per-WP di laporan hanya
// dari komponen MAIN. Penanda per jenis panel, kunci (jenis_panel, kode_komponen) = bom_master (tipe_panel, kode_komponen).
// Baca: bom_master + laporan_komponen_main (.range penuh). Tulis: RPC atur_komponen_main (jejak di laporan_komponen_main_log).
// Komponen tanpa baris penanda = MAIN. Perubahan berlaku saat laporan dibuat ulang ("Buat ulang laporan").
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { laporError } from '../lib/laporError'
import { muatPenandaMain } from '../lib/laporanOutstanding'

type Bom = { id: number; tipe_panel: string; kode_komponen: string; nama_komponen: string; wp: string; urutan: number }
const nomor = (k: string) => Number(String(k).split('.').pop()) || 0

export function KomponenMainPengaturan({ db, user, onTutup }: { db: any; user: any; onTutup: () => void }) {
  const nama = String(user?.nama || user?.name || 'Admin').trim()
  const [bom, setBom] = useState<Bom[]>([])
  const [penanda, setPenanda] = useState<Map<string, boolean>>(new Map())
  const [jenis, setJenis] = useState('')
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const [b, p] = await Promise.all([
          fetchAllPaged((a, z) => db.from('bom_master').select('id,tipe_panel,kode_komponen,nama_komponen,wp,urutan').order('id').range(a, z)),
          muatPenandaMain(db),
        ])
        if (batal) return
        setBom(b as Bom[]); setPenanda(p)
        setJenis((j) => j || (b as Bom[]).map((x) => x.tipe_panel).sort()[0] || '')
      } catch (e: any) {
        console.error('[Komponen main] gagal memuat:', e); laporError('supabase_error', e, { aksi: 'muat pengaturan komponen main' })
        if (!batal) setGalat('Gagal memuat daftar komponen: ' + (e?.message || e))
      } finally { if (!batal) setMemuat(false) }
    })()
    return () => { batal = true }
  }, [db])
  const daftarJenis = useMemo(() => [...new Set(bom.map((b) => b.tipe_panel))].sort(), [bom])
  const perWp = useMemo(() => {
    const m = new Map<string, Bom[]>()
    bom.filter((b) => b.tipe_panel === jenis).sort((a, c) => (a.wp || '').localeCompare(c.wp || '') || nomor(a.kode_komponen) - nomor(c.kode_komponen))
      .forEach((b) => { const k = b.wp || '(tanpa WP)'; m.set(k, [...(m.get(k) || []), b]) })
    return [...m.entries()]
  }, [bom, jenis])
  const isMain = (b: Bom) => penanda.get(`${b.tipe_panel}|${b.kode_komponen}`) ?? true
  const ubah = async (b: Bom) => {
    const baru = !isMain(b), k = `${b.tipe_panel}|${b.kode_komponen}`
    const wpIni = perWp.find(([w]) => w === (b.wp || '(tanpa WP)'))?.[1] || []
    if (!baru && wpIni.filter((x) => isMain(x)).length <= 1 && !window.confirm(`${b.nama_komponen} adalah satu-satunya komponen MAIN di ${b.wp}. Jadikan printilan? WP ini tidak akan muncul di laporan.`)) return
    setSibuk(k)
    try {
      const { error } = await db.rpc('atur_komponen_main', { p_jenis_panel: b.tipe_panel, p_kode_komponen: b.kode_komponen, p_is_main: baru, p_oleh: nama, p_alasan: null })
      if (error) throw error
      setPenanda((m) => new Map(m).set(k, baru))
    } catch (e: any) {
      console.error('[Komponen main] gagal menyimpan:', e); laporError('gagal_simpan', e, { aksi: 'atur komponen main', jenis: b.tipe_panel, kode: b.kode_komponen })
      alert('Gagal menyimpan penanda: ' + (e?.message || e))
    } finally { setSibuk(null) }
  }
  const jml = (ks: Bom[]) => ks.filter(isMain).length
  return (
    <div className="lo-picker">
      <div className="lo-row wrap" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 14 }}>Komponen main per jenis panel</b>
        <button className="loBtn" type="button" onClick={onTutup}>Tutup</button>
      </div>
      <div className="lo-meta">Laporan hanya menulis pekerjaan per WP dari komponen <b>Main</b>; WP dianggap selesai bila semua komponen main-nya selesai. Printilan tidak ditulis. Tidak memengaruhi progres, Rencana Harian, Raw Schedule, atau aplikasi operator. Perubahan berlaku saat laporan dibuat ulang.</div>
      {memuat && <div className="lo-meta">Memuat…</div>}
      {galat && <div className="lo-err">{galat}</div>}
      {!memuat && !galat && <>
        <div className="lo-row wrap">
          <span className="lo-lbl">Jenis panel</span>
          <select className="inp" style={{ flex: '0 1 220px', height: 32 }} value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Jenis panel">
            {daftarJenis.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        {perWp.map(([wp, ks]) => (
          <div className="lo-arc" key={wp}>
            <div><b>{wp}</b> <span className="lo-meta">· {jml(ks)} main / {ks.length - jml(ks)} printilan</span></div>
            {ks.map((b) => {
              const m = isMain(b), k = `${b.tipe_panel}|${b.kode_komponen}`
              return (
                <div className="lo-row" key={b.id} style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, opacity: m ? 1 : 0.6 }}>{b.nama_komponen} <span className="lo-meta">{b.kode_komponen}</span></span>
                  <button className="loBtn" type="button" disabled={sibuk === k} onClick={() => ubah(b)}
                    style={{ height: 28, padding: '0 10px', fontSize: 12, background: m ? 'var(--lo-ink)' : 'var(--lo-card)', color: m ? 'var(--lo-ink-fg)' : 'var(--lo-mute)' }}>
                    {sibuk === k ? '…' : m ? 'Main' : 'Printilan'}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </>}
    </div>
  )
}
