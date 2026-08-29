#!/usr/bin/env node
/*
Migrasi foto Supabase Storage -> Cloudflare R2 (Agu 2026, egress Supabase kena limit).

JANGAN DIJALANKAN sebelum:
1. Supabase dikonfirmasi pulih (billing cycle reset, restriction dicabut)
2. Edge Function r2-storage sudah di-deploy + secret R2 sudah di-set
3. Bucket R2 sudah diaktifkan "Public Access" di dashboard Cloudflare (R2_PUBLIC_BASE_URL
   butuh domain publik yang valid, custom domain atau r2.dev subdomain)
4. .env.local (repo ini) sudah diisi: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
   R2_BUCKET_NAME, R2_PUBLIC_BASE_URL, dan (opsional tapi disarankan) SUPABASE_SERVICE_ROLE_KEY
   (kalau kosong, script fallback pakai VITE_SUPABASE_ANON_KEY yang sudah ada - cukup untuk
   tabel yang memang ditulis app lewat anon key, tapi panel_seksi_archived &
   fcs_tracking_komponen_foto_archived cuma pernah ditulis lewat DB trigger, JADI PERLU
   DICEK MANUAL apakah RLS-nya mengizinkan UPDATE via anon key - kalau tidak, isi
   SUPABASE_SERVICE_ROLE_KEY).

CARA PAKAI:
  node scripts/migrate-photos-to-r2.mjs --dry-run   # cuma laporan, TIDAK download/upload/update apapun
  node scripts/migrate-photos-to-r2.mjs             # migrasi sungguhan

IDEMPOTENT: strategi deteksinya BUKAN flag terpisah, tapi liat pola URL itu sendiri - kalau
sebuah string URL sudah mengarah ke R2_PUBLIC_BASE_URL, dilewati (dianggap sudah beres).
Kalau di-Ctrl+C di tengah jalan lalu dijalankan ulang, baris yang foto-nya sudah kepalang
pindah ke R2 otomatis di-skip, cuma baris yang masih ada sisa URL Supabase yang diproses ulang.
Progress per tabel (baris terakhir yang SELESAI diproses) disimpan di
scripts/.migrate-photos-to-r2.progress.json biar restart gak scan ulang dari id=0 tiap tabel
yang sudah tuntas.

PENDEKATAN GENERIK: dibanding nulis logic migrasi terpisah utk tiap kolom (qc_checklist,
checklist.fotoPemasangan, nameplate_photos, dst - total 9 kolom di 5 tabel), script ini deep-walk
SETIAP value JSON di kolom yang didaftar, cari string yang match pola public URL Supabase
(mengandung bucket-nya SENDIRI di path-nya - jadi gak perlu ditebak dari nama kolom/tabel),
migrasikan file-nya, dan ganti string URL itu in-place. Robust terhadap struktur nested
apapun (array of {url}, object per-kode, dll) tanpa perlu tahu shape persis tiap kolom.
*/

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'

// ── env loader minimal (tanpa dependency dotenv) ──────────────────────────────
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '')

function requireEnv() {
  const missing = []
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('VITE_SUPABASE_ANON_KEY atau SUPABASE_SERVICE_ROLE_KEY')
  if (!DRY_RUN) {
    if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID')
    if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID')
    if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY')
    if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME')
    if (!R2_PUBLIC_BASE_URL) missing.push('R2_PUBLIC_BASE_URL')
  }
  if (missing.length > 0) {
    console.error(`❌ Env belum lengkap di .env.local: ${missing.join(', ')}`)
    process.exit(1)
  }
}
requireEnv()

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const s3 = DRY_RUN ? null : new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// Nama bucket Supabase lama -> folder kategori di R2 (1 bucket R2 total, folder pengganti
// multi-bucket Supabase). Kalau ketemu bucket di luar daftar ini (foto lama dari fitur yang
// sudah dihapus, dll), dipakai apa adanya sebagai nama folder - TIDAK di-skip diam-diam,
// supaya kelihatan di log kalau ada kategori yang belum kepikiran.
const BUCKET_TO_FOLDER = {
  'maintenance-photos': 'maintenance',
  'qc-photos': 'qc',
  'nameplate-photos': 'nameplate',
  'wiring-komponen-photos': 'wiring-komponen',
  'pasang-komponen-photos': 'pasang-komponen',
  'qs-photos': 'qs',
  'warehouse-photos': 'warehouse',
  'tracking-komponen': 'tracking-komponen',
}

