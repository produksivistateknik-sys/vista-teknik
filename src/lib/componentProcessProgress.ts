// Fase 8+ (21 Sep 2026) - helper baca component_process_progress buat consumer admin
// (vista-teknik). Sebelumnya fetch+paginasi ini diduplikasi lokal di tiap consumer (Detail
// Progres, Rencana Harian) - dikonsolidasi ke sini begitu consumer ke-3/4 (Dashboard,
// SummaryProgress) butuh pola yang SAMA PERSIS (CLAUDE.md B.1, satu sumber logika). Cermin
// nama file dari vista-pekerja/src/lib/componentProcessProgress.ts (beda isi - itu buat
// upsert/tulis dari operator, ini buat baca/agregasi dari sisi admin).
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
