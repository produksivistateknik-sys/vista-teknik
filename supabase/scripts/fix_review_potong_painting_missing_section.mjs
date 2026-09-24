// Fix "komponen sudah dikerjakan tapi hilang dari Review Potong/Painting" (24 Sep 2026).
//
// ROOT CAUSE: ReviewPotongView.tsx & ReviewPaintingView.tsx (vista-pekerja) HANYA menampilkan
// history entry POTONG/RENDAM/PAINTING yang punya field `section` (angka) - itu satu-satunya
// jalur simpan yang dimaksudkan buat 3 proses ini sejak FASE 5 (lihat FASE5_PROSES_BIASA_DESIGN.md
// poin 3: tombol "Kunci Progress" per-kartu/lockSingleKomponen SUDAH di-exclude dari 3 proses ini).
// TAPI tombol bulk terpisah "Kunci Progress Hari Ini" (lockProgress, OperatorView.tsx) TIDAK
// dapat exclude yang sama - dia tetap menyapu POTONG (myProses Mekanik) dan RENDAM/PAINTING
// (myProses Painting), menulis history entry POLOS tanpa `section` sama sekali.
//
// Ditemukan live 24 Sep 2026 lewat laporan panel "POS JAGA" (Review Painting) - investigasi
// lanjutan nemu pola sama di Review Potong, terjadi di 35 panel berbeda, mundur sampai
// 24 Juli 2026 (tombol ini dianjurkan dipakai tiap akhir shift, jadi bukan kasus jarang).
//
// FIX KODE (sudah live, vista-pekerja commit 869138e): lockProgress() sekarang otomatis isi
// `section`+`sectionMulai` begitu progress proses itu capai pct=100 lewat tombol bulk ini -
// section number dihitung sekali per proses per klik (cache getAutoSection), konsisten dgn
// simpanSectionPaintingRendam. Proses lain (BENDING/STEL/FINISHING/RAKIT/WIRING/BUSBAR/dst)
// TIDAK disentuh - mereka gak butuh `section` buat tampil di Review.
//
// SCRIPT INI (backfill data LAMA, SUDAH DIJALANKAN sukses 24 Sep 2026 - 357 entry / 35 panel,
// 0 gagal, diverifikasi ulang 0 sisa): nambahin `section`+`sectionMulai` ke history entry LAMA
// yang pct=100 tapi belum pernah punya section - SENGAJA gak nyentuh entry pct<100 (selaras
// scope fix kode, disepakati sama user). Idempotent & aman dijalankan ulang kapan saja (cuma
// menulis kode+proses yang belum punya section, panel lain gak disentuh sama sekali lewat
// merge_panel_checklist RPC - shallow merge per top-level key `checklist[kode]`).
//
// CATATAN (transparansi granularitas): section number dikelompokkan berdasarkan `ts` yang
// IDENTIK PERSIS antar entry (1 ts = dianggap 1 klik/section). Beda dari fix kode yang cache
// 1 ts per KLIK (lintas panel) - lockProgress() historis menulis `ts` per-entry (bukan sekali
// di awal fungsi), jadi entry dari SATU klik yang sama kadang punya ts sedikit berbeda antar
// panel (drift network/async). Akibatnya backfill ini menghasilkan section yang LEBIH BANYAK
// & LEBIH KECIL (lebih "pecah") dibanding kalau 1 klik itu betulan tercatat 1 section besar -
// TIDAK ada data yang hilang/salah, cuma pengelompokan section historisnya tidak identik 1:1
// dengan klik aslinya.
//
// Jalankan: node supabase/scripts/fix_review_potong_painting_missing_section.mjs [--dry-run]
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
const PROSES = ['POTONG', 'RENDAM', 'PAINTING'];

