// Fase 8+ (21 Sep 2026) - helper baca component_process_progress buat consumer admin
// (vista-teknik). Sebelumnya fetch+paginasi ini diduplikasi lokal di tiap consumer (Detail
// Progres, Rencana Harian) - dikonsolidasi ke sini begitu consumer ke-3/4 (Dashboard,
// SummaryProgress) butuh pola yang SAMA PERSIS (CLAUDE.md B.1, satu sumber logika). Cermin
// nama file dari vista-pekerja/src/lib/componentProcessProgress.ts (beda isi - itu buat
// upsert/tulis dari operator, ini buat baca/agregasi dari sisi admin).
import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { fetchAllPagedPerPotongan } from './fetchAllPaged';
import { pasangPemulihRealtime } from './pemulihRealtime';
import { laporError } from './laporError';
import { hitungPctSetelahUbahQty, PROSES_TIDAK_DISKALA } from './progressQtyHelpers';

// PEMUAT CCP BERSAMA (4 Nov 2026, kasus PANEL CAP BANK FS.4: label "In Progress" basi di samping "Selesai 8/8").
// Dulu tiap halaman (Dashboard/Detail Progres/Manajemen WO/Rencana Harian/Summary Progress/Task Monitoring) punya
// langganan sendiri & HANYA realtime - kanal yang putus diam-diam (tab lama terbuka, laptop tidur, wifi) membuat angka
// ccp beku, dan getCcpAwareValue mengutamakan ccp (aturan TIDAK diubah) -> status basi. Sekarang:
// - SATU toko per set panel (kunci = daftar panel terurut), dipakai bersama semua halaman yang ter-mount (visitedTabs)
//   -> 5 halaman dgn set panel sama = 1 muat, bukan 5. Toko dilepas saat pemakai terakhir unmount.
// - muat penuh berhalaman (fetchAllPagedPerPotongan, urut id); gagal = peta terakhir DIPERTAHANKAN (tidak dikosongkan)
//   + console.error + laporError.
// - realtime per baris tetap (INSERT/UPDATE diterapkan langsung, murah - 199 perubahan/hari per 4 Nov).
// - pasangPemulihRealtime sbg pemulih: muat penuh saat kanal tersambung ulang, tab kembali terlihat, perangkat online
//   lagi, dan polling cadangan 120 dtk saat tab terlihat (bukan 30 dtk: 1 muat = ±2.848 baris/217 KB per 4 Nov).
//   Kanal pemulih tanpa tabel (tabel: []) - event baris sudah ditangani kanal per baris; tidak muat penuh per event.
export const POLLING_CCP_MS = 120000
type TokoCcp = { map: Record<string, number>; pendengar: Set<(m: Record<string, number>) => void>; lepas: () => void }
const tokoCcp = new Map<string, TokoCcp>()
let ccpChannelCounter = 0;
async function muatCcpPenuh(panelIds: number[]): Promise<Record<string, number>> {
  const rows = await fetchAllPagedPerPotongan(panelIds, (bagian, from, to) => supabase.from('component_process_progress' as any)
    .select('panel_id,kode_komponen,proses,progress_pct').in('panel_id', bagian).neq('status', 'not_applicable').order('id').range(from, to))
  const map: Record<string, number> = {};
  rows.forEach((r: any) => { map[`${r.panel_id}|${r.kode_komponen}|${r.proses}`] = Number(r.progress_pct); });
  return map;
}
// kontrak lama dipertahankan (pemanggil lain): gagal -> {} + console.error
export async function fetchCcpMapForPanels(panelIds: number[]): Promise<Record<string, number>> {
  if (panelIds.length === 0) return {};
  try { return await muatCcpPenuh(panelIds) } catch (error) { console.error('gagal ambil component_process_progress:', error); return {} }
}
function bukaTokoCcp(kunci: string, ids: number[]): TokoCcp {
  const ada = tokoCcp.get(kunci); if (ada) return ada
  const toko: TokoCcp = { map: {}, pendengar: new Set(), lepas: () => {} }
  const kabari = () => toko.pendengar.forEach((f) => f(toko.map))
  let berjalan = false, lagi = false
  const muat = async () => {
    if (berjalan) { lagi = true; return }
    berjalan = true
    try { toko.map = await muatCcpPenuh(ids); kabari() }
    catch (e) { console.error('[ccp] gagal memuat ulang component_process_progress (angka terakhir dipertahankan):', e); laporError('supabase_error', e, { aksi: 'muat component_process_progress', panel: ids.length }) }
    finally { berjalan = false; if (lagi) { lagi = false; muat() } }
  }
  // Filter server-side (pola useWorkOrders.ts); >100 panel -> tanpa filter (lebih baik overfetch daripada tidak dapat update)
  const filterClause = ids.length <= 100 ? `panel_id=in.(${kunci})` : undefined
  const applyRow = (r: any) => {
    const key = `${r.panel_id}|${r.kode_komponen}|${r.proses}`;
    const next = { ...toko.map }
    if (r.status === 'not_applicable') delete next[key]; else next[key] = Number(r.progress_pct);
    toko.map = next; kabari()
  };
  const n = ++ccpChannelCounter
  const ev = (event: 'INSERT' | 'UPDATE') => (filterClause ? { event, schema: 'public', table: 'component_process_progress', filter: filterClause } : { event, schema: 'public', table: 'component_process_progress' })
  const channel = supabase.channel(`realtime-ccp-${n}-${kunci}`)
    .on('postgres_changes' as any, ev('INSERT'), (payload: any) => applyRow(payload.new))
    .on('postgres_changes' as any, ev('UPDATE'), (payload: any) => applyRow(payload.new))
    .subscribe();
  const lepasPemulih = pasangPemulihRealtime(supabase, { nama: `pemulih-ccp-${n}`, label: 'ccp', tabel: [], muat, pollingMs: POLLING_CCP_MS })
  toko.lepas = () => { lepasPemulih(); supabase.removeChannel(channel) }
  tokoCcp.set(kunci, toko)
  muat()
  return toko
}

