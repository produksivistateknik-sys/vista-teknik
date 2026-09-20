// Fase 8+ (21 Sep 2026) - helper baca component_process_progress buat consumer admin
// (vista-teknik). Sebelumnya fetch+paginasi ini diduplikasi lokal di tiap consumer (Detail
// Progres, Rencana Harian) - dikonsolidasi ke sini begitu consumer ke-3/4 (Dashboard,
// SummaryProgress) butuh pola yang SAMA PERSIS (CLAUDE.md B.1, satu sumber logika). Cermin
// nama file dari vista-pekerja/src/lib/componentProcessProgress.ts (beda isi - itu buat
// upsert/tulis dari operator, ini buat baca/agregasi dari sisi admin).
import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';

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
    const channel = supabase.channel('realtime-ccp-' + panelIdsKey)
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
