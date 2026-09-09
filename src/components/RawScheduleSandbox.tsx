import { useState, useMemo } from 'react'
import { PANEL_TYPES, ALL_PROSES, PRIORITAS, PROSES_COLOR, PRIORITAS_COLOR, PROSES_ORANG_RAW_GLOBAL } from '../constants/panelTypes'
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
// SENGAJA DISEDERHANAKAN dari RawSchedule.tsx asli (2804 baris, context-menu/modal assign/
// kalkulasi kapasitas wiring real) - sandbox ini cuma buat menguji IDE TATA LETAK
// baris/kolomnya, bukan replikasi interaksi penuh.
//
// INTERAKSI (9 Sep 2026, revisi) - badge yang sudah dipilih SENGAJA "disabled" (klik badge
// itu sendiri gak ngapa-ngapain, biar gak kehapus gak sengaja) - jalur eksplisit terpisah:
// klik "+" buka popover tambah proses BARU (yang sudah ada gak muncul lagi di daftar), klik
// ✓ di badge buat tandai selesai, klik × di badge buat hapus. Badge bisa di-drag (native
// HTML5 DnD, sama pola RawSchedule.tsx asli - project ini emang gak punya library dnd) ke
// tanggal lain DI BARIS/KOMPONEN YANG SAMA. Tombol "Simulasikan Hari Berikutnya" majuin
// virtual clock (`virtualToday`, terpisah dari TODAY asli) 1 hari - badge yang PERSIS di
// virtualToday & belum ditandai selesai ikut maju 1 hari (auto-geser).
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

// Panel FS & WM LENGKAP (9 Sep 2026) - user mau lihat SEBERAPA PANJANG tabel kalau 1 panel
// ditampilkan dengan SEMUA komponennya (bukan cuma 2 contoh kayak sebelumnya). Diambil
// programatik dari PANEL_TYPES.FS/WM_MS (constants/panelTypes.ts) - SUMBER YANG SAMA
// PERSIS dipakai Raw Schedule/Manajemen WO asli buat daftar komponen per tipe panel, jadi
// kode & nama komponen dijamin "sesuai database" (bukan diketik ulang manual, gak akan
// ketinggalan/salah ketik kalau daftar komponennya nanti diubah di panelTypes.ts).
const buildPanelRows = (tipe: 'FS' | 'WM_MS', startId: number, proyek: string, panel: string, prioritas: string): DummyRow[] => {
  const items = (PANEL_TYPES as any)[tipe].wps.flatMap((wp: any) => wp.items) as { kode: string, nama: string }[]
  return items.map((it, idx) => ({
    id: startId + idx, proyek, panel, komponen: `${it.kode} - ${it.nama}`, prioritas,
    // Cuma beberapa komponen pertama dikasih contoh jadwal (biar gak 100% kosong pas
    // dibuka) - sisanya sengaja kosong, sama kayak kondisi panel yang baru mulai dikerjakan.
    schedule: idx === 0 ? { [TODAY]: ['POTONG', 'BENDING'] } : idx === 1 ? { [TODAY]: ['POTONG'] } : idx === 2 ? { [addDays(TODAY, 1)]: ['RENDAM', 'PAINTING'] } : {},
  }))
}
const FS_ROWS = buildPanelRows('FS', 100, 'SAKO KIDS SUKABUMI', 'FS-1', 'Tinggi') // FS.1-FS.24 (24 komponen)
const WM_ROWS = buildPanelRows('WM_MS', 200, 'MITRA10 BEKASI', 'WM-1', 'Sedang') // WM.1-WM.10 (10 komponen)
DUMMY_SEED.push(...FS_ROWS, ...WM_ROWS)

