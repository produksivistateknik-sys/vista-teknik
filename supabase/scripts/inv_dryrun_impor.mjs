// ARSIP T1 (sudah dijalankan 29 Okt 2026; impor berikutnya lewat tombol "Impor dari Excel" yang memakai
// src/lib/inventarisImpor.ts - hasilnya terbukti identik dgn payload T1, 121/121 baris). DRY-RUN impor Inventaris (T1) - BACA SAJA: membaca file Excel + data maintenance lama (anon key .env.local, tidak
// mencetak kredensial), menulis laporan + file SQL impor. Tidak menulis apa pun ke database.
//
//   node supabase/scripts/inv_dryrun_impor.mjs --ga "<GA - DATABASE INVENTARIS VISTA.xlsx>" [--siap "<Inventaris_Vista_siap_impor.xlsx>"]
//        [--sql supabase/scripts/20261030_inv_impor_awal.sql]
//
// Sumber isi sel = file GA (asli perusahaan). File siap-impor HANYA dipakai untuk nomor inventaris, kode lokasi, kode lama
// dan 3 bak baru; keduanya dibandingkan baris demi baris dan semua selisih dilaporkan (keputusan user no. 1).
// Tanpa --siap: nomor tidak dikirim -> database membuat nomor urut per lokasi sesuai urutan baris (disimulasikan di sini).
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(path.resolve('package.json'))
const XLSX = req('xlsx')
const { createClient } = req('@supabase/supabase-js')

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined }
const fileGa = arg('ga'); const fileSiap = arg('siap'); const fileSql = arg('sql')
if (!fileGa) { console.error('Wajib --ga <file Excel asli>'); process.exit(1) }

// ── normalisasi ─────────────────────────────────────────────────────────────────────────────
const LOKASI = { 'MEKANIK': 'MKN', 'PAINTING': 'PT', 'ASSEMBLY': 'ASB', 'WIRING': 'WR', 'WIRING POWER': 'WR.P',
  'WIRING CONTROL': 'WR.C', 'QC': 'QC', 'NAMEPLATE': 'NP', 'WAREHOUSE': 'WH', 'RUANG KANTOR LT 2': 'KTR', 'RUANG HR': 'HR',
  'RUANG MEETING': 'RM', 'AREA WORKSHOP': 'WS', 'AREA PARKIR': 'PKR', 'LOBBY': 'LBY', '': 'BELUM' }
const BERNOMOR = new Set(['MKN', 'PT', 'ASB', 'WR.P', 'WR.C', 'QC', 'NP', 'WH', 'KTR', 'HR', 'RM', 'WS', 'PKR', 'LBY'])
const KONDISI = { 'BERFUNGSI BAIK': 'baik', 'BERFUNGSI TIDAK MAKSIMAL': 'tidak_maksimal', 'PERLU MAINTENANCE': 'perlu_maintenance',
  'RUSAK': 'rusak', '': 'belum_dinilai' }
const BULAN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 }
const teks = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
const kunciTeks = (v) => teks(v).toUpperCase()
const pad = (n) => String(n).padStart(2, '0')
const dariSerial = (n) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
// -> { tanggal: 'YYYY-MM-DD'|null, teks: string|null, galat: bool }
function tanggal(v) {
  if (v === '' || v == null) return { tanggal: null, teks: null, galat: false }
  if (typeof v === 'number') return { tanggal: dariSerial(v), teks: null, galat: false }
  const s = teks(v); let m
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) return { tanggal: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, teks: s, galat: false }
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/)) && BULAN[m[2].slice(0, 3).toLowerCase()])
    return { tanggal: `${m[3]}-${pad(BULAN[m[2].slice(0, 3).toLowerCase()])}-${pad(m[1])}`, teks: s, galat: false }
  return { tanggal: null, teks: s, galat: true }
}

