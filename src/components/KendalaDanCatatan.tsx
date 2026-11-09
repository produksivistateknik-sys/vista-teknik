// KENDALA DAN CATATAN (8 Nov 2026) - menu admin (id tab tetap "kendala": dipakai localStorage tab terakhir & klik notifikasi).
// Dua subtab: Kendala (KendalaAdmin, dari operator & admin) dan Catatan (CatatanAdmin, info yang didengar Admin Produksi).
// Subtab yang sudah dibuka tetap terpasang (state & langganan realtime tidak hilang saat berpindah). Subtab terakhir diingat per
// perangkat (localStorage, hanya kenyamanan - gagal dibaca/ditulis = bawaan Kendala).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react'
import { bangunPetaWo } from '../lib/petaWo'
import { woOverall } from '../lib/panelHelpers'
import { KendalaAdmin } from './KendalaAdmin'
import { CatatanAdmin } from './CatatanAdmin'

type Sub = 'kendala' | 'catatan'
const KUNCI = 'vista_teknik_kendala_subtab'
const bacaSub = (): Sub => { try { return localStorage.getItem(KUNCI) === 'catatan' ? 'catatan' : 'kendala' } catch { return 'kendala' } }

const CSS = `
.kdc{display:flex;flex-direction:column;gap:12px;text-align:left;color:var(--text-primary,#1b1f2a)}
.kdc-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.kdc h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;color:var(--text-primary,#1b1f2a)}
.kdc-sub{display:flex;border:1px solid var(--border-color,#e6e8ed);border-radius:8px;overflow:hidden}
.kdc .kdc-sub button{height:34px;padding:0 16px;border:0;border-right:1px solid var(--border-color,#e6e8ed);background:var(--card-bg,#fff);color:var(--text-primary,#1b1f2a);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.kdc .kdc-sub button:last-child{border-right:0}
.kdc .kdc-sub button[aria-selected="true"]{background:var(--text-primary,#1b1f2a);color:var(--card-bg,#fff)}
.kdc-badge{display:inline-block;min-width:18px;margin-left:6px;padding:0 5px;border-radius:9px;background:#dc2626;color:#fff;font-size:11px;line-height:18px;text-align:center}
`

// woData (9 Nov 2026): WO aktif App (realtime) -> peta nomor WO & deadline utk kartu (persen WO = woOverall, sama dgn notifikasi App).
export function KendalaDanCatatan({ db, user, jumlahKendala, woData }: { db: any; user: any; jumlahKendala?: number; woData?: any[] }) {
  const petaWo = useMemo(() => bangunPetaWo(woData || [], woOverall), [woData])
  const [sub, setSub] = useState<Sub>(bacaSub)
  const [pernah, setPernah] = useState<Sub[]>(() => [bacaSub()])
  const pilih = (s: Sub) => {
    setSub(s); setPernah(p => p.includes(s) ? p : [...p, s])
    try { localStorage.setItem(KUNCI, s) } catch { /* penyimpanan diblokir - abaikan */ }
  }
  return (
    <div className="kdc">
      <style>{CSS}</style>
      <div className="kdc-top">
        <h1>Kendala dan Catatan</h1>
        <div className="kdc-sub" role="tablist" aria-label="Subtab">
          <button className="kdcBtn" role="tab" aria-selected={sub === 'kendala'} onClick={() => pilih('kendala')}>Kendala{jumlahKendala ? <span className="kdc-badge">{jumlahKendala}</span> : null}</button>
          <button className="kdcBtn" role="tab" aria-selected={sub === 'catatan'} onClick={() => pilih('catatan')}>Catatan</button>
        </div>
      </div>
      {pernah.includes('kendala') && <div style={{ display: sub === 'kendala' ? 'block' : 'none' }}><KendalaAdmin db={db} user={user} tertanam petaWo={petaWo} /></div>}
      {pernah.includes('catatan') && <div style={{ display: sub === 'catatan' ? 'block' : 'none' }}><CatatanAdmin db={db} user={user} petaWo={petaWo} /></div>}
    </div>
  )
}
