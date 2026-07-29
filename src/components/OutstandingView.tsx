import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { checkKapasitasDanKomponenSwapV2, executeSwapKomponenV2, checkKuotaOrangDanKomponenSwap, executeSwapKomponenOrang } from '../services/fcsService'
import { PANEL_TYPES, ALL_PROSES, PROSES_COLOR } from '../constants/panelTypes'
import { markRenharDirty, markRawDirty } from '../lib/globalState'
import { TODAY } from '../lib/dateHelpers'
import { Modal } from './ui/Primitives'

// Proses whole-panel/marker (NAMEPLATE/YELLOWMARK/QC TEST/PACKING) dan BUSBAR (progress
// per-tahap, bukan checklist[kode].progress biasa) dikecualikan dari Outstanding - modelnya
// gak cocok sama "To Do / In Progress per baris komponen" (sesuai keputusan waktu desain).
const PROSES_EXCLUDE_OUTSTANDING = ['BUSBAR', 'QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const SUBTAB_OUTSTANDING = ALL_PROSES.filter((p: string) => !PROSES_EXCLUDE_OUTSTANDING.includes(p))
const PROSES_ORANG_OUT = ['WIRING CONTROL', 'WIRING POWER']

export function OutstandingView({ woData, rawData, setRawData, renhar, setRenhar, updateRaw, createRenhar, updateRenhar, withRenharQueue, refetchRaw, user, livePanelTypes }: any) {
  const [subProses, setSubProses] = useState<string>(SUBTAB_OUTSTANDING[0])
  const [search, setSearch] = useState('')
  const [filterProyek, setFilterProyek] = useState<string[]>([])
  const [proyekDropdownOpen, setProyekDropdownOpen] = useState(false)
  const toggleFilterProyek = (p: string) => {
    setFilterProyek((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
    setFilterPanel([])
  }
  const [filterPanel, setFilterPanel] = useState<string[]>([])
  const [panelDropdownOpen, setPanelDropdownOpen] = useState(false)
  const toggleFilterPanel = (p: string) => {
    setFilterPanel((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }
  const [processTimeList, setProcessTimeList] = useState<any[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [tglInput, setTglInput] = useState('')
  const [swapModal, setSwapModal] = useState<any>(null)
  const [swapSelected, setSwapSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // fcs_kapasitas_override sengaja gak disimpan ke state di sini - checkKapasitasDanKomponenSwapV2/
    // checkKuotaOrangDanKomponenSwap baca langsung dari DB tiap dipanggil, jadi cukup fetch process_time
    // (dipakai buat hitung menitDibutuhkan sebelum panggil fungsi capacity-check itu).
    const fetchPT = async () => {
      const { data: pt } = await supabase.from('fcs_process_time').select('tipe_panel,jenis_pekerjaan,kode_komponen,menit_per_pcs').eq('is_active', true)
      setProcessTimeList(pt ?? [])
    }
    fetchPT()
  }, [])

  const getEffCfg = (tipe: string) => (livePanelTypes?.[tipe]?.wps?.length > 0) ? livePanelTypes[tipe] : (PANEL_TYPES as any)[tipe]
  const getMenitPerPcs = (tipePanel: string, proses: string, kode: string): number => {
    const pt = processTimeList.find((p: any) => p.tipe_panel === tipePanel && p.jenis_pekerjaan === proses && p.kode_komponen === kode)
    return pt ? Number(pt.menit_per_pcs) : 0
  }

  const panelMap = useMemo(() => {
    const map: Record<number, any> = {}
    ;(woData || []).forEach((w: any) => (w.panels || []).forEach((p: any) => { map[p.id] = { ...p, _wo: w } }))
    return map
  }, [woData])

  // Satu baris per (panelId,kode) - kalau kode kebetulan terjadwal di lebih dari satu tanggal
  // (efek "duplikasi sengaja" auto-geser buat progress partial), yang dipakai/ditampilkan
  // adalah tanggal TERBARU (mewakili sisa kerjaan sekarang, bukan histori yang sudah lewat).
  const { todo, inProgress } = useMemo(() => {
    const isOrang = PROSES_ORANG_OUT.includes(subProses)
    const byKey = new Map<string, any>()
    rawData.filter((r: any) => r.proses === subProses
      && (filterProyek.length === 0 || filterProyek.includes(r.proyek))
      && (filterPanel.length === 0 || filterPanel.includes(r.panel))
    ).forEach((row: any) => {
      const panelId = row.panel_id || row.panelId
      const panel = panelMap[panelId]
      if (!panel) return
      Object.entries(row.schedule || {}).forEach(([tgl, entries]: [string, any]) => {
        ;(entries || []).forEach((e: any) => {
          const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_')) || null
          ;(e.komponen || []).forEach((kode: string) => {
            if (kode.startsWith('__wiring_')) return
            const cl = panel.checklist?.[kode]
            // Kode terjadwal di raw_schedule tapi checklist-nya belum ada di panel (data BOM
            // belum lengkap) - exclude dari Outstanding, bukan tanggung jawab fitur ini buat
            // nampilin data yang gak lengkap.
            if (!cl) return
            const pct = cl.progress?.[subProses] || 0
            if (pct >= 100) return
            const key = `${panelId}|${kode}`
            const existing = byKey.get(key)
            if (!existing || tgl > existing.tanggal) {
              const item = getEffCfg(panel.tipe)?.wps.flatMap((w: any) => w.items).find((it: any) => it.kode === kode)
              byKey.set(key, {
                key, rawId: row.id, panelId, proyek: row.proyek, panel: row.panel, tipe: panel.tipe,
                wp: e.wp, kode, nama: item?.nama || kode, qty: cl.qty || 0, pct, tanggal: tgl, token,
              })
            }
          })
        })
      })
    })
    const all = [...byKey.values()].filter((r) =>
      !search || r.panel?.toLowerCase().includes(search.toLowerCase()) || r.proyek?.toLowerCase().includes(search.toLowerCase()) || r.nama?.toLowerCase().includes(search.toLowerCase())
    )
    return {
      todo: all.filter((r) => r.pct === 0).sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
      inProgress: all.filter((r) => r.pct > 0 && r.pct < 100).sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, panelMap, subProses, search, filterProyek, filterPanel])

  const isOrang = PROSES_ORANG_OUT.includes(subProses)

  // ================= Tulis perubahan tanggal ke raw_schedule + sync renhar =================
  const tulisReschedule = async (row: any, newDate: string) => {
    const rawRow = rawData.find((r: any) => r.id === row.rawId)
    if (!rawRow) return
    const fromDate = row.tanggal
    const kasus1 = row.pct === 0 // 0% = geser murni; partial = duplikasi (sumber gak diubah)
    const schedule = { ...(rawRow.schedule || {}) }

    if (kasus1) {
      const fromEntries = (schedule[fromDate] || [])
        .map((e: any) => e.wp !== row.wp ? e : { ...e, komponen: (e.komponen || []).filter((k: string) => k !== row.kode) })
        .filter((e: any) => (e.komponen || []).some((k: string) => !k.startsWith('__wiring_')))
      schedule[fromDate] = fromEntries
    }

    const toEntries = [...(schedule[newDate] || [])]
    const idxTujuan = toEntries.findIndex((e: any) => e.wp === row.wp)
    if (idxTujuan !== -1) {
      let komp = toEntries[idxTujuan].komponen || []
      if (!komp.includes(row.kode)) komp = [...komp, row.kode]
      if (row.token && !komp.some((k: string) => k.startsWith('__wiring_'))) komp = [row.token, ...komp]
      toEntries[idxTujuan] = { ...toEntries[idxTujuan], komponen: komp }
    } else {
      toEntries.push({ wp: row.wp, komponen: row.token ? [row.token, row.kode] : [row.kode], carriedOverFrom: fromDate })
    }
    schedule[newDate] = toEntries

    markRawDirty(row.rawId)
    setRawData((prev: any[]) => prev.map((r) => r.id === row.rawId ? { ...r, schedule } : r))
    await updateRaw(row.rawId, { schedule })

    // Sync renhar (pola sama seperti drag-drop di Raw Schedule) - biar status Rilis/operator
    // ikut konsisten, bukan nyangkut di tanggal lama.
    await withRenharQueue({ rawId: row.rawId, wp: row.wp, tanggal: fromDate }, async (existingSrc: any) => {
      if (!existingSrc || !(existingSrc.komponen || []).includes(row.kode)) return
      if (kasus1) {
        const sisaKomp = (existingSrc.komponen || []).filter((k: string) => k !== row.kode)
        if (sisaKomp.length > 0) {
          markRenharDirty(existingSrc.id)
          await updateRenhar(existingSrc.id, { komponen: sisaKomp })
          setRenhar((prev: any[]) => prev.map((x) => x.id === existingSrc.id ? { ...x, komponen: sisaKomp } : x))
        } else {
          // Semua komponen di renhar row ini ikut pindah - cukup geser tanggalnya, gak perlu row baru.
          markRenharDirty(existingSrc.id)
          await updateRenhar(existingSrc.id, { tanggal: newDate, komponen: [row.kode] })
          setRenhar((prev: any[]) => prev.map((x) => x.id === existingSrc.id ? { ...x, tanggal: newDate, komponen: [row.kode] } : x))
          return
        }
      }
      const releasedLama = existingSrc.komponen_released || []
      const ppkLama = existingSrc.pekerja_per_komponen || {}
      const released = releasedLama.includes(row.kode) ? [row.kode] : []
      const ppk = ppkLama[row.kode] ? { [row.kode]: ppkLama[row.kode] } : {}

      await withRenharQueue({ rawId: row.rawId, wp: row.wp, tanggal: newDate }, async (existingTarget: any) => {
        if (existingTarget) {
          const komponenGabung = [...new Set([...(existingTarget.komponen || []), row.kode])]
          const releasedGabung = [...new Set([...(existingTarget.komponen_released || []), ...released])]
          const ppkGabung = { ...(existingTarget.pekerja_per_komponen || {}), ...ppk }
          markRenharDirty(existingTarget.id)
          await updateRenhar(existingTarget.id, { komponen: komponenGabung, komponen_released: releasedGabung, pekerja_per_komponen: ppkGabung })
          setRenhar((prev: any[]) => prev.map((x) => x.id === existingTarget.id ? { ...x, komponen: komponenGabung, komponen_released: releasedGabung, pekerja_per_komponen: ppkGabung } : x))
        } else {
          const result = await createRenhar({
            raw_id: row.rawId, wo_id: rawRow.wo_id, panel_id: row.panelId,
            proyek: row.proyek, panel: row.panel, proses: subProses,
            prioritas: rawRow.prioritas || 'Sedang', wp: row.wp, komponen: [row.kode],
            tanggal: newDate, pekerja: [],
            komponen_released: released,
            pekerja_per_komponen: ppk,
          })
          if (result?.success && result.data) {
            markRenharDirty(result.data.id)
            setRenhar((prev: any[]) => [...prev, result.data])
          }
        }
      })
    })

    const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
    const uname = user?.name || user?.nama || sess?.nama || 'Admin'
    await activityLogService.insert({
      user_name: uname,
      action: 'RESCHEDULE DARI OUTSTANDING',
      description: `Jadwal ulang ${row.nama} (${row.kode}) ${row.panel} - ${row.proyek} proses ${subProses} dari ${fromDate} ke ${newDate}`,
      module: 'raw', halaman: 'Outstanding', proyek: row.proyek || '', panel: row.panel || '',
    })
  }

  const doReschedule = async (row: any, newDate: string) => {
    if (newDate < TODAY) { alert('Gak bisa jadwalkan ke tanggal yang sudah lewat.'); return }
    if (newDate === row.tanggal) { setEditingKey(null); return }
    setBusy(true)
    try {
      if (isOrang) {
        const m = row.token?.match(/^__wiring_(\d+)org_/)
        const orangDibutuhkan = m ? parseInt(m[1], 10) : 1
        const cek = await checkKuotaOrangDanKomponenSwap({ tanggal: newDate, jenisPekerjaan: subProses, orangDibutuhkan, excludeRawId: row.rawId, excludeWp: row.wp })
        if (!cek.cukup) {
          if (cek.opsiSwap?.length > 0) {
            setSwapModal({ tipe: 'orang', tanggal: newDate, row, orangDibutuhkan, ...cek })
            setSwapSelected([])
            setBusy(false); return
          }
          alert(`Kuota orang ${subProses} tanggal ${newDate} tidak cukup dan tidak ada komponen lain yang bisa ditukar.\n${cek.error || ''}`)
          setBusy(false); return
        }
      } else {
        const panel = panelMap[row.panelId]
        const qtyProsesSelesai = panel?.checklist?.[row.kode]?.qtyProses?.[subProses] || 0
        const qtySisa = Math.max(0, (row.qty || 0) - qtyProsesSelesai)
        const menitPcs = getMenitPerPcs(row.tipe, subProses, row.kode)
        const menitDibutuhkan = qtySisa * menitPcs
        if (menitPcs > 0 && menitDibutuhkan > 0) {
          const cek = await checkKapasitasDanKomponenSwapV2({ tanggal: newDate, jenisPekerjaan: subProses, menitDibutuhkan, excludeRawId: row.rawId, excludeWp: row.wp })
          if (!cek.cukup) {
            if (cek.opsiSwap?.length > 0) {
              setSwapModal({ tipe: 'menit', tanggal: newDate, row, menitDibutuhkan, ...cek })
              setSwapSelected([])
              setBusy(false); return
            }
            alert(`Kapasitas ${subProses} tanggal ${newDate} sudah penuh dan tidak ada komponen lain yang bisa ditukar.\n${cek.error || ''}`)
            setBusy(false); return
          }
        }
      }
      await tulisReschedule(row, newDate)
      setEditingKey(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmSwap = async () => {
    if (!swapModal) return
    setBusy(true)
    try {
      const selected = (swapModal.opsiSwap || []).filter((o: any) => swapSelected.includes(`${o.raw_id}_${o.wp}_${o.kode_komponen}`))
      if (selected.length === 0) { setBusy(false); return }
      if (swapModal.tipe === 'orang') {
        const items = selected.map((o: any) => ({ raw_id: o.raw_id, wp: o.wp, kode_komponen: o.kode_komponen, jumlah_orang: o.jumlah_orang }))
        await executeSwapKomponenOrang({ items, jenisPekerjaan: subProses, tanggalAsal: swapModal.tanggal })
      } else {
        const items = selected.map((o: any) => ({ raw_id: o.raw_id, wp: o.wp, kode_komponen: o.kode_komponen, total_menit: o.total_menit }))
        await executeSwapKomponenV2({ items, jenisPekerjaan: subProses, tanggalAsal: swapModal.tanggal })
      }
      if (refetchRaw) await refetchRaw()
      const rowToRetry = swapModal.row
      const targetDate = swapModal.tanggal
      setSwapModal(null); setSwapSelected([])
      await tulisReschedule(rowToRetry, targetDate)
      setEditingKey(null)
    } catch (err: any) {
      alert('Gagal tukar jadwal: ' + err.message)
    }
    setBusy(false)
  }

  const cellStyle: any = { padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#374151' }
  const thStyle: any = { padding: '7px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .3, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }

  const renderTable = (title: string, color: string, list: any[]) => (
    <div style={{ flex: 1, minWidth: 380, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: color + '12', borderBottom: `2px solid ${color}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 12.5, color, textTransform: 'uppercase' as const, letterSpacing: .3 }}>{title} {subProses}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: '#fff', borderRadius: 20, padding: '2px 9px' }}>{list.length}</span>
      </div>
      <div style={{ maxHeight: 560, overflowY: 'auto' as const }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead style={{ position: 'sticky' as const, top: 0, background: '#f8fafc', zIndex: 1 }}>
            <tr>
              <th style={thStyle}>Proyek</th>
              <th style={thStyle}>Nama Panel</th>
              <th style={thStyle}>WP</th>
              <th style={thStyle}>Nama Komponen</th>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} style={{ ...cellStyle, textAlign: 'center' as const, color: '#cbd5e1', padding: 24, fontStyle: 'italic' as const }}>Tidak ada komponen</td></tr>
            ) : list.map((row: any) => (
              <tr key={row.key}>
                <td style={cellStyle}>{row.proyek}</td>
                <td style={cellStyle}>{row.panel}</td>
                <td style={cellStyle}><Badge2 wp={row.wp} /></td>
                <td style={cellStyle}>{row.nama}</td>
                <td style={cellStyle}>{row.qty || '–'}</td>
                <td style={cellStyle}>
                  {editingKey === row.key ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="date" autoFocus value={tglInput} min={TODAY} disabled={busy}
                        onChange={(e: any) => setTglInput(e.target.value)}
                        style={{ padding: '3px 6px', borderRadius: 6, border: '1.5px solid #2563eb', fontSize: 11.5 }} />
                      <button disabled={busy} onClick={() => doReschedule(row, tglInput)}
                        style={{ border: 'none', background: '#16a34a', color: '#fff', borderRadius: 6, padding: '4px 7px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 11 }}>✓</button>
                      <button disabled={busy} onClick={() => setEditingKey(null)}
                        style={{ border: 'none', background: '#f1f5f9', color: '#64748b', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingKey(row.key); setTglInput(row.tanggal < TODAY ? TODAY : row.tanggal) }}
                      style={{ border: '1px dashed #cbd5e1', background: '#f8fafc', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11.5, color: '#475569', fontWeight: 600 }}>
                      {row.tanggal ? row.tanggal : 'Belum Dijadwalkan'} <i className="ti ti-pencil" style={{ fontSize: 10, marginLeft: 3 }} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' as const, paddingBottom: 4 }}>
        {SUBTAB_OUTSTANDING.map((pr: string) => {
          const pc = PROSES_COLOR[pr] || '#64748b'
          const active = subProses === pr
          return (
            <button key={pr} onClick={() => { setSubProses(pr); setEditingKey(null) }}
              style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? pc : '#e2e8f0'}`, background: active ? pc : '#fff',
                color: active ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' as const }}>
              {pr}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ position: 'relative' as const }}>
          <button onClick={() => setProyekDropdownOpen(!proyekDropdownOpen)} style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {filterProyek.length === 0 ? 'Semua Proyek' : `${filterProyek.length} Proyek dipilih`}
            <span style={{ fontSize: 9 }}>▾</span>
          </button>
          {proyekDropdownOpen && (
            <>
              <div onClick={() => setProyekDropdownOpen(false)} style={{ position: 'fixed' as const, inset: 0, zIndex: 998 }} />
              <div style={{ position: 'absolute' as const, top: '110%', left: 0, zIndex: 999, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, minWidth: 200, maxHeight: 280, overflowY: 'auto' as const }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                  <input type="checkbox" checked={filterProyek.length === 0} onChange={() => { setFilterProyek([]); setFilterPanel([]) }} />
                  Semua Proyek
                </label>
                {[...new Set(rawData.filter((r: any) => r.proses === subProses).map((r: any) => r.proyek))].map((p: any) => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={filterProyek.includes(p)} onChange={() => toggleFilterProyek(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ position: 'relative' as const }}>
          <button onClick={() => setPanelDropdownOpen(!panelDropdownOpen)} style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 260 }}>
            {filterPanel.length === 0 ? 'Semua Panel' : `${filterPanel.length} Panel dipilih`}
            <span style={{ fontSize: 9 }}>▾</span>
          </button>
          {panelDropdownOpen && (
            <>
              <div onClick={() => setPanelDropdownOpen(false)} style={{ position: 'fixed' as const, inset: 0, zIndex: 998 }} />
              <div style={{ position: 'absolute' as const, top: '110%', left: 0, zIndex: 999, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, minWidth: 220, maxHeight: 280, overflowY: 'auto' as const }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                  <input type="checkbox" checked={filterPanel.length === 0} onChange={() => setFilterPanel([])} />
                  Semua Panel
                </label>
                {[...new Set(rawData.filter((r: any) => r.proses === subProses && (filterProyek.length === 0 || filterProyek.includes(r.proyek))).map((r: any) => r.panel))].map((p: any) => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={filterPanel.includes(p)} onChange={() => toggleFilterPanel(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        {(filterProyek.length > 0 || filterPanel.length > 0) && (
          <button onClick={() => { setFilterProyek([]); setFilterPanel([]) }} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✕ Reset</button>
        )}
      </div>

      <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="🔍 Cari proyek, panel, atau nama komponen..."
        style={{ width: '100%', maxWidth: 360, height: 34, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, marginBottom: 14, outline: 'none' }} />

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' as const }}>
        {renderTable('To Do', '#dc2626', todo)}
        {renderTable('In Progress', '#ea580c', inProgress)}
      </div>

      {swapModal && (
        <Modal title="Kapasitas Penuh - Pilih yang Ditukar" onClose={() => { setSwapModal(null); setSwapSelected([]) }} width={640}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            {swapModal.tipe === 'orang'
              ? `Kuota orang ${subProses} tanggal ${swapModal.tanggal} tidak cukup (butuh ${swapModal.orangDibutuhkan}, sisa ${swapModal.sisaKuota}). Pilih komponen lain yang boleh digeser buat kasih tempat:`
              : `Kapasitas ${subProses} tanggal ${swapModal.tanggal} tidak cukup (butuh ${swapModal.menitDibutuhkan} menit, sisa ${swapModal.sisaKapasitas} menit). Pilih komponen lain yang boleh digeser buat kasih tempat:`}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 16 }}>
            {(swapModal.opsiSwap || []).map((o: any) => {
              const id = `${o.raw_id}_${o.wp}_${o.kode_komponen}`
              const checked = swapSelected.includes(id)
              return (
                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${checked ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', background: checked ? '#eff6ff' : '#fff' }}>
                  <input type="checkbox" checked={checked} onChange={() => setSwapSelected((prev) => checked ? prev.filter((x) => x !== id) : [...prev, id])} />
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <b>{o.nama_komponen}</b> ({o.kode_komponen}) · {o.panel_nama} · WP {o.wp}
                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>WO {o.wo_number} · target {o.wo_target} · progress {o.progress}% · {swapModal.tipe === 'orang' ? `${o.jumlah_orang} orang` : `${o.total_menit} menit`}</div>
                  </div>
                </label>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setSwapModal(null); setSwapSelected([]) }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
            <button disabled={swapSelected.length === 0 || busy} onClick={confirmSwap}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: swapSelected.length === 0 ? '#94a3b8' : '#16a34a', color: '#fff', fontWeight: 700, cursor: swapSelected.length === 0 ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Memproses...' : `Tukar & Jadwalkan (${swapSelected.length})`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Badge2({ wp }: { wp: string }) {
  return <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>{wp}</span>
}
