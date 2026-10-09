// src/lib/rawPanelOrder.ts
// Urutan tampilan panel di Raw Schedule (fitur geser panel, 27 Sep 2026).
//
// MODEL: tabel raw_schedule_panel_order (panel_id PK, order_key text collate "C" UNIQUE).
// Tampilan diurutkan: ① zona prioritas (Tinggi->Sedang->Rendah, kolom raw_schedule.prioritas)
// ② order_key (fractional index base62, lib fractional-indexing) ③ panel_id (panel yang belum
// punya key = panel baru, taruh di belakang zona sesuai panel_id = perilaku lama).
//
// ATURAN KERAS (belajar dari bug BOM master renumber kode_komponen): geser 1 panel = hitung 1
// key baru di antara tetangganya, TIDAK PERNAH mengubah key panel lain. Satu-satunya tulisan ke
// panel lain = INSERT key buat panel yang BELUM punya key sama sekali (materialize, on conflict
// do nothing) - bukan renumber.
//
// KEY DIBANDINGKAN PER BYTE (a<b), BUKAN localeCompare - base62 "0-9A-Za-z" butuh urutan kode
// karakter; localeCompare gak case-sensitive dgn benar & bikin urutan kacau.
import { useEffect, useState } from 'react'
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { supabase } from './supabase'

export type Zona = 'Tinggi' | 'Sedang' | 'Rendah'
export const ZONA_URUTAN: Zona[] = ['Tinggi', 'Sedang', 'Rendah']
const ZONA_RANK: Record<string, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 }
// Sama persis PRIO_ORDER lama di RawSchedule.tsx - prioritas kosong/aneh dianggap Sedang.
export const zonaDari = (prioritas: any): Zona => (ZONA_RANK[prioritas] === undefined ? 'Sedang' : prioritas)
export const rankZona = (prioritas: any): number => ZONA_RANK[zonaDari(prioritas)]

export const byteCmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

// Pembanding panel dalam 1 zona: key (byte) -> yang belum punya key di belakang -> panel_id.
export function cmpPanelDalamZona(aId: number, bId: number, keyMap: Record<number, string>): number {
  const ka = keyMap[aId], kb = keyMap[bId]
  if (ka && kb && ka !== kb) return byteCmp(ka, kb)
  if (!!ka !== !!kb) return ka ? -1 : 1
  return aId - bId
}

// URUTAN BARIS RAW SCHEDULE (Tahap 1 migrasi accordion, 9 Okt 2026 - dipindah APA ADANYA dari
// RawSchedule.tsx, satu sumber utk tampilan lama & accordion): ① zona prioritas (PRIO_ORDER lama:
// Tinggi/Sedang/Rendah, lainnya dianggap Sedang) ② dalam zona: order_key -> panel_id (cmpPanelDalamZona)
// ③ dalam 1 panel: urutan proses ALL_PROSES (proses di luar ALL_PROSES di akhir grup panel).
const PRIO_ORDER: Record<string, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 }
export function bandingkanBarisRaw(a: any, b: any, orderMap: Record<number, string>, semuaProses: string[]): number {
  const pa = PRIO_ORDER[a.prioritas] ?? 1; const pb = PRIO_ORDER[b.prioritas] ?? 1
  if (pa !== pb) return pa - pb
  const aId = a.panel_id || a.panelId; const bId = b.panel_id || b.panelId
  if (aId !== bId) return cmpPanelDalamZona(Number(aId), Number(bId), orderMap)
  const idx = (pr: string) => { const i = semuaProses.indexOf(pr); return i < 0 ? 999 : i }
  return idx(a.proses) - idx(b.proses)
}

// Semua key (paginated - CLAUDE.md A.1, tabel tumbuh 1 baris per panel).
export async function fetchPanelOrderMap(): Promise<Record<number, string>> {
  const map: Record<number, string> = {}
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('raw_schedule_panel_order' as any)
      .select('panel_id,order_key').order('panel_id').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    ;(data as any[] || []).forEach((r: any) => { map[Number(r.panel_id)] = r.order_key })
    if (!data || data.length < PAGE) break
  }
  return map
}

