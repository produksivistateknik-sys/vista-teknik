import { useState, useMemo } from 'react'
import { ALL_PROSES, PRIORITAS, PROSES_COLOR, PRIORITAS_COLOR } from '../constants/panelTypes'
import { TODAY, addDays, getDayLabel } from '../lib/dateHelpers'
import { Card } from './ui/Primitives'

// ─────────────────────────────────────────────────────────────────────────────
// RAW SCHEDULE (PERCOBAAN) - 9 Sep 2026 - halaman SANDBOX murni buat menguji ide format
// tabel baru: baris = KOMPONEN (bukan lagi Proses), badge di kolom tanggal = PROSES (bukan
// lagi WP). TERISOLASI TOTAL dari RawSchedule.tsx asli - FILE INI TIDAK BOLEH IMPORT
// SUPABASE SAMA SEKALI, semua data dummy di useState lokal, hilang kalau di-refresh.
// Styling (warna proses, warna prioritas, style header tabel) di-reuse dari konstanta
// MURNI (constants/panelTypes.ts, lib/dateHelpers.ts) - keduanya gak ada dependensi
// Supabase, jadi aman dipakai di sini tanpa menyeret data layer produksi.
//
// SENGAJA DISEDERHANAKAN dari RawSchedule.tsx asli (2804 baris, drag-drop/context-menu/
// modal assign/kalkulasi kapasitas wiring real) - sandbox ini cuma buat menguji IDE TATA
// LETAK baris/kolomnya, bukan replikasi interaksi penuh. Klik cell tanggal buka toggle-list
// proses sederhana (checkbox), itu doang.
// ─────────────────────────────────────────────────────────────────────────────

type DummyRow = {
  id: number
  proyek: string
  panel: string
  komponen: string
  prioritas: string
  schedule: Record<string, string[]> // tanggal -> daftar proses yang lagi dikerjakan
}

const DUMMY_SEED: DummyRow[] = [
  { id: 1, proyek: 'FINNS RESORT', panel: 'LVMDP', komponen: 'Busbar Copper 100x10', prioritas: 'Tinggi',
    schedule: { [TODAY]: ['POTONG', 'BENDING'], [addDays(TODAY, 1)]: ['STEL'] } },
  { id: 2, proyek: 'FINNS RESORT', panel: 'LVMDP', komponen: 'Pintu Panel 2000x800', prioritas: 'Tinggi',
    schedule: { [TODAY]: ['PAINTING'], [addDays(TODAY, 2)]: ['FINISHING'] } },
  { id: 3, proyek: 'CLS-FONTAINE', panel: 'MDB-EL A', komponen: 'Rangka Frame 2200mm', prioritas: 'Sedang',
    schedule: { [addDays(TODAY, -1)]: ['RAKIT'], [TODAY]: ['PASANG KOMPONEN', 'BUSBAR'] } },
  { id: 4, proyek: 'CLS-FONTAINE', panel: 'MDB-EL A', komponen: 'Terminal Block 24 Way', prioritas: 'Sedang',
    schedule: { [addDays(TODAY, 1)]: ['WIRING CONTROL'] } },
  { id: 5, proyek: 'TRANS ICON SURABAYA', panel: 'DP-PUMP', komponen: 'MCCB 3P 400A', prioritas: 'Rendah',
    schedule: { [TODAY]: ['WIRING POWER'], [addDays(TODAY, 3)]: ['QC TEST'] } },
  { id: 6, proyek: 'TRANS ICON SURABAYA', panel: 'DP-PUMP', komponen: 'Nameplate Panel', prioritas: 'Rendah',
    schedule: { [addDays(TODAY, 4)]: ['PACKING'] } },
]

const HARI_SEBELUM_WEEKSTART = 3