const SUPABASE_URL_MARKER = '/storage/v1/object/public/'

function parseSupabaseUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(SUPABASE_URL_MARKER)
  if (idx < 0) return null
  const rest = url.slice(idx + SUPABASE_URL_MARKER.length)
  const slash = rest.indexOf('/')
  if (slash < 0) return null
  return { bucket: rest.slice(0, slash), objectPath: decodeURIComponent(rest.slice(slash + 1)) }
}

function isAlreadyR2(url) {
  return typeof url === 'string' && R2_PUBLIC_BASE_URL && url.startsWith(R2_PUBLIC_BASE_URL)
}

async function withRetry(fn, label, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) { lastErr = e; if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1))) }
  }
  throw new Error(`${label} gagal setelah ${attempts}x percobaan: ${lastErr?.message || lastErr}`)
}

const stats = { filesSeen: 0, filesMigrated: 0, filesSkippedAlreadyR2: 0, filesFailed: 0, rowsUpdated: 0 }

// Migrasi SATU url foto: download dari Supabase, upload ke R2, balikin url baru. Dipanggil
// dari deepMigrate untuk setiap string yang cocok pola URL publik Supabase Storage.
async function migrateOneFile(oldUrl) {
  stats.filesSeen++
  if (isAlreadyR2(oldUrl)) { stats.filesSkippedAlreadyR2++; return oldUrl }
  const parsed = parseSupabaseUrl(oldUrl)
  if (!parsed) return oldUrl // bukan URL Supabase Storage yang dikenali - biarkan apa adanya

  const folder = BUCKET_TO_FOLDER[parsed.bucket] || parsed.bucket
  const key = `${folder}/${parsed.objectPath}`
  const newUrl = `${R2_PUBLIC_BASE_URL}/${key}`

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${parsed.bucket}/${parsed.objectPath} -> ${key}`)
    stats.filesMigrated++
    return newUrl
  }

  try {
    const res = await withRetry(() => fetch(oldUrl), `download ${oldUrl}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    await withRetry(() => s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: contentType })), `upload ${key}`)
    stats.filesMigrated++
    return newUrl
  } catch (e) {
    stats.filesFailed++
    console.error(`  ❌ GAGAL migrasi ${oldUrl}: ${e.message}`)
    return oldUrl // gagal - URL lama dibiarkan, rerun berikutnya akan coba lagi (bukan R2 URL jadi gak ke-skip)
  }
}

// Deep-walk rekursif: jalan ke semua array/object, migrasikan tiap string yang berupa URL
// foto. Balikin {value, changed} - changed dipakai caller buat tahu perlu UPDATE row atau
// tidak (hindari UPDATE sia-sia ke baris yang sama sekali gak ada foto Supabase-nya).
async function deepMigrate(value) {
  if (typeof value === 'string') {
    // Cuma string yang KELIHATAN kayak URL (http/https) yang dihitung/diproses sbg foto -
    // JSON foto punya banyak field string LAIN (status, catatan, nama operator, mime type,
    // timestamp) yang BUKAN URL, jangan ikut dihitung sbg "file foto" di statistik.
    if (!/^https?:\/\//.test(value)) return { value, changed: false }
    const migrated = await migrateOneFile(value)
    return { value: migrated, changed: migrated !== value }
  }
  if (Array.isArray(value)) {
    let changed = false
    const out = []
    for (const item of value) {
      const r = await deepMigrate(item)
      out.push(r.value)
      if (r.changed) changed = true
    }
    return { value: out, changed }
  }
  if (value && typeof value === 'object') {
    let changed = false
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const r = await deepMigrate(v)
      out[k] = r.value
      if (r.changed) changed = true
    }
    return { value: out, changed }
  }
  return { value, changed: false }
}

// ── progress file (per tabel: id terakhir yang SELESAI diproses + status "done") ─────────
const PROGRESS_PATH = path.resolve(process.cwd(), 'scripts/.migrate-photos-to-r2.progress.json')
function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')) } catch { return {} } }
function saveProgress(p) { fs.writeFileSync(PROGRESS_PATH, JSON.stringify(p, null, 2)) }
const progress = loadProgress()