// ── baca GA ─────────────────────────────────────────────────────────────────────────────────
function bacaSheet(file, cocokNama) {
  const wb = XLSX.readFile(file)
  const nama = wb.SheetNames.find(cocokNama) || wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, defval: '' })
  const h = rows.findIndex(r => r.some(c => kunciTeks(c) === 'NAMA BARANG'))
  if (h < 0) throw new Error(`${file}: header "Nama Barang" tidak ditemukan di sheet ${nama}`)
  const kol = Object.fromEntries(rows[h].map((c, i) => [kunciTeks(c), i]))
  return { nama, sheetNames: wb.SheetNames, wb, header: rows[h].map(teks), kol, baris: rows.map((r, i) => ({ r, excel: i + 1 })).slice(h + 1).filter(x => teks(x.r[kol['NAMA BARANG']])) }
}
const ga = bacaSheet(fileGa, n => kunciTeks(n) === 'DATABASE INVENTARIS')
const K = (row, h) => row[ga.kol[h]]
const galat = [], catatan = []
const baris = ga.baris.map(({ r, excel }) => {
  const lokTeks = kunciTeks(K(r, 'LOKASI INVENTARIS')); const lok = LOKASI[lokTeks]
  if (!lok) galat.push(`GA baris ${excel}: lokasi "${lokTeks}" tidak dikenal`)
  const konTeks = kunciTeks(K(r, 'KONDISI BARANG')); const kon = KONDISI[konTeks]
  if (!kon) galat.push(`GA baris ${excel}: kondisi "${konTeks}" tidak dikenal`)
  const tp = tanggal(K(r, 'TANGGAL PEROLEHAN')); const tu = tanggal(K(r, 'TANGGAL TERAKHIR UPDATE'))
  if (tp.galat) catatan.push(`GA baris ${excel}: tanggal perolehan "${tp.teks}" tidak terbaca -> disimpan sebagai teks saja`)
  if (tu.galat) galat.push(`GA baris ${excel}: tanggal terakhir update "${tu.teks}" tidak terbaca`)
  return {
    kunci: `GA:${excel}`, nama: teks(K(r, 'NAMA BARANG')), lokasi_kode: lok || lokTeks, pengguna: teks(K(r, 'PENGGUNA/PENANGGUNGJAWAB')) || null,
    kondisi: kon || konTeks, detail_kondisi: teks(K(r, 'DETAIL KONDISI')) || null, merk_spesifikasi: teks(K(r, 'MERK/SPESIFIKASI')) || null,
    nomor_seri: teks(K(r, 'NOMOR SERI')) || null, tanggal_perolehan: tp.tanggal, tanggal_perolehan_teks: tp.teks,
    pelapor: teks(K(r, 'PELAPOR')) || null, diperbarui_pada: tu.tanggal ? `${tu.tanggal}T00:00:00+07:00` : null,
    _excel: excel, _nomorGa: teks(K(r, 'NOMOR INVENTARIS')) || null, _lokasiAsli: teks(K(r, 'LOKASI INVENTARIS')), _kondisiAsli: teks(K(r, 'KONDISI BARANG')),
  }
})
// urutan keputusan user 29 Okt: di akhir urutan Painting -> Degreasing, Phosphating, Air
const BAK = [['BAK-1', 'BAK DEGREASING'], ['BAK-3', 'BAK PHOSPHATING'], ['BAK-2', 'BAK AIR']]
  .map(([k, n]) => ({ kunci: `BARU:${k}`, nama: n, lokasi_kode: 'PT', pengguna: null, kondisi: 'belum_dinilai', detail_kondisi: null,
    merk_spesifikasi: null, nomor_seri: null, tanggal_perolehan: null, tanggal_perolehan_teks: null, pelapor: null, diperbarui_pada: null,
    baru: true, _excel: null, _kodeLama: k }))

