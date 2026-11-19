// SIMULASI (DRY-RUN) HAPUS OTOMATIS FOTO/VIDEO MAINTENANCE RUTIN > 30 HARI - Tahap 1 (19 Nov 2026).
// HANYA MEMBACA: tidak ada kode hapus/ubah di berkas ini. Jalankan:  npm run dryrun:media-rutin   (tambah -- --semua utk daftar lengkap)
// Sumber aturan = fungsi SQL inv_media_rutin_status() (migrasi 20261119010000) - sama dgn yang nanti dipakai proses hapus Tahap 2.
// Kunci: hanya VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY dari .env.local (tidak dicetak). Ukuran berkas dibaca lewat HEAD ke URL
// publiknya (tanpa kunci R2) - HANYA ke host publik R2 (VITE_R2_PUBLIC_BASE_URL); URL host lain tidak dihubungi.
// Dibaca sebagai anon: media milik barang di tempat sampah tidak terlihat (RLS) - proses Tahap 2 tetap melewatinya.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SEMUA = process.argv.includes('--semua')
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(l => /^VITE_(SUPABASE_URL|SUPABASE_ANON_KEY|R2_PUBLIC_BASE_URL)=/.test(l)).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) { console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak ada di .env.local'); process.exit(1) }
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const R2_PUBLIK = (env.VITE_R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '') + '/'

const MB = n => (n / 1048576).toFixed(1) + ' MB'
const wib = t => new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16)
const bulanWib = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
const jalur = u => { try { return decodeURIComponent(new URL(u).pathname.slice(1)) } catch { return u } }
const video = r => (r.mime || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(r.url)

async function semuaHalaman(buat) {
  const out = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await buat(a, a + 999)
    if (error) throw error
    out.push(...(data || [])); if (!data || data.length < 1000) return out
  }
}
// HEAD ke URL publik R2 (anti-cache, batas 20 dtk): ada = 'ya' | 'tidak' (404) | 'tak-tercek' (host lain / galat / kode lain)
async function ukuran(url) {
  if (!url) return { ada: 'ya', byte: 0, kode: '' }
  if (R2_PUBLIK === '/' || !url.startsWith(R2_PUBLIK)) return { ada: 'tak-tercek', byte: 0, kode: 'host bukan R2 publik' }
  try {
    const u = new URL(url); u.searchParams.set('cek', String(Date.now()))
    const r = await fetch(u, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(20000) })
    return { ada: r.ok ? 'ya' : r.status === 404 ? 'tidak' : 'tak-tercek', byte: r.ok ? Number(r.headers.get('content-length') || 0) : 0, kode: String(r.status) }
  } catch (e) { return { ada: 'tak-tercek', byte: 0, kode: 'galat ' + (e?.name || e?.message || e) } }
}
async function paralel(daftar, n, fn) { const hasil = new Array(daftar.length); let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < daftar.length) { const k = i++; hasil[k] = await fn(daftar[k]) } })); return hasil }

let baris = null
try { baris = await semuaHalaman((a, z) => db.rpc('inv_media_rutin_status').order('media_id').range(a, z)) }
catch (e) {
  console.error(/inv_media_rutin_status|PGRST202|42883/.test(JSON.stringify(e))
    ? 'Fungsi inv_media_rutin_status() belum ada - jalankan dulu supabase/migrations/20261119010000_media_rutin_status.sql di SQL Editor.'
    : 'Gagal membaca status: ' + (e?.message || JSON.stringify(e)))
  process.exitCode = 1   // bukan process.exit(): di Windows memutus koneksi yang masih terbuka -> pesan assertion libuv
}
if (baris) await laporkan(baris)