// Kapasitas dummy tetap per proses (bukan dari tabel fcs_kapasitas_harian asli - sandbox
// gak punya modal "Atur Kapasitas") - cuma buat nunjukkin FORMAT tampilan "terpakai/kapasitas
// satuan" yang sama persis kayak Raw Schedule asli, angkanya ilustratif.
const KAPASITAS_DUMMY: Record<string, number> = {
  POTONG: 384, BENDING: 384, STEL: 384, FINISHING: 384, PAINTING: 480, RENDAM: 480,
  RAKIT: 384, 'PASANG KOMPONEN': 384, BUSBAR: 300, 'QC TEST': 240, PACKING: 240,
  'WIRING CONTROL': 6, 'WIRING POWER': 6,
}
// Menit ilustratif per 1 entri terjadwal (bukan qty x menit/pcs asli yang butuh data
// checklist real) - cukup buat nunjukkin bar bergerak isi sesuai jumlah entri per hari.
const MENIT_PER_ENTRI_DUMMY = 45

const HARI_SEBELUM_WEEKSTART = 3

export function RawScheduleSandbox() {
  const [weekStart, setWeekStart] = useState(TODAY)
  const [rows, setRows] = useState<DummyRow[]>(DUMMY_SEED)
  const [filterProses, setFilterProses] = useState<string[]>([])
  const [capacityCollapsed, setCapacityCollapsed] = useState(false)
  const [cellPicker, setCellPicker] = useState<{ rowId: number, date: string } | null>(null)

  // BADGE DISABLED + DRAG&DROP + AUTO-GESER (9 Sep 2026) - 3 state baru:
  // - selesaiMap: badge yang ditandai selesai (key "rowId::date::proses") DIKECUALIKAN dari
  //   auto-geser & ditampilkan pudar - status ini IKUT PINDAH kalau badge-nya di-drag (lihat
  //   handleDrop), bukan nempel ke tanggal.
  // - dragging/dragOverCell: drag native HTML5 (bukan library - project ini emang gak punya
  //   dependency dnd, RawSchedule.tsx asli sendiri pakai native API persis kayak ini).
  // - virtualToday: "hari acuan" simulasi, TERPISAH dari TODAY asli - biar auto-geser bisa
  //   didemonstrasikan tanpa nunggu hari beneran berganti.
  const [selesaiMap, setSelesaiMap] = useState<Record<string, boolean>>({})
  const [dragging, setDragging] = useState<{ rowId: number, date: string, proses: string } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{ rowId: number, date: string } | null>(null)
  const [virtualToday, setVirtualToday] = useState(TODAY)

  const days = useMemo(() => Array.from({ length: 20 }, (_, i) => addDays(weekStart, i - HARI_SEBELUM_WEEKSTART)), [weekStart])
  const isSunday = (d: string) => new Date(d).getDay() === 0
  const keyOf = (rowId: number, date: string, proses: string) => `${rowId}::${date}::${proses}`

  const toggleFilterProses = (p: string) => setFilterProses(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  // Popover "+ Tambah Proses" cuma NAMBAH (proses yang sudah ada gak muncul di daftar ini
  // lagi, jadi gak bisa "kehapus" gak sengaja lewat sini) - beda dari toggleProsesDiCell lama.
  const addProsesKeCell = (rowId: number, date: string, proses: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const current = r.schedule[date] || []
      if (current.includes(proses)) return r
      return { ...r, schedule: { ...r.schedule, [date]: [...current, proses] } }
    }))
    setCellPicker(null)
  }

  // Hapus badge - SATU-SATUNYA jalur hapus sekarang (klik × di badge, bukan lagi klik cell).
  const hapusProsesDariCell = (rowId: number, date: string, proses: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      return { ...r, schedule: { ...r.schedule, [date]: (r.schedule[date] || []).filter(p => p !== proses) } }
    }))
    setSelesaiMap(prev => { const next = { ...prev }; delete next[keyOf(rowId, date, proses)]; return next })
  }

  const toggleSelesai = (rowId: number, date: string, proses: string) => {
    const k = keyOf(rowId, date, proses)
    setSelesaiMap(prev => ({ ...prev, [k]: !prev[k] }))
  }

  const handleDrop = (targetRowId: number, targetDate: string) => {
    if (dragging && dragging.rowId === targetRowId && dragging.date !== targetDate) {
      setRows(prev => prev.map(r => {
        if (r.id !== targetRowId) return r
        const fromList = (r.schedule[dragging.date] || []).filter(p => p !== dragging.proses)
        const toList = (r.schedule[targetDate] || []).includes(dragging.proses) ? (r.schedule[targetDate] || []) : [...(r.schedule[targetDate] || []), dragging.proses]
        return { ...r, schedule: { ...r.schedule, [dragging.date]: fromList, [targetDate]: toList } }
      }))
      // Status selesai IKUT ke tanggal baru (badge yang sama, cuma pindah tempat).
      const oldKey = keyOf(targetRowId, dragging.date, dragging.proses)
      const newKey = keyOf(targetRowId, targetDate, dragging.proses)
      setSelesaiMap(prev => {
        if (!(oldKey in prev)) return prev
        const next = { ...prev }; const val = next[oldKey]; delete next[oldKey]; next[newKey] = val; return next
      })
    }
    setDragging(null)
    setDragOverCell(null)
  }

  // Auto-geser: badge yang PERSIS di virtualToday & belum ditandai selesai maju 1 hari -
  // setiap klik tombol = 1 hari berlalu, badge cuma maju 1 langkah (bukan loncat jauh).
  const simulasikanHariBerikutnya = () => {
    const dariTanggal = virtualToday
    const keTanggal = addDays(virtualToday, 1)
    setRows(prev => prev.map(r => {
      const entriesHariIni = r.schedule[dariTanggal] || []
      const belumSelesai = entriesHariIni.filter(p => !selesaiMap[keyOf(r.id, dariTanggal, p)])
      if (belumSelesai.length === 0) return r
      const tetapDiSini = entriesHariIni.filter(p => selesaiMap[keyOf(r.id, dariTanggal, p)])
      const tujuanBaru = [...(r.schedule[keTanggal] || [])]
      belumSelesai.forEach(p => { if (!tujuanBaru.includes(p)) tujuanBaru.push(p) })
      return { ...r, schedule: { ...r.schedule, [dariTanggal]: tetapDiSini, [keTanggal]: tujuanBaru } }
    }))
    // Status selesai proses yg TETAP di dariTanggal gak perlu dipindah (key tanggalnya gak
    // berubah); yang ikut geser dijamin belum-selesai jadi gak ada entri selesaiMap buat dihapus.
    setVirtualToday(keTanggal)
  }

  const resetSimulasi = () => { setRows(DUMMY_SEED); setSelesaiMap({}); setVirtualToday(TODAY) }

  const visibleRows = rows.filter(r => filterProses.length === 0 || (Object.values(r.schedule).some(list => list.some(p => filterProses.includes(p)))))

  // Capacity Utilization - format PERSIS ditiru dari RawSchedule.tsx asli (kartu per hari,
  // baris per proses, "{terpakai}/{kapasitas} {satuan}" + progress bar) - cuma sumber
  // datanya dummy lokal (`rows`), bukan Supabase/fcs_kapasitas_harian. WIRING CONTROL/
  // POWER pakai satuan "orang" (1 entri = 1 orang, ilustratif), proses lain "mnt" (1
  // entri = MENIT_PER_ENTRI_DUMMY menit, ilustratif juga - lihat komentar konstanta di atas).
  const hitungTerpakai = (pr: string, d: string): number => {
    const isOrangPr = PROSES_ORANG_RAW_GLOBAL.includes(pr)
    let jumlahEntri = 0
    rows.forEach(r => { if ((r.schedule[d] || []).includes(pr)) jumlahEntri++ })
    return isOrangPr ? jumlahEntri : jumlahEntri * MENIT_PER_ENTRI_DUMMY
  }

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
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Klik "+" di kotak tanggal buat tambah proses. Badge yang sudah ada bisa di-drag pindah tanggal (baris sama), klik ✓ tandai selesai, klik × hapus.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>‹ Minggu Lalu</button>
          <button onClick={() => setWeekStart(TODAY)} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '0.5px solid #3b5bdb', background: weekStart === TODAY ? '#eff3ff' : '#fff', color: '#3b5bdb', cursor: 'pointer', fontSize: 11, fontWeight: 500, fontFamily: 'inherit' }}>Hari Ini</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Minggu Depan ›</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>🕐 Simulasi Auto-Geser — hari acuan sekarang: <strong>{getDayLabel(virtualToday)}</strong>{virtualToday === TODAY ? ' (= Hari Ini)' : ''}</span>
        <button onClick={simulasikanHariBerikutnya} style={{ height: 26, padding: '0 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Simulasikan Hari Berikutnya</button>
        <button onClick={resetSimulasi} style={{ height: 26, padding: '0 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#fff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>↺ Reset Simulasi</button>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {days.slice(0, 7).map(d => {
              const prosesToShow = filterProses.length === 0 ? ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'PAINTING', 'WIRING CONTROL', 'WIRING POWER'] : filterProses
              const perProses = prosesToShow.map(pr => {
                const isOrangPr = PROSES_ORANG_RAW_GLOBAL.includes(pr)
                const terpakai = hitungTerpakai(pr, d)
                const kapasitas = KAPASITAS_DUMMY[pr] || (isOrangPr ? 6 : 384)
                return { nama: pr, terpakai, kapasitas, satuan: isOrangPr ? 'orang' : 'mnt' }
              })
              return (
                <div key={d} style={{ background: 'var(--card-bg,#fff)', border: '1px solid #e2e8f030', borderRadius: 8, padding: '8px 12px', minWidth: 130, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{getDayLabel(d)}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }}>
                    {perProses.map(pp => {
                      const pctPr = pp.kapasitas > 0 ? Math.min(Math.round((pp.terpakai / pp.kapasitas) * 100), 100) : 0
                      const colorPr = pctPr >= 95 ? '#dc2626' : pctPr >= 80 ? '#f59e0b' : '#16a34a'
                      return (
                        <div key={pp.nama}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 9, marginBottom: 2 }}>
                            <span style={{ color: '#64748b' }}>{pp.nama}</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{pp.satuan === 'orang' ? Number(pp.terpakai.toFixed(1)) : Math.round(pp.terpakai)}/{pp.kapasitas} {pp.satuan}</span>
                          </div>
                          <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: pctPr + '%', height: '100%', background: colorPr, borderRadius: 99 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
                <th key={d} style={{ ...thS, minWidth: 120, background: d === TODAY ? '#1e40af' : isSunday(d) ? '#7f1d1d' : '#1e3a8a', borderBottom: d === TODAY ? '2px solid #60a5fa' : d === virtualToday ? '2px dashed #93c5fd' : 'none' }}>
                  <div>{getDayLabel(d)}</div>
                  {d === TODAY && <div style={{ fontSize: 9, opacity: .7 }}>Hari Ini</div>}
                  {d === virtualToday && d !== TODAY && <div style={{ fontSize: 9, opacity: .7 }}>🕐 Acuan Simulasi</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => {
              const priColor = (PRIORITAS_COLOR as any)[row.prioritas] || '#64748b'
              const rBg = ri % 2 === 0 ? '#fff' : '#f8fafc'
              const td = { borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', background: rBg, padding: '2px 4px', verticalAlign: 'middle' as const }
              // Satu komponen (baris) gak boleh punya proses yang sama terpasang di 2 tanggal
              // sekaligus (9 Sep 2026, revisi) - dihitung LINTAS SEMUA TANGGAL pada baris ini,
              // bukan per-cell, dipakai buat nge-disable opsi di dropdown tanggal MANAPUN pada
              // baris ini kalau proses itu sudah dipakai di tanggal lain. "Dipakai" ditentukan
              // langsung dari isi row.schedule (bukan flag terpisah) - begitu badge dipindah
              // lewat drag, status ini otomatis ikut pindah, gak akan pernah dobel.
              const prosesDipakaiBaris: Record<string, string> = {}
              Object.entries(row.schedule).forEach(([tgl, list]) => list.forEach(p => { if (!(p in prosesDipakaiBaris)) prosesDipakaiBaris[p] = tgl }))
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
                    const isDragOver = dragOverCell?.rowId === row.id && dragOverCell?.date === d
                    return (
                      <td key={d}
                        onDragOver={(e: any) => { if (dragging && dragging.rowId === row.id && dragging.date !== d) { e.preventDefault(); setDragOverCell({ rowId: row.id, date: d }) } }}
                        onDragLeave={() => setDragOverCell(prev => (prev?.rowId === row.id && prev?.date === d) ? null : prev)}
                        onDrop={(e: any) => { e.preventDefault(); handleDrop(row.id, d) }}
                        style={{ ...td, textAlign: 'center', padding: '2px', position: 'relative', background: isDragOver ? '#dbeafe' : d === TODAY ? '#eff6ff' : isSunday(d) ? '#fff1f2' : rBg, outline: isDragOver ? '2px dashed #2563eb' : 'none' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', alignItems: 'center', padding: '3px', minHeight: 26 }}>
                          {entries.map(p => {
                            const pc = (PROSES_COLOR as any)[p] || '#64748b'
                            const isSelesai = !!selesaiMap[keyOf(row.id, d, p)]
                            return (
                              <span key={p} draggable
                                onDragStart={(e: any) => { e.stopPropagation(); setDragging({ rowId: row.id, date: d, proses: p }) }}
                                onDragEnd={() => { setDragging(null); setDragOverCell(null) }}
                                title="Drag buat pindah tanggal (baris/komponen yang sama)"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: isSelesai ? '#94a3b8' : pc, color: '#fff', borderRadius: 3, padding: '1px 3px 1px 5px', fontSize: 9, fontWeight: 700, cursor: 'grab', opacity: isSelesai ? 0.6 : 1 }}>
                                {p}
                                <button onClick={(e: any) => { e.stopPropagation(); toggleSelesai(row.id, d, p) }}
                                  title={isSelesai ? 'Batalkan tanda selesai' : 'Tandai selesai (dikecualikan dari auto-geser)'}
                                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 1px', fontSize: 9, lineHeight: 1 }}>✓</button>
                                <button onClick={(e: any) => { e.stopPropagation(); hapusProsesDariCell(row.id, d, p) }}
                                  title="Hapus"
                                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 1px', fontSize: 9, lineHeight: 1 }}>×</button>
                              </span>
                            )
                          })}
                          <button onClick={(e: any) => { e.stopPropagation(); setCellPicker(isPickerOpen ? null : { rowId: row.id, date: d }) }}
                            title="Tambah proses"
                            style={{ width: entries.length > 0 ? 16 : '100%', minHeight: entries.length > 0 ? 16 : 26, borderRadius: 6, border: '1px dashed #e2e8f0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: entries.length > 0 ? 10 : 14, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
                        </div>
                        {isPickerOpen && (
                          <>
                            <div onClick={(e: any) => { e.stopPropagation(); setCellPicker(null) }} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                            <div onClick={(e: any) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 999, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, minWidth: 180, textAlign: 'left' }}>
                              {ALL_PROSES.map(pr => {
                                const tglDipakai = prosesDipakaiBaris[pr]
                                const isDisabled = !!tglDipakai
                                return (
                                  <div key={pr} onClick={() => { if (!isDisabled) addProsesKeCell(row.id, d, pr) }}
                                    title={isDisabled ? `Sudah dipakai di ${getDayLabel(tglDipakai)} - drag badge-nya kalau mau pindah ke sini` : undefined}
                                    style={{ padding: '5px 6px', borderRadius: 5, cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: 11, color: isDisabled ? '#cbd5e1' : '#1e293b', display: 'flex', justifyContent: 'space-between', gap: 8 }}
                                    onMouseEnter={(e: any) => { if (!isDisabled) e.currentTarget.style.background = '#f1f5f9' }} onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}>
                                    <span>{pr}</span>
                                    {isDisabled && <span style={{ fontSize: 9, color: '#cbd5e1' }}>terpakai {getDayLabel(tglDipakai)}</span>}
                                  </div>
                                )
                              })}
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
