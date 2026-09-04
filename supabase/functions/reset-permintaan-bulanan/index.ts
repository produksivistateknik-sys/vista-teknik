/*
Reset Permintaan Bulanan - dipicu pg_cron tanggal 3 tiap bulan jam 01:00 WIB (lihat migrasi
cron.schedule terkait, pola sama dengan timer-reminder-check/maintenance-reminder-check).

Tujuan: kurangi beban penyimpanan tabel permintaan/permintaan_item yang terus tumbuh (fitur
BBMB/BBMU, Vista Pekerja "Permintaan Barang" & Gudang "Permintaan Masuk"/"Riwayat"). SEMUA data
permintaan bulan SEBELUMNYA (created_at jatuh di bulan kalender sebelum bulan berjalan saat
function ini dipanggil) dihapus permanen - TAPI WAJIB backup dulu ke R2
(backup-permintaan/{YYYY-MM}.json) SEBELUM delete dijalankan. Kalau upload backup gagal (R2
belum dikonfigurasi, jaringan putus, dll), delete DIBATALKAN SELURUHNYA - lebih baik data lama
menumpuk 1 bulan ekstra daripada hilang tanpa backup.

Reuse kredensial R2 yang SAMA dengan r2-storage (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/
R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME) - upload LANGSUNG server-side (bukan presigned URL, gak
ada browser yang terlibat di sini, function ini yang pegang body JSON-nya).

FIX (5 Sep 2026, fitur Hutang) - permintaan yang MASIH PUNYA hutang aktif (permintaan_item
dengan is_hutang=true DAN status='pending' yang menunjuk ke permintaan itu) DIKECUALIKAN dari
backup+delete bulan lalu, walau created_at-nya sudah lewat bulan kalender. Tanpa ini, hutang
yang belum lunas pas cron ini jalan bakal HILANG PERMANEN dari aplikasi (cuma ada di file
backup JSON R2, gak bisa dicicil lagi) - row itu ditunda ke siklus reset bulan berikutnya,
diulang terus sampai hutangnya beneran lunas baru ikut ke-backup+hapus.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

const fetchAll = async (supabase: any, table: string, select: string, filterFn?: (q: any) => any) => {
  let all: any[] = []
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (filterFn) q = filterFn(q)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}

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
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const now = new Date()
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const periode = `${prevMonthStart.getUTCFullYear()}-${String(prevMonthStart.getUTCMonth() + 1).padStart(2, '0')}`

    const allPerms = await fetchAll(supabase, 'permintaan', '*', (q) =>
      q.gte('created_at', prevMonthStart.toISOString()).lt('created_at', thisMonthStart.toISOString()))

    if (allPerms.length === 0) {
      return jsonResponse({ periode, permintaan: 0, permintaan_item: 0, message: 'Tidak ada data bulan lalu, tidak ada yang dihapus.' })
    }

    const allPermIds = allPerms.map((p: any) => p.id)
    // Cari permintaan yang MASIH PUNYA hutang aktif (belum lunas) - dikecualikan dari
    // backup+delete kali ini, ditunda ke siklus reset bulan berikutnya (lihat komentar fix di atas).
    const hutangAktifItems = await fetchAll(supabase, 'permintaan_item', 'permintaan_id', (q) =>
      q.in('permintaan_id', allPermIds).eq('is_hutang', true).eq('status', 'pending'))
    const permIdsHutangAktif = new Set(hutangAktifItems.map((it: any) => it.permintaan_id))
    const perms = allPerms.filter((p: any) => !permIdsHutangAktif.has(p.id))
    const ditunda = allPerms.length - perms.length

    if (perms.length === 0) {
      return jsonResponse({ periode, permintaan: 0, permintaan_item: 0, ditundaKarenaHutangAktif: ditunda, message: 'Semua data bulan lalu masih punya hutang aktif, ditunda ke siklus berikutnya.' })
    }

    const permIds = perms.map((p: any) => p.id)
    const items = await fetchAll(supabase, 'permintaan_item', '*', (q) => q.in('permintaan_id', permIds))

    // BACKUP DULU ke R2 - kalau ini gagal, STOP (jangan lanjut ke delete apapun alasannya).
    const client = getR2Client()
    const bucketName = Deno.env.get('R2_BUCKET_NAME')
    if (!client || !bucketName) {
      return jsonResponse({ error: 'R2 belum dikonfigurasi (secret R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME) - delete DIBATALKAN, data bulan lalu masih utuh.' }, 500)
    }
    const backupBody = JSON.stringify({ periode, exportedAt: now.toISOString(), permintaan: perms, permintaan_item: items })
    const backupKey = `backup-permintaan/${periode}.json`
    try {
      await client.send(new PutObjectCommand({ Bucket: bucketName, Key: backupKey, Body: backupBody, ContentType: 'application/json' }))
    } catch (uploadErr: any) {
      return jsonResponse({ error: `Backup ke R2 gagal (${String(uploadErr?.message || uploadErr)}) - delete DIBATALKAN, data bulan lalu masih utuh.` }, 500)
    }

    // Backup sukses - baru boleh delete. Item dulu (anak), baru permintaan (induk).
    const { error: delItemErr } = await supabase.from('permintaan_item').delete().in('permintaan_id', permIds)
    if (delItemErr) return jsonResponse({ error: `Backup sukses (${backupKey}) tapi delete permintaan_item gagal: ${delItemErr.message}` }, 500)
    const { error: delPermErr } = await supabase.from('permintaan').delete().in('id', permIds)
    if (delPermErr) return jsonResponse({ error: `Backup sukses (${backupKey}), permintaan_item terhapus, tapi delete permintaan gagal: ${delPermErr.message}` }, 500)

    return jsonResponse({ periode, backupKey, permintaan: perms.length, permintaan_item: items.length, ditundaKarenaHutangAktif: ditunda, message: 'Backup + hapus bulan lalu selesai.' })
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
