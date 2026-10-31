/*
=== DINONAKTIFKAN (31 Okt 2026, keputusan user) ===
Permintaan barang TIDAK BOLEH direset / dibersihkan otomatis lagi - riwayat permintaan per panel harus utuh.
Fungsi ini sekarang langsung mengembalikan { disabled: true } (status 200) TANPA membaca atau menghapus data apa pun.
Alasan tetap di-deploy (bukan dihapus): versi yang dulu aktif di server (v8, 4 Sep 2026) = aturan LAMA "hapus semua
permintaan bulan lalu", dan fungsi ini ber-verify_jwt=true sehingga siapa pun yang memegang anon key (ada di bundel
aplikasi) bisa memanggilnya. Versi nonaktif ini menutup jalur itu. Jadwal pg_cron-nya (job 12) sudah dihapus user.
Kode pembersihan di bawah DIBIARKAN sebagai catatan & tidak pernah dijalankan; jangan diaktifkan lagi tanpa keputusan user.

Pembersihan Permintaan Lama - dipicu pg_cron sebulan sekali (nama function tetap "reset-permintaan-bulanan" supaya
jadwal & URL yang sudah ada bisa dipakai ulang).

ATURAN BARU (17 Okt 2026, keputusan user): riwayat permintaan barang per panel HARUS utuh sampai arsip. Yang boleh
dibersihkan HANYA permintaan yang:
  (1) panelnya sudah DIHAPUS PERMANEN - panel_id kosong DAN panel_id_arsip kosong / tidak ada lagi di panels_archived
      (panel aktif & panel yang diarsip TIDAK PERNAH disentuh);
  (2) berumur lebih dari 1 tahun (created_at < sekarang - 365 hari);
  (3) tidak punya hutang aktif (permintaan_item is_hutang=true & status='pending').
Sebelum hapus WAJIB backup ke R2 (backup-permintaan/bersih-YYYY-MM-DD.json, berisi permintaan + permintaan_item +
permintaan_item_koreksi). Upload gagal = TIDAK ADA yang dihapus.

ATURAN LAMA (2 Sep - 17 Okt 2026, DIHENTIKAN): semua permintaan bulan kalender sebelumnya dihapus tiap tanggal 3. Insiden:
4 Okt 01.00 WIB 248 permintaan / 457 item September terhapus -> rekap per panel tidak lengkap (dipulihkan 17 Okt dari
backup-permintaan/2026-09.json, lihat supabase/scripts/20261017_pulihkan_permintaan.sql).

Reuse kredensial R2 yang SAMA dengan r2-storage (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME).
Body opsional {"dryRun": true} -> hanya menghitung kandidat, tidak backup/hapus.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3'

const UMUR_MINIMAL_HARI = 365
// konstanta (bukan return polos) agar kode di bawahnya tetap terbaca kompilator tanpa peringatan "unreachable code"
const FUNGSI_NONAKTIF = true

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

// baca semua halaman (batas 1000 baris Supabase) dgn urutan stabil
const fetchAll = async (supabase: any, table: string, select: string, filterFn?: (q: any) => any) => {
  let all: any[] = []
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (filterFn) q = filterFn(q)
    const { data, error } = await q.order('id', { ascending: true }).range(from, from + 999)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}
const potong = <T,>(arr: T[], n = 200): T[][] => { const o: T[][] = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

function getR2Client() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  // DINONAKTIFKAN (31 Okt 2026): kembali langsung, tidak menyentuh data (lihat komentar paling atas)
  if (FUNGSI_NONAKTIF) return jsonResponse({ disabled: true, message: 'Reset permintaan bulanan dimatikan' }, 200)
  try {
    let dryRun = false
    try { dryRun = !!(await req.json())?.dryRun } catch { /* tanpa body */ }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const now = new Date()
    const batas = new Date(now.getTime() - UMUR_MINIMAL_HARI * 86400000)

    // (1)+(2) kandidat: tidak terikat panel aktif, berumur > 1 tahun
    const lama = await fetchAll(supabase, 'permintaan', '*', (q) => q.is('panel_id', null).lt('created_at', batas.toISOString()))
    if (lama.length === 0) return jsonResponse({ aturan: 'panel dihapus permanen & > 1 tahun', kandidat: 0, message: 'Tidak ada yang perlu dibersihkan.' })
    // panel arsip yang masih ada -> permintaannya TIDAK disentuh
    const idArsip = lama.map((p: any) => p.panel_id_arsip).filter((x: any) => x != null)
    const arsipAda = new Set<number>()
    for (const bagian of potong([...new Set(idArsip)])) {
      const rows = await fetchAll(supabase, 'panels_archived', 'id', (q) => q.in('id', bagian))
      rows.forEach((r: any) => arsipAda.add(r.id))
    }
    let kandidat = lama.filter((p: any) => p.panel_id_arsip == null || !arsipAda.has(p.panel_id_arsip))
    // (3) hutang aktif dikecualikan
    const idK = kandidat.map((p: any) => p.id)
    const hutang = new Set<number>()
    for (const bagian of potong(idK)) {
      const rows = await fetchAll(supabase, 'permintaan_item', 'id,permintaan_id', (q) => q.in('permintaan_id', bagian).eq('is_hutang', true).eq('status', 'pending'))
      rows.forEach((r: any) => hutang.add(r.permintaan_id))
    }
    const ditunda = kandidat.filter((p: any) => hutang.has(p.id)).length
    kandidat = kandidat.filter((p: any) => !hutang.has(p.id))
    if (kandidat.length === 0) return jsonResponse({ kandidat: 0, ditundaKarenaHutangAktif: ditunda, message: 'Tidak ada yang perlu dibersihkan.' })
    if (dryRun) return jsonResponse({ dryRun: true, kandidat: kandidat.length, ditundaKarenaHutangAktif: ditunda, contoh: kandidat.slice(0, 10).map((p: any) => ({ id: p.id, panel_nama: p.panel_nama, created_at: p.created_at })) })

    const permIds = kandidat.map((p: any) => p.id)
    let items: any[] = []
    for (const bagian of potong(permIds)) items = items.concat(await fetchAll(supabase, 'permintaan_item', '*', (q) => q.in('permintaan_id', bagian)))
    let koreksi: any[] = []
    for (const bagian of potong(items.map((i: any) => i.id))) koreksi = koreksi.concat(await fetchAll(supabase, 'permintaan_item_koreksi', '*', (q) => q.in('permintaan_item_id', bagian)))

    // BACKUP DULU ke R2 - gagal = STOP, tidak ada yang dihapus
    const client = getR2Client()
    const bucketName = Deno.env.get('R2_BUCKET_NAME')
    if (!client || !bucketName) return jsonResponse({ error: 'R2 belum dikonfigurasi - pembersihan DIBATALKAN, data masih utuh.' }, 500)
    const backupKey = `backup-permintaan/bersih-${now.toISOString().slice(0, 10)}.json`
    try {
      await client.send(new PutObjectCommand({ Bucket: bucketName, Key: backupKey, ContentType: 'application/json',
        Body: JSON.stringify({ aturan: `panel dihapus permanen & > ${UMUR_MINIMAL_HARI} hari`, exportedAt: now.toISOString(), permintaan: kandidat, permintaan_item: items, permintaan_item_koreksi: koreksi }) }))
    } catch (uploadErr: any) {
      return jsonResponse({ error: `Backup ke R2 gagal (${String(uploadErr?.message || uploadErr)}) - pembersihan DIBATALKAN, data masih utuh.` }, 500)
    }

    // hapus: item dulu (koreksi ikut cascade), baru permintaan
    for (const bagian of potong(permIds)) {
      const { error: e1 } = await supabase.from('permintaan_item').delete().in('permintaan_id', bagian)
      if (e1) return jsonResponse({ error: `Backup sukses (${backupKey}) tapi hapus permintaan_item gagal: ${e1.message}` }, 500)
      const { error: e2 } = await supabase.from('permintaan').delete().in('id', bagian)
      if (e2) return jsonResponse({ error: `Backup sukses (${backupKey}), item terhapus, tapi hapus permintaan gagal: ${e2.message}` }, 500)
    }
    await supabase.from('activity_log').insert({ user_name: 'Sistem (otomatis)', action: 'BERSIHKAN PERMINTAAN LAMA', module: 'permintaan', halaman: 'Edge Function reset-permintaan-bulanan',
      description: `${kandidat.length} permintaan + ${items.length} item (panel dihapus permanen & > ${UMUR_MINIMAL_HARI} hari) dibersihkan; backup ${backupKey}. Ditunda (hutang aktif): ${ditunda}.` })
    return jsonResponse({ backupKey, permintaan: kandidat.length, permintaan_item: items.length, koreksi: koreksi.length, ditundaKarenaHutangAktif: ditunda })
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
