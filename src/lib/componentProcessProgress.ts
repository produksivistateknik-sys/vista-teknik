// Fase 8+ (21 Sep 2026) - helper baca component_process_progress buat consumer admin
// (vista-teknik). Sebelumnya fetch+paginasi ini diduplikasi lokal di tiap consumer (Detail
// Progres, Rencana Harian) - dikonsolidasi ke sini begitu consumer ke-3/4 (Dashboard,
// SummaryProgress) butuh pola yang SAMA PERSIS (CLAUDE.md B.1, satu sumber logika). Cermin
// nama file dari vista-pekerja/src/lib/componentProcessProgress.ts (beda isi - itu buat
// upsert/tulis dari operator, ini buat baca/agregasi dari sisi admin).
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import { hitungPctSetelahUbahQty, PROSES_TIDAK_DISKALA } from './progressQtyHelpers';

// Counter modul-level buat channel realtime unik per HOOK INSTANCE (bukan cuma per panelIdsKey) -
// AUDIT (21 Sep 2026): 6 consumer (Task Monitoring/Detail Progres/Rencana Harian/Dashboard/
// Summary Progress/Manajemen WO) semuanya biasanya nampilin SET PANEL YANG SAMA (semua panel
// aktif), jadi panelIdsKey-nya SAMA PERSIS lintas file - kalau nama channel cuma dari panelIdsKey,
// beberapa consumer yang mounted BARENGAN (App.tsx `visitedTabs` nahan semua tab tetap mounted)
// bakal bikin channel dengan NAMA SAMA PERSIS. Supabase JS behavior utk topic sama dari client
// yang sama TIDAK didokumentasikan jelas cukup buat diandalkan (risiko: unsubscribe salah satu
// consumer ikut motong langganan consumer lain) - lebih aman kasih suffix unik per instance,
// hindari isu ini sama sekali daripada bergantung ke perilaku SDK yang gak dijamin.
let ccpChannelCounter = 0;

// WAJIB paginate (CLAUDE.md A.1) - tabel ini sudah >1000 baris non-not_applicable (2710 per
// 21 Sep 2026), 1 query polos silently ke-cap. Insiden nyata: versi awal Detail Progres (Fase 7)
// sempat kena ini sebelum ketahuan & diperbaiki.
export async function fetchCcpMapForPanels(panelIds: number[]): Promise<Record<string, number>> {
  if (panelIds.length === 0) return {};
  let all: any[] = [], from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase.from('component_process_progress' as any)
      .select('panel_id,kode_komponen,proses,progress_pct')
      .in('panel_id', panelIds).neq('status', 'not_applicable')
      .range(from, from + PAGE - 1);
    if (error) { console.error('gagal ambil component_process_progress:', error); return {}; }
    const rows = (data as any[]) || [];
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  const map: Record<string, number> = {};
  all.forEach((r: any) => { map[`${r.panel_id}|${r.kode_komponen}|${r.proses}`] = Number(r.progress_pct); });
  return map;
}