// Map key + realtime (urutan sinkron antar user tanpa reload). Gagal fetch -> map kosong =
// tampilan jatuh ke urutan lama (prioritas -> panel_id), bukan crash; error dilaporkan lewat
// `error` supaya layar bisa kasih tahu.
export function useRawPanelOrder() {
  const [orderMap, setOrderMap] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => fetchPanelOrderMap()
      .then(m => { if (alive) { setOrderMap(m); setError(null) } })
      .catch(e => { console.error('gagal ambil urutan panel Raw Schedule:', e); if (alive) setError(String(e?.message || e)) })
    load()
    const ch = supabase.channel('realtime-raw-schedule-panel-order')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'raw_schedule_panel_order' }, (p: any) => {
        if (p.eventType === 'DELETE') {
          const id = Number(p.old?.panel_id)
          setOrderMap(prev => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n })
        } else if (p.new?.panel_id != null) {
          const id = Number(p.new.panel_id), key = p.new.order_key
          setOrderMap(prev => (prev[id] === key ? prev : { ...prev, [id]: key }))
        }
      })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [])
  return { orderMap, setOrderMap, error }
}

// ─── Posisi jatuh ───────────────────────────────────────────────────────────────────────────
export type BlokTampil = { panelId: number; zona: Zona; top: number; bottom: number }
export type PembatasTampil = { zona: Zona; top: number; bottom: number }
export type TargetPindah = { zona: Zona; prevId: number | null; nextId: number | null }
export type TargetDrop = TargetPindah & { indicatorY: number }

// blok = panel TERLIHAT (sudah difilter) urut tampilan; pembatas = 3 baris pembatas zona.
// Setengah atas blok = sebelum blok itu; setengah bawah = sesudahnya; di pembatas zona Z = awal
// zona Z. Pointer di atas semuanya = awal zona pertama; di bawah semuanya = akhir zona terakhir.
// Return null kalau pointer di atas blok yang lagi diseret sendiri (gak pindah).
export function hitungTargetDrop(blok: BlokTampil[], pembatas: PembatasTampil[], pointerY: number, draggedId: number): TargetDrop | null {
  type Item = { tipe: 'pembatas'; zona: Zona; top: number; bottom: number } | { tipe: 'blok'; b: BlokTampil; top: number; bottom: number }
  const items: Item[] = []
  ZONA_URUTAN.forEach(z => {
    const p = pembatas.find(x => x.zona === z)
    if (p) items.push({ tipe: 'pembatas', zona: z, top: p.top, bottom: p.bottom })
    blok.filter(b => b.zona === z).forEach(b => items.push({ tipe: 'blok', b, top: b.top, bottom: b.bottom }))
  })
  if (items.length === 0) return null
  const blokZona = (z: Zona) => blok.filter(b => b.zona === z && b.panelId !== draggedId)
  let it = items.find(x => pointerY < x.bottom)
  if (!it) {
    // di bawah semuanya: akhir zona terakhir yang punya pembatas
    const zAkhir = ZONA_URUTAN[ZONA_URUTAN.length - 1]
    const bz = blokZona(zAkhir)
    const last = items[items.length - 1]
    return { zona: zAkhir, prevId: bz.length ? bz[bz.length - 1].panelId : null, nextId: null, indicatorY: last.bottom }
  }
  if (it.tipe === 'pembatas') {
    const bz = blokZona(it.zona)
    return { zona: it.zona, prevId: null, nextId: bz.length ? bz[0].panelId : null, indicatorY: it.bottom }
  }
  const b = it.b
  if (b.panelId === draggedId) return null
  const bz = blokZona(b.zona)
  const idx = bz.findIndex(x => x.panelId === b.panelId)
  const atas = pointerY < (b.top + b.bottom) / 2
  if (atas) return { zona: b.zona, prevId: idx > 0 ? bz[idx - 1].panelId : null, nextId: b.panelId, indicatorY: b.top }
  return { zona: b.zona, prevId: b.panelId, nextId: idx < bz.length - 1 ? bz[idx + 1].panelId : null, indicatorY: b.bottom }
}

