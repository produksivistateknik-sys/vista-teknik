// Fix Bug B (22 Sep 2026) - "Status Pipeline lag": fase2/fase5/dst backfill component_process_progress
// (21 Sep 2026) filter komponen pakai `(cl.qty || 0) > 0`. Filter ini salah utk komponen yang qty-nya
// SEKARANG 0 (kemungkinan BOM direvisi belakangan) tapi punya progress/history/qtyProses REAL dari
// sebelum revisi - komponen begini ke-skip TOTAL dari backfill (0 baris ccp utk proses APAPUN),
// bikin "Status Pipeline" selalu baca "NOT YET" walau "Status" (dari checklist asli) sudah 100%.
// Terverifikasi live 22 Sep 2026: 16 pasangan (panel,komponen) kena ini, semuanya qty=0 SEKARANG
// tapi qtyProses/progress/history nunjukin kerjaan nyata (lihat laporan investigasi).
//
// SENGAJA scope SEMPIT: cuma nambah baris utk (panel,kode) yang SAMA SEKALI belum ada baris ccp-nya
// (0 total, semua proses) - TIDAK menyentuh/overwrite baris manapun yang sudah ada (beda dari
// fase5 asli yang upsert SEMUA baris tiap kali jalan). Domain proses: 7 "proses biasa" (POTONG,
// BENDING, STEL, FINISHING, RENDAM, PAINTING, RAKIT) - domain fase5, sesuai scope "Bug B" yang
// diminta user. PASANG KOMPONEN/WIRING/BUSBAR (domain fase2/3/4) kemungkinan kena bug filter yang
// SAMA tapi SENGAJA belum disentuh di sini - dilaporkan terpisah, nunggu keputusan user.
//
// Jalankan: node supabase/scripts/fix_bug_b_qty0_missing_ccp.mjs [--dry-run]
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
const PROSES_LIST = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'RENDAM', 'PAINTING', 'RAKIT'];

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

function hasRealWork(cl) {
  return PROSES_LIST.some(pr =>
    (cl?.progress?.[pr] || 0) > 0 ||
    (cl?.history?.[pr]?.length > 0) ||
    (cl?.qtyProses?.[pr] || 0) > 0
  );
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (tidak menulis apa pun) ===' : '=== JALAN SUNGGUHAN (menulis ke DB) ===');

  const [panels, bomRelevanAll, workOrders, checkpointsAll, existingCcp] = await Promise.all([
    fetchAll('panels', 'id,wo_id,tipe,checklist', q => q.is('deleted_at', null)),
    fetchAll('bom_proses_relevan', 'kode_komponen,tipe_panel,jenis_pekerjaan', q => q.in('jenis_pekerjaan', PROSES_LIST)),
    fetchAll('work_orders', 'id,is_archived'),
    fetchAll('progress_checkpoint_log', 'panel_id,kode_komponen,proses,pekerja_nama,ts', q => q.in('proses', PROSES_LIST).order('ts', { ascending: true })),
    fetchAll('component_process_progress', 'panel_id,kode_komponen'),
  ]);

  const woArchivedMap = new Map(workOrders.map(w => [w.id, w.is_archived]));
  const relevanSet = new Set(bomRelevanAll.map(r => `${r.kode_komponen}|${r.tipe_panel}|${r.jenis_pekerjaan}`));
  const lastCheckpoint = new Map();
  checkpointsAll.forEach(c => lastCheckpoint.set(`${c.panel_id}|${c.kode_komponen}|${c.proses}`, c));
  const existingPanelKodeSet = new Set(existingCcp.map(r => `${r.panel_id}|${r.kode_komponen}`));

  const panelAktif = panels.filter(p => !woArchivedMap.get(p.wo_id));
  console.log(`Panel aktif (non-deleted, WO belum diarsip): ${panelAktif.length}`);

  let rows = [];
  const targetPairs = [];

  for (const p of panelAktif) {
    const checklist = p.checklist || {};
    for (const [kode, cl] of Object.entries(checklist)) {
      const qty = cl?.qty || 0;
      if (qty > 0) continue; // qty>0 sudah tercover backfill asli, gak disentuh
      if (!hasRealWork(cl)) continue; // qty=0 DAN gak ada kerjaan nyata -> memang gak relevan, skip
      const pairKey = `${p.id}|${kode}`;
      if (existingPanelKodeSet.has(pairKey)) continue; // sudah punya baris ccp (proses lain) -> bukan kasus "hilang total", skip

      targetPairs.push({ panelId: p.id, kode });
      for (const proses of PROSES_LIST) {
        const relevan = relevanSet.has(`${kode}|${p.tipe}|${proses}`);
        if (!relevan) {
          rows.push({
            panel_id: p.id, kode_komponen: kode, proses, tahap: null,
            status: 'not_applicable', progress_pct: 0, qty_total: qty, qty_done: null,
            photos: [], last_operator_nama: null, last_operator_at: null, sudah_disimpan_100: false,
            updated_at: new Date().toISOString(), updated_by: 'fix_bug_b_qty0_backfill',
          });
          continue;
        }
        const pct = cl.progress?.[proses] || 0;
        const qtyDone = cl.qtyProses?.[proses] ?? null;
        const hist = cl.history?.[proses] || [];
        const sudahDisimpan100 = hist.some(h => h.pct === 100);
        const cp = lastCheckpoint.get(`${p.id}|${kode}|${proses}`);
        rows.push({
          panel_id: p.id, kode_komponen: kode, proses, tahap: null,
          status: pctToStatus(pct), progress_pct: pct, qty_total: qty, qty_done: qtyDone,
          photos: [], last_operator_nama: cp?.pekerja_nama || null, last_operator_at: cp?.ts || null,
          sudah_disimpan_100: sudahDisimpan100,
          updated_at: new Date().toISOString(), updated_by: 'fix_bug_b_qty0_backfill',
        });
      }
    }
  }

  console.log(`\nPasangan (panel,komponen) target (qty=0, ada kerjaan nyata, 0 baris ccp existing): ${targetPairs.length}`);
  console.log(JSON.stringify(targetPairs, null, 2));
  console.log(`\nTotal baris akan di-INSERT: ${rows.length}`);
  const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log('Breakdown status:', byStatus);
  console.log('Baris dengan sudah_disimpan_100=true:', rows.filter(r => r.sudah_disimpan_100).length);

  if (DRY_RUN) {
    console.log('\nSample baris in_progress/done pertama:');
    console.log(JSON.stringify(rows.filter(r => r.status === 'in_progress' || r.status === 'done'), null, 2));
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('component_process_progress').upsert(batch, { onConflict: 'panel_id,kode_komponen,proses,tahap_key' });
    if (error) { console.error(`Batch ${i}-${i + batch.length} GAGAL:`, error); process.exit(1); }
    console.log(`Batch ${i}-${i + batch.length} sukses.`);
  }
  console.log('Fix selesai.');
}

main();