async function laporkan(baris) {
const idBarang = [...new Set(baris.map(r => r.barang_id))]
const barang = new Map()
for (let i = 0; i < idBarang.length; i += 200) {
  const potong = idBarang.slice(i, i + 200)
  const rows = await semuaHalaman((a, z) => db.from('inv_barang').select('id,nama,nomor_inventaris').in('id', potong).order('id').range(a, z))
  for (const b of rows) barang.set(b.id, b)
}
const namaB = id => { const b = barang.get(id); return b ? `${b.nama}${b.nomor_inventaris ? ' (' + b.nomor_inventaris + ')' : ''}` : `barang #${id}` }

const perStatus = {}; for (const r of baris) perStatus[r.status] = (perStatus[r.status] || 0) + 1
const kandidat = baris.filter(r => r.status === 'kandidat').sort((p, q) => p.dibuat_pada.localeCompare(q.dibuat_pada))
const uk = await paralel(kandidat, 6, async r => { const [u, t] = await Promise.all([ukuran(r.url), ukuran(r.thumb)]); return { u, t } })
kandidat.forEach((r, i) => { r.byte = uk[i].u.byte + uk[i].t.byte; r.cekUtama = uk[i].u; r.cekThumb = uk[i].t })
const total = kandidat.reduce((a, r) => a + r.byte, 0)
const perBulan = {}; for (const r of kandidat) { const b = bulanWib(r.dibuat_pada); perBulan[b] = perBulan[b] || { n: 0, byte: 0 }; perBulan[b].n++; perBulan[b].byte += r.byte }
const sekarang = Date.now()
const menyusul7 = baris.filter(r => r.status === 'belum_30_hari' && Date.parse(r.boleh_dihapus_mulai) - sekarang <= 7 * 86400000)

console.log('SIMULASI hapus otomatis foto/video Maintenance Rutin - TIDAK ADA YANG DIHAPUS')
console.log('Waktu cek:', wib(sekarang), 'WIB · aturan: 30 hari sejak diunggah, per berkas (fungsi inv_media_rutin_status)')
console.log('\nStatus semua foto/video Rutin (' + baris.length + '):', Object.entries(perStatus).map(([k, v]) => `${k} ${v}`).join(' · ') || 'kosong')
console.log(`\nAKAN DIHAPUS bila proses Tahap 2 dinyalakan sekarang: ${kandidat.length} berkas (${kandidat.filter(r => r.thumb).length} dengan thumbnail) dari ${new Set(kandidat.map(r => r.selesai_id)).size} baris riwayat`)
console.log(`  total ${MB(total)} · foto ${kandidat.filter(r => !video(r)).length} · video ${kandidat.filter(video).length}`)
for (const [ket, cek] of [['berkas utama', r => r.cekUtama], ['thumbnail', r => r.cekThumb]]) {
  const tidak = kandidat.filter(r => cek(r).ada === 'tidak'), tak = kandidat.filter(r => cek(r).ada === 'tak-tercek')
  if (tidak.length) console.log(`  PERHATIAN: ${tidak.length} ${ket} sudah tidak ada di R2 (404)`)
  if (tak.length) console.log(`  PERHATIAN: ${tak.length} ${ket} tidak bisa dicek (${[...new Set(tak.map(r => cek(r).kode))].join(', ')}) - ukuran tidak terhitung`)
}
console.log('\nPer bulan unggah (WIB):'); for (const [b, v] of Object.entries(perBulan).sort()) console.log(`  ${b}: ${v.n} berkas, ${MB(v.byte)}`)
console.log(`\n${SEMUA ? 'Daftar lengkap' : '20 contoh (terlama dulu)'}: diunggah WIB | umur | barang | riwayat | ukuran | jalur berkas`)
for (const r of (SEMUA ? kandidat : kandidat.slice(0, 20)))
  console.log(`  ${wib(r.dibuat_pada)} | ${r.umur_hari} hr | ${namaB(r.barang_id)} | riwayat #${r.selesai_id} | ${MB(r.byte)}${r.cekUtama.ada === 'ya' ? '' : r.cekUtama.ada === 'tidak' ? ' (TIDAK ADA)' : ' (tak tercek)'} | ${jalur(r.url)}${r.thumb ? ' (+thumbnail)' : ''}`)
if (!SEMUA && kandidat.length > 20) console.log(`  ... ${kandidat.length - 20} lagi (npm run dryrun:media-rutin -- --semua)`)
console.log(`\nMenyusul dalam 7 hari: ${menyusul7.length} berkas`)
for (const st of ['ditunda_tinjauan', 'jalur_tidak_dikenal', 'dipakai_bersama', 'barang_di_sampah']) {
  const d = baris.filter(r => r.status === st); if (!d.length) continue
  console.log(`\nTIDAK dihapus - ${st} (${d.length}):`)
  for (const r of d) console.log(`  media #${r.media_id} | ${namaB(r.barang_id)} | riwayat #${r.selesai_id} | umur ${r.umur_hari} hr | ${jalur(r.url)}`)
}
}
