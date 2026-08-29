/*
R2 Storage Bridge - dibuat sebagai bagian migrasi foto Supabase Storage -> Cloudflare R2
(egress Supabase kena limit, 25 Agu 2026).

KENAPA LEWAT EDGE FUNCTION (bukan @aws-sdk/client-s3 langsung di kode React): vista-teknik &
vista-pekerja murni SPA client-side, gak ada backend sendiri. Kalau R2_SECRET_ACCESS_KEY
ditaruh di env Vite, secret itu PASTI ikut ter-bundle ke JS yang dikirim ke browser - siapapun
bisa buka DevTools/unpack bundle dan dapat kredensial full-akses ke bucket R2. Function ini
jadi satu-satunya tempat yang pegang secret key (disimpan sebagai Edge Function secret, bukan
dikirim ke client), browser cuma dikasih presigned URL yang scope & masa berlakunya terbatas.

DUA ACTION:
- presign-upload: client kasih {key, contentType}, function balikin {uploadUrl, publicUrl}.
  Client PUT file LANGSUNG ke uploadUrl (gak lewat function ini) - jadi gak ada limit ukuran
  body dari Edge Function, foto berapapun besarnya aman.
- delete: client kasih {key}, function hapus object di R2 pakai secret key server-side.
  Dipakai lewat proxy (bukan presigned) karena delete cuma 1 key per panggilan, murah.

SETUP WAJIB SEBELUM DIPAKAI (BUKAN lewat percakapan - jangan taruh secret di riwayat chat):
`npx supabase secrets set R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx R2_PUBLIC_BASE_URL=https://xxx` dijalankan di terminal sendiri setelah
akun Cloudflare R2 selesai didaftar. R2_PUBLIC_BASE_URL butuh "Public Access" bucket
diaktifkan dulu di dashboard Cloudflare (custom domain atau r2.dev subdomain) - baru punya
nilai domain publik yang valid.
*/

import { S3Client, PutObjectCommand, DeleteObjectCommand } from 'npm:@aws-sdk/client-s3@3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

const PRESIGN_EXPIRY_SECONDS = 300

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

// Path traversal / escape dari prefix folder kategori tidak boleh - key ini yang dipakai
// bikin object path di bucket R2, bukan cuma nama file.
function isValidKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length < 512 && !key.includes('..') && !key.startsWith('/')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const bucketName = Deno.env.get('R2_BUCKET_NAME')
    const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL')
    const client = getR2Client()
    if (!client || !bucketName || !publicBaseUrl) {
      return jsonResponse({ error: 'R2 belum dikonfigurasi (secret R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME/R2_PUBLIC_BASE_URL).' }, 500)
    }

    const body = await req.json()
    const action = body?.action

    if (action === 'presign-upload') {
      const { key, contentType } = body
      if (!isValidKey(key)) return jsonResponse({ error: 'key tidak valid.' }, 400)
      if (typeof contentType !== 'string' || !contentType) return jsonResponse({ error: 'contentType wajib diisi.' }, 400)

      const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType })
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS })
      const publicUrl = `${publicBaseUrl.replace(/\/+$/, '')}/${key}`
      return jsonResponse({ uploadUrl, publicUrl })
    }

    if (action === 'delete') {
      const { key } = body
      if (!isValidKey(key)) return jsonResponse({ error: 'key tidak valid.' }, 400)
      await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: `action tidak dikenal: ${String(action)}` }, 400)
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