export function useCcpMap(panelIds: number[]): Record<string, number> {
  const panelIdsKey = useMemo(() => [...new Set(panelIds)].sort((a, b) => a - b).join(','), [panelIds.join(',')]);
  const [ccpMap, setCcpMap] = useState<Record<string, number>>(() => tokoCcp.get(panelIdsKey)?.map || {});
  useEffect(() => {
    if (!panelIdsKey) { setCcpMap({}); return; }
    const toko = bukaTokoCcp(panelIdsKey, panelIdsKey.split(',').map(Number))
    toko.pendengar.add(setCcpMap); setCcpMap(toko.map)
    return () => {
      toko.pendengar.delete(setCcpMap)
      if (!toko.pendengar.size) { toko.lepas(); tokoCcp.delete(panelIdsKey) }
    };
  }, [panelIdsKey]);
  return ccpMap;
}

// SINKRON CCP SETELAH QTY KOMPONEN BERUBAH (2 Okt 2026) - pasangan sesuaikanProgressKeQtyBaru
// (checklist) di lib/progressQtyHelpers.ts. 6 halaman admin MENGUTAMAKAN progress_pct tabel ini
// (getCcpAwareValue), jadi kalau cuma checklist yang disesuaikan, proses yang belum 100% tetap
// tampil angka lama (insiden MCC PANEL: Groundplate WIRING CONTROL tampil 75% padahal 54%).
// - Rumus persen SAMA dgn checklist (hitungPctSetelahUbahQty), tapi dihitung dari angka CCP SENDIRI
//   (progress_pct & qty_done), bukan disalin dari checklist - CCP yang lebih akurat gak tertimpa.
// - Status lewat pctKeStatusCcp = cermin pctToStatus vista-pekerja (constraint
//   ccp_status_progress_consistent). sudah_disimpan_100 jadi false kalau persen turun < 100
//   (operator menulisnya = pct>=100 saat simpan).
// - Cuma UPDATE baris yang SUDAH ada; dilewati: tahap != NULL (BUSBAR / tahap Pasang Komponen),
//   not_applicable, QC TEST/PACKING. Qty ke/dari 0 tidak disentuh (ditangani jalur jadwal).
// SATU-SATUNYA rumus status CCP di sisi Admin (cermin pctToStatus vista-pekerja) & SATU-SATUNYA tempat
// Admin menulis component_process_progress saat persen diskalakan - dipakai penyesuaian qty komponen
// (sinkronCcpSetelahUbahQty) DAN Penyesuaian Busbar (sinkronCcpBusbarSetelahUbahJumlah). Jangan
// tulis tabel ini dari file lain.
export const pctKeStatusCcp = (pct: number) => pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'not_started';