async function fetchAllPanels() {
  let all = [], from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase.from('panels').select('id,nama,checklist').range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  const allPanels = await fetchAllPanels();
  console.log('Total panels:', allPanels.length, DRY_RUN ? '(DRY RUN)' : '');

  const toBackfill = [];
  const existingMaxSection = {};

  allPanels.forEach(p => {
    Object.entries(p.checklist || {}).forEach(([kode, cl]) => {
      PROSES.forEach(proses => {
        const hist = cl?.history?.[proses] || [];
        hist.forEach(h => {
          const key = `${proses}|${h.tanggal}|${h.shift}`;
          if (typeof h.section === 'number') {
            if (!existingMaxSection[key] || h.section > existingMaxSection[key]) existingMaxSection[key] = h.section;
          } else if (h.pct === 100) {
            toBackfill.push({ panelId: p.id, panelNama: p.nama, kode, proses, tanggal: h.tanggal, shift: String(h.shift), ts: h.ts });
          }
        });
      });
    });
  });

  console.log('Entry pct=100 belum punya section:', toBackfill.length);
  if (toBackfill.length === 0) { console.log('Tidak ada yang perlu dibackfill.'); return; }

  const groups = {};
  toBackfill.forEach(e => {
    const key = `${e.proses}|${e.tanggal}|${e.shift}`;
    if (!groups[key]) groups[key] = new Map();
    if (!groups[key].has(e.ts)) groups[key].set(e.ts, []);
    groups[key].get(e.ts).push({ panelId: e.panelId, kode: e.kode, proses: e.proses });
  });

  const assignment = {};
  Object.entries(groups).forEach(([key, tsMap]) => {
    let nextSection = (existingMaxSection[key] || 0) + 1;
    [...tsMap.keys()].sort().forEach(ts => {
      const sectionNum = nextSection++;
      tsMap.get(ts).forEach(({ panelId, kode, proses }) => {
        assignment[`${panelId}|${kode}|${proses}|${ts}`] = { section: sectionNum, sectionMulai: ts };
      });
    });
  });

  console.log('\nRencana per (proses|tanggal|shift):');
  Object.entries(groups).forEach(([key, tsMap]) => {
    console.log(' ', key, '-> existing max:', existingMaxSection[key] || 0, '| +', tsMap.size, 'section baru (', [...tsMap.values()].reduce((s, a) => s + a.length, 0), 'entry)');
  });

  if (DRY_RUN) { console.log('\n--dry-run: tidak menulis apapun.'); return; }

  const byPanel = new Map();
  toBackfill.forEach(e => {
    if (!byPanel.has(e.panelId)) byPanel.set(e.panelId, new Set());
    byPanel.get(e.panelId).add(e.kode);
  });

  let panelsPatched = 0, entriesPatched = 0;
  const failed = [];
  for (const [panelId, kodeSet] of byPanel) {
    const { data: freshPanel, error: freshErr } = await supabase.from('panels').select('checklist').eq('id', panelId).single();
    if (freshErr || !freshPanel) { failed.push({ panelId, error: freshErr }); continue; }
    const cl = freshPanel.checklist || {};
    const partial = {};
    for (const kode of kodeSet) {
      const komponenCl = cl[kode];
      if (!komponenCl) continue;
      let kodeChanged = false;
      const newHistory = { ...(komponenCl.history || {}) };
      PROSES.forEach(proses => {
        const hist = newHistory[proses];
        if (!Array.isArray(hist)) return;
        let prosesChanged = false;
        const newHist = hist.map(h => {
          const k = `${panelId}|${kode}|${proses}|${h.ts}`;
          if (typeof h.section !== 'number' && h.pct === 100 && assignment[k]) {
            prosesChanged = true;
            entriesPatched++;
            return { ...h, section: assignment[k].section, sectionMulai: assignment[k].sectionMulai };
          }
          return h;
        });
        if (prosesChanged) { newHistory[proses] = newHist; kodeChanged = true; }
      });
      if (kodeChanged) partial[kode] = { ...komponenCl, history: newHistory };
    }
    if (Object.keys(partial).length === 0) continue;
    const { error: writeErr } = await supabase.rpc('merge_panel_checklist', { p_panel_id: panelId, p_partial: partial });
    if (writeErr) { failed.push({ panelId, error: writeErr }); console.error('WRITE ERROR panel', panelId, writeErr); }
    else panelsPatched++;
  }

  console.log('\nHasil: panel dipatch =', panelsPatched, '| entry dipatch =', entriesPatched, '| gagal =', failed.length);
  if (failed.length) console.error(failed);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