// Tetangga TERLIHAT panel ini sekarang di zonanya (buat deteksi "gak pindah" & menu ⋮).
export function tetanggaSekarang(blokUrut: { panelId: number; zona: Zona }[], panelId: number): TargetPindah | null {
  const me = blokUrut.find(b => b.panelId === panelId)
  if (!me) return null
  const bz = blokUrut.filter(b => b.zona === me.zona)
  const i = bz.findIndex(b => b.panelId === panelId)
  return { zona: me.zona, prevId: i > 0 ? bz[i - 1].panelId : null, nextId: i < bz.length - 1 ? bz[i + 1].panelId : null }
}

// ─── Key baru ───────────────────────────────────────────────────────────────────────────────
export type PanelInfo = { panelId: number; zona: Zona; key: string | null }

// semua = SEMUA panel Raw Schedule (tanpa filter tampilan) + zona & key-nya saat ini.
// Batas key diambil dari daftar key GLOBAL (unik di seluruh tabel, lintas zona) - kalau cuma dari
// tetangga sezona, key baru bisa bentrok dgn key panel zona lain yang nilainya kebetulan di antara.
export function hitungKeyPindah(semua: PanelInfo[], draggedId: number, t: TargetPindah): { orderKey: string; materialize: { panel_id: number; order_key: string }[] } {
  const lain = semua.filter(p => p.panelId !== draggedId)
  const keyOf: Record<number, string> = {}
  lain.forEach(p => { if (p.key) keyOf[p.panelId] = p.key })
  const semuaKey = () => Object.values(keyOf).sort(byteCmp)
  const nextGlobal = (lo: string | null) => semuaKey().find(k => lo === null || k > lo) ?? null
  const prevGlobal = (hi: string) => { const ks = semuaKey().filter(k => k < hi); return ks.length ? ks[ks.length - 1] : null }
  const maxZona = (z: Zona) => { const ks = lain.filter(p => p.zona === z && keyOf[p.panelId]).map(p => keyOf[p.panelId]).sort(byteCmp); return ks.length ? ks[ks.length - 1] : null }

  // Materialize: panel zona tujuan yang belum punya key -> dikasih key berurutan panel_id, persis
  // di belakang key terakhir zona itu (= posisi tampilnya sekarang). INSERT saja.
  const materialize: { panel_id: number; order_key: string }[] = []
  const tanpaKey = lain.filter(p => p.zona === t.zona && !keyOf[p.panelId]).sort((a, b) => a.panelId - b.panelId)
  if (tanpaKey.length) {
    const lo = maxZona(t.zona) ?? (semuaKey().slice(-1)[0] ?? null)
    const keys = generateNKeysBetween(lo, nextGlobal(lo), tanpaKey.length)
    tanpaKey.forEach((p, i) => { keyOf[p.panelId] = keys[i]; materialize.push({ panel_id: p.panelId, order_key: keys[i] }) })
  }

  let lo: string | null, hi: string | null
  if (t.prevId != null && keyOf[t.prevId]) { lo = keyOf[t.prevId]; hi = nextGlobal(lo) }
  else if (t.nextId != null && keyOf[t.nextId]) { hi = keyOf[t.nextId]; lo = prevGlobal(hi) }
  else { lo = maxZona(t.zona) ?? (semuaKey().slice(-1)[0] ?? null); hi = nextGlobal(lo) }
  return { orderKey: generateKeyBetween(lo, hi), materialize }
}

// ─── Simpan (RPC atomik) ────────────────────────────────────────────────────────────────────
// Satu transaksi Postgres: prioritas raw_schedule + renhar panel ini (kalau p_prioritas diisi)
// + materialize + key panel ini (kalau p_order_key diisi). Gagal di langkah manapun = semua batal.
export async function simpanPindahPanel(args: { panelId: number; orderKey: string | null; prioritas: Zona | null; materialize: { panel_id: number; order_key: string }[]; user: string }): Promise<{ ok: boolean; code?: string; message?: string }> {
  const { error } = await supabase.rpc('pindah_urutan_panel_raw' as any, {
    p_panel_id: args.panelId,
    p_order_key: args.orderKey,
    p_prioritas: args.prioritas,
    p_materialize: args.materialize,
    p_user: args.user,
  } as any)
  if (error) { console.error('pindah_urutan_panel_raw gagal:', error); return { ok: false, code: (error as any).code, message: error.message } }
  return { ok: true }
}
