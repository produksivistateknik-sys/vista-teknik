// Fase 4 (21 Sep 2026) - backfill SEKALI JALAN component_process_progress dari data checklist
// yang sudah ada, domain BUSBAR. Idempotent (upsert ON CONFLICT) - aman dijalankan ulang.
//
// ASIMETRIS dari Fase 2/3 (lihat FASE4_BUSBAR_DESIGN.md poin 1a/4) - BUSBAR gak punya sumber
// relevansi statis kayak bom_proses_relevan. Kode busbar TANPA busbarTahap di checklist (belum
// pernah disentuh sama sekali) TIDAK di-seed apa pun (bukan not_applicable) - dibiarkan tercipta
// natural pas pertama kali dual-write jalan.
//
// Operator: progress_checkpoint_log utk BUSBAR checkpoint-nya di level GABUNGAN (bukan per-tahap,
// lihat komentar updatePctManualBusbarTahap) - dipakai sbg proxy operator/tanggal terakhir utk
// SEMUA baris tahap kode itu (keterbatasan yang diketahui, didokumentasikan di desain).
//
// Jalankan: node supabase/scripts/fase4_seed_busbar.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const DRY_RUN = process.argv.includes('--dry-run');
const BUSBAR_URUTAN_TAHAP_LENGKAP = ["FABRIKASI", "PLATING", "HEATSHRINK", "PASANG"];
const BUSBAR_URUTAN_TAHAP_SINGKAT = ["FABRIKASI", "PLATING", "PASANG"];
function getUrutanTahapBusbar(kode) {
  return (kode === "COUPLER" || kode === "GROUND") ? BUSBAR_URUTAN_TAHAP_SINGKAT : BUSBAR_URUTAN_TAHAP_LENGKAP;
}
function pctToStatus(pct) {
  if (pct >= 100) return 'done';
  if (pct > 0) return 'in_progress';
  return 'not_started';
}

async function fetchAll(table, select, filterFn) {
  let all = [], from = 0;
  const PAGE = 1000;
  for (;;) {
    let q = supabase.from(table).select(select);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (tidak menulis apa pun) ===' : '=== JALAN SUNGGUHAN (menulis ke DB) ===');

  const [panels, workOrders, checkpointsAll] = await Promise.all([
    fetchAll('panels', 'id,wo_id,tipe,checklist'),
    fetchAll('work_orders', 'id,is_archived'),
    fetchAll('progress_checkpoint_log', 'panel_id,kode_komponen,proses,pekerja_nama,ts', q => q.eq('proses', 'BUSBAR').order('ts', { ascending: true })),
  ]);
  const woArchivedMap = new Map(workOrders.map(w => [w.id, w.is_archived]));
  const lastCheckpoint = new Map();
  checkpointsAll.forEach(c => lastCheckpoint.set(`${c.panel_id}|${c.kode_komponen}`, c));
  console.log(`Total panel: ${panels.length}, checkpoint BUSBAR historis: ${checkpointsAll.length}`);

  const panelAktif = panels.filter(p => !woArchivedMap.get(p.wo_id));
  let rows = [];
  let kodeDiproses = 0;

  for (const p of panelAktif) {
    for (const [kode, cl] of Object.entries(p.checklist || {})) {
      if (!cl?.busbarTahap) continue; // TIDAK ada bukti aktivitas - skip total, bukan not_applicable
      kodeDiproses++;
      const urutan = getUrutanTahapBusbar(kode);
      const cp = lastCheckpoint.get(`${p.id}|${kode}`);
      for (const tahap of urutan) {
        const tahapData = cl.busbarTahap[tahap] || { progress: 0, sudahDisimpan100: false };
        const pct = tahapData.progress || 0;
        rows.push({
          panel_id: p.id, kode_komponen: kode, proses: 'BUSBAR', tahap,
          status: pctToStatus(pct), progress_pct: pct, qty_total: 0, qty_done: null,
          photos: [], last_operator_nama: cp?.pekerja_nama || null, last_operator_at: cp?.ts || null,
          sudah_disimpan_100: !!tahapData.sudahDisimpan100,
          updated_at: new Date().toISOString(), updated_by: 'fase4_seed_backfill',
        });
      }
    }
  }

  console.log(`Kode busbar dengan bukti aktivitas (punya busbarTahap): ${kodeDiproses}`);
  console.log(`Total baris akan di-upsert: ${rows.length}`);
  const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log('Breakdown status:', byStatus);
  console.log('Baris dengan sudah_disimpan_100=true:', rows.filter(r => r.sudah_disimpan_100).length);
  console.log('Baris dengan last_operator_nama terisi:', rows.filter(r => r.last_operator_nama).length);

  if (DRY_RUN) {
    console.log('\nSample 5 baris pertama:');
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('component_process_progress').upsert(batch, { onConflict: 'panel_id,kode_komponen,proses,tahap_key' });
    if (error) { console.error(`Batch ${i}-${i + batch.length} GAGAL:`, error); process.exit(1); }
    console.log(`Batch ${i}-${i + batch.length} sukses.`);
  }
  console.log('Backfill selesai.');
}

main();
