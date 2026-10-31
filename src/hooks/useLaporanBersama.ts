// SINKRONISASI LAPORAN OUTSTANDING BERSAMA (S1, 31 Okt 2026). Satu laporan per tanggal utk semua admin; edit per bagian.
// Aturan (keputusan user 31 Okt): terakhir menang per bagian, tanpa kunci, ada peringatan & riwayat; TEKS YANG SEDANG
// DIKETIK TIDAK BOLEH TERTIMPA / LONCAT KURSOR:
// - bagian yang sedang difokus (atribut data-b pada pembungkus kolom) & bagian yang diubah lokal tapi belum tersimpan
//   TIDAK diganti data server saat realtime masuk; bila admin lain mengubahnya -> `peringatan[id]` ("X baru mengubah ...").
//   Saat fokus lepas, bagian yang tidak diubah lokal mengikuti versi server terbaru; yang diubah lokal disimpan (terakhir menang).
// - simpan otomatis 1,2 dtk sesudah berhenti mengetik & saat fokus lepas; gagal -> dicoba lagi tiap 5 dtk; perubahan yang
//   belum tersimpan dicadangkan di sessionStorage (muat ulang halaman tidak menghilangkannya).
// - data dimuat ulang lewat pasangPemulihRealtime (realtime + sambung ulang + fokus/online + polling).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { datarkan, susunDraf, bedakan, idBerubah, barisKeDatar, sama, tanpaKunci, loSimpan, loUbahHeader, muatLaporanTanggal,
  type Datar, type HeaderLO, type Meta, type BagianLO } from '../lib/laporanOutstandingBersama'
import type { DrafLaporan } from '../lib/laporanOutstanding'

export type StatusSimpan = 'tersimpan' | 'menunggu' | 'menyimpan' | 'gagal'
export type Peringatan = { oleh: string | null; waktu: string | null; sudahTersimpan?: boolean }
export const ID_TEKS_WA = '__teks_wa', ID_HEADER = '__header'
const JEDA_SIMPAN = 1200, ULANG_GAGAL = 5000
const kunciTertunda = (tanggal: string) => `vt_lo_tertunda:${tanggal}`