export function RawScheduleSandbox() {
  const [weekStart, setWeekStart] = useState(TODAY)
  const [rows, setRows] = useState<DummyRow[]>(DUMMY_SEED)
  const [filterProses, setFilterProses] = useState<string[]>([])
  const [capacityCollapsed, setCapacityCollapsed] = useState(false)
  const [cellPicker, setCellPicker] = useState<{ rowId: number, date: string } | null>(null)

  const days = useMemo(() => Array.from({ length: 20 }, (_, i) => addDays(weekStart, i - HARI_SEBELUM_WEEKSTART)), [weekStart])
  const isSunday = (d: string) => new Date(d).getDay() === 0

  const toggleFilterProses = (p: string) => setFilterProses(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const toggleProsesDiCell = (rowId: number, date: string, proses: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const current = r.schedule[date] || []
      const next = current.includes(proses) ? current.filter(p => p !== proses) : [...current, proses]
      return { ...r, schedule: { ...r.schedule, [date]: next } }
    }))
  }

  const visibleRows = rows.filter(r => filterProses.length === 0 || (Object.values(r.schedule).some(list => list.some(p => filterProses.includes(p)))))

  // Capacity Utilization dummy - dihitung murni dari state lokal `rows`, bukan Supabase.
  // Hitung berapa kali tiap proses muncul di seluruh jadwal dummy, sekadar ilustrasi visual.
  const capacityByProses = useMemo(() => {
    const count: Record<string, number> = {}
    rows.forEach(r => Object.values(r.schedule).forEach(list => list.forEach(p => { count[p] = (count[p] || 0) + 1 })))
    return count
  }, [rows])
  const maxCapacity = Math.max(1, ...Object.values(capacityByProses))

  const thS = { background: '#1e3a8a', color: '#fff', padding: '3px 6px', fontWeight: 600, fontSize: 9, whiteSpace: 'nowrap' as const, letterSpacing: .3, textAlign: 'center' as const, borderRight: '1px solid #ffffff18', position: 'sticky' as const, top: 0, zIndex: 3, textTransform: 'uppercase' as const }

  return (
    <div className="fi">
      <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🧪</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e' }}>MODE PERCOBAAN</div>
          <div style={{ fontSize: 11, color: '#b45309' }}>Data dummy lokal, tidak tersimpan, tidak terhubung ke database - murni buat menguji ide format tabel (baris = Komponen, badge tanggal = Proses).</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary,#1e293b)' }}>Raw Schedule (Percobaan)</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Klik kotak tanggal untuk coba tambah/hapus proses pada komponen itu.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>‹ Minggu Lalu</button>
          <button onClick={() => setWeekStart(TODAY)} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '0.5px solid #3b5bdb', background: weekStart === TODAY ? '#eff3ff' : '#fff', color: '#3b5bdb', cursor: 'pointer', fontSize: 11, fontWeight: 500, fontFamily: 'inherit' }}>Hari Ini</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Minggu Depan ›</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Filter Proses:</span>
        <button onClick={() => setFilterProses([])} style={{ padding: '3px 12px', borderRadius: 20, border: `1.5px solid ${filterProses.length === 0 ? '#1d4ed8' : '#e2e8f0'}`, background: filterProses.length === 0 ? '#1d4ed8' : '#fff', color: filterProses.length === 0 ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Semua</button>
        {ALL_PROSES.map(pr => {
          const pc = (PROSES_COLOR as any)[pr] || '#64748b'
          const isSel = filterProses.includes(pr)
          return <button key={pr} onClick={() => toggleFilterProses(pr)} style={{ padding: '3px 12px', borderRadius: 20, border: `1.5px solid ${isSel ? pc : '#e2e8f0'}`, background: isSel ? pc + '18' : '#fff', color: isSel ? pc : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{pr}</button>
        })}
      </div>

      <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
        <div onClick={() => setCapacityCollapsed(!capacityCollapsed)}
          style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, marginBottom: capacityCollapsed ? 0 : 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
          <span style={{ fontSize: 10, transition: 'transform .15s', transform: capacityCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
          ⚡ Capacity Utilization {filterProses.length > 0 ? '— ' + filterProses.join(', ') : '(semua proses)'} <span style={{ fontWeight: 400, fontSize: 9, color: '#94a3b8' }}>(dummy lokal)</span>
        </div>
        {!capacityCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(filterProses.length > 0 ? filterProses : ALL_PROSES).filter(pr => capacityByProses[pr]).map(pr => {
              const pc = (PROSES_COLOR as any)[pr] || '#64748b'
              const val = capacityByProses[pr] || 0
              return (
                <div key={pr} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 110, fontSize: 10, fontWeight: 700, color: pc }}>{pr}</span>
                  <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(val / maxCapacity) * 100}%`, height: '100%', background: pc, borderRadius: 99, transition: 'width .4s' }} />
                  </div>
                  <span style={{ width: 24, fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'right' }}>{val}</span>
                </div>
              )
            })}
            {Object.keys(capacityByProses).length === 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>Belum ada jadwal dummy.</div>}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px #00000008' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ ...thS, textAlign: 'left', minWidth: 100, position: 'sticky', left: 0, zIndex: 5, background: '#1e3a8a' }}>PROYEK</th>
              <th style={{ ...thS, textAlign: 'left', minWidth: 110, position: 'sticky', left: 100, zIndex: 5, background: '#1e3a8a' }}>PANEL</th>
              <th style={{ ...thS, textAlign: 'left', minWidth: 170, position: 'sticky', left: 210, zIndex: 5, background: '#1e3a8a' }}>KOMPONEN</th>
              <th style={{ ...thS, minWidth: 90, position: 'sticky', left: 380, zIndex: 5, background: '#1e3a8a' }}>PRIORITAS</th>
              {days.map(d => (
                <th key={d} style={{ ...thS, minWidth: 120, background: d === TODAY ? '#1e40af' : isSunday(d) ? '#7f1d1d' : '#1e3a8a', borderBottom: d === TODAY ? '2px solid #60a5fa' : 'none' }}>
                  <div>{getDayLabel(d)}</div>
                  {d === TODAY && <div style={{ fontSize: 9, opacity: .7 }}>Hari Ini</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => {
              const priColor = (PRIORITAS_COLOR as any)[row.prioritas] || '#64748b'
              const rBg = ri % 2 === 0 ? '#fff' : '#f8fafc'
              const td = { borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', background: rBg, padding: '2px 4px', verticalAlign: 'middle' as const }
              return (
                <tr key={row.id}>
                  <td style={{ ...td, position: 'sticky', left: 0, zIndex: 2, fontWeight: 600, fontSize: 9, color: '#475569', background: '#fff', minWidth: 100, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.proyek}</td>
                  <td style={{ ...td, position: 'sticky', left: 100, zIndex: 2, fontWeight: 600, fontSize: 9, color: '#1e293b', background: '#fff', minWidth: 110, maxWidth: 110, wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3, textAlign: 'center' }}>{row.panel}</td>
                  <td style={{ ...td, position: 'sticky', left: 210, zIndex: 2, fontWeight: 700, fontSize: 9, color: '#1e293b', background: rBg, minWidth: 170, maxWidth: 170, wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3, textAlign: 'left' }}>{row.komponen}</td>
                  <td style={{ ...td, position: 'sticky', left: 380, zIndex: 2, textAlign: 'center', background: rBg }}>
                    <span style={{ padding: '1px 4px', borderRadius: 4, border: `1px solid ${priColor}`, background: priColor + '18', color: priColor, fontSize: 9, fontWeight: 700 }}>{row.prioritas}</span>
                  </td>
                  {days.map(d => {
                    const entries = (row.schedule[d] || []).filter(p => filterProses.length === 0 || filterProses.includes(p))
                    const isPickerOpen = cellPicker?.rowId === row.id && cellPicker?.date === d
                    return (
                      <td key={d} onClick={(e: any) => { e.stopPropagation(); setCellPicker(isPickerOpen ? null : { rowId: row.id, date: d }) }}
                        style={{ ...td, textAlign: 'center', padding: '2px', cursor: 'pointer', position: 'relative', background: d === TODAY ? '#eff6ff' : isSunday(d) ? '#fff1f2' : rBg }}>
                        {entries.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', padding: '3px' }}>
                            {entries.map(p => {
                              const pc = (PROSES_COLOR as any)[p] || '#64748b'
                              return <span key={p} style={{ background: pc, color: '#fff', borderRadius: 3, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{p}</span>
                            })}
                          </div>
                        ) : (
                          <div style={{ width: '100%', minHeight: 26, borderRadius: 6, border: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontSize: 14 }}>+</div>
                        )}
                        {isPickerOpen && (
                          <>
                            <div onClick={(e: any) => { e.stopPropagation(); setCellPicker(null) }} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                            <div onClick={(e: any) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 999, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, minWidth: 160, textAlign: 'left' }}>
                              {ALL_PROSES.map(pr => (
                                <label key={pr} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                                  <input type="checkbox" checked={(row.schedule[d] || []).includes(pr)} onChange={() => toggleProsesDiCell(row.id, d, pr)} />
                                  {pr}
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
