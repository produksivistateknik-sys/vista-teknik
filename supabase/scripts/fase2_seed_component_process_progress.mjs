// Fase 2 (21 Sep 2026) - backfill SEKALI JALAN component_process_progress dari data checklist
// yang sudah ada, domain PASANG KOMPONEN saja. Idempotent (upsert ON CONFLICT) - aman dijalankan
// ulang kalau perlu (mis. ada panel baru yang belum ke-cover).
//
// Scope: panel AKTIF (WO belum diarsip) yang punya MINIMAL 1 kode relevan ke PASANG KOMPONEN
// (via bom_proses_relevan). Panel yang PASANG KOMPONEN-nya gak relevan sama sekali (semua kode
// gak punya baris jenis_pekerjaan='PASANG KOMPONEN') di-SKIP total - gak ada gunanya nyeed
// not_applicable doang buat panel yang emang gak pernah bakal disentuh tab ini.
//
// Jalankan: node supabase/scripts/fase2_seed_component_process_progress.mjs [--dry-run]
//
// Cara pakai .env.local vista-teknik (URL project sama, anon key sama - 1 project Supabase
// dipakai kedua app vista-teknik & vista-pekerja).
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

const PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA = ["Box Control", "Pintu"]; // mirror panelHelpers.tsx

function pctToStatus(pct) {
  if (pct >= 100) return 'done';
  if (pct > 0) return 'in_progress';
  return 'not_started';
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (tidak menulis apa pun) ===' : '=== JALAN SUNGGUHAN (menulis ke DB) ===');

  const [{ data: panels }, { data: bomMaster }, { data: bomRelevan }, { data: workOrders }, { data: arsipRows }] = await Promise.all([
    supabase.from('panels').select('id,wo_id,nama,tipe,checklist,pasang_komponen_photos'),
    supabase.from('bom_master').select('kode_komponen,nama_komponen,tipe_panel'),
    supabase.from('bom_proses_relevan').select('kode_komponen,tipe_panel,jenis_pekerjaan').eq('jenis_pekerjaan', 'PASANG KOMPONEN'),
    supabase.from('work_orders').select('id,is_archived'),
    supabase.from('panel_seksi_archived').select('panel_id,seksi,kode,data').in('seksi', ['assembling_luar', 'wiring_control']),
  ]);

  const woArchivedMap = new Map(workOrders.map(w => [w.id, w.is_archived]));
  const namaMap = new Map(bomMaster.map(b => [`${b.tipe_panel}|${b.kode_komponen}`, b.nama_komponen]));
  const relevanSet = new Set(bomRelevan.map(r => `${r.kode_komponen}|${r.tipe_panel}`));
  const arsipMap = new Map(); // `${panelId}|${seksi}|${kode}` -> data
  arsipRows.forEach(r => arsipMap.set(`${r.panel_id}|${r.seksi}|${r.kode}`, r.data));

  const panelAktif = panels.filter(p => !woArchivedMap.get(p.wo_id));
  console.log(`Total panel di DB: ${panels.length}, panel aktif (WO belum diarsip): ${panelAktif.length}`);

  let rows = [];
  let panelDiproses = 0, panelDiskip = 0;

  for (const p of panelAktif) {
    const checklist = p.checklist || {};
    const kodeList = Object.entries(checklist).filter(([, cl]) => (cl?.qty || 0) > 0);
    const adaYangRelevan = kodeList.some(([kode]) => relevanSet.has(`${kode}|${p.tipe}`));
    if (!adaYangRelevan) { panelDiskip++; continue; }
    panelDiproses++;

    for (const [kode, cl] of kodeList) {
      const nama = namaMap.get(`${p.tipe}|${kode}`) || kode;
      const relevan = relevanSet.has(`${kode}|${p.tipe}`);
      const isTahap = PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA.includes(nama);

      if (!relevan) {
        rows.push({
          panel_id: p.id, kode_komponen: kode, proses: 'PASANG KOMPONEN', tahap: null,
          status: 'not_applicable', progress_pct: 0, qty_total: cl.qty || 0, qty_done: null,
          photos: [], last_operator_nama: null, last_operator_at: null, sudah_disimpan_100: false,
          updated_at: new Date().toISOString(), updated_by: 'fase2_seed_backfill',
        });
        continue;
      }

      if (isTahap) {
        const tahapData = cl.pasangKomponenTahap?.WIRING;
        const pct = tahapData?.progress || 0;
        const arsipData = arsipMap.get(`${p.id}|wiring_control|${kode}`);
        const arsipPct = arsipData?.pasangKomponenTahap?.WIRING?.progress;
        const sudahDisimpan100 = typeof arsipPct === 'number' && arsipPct === pct && pct >= 100;
        rows.push({
          panel_id: p.id, kode_komponen: kode, proses: 'PASANG KOMPONEN', tahap: 'WIRING',
          status: pctToStatus(pct), progress_pct: pct, qty_total: cl.qty || 0, qty_done: null,
          photos: cl.fotoPemasangan || [], last_operator_nama: tahapData?.lastOperator?.nama || null,
          last_operator_at: tahapData?.lastOperator?.ts || null, sudah_disimpan_100: sudahDisimpan100,
          updated_at: new Date().toISOString(), updated_by: 'fase2_seed_backfill',
        });
      } else {
        const pct = cl.progress?.['PASANG KOMPONEN'] || 0;
        const arsipData = arsipMap.get(`${p.id}|assembling_luar|${kode}`);
        const arsipPct = arsipData?.progress;
        const sudahDisimpan100 = typeof arsipPct === 'number' && arsipPct === pct && pct >= 100;
        rows.push({
          panel_id: p.id, kode_komponen: kode, proses: 'PASANG KOMPONEN', tahap: null,
          status: pctToStatus(pct), progress_pct: pct, qty_total: cl.qty || 0, qty_done: null,
          photos: cl.fotoPemasangan || [], last_operator_nama: cl.pasangKomponenLastOperator?.nama || null,
          last_operator_at: cl.pasangKomponenLastOperator?.ts || null, sudah_disimpan_100: sudahDisimpan100,
          updated_at: new Date().toISOString(), updated_by: 'fase2_seed_backfill',
        });
      }
    }
  }

  console.log(`Panel diproses: ${panelDiproses}, panel di-skip (PASANG KOMPONEN gak relevan sama sekali): ${panelDiskip}`);
  console.log(`Total baris akan di-upsert: ${rows.length}`);
  const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log('Breakdown status:', byStatus);
  const doneCount = rows.filter(r => r.sudah_disimpan_100).length;
  console.log('Baris dengan sudah_disimpan_100=true:', doneCount);

  if (DRY_RUN) {
    console.log('\nSample 5 baris pertama:');
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    return;
  }

  // Batch upsert per 200 baris (jauh di bawah limit 1000 row Supabase, CLAUDE.md A.1)
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
