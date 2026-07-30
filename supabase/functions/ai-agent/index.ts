/*
AI Assistant (Vista Teknik) - v1 READ-ONLY - provider: GEMINI API (Google).

REVISI: sebelumnya dibangun pakai Anthropic Claude API (nama function lama: ai-assistant),
DIGANTI ke Gemini API karena skala pemakaian gak sering - Gemini free tier cukup. Function
INI (ai-agent) gantiin ai-assistant sepenuhnya - ai-assistant boleh dihapus setelah revisi
ini dikonfirmasi jalan.

Edge Function generik yang jadi "otak" chat AI: terima riwayat percakapan dari frontend
(format native Gemini: {role:'user'|'model', parts:[...]}), panggil Gemini generateContent
API dengan daftar tools (functionDeclarations) di bawah, jalankan tool-use loop (kalau Gemini
minta panggil function, eksekusi query Supabase yang sesuai, kirim hasilnya balik sebagai
functionResponse, ulangi sampai Gemini kasih jawaban teks final), balikin jawaban akhir +
riwayat pesan terbaru ke frontend. STATELESS - frontend yang nyimpen riwayat percakapan,
gak ada sesi server-side.

KEPUTUSAN API SURFACE: Google punya 2 surface - "Interactions API" (baru, direkomendasikan
Google buat proyek baru, TAPI didesain stateful by default via previous_interaction_id/store,
dan skema function-calling persisnya gak konsisten antar sumber dokumentasi resmi pas dicek)
vs "generateContent API" (disebut "Legacy" di dokumentasi TAPI BUKAN deprecated, tetap
didukung penuh, skemanya jelas & terverifikasi: functionDeclarations/functionCall/
functionResponse). DIPILIH generateContent karena arsitekturnya cocok natural sama desain
stateless kita (frontend nyimpen histori, backend gak nyimpen sesi apapun), beda dari
Interactions API yang stateful-by-default dan butuh kerja ekstra buat dipaksa stateless.

SEMUA TOOL WAJIB READ-ONLY (SELECT doang, gak ada INSERT/UPDATE/DELETE/RPC yang ubah data) -
ini prinsip inti v1, jangan dilanggar pas nambah tool baru. Pakai SUPABASE_ANON_KEY (bukan
service-role) buat baca data.

TOOL_IMPL (logic query aktual) di-copy PERSIS dari ai-assistant/index.ts - REVISI INI CUMA
GANTI CARA MENDEFINISIKAN TOOL KE API (dari format Anthropic input_schema ke format Gemini
functionDeclarations/parameters) dan cara manggil provider-nya (Gemini REST vs Anthropic
REST) - logic query-nya sendiri TIDAK BERUBAH SAMA SEKALI.

TIDAK PAKAI SDK (@google/genai dkk) - dipanggil via fetch() langsung ke REST API, sama
kayak keputusan pas versi Claude kemarin. Alasan sama: Edge Function jalan di Deno (bukan
Node), SDK resmi provider sering punya dependency khusus Node yang beresiko gak kompatibel
di runtime Deno edge function - fetch() langsung ke REST API menghindari resiko itu sama
sekali, dan udah terbukti jalan lancar buat Anthropic sebelumnya.

FASE 0-5: 15 tool baca (query_wo_status s/d query_riwayat_lengkap_panel) dibangun bertahap,
semua strict read-only lewat anon key.

REVISI: ditambah tool ke-16, `generate_export` - SATU-SATUNYA tool yang nulis, tapi cuma ke
storage bucket 'ai-exports' (bukan tabel produksi apapun), pakai SUPABASE_SERVICE_ROLE_KEY
TERPISAH khusus buat operasi ini (client `supabase` anon-key yang dipakai 15 tool baca lain
TETAP gak pernah dikasih privilege tulis). Generate file dari data yang UDAH ditarik tool lain
di percakapan yang sama (gak query ulang), upload ke storage, balikin signed URL (7 hari) -
cleanup file lama dilakukan opportunistic tiap generate_export dipanggil (bukan cron
terpisah). Library: exceljs (xlsx), pdf-lib (pdf, dipilih drpd pdfmake karena isomorphic/gak
ada dependency native), docx (docx) - semua diimport via npm: specifier (didukung native sama
Supabase Edge Functions, gak perlu esm.sh).

SETUP WAJIB SEBELUM DIPAKAI: secret GEMINI_API_KEY harus di-set manual (BUKAN lewat
percakapan - biar API key gak kesimpen di riwayat chat), via Supabase Dashboard ->
Edge Functions -> Manage secrets, atau `npx supabase secrets set GEMINI_API_KEY=xxxxx`
dijalankan di terminal sendiri (bukan di sesi ini).
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Library generate dokumen buat tool generate_export - lewat npm: specifier. SEMPAT dicoba
// dynamic import (di dalam generateXxxBuffer, bukan top-level) biar gak kena cold-start
// penalty pas request gak sentuh generate_export - TAPI ternyata malah bikin function MACET
// TOTAL (curl timeout 90s, 0 bytes, bahkan buat request yang gak butuh library ini sama
// sekali) - kemungkinan besar Deno edge runtime gak bisa resolve npm: import dinamis saat
// runtime (beda dari static import yang di-bundle ke eszip pas deploy). BALIK ke static
// import di top-level - ATURANNYA: cold start ~33 detik (diverifikasi, bukan ideal tapi
// FUNGSIONAL), jauh lebih baik daripada macet total. Kalau nanti mau optimasi cold-start,
// pertimbangkan Edge Function TERPISAH khusus generate_export (biar function chat utama gak
// kebawa beban bundling library dokumen).
import ExcelJS from 'npm:exceljs@4'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, Footer, AlignmentType } from 'npm:docx@8'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

const fetchAll = async (supabase: any, table: string, select: string) => {
  let all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}

// ================= Ported dari src/lib (Deno gak bisa import lintas src/ Vite) =================
// Sama persis dengan yang ada di ai-assistant/index.ts - lihat komentar di file itu buat
// detail simplifikasi (fallback KOMPONEN_PROSES_MAP statis sengaja gak diporting).

const ALL_PROSES = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'RENDAM', 'PAINTING', 'RAKIT', 'PASANG KOMPONEN', 'BUSBAR', 'WIRING CONTROL', 'WIRING POWER', 'QC TEST', 'PACKING']
const PROSES_TANPA_MAPPING_KOMPONEN = ['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const PROSES_ORANG = ['WIRING CONTROL', 'WIRING POWER']
const PROSES_TANPA_CASCADE = ['BUSBAR']
// Sama persis PROSES_EXCLUDE_OUTSTANDING di OutstandingView.tsx - proses whole-panel/penanda,
// bukan per-komponen, jadi gak relevan buat daftar "outstanding" per-kode.
const PROSES_EXCLUDE_OUTSTANDING = ['BUSBAR', 'QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const MAX_CASCADE_HARI = 90

const addDaysStr = (date: string, n: number) => {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// Sama persis naturalKodeSort di auto-geser-harian/index.ts (yang juga direplikasi dari
// src/lib/panelHelpers.ts) - Deno gak bisa import lintas function/src.
const naturalKodeSort = (a: string, b: string) => {
  const parse = (k: string) => {
    const m = String(k).match(/^(.*?)(\d+)$/)
    return m ? { prefix: m[1], num: parseInt(m[2], 10) } : { prefix: k, num: 0 }
  }
  const pa = parse(a), pb = parse(b)
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  return pa.num - pb.num
}

const getLocalDateStr = () => new Date().toISOString().slice(0, 10)
const isDelayed = (t: string) => !!t && t < getLocalDateStr()
const isUrgent = (t: string) => {
  if (!t) return false
  const d = Math.ceil((new Date(t).getTime() - new Date(getLocalDateStr()).getTime()) / 86400000)
  return d >= 0 && d <= 7
}

const getProgressFromHistory = (cl: any, proses: string): number => {
  const hist = cl?.history?.[proses]
  if (hist && hist.length > 0) {
    const sorted = [...hist].sort((a: any, b: any) => (b.ts || b.tanggal || '').localeCompare(a.ts || a.tanggal || ''))
    return sorted[0].pct || 0
  }
  return -1
}
const getLatestProgress = (cl: any, proses: string): number => {
  const byDate = cl?.progressByDate?.[proses]
  if (byDate && Object.keys(byDate).length > 0) {
    const dates = Object.keys(byDate).sort()
    return byDate[dates[dates.length - 1]]
  }
  return cl?.progress?.[proses] || 0
}
const getBestProgress = (cl: any, proses: string): number => {
  const fromHist = getProgressFromHistory(cl, proses)
  if (fromHist >= 0) return fromHist
  const fromDate = getLatestProgress(cl, proses)
  if (fromDate > 0) return fromDate
  return cl?.progress?.[proses] || 0
}

const isKomponenRelevant = (kode: string, tipe: string, proses: string, relevanSet: Set<string>, hasMappingSet: Set<string>): boolean => {
  if (PROSES_TANPA_MAPPING_KOMPONEN.includes(proses)) return true
  const mapKey = `${kode}|${tipe}`
  if (hasMappingSet.has(mapKey)) return relevanSet.has(`${kode}|${tipe}|${proses}`)
  return true
}

const calcPanelProgress = (panel: any, relevanSet: Set<string>, hasMappingSet: Set<string>): Record<string, number> => {
  const checklist = panel.checklist || {}
  const active = Object.keys(checklist).filter((kode) => (checklist[kode]?.qty || 0) > 0)
  const prog: Record<string, number> = {}
  if (active.length === 0) {
    ALL_PROSES.forEach((pr) => (prog[pr] = 0))
    return prog
  }
  ALL_PROSES.forEach((pr) => {
    const relevantActive = active.filter((kode) => isKomponenRelevant(kode, panel.tipe, pr, relevanSet, hasMappingSet))
    const itemsForCalc = relevantActive.length > 0 ? relevantActive : active
    const vals = itemsForCalc.map((kode) => getBestProgress(checklist[kode], pr))
    prog[pr] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  })
  return prog
}

// Lookup panel by nama (partial match) + proyek opsional (buat disambiguasi kalau nama sama
// dipakai di beberapa WO/proyek) - dipakai bareng oleh semua tool yang butuh "SATU panel
// spesifik". Panel di seluruh DB cuma puluhan baris, jadi fetch-all + filter client-side
// lebih simpel daripada embedded-filter PostgREST.
async function findPanels(supabase: any, namaPanel: string, proyek?: string) {
  const panels = await fetchAll(supabase, 'panels', '*')
  const wos = await fetchAll(supabase, 'work_orders', 'id,wo,proyek')
  const woMap: Record<string, any> = {}
  wos.forEach((w: any) => (woMap[String(w.id)] = w))
  const q = (namaPanel || '').toLowerCase().trim()
  const proyekQ = (proyek || '').toLowerCase().trim()
  const matches = panels
    .filter((p: any) => {
      if (!p.nama || !p.nama.toLowerCase().includes(q)) return false
      if (proyekQ) {
        const wo = woMap[String(p.wo_id)]
        if (!wo || !(wo.proyek || '').toLowerCase().includes(proyekQ)) return false
      }
      return true
    })
    .map((p: any) => ({ ...p, __wo: woMap[String(p.wo_id)] }))
  return matches
}

// Fuzzy search pakai pg_trgm (similarity trigram, function SQL search_panel_fuzzy/
// search_proyek_fuzzy - lihat migrasi terkait) - dipanggil kalau exact/substring match gak
// ketemu apa-apa, biar bisa nyaranin nama yang mirip (termasuk typo) alih-alih langsung
// nyerah atau (lebih parah) nge-dump semua data yang gak relevan.
async function fuzzySearchPanel(supabase: any, term: string) {
  const { data, error } = await supabase.rpc('search_panel_fuzzy', { search_term: term })
  if (error) { console.error('fuzzySearchPanel error:', error); return [] }
  return data || []
}
async function fuzzySearchProyek(supabase: any, term: string) {
  const { data, error } = await supabase.rpc('search_proyek_fuzzy', { search_term: term })
  if (error) { console.error('fuzzySearchProyek error:', error); return [] }
  return data || []
}
// Cross-check DUA ARAH: kalau user nyebut nama yang ternyata gak ketemu di satu kategori
// (misal dicari sebagai panel), cek juga kategori LAIN (proyek) - INI YANG FIX bug utama:
// AI sebelumnya cuma nyoba satu kategori terus nyerah/dump semua data kalau gagal, gak
// pernah nyoba kategori lain padahal namanya ada di sana. Sekalian kasih saran nama mirip
// dari trigram similarity kalau memang gak ketemu di manapun.
async function noMatchHint(supabase: any, term: string): Promise<string[]> {
  const [panelFuzzy, proyekFuzzy] = await Promise.all([fuzzySearchPanel(supabase, term), fuzzySearchProyek(supabase, term)])
  const hints: string[] = []
  if (panelFuzzy.length > 0) hints.push(`Mirip nama PANEL: ${panelFuzzy.slice(0, 5).map((p: any) => `'${p.nama}'`).join(', ')} - kalau ini yang dimaksud, coba tool berbasis panel (query_progress_panel dkk).`)
  if (proyekFuzzy.length > 0) hints.push(`Mirip nama PROYEK: ${proyekFuzzy.slice(0, 5).map((p: any) => `'${p.proyek}' (WO ${p.wo})`).join(', ')} - kalau ini yang dimaksud, coba tool berbasis proyek (query_wo_status dkk).`)
  return hints
}

// Kalau nama_panel gak ketemu / ambigu, balikin bentuk hasil yang SAMA di semua tool
// berbasis-panel (error + daftar kandidat) - biar Gemini bisa minta klarifikasi ke user
// dengan cara yang konsisten, bukan pesan error yang beda-beda tiap tool.
async function panelLookupError(supabase: any, matches: any[], namaPanel: string) {
  if (matches.length === 0) {
    const saran = await noMatchHint(supabase, namaPanel)
    return { error: `Panel dengan nama mengandung '${namaPanel}' gak ditemukan.`, ...(saran.length > 0 ? { saran } : {}) }
  }
  return {
    error: `Ada ${matches.length} panel yang cocok, sebutkan proyek buat lebih spesifik.`,
    kandidat: matches.slice(0, 10).map((p: any) => ({ nama: p.nama, tipe: p.tipe, proyek: p.__wo?.proyek, wo: p.__wo?.wo })),
  }
}

// Hitung "unit yang lagi bersaing kapasitas" buat SATU proses di SATU tanggal - PERSIS
// prinsip yang sama kayak FASE 2 existingUnits gathering di auto-geser-harian/index.ts
// (termasuk FIX INSIDEN 30 Jul 2026: kode yang progress-nya udah 100% ATAU udah jejak
// digeserKe gak ikut dihitung). Dipakai bareng oleh query_capacity_harian (buat jumlahin
// total demand = "kapasitas terpakai") dan simulate_estimasi_selesai (buat jadi pool
// kompetitor yang mesti dikalahkan candidate baru).
// Dipecah jadi 2 fungsi (fetch sekali + compute per-tanggal) biar analyze_trend bisa iterasi
// banyak tanggal TANPA fetch ulang raw_schedule/panels/process_time tiap hari - data-data itu
// gak berubah dalam SATU invocation tool, cuma tanggal yang divariasikan.
async function fetchProsesContext(supabase: any, proses: string) {
  const isOrang = PROSES_ORANG.includes(proses)
  const rawRows = (await fetchAll(supabase, 'raw_schedule', 'id,panel_id,proses,schedule')).filter((r: any) => r.proses === proses)
  const panelIds = [...new Set(rawRows.map((r: any) => r.panel_id).filter(Boolean))]
  const panels = panelIds.length ? (await fetchAll(supabase, 'panels', 'id,tipe,wo_id,checklist')).filter((p: any) => panelIds.includes(p.id)) : []
  const panelMap: Record<string, any> = {}
  panels.forEach((p: any) => (panelMap[String(p.id)] = p))
  const woIds = [...new Set(panels.map((p: any) => p.wo_id).filter(Boolean))]
  const wos = woIds.length ? (await fetchAll(supabase, 'work_orders', 'id,target')).filter((w: any) => woIds.includes(w.id)) : []
  const woTargetMap: Record<string, string> = {}
  wos.forEach((w: any) => (woTargetMap[String(w.id)] = w.target || '9999-99-99'))
  const ptRows = (await fetchAll(supabase, 'fcs_process_time', 'tipe_panel,kode_komponen,jenis_pekerjaan,menit_per_pcs,is_active')).filter((r: any) => r.is_active)
  const ptMap: Record<string, number> = {}
  ptRows.forEach((r: any) => (ptMap[`${r.tipe_panel}|${r.kode_komponen}|${r.jenis_pekerjaan}`] = Number(r.menit_per_pcs) || 0))
  return { isOrang, rawRows, panelMap, woTargetMap, ptMap }
}

function computeUnitsForDateFromCtx(ctx: any, tanggal: string, proses: string) {
  const { isOrang, rawRows, panelMap, woTargetMap, ptMap } = ctx
  const isJejakKode = (entry: any, kode: string) => !!(entry?.digeserKe && entry.digeserKe[kode])
  const units: { id: string; demand: number; woTarget: string; sortKode: string }[] = []

  rawRows.forEach((row: any) => {
    const entries = row.schedule?.[tanggal] || []
    if (entries.length === 0) return
    const panel = panelMap[String(row.panel_id)]
    if (!panel) return
    const checklist = panel.checklist || {}
    const woTarget = woTargetMap[String(panel.wo_id)] || '9999-99-99'
    entries.forEach((e: any) => {
      if (isOrang) {
        const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_'))
        if (!token) return
        const m = token.match(/^__wiring_(\d+)org_/)
        const orang = m ? parseInt(m[1], 10) : 1
        const adaAktif = (e.komponen || []).some((k: string) => !k.startsWith('__wiring_') && !isJejakKode(e, k) && (checklist[k]?.progress?.[proses] || 0) < 100)
        if (!adaAktif) return
        units.push({ id: `${row.id}_${e.wp}`, demand: orang, woTarget, sortKode: e.wp })
      } else {
        ;(e.komponen || []).forEach((kode: string) => {
          if (kode.startsWith('__wiring_')) return
          if (isJejakKode(e, kode)) return
          const cl = checklist[kode]
          if ((cl?.progress?.[proses] || 0) >= 100) return
          const qtyTotal = Number(cl?.qty) || 0
          const qtyProsesSkrg = Number(cl?.qtyProses?.[proses]) || 0
          const qtySisa = Math.max(0, qtyTotal - qtyProsesSkrg)
          const menit = qtySisa * (ptMap[`${panel.tipe}|${kode}|${proses}`] || 0)
          units.push({ id: `${row.id}_${e.wp}_${kode}`, demand: menit, woTarget, sortKode: kode })
        })
      }
    })
  })
  return units
}

async function computeExistingUnitsForProses(supabase: any, tanggal: string, proses: string) {
  const ctx = await fetchProsesContext(supabase, proses)
  return computeUnitsForDateFromCtx(ctx, tanggal, proses)
}

// Versi ringkas cascadePlace dari auto-geser-harian/index.ts - ALGORITMA SAMA PERSIS (sort
// prioritas woTarget->kode, terima greedy sampai kapasitas abis, sisanya overflow ke hari
// berikutnya, ulang sampai MAX_CASCADE_HARI) - CUMA balikin tanggal final buat SATU unit
// (candidateId) yang kita mau tau, bukan placement semua unit sekaligus (gak perlu buat
// simulasi read-only). Prinsip inti "jangan biarkan LLM menghitung sendiri" tetap terjaga -
// ini fungsi deterministik, sama kayak yang beneran dipakai auto-geser-harian buat nulis data.
function cascadePlaceSimple(mulaiTanggal: string, unitsAwal: { id: string; demand: number; woTarget: string; sortKode: string }[], getCap: (tanggal: string) => number | null, candidateId: string): string {
  const priorityCompare = (a: any, b: any) => {
    if (a.woTarget !== b.woTarget) return a.woTarget < b.woTarget ? -1 : 1
    return naturalKodeSort(a.sortKode, b.sortKode)
  }
  let pool = unitsAwal.slice()
  let tanggal = mulaiTanggal
  let hari = 0
  while (pool.length > 0 && hari < MAX_CASCADE_HARI) {
    const kapasitasUnit = getCap(tanggal)
    if (!kapasitasUnit || kapasitasUnit <= 0) {
      tanggal = addDaysStr(tanggal, 1); hari++; continue
    }
    const sorted = pool.slice().sort(priorityCompare)
    let cum = 0
    const diterima: any[] = []
    const overflow: any[] = []
    sorted.forEach((u) => {
      if (diterima.length === 0 || cum + u.demand <= kapasitasUnit) { diterima.push(u); cum += u.demand }
      else overflow.push(u)
    })
    if (diterima.some((u) => u.id === candidateId)) return tanggal
    pool = overflow
    tanggal = addDaysStr(tanggal, 1); hari++
  }
  return tanggal
}

// ================= generate_export: bikin file dari data yang udah ditarik tool lain =================
// SATU-SATUNYA tool yang nulis (ke storage bucket 'ai-exports' - bukan ke database produksi
// apapun). Pakai SERVICE_ROLE_KEY khusus buat operasi storage ini (anon key yang dipakai 15
// tool baca lainnya TETAP gak punya privilege tulis apapun) - jadi kalau nanti ada bug di
// tool baca manapun, gak ada jalan buat nulis data lewat situ sama sekali.

const EXPORT_BUCKET = 'ai-exports'
const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 hari

// Cleanup OPPORTUNISTIC (bukan cron terpisah) - tiap generate_export dipanggil, sekalian buang
// file yang udah lewat retensi. Cukup buat skala pemakaian internal yang jarang; gak fatal
// kalau gagal (network dsb), makanya di-try/catch sendiri biar gak gagalin export yang lagi
// diminta user.
async function cleanupOldExports(serviceClient: any) {
  try {
    const { data: files, error } = await serviceClient.storage.from(EXPORT_BUCKET).list('', { limit: 1000 })
    if (error || !files) return
    const now = Date.now()
    const toDelete = files
      .filter((f: any) => {
        const created = f.created_at ? new Date(f.created_at).getTime() : 0
        return created > 0 && now - created > EXPORT_RETENTION_MS
      })
      .map((f: any) => f.name)
    if (toDelete.length > 0) await serviceClient.storage.from(EXPORT_BUCKET).remove(toDelete)
  } catch (e) {
    console.error('cleanupOldExports gagal (diabaikan, gak fatal):', e)
  }
}

function normalizeRows(data: any[]): { headers: string[]; rows: any[] } {
  const headers = Object.keys(data[0] || {})
  return { headers, rows: data }
}

// Header kolom di data biasanya snake_case (nama field, misal 'jumlah_panel',
// 'progress_keseluruhan_pct') - gak enak dibaca di dokumen jadi. Dipakai di SEMUA 3 format
// (xlsx/pdf/docx) biar konsisten - data-nya tetap diakses lewat key asli (snake_case), cuma
// LABEL yang ditampilkan yang dihumanize.
function humanizeHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

async function generateExcelBuffer(data: any[], judul: string): Promise<Uint8Array> {
  const { headers, rows } = normalizeRows(data)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet((judul || 'Data').slice(0, 31) || 'Data')
  const headerRow = ws.addRow(headers.map(humanizeHeader))
  headerRow.font = { bold: true, color: { argb: 'FF1E293B' } }
  headerRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } }
  })
  rows.forEach((row, i) => {
    const r = ws.addRow(headers.map((h) => row[h] ?? ''))
    if (i % 2 === 1) r.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })
  })
  ws.columns.forEach((col: any) => { col.width = 20 })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}

async function generatePdfBuffer(data: any[], judul: string): Promise<Uint8Array> {
  const { headers, rows } = normalizeRows(data)
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 842, pageHeight = 595 // A4 landscape (points) - lebih muat buat tabel lebar
  const margin = 36
  const footerReserve = 26 // ruang disisain di bawah buat footer, gak boleh ketiban baris tabel
  const fontSize = 9
  const rowHeight = 20
  const headerHumanized = headers.map(humanizeHeader)

  // Deteksi kolom numerik (semua nilai non-kosong berupa angka) - dipakai buat rata kanan,
  // konsisten sama konvensi tabel angka pada umumnya.
  const isNumericCol = headers.map((h) => rows.every((r: any) => r[h] === null || r[h] === undefined || r[h] === '' || !isNaN(Number(r[h]))))

  // Lebar kolom DINAMIS dari isi konten (header + semua baris) - bukan rata sama rata kayak
  // sebelumnya (yang bikin kolom pendek kosong melompong, kolom panjang kepotong). Discale
  // proporsional kalau totalnya kelebihan lebar halaman, atau disebar rata kalau sisa ruang.
  const tableWidth = pageWidth - margin * 2
  const MIN_COL_W = 50
  const rawWidths = headers.map((h, i) => {
    const headerW = fontBold.widthOfTextAtSize(headerHumanized[i], fontSize)
    const maxCellW = rows.reduce((mx: number, r: any) => {
      const text = r[h] === null || r[h] === undefined ? '' : String(r[h])
      return Math.max(mx, font.widthOfTextAtSize(text, fontSize))
    }, 0)
    return Math.max(MIN_COL_W, headerW, maxCellW) + 16
  })
  const totalRaw = rawWidths.reduce((a, b) => a + b, 0)
  const colWidths =
    totalRaw > tableWidth
      ? rawWidths.map((w) => (w / totalRaw) * tableWidth)
      : rawWidths.map((w) => w + (tableWidth - totalRaw) / headers.length)
  const colX: number[] = []
  ;(() => { let acc = margin; colWidths.forEach((w) => { colX.push(acc); acc += w }) })()

  const truncateToWidth = (text: string, maxW: number, f: any, size: number) => {
    if (f.widthOfTextAtSize(text, size) <= maxW) return text
    let t = text
    while (t.length > 1 && f.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1)
    return t + '…'
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const drawHeaderRow = () => {
    page.drawRectangle({ x: margin, y: y - rowHeight + 6, width: tableWidth, height: rowHeight, color: rgb(0.89, 0.92, 0.96) })
    headerHumanized.forEach((h, i) => {
      const text = truncateToWidth(h, colWidths[i] - 8, fontBold, fontSize)
      page.drawText(text, { x: colX[i] + 4, y: y - rowHeight + 12, size: fontSize, font: fontBold, color: rgb(0.12, 0.16, 0.22) })
    })
    y -= rowHeight
    page.drawLine({ start: { x: margin, y }, end: { x: margin + tableWidth, y }, thickness: 1, color: rgb(0.58, 0.64, 0.72) })
  }
  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
    drawHeaderRow()
  }

  page.drawText(judul || 'Export', { x: margin, y, size: 15, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  y -= 28
  drawHeaderRow()

  rows.forEach((row: any, rowIdx: number) => {
    if (y < margin + footerReserve + rowHeight) newPage()
    if (rowIdx % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - rowHeight + 6, width: tableWidth, height: rowHeight, color: rgb(0.97, 0.98, 0.99) })
    }
    headers.forEach((h, i) => {
      const val = row[h]
      const text = truncateToWidth(val === null || val === undefined ? '' : String(val), colWidths[i] - 8, font, fontSize)
      const textW = font.widthOfTextAtSize(text, fontSize)
      const xPos = isNumericCol[i] ? colX[i] + colWidths[i] - 8 - textW : colX[i] + 4
      page.drawText(text, { x: xPos, y: y - rowHeight + 12, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) })
    })
    page.drawLine({ start: { x: margin, y: y - rowHeight + 6 }, end: { x: margin + tableWidth, y: y - rowHeight + 6 }, thickness: 0.5, color: rgb(0.88, 0.9, 0.93) })
    y -= rowHeight
  })

  // Footer di SETIAP halaman - baru bisa ditulis di sini (bukan sambil jalan) karena total
  // halaman baru diketahui setelah semua baris selesai di-layout.
  const allPages = pdfDoc.getPages()
  allPages.forEach((p: any, i: number) => {
    p.drawText(`Digenerate ${getLocalDateStr()} - AI Assistant Vista Teknik  |  Halaman ${i + 1} dari ${allPages.length}`, {
      x: margin, y: margin - 14, size: 7.5, font, color: rgb(0.55, 0.58, 0.64),
    })
  })

  return await pdfDoc.save()
}

async function generateDocxBuffer(data: any[], judul: string): Promise<Uint8Array> {
  const { headers, rows } = normalizeRows(data)
  const isNumericCol = headers.map((h) => rows.every((r: any) => r[h] === null || r[h] === undefined || r[h] === '' || !isNaN(Number(r[h]))))

  const headerCells = headers.map(
    (h, i) =>
      new TableCell({
        children: [new Paragraph({ alignment: isNumericCol[i] ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: humanizeHeader(h), bold: true, color: '1E293B' })] })],
        shading: { fill: 'E2E8F0' },
      })
  )
  const bodyRows = rows.map(
    (row: any, rowIdx: number) =>
      new TableRow({
        children: headers.map(
          (h, i) =>
            new TableCell({
              children: [new Paragraph({ alignment: isNumericCol[i] ? AlignmentType.RIGHT : AlignmentType.LEFT, text: String(row[h] ?? '') })],
              shading: rowIdx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
            })
        ),
      })
  )
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...bodyRows],
  })
  const doc = new Document({
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: `Digenerate ${getLocalDateStr()} - AI Assistant Vista Teknik`, size: 16, color: '8C97A6' })],
              }),
            ],
          }),
        },
        children: [new Paragraph({ text: judul || 'Export', heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }), table],
      },
    ],
  })
  const buffer = await Packer.toBuffer(doc)
  return new Uint8Array(buffer)
}

// ================= Tool implementations (READ-ONLY) - identik dengan ai-assistant =================

const TOOL_IMPL: Record<string, (supabase: any, input: any) => Promise<any>> = {
  async query_wo_status(supabase, input) {
    const search = (input?.search || '').toLowerCase().trim()
    let wos = await fetchAll(supabase, 'work_orders', '*, panels(*)')
    wos = wos.filter((w: any) => !w.deleted_at && !w.is_archived)
    if (search) {
      wos = wos.filter((w: any) => (w.wo || '').toLowerCase().includes(search) || (w.proyek || '').toLowerCase().includes(search))
      if (wos.length === 0) {
        const saran = await noMatchHint(supabase, search)
        return { error: `Proyek/WO dengan nama mengandung '${input.search}' gak ditemukan.`, ...(saran.length > 0 ? { saran } : {}) }
      }
    }

    const bomProsesRelevan = await fetchAll(supabase, 'bom_proses_relevan', 'kode_komponen,tipe_panel,jenis_pekerjaan')
    const relevanSet = new Set(bomProsesRelevan.map((r: any) => `${r.kode_komponen}|${r.tipe_panel}|${r.jenis_pekerjaan}`))
    const hasMappingSet = new Set(bomProsesRelevan.map((r: any) => `${r.kode_komponen}|${r.tipe_panel}`))

    return wos.map((w: any) => {
      const panels = w.panels || []
      const vals = panels.flatMap((p: any) => Object.values(calcPanelProgress(p, relevanSet, hasMappingSet)))
      const pct = vals.length ? Math.round((vals as number[]).reduce((a, b) => a + b, 0) / vals.length) : 0
      const status = pct === 100 ? 'SELESAI' : isDelayed(w.target) ? 'TERLAMBAT' : isUrgent(w.target) ? 'MENDESAK' : 'ON TRACK'
      return { wo: w.wo, proyek: w.proyek, target: w.target, status, jumlah_panel: panels.length, progress_keseluruhan_pct: pct }
    })
  },

  async query_bom_komponen(supabase, input) {
    const tipe_panel = input?.tipe_panel
    const kode_komponen = input?.kode_komponen
    if (!tipe_panel && !kode_komponen) {
      return { error: 'Wajib isi tipe_panel atau kode_komponen buat membatasi hasil.' }
    }
    let q = supabase.from('bom_master').select('*')
    if (tipe_panel) q = q.eq('tipe_panel', tipe_panel)
    if (kode_komponen) q = q.eq('kode_komponen', kode_komponen)
    const { data: bomRows, error } = await q
    if (error) throw error

    const relevanRows = await fetchAll(supabase, 'bom_proses_relevan', 'kode_komponen,tipe_panel,jenis_pekerjaan')
    const relevanByKey: Record<string, string[]> = {}
    relevanRows.forEach((r: any) => {
      const key = `${r.kode_komponen}|${r.tipe_panel}`
      if (!relevanByKey[key]) relevanByKey[key] = []
      relevanByKey[key].push(r.jenis_pekerjaan)
    })

    const { data: wpMeta } = await supabase.from('panel_wp_meta').select('tipe_panel,wp,range_label')
    const { data: typeMeta } = await supabase.from('panel_type_meta').select('tipe_panel,label')

    return (bomRows || []).map((b: any) => ({
      kode_komponen: b.kode_komponen,
      nama_komponen: b.nama_komponen,
      tipe_panel: b.tipe_panel,
      tipe_panel_label: (typeMeta || []).find((t: any) => t.tipe_panel === b.tipe_panel)?.label || b.tipe_panel,
      wp: b.wp,
      wp_range: (wpMeta || []).find((m: any) => m.tipe_panel === b.tipe_panel && m.wp === b.wp)?.range_label || null,
      urutan: b.urutan,
      proses_relevan: relevanByKey[`${b.kode_komponen}|${b.tipe_panel}`] || null,
    }))
  },

  async query_progress_panel(supabase, input) {
    const namaPanel = input?.nama_panel
    if (!namaPanel) return { error: 'Wajib isi nama_panel.' }
    const matches = await findPanels(supabase, namaPanel, input?.proyek)
    if (matches.length !== 1) return await panelLookupError(supabase, matches, namaPanel)
    const panel = matches[0]

    const bomProsesRelevan = await fetchAll(supabase, 'bom_proses_relevan', 'kode_komponen,tipe_panel,jenis_pekerjaan')
    const relevanSet = new Set(bomProsesRelevan.map((r: any) => `${r.kode_komponen}|${r.tipe_panel}|${r.jenis_pekerjaan}`))
    const hasMappingSet = new Set(bomProsesRelevan.map((r: any) => `${r.kode_komponen}|${r.tipe_panel}`))

    const prog = calcPanelProgress(panel, relevanSet, hasMappingSet)
    const vals = Object.values(prog) as number[]
    const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    const perProses = Object.entries(prog).map(([proses, pct]) => ({
      proses,
      progress_pct: pct,
      status: (pct as number) >= 100 ? 'Selesai' : (pct as number) > 0 ? 'Sedang Dikerjakan' : 'Belum Dikerjakan',
    }))

    return {
      panel: panel.nama,
      tipe: panel.tipe,
      proyek: panel.__wo?.proyek,
      wo: panel.__wo?.wo,
      progress_keseluruhan_pct: overall,
      per_proses: perProses,
    }
  },

  async query_nameplate_yellowmark(supabase, input) {
    const namaPanel = input?.nama_panel
    if (!namaPanel) return { error: 'Wajib isi nama_panel.' }
    const matches = await findPanels(supabase, namaPanel, input?.proyek)
    if (matches.length !== 1) return await panelLookupError(supabase, matches, namaPanel)
    const panel = matches[0]

    // Sama persis logic statusTugasNp() di LaporanNameplateView.tsx - dipakai konsisten
    // buat nameplate & yellowmark (dua fitur yang strukturnya sama, cuma nama kolom beda).
    const statusTugas = (pct: number, jumlahFoto: number) => {
      if (pct >= 100 && jumlahFoto >= 1) return 'Selesai'
      if (pct > 0 || jumlahFoto > 0) return 'Proses'
      return 'Belum'
    }
    const npFoto = (panel.nameplate_photos || []).length
    const ymFoto = (panel.yellowmark_photos || []).length

    return {
      panel: panel.nama,
      proyek: panel.__wo?.proyek,
      wo: panel.__wo?.wo,
      nameplate_persentase_fabrikasi: panel.nameplate_progress || 0,
      nameplate_status_pemasangan: statusTugas(panel.nameplate_progress || 0, npFoto),
      nameplate_jumlah_foto: npFoto,
      yellowmark_persentase_fabrikasi: panel.yellowmark_progress || 0,
      yellowmark_status_pemasangan: statusTugas(panel.yellowmark_progress || 0, ymFoto),
      yellowmark_jumlah_foto: ymFoto,
    }
  },

  async query_qc_checklist(supabase, input) {
    const namaPanel = input?.nama_panel
    if (!namaPanel) return { error: 'Wajib isi nama_panel.' }
    const matches = await findPanels(supabase, namaPanel, input?.proyek)
    if (matches.length !== 1) return await panelLookupError(supabase, matches, namaPanel)
    const panel = matches[0]

    // qc_checklist itu JSONB TERPISAH dari checklist progress biasa (bukan proses "QC TEST"
    // di dalam checklist) - lihat panels.qc_checklist. Foto cuma di-COUNT, gak diikutkan
    // URL/binary-nya (prinsip v1: jangan bocorin data besar/foto ke context AI).
    const qc = panel.qc_checklist || {}
    const items = ['fisik', 'spesifikasi', 'baut', 'test']
    const perItem = items.map((it) => ({
      item: it,
      ada_catatan: !!(qc[it]?.catatan && String(qc[it].catatan).trim()),
      jumlah_foto: (qc[it]?.foto || []).length,
    }))

    return {
      panel: panel.nama,
      proyek: panel.__wo?.proyek,
      wo: panel.__wo?.wo,
      status_qc: qc._global?.status || 'to_do',
      per_item: perItem,
    }
  },

  async query_capacity_harian(supabase, input) {
    const tanggal = input?.tanggal
    if (!tanggal) return { error: 'Wajib isi tanggal (format YYYY-MM-DD).' }
    let capToday = (await fetchAll(supabase, 'fcs_kapasitas_override', 'tanggal,jenis_pekerjaan,kapasitas_unit')).filter((c: any) => c.tanggal === tanggal)
    if (input?.proses) capToday = capToday.filter((c: any) => c.jenis_pekerjaan.toUpperCase() === String(input.proses).toUpperCase())
    if (capToday.length === 0) return { tanggal, data: [], catatan: 'Gak ada data kapasitas buat tanggal/proses ini.' }

    const hasil = []
    for (const c of capToday) {
      const units = await computeExistingUnitsForProses(supabase, tanggal, c.jenis_pekerjaan)
      const terpakai = Math.round(units.reduce((a: number, u: any) => a + u.demand, 0))
      const total = Number(c.kapasitas_unit) || 0
      hasil.push({
        proses: c.jenis_pekerjaan,
        satuan: PROSES_ORANG.includes(c.jenis_pekerjaan) ? 'orang' : 'menit',
        kapasitas_total: total,
        kapasitas_terpakai: terpakai,
        sisa: Math.max(0, total - terpakai),
        persentase_terpakai: total > 0 ? Math.round((terpakai / total) * 100) : 0,
      })
    }
    return { tanggal, data: hasil }
  },

  async simulate_estimasi_selesai(supabase, input) {
    const namaPanel = input?.nama_panel
    const kodeKomponen = input?.kode_komponen
    const proses = input?.proses
    if (!namaPanel || !kodeKomponen || !proses) return { error: 'Wajib isi nama_panel, kode_komponen, dan proses.' }
    if (PROSES_TANPA_CASCADE.includes(proses)) {
      return { error: `Proses '${proses}' dikecualikan dari perhitungan kapasitas (gak punya data waktu proses) - gak bisa disimulasikan.` }
    }

    const matches = await findPanels(supabase, namaPanel, input?.proyek)
    if (matches.length !== 1) return await panelLookupError(supabase, matches, namaPanel)
    const panel = matches[0]

    const cl = (panel.checklist || {})[kodeKomponen]
    if (!cl) return { error: `Komponen '${kodeKomponen}' gak ditemukan di panel ${panel.nama}.` }
    // Konsisten sama calcPanelProgress dkk - pakai getBestProgress (history > progressByDate >
    // progress), bukan progress[proses] mentah. Kalau langsung baca progress[proses] doang,
    // komponen yang history-nya udah nunjukin 100% tapi field progress belum ke-sync bisa
    // salah disimulasikan seolah masih perlu dikerjakan.
    const pctSekarang = getBestProgress(cl, proses)
    if (pctSekarang >= 100) {
      return { panel: panel.nama, kode_komponen: kodeKomponen, proses, catatan: 'Komponen ini udah 100% selesai di proses ini - gak perlu disimulasikan.' }
    }

    const ptRows = (await fetchAll(supabase, 'fcs_process_time', 'tipe_panel,kode_komponen,jenis_pekerjaan,menit_per_pcs,is_active')).filter((r: any) => r.is_active)
    const pt = ptRows.find((r: any) => r.tipe_panel === panel.tipe && r.kode_komponen === kodeKomponen && r.jenis_pekerjaan === proses)
    if (!pt || !Number(pt.menit_per_pcs)) {
      return { error: `Gak ada data waktu proses (fcs_process_time) buat kombinasi tipe panel ${panel.tipe} + komponen ${kodeKomponen} + proses ${proses} - gak bisa disimulasikan secara akurat.` }
    }

    const qtyTotal = Number(cl.qty) || 0
    const qtyProsesSkrg = Number(cl.qtyProses?.[proses]) || 0
    const qtySisa = Math.max(0, qtyTotal - qtyProsesSkrg)
    const demand = qtySisa * Number(pt.menit_per_pcs)

    const capMap: Record<string, number> = {}
    ;(await fetchAll(supabase, 'fcs_kapasitas_override', 'tanggal,jenis_pekerjaan,kapasitas_unit')).forEach((c: any) => {
      if (c.jenis_pekerjaan === proses) capMap[c.tanggal] = Number(c.kapasitas_unit) || 0
    })
    const getCap = (tanggal: string) => (capMap[tanggal] !== undefined ? capMap[tanggal] : null)

    const woRow = panel.wo_id != null ? (await fetchAll(supabase, 'work_orders', 'id,target')).find((w: any) => w.id === panel.wo_id) : null
    const woTarget = woRow?.target || '9999-99-99'

    const hariIni = getLocalDateStr()
    const existingUnits = await computeExistingUnitsForProses(supabase, hariIni, proses)
    const candidateId = `simulasi_${panel.id}_${kodeKomponen}`
    const allUnits = [...existingUnits, { id: candidateId, demand, woTarget, sortKode: kodeKomponen }]

    const finalDate = cascadePlaceSimple(hariIni, allUnits, getCap, candidateId)

    return {
      panel: panel.nama,
      kode_komponen: kodeKomponen,
      proses,
      qty_sisa: qtySisa,
      estimasi_tanggal_selesai: finalDate,
      catatan:
        'Estimasi dihitung pakai algoritma cascading capacity yang sama persis dengan sistem auto-geser, berdasarkan antrean & kapasitas HARI INI. Kalau hasilnya kepending sampai beberapa hari ke depan, hari-hari SETELAH hari ini diasumsikan belum ada pekerjaan lain yang bersaing (selain yang udah kegeser dari hari ini) - jadi kemungkinan sedikit lebih optimis dari kenyataan kalau proses ini emang lagi padat berkelanjutan berhari-hari.',
    }
  },

  async query_raw_schedule_detail(supabase, input) {
    const tanggalMulai = input?.tanggal_mulai
    const tanggalSelesai = input?.tanggal_selesai
    if (!tanggalMulai || !tanggalSelesai) return { error: 'Wajib isi tanggal_mulai dan tanggal_selesai (format YYYY-MM-DD).' }

    let panelIdFilter: number | null = null
    if (input?.nama_panel) {
      const matches = await findPanels(supabase, input.nama_panel, input?.proyek)
      if (matches.length !== 1) return await panelLookupError(supabase, matches, input.nama_panel)
      panelIdFilter = matches[0].id
    }

    let rows = await fetchAll(supabase, 'raw_schedule', 'id,panel_id,proyek,panel,proses,schedule')
    if (panelIdFilter != null) rows = rows.filter((r: any) => r.panel_id === panelIdFilter)
    if (input?.proses) rows = rows.filter((r: any) => r.proses.toUpperCase() === String(input.proses).toUpperCase())

    const hasil: any[] = []
    rows.forEach((row: any) => {
      Object.entries(row.schedule || {}).forEach(([tanggal, entries]: [string, any]) => {
        if (tanggal < tanggalMulai || tanggal > tanggalSelesai) return
        ;(entries || []).forEach((e: any) => {
          ;(e.komponen || []).forEach((kode: string) => {
            if (kode.startsWith('__wiring_')) return
            const digeserKeTujuan = e.digeserKe?.[kode]
            hasil.push({
              tanggal,
              panel: row.panel,
              proyek: row.proyek,
              proses: row.proses,
              wp: e.wp,
              kode_komponen: kode,
              status: digeserKeTujuan ? `Jejak (digeser ke ${digeserKeTujuan})` : 'Aktif',
              carried_over_from: e.carriedOverFrom || null,
            })
          })
        })
      })
    })
    hasil.sort((a, b) => (a.tanggal as string).localeCompare(b.tanggal))

    const total = hasil.length
    const LIMIT = 200
    return { total_entry: total, ditampilkan: Math.min(total, LIMIT), dipotong: total > LIMIT, data: hasil.slice(0, LIMIT) }
  },

  async query_operator_workload(supabase, input) {
    const tanggal = input?.tanggal || getLocalDateStr()
    let rows = (await fetchAll(supabase, 'fcs_timer_kerja', 'id,pekerja_id,panel_id,kode_komponen,proses,tanggal,mulai,selesai,durasi_menit')).filter((r: any) => r.tanggal === tanggal)
    if (rows.length === 0) return { tanggal, data: [], catatan: 'Gak ada aktivitas timer tercatat di tanggal ini.' }

    const pekerjaIds = [...new Set(rows.map((r: any) => r.pekerja_id).filter(Boolean))]
    const pekerjaRows = pekerjaIds.length ? (await fetchAll(supabase, 'pekerja', 'id,nama')).filter((p: any) => pekerjaIds.includes(p.id)) : []
    const pekerjaMap: Record<string, string> = {}
    pekerjaRows.forEach((p: any) => (pekerjaMap[String(p.id)] = p.nama))

    const panelIds = [...new Set(rows.map((r: any) => r.panel_id).filter(Boolean))]
    const panelRows = panelIds.length ? (await fetchAll(supabase, 'panels', 'id,nama')).filter((p: any) => panelIds.includes(p.id)) : []
    const panelMap: Record<string, string> = {}
    panelRows.forEach((p: any) => (panelMap[String(p.id)] = p.nama))

    if (input?.pekerja_nama) {
      const q = String(input.pekerja_nama).toLowerCase()
      rows = rows.filter((r: any) => (pekerjaMap[String(r.pekerja_id)] || '').toLowerCase().includes(q))
    }
    if (input?.status === 'aktif') rows = rows.filter((r: any) => !r.selesai)
    if (input?.status === 'selesai') rows = rows.filter((r: any) => !!r.selesai)

    return {
      tanggal,
      // Ghost timer & force-stop dikonfirmasi nyata (komentar di TimerAktifTab.tsx) - selalu
      // disertakan biar Gemini bisa hedging jawaban soal durasi, bukan nelan angka mentah-mentah.
      catatan_akurasi: 'Data durasi bisa gak akurat: operator kadang lupa nutup timer (tetap "Masih berjalan" walau kerjaan udah kelar), atau timer di-force-stop sistem (durasi tercatat 0 menit).',
      data: rows.map((r: any) => ({
        pekerja: pekerjaMap[String(r.pekerja_id)] || 'Tidak diketahui',
        panel: panelMap[String(r.panel_id)] || 'Tidak diketahui',
        kode_komponen: r.kode_komponen,
        proses: r.proses,
        mulai: r.mulai,
        selesai: r.selesai || 'Masih berjalan',
        durasi_menit: r.durasi_menit,
      })),
    }
  },

  async query_kendala(supabase, input) {
    let rows = (await fetchAll(supabase, 'kendala', '*')).filter((r: any) => !r.deleted_at)

    const filterIlike = (val: string | undefined, field: string) => {
      if (!val) return
      const q = String(val).toLowerCase()
      rows = rows.filter((r: any) => (r[field] || '').toLowerCase().includes(q))
    }
    filterIlike(input?.proyek, 'proyek')
    filterIlike(input?.panel, 'panel')
    filterIlike(input?.proses, 'proses')
    filterIlike(input?.divisi, 'divisi_label')
    filterIlike(input?.operator, 'operator')
    if (input?.tanggal_mulai) rows = rows.filter((r: any) => (r.tanggal || '') >= input.tanggal_mulai)
    if (input?.tanggal_selesai) rows = rows.filter((r: any) => (r.tanggal || '') <= input.tanggal_selesai)

    if (rows.length === 0 && (input?.proyek || input?.panel)) {
      const saran = await noMatchHint(supabase, input?.panel || input?.proyek)
      return { error: `Gak ada kendala yang cocok sama filter '${input?.panel || input?.proyek}'.`, ...(saran.length > 0 ? { saran } : {}) }
    }

    rows.sort((a: any, b: any) => String(b.ts || b.created_at || '').localeCompare(String(a.ts || a.created_at || '')))
    const LIMIT = 50
    return {
      total: rows.length,
      dipotong: rows.length > LIMIT,
      data: rows.slice(0, LIMIT).map((r: any) => ({
        tanggal: r.tanggal,
        proyek: r.proyek,
        panel: r.panel,
        divisi: r.divisi_label,
        proses: r.proses,
        operator: r.operator,
        catatan: r.catatan,
      })),
    }
  },

  async query_komponen_tambahan(supabase, input) {
    let rows = await fetchAll(supabase, 'komponen_tambahan', '*')
    if (input?.tanggal) rows = rows.filter((r: any) => r.tanggal === input.tanggal)
    if (input?.proyek) {
      const q = String(input.proyek).toLowerCase()
      rows = rows.filter((r: any) => (r.proyek || '').toLowerCase().includes(q))
    }
    if (input?.panel_nama) {
      const q = String(input.panel_nama).toLowerCase()
      rows = rows.filter((r: any) => (r.panel_nama || '').toLowerCase().includes(q))
    }
    if (input?.status) rows = rows.filter((r: any) => r.status === input.status)

    if (rows.length === 0 && (input?.proyek || input?.panel_nama)) {
      const saran = await noMatchHint(supabase, input?.panel_nama || input?.proyek)
      return { error: `Gak ada komponen tambahan yang cocok sama filter '${input?.panel_nama || input?.proyek}'.`, ...(saran.length > 0 ? { saran } : {}) }
    }

    rows.sort((a: any, b: any) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')))
    const LIMIT = 50
    return {
      total: rows.length,
      dipotong: rows.length > LIMIT,
      catatan: 'Ini komponen ad-hoc/manual yang ditambahin langsung dari Vista Pekerja (mobile) - terpisah dari jadwal raw_schedule utama, gak ikut logic auto-geser.',
      data: rows.slice(0, LIMIT).map((r: any) => ({
        tanggal: r.tanggal,
        shift: r.shift,
        proyek: r.proyek,
        panel: r.panel_nama,
        nama_komponen: r.nama_komponen,
        qty: r.qty,
        proses: r.proses,
        operator: r.operator_nama,
        status: r.status,
        waktu_mulai: r.waktu_mulai,
        waktu_selesai: r.waktu_selesai,
      })),
    }
  },

  async query_arsip(supabase, input) {
    let rows = await fetchAll(supabase, 'panels_archived', '*')
    if (input?.proyek) {
      const q = String(input.proyek).toLowerCase()
      rows = rows.filter((r: any) => (r.proyek_snapshot || '').toLowerCase().includes(q))
    }
    if (input?.panel_nama) {
      const q = String(input.panel_nama).toLowerCase()
      rows = rows.filter((r: any) => (r.nama || '').toLowerCase().includes(q))
    }
    if (rows.length === 0 && (input?.proyek || input?.panel_nama)) {
      const saran = await noMatchHint(supabase, input?.panel_nama || input?.proyek)
      return { error: `Gak ada arsip yang cocok sama filter '${input?.panel_nama || input?.proyek}'.`, ...(saran.length > 0 ? { saran } : {}) }
    }
    rows.sort((a: any, b: any) => String(b.diarsipkan_pada || '').localeCompare(String(a.diarsipkan_pada || '')))

    const LIMIT = 50
    return {
      total: rows.length,
      dipotong: rows.length > LIMIT,
      data: rows.slice(0, LIMIT).map((r: any) => {
        // qc_checklist di panels_archived struktur & itemnya sama persis kayak panels.qc_checklist
        // (query_qc_checklist) - cuma di sini digabung jadi 1 angka total foto, bukan per-item.
        const qc = r.qc_checklist || {}
        const items = ['fisik', 'spesifikasi', 'baut', 'test']
        const qcFotoTotal = items.reduce((sum, it) => sum + (qc[it]?.foto || []).length, 0)
        return {
          panel: r.nama,
          tipe: r.tipe,
          proyek: r.proyek_snapshot,
          wo: r.wo_number_snapshot,
          progress_terakhir_pct: r.progress_snapshot,
          status_qc: qc._global?.status || 'to_do',
          qc_jumlah_foto: qcFotoTotal,
          diarsipkan_pada: r.diarsipkan_pada,
          diarsipkan_oleh: r.diarsipkan_oleh,
        }
      }),
    }
  },

  async query_stok_komponen(supabase, input) {
    let rows = await fetchAll(supabase, 'komponen_stok', '*')
    if (input?.nama_komponen) {
      const q = String(input.nama_komponen).toLowerCase()
      rows = rows.filter((r: any) => (r.nama || '').toLowerCase().includes(q) || (r.kode || '').toLowerCase().includes(q))
    }
    if (rows.length === 0) {
      return { data: [], catatan: 'Gak ada data stok komponen yang cocok - atau fitur Stok Komponen belum pernah dipakai sama sekali sampai sekarang.' }
    }
    return {
      data: rows.map((r: any) => ({ nama: r.nama, kode: r.kode, stok_saat_ini: r.stok, terakhir_update: r.updated_at })),
    }
  },

  async query_outstanding(supabase, input) {
    // Porting logic OutstandingView.tsx: gak ada tabel/status "outstanding" tersendiri -
    // dihitung dari raw_schedule x panels.checklist. Proses whole-panel dikecualikan sama
    // persis kayak PROSES_EXCLUDE_OUTSTANDING di frontend. Satu kode bisa nongol di banyak
    // tanggal (kalau pernah di-carry-over) - cuma tanggal PALING BARU yang dipakai (dedupe),
    // dan entry yang udah jejak (digeserKe) DIABAIKAN karena itu bukan lokasi live lagi.
    const rows = await fetchAll(supabase, 'raw_schedule', 'id,panel_id,proyek,panel,proses,schedule')
    const panelIds = [...new Set(rows.map((r: any) => r.panel_id).filter(Boolean))]
    const panels = panelIds.length ? (await fetchAll(supabase, 'panels', 'id,checklist')).filter((p: any) => panelIds.includes(p.id)) : []
    const panelMap: Record<string, any> = {}
    panels.forEach((p: any) => (panelMap[String(p.id)] = p))

    const isJejakKode = (entry: any, kode: string) => !!(entry?.digeserKe && entry.digeserKe[kode])
    const latestMap = new Map<string, any>()

    rows.forEach((row: any) => {
      if (PROSES_EXCLUDE_OUTSTANDING.includes(row.proses)) return
      const panel = panelMap[String(row.panel_id)]
      if (!panel) return
      const checklist = panel.checklist || {}
      Object.entries(row.schedule || {}).forEach(([tanggal, entries]: [string, any]) => {
        ;(entries || []).forEach((e: any) => {
          ;(e.komponen || []).forEach((kode: string) => {
            if (kode.startsWith('__wiring_')) return
            if (isJejakKode(e, kode)) return
            const cl = checklist[kode]
            if (!cl || !(Number(cl.qty) > 0)) return
            const pct = cl.progress?.[row.proses] || 0
            if (pct >= 100) return
            const key = `${row.panel_id}|${kode}|${row.proses}`
            const existing = latestMap.get(key)
            if (!existing || tanggal > existing.tanggal) {
              latestMap.set(key, { tanggal, panel: row.panel, proyek: row.proyek, proses: row.proses, kode, pct })
            }
          })
        })
      })
    })

    let hasil = Array.from(latestMap.values()).map((v: any) => ({ ...v, status: v.pct === 0 ? 'To Do' : 'In Progress' }))

    const filterIlike = (val: string | undefined, field: string) => {
      if (!val) return
      const q = String(val).toLowerCase()
      hasil = hasil.filter((h: any) => (h[field] || '').toLowerCase().includes(q))
    }
    filterIlike(input?.proyek, 'proyek')
    filterIlike(input?.panel, 'panel')
    if (input?.proses) hasil = hasil.filter((h: any) => h.proses.toUpperCase() === String(input.proses).toUpperCase())
    if (input?.status === 'to_do') hasil = hasil.filter((h: any) => h.status === 'To Do')
    if (input?.status === 'in_progress') hasil = hasil.filter((h: any) => h.status === 'In Progress')

    if (hasil.length === 0 && (input?.proyek || input?.panel)) {
      const saran = await noMatchHint(supabase, input?.panel || input?.proyek)
      return { error: `Gak ada pekerjaan outstanding yang cocok sama filter '${input?.panel || input?.proyek}'.`, ...(saran.length > 0 ? { saran } : {}) }
    }

    hasil.sort((a: any, b: any) => String(a.tanggal).localeCompare(b.tanggal))
    const LIMIT = 100
    return {
      total: hasil.length,
      dipotong: hasil.length > LIMIT,
      data: hasil.slice(0, LIMIT).map((h: any) => ({ tanggal: h.tanggal, panel: h.panel, proyek: h.proyek, proses: h.proses, kode_komponen: h.kode, status: h.status, progress_pct: h.pct })),
    }
  },

  async query_riwayat_lengkap_panel(supabase, input) {
    const namaPanel = input?.nama_panel
    if (!namaPanel) return { error: 'Wajib isi nama_panel.' }
    const matches = await findPanels(supabase, namaPanel, input?.proyek)
    if (matches.length !== 1) return await panelLookupError(supabase, matches, namaPanel)
    const panel = matches[0]

    // Gak ada tabel riwayat tunggal yang otoritatif - digabung dari progress_checkpoint_log
    // (checkpoint progress + operator + timestamp) dan fcs_timer_kerja (durasi, TAPI ada
    // ghost-timer/force-stop issue yang sama kayak query_operator_workload).
    const checkpoints = (await fetchAll(supabase, 'progress_checkpoint_log', 'panel_id,kode_komponen,proses,checkpoint,pekerja_nama,tanggal,ts')).filter((c: any) => c.panel_id === panel.id)
    const timers = (await fetchAll(supabase, 'fcs_timer_kerja', 'panel_id,proses,durasi_menit')).filter((t: any) => t.panel_id === panel.id)

    const byProses: Record<string, any> = {}
    checkpoints.forEach((c: any) => {
      if (!byProses[c.proses]) byProses[c.proses] = { proses: c.proses, checkpoints: [] as any[], operators: new Set<string>() }
      byProses[c.proses].checkpoints.push(c)
      if (c.pekerja_nama) byProses[c.proses].operators.add(c.pekerja_nama)
    })
    timers.forEach((t: any) => {
      if (!byProses[t.proses]) byProses[t.proses] = { proses: t.proses, checkpoints: [] as any[], operators: new Set<string>() }
      byProses[t.proses].totalDurasi = (byProses[t.proses].totalDurasi || 0) + (Number(t.durasi_menit) || 0)
    })

    const perProses = Object.values(byProses).map((p: any) => {
      const sorted = p.checkpoints.slice().sort((a: any, b: any) => String(a.ts || a.tanggal).localeCompare(String(b.ts || b.tanggal)))
      return {
        proses: p.proses,
        checkpoint_pertama: sorted[0] ? { tanggal: sorted[0].tanggal, progress_pct: sorted[0].checkpoint } : null,
        checkpoint_terakhir: sorted.length ? { tanggal: sorted[sorted.length - 1].tanggal, progress_pct: sorted[sorted.length - 1].checkpoint } : null,
        operator_terlibat: [...p.operators],
        total_durasi_menit_tercatat: p.totalDurasi ? Math.round(p.totalDurasi) : null,
      }
    })

    return {
      panel: panel.nama,
      proyek: panel.__wo?.proyek,
      wo: panel.__wo?.wo,
      catatan_akurasi: 'Riwayat direkonstruksi dari checkpoint progress & data timer kerja, bukan log start/end yang presisi. Durasi bisa gak akurat kalau ada timer yang lupa ditutup atau di-force-stop - selalu sampaikan ini kalau user tanya soal lama pengerjaan.',
      per_proses: perProses,
    }
  },

  // ============ TOOLS ANALISIS - SEMUA agregasi deterministik (JS murni), Gemini gak pernah
  // disuruh ngitung angka analitis sendiri dari data mentah, cuma nyaji-in hasil tool ini. ============

  async analyze_bottleneck(supabase, input) {
    const tanggalMulai = input?.tanggal_mulai
    const tanggalSelesai = input?.tanggal_selesai
    if (!tanggalMulai || !tanggalSelesai) return { error: 'Wajib isi tanggal_mulai dan tanggal_selesai.' }

    const rows = await fetchAll(supabase, 'raw_schedule', 'proses,schedule')
    const byProses: Record<string, { jumlah: number; totalHari: number }> = {}

    rows.forEach((row: any) => {
      Object.entries(row.schedule || {}).forEach(([tanggal, entries]: [string, any]) => {
        if (tanggal < tanggalMulai || tanggal > tanggalSelesai) return
        ;(entries || []).forEach((e: any) => {
          Object.entries(e.digeserKe || {}).forEach(([, tujuan]: [string, any]) => {
            if (!byProses[row.proses]) byProses[row.proses] = { jumlah: 0, totalHari: 0 }
            byProses[row.proses].jumlah++
            const hariGeser = Math.round((new Date(tujuan).getTime() - new Date(tanggal).getTime()) / 86400000)
            byProses[row.proses].totalHari += hariGeser
          })
        })
      })
    })

    const ranking = Object.entries(byProses)
      .map(([proses, v]) => ({
        proses,
        jumlah_kali_digeser: v.jumlah,
        rata_rata_hari_tergeser: v.jumlah > 0 ? Math.round((v.totalHari / v.jumlah) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.jumlah_kali_digeser - a.jumlah_kali_digeser)

    return {
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      ranking_bottleneck: ranking,
      catatan:
        ranking.length === 0
          ? 'Gak ada data pergeseran jadwal (digeserKe) di rentang tanggal ini - berarti gak ada indikasi bottleneck kapasitas pada periode ini.'
          : 'Diurutkan dari proses yang PALING SERING nyebabin komponen tergeser/kena cascading kapasitas (jumlah_kali_digeser) - itu kandidat bottleneck utama. rata_rata_hari_tergeser nunjukin rata-rata berapa hari komponen di proses itu mundur dari jadwal asal.',
    }
  },

  async compare_operator_productivity(supabase, input) {
    const proses = input?.proses
    const tanggalMulai = input?.tanggal_mulai
    const tanggalSelesai = input?.tanggal_selesai
    if (!proses || !tanggalMulai || !tanggalSelesai) return { error: 'Wajib isi proses, tanggal_mulai, dan tanggal_selesai.' }

    const rows = (await fetchAll(supabase, 'fcs_timer_kerja', 'pekerja_id,proses,tanggal,durasi_menit,kode_komponen')).filter(
      (r: any) => r.proses.toUpperCase() === String(proses).toUpperCase() && r.tanggal >= tanggalMulai && r.tanggal <= tanggalSelesai
    )
    if (rows.length === 0) {
      const saran = await noMatchHint(supabase, proses)
      return { error: `Gak ada data timer buat proses '${proses}' di rentang tanggal ini.`, ...(saran.length > 0 ? { saran } : {}) }
    }

    const pekerjaIds = [...new Set(rows.map((r: any) => r.pekerja_id).filter(Boolean))]
    const pekerjaRows = pekerjaIds.length ? (await fetchAll(supabase, 'pekerja', 'id,nama')).filter((p: any) => pekerjaIds.includes(p.id)) : []
    const pekerjaMap: Record<string, string> = {}
    pekerjaRows.forEach((p: any) => (pekerjaMap[String(p.id)] = p.nama))

    const byPekerja: Record<string, { totalMenit: number; jumlahSesi: number; komponenUnik: Set<string> }> = {}
    rows.forEach((r: any) => {
      const nama = pekerjaMap[String(r.pekerja_id)] || 'Tidak diketahui'
      if (!byPekerja[nama]) byPekerja[nama] = { totalMenit: 0, jumlahSesi: 0, komponenUnik: new Set() }
      byPekerja[nama].totalMenit += Number(r.durasi_menit) || 0
      byPekerja[nama].jumlahSesi++
      if (r.kode_komponen) byPekerja[nama].komponenUnik.add(r.kode_komponen)
    })

    const data = Object.entries(byPekerja)
      .map(([pekerja, v]) => ({
        pekerja,
        total_durasi_menit: Math.round(v.totalMenit),
        jumlah_sesi: v.jumlahSesi,
        jumlah_komponen_unik: v.komponenUnik.size,
        rata_rata_menit_per_komponen: v.komponenUnik.size > 0 ? Math.round((v.totalMenit / v.komponenUnik.size) * 10) / 10 : null,
      }))
      .sort((a, b) => b.total_durasi_menit - a.total_durasi_menit)

    return {
      proses,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      catatan_akurasi:
        'Data AKTIVITAS TERCATAT dari timer kerja (durasi, jumlah sesi, jumlah komponen disentuh) - BUKAN penilaian kualitas/kinerja/karakter personal. Bisa gak akurat kalau ada timer yang lupa ditutup atau di-force-stop. JANGAN pernah dipakai buat menyimpulkan hal personal soal operator (rajin/malas/kompeten dst) - cuma perbandingan angka aktivitas objektif.',
      data,
    }
  },

  async compare_panel_types(supabase, input) {
    const proses = input?.proses
    const tanggalMulai = input?.tanggal_mulai
    const tanggalSelesai = input?.tanggal_selesai
    if (!tanggalMulai || !tanggalSelesai) return { error: 'Wajib isi tanggal_mulai dan tanggal_selesai.' }

    let rows = (await fetchAll(supabase, 'fcs_timer_kerja', 'panel_id,proses,tanggal,durasi_menit')).filter(
      (r: any) => r.tanggal >= tanggalMulai && r.tanggal <= tanggalSelesai
    )
    if (proses) rows = rows.filter((r: any) => r.proses.toUpperCase() === String(proses).toUpperCase())
    if (rows.length === 0) return { error: 'Gak ada data timer di rentang tanggal/filter proses ini.' }

    const panelIds = [...new Set(rows.map((r: any) => r.panel_id).filter(Boolean))]
    const panels = panelIds.length ? (await fetchAll(supabase, 'panels', 'id,tipe')).filter((p: any) => panelIds.includes(p.id)) : []
    const tipeMap: Record<string, string> = {}
    panels.forEach((p: any) => (tipeMap[String(p.id)] = p.tipe))

    const byTipe: Record<string, { totalMenit: number; jumlahSesi: number }> = {}
    rows.forEach((r: any) => {
      const tipe = tipeMap[String(r.panel_id)] || 'Tidak diketahui'
      if (!byTipe[tipe]) byTipe[tipe] = { totalMenit: 0, jumlahSesi: 0 }
      byTipe[tipe].totalMenit += Number(r.durasi_menit) || 0
      byTipe[tipe].jumlahSesi++
    })

    const data = Object.entries(byTipe)
      .map(([tipe_panel, v]) => ({
        tipe_panel,
        total_durasi_menit: Math.round(v.totalMenit),
        jumlah_sesi: v.jumlahSesi,
        rata_rata_menit_per_sesi: v.jumlahSesi > 0 ? Math.round((v.totalMenit / v.jumlahSesi) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.rata_rata_menit_per_sesi - a.rata_rata_menit_per_sesi)

    return { proses: proses || 'semua proses', tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai, data }
  },

  async analyze_delay_correlation(supabase, input) {
    let wos = (await fetchAll(supabase, 'work_orders', '*, panels(*)')).filter((w: any) => !w.deleted_at && !w.is_archived)
    const bomProsesRelevan = await fetchAll(supabase, 'bom_proses_relevan', 'kode_komponen,tipe_panel,jenis_pekerjaan')
    const relevanSet = new Set(bomProsesRelevan.map((r: any) => `${r.kode_komponen}|${r.tipe_panel}|${r.jenis_pekerjaan}`))
    const hasMappingSet = new Set(bomProsesRelevan.map((r: any) => `${r.kode_komponen}|${r.tipe_panel}`))

    const delayedWos = wos.filter((w: any) => {
      const panels = w.panels || []
      const vals = panels.flatMap((p: any) => Object.values(calcPanelProgress(p, relevanSet, hasMappingSet)))
      const pct = vals.length ? Math.round((vals as number[]).reduce((a, b) => a + b, 0) / vals.length) : 0
      return pct < 100 && isDelayed(w.target)
    })

    if (delayedWos.length === 0) return { total_wo_terlambat: 0, catatan: 'Gak ada WO yang terlambat saat ini - gak ada yang perlu dianalisis.' }

    const kendalaRows = (await fetchAll(supabase, 'kendala', 'proyek,deleted_at')).filter((k: any) => !k.deleted_at)
    const rawRows = await fetchAll(supabase, 'raw_schedule', 'wo_id,schedule')

    const detail = delayedWos.map((w: any) => {
      const adaKendala = kendalaRows.some((k: any) => (k.proyek || '').toLowerCase() === (w.proyek || '').toLowerCase())
      const rowsWo = rawRows.filter((r: any) => r.wo_id === w.id)
      let adaCascade = false
      rowsWo.forEach((r: any) => {
        Object.values(r.schedule || {}).forEach((entries: any) => {
          ;(entries || []).forEach((e: any) => {
            if (e.digeserKe && Object.keys(e.digeserKe).length > 0) adaCascade = true
          })
        })
      })
      return { wo: w.wo, proyek: w.proyek, ada_kendala_tercatat: adaKendala, ada_indikasi_kapasitas_penuh: adaCascade, sebab_terdeteksi: adaKendala || adaCascade }
    })

    const total = detail.length
    const jumlahKendala = detail.filter((h: any) => h.ada_kendala_tercatat).length
    const jumlahCascade = detail.filter((h: any) => h.ada_indikasi_kapasitas_penuh).length
    const jumlahKeduanya = detail.filter((h: any) => h.ada_kendala_tercatat && h.ada_indikasi_kapasitas_penuh).length
    const jumlahTakTerdeteksi = detail.filter((h: any) => !h.sebab_terdeteksi).length

    return {
      total_wo_terlambat: total,
      breakdown_persentase: {
        ada_kendala_tercatat_pct: Math.round((jumlahKendala / total) * 100),
        ada_indikasi_kapasitas_penuh_pct: Math.round((jumlahCascade / total) * 100),
        keduanya_pct: Math.round((jumlahKeduanya / total) * 100),
        sebab_tidak_terdeteksi_dari_data_pct: Math.round((jumlahTakTerdeteksi / total) * 100),
      },
      detail_per_wo: detail,
      catatan:
        'Ini KORELASI dari sinyal yang SAMA-SAMA ADA di data (kendala tercatat & indikasi pergeseran jadwal karena kapasitas penuh) - BUKAN pembuktian sebab-akibat pasti. Jangan klaim "X menyebabkan keterlambatan" - bilang "X terdeteksi berbarengan dengan sekian persen WO yang terlambat". WO yang sebab_terdeteksi=false berarti gak ada sinyal yang kedeteksi dari data yang ada, bukan berarti gak ada sebab sama sekali.',
    }
  },

  async analyze_trend(supabase, input) {
    const proses = input?.proses
    const tanggalMulai = input?.tanggal_mulai
    const tanggalSelesai = input?.tanggal_selesai
    if (!proses || !tanggalMulai || !tanggalSelesai) return { error: 'Wajib isi proses, tanggal_mulai, dan tanggal_selesai.' }

    const capRows = (await fetchAll(supabase, 'fcs_kapasitas_override', 'tanggal,jenis_pekerjaan,kapasitas_unit')).filter(
      (c: any) => c.jenis_pekerjaan.toUpperCase() === String(proses).toUpperCase() && c.tanggal >= tanggalMulai && c.tanggal <= tanggalSelesai
    )
    if (capRows.length === 0) {
      const saran = await noMatchHint(supabase, proses)
      return { error: `Gak ada data kapasitas buat proses '${proses}' di rentang tanggal ini.`, ...(saran.length > 0 ? { saran } : {}) }
    }

    const ctx = await fetchProsesContext(supabase, proses)
    const capMap: Record<string, number> = {}
    capRows.forEach((c: any) => (capMap[c.tanggal] = Number(c.kapasitas_unit) || 0))

    const series = Object.keys(capMap)
      .sort()
      .map((tanggal) => {
        const units = computeUnitsForDateFromCtx(ctx, tanggal, proses)
        const terpakai = Math.round(units.reduce((a: number, u: any) => a + u.demand, 0))
        const total = capMap[tanggal]
        return { tanggal, kapasitas_total: total, kapasitas_terpakai: terpakai, persentase_terpakai: total > 0 ? Math.round((terpakai / total) * 100) : 0 }
      })

    // Trend deterministik: bandingin rata-rata separuh pertama vs separuh kedua rentang -
    // bukan regresi statistik canggih, tapi cukup buat nentuin arah "makin padat/longgar/stabil"
    // tanpa nyerahin perhitungan ke Gemini.
    const mid = Math.floor(series.length / 2) || 1
    const avgAwal = series.slice(0, mid).reduce((a, s) => a + s.persentase_terpakai, 0) / Math.max(1, mid)
    const avgAkhir = series.slice(mid).reduce((a, s) => a + s.persentase_terpakai, 0) / Math.max(1, series.length - mid)
    const selisih = Math.round(avgAkhir - avgAwal)
    const arah = selisih > 5 ? 'makin padat' : selisih < -5 ? 'makin longgar' : 'relatif stabil'

    return {
      proses,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      arah_trend: arah,
      perubahan_rata_rata_persentase_terpakai: selisih,
      data_harian: series,
    }
  },

  // Satu-satunya tool yang nulis - TAPI cuma ke bucket storage 'ai-exports' (bukan tabel
  // produksi apapun), pakai service-role client TERPISAH dari `supabase` (anon key) yang
  // dipakai parameter pertama - lihat komentar di atas TOOL_IMPL soal alasan privilege split.
  async generate_export(_supabase, input) {
    const data = input?.data
    const format = input?.format
    const judul = input?.judul || 'Export'
    if (!Array.isArray(data) || data.length === 0) return { error: 'Wajib isi data (array of objects, minimal 1 baris) yang mau di-export.' }
    if (!['pdf', 'docx', 'xlsx'].includes(format)) return { error: "Format wajib salah satu dari 'pdf', 'docx', 'xlsx'." }

    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await cleanupOldExports(serviceClient)

    let buffer: Uint8Array
    let ext: string
    let contentType: string
    try {
      if (format === 'xlsx') {
        buffer = await generateExcelBuffer(data, judul)
        ext = 'xlsx'
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      } else if (format === 'pdf') {
        buffer = await generatePdfBuffer(data, judul)
        ext = 'pdf'
        contentType = 'application/pdf'
      } else {
        buffer = await generateDocxBuffer(data, judul)
        ext = 'docx'
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    } catch (e: any) {
      return { error: `Gagal generate file: ${String(e?.message || e)}` }
    }

    const safeTitle = String(judul).replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'export'
    const path = `${Date.now()}_${safeTitle}.${ext}`

    const { error: uploadError } = await serviceClient.storage.from(EXPORT_BUCKET).upload(path, buffer, { contentType, upsert: false })
    if (uploadError) return { error: `Gagal upload file ke storage: ${uploadError.message}` }

    const { data: signedData, error: signError } = await serviceClient.storage.from(EXPORT_BUCKET).createSignedUrl(path, EXPORT_RETENTION_MS / 1000)
    if (signError || !signedData) return { error: `File berhasil dibuat tapi gagal bikin link download: ${signError?.message}` }

    return {
      berhasil: true,
      format,
      judul,
      jumlah_baris: data.length,
      url_download: signedData.signedUrl,
      berlaku_sampai: '7 hari dari sekarang',
    }
  },
}

// ================= Tool declarations format GEMINI (functionDeclarations) =================
// Beda dari Anthropic: dibungkus {functionDeclarations:[...]} bukan array flat, dan key
// schema-nya "parameters" bukan "input_schema" - isi schema (type/properties/required) sama.

const TOOL_DECLARATIONS = [
  {
    name: 'query_wo_status',
    description:
      "Ambil daftar Work Order (WO) aktif beserta status keterlambatan (TERLAMBAT/MENDESAK/ON TRACK/SELESAI), jumlah panel, dan progress keseluruhan (%). Contoh: 'WO apa aja yang terlambat?' -> panggil tanpa search, filter hasil status=TERLAMBAT. 'progress WO Cimory berapa?' -> search:'cimory'. 'ada berapa WO aktif sekarang?' -> panggil tanpa search, hitung jumlah hasil array.",
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter partial-match (case-insensitive) ke nama proyek atau nomor WO. Kosongkan buat semua WO aktif.' },
      },
    },
  },
  {
    name: 'query_bom_komponen',
    description:
      "Lookup Master Data BOM (Bill of Materials): kode komponen, nama komponen, tipe panel, WP (work package), urutan, dan proses apa aja yang relevan buat komponen itu. Contoh: 'komponen apa aja di panel tipe FS?' -> tipe_panel:'FS'. 'FS.1 nama komponennya apa dan relevan ke proses apa aja?' -> kode_komponen:'FS.1'. WAJIB isi salah satu (tipe_panel atau kode_komponen) - gak bisa query semua BOM tanpa filter.",
    parameters: {
      type: 'object',
      properties: {
        tipe_panel: { type: 'string', description: "Filter tipe panel, contoh: 'FS', 'WM'." },
        kode_komponen: { type: 'string', description: "Filter kode komponen spesifik, contoh: 'FS.1'." },
      },
    },
  },
  {
    name: 'query_progress_panel',
    description:
      "Ambil progress detail SATU panel di semua proses yang relevan (POTONG, BENDING, RENDAM, dst), termasuk status per proses (Belum Dikerjakan/Sedang Dikerjakan/Selesai) dan progress keseluruhan. Contoh: 'progress panel PNL-01 gimana?' -> nama_panel:'PNL-01'. Kalau nama panel ketemu di lebih dari satu proyek/WO, tool ini balikin daftar kandidat di field 'kandidat' - panggil ulang dengan parameter proyek diisi buat mempersempit.",
    parameters: {
      type: 'object',
      properties: {
        nama_panel: { type: 'string', description: 'Nama/kode panel (partial match, case-insensitive), wajib diisi.' },
        proyek: { type: 'string', description: 'Filter nama proyek (opsional, partial match) - isi kalau nama panel ambigu di beberapa proyek.' },
      },
      required: ['nama_panel'],
    },
  },
  {
    name: 'query_nameplate_yellowmark',
    description:
      "Ambil status Nameplate & Yellowmark SATU panel: persentase fabrikasi dan status pemasangan (Belum/Proses/Selesai), plus jumlah foto masing-masing. Contoh: 'nameplate panel PNL-01 udah sampai mana?' -> nama_panel:'PNL-01'. Kalau nama panel ambigu, tool balikin daftar kandidat di field 'kandidat'.",
    parameters: {
      type: 'object',
      properties: {
        nama_panel: { type: 'string', description: 'Nama/kode panel (partial match), wajib diisi.' },
        proyek: { type: 'string', description: 'Filter nama proyek (opsional) - isi kalau nama panel ambigu.' },
      },
      required: ['nama_panel'],
    },
  },
  {
    name: 'query_qc_checklist',
    description:
      "Ambil status QC (Quality Control) SATU panel: status keseluruhan (to_do/in_progress/complete), dan per item checklist (fisik, spesifikasi, baut, test) - apakah ada catatan dan berapa jumlah foto (bukan foto itu sendiri). Contoh: 'QC panel PNL-01 udah lulus belum?' -> nama_panel:'PNL-01'. Kalau nama panel ambigu, tool balikin daftar kandidat di field 'kandidat'.",
    parameters: {
      type: 'object',
      properties: {
        nama_panel: { type: 'string', description: 'Nama/kode panel (partial match), wajib diisi.' },
        proyek: { type: 'string', description: 'Filter nama proyek (opsional) - isi kalau nama panel ambigu.' },
      },
      required: ['nama_panel'],
    },
  },
  {
    name: 'query_capacity_harian',
    description:
      "Ambil kapasitas terpakai vs total per proses di SATU tanggal (dihitung dari antrean kerja aktual yang terjadwal, pakai algoritma yang sama kayak sistem auto-geser). Contoh: 'kapasitas POTONG tanggal 30 Juli gimana, penuh gak?' -> tanggal:'2026-07-30', proses:'POTONG'. 'kapasitas semua proses besok gimana?' -> tanggal diisi, proses dikosongkan (balikin semua proses yang punya data kapasitas hari itu). Satuan bisa 'menit' (proses jam-based) atau 'orang' (WIRING CONTROL/POWER).",
    parameters: {
      type: 'object',
      properties: {
        tanggal: { type: 'string', description: 'Tanggal format YYYY-MM-DD, wajib diisi.' },
        proses: { type: 'string', description: "Filter nama proses spesifik (opsional), contoh: 'POTONG', 'WIRING CONTROL'. Kosongkan buat semua proses di tanggal itu." },
      },
      required: ['tanggal'],
    },
  },
  {
    name: 'simulate_estimasi_selesai',
    description:
      "Simulasikan kapan SATU komponen di SATU proses bakal selesai kalau mulai dikerjakan HARI INI, pakai algoritma cascading capacity yang SAMA PERSIS dengan sistem auto-geser (BUKAN tebakan/reasoning) - mempertimbangkan sisa qty, waktu proses per pcs, dan antrean/kapasitas hari ini & seterusnya. Contoh: 'kalau FS.1 di panel PNL-01 mulai POTONG hari ini, kira-kira selesai kapan?' -> nama_panel:'PNL-01', kode_komponen:'FS.1', proses:'POTONG'. WAJIB isi ketiga parameter.",
    parameters: {
      type: 'object',
      properties: {
        nama_panel: { type: 'string', description: 'Nama/kode panel (partial match), wajib diisi.' },
        kode_komponen: { type: 'string', description: "Kode komponen BOM spesifik, contoh: 'FS.1', wajib diisi." },
        proses: { type: 'string', description: "Nama proses, contoh: 'POTONG', 'BENDING'. Wajib diisi. BUSBAR gak didukung (gak punya data waktu proses)." },
        proyek: { type: 'string', description: 'Filter nama proyek (opsional) - isi kalau nama panel ambigu.' },
      },
      required: ['nama_panel', 'kode_komponen', 'proses'],
    },
  },
  {
    name: 'query_raw_schedule_detail',
    description:
      "Ambil detail entry jadwal (raw_schedule) di rentang tanggal tertentu - termasuk histori/jejak (komponen yang pernah dijadwalkan di tanggal itu tapi kedigeser ke tanggal lain, ditandai status 'Jejak'). Cocok buat pertanyaan historis kayak 'apa aja yang dikerjakan tanggal 22 Juli?' atau 'FS.1 di panel PNL-01 pernah kedigeser dari tanggal berapa aja?'. tanggal_mulai & tanggal_selesai WAJIB diisi (batasi rentang biar gak kebanyakan data) - nama_panel/proses opsional buat mempersempit. Hasil dibatasi 200 entry, ada flag 'dipotong' kalau lebih dari itu.",
    parameters: {
      type: 'object',
      properties: {
        tanggal_mulai: { type: 'string', description: 'Tanggal awal rentang, format YYYY-MM-DD, wajib diisi.' },
        tanggal_selesai: { type: 'string', description: 'Tanggal akhir rentang, format YYYY-MM-DD, wajib diisi.' },
        nama_panel: { type: 'string', description: 'Filter nama panel (opsional, partial match).' },
        proyek: { type: 'string', description: 'Filter proyek (opsional) - dipakai buat disambiguasi kalau nama_panel ambigu.' },
        proses: { type: 'string', description: "Filter nama proses (opsional), contoh: 'POTONG'." },
      },
      required: ['tanggal_mulai', 'tanggal_selesai'],
    },
  },
  {
    name: 'query_operator_workload',
    description:
      "Ambil siapa mengerjakan apa (panel, komponen, proses, jam mulai/selesai) di SATU tanggal, dari data timer kerja. Contoh: 'siapa aja yang kerja hari ini?' -> tanggal dikosongkan (default hari ini). 'si Budi lagi ngerjain apa?' -> pekerja_nama:'Budi'. 'siapa yang timernya masih aktif sekarang?' -> status:'aktif'. PENTING: data durasi kadang gak akurat (timer lupa ditutup / force-stop) - tool ini selalu kasih catatan_akurasi, WAJIB disampaikan ke user kalau jawabannya soal durasi/lama kerja, jangan disembunyikan.",
    parameters: {
      type: 'object',
      properties: {
        tanggal: { type: 'string', description: 'Tanggal format YYYY-MM-DD. Kosongkan buat hari ini.' },
        pekerja_nama: { type: 'string', description: 'Filter nama pekerja (opsional, partial match).' },
        status: { type: 'string', enum: ['aktif', 'selesai', 'semua'], description: "'aktif' = timer masih jalan (belum ditutup), 'selesai' = timer udah ditutup, 'semua'/kosong = keduanya." },
      },
    },
  },
  {
    name: 'query_kendala',
    description:
      "Cari/filter catatan kendala (masalah/kejadian) yang dilaporkan operator - bisa difilter proyek, panel, proses, divisi, operator, dan rentang tanggal. Contoh: 'ada kendala apa di panel PNL-01?' -> panel:'PNL-01'. 'kendala di divisi WIRING minggu ini apa aja?' -> divisi:'WIRING', tanggal_mulai & tanggal_selesai diisi. Semua parameter opsional (kosongkan semua buat kendala terbaru secara umum, dibatasi 50 hasil terbaru).",
    parameters: {
      type: 'object',
      properties: {
        proyek: { type: 'string', description: 'Filter nama proyek (opsional, partial match).' },
        panel: { type: 'string', description: 'Filter nama panel (opsional, partial match).' },
        proses: { type: 'string', description: 'Filter proses (opsional, partial match).' },
        divisi: { type: 'string', description: 'Filter nama divisi (opsional, partial match).' },
        operator: { type: 'string', description: 'Filter nama operator pelapor (opsional, partial match).' },
        tanggal_mulai: { type: 'string', description: 'Batas awal tanggal (opsional), format YYYY-MM-DD.' },
        tanggal_selesai: { type: 'string', description: 'Batas akhir tanggal (opsional), format YYYY-MM-DD.' },
      },
    },
  },
  {
    name: 'query_komponen_tambahan',
    description:
      "Ambil data komponen ad-hoc/manual yang ditambahin operator langsung dari Vista Pekerja (mobile) - terpisah dari jadwal raw_schedule utama. Contoh: 'ada komponen tambahan apa aja hari ini?' -> tanggal dikosongkan buat hari ini, atau diisi buat tanggal spesifik. 'komponen tambahan di panel PNL-01 apa aja?' -> panel_nama:'PNL-01'. Semua parameter opsional.",
    parameters: {
      type: 'object',
      properties: {
        tanggal: { type: 'string', description: 'Tanggal format YYYY-MM-DD (opsional).' },
        proyek: { type: 'string', description: 'Filter nama proyek (opsional, partial match).' },
        panel_nama: { type: 'string', description: 'Filter nama panel (opsional, partial match).' },
        status: { type: 'string', enum: ['belum_mulai', 'berjalan', 'selesai'], description: 'Filter status pengerjaan (opsional).' },
      },
    },
  },
  {
    name: 'query_arsip',
    description:
      "Ambil data panel/WO yang udah diarsipkan (proyek, panel, progress terakhir, ringkasan status QC). Contoh: 'panel apa aja yang udah diarsipkan dari proyek Cimory?' -> proyek:'Cimory'. 'panel PNL-01 udah diarsipkan belum?' -> panel_nama:'PNL-01'. Kosongkan semua parameter buat arsip terbaru secara umum (dibatasi 50 hasil).",
    parameters: {
      type: 'object',
      properties: {
        proyek: { type: 'string', description: 'Filter nama proyek (opsional, partial match).' },
        panel_nama: { type: 'string', description: 'Filter nama panel (opsional, partial match).' },
      },
    },
  },
  {
    name: 'query_stok_komponen',
    description:
      "Ambil data stok komponen yang tersedia (nama, kode, jumlah stok saat ini). Contoh: 'stok kabel NYY berapa?' -> nama_komponen:'kabel NYY'. Kosongkan buat semua stok. CATATAN: fitur ini baru dan datanya mungkin masih kosong kalau belum pernah dipakai - kalau hasilnya kosong, sampaikan terus terang ke user, jangan mengarang angka.",
    parameters: {
      type: 'object',
      properties: {
        nama_komponen: { type: 'string', description: 'Filter nama atau kode komponen (opsional, partial match).' },
      },
    },
  },
  {
    name: 'query_outstanding',
    description:
      "Ambil daftar pekerjaan outstanding (belum selesai) per komponen - status 'To Do' (progress 0%, belum disentuh) atau 'In Progress' (udah dikerjain sebagian). Bisa difilter proyek/panel/proses/status. Contoh: 'apa aja yang outstanding di proyek Cimory?' -> proyek:'Cimory'. 'panel PNL-01 apa aja yang masih To Do?' -> panel:'PNL-01', status:'to_do'. Proses whole-panel (BUSBAR, QC TEST, PACKING, NAMEPLATE, YELLOWMARK) TIDAK termasuk di sini - dilacak lewat tool lain (query_qc_checklist, query_nameplate_yellowmark).",
    parameters: {
      type: 'object',
      properties: {
        proyek: { type: 'string', description: 'Filter nama proyek (opsional, partial match).' },
        panel: { type: 'string', description: 'Filter nama panel (opsional, partial match).' },
        proses: { type: 'string', description: "Filter nama proses spesifik (opsional), contoh: 'POTONG'." },
        status: { type: 'string', enum: ['to_do', 'in_progress', 'semua'], description: "'to_do' = progress 0%, 'in_progress' = progress sebagian, 'semua'/kosong = keduanya." },
      },
    },
  },
  {
    name: 'query_riwayat_lengkap_panel',
    description:
      "Ambil riwayat lengkap SATU panel per proses: checkpoint progress pertama & terakhir (tanggal+persentase), operator yang terlibat, total durasi tercatat. Contoh: 'riwayat pengerjaan panel PNL-01 gimana?' -> nama_panel:'PNL-01'. CATATAN: durasi direkonstruksi dari data timer yang kadang gak akurat (lihat catatan_akurasi di hasil tool) - WAJIB sampaikan disclaimer itu kalau user tanya soal lama pengerjaan, jangan sajikan angka durasi sebagai kepastian mutlak.",
    parameters: {
      type: 'object',
      properties: {
        nama_panel: { type: 'string', description: 'Nama/kode panel (partial match), wajib diisi.' },
        proyek: { type: 'string', description: 'Filter nama proyek (opsional) - isi kalau nama panel ambigu.' },
      },
      required: ['nama_panel'],
    },
  },
  {
    name: 'analyze_bottleneck',
    description:
      "Hitung proses apa yang PALING SERING nyebabin komponen tergeser/kena cascading kapasitas (bottleneck) dalam rentang tanggal, berdasarkan data pergeseran jadwal (digeserKe) yang ASLI - bukan tebakan. Contoh: 'proses apa yang paling sering bikin telat bulan ini?' -> isi tanggal_mulai/tanggal_selesai sebulan terakhir. Hasil sudah diurutkan (ranking_bottleneck), jangan diurutkan ulang manual.",
    parameters: {
      type: 'object',
      properties: {
        tanggal_mulai: { type: 'string', description: 'Tanggal awal rentang, format YYYY-MM-DD, wajib diisi.' },
        tanggal_selesai: { type: 'string', description: 'Tanggal akhir rentang, format YYYY-MM-DD, wajib diisi.' },
      },
      required: ['tanggal_mulai', 'tanggal_selesai'],
    },
  },
  {
    name: 'compare_operator_productivity',
    description:
      "Bandingkan AKTIVITAS TERCATAT antar operator (durasi kerja, jumlah sesi, jumlah komponen disentuh) buat SATU proses dalam rentang tanggal, dari data timer kerja - angka objektif murni. PENTING: hasil ini BUKAN penilaian kualitas/karakter personal - kalau user minta kesimpulan kayak 'siapa yang paling malas/gak becus', TOLAK dengan sopan dan jelaskan ini cuma data aktivitas, bukan penilaian. Contoh pemakaian yang tepat: 'siapa yang paling banyak ngerjain POTONG bulan ini?' -> proses:'POTONG', tanggal_mulai/tanggal_selesai diisi.",
    parameters: {
      type: 'object',
      properties: {
        proses: { type: 'string', description: "Nama proses, contoh: 'POTONG'. Wajib diisi." },
        tanggal_mulai: { type: 'string', description: 'Tanggal awal rentang, format YYYY-MM-DD, wajib diisi.' },
        tanggal_selesai: { type: 'string', description: 'Tanggal akhir rentang, format YYYY-MM-DD, wajib diisi.' },
      },
      required: ['proses', 'tanggal_mulai', 'tanggal_selesai'],
    },
  },
  {
    name: 'compare_panel_types',
    description:
      "Bandingkan rata-rata durasi pengerjaan antar TIPE PANEL (misal FS vs WM_MS vs WM_POLY), opsional difilter ke satu proses tertentu, dalam rentang tanggal - dari data timer kerja aktual. Contoh: 'tipe panel mana yang paling lama dikerjain?' -> tanggal_mulai/tanggal_selesai diisi, proses opsional dikosongkan (semua proses digabung).",
    parameters: {
      type: 'object',
      properties: {
        proses: { type: 'string', description: 'Filter ke satu proses (opsional) - kosongkan buat gabung semua proses.' },
        tanggal_mulai: { type: 'string', description: 'Tanggal awal rentang, format YYYY-MM-DD, wajib diisi.' },
        tanggal_selesai: { type: 'string', description: 'Tanggal akhir rentang, format YYYY-MM-DD, wajib diisi.' },
      },
      required: ['tanggal_mulai', 'tanggal_selesai'],
    },
  },
  {
    name: 'analyze_delay_correlation',
    description:
      "Buat semua WO yang lagi TERLAMBAT, cek KORELASI (bukan pembuktian sebab-akibat) antara keterlambatan itu dengan: (1) ada kendala tercatat di proyek itu, (2) ada indikasi kapasitas penuh (komponen kena geser/cascading). Balikin breakdown persentase. Contoh: 'kenapa WO-WO ini pada telat, ada polanya gak?' -> panggil tanpa parameter. WAJIB sampaikan ke user bahwa ini korelasi dari sinyal data, bukan bukti sebab-akibat pasti - jangan klaim 'X menyebabkan Y'.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'analyze_trend',
    description:
      "Hitung TREND kapasitas terpakai suatu proses dari waktu ke waktu (makin padat / makin longgar / stabil) dalam rentang tanggal - dihitung deterministik dari data kapasitas & antrean aktual per hari, bukan reasoning bebas. Contoh: 'kapasitas POTONG makin padat gak sebulan terakhir?' -> proses:'POTONG', tanggal_mulai/tanggal_selesai sebulan terakhir. Hasil punya 'arah_trend' yang udah dihitung - jangan disimpulkan ulang manual dari data_harian.",
    parameters: {
      type: 'object',
      properties: {
        proses: { type: 'string', description: "Nama proses, contoh: 'POTONG'. Wajib diisi." },
        tanggal_mulai: { type: 'string', description: 'Tanggal awal rentang, format YYYY-MM-DD, wajib diisi.' },
        tanggal_selesai: { type: 'string', description: 'Tanggal akhir rentang, format YYYY-MM-DD, wajib diisi.' },
      },
      required: ['proses', 'tanggal_mulai', 'tanggal_selesai'],
    },
  },
  {
    name: 'generate_export',
    description:
      "Generate file PDF/Word/Excel dari data yang SUDAH kamu dapatkan lewat tool lain SEBELUMNYA di percakapan ini - JANGAN query ulang, pakai lagi data yang udah ada di riwayat percakapan. Panggil ini kalau user minta hasil dalam bentuk file/dokumen. Contoh alur: user tanya 'WO apa aja yang terlambat?' (kamu jawab pakai query_wo_status), lalu user bilang 'kasih dalam bentuk excel' -> ambil array data WO terlambat dari hasil query_wo_status barusan, panggil generate_export dengan data itu persis, format:'xlsx', judul deskriptif. Balikin link download (berlaku 7 hari) yang harus kamu tampilkan APA ADANYA di jawabanmu (jangan diringkas/dihilangkan) biar UI bisa render tombol download-nya.",
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Array data yang mau di-export, tiap item object dengan struktur key yang SAMA (key jadi header kolom) - ambil dari hasil tool sebelumnya di percakapan ini, jangan dikarang.',
          items: { type: 'object' },
        },
        format: { type: 'string', enum: ['pdf', 'docx', 'xlsx'], description: "Format file: 'pdf', 'docx' (Word), atau 'xlsx' (Excel)." },
        judul: { type: 'string', description: "Judul singkat & deskriptif, jadi nama file juga, contoh: 'Daftar WO Terlambat 30 Juli 2026'." },
      },
      required: ['data', 'format', 'judul'],
    },
  },
]

const SYSTEM_PROMPT = `Kamu adalah AI Assistant internal Vista Teknik (perusahaan fabrikasi panel listrik). Tugasmu jawab pertanyaan seputar kondisi produksi (WO, panel, progress, BOM, dst) HANYA berdasarkan data yang didapat dari tools yang tersedia - jangan pernah mengarang angka atau status. Kalau tool gak punya data yang relevan atau hasilnya kosong, bilang terus terang gak tau / data gak tersedia, jangan menebak. Ini versi v1 READ-ONLY: kamu cuma bisa BACA data, gak bisa ubah/hapus apapun, dan gak perlu menyarankan aksi ubah data. Jawab dalam Bahasa Indonesia informal, singkat dan langsung ke poin, format angka/persen dengan jelas.

PENTING - JENIS ENTITY (PROYEK vs PANEL vs KOMPONEN), sering bikin salah pilih tool kalau gak hati-hati:
- PROYEK/WO: biasanya nama perusahaan/lokasi klien, sering multi-kata, contoh 'CIMORY CITEUREUP', 'GODREJ BOROBUDUR', 'RS. TUNAS SUVARNA'.
- PANEL: biasanya kode pendek dengan prefix (LP-, PP-, SDP-, SDB., MCC, CP-, dst), contoh 'LP-LAB', 'CP-OVEN', 'SDB.LT 4'. KALAU USER NYEBUT NAMA YANG POLANYA KAYAK GINI, JANGAN LANGSUNG ASUMSI ITU PROYEK - coba tool berbasis panel (query_progress_panel dkk).
- KOMPONEN: kode BOM per-item, contoh 'FS.1', 'WM.2'.
- Kalau gak yakin nama yang disebut itu proyek atau panel, dan tool pertama yang kamu coba gak nemu hasilnya, tool itu akan kasih field 'saran' berisi nama-nama mirip (dari fuzzy search) DAN petunjuk tool lain yang perlu dicoba - WAJIB baca & tindak lanjuti 'saran' itu (coba tool yang disaranin) SEBELUM nyerah atau nanya balik ke user. JANGAN pernah manggil tool tanpa filter sama sekali (dump semua data) cuma buat "nyari-nyari" nama yang gak ketemu - itu gak membantu dan bikin jawaban gak relevan.
- Kalau udah nyoba tool yang relevan (termasuk ngikutin 'saran') dan tetap gak ketemu, baru bilang terus terang ke user data gak ditemukan, sertakan nama-nama mirip yang kamu temukan (kalau ada) biar user bisa klarifikasi.

PRINSIP "SOLUTIF TAPI JUJUR" saat data terbatas/gak ketemu:
1. AKURASI MUTLAK (gak bisa dikompromikan): JANGAN PERNAH mengarang/nebak angka atau data yang gak ada di hasil tool - salah di sini bisa berujung keputusan produksi yang salah.
2. TAPI jangan cuma bilang "gak bisa"/"gak ditemukan" terus berhenti gitu aja - selalu coba salah satu langkah solutif ini dulu, sesuai situasinya:
   a. Kemungkinan salah nama/typo -> tawarkan nama mirip dari field 'saran' (lihat aturan entity di atas).
   b. Pertanyaan ambigu (proyek/panel gak jelas, rentang tanggal gak disebut, dst) -> tanya balik klarifikasi SINGKAT dan SPESIFIK, jangan langsung nyerah atau nebak sendiri.
   c. Benar-benar di luar cakupan tools yang ada (data/fitur belum tersedia sama sekali) -> jelaskan JUJUR apa yang gak tersedia, DAN kalau ada, sebutkan data/tool terdekat yang MASIH bisa bantu jawab sebagian atau dari sudut pandang lain.

TOOLS ANALISIS (analyze_bottleneck, compare_operator_productivity, compare_panel_types, analyze_delay_correlation, analyze_trend): semua tool ini udah ngitung angka analitisnya SENDIRI secara deterministik (agregasi langsung dari data, bukan reasoning). Kalau user tanya sesuatu yang butuh perhitungan analitis (bottleneck/penyebab telat, produktivitas, perbandingan, trend, korelasi), WAJIB panggil tool analisis yang sesuai - JANGAN PERNAH kamu hitung ulang/estimasi sendiri angka analitis serupa dari data mentah hasil tool query biasa, walau kamu MERASA bisa. Aturan tambahan per tool:
- compare_operator_productivity: hasilnya MURNI angka aktivitas tercatat (durasi, jumlah sesi, jumlah komponen) - BUKAN penilaian kualitas/karakter/etos kerja personal. Kalau user minta kesimpulan personal ("operator X malas/gak becus/paling jago"), TOLAK dengan sopan, jelaskan ini cuma data aktivitas objektif bukan penilaian, dan tetap sajikan angkanya apa adanya.
- analyze_delay_correlation: hasilnya KORELASI (sinyal yang sama-sama muncul di data), BUKAN pembuktian sebab-akibat. JANGAN klaim "X menyebabkan keterlambatan" - bilang "X terdeteksi berbarengan dengan sekian persen WO yang terlambat".`

// ================= Gemini generateContent tool-use loop =================

// gemini-3.6-flash kuota gratisnya cuma 20/hari (baru rilis, belum longgar). gemini-2.5-flash
// ternyata SUDAH DITUTUP buat user/project baru ("no longer available to new users" - dicoba
// langsung, error 404). gemini-3.5-flash-lite dipilih sebagai gantinya: generasi 3.x yang
// masih aktif buat user baru, tetap dukung function-calling, kuota gratis jauh lebih longgar
// dari 3.6-flash - cocok buat skala pemakaian internal yang jarang.
const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const MAX_TOOL_ITERATIONS = 6

// Diverifikasi empiris: panggilan Gemini API kadang HANG TOTAL (gak error, gak timeout dari
// sisi Gemini sendiri - dites berkali-kali, kira-kira 1 dari 3-4 request macet tanpa respons
// sama sekali, TERLEPAS dari kompleksitas request-nya - request sesederhana "halo" pun kena,
// jadi ini BUKAN soal ukuran/kompleksitas request (misal generate_export/PDF) melainkan
// flakiness murni di sisi Gemini API, di luar kendali kita. Tanpa batas waktu, satu hang bikin
// seluruh chat "Mikir..." selamanya. AbortController biar gagal CEPAT, PLUS retry otomatis
// sekali (dengan backoff singkat) KHUSUS buat kasus timeout - kalau retry itu juga gagal, baru
// benar-benar nyerah dengan error `code:'TIMEOUT'` yang bisa dikenali frontend (biar bisa
// dikasih pesan ramah + tombol coba lagi, bukan nampilin pesan teknis mentah ke user).
const GEMINI_TIMEOUT_MS = 25000
const GEMINI_MAX_ATTEMPTS = 2
const GEMINI_RETRY_BACKOFF_MS = 800

async function callGeminiOnce(apiKey: string, contents: any[]) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${text}`)
    }
    return await res.json()
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const err: any = new Error('timeout')
      err.code = 'TIMEOUT'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

async function callGemini(apiKey: string, contents: any[]) {
  let lastErr: any = null
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      return await callGeminiOnce(apiKey, contents)
    } catch (e: any) {
      lastErr = e
      if (e?.code === 'TIMEOUT' && attempt < GEMINI_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, GEMINI_RETRY_BACKOFF_MS))
        continue
      }
      break
    }
  }
  if (lastErr?.code === 'TIMEOUT') {
    const err: any = new Error('Sistem AI sedang lambat merespons. Coba kirim ulang pertanyaannya sebentar lagi.')
    err.code = 'TIMEOUT'
    throw err
  }
  throw lastErr
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return jsonResponse({ error: 'GEMINI_API_KEY belum di-set di secrets Edge Function.' }, 500)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

    const body = await req.json()
    const contents: any[] = Array.isArray(body?.contents) ? body.contents : []
    if (contents.length === 0) return jsonResponse({ error: 'contents kosong.' }, 400)

    let iterations = 0
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++
      const resp = await callGemini(apiKey, contents)

      const candidate = resp.candidates?.[0]
      const parts = candidate?.content?.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      if (functionCalls.length === 0) {
        const answer = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n')
        contents.push({ role: 'model', parts })
        return jsonResponse({ answer, contents })
      }

      contents.push({ role: 'model', parts })
      const responseParts: any[] = []
      for (const fc of functionCalls) {
        const name = fc.functionCall.name
        const args = fc.functionCall.args || {}
        const impl = TOOL_IMPL[name]
        let result: any
        try {
          result = impl ? await impl(supabase, args) : { error: `Tool '${name}' belum diimplementasikan.` }
        } catch (e: any) {
          result = { error: String(e?.message || e) }
        }
        responseParts.push({ functionResponse: { name, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    return jsonResponse({ error: 'Terlalu banyak iterasi tool-use, coba pertanyaan yang lebih spesifik.', contents }, 500)
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e), ...(e?.code ? { code: e.code } : {}) }, 500)
  }
})