async function skalakanBarisCcp(rows: any[], skala: (r: any) => { qtyLama: number; qtyBaru: number; qtyDone: number; qtyTotal?: number } | null, updatedBy: string): Promise<number> {
  let n = 0
  for (const r of rows) {
    const s = skala(r)
    if (!s) continue
    const pct = hitungPctSetelahUbahQty(Number(r.progress_pct) || 0, s.qtyDone, s.qtyLama, s.qtyBaru)
    const status = pctKeStatusCcp(pct)
    const patch: any = { progress_pct: status === 'not_started' ? 0 : pct, status, updated_at: new Date().toISOString(), updated_by: updatedBy }
    if (s.qtyTotal !== undefined) patch.qty_total = s.qtyTotal
    if (pct < 100) patch.sudah_disimpan_100 = false
    const { error } = await supabase.from('component_process_progress' as any).update(patch).eq('id', r.id)
    if (error) throw new Error(`update component_process_progress ${r.kode_komponen}/${r.proses}${r.tahap ? '/' + r.tahap : ''}: ${error.message}`)
    n++
  }
  return n
}

async function bacaBarisCcp(panelId: number, kodes: string[], proses?: string) {
  let q: any = supabase.from('component_process_progress' as any)
    .select('id,kode_komponen,proses,tahap,status,progress_pct,qty_done').eq('panel_id', panelId).in('kode_komponen', kodes)
  if (proses) q = q.eq('proses', proses)
  const { data, error } = await q.range(0, 4999)
  if (error) throw new Error('baca component_process_progress: ' + error.message)
  return (data as any[]) || []
}

// Komponen biasa: baris tanpa tahap; dilewati BUSBAR, QC TEST/PACKING, not_applicable.
export async function sinkronCcpSetelahUbahQty(panelId: number, changes: { kode: string; oldQty: number; newQty: number }[], updatedBy: string): Promise<number> {
  const berlaku = changes.filter(c => c.oldQty > 0 && c.newQty > 0 && c.oldQty !== c.newQty)
  if (!berlaku.length) return 0
  const rows = await bacaBarisCcp(panelId, berlaku.map(c => c.kode))
  return skalakanBarisCcp(rows, (r) => {
    if (r.tahap != null || r.status === 'not_applicable' || r.proses === 'BUSBAR' || PROSES_TIDAK_DISKALA.includes(r.proses)) return null
    const c = berlaku.find(x => x.kode === r.kode_komponen)!
    return { qtyLama: c.oldQty, qtyBaru: c.newQty, qtyDone: Number(r.qty_done) || 0, qtyTotal: c.newQty }
  }, updatedBy)
}

// BUSBAR (Penyesuaian Busbar): baris per tahap proses BUSBAR; komponen busbar tidak punya qty
// -> qtyDone 0 (murni proporsional), qty_total tidak diubah.
export async function sinkronCcpBusbarSetelahUbahJumlah(panelId: number, items: { kode: string; jumlahLama: number; jumlahBaru: number }[], updatedBy: string): Promise<number> {
  const berlaku = items.filter(i => i.jumlahLama > 0 && i.jumlahBaru > 0 && i.jumlahLama !== i.jumlahBaru)
  if (!berlaku.length) return 0
  const rows = await bacaBarisCcp(panelId, berlaku.map(i => i.kode), 'BUSBAR')
  return skalakanBarisCcp(rows, (r) => {
    if (!r.tahap || r.status === 'not_applicable') return null
    const it = berlaku.find(x => x.kode === r.kode_komponen)!
    return { qtyLama: it.jumlahLama, qtyBaru: it.jumlahBaru, qtyDone: 0 }
  }, updatedBy)
}