// ── file siap-impor (opsional): ambil nomor / kode lokasi / kode lama / bak baru, laporkan selisih ──────
const selisih = []
if (fileSiap) {
  const sp = bacaSheet(fileSiap, n => /DATABASE|INVENTARIS/i.test(n))
  const ks = (row, ...hs) => { for (const h of hs) if (sp.kol[h] !== undefined) return row[sp.kol[h]]; return undefined }
  console.log(`File siap-impor: sheet "${sp.nama}", ${sp.baris.length} baris, kolom: ${sp.header.filter(Boolean).join(' | ')}`)
  const sisa = [...sp.baris]
  const ambil = (b) => {  // cocokkan per urutan + nama (nama kembar tetap dipasangkan berurutan)
    const i = sisa.findIndex(x => kunciTeks(ks(x.r, 'NAMA BARANG')) === kunciTeks(b.nama)); return i < 0 ? null : sisa.splice(i, 1)[0]
  }
  for (const b of baris) {
    const s = ambil(b)
    if (!s) { selisih.push(`GA baris ${b._excel} "${b.nama}": tidak ada di file siap-impor`); continue }
    for (const h of ga.header.filter(Boolean)) {
      const H = kunciTeks(h); if (H === 'NOMOR INVENTARIS') continue
      const a = K(ga.baris.find(x => x.excel === b._excel).r, H), c = ks(s.r, H)
      const sama = typeof a === 'number' || typeof c === 'number' ? String(a) === String(c) : teks(a) === teks(c)
      if (c !== undefined && !sama) selisih.push(`GA baris ${b._excel} "${b.nama}" kolom ${h}: GA="${teks(a)}" siap="${teks(c)}"`)
    }
    const nomor = teks(ks(s.r, 'NOMOR INVENTARIS')) || null
    const kodeLok = teks(ks(s.r, 'KODE LOKASI', 'KODE')) || null
    if (kodeLok && kodeLok !== b.lokasi_kode) selisih.push(`GA baris ${b._excel} "${b.nama}": kode lokasi siap=${kodeLok}, dari teks lokasi GA=${b.lokasi_kode}`)
    if (nomor) b.nomor_inventaris = nomor
    b._kodeLamaSiap = teks(ks(s.r, 'KODE LAMA')) || null
  }
  for (const s of sisa) {  // baris tambahan di siap-impor = calon 3 bak baru
    const nama = teks(ks(s.r, 'NAMA BARANG')); const bak = BAK.find(x => kunciTeks(x.nama) === kunciTeks(nama))
    if (!bak) { selisih.push(`Baris siap-impor ${s.excel} "${nama}": tidak ada di GA dan bukan bak baru`); continue }
    const nomor = teks(ks(s.r, 'NOMOR INVENTARIS')) || null; if (nomor) bak.nomor_inventaris = nomor
    bak._kodeLamaSiap = teks(ks(s.r, 'KODE LAMA')) || null
    const kon = KONDISI[kunciTeks(ks(s.r, 'KONDISI BARANG'))]; if (kon) bak.kondisi = kon
  }
  for (const b of BAK) if (!sp.baris.some(s => kunciTeks(ks(s.r, 'NAMA BARANG')) === kunciTeks(b.nama))) selisih.push(`Bak baru "${b.nama}" tidak ada di file siap-impor`)
}
const semua = [...baris, ...BAK]

// ── simulasi nomor (bila tidak dari file) ────────────────────────────────────────────────────
const penghitung = {}
for (const b of semua) {
  if (b.nomor_inventaris || !BERNOMOR.has(b.lokasi_kode)) { b._nomorTampil = b.nomor_inventaris || null; continue }
  penghitung[b.lokasi_kode] = (penghitung[b.lokasi_kode] || 0) + 1
  b._nomorTampil = `VIT-${b.lokasi_kode}-${pad(penghitung[b.lokasi_kode])}`
}