export function useLaporanBersama(db: any, user: any, tanggal: string) {
  const nama = String(user?.nama || user?.name || '').trim()
  const [header, setHeader] = useState<HeaderLO | null>(null)
  const [draf, setDrafState] = useState<DrafLaporan | null>(null)
  const [teksWa, setTeksWaState] = useState<string | null>(null)       // teks WA bersama (null = ikut susunan)
  const [memuat, setMemuat] = useState(true)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusSimpan>('tersimpan')
  const [galatSimpan, setGalatSimpan] = useState('')
  const [peringatan, setPeringatan] = useState<Record<string, Peringatan>>({})
  const [pemberitahuan, setPemberitahuan] = useState<string[]>([])

  const drafRef = useRef<DrafLaporan | null>(null), teksWaRef = useRef<string | null>(null)
  const dasar = useRef<Datar>(new Map()), meta = useRef<Map<string, Meta>>(new Map()), headerSrv = useRef<HeaderLO | null>(null)
  const diubah = useRef<Set<string>>(new Set()), headerDiubah = useRef<Set<string>>(new Set())
  const fokus = useRef<string | null>(null), terakhirSrv = useRef<{ h: HeaderLO; rows: BagianLO[] } | null>(null)
  const menyimpan = useRef(false), lagi = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tanggalRef = useRef(tanggal), tertundaDipakai = useRef(false)
  // hasil simpan kita yang belum terlihat di data server yang masuk (muatan lama yang datang belakangan): id -> 'ada' | 'hapus'
  const tungguSrv = useRef<Map<string, { jenis: 'ada' | 'hapus'; sejak: number }>>(new Map())

  const setDraf = (d: DrafLaporan | null) => { drafRef.current = d; setDrafState(d) }
  const beritahu = (t: string) => setPemberitahuan((p) => [...p.slice(-4), t])
  const cadangkan = () => {
    try {
      const k = kunciTertunda(tanggalRef.current)
      if (!diubah.current.size && !headerDiubah.current.size) { sessionStorage.removeItem(k); return }
      const lok = drafRef.current ? datarkan(drafRef.current) : new Map()
      const d = drafRef.current
      sessionStorage.setItem(k, JSON.stringify({
        laporanId: headerSrv.current?.id, item: Object.fromEntries([...diubah.current].map((id) => [id, lok.get(id) ?? null])),
        header: Object.fromEntries([...headerDiubah.current].map((h) => [h, h === 'teks_wa' ? teksWaRef.current : h === 'jam' ? d?.jam : d?.tampilTeratasi !== false])),
      }))
    } catch { /* storage diblokir/penuh: perubahan tetap di layar & terus dicoba simpan */ }
  }

  // ── terapkan data server ke layar (dengan perlindungan) ──
  const terapkan = useCallback((h: HeaderLO, rows: BagianLO[]) => {
    terakhirSrv.current = { h, rows }
    const srv = barisKeDatar(rows)
    const lok = drafRef.current ? datarkan(drafRef.current) : null
    // cadangan sessionStorage (sekali per tanggal): perubahan yang belum tersimpan sebelum halaman dimuat ulang
    if (!tertundaDipakai.current) {
      tertundaDipakai.current = true
      try {
        const t = JSON.parse(sessionStorage.getItem(kunciTertunda(h.tanggal)) || 'null')
        if (t && t.laporanId === h.id) {
          const basis = lok || new Map(srv)
          for (const [id, b] of Object.entries(t.item || {})) { if (b) basis.set(id, b as any); else basis.delete(id); diubah.current.add(id) }
          for (const k of Object.keys(t.header || {})) headerDiubah.current.add(k)
          drafRef.current = susunDraf({ tanggal: h.tanggal, jam: t.header?.jam ?? h.jam, varian: h.varian, tampil_teratasi: t.header?.tampil_teratasi ?? h.tampil_teratasi, disusun_pada: h.disusun_pada }, basis)
          if ('teks_wa' in (t.header || {})) teksWaRef.current = t.header.teks_wa
          beritahu('Perubahan yang belum tersimpan sebelum halaman dimuat ulang dipulihkan dan sedang disimpan.')
          setTimeout(() => simpanRef.current(), 300)
        }
      } catch { /* cadangan rusak: abaikan */ }
    }
    const lokal = drafRef.current ? datarkan(drafRef.current) : null
    const hasil = new Map(srv), metaBaru = new Map<string, Meta>(rows.map((r) => [r.id, { versi: r.versi, oleh: r.diperbarui_oleh, waktu: r.diperbarui_pada }]))
    const lindungi = new Set([...diubah.current, ...(fokus.current ? [fokus.current] : [])])
    const per: Record<string, Peringatan> = {}
    // muatan server LEBIH LAMA dari simpanan kita (diambil sebelum simpan selesai): versi lokal dipertahankan, tidak berkedip balik
    const kini = Date.now()
    for (const [id, t] of [...tungguSrv.current]) {
      const m0 = meta.current.get(id), m1 = metaBaru.get(id)
      const terlihat = t.jenis === 'hapus' ? !srv.has(id) : !!(m1 && m0 && m1.versi >= m0.versi)
      if (terlihat || kini - t.sejak > 60000) { tungguSrv.current.delete(id); continue }
      lindungi.add(id)
    }
    for (const [id, m1] of metaBaru) { const m0 = meta.current.get(id); if (m0 && m1.versi < m0.versi) lindungi.add(id) }
    for (const id of lindungi) {
      if (id.startsWith('__')) continue
      if (tungguSrv.current.get(id)?.jenis === 'hapus') { hasil.delete(id); continue }
      const m0 = meta.current.get(id), m1 = metaBaru.get(id)
      if (m0 && m1 && m1.versi > m0.versi && m1.oleh && m1.oleh !== nama && !sama(srv.get(id), dasar.current.get(id))) per[id] = { oleh: m1.oleh, waktu: m1.waktu }
      if (lokal?.has(id)) hasil.set(id, lokal.get(id)!); else if (diubah.current.has(id)) hasil.delete(id)
      if (m0 && (!m1 || m1.versi <= m0.versi || diubah.current.has(id) || fokus.current === id)) metaBaru.set(id, m0)   // versi dasar tetap yg dilihat saat mulai mengedit (server ikut memperingatkan)
    }
    dasar.current = srv; meta.current = metaBaru
    // header: kolom yang diubah lokal / teks WA yang sedang diketik dipertahankan
    const h0 = headerSrv.current, d0 = drafRef.current
    const lindungiWa = headerDiubah.current.has('teks_wa') || fokus.current === ID_TEKS_WA
    const lindungiHd = (k: string) => headerDiubah.current.has(k) || fokus.current === ID_HEADER
    if (h0 && h.versi > h0.versi && h.diperbarui_oleh && h.diperbarui_oleh !== nama) {
      if (lindungiWa && h.teks_wa !== h0.teks_wa) per[ID_TEKS_WA] = { oleh: h.diperbarui_oleh, waktu: h.diperbarui_pada }
      if ((lindungiHd('jam') && h.jam !== h0.jam) || (lindungiHd('tampil_teratasi') && h.tampil_teratasi !== h0.tampil_teratasi)) per[ID_HEADER] = { oleh: h.diperbarui_oleh, waktu: h.diperbarui_pada }
    }
    headerSrv.current = lindungiWa || lindungiHd('jam') || lindungiHd('tampil_teratasi') ? { ...h, versi: h0?.versi ?? h.versi } : h
    const d = susunDraf({ tanggal: h.tanggal, varian: h.varian, disusun_pada: h.disusun_pada,
      jam: lindungiHd('jam') && d0 ? d0.jam : h.jam, tampil_teratasi: lindungiHd('tampil_teratasi') && d0 ? d0.tampilTeratasi !== false : h.tampil_teratasi }, hasil)
    setDraf(d)
    if (!lindungiWa) { teksWaRef.current = h.teks_wa; setTeksWaState(h.teks_wa) } else setTeksWaState(teksWaRef.current)
    setHeader(h)
    if (Object.keys(per).length) setPeringatan((p) => ({ ...p, ...per }))
  }, [nama])

  const muat = useCallback(async () => {
    const tgl = tanggalRef.current
    try {
      const r = await muatLaporanTanggal(db, tgl)
      if (tgl !== tanggalRef.current) return
      if (!r.header) { headerSrv.current = null; dasar.current = new Map(); meta.current = new Map(); setHeader(null); setDraf(null); teksWaRef.current = null; setTeksWaState(null) }
      else terapkan(r.header, r.bagian)
      setGalatMuat(null)
    } catch (e: any) {
      console.error('[laporan outstanding] gagal memuat:', e); setGalatMuat('Gagal memuat laporan: ' + (e?.message || e))
    } finally { if (tgl === tanggalRef.current) setMemuat(false) }
  }, [db, terapkan])

  // ── simpan (terakhir menang per bagian) ──
  const simpanRef = useRef<() => Promise<void>>(async () => {})
  const simpan = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const h = headerSrv.current, d = drafRef.current
    if (!h || !d) return
    if (menyimpan.current) { lagi.current = true; return }
    const lok = datarkan(d), ids = new Set(diubah.current)
    const ops = bedakan(dasar.current, lok, ids).map((o) => (o.o === 'ubah' ? { ...o, versi_dasar: meta.current.get(o.id)?.versi } : o))
    const patch: Record<string, any> = {}
    if (headerDiubah.current.has('jam') && d.jam !== h.jam) patch.jam = d.jam
    if (headerDiubah.current.has('tampil_teratasi') && (d.tampilTeratasi !== false) !== h.tampil_teratasi) patch.tampil_teratasi = d.tampilTeratasi !== false
    if (headerDiubah.current.has('teks_wa') && teksWaRef.current !== h.teks_wa) patch.teks_wa = teksWaRef.current
    if (!ops.length && !Object.keys(patch).length) {
      ids.forEach((id) => { if (sama(datarkan(drafRef.current!).get(id), dasar.current.get(id))) diubah.current.delete(id) })
      headerDiubah.current.clear(); cadangkan(); setStatus(diubah.current.size ? 'menunggu' : 'tersimpan'); return
    }
    menyimpan.current = true; setStatus('menyimpan')
    try {
      if (ops.length) {
        const r = await loSimpan(db, user, h.id, ops)
        const kini = datarkan(drafRef.current!)
        for (const o of ops) {
          if (o.o === 'hapus') { dasar.current.delete(o.id); tungguSrv.current.set(o.id, { jenis: 'hapus', sejak: Date.now() }) }
          else { dasar.current.set(o.id, lok.get(o.id)!); meta.current.set(o.id, { versi: r.versi[o.id] ?? (meta.current.get(o.id)?.versi || 1), oleh: nama, waktu: new Date().toISOString() }); tungguSrv.current.set(o.id, { jenis: 'ada', sejak: Date.now() }) }
          if (sama(kini.get(o.id), lok.get(o.id))) diubah.current.delete(o.id)
        }
        ids.forEach((id) => { if (!ops.some((o) => o.id === id) && sama(kini.get(id), dasar.current.get(id))) diubah.current.delete(id) })
        if (r.peringatan?.length) setPeringatan((p) => ({ ...p, ...Object.fromEntries(r.peringatan.map((x) => [x.id, { oleh: x.oleh, waktu: x.waktu, sudahTersimpan: true }])) }))
        if (r.hilang?.length) {
          const hil = new Set(r.hilang.map((x) => x.id))
          const tanpa = new Map([...datarkan(drafRef.current!)].filter(([id, b]) => !hil.has(id) && !(b.induk_id && hil.has(b.induk_id))))
          hil.forEach((id) => diubah.current.delete(id))
          setDraf(susunDraf({ tanggal: h.tanggal, jam: drafRef.current!.jam, varian: h.varian, tampil_teratasi: drafRef.current!.tampilTeratasi !== false, disusun_pada: h.disusun_pada }, tanpa))
          beritahu(`${r.hilang.length} bagian yang Anda ubah sudah dihapus admin lain (${[...new Set(r.hilang.map((x) => x.oleh || '?'))].join(', ')}) - perubahan itu tidak disimpan; lihat Riwayat bila perlu dikembalikan.`)
        }
      }
      if (Object.keys(patch).length) {
        const r = await loUbahHeader(db, user, h.id, patch, headerSrv.current?.versi ?? null)
        headerSrv.current = r.laporan; setHeader(r.laporan)
        const dk = drafRef.current!
        if ('jam' in patch && dk.jam === patch.jam) headerDiubah.current.delete('jam')
        if ('tampil_teratasi' in patch && (dk.tampilTeratasi !== false) === patch.tampil_teratasi) headerDiubah.current.delete('tampil_teratasi')
        if ('teks_wa' in patch && teksWaRef.current === patch.teks_wa) headerDiubah.current.delete('teks_wa')
        if (r.peringatan) setPeringatan((p) => ({ ...p, [('teks_wa' in patch) ? ID_TEKS_WA : ID_HEADER]: { ...r.peringatan!, sudahTersimpan: true } }))
      } else headerDiubah.current.forEach((k) => {
        const dk = drafRef.current!
        if ((k === 'jam' && dk.jam === h.jam) || (k === 'tampil_teratasi' && (dk.tampilTeratasi !== false) === h.tampil_teratasi) || (k === 'teks_wa' && teksWaRef.current === h.teks_wa)) headerDiubah.current.delete(k)
      })
      setGalatSimpan(''); setStatus(diubah.current.size || headerDiubah.current.size ? 'menunggu' : 'tersimpan')
      if (diubah.current.size || headerDiubah.current.size) lagi.current = true
    } catch (e: any) {
      console.error('[laporan outstanding] simpan gagal:', e)
      setStatus('gagal'); setGalatSimpan((e?.message || String(e)) + ' - perubahan masih di layar, dicoba lagi otomatis.')
      timer.current = setTimeout(() => simpanRef.current(), ULANG_GAGAL)
    } finally {
      menyimpan.current = false; cadangkan()
      if (lagi.current) { lagi.current = false; timer.current = setTimeout(() => simpanRef.current(), 300) }
    }
  }, [db, user, nama])
  // ref "fungsi terbaru" (dipanggil dari timer & terapkan) - pola umum, bukan mutasi state
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { simpanRef.current = simpan }, [simpan])
  const jadwalkan = () => { if (timer.current) clearTimeout(timer.current); setStatus('menunggu'); timer.current = setTimeout(() => simpanRef.current(), JEDA_SIMPAN) }

  // ── ubah lokal (dipanggil semua kolom penyusun) ──
  const ubah = useCallback((f: (d: DrafLaporan) => DrafLaporan) => {
    const prev = drafRef.current; if (!prev) return
    const next = f(prev); if (next === prev) return
    idBerubah(datarkan(prev), datarkan(next)).forEach((id) => diubah.current.add(id))
    if (prev.jam !== next.jam) headerDiubah.current.add('jam')
    if ((prev.tampilTeratasi !== false) !== (next.tampilTeratasi !== false)) headerDiubah.current.add('tampil_teratasi')
    setDraf(next); cadangkan(); jadwalkan()
  }, [])
  const setTeksWa = useCallback((t: string | null) => { teksWaRef.current = t; setTeksWaState(t); headerDiubah.current.add('teks_wa'); cadangkan(); jadwalkan() }, [])

  // ── fokus: dipasang di pembungkus penyusun (onFocusCapture/onBlurCapture) ──
  // fokusBagian/lepasBagian juga dipanggil langsung oleh pratinjau berkop (fokus di dalam iframe tidak merambat ke sini)
  const fokusBagian = useCallback((id: string | null) => { fokus.current = id }, [])
  const lepasBagian = useCallback((keId: string | null) => {
    const lama = fokus.current
    if (keId && keId === lama) return            // pindah kolom di dalam bagian yang sama
    fokus.current = keId
    if (!lama) return
    setPeringatan((p) => (lama in p ? tanpaKunci(p, lama) as Record<string, Peringatan> : p))
    if (diubah.current.size || headerDiubah.current.size) simpanRef.current()
    if (terakhirSrv.current) terapkan(terakhirSrv.current.h, terakhirSrv.current.rows)   // bagian yang tadi dilindungi ikut versi server
  }, [terapkan])
  const idDari = (el: EventTarget | null) => ((el as HTMLElement | null)?.closest?.('[data-b]') as HTMLElement | null)?.dataset.b || null
  const onFokus = useCallback((e: React.FocusEvent) => fokusBagian(idDari(e.target)), [fokusBagian])
  const onLepas = useCallback((e: React.FocusEvent) => lepasBagian(idDari(e.relatedTarget)), [lepasBagian])

  // ── ganti tanggal / pasang realtime ──
  useEffect(() => {
    tanggalRef.current = tanggal; tertundaDipakai.current = false
    dasar.current = new Map(); meta.current = new Map(); headerSrv.current = null; diubah.current = new Set(); headerDiubah.current = new Set(); tungguSrv.current = new Map()
    fokus.current = null; terakhirSrv.current = null; drafRef.current = null
    const t = setTimeout(() => { setMemuat(true); setPeringatan({}); setDrafState(null); setHeader(null); muat() }, 0)
    return () => clearTimeout(t)
  }, [tanggal, muat])
  useEffect(() => pasangPemulihRealtime(db, {
    nama: 'laporan-outstanding-' + Math.random().toString(36).slice(2), label: 'Laporan Outstanding', jedaMs: 700, muat,
    tabel: ['laporan_outstanding', 'laporan_outstanding_bagian'],
  }), [db, muat])
  // simpan sebelum keluar halaman bila masih ada yang tertunda (cadangan sessionStorage tetap ada bila gagal)
  useEffect(() => { const f = () => { if (diubah.current.size || headerDiubah.current.size) simpanRef.current() }; window.addEventListener('pagehide', f); return () => window.removeEventListener('pagehide', f) }, [])

  const tutupPeringatan = (id: string) => setPeringatan((p) => tanpaKunci(p, id) as Record<string, Peringatan>)
  const tutupPemberitahuan = (i: number) => setPemberitahuan((p) => p.filter((_, k) => k !== i))
  const adaTertunda = () => diubah.current.size > 0 || headerDiubah.current.size > 0
  return { header, draf, teksWa, memuat, galatMuat, status, galatSimpan, peringatan, pemberitahuan, muat, simpan, ubah, setTeksWa,
    onFokus, onLepas, fokusBagian, lepasBagian, tutupPeringatan, tutupPemberitahuan, beritahu, adaTertunda, drafRef }
}