const PAGE_SIZE = 500 // JANGAN pakai .select() tanpa .range() - Supabase diam-diam cap 1000 row

// Proses satu tabel: paginate by id ascending (BUKAN offset, biar aman dari row baru yang
// masuk selama migrasi jalan lama), deep-walk kolom yang didaftar, UPDATE kalau berubah,
// simpan progress tiap batch.
async function migrateTable(table, idColumn, jsonColumns) {
  if (progress[table]?.done) {
    console.log(`⏭  ${table}: sudah selesai di run sebelumnya (skip). Hapus entry di ${path.basename(PROGRESS_PATH)} kalau mau paksa ulang.`)
    return
  }
  console.log(`\n▶ Memproses tabel ${table} (kolom: ${jsonColumns.join(', ')})...`)
  let lastId = progress[table]?.lastId || 0
  let totalRows = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from(table)
      .select([idColumn, ...jsonColumns].join(','))
      .gt(idColumn, lastId)
      .order(idColumn, { ascending: true })
      .range(0, PAGE_SIZE - 1)
    if (error) { console.error(`❌ Gagal query ${table}: ${error.message}`); process.exit(1) }
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      totalRows++
      const patch = {}
      let rowChanged = false
      for (const col of jsonColumns) {
        if (row[col] == null) continue
        const { value, changed } = await deepMigrate(row[col])
        if (changed) { patch[col] = value; rowChanged = true }
      }
      if (rowChanged) {
        if (DRY_RUN) {
          console.log(`  [DRY-RUN] akan UPDATE ${table}.${idColumn}=${row[idColumn]}`)
          stats.rowsUpdated++
        } else {
          const { error: upErr } = await supabase.from(table).update(patch).eq(idColumn, row[idColumn])
          if (upErr) console.error(`  ❌ Gagal update ${table}.${idColumn}=${row[idColumn]}: ${upErr.message}`)
          else stats.rowsUpdated++
        }
      }
      lastId = row[idColumn]
    }
    console.log(`  ...${totalRows} baris diproses (terakhir ${idColumn}=${lastId})`)
    if (!DRY_RUN) { progress[table] = { lastId, done: false }; saveProgress(progress) }
    if (rows.length < PAGE_SIZE) break
  }
  if (!DRY_RUN) { progress[table] = { lastId, done: true }; saveProgress(progress) }
  console.log(`✔ ${table} selesai (${totalRows} baris diperiksa).`)
}

async function main() {
  console.log(`=== Migrasi Foto Supabase Storage -> Cloudflare R2 ${DRY_RUN ? '(DRY RUN - tidak ada perubahan nyata)' : ''} ===`)

  await migrateTable('maintenance_log', 'id', ['foto'])
  await migrateTable('panels', 'id', ['qc_checklist', 'checklist', 'nameplate_photos', 'yellowmark_photos', 'pasang_komponen_photos', 'qs_photos', 'warehouse_photos'])
  await migrateTable('panel_seksi_archived', 'id', ['data'])
  await migrateTable('fcs_tracking_komponen_foto', 'id', ['file_url'])
  await migrateTable('fcs_tracking_komponen_foto_archived', 'id', ['file_url'])

  console.log('\n=== RINGKASAN ===')
  console.log(`File foto ditemukan (URL Supabase Storage)  : ${stats.filesSeen}`)
  console.log(`File berhasil dimigrasi ke R2                : ${stats.filesMigrated}`)
  console.log(`File sudah R2 sebelumnya (skip)               : ${stats.filesSkippedAlreadyR2}`)
  console.log(`File GAGAL dimigrasi (URL lama dibiarkan)     : ${stats.filesFailed}`)
  console.log(`Baris DB ter-update                           : ${stats.rowsUpdated}`)
  if (stats.filesFailed > 0) console.log(`\n⚠ Ada ${stats.filesFailed} file gagal - jalankan ulang script ini (idempotent, aman diulang) setelah cek masalahnya (koneksi/quota R2/dll).`)
  if (DRY_RUN) console.log('\nIni DRY RUN - jalankan tanpa --dry-run untuk migrasi sungguhan.')
}

main().catch(e => { console.error('❌ Migrasi berhenti karena error tak terduga:', e); process.exit(1) })