// Nomor terakhir per lokasi yang ditetapkan user (29 Okt 2026) - dry-run GAGAL bila berbeda.
const NOMOR_AKHIR_HARUS = { MKN: 16, PT: 11, ASB: 23, QC: 3, NP: 8, WH: 7, KTR: 44, HR: 3, WS: 3, PKR: 1 }
const cekNomor = Object.entries(NOMOR_AKHIR_HARUS).filter(([k, v]) => (penghitung[k] || 0) !== v).map(([k, v]) => `${k}: keluar ${penghitung[k] || 0}, harus ${v}`)
  .concat(Object.keys(penghitung).filter(k => !(k in NOMOR_AKHIR_HARUS)).map(k => `${k}: tidak ada di daftar user (${penghitung[k]})`))
if (cekNomor.length) galat.push('Nomor terakhir tidak sesuai: ' + cekNomor.join(', '))
const fileNomor = arg('nomor-json')
if (fileNomor) fs.writeFileSync(fileNomor, JSON.stringify(Object.fromEntries(semua.map(b => [b.kunci, b._nomorTampil]))))

// ── data lama live (baca saja) ───────────────────────────────────────────────────────────────
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const semuaBaris = async (t, c) => { let r = []; for (let i = 0; ; i += 1000) { const { data, error } = await db.from(t).select(c).order('id').range(i, i + 999); if (error) throw new Error(`${t}: ${error.message}`); r = r.concat(data); if (data.length < 1000) break } return r }
const [mesin, rutin, rlog, mlog] = await Promise.all([semuaBaris('mesin', 'id,kode,nama'), semuaBaris('maintenance_rutin', 'id,mesin_id,is_active'),
  semuaBaris('maintenance_rutin_log', 'id,rutin_id,foto'), semuaBaris('maintenance_log', 'id,mesin_id,status,judul,kendala,foto')])
// salinan persis inv_padanan_lama di migrasi 20261030010000
const PADANAN = [[1, 'MSN-001', 'GA:3'], [2, 'MSN-002', 'GA:4'], [3, 'NP-001', 'GA:68'], [4, 'MSN-004', 'GA:25'], [5, 'BAK-1', 'BARU:BAK-1'],
  [6, 'BAK-2', 'BARU:BAK-2'], [7, 'BAK-3', 'BARU:BAK-3'], [8, 'NP-002', 'GA:67'], [10, 'MSN-005', 'GA:2']]