// AUDIT (21 Sep 2026, ditemukan saat cek bug sesi ini) - 6 consumer (Task Monitoring/Detail
// Progres/Rencana Harian/Dashboard/Summary Progress/Manajemen WO) semua fetch ccpMap SEKALI
// per mount (dependency [woData.length] atau [selectedPanelId]), TIDAK pernah refresh lagi
// selama komponen tetap mounted - App.tsx nyimpen tab yang sudah dikunjungi tetap mounted
// (display:none, bukan unmount) via `visitedTabs`, jadi begitu admin buka 1 tab lalu operator
// nulis progress baru, angka yang ketampil BASI sampai woData.length berubah (WO ditambah/
// dihapus - bisa berjam-jam). Ini REGRESI nyata dari checklist lama (woData SENDIRI sudah live
// via realtime postgres_changes di useWorkOrders.ts - checklist-derived number otomatis segar,
// ccp-derived number TIDAK sebelum fix ini). Hook ini gantikan pola fetch-sekali di 6 consumer
// itu - subscribe postgres_changes ke component_process_progress juga, pola SAMA PERSIS
// useWorkOrders.ts (channel di-filter server-side ke panelIds yang lagi ditampilkan, dibuat
// ULANG cuma kalau DAFTAR panel berubah - bukan tiap baris ccp berubah).
export function useCcpMap(panelIds: number[]): Record<string, number> {
  const [ccpMap, setCcpMap] = useState<Record<string, number>>({});
  const panelIdsKey = useMemo(() => [...new Set(panelIds)].sort((a, b) => a - b).join(','), [panelIds.join(',')]);
  const instanceIdRef = useRef<number | undefined>(undefined);
  if (instanceIdRef.current === undefined) instanceIdRef.current = ++ccpChannelCounter;

  useEffect(() => {
    if (!panelIdsKey) { setCcpMap({}); return; }
    const ids = panelIdsKey.split(',').map(Number);
    let cancelled = false;
    fetchCcpMapForPanels(ids).then(map => { if (!cancelled) setCcpMap(map); });

    // Filter server-side (audit egress, pola sama persis useWorkOrders.ts panels channel) -
    // >100 panel jarang terjadi (26 panel live per 21 Sep 2026), fallback ke unfiltered kalau
    // suatu saat terjadi (lebih baik overfetch daripada gak dapet update sama sekali).
    const filterClause = ids.length <= 100 ? `panel_id=in.(${panelIdsKey})` : undefined;
    const applyRow = (r: any) => {
      const key = `${r.panel_id}|${r.kode_komponen}|${r.proses}`;
      setCcpMap(prev => {
        const next = { ...prev };
        if (r.status === 'not_applicable') delete next[key]; else next[key] = Number(r.progress_pct);
        return next;
      });
    };
    const channel = supabase.channel(`realtime-ccp-${instanceIdRef.current}-${panelIdsKey}`)
      .on('postgres_changes', filterClause
        ? { event: 'INSERT', schema: 'public', table: 'component_process_progress', filter: filterClause }
        : { event: 'INSERT', schema: 'public', table: 'component_process_progress' },
        (payload: any) => applyRow(payload.new))
      .on('postgres_changes', filterClause
        ? { event: 'UPDATE', schema: 'public', table: 'component_process_progress', filter: filterClause }
        : { event: 'UPDATE', schema: 'public', table: 'component_process_progress' },
        (payload: any) => applyRow(payload.new))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
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
const pctKeStatusCcp = (pct: number) => pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'not_started';

export async function sinkronCcpSetelahUbahQty(panelId: number, changes: { kode: string; oldQty: number; newQty: number }[], updatedBy: string): Promise<number> {
  const berlaku = changes.filter(c => c.oldQty > 0 && c.newQty > 0 && c.oldQty !== c.newQty)
  if (!berlaku.length) return 0
  const { data, error } = await supabase.from('component_process_progress' as any)
    .select('id,kode_komponen,proses,tahap,status,progress_pct,qty_done,sudah_disimpan_100')
    .eq('panel_id', panelId).in('kode_komponen', berlaku.map(c => c.kode)).range(0, 4999)
  if (error) throw new Error('baca component_process_progress: ' + error.message)
  let n = 0
  for (const r of ((data as any[]) || [])) {
    if (r.tahap != null || r.status === 'not_applicable' || r.proses === 'BUSBAR' || PROSES_TIDAK_DISKALA.includes(r.proses)) continue
    const c = berlaku.find(x => x.kode === r.kode_komponen)!
    const pct = hitungPctSetelahUbahQty(Number(r.progress_pct) || 0, Number(r.qty_done) || 0, c.oldQty, c.newQty)
    const status = pctKeStatusCcp(pct)
    const patch: any = { progress_pct: status === 'not_started' ? 0 : pct, status, qty_total: c.newQty, updated_at: new Date().toISOString(), updated_by: updatedBy }
    if (pct < 100) patch.sudah_disimpan_100 = false
    const { error: uErr } = await supabase.from('component_process_progress' as any).update(patch).eq('id', r.id)
    if (uErr) throw new Error(`update component_process_progress ${r.kode_komponen}/${r.proses}: ${uErr.message}`)
    n++
  }
  return n
}
