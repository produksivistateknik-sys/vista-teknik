// Fase 3 (21 Sep 2026) - backfill SEKALI JALAN component_process_progress dari data checklist
// yang sudah ada, domain WIRING CONTROL + WIRING POWER (proses "biasa", tahap=NULL selalu -
// BEDA dari pasangKomponenTahap.WIRING Pasang Komponen, dua field independen). Idempotent
// (upsert ON CONFLICT) - aman dijalankan ulang.
//
// KOREKSI dari draft desain awal (FASE3_WIRING_CONTROL_POWER_DESIGN.md bag. 4): checklist.history
// TIDAK menyimpan nama operator (cuma {ts,pct,shift,tanggal}) - beda dari asumsi awal. Operator
// yang pernah mengerjakan HANYA tercatat di progress_checkpoint_log (tabel terpisah, sudah ada
// sejak 7 Sep 2026 / diperkuat 7 Sep 2026 fix "operator kosong"). Backfill ini query checkpoint
// TERAKHIR per (panel,kode,proses) buat last_operator_nama/last_operator_at, bukan dari history.
//
// Jalankan: node supabase/scripts/fase3_seed_wiring_control_power.mjs [--dry-run]
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
const PROSES_LIST = ['WIRING CONTROL', 'WIRING POWER'];

function pctToStatus(pct) {
  if (pct >= 100) return 'done';
  if (pct > 0) return 'in_progress';
  return 'not_started';
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (tidak menulis apa pun) ===' : '=== JALAN SUNGGUHAN (menulis ke DB) ===');

  const [{ data: panels }, { data: bomRelevanAll }, { data: workOrders }, { data: checkpointsAll }] = await Promise.all([
    supabase.from('panels').select('id,wo_id,tipe,checklist'),
    supabase.from('bom_proses_relevan').select('kode_komponen,tipe_panel,jenis_pekerjaan').in('jenis_pekerjaan', PROSES_LIST),
    supabase.from('work_orders').select('id,is_archived'),
    // progress_checkpoint_log bisa besar (CLAUDE.md A.1) - scope query cuma proses yang relevan
    // dan paginate penuh, jangan andalkan default cap 1000.
    (async () => {
      let all = [], from = 0;
      const PAGE = 1000;
      for (;;) {
        const { data, error } = await supabase.from('progress_checkpoint_log').select('panel_id,kode_komponen,proses,pekerja_nama,ts')
          .in('proses', PROSES_LIST).order('ts', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { data: all };
    })(),
  ]);

  const woArchivedMap = new Map(workOrders.map(w => [w.id, w.is_archived]));
  const relevanSet = new Set(bomRelevanAll.map(r => `${r.kode_komponen}|${r.tipe_panel}|${r.jenis_pekerjaan}`));
  // Checkpoint TERAKHIR per (panel,kode,proses) - data di-order ascending, jadi overwrite
  // berulang di Map otomatis nyisain yang PALING BARU (entry terakhir yang ditulis menang).
  const lastCheckpoint = new Map();
  checkpointsAll.forEach(c => lastCheckpoint.set(`${c.panel_id}|${c.kode_komponen}|${c.proses}`, c));

  const panelAktif = panels.filter(p => !woArchivedMap.get(p.wo_id));
  console.log(`Total panel di DB: ${panels.length}, panel aktif (WO belum diarsip): ${panelAktif.length}`);
  console.log(`Total checkpoint WIRING CONTROL/POWER di progress_checkpoint_log: ${checkpointsAll.length}`);

  let rows = [];
  let panelDiproses = 0, panelDiskip = 0;

  for (const p of panelAktif) {
    const checklist = p.checklist || {};
    const kodeList = Object.entries(checklist).filter(([, cl]) => (cl?.qty || 0) > 0);
    const adaYangRelevan = kodeList.some(([kode]) => PROSES_LIST.some(pr => relevanSet.has(`${kode}|${p.tipe}|${pr}`)));
    if (!adaYangRelevan) { panelDiskip++; continue; }
    panelDiproses++;

    for (const [kode, cl] of kodeList) {
      for (const proses of PROSES_LIST) {
        const relevan = relevanSet.has(`${kode}|${p.tipe}|${proses}`);
        if (!relevan) {
          rows.push({
            panel_id: p.id, kode_komponen: kode, proses, tahap: null,
            status: 'not_applicable', progress_pct: 0, qty_total: cl.qty || 0, qty_done: null,
            photos: [], last_operator_nama: null, last_operator_at: null, sudah_disimpan_100: false,
            updated_at: new Date().toISOString(), updated_by: 'fase3_seed_backfill',
          });
          continue;
        }
        const pct = cl.progress?.[proses] || 0;
        const hist = cl.history?.[proses] || [];
        const sudahDisimpan100 = hist.some(h => h.pct === 100);
        const cp = lastCheckpoint.get(`${p.id}|${kode}|${proses}`);
        rows.push({
          panel_id: p.id, kode_komponen: kode, proses, tahap: null,
          status: pctToStatus(pct), progress_pct: pct, qty_total: cl.qty || 0, qty_done: null,
          photos: [], last_operator_nama: cp?.pekerja_nama || null, last_operator_at: cp?.ts || null,
          sudah_disimpan_100: sudahDisimpan100,
          updated_at: new Date().toISOString(), updated_by: 'fase3_seed_backfill',
        });
      }
    }
  }

  console.log(`Panel diproses: ${panelDiproses}, panel di-skip (WIRING CONTROL/POWER gak relevan sama sekali): ${panelDiskip}`);
  console.log(`Total baris akan di-upsert: ${rows.length}`);
  const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log('Breakdown status:', byStatus);
  console.log('Baris dengan sudah_disimpan_100=true:', rows.filter(r => r.sudah_disimpan_100).length);
  console.log('Baris dengan last_operator_nama terisi:', rows.filter(r => r.last_operator_nama).length);

  if (DRY_RUN) {
    console.log('\nSample baris in_progress/done pertama:');
    console.log(JSON.stringify(rows.filter(r => r.status === 'in_progress' || r.status === 'done').slice(0, 5), null, 2));
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