// ── laporan ──────────────────────────────────────────────────────────────────────────────────
const out = []; const p = (...a) => out.push(a.join(' '))
p('=== RINGKASAN DRY-RUN IMPOR ===')
p(`File GA: ${path.basename(fileGa)} (sheet "${ga.nama}") - ${baris.length} barang + ${BAK.length} bak baru = ${semua.length}`)
p(`Nomor: ${fileSiap ? 'dari ' + path.basename(fileSiap) : 'dibuat database saat impor - urutan baris Excel per kode lokasi, 2 digit, 3 bak di akhir Painting (keputusan user 29 Okt)'}`)
p('Nomor terakhir per lokasi:', Object.entries(penghitung).map(([k, v]) => `${k}-${pad(v)}`).join(', '), `| bernomor ${semua.filter(b => b._nomorTampil).length}, tanpa nomor ${semua.filter(b => !b._nomorTampil).length}`, cekNomor.length ? '!! TIDAK SESUAI' : '(sesuai daftar user)')
p(`Kolom Nomor Inventaris di GA terisi: ${baris.filter(b => b._nomorGa).length}`)
const hitung = (f) => semua.reduce((a, b) => (a[f(b)] = (a[f(b)] || 0) + 1, a), {})
p('Per lokasi:', JSON.stringify(hitung(b => b.lokasi_kode)))
p('Per kondisi:', JSON.stringify(hitung(b => b.kondisi)))
p(`Lokasi kosong -> BELUM (${semua.filter(b => b.lokasi_kode === 'BELUM').length}):`, semua.filter(b => b.lokasi_kode === 'BELUM').map(b => `${b.nama} [${b.kunci}]`).join('; '))
p(`Lokasi "Wiring" -> WR, nomor kosong sampai admin menentukan Power/Control (${semua.filter(b => b.lokasi_kode === 'WR').length}):`, semua.filter(b => b.lokasi_kode === 'WR').map(b => `${b.nama} [${b.kunci}]`).join('; '))
p(`Kondisi kosong -> Belum dinilai (${baris.filter(b => !teks(b._kondisiAsli)).length}):`, baris.filter(b => !teks(b._kondisiAsli)).map(b => `${b.nama} [${b.kunci}]`).join('; '))
p('Rusak tanpa laporan:', semua.filter(b => b.kondisi === 'rusak').map(b => `${b.nama} [${b.kunci}] (Excel "${b._kondisiAsli}")`).join('; ') || '-')
const kembar = Object.entries(semua.reduce((a, b) => { const k = kunciTeks(b.nama) + ' @ ' + b.lokasi_kode; (a[k] ||= []).push(b.kunci); return a }, {})).filter(([, v]) => v.length > 1)
p(`Nama kembar di lokasi sama (tetap barang berbeda) (${kembar.length}):`, kembar.map(([k, v]) => `${k}: ${v.join(', ')}`).join('; '))
const dirapikan = baris.filter(b => teks(ga.baris.find(x => x.excel === b._excel).r[ga.kol['NAMA BARANG']]) !== String(ga.baris.find(x => x.excel === b._excel).r[ga.kol['NAMA BARANG']]))
p('Spasi dirapikan (nama/lokasi/kondisi):', [...dirapikan.map(b => `nama "${ga.baris.find(x => x.excel === b._excel).r[ga.kol['NAMA BARANG']]}"`),
  ...baris.filter(b => b._lokasiAsli !== String(K(ga.baris.find(x => x.excel === b._excel).r, 'LOKASI INVENTARIS'))).map(b => `lokasi "${K(ga.baris.find(x => x.excel === b._excel).r, 'LOKASI INVENTARIS')}" (${b.kunci})`),
  ...baris.filter(b => b._kondisiAsli !== String(K(ga.baris.find(x => x.excel === b._excel).r, 'KONDISI BARANG'))).map(b => `kondisi "${K(ga.baris.find(x => x.excel === b._excel).r, 'KONDISI BARANG')}" (${b.kunci})`)].join('; ') || '-')
p('Tanggal perolehan:', `${semua.filter(b => b.tanggal_perolehan).length} terisi, teks asli disimpan:`, semua.filter(b => b.tanggal_perolehan_teks).map(b => `"${b.tanggal_perolehan_teks}"->${b.tanggal_perolehan || '?'}`).join(', '))
p(`Tanggal terakhir update kosong (tetap NULL): ${baris.filter(b => !b.diperbarui_pada).length}; Pelapor kosong (tetap NULL): ${baris.filter(b => !b.pelapor).length}`)
p('Catatan:', catatan.join('; ') || '-')
p('GALAT:', galat.length ? galat.join('; ') : 'tidak ada')
p('')
p('=== PADANAN KODE LAMA (perlu persetujuan) ===')
for (const [mid, kode, kunci] of PADANAN) {
  const m = mesin.find(x => x.id === mid); const b = semua.find(x => x.kunci === kunci)
  const rIds = rutin.filter(r => r.mesin_id === mid).map(r => r.id)
  const lg = rlog.filter(l => rIds.includes(l.rutin_id)); const lp = mlog.filter(l => l.mesin_id === mid)
  const aktif = lp.filter(l => l.status !== 'closed')
  const cocokKode = m?.kode === kode ? '' : ` !! kode DB=${m?.kode}`
  p(`${kode.padEnd(8)} mesin#${mid} "${m?.nama}"${cocokKode} -> ${kunci} "${b?.nama ?? '!! TIDAK ADA'}" ${b?.lokasi_kode ?? ''} ${b?._nomorTampil ?? ''}`)
  p(`         jadwal ${rIds.length} (nonaktif ${rutin.filter(r => r.mesin_id === mid && !r.is_active).length}), riwayat ${lg.length} (media ${lg.reduce((a, l) => a + (l.foto || []).length, 0)}), laporan ${lp.length} (aktif ${aktif.length})`
    + (aktif.length ? ` -> kondisi Excel "${b?._kondisiAsli || b?.kondisi}" DITIMPA jadi Rusak (laporan ${aktif.map(l => '#' + l.id + ' ' + (l.judul || l.kendala || '').slice(0, 30)).join(', ')})` : ''))
  if (b?._kodeLamaSiap !== undefined && b._kodeLamaSiap !== kode) p(`         !! kode lama di file siap-impor = ${b._kodeLamaSiap}`)
}
const tak = mesin.filter(m => !PADANAN.some(x => x[0] === m.id))
p('Tidak dipetakan (tetap di tabel lama):', tak.map(m => `${m.kode} "${m.nama}" (jadwal ${rutin.filter(r => r.mesin_id === m.id).length}, laporan ${mlog.filter(l => l.mesin_id === m.id).length})`).join('; '))
p(`Total lama: jadwal ${rutin.length}, riwayat ${rlog.length}, laporan ${mlog.length} -> terpetakan: jadwal ${rutin.filter(r => PADANAN.some(x => x[0] === r.mesin_id)).length}, riwayat ${rlog.filter(l => rutin.some(r => r.id === l.rutin_id && PADANAN.some(x => x[0] === r.mesin_id))).length}, laporan ${mlog.filter(l => PADANAN.some(x => x[0] === l.mesin_id)).length}`)
p('')
p('=== SELISIH GA vs SIAP-IMPOR (dilewati - keputusan user 29 Okt) ===')
p(fileSiap ? (selisih.length ? selisih.join('\n') : 'tidak ada selisih') : 'belum dibandingkan (file siap-impor tidak diberikan)')
p('')
p('=== NOMOR PER BARANG (urutan impor) ===')
for (const b of semua) p(`${b.kunci.padEnd(11)} ${(b._nomorTampil || '(tanpa nomor)').padEnd(13)} ${b.lokasi_kode.padEnd(5)} ${b.kondisi.padEnd(17)} ${b.nama}`)
console.log(out.join('\n'))

// ── file SQL impor ───────────────────────────────────────────────────────────────────────────
if (fileSql) {
  if (galat.length) { console.error('\nFile SQL TIDAK ditulis karena ada GALAT.'); process.exit(1) }
  const muatan = semua.map(b => Object.fromEntries(Object.entries(b).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)))
  const json = JSON.stringify(muatan, null, 0).replace(/},{/g, '},\n{')
  if (json.includes('$IMPOR$')) throw new Error('penanda $IMPOR$ muncul di data')
  fs.writeFileSync(fileSql, `-- IMPOR AWAL INVENTARIS (T1) - DIBUAT OTOMATIS oleh supabase/scripts/inv_dryrun_impor.mjs ${new Date().toISOString()}
-- Sumber: ${path.basename(fileGa)}${fileSiap ? ' + ' + path.basename(fileSiap) + ' (nomor/kode)' : ' (TANPA file siap-impor: nomor dibuat database)'}
-- ${semua.length} baris. Jalankan di SQL Editor SETELAH migrasi 20261030010000:
--   1) ganti ISI_USERNAME_ADMIN dengan username admin Anda (tabel admins)
--   2) jalankan apa adanya (p_dry_run = true) -> baca ringkasan
--   3) bila sesuai, ubah true -> false dan jalankan lagi (idempoten: baris yang sudah ada dilewati)
select jsonb_pretty(public.inv_impor($IMPOR$${json}$IMPOR$::jsonb,
  true,                                   -- p_dry_run
  '${path.basename(fileGa).replace(/'/g, "''")}',
  '{"admin":"ISI_USERNAME_ADMIN"}'::jsonb));
`)
  console.error(`\nFile SQL ditulis: ${fileSql}`)
}
