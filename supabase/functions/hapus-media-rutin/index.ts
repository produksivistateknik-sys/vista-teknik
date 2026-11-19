/*
Hapus otomatis foto/video Maintenance Rutin > 30 hari sejak diunggah (19 Nov 2026, Tahap 2 - keputusan user). Riwayat TETAP ada.

Dipanggil HANYA oleh:
  - pg_cron 'hapus-media-rutin-harian' 02.00 WIB (header x-pemicu: cron) - menghapus hanya bila saklar 'otomatis';
  - inv_media_rutin_jalankan_manual() dari SQL Editor (x-pemicu: manual) - saklar 'manual' atau 'otomatis'.
Keduanya mengirim header x-kunci-hapus = rahasia di tabel inv_rahasia_internal (dibuat acak oleh migrasi 20261119020000, tidak
terbaca anon). Tanpa header yang cocok -> 401 sebelum kerja apa pun. Isi body diabaikan; tidak menerima nama berkas.
Deploy: npx supabase functions deploy hapus-media-rutin --no-verify-jwt --project-ref aoxhxfsqjnquwsxjrsmo
  (--no-verify-jwt: pemanggil dari pg_net tidak membawa JWT; penjaganya header rahasia. anon key = JWT sah, jadi verify_jwt
  saja tidak cukup menjaga.)
Secret yang dipakai (sudah ada, sama dgn r2-storage): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
R2_PUBLIC_BASE_URL; SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis dari Supabase.
Logika per berkas & aturan jalur: ./proses.ts. Aturan "boleh dihapus": fungsi SQL inv_media_rutin_status (satu sumber).
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from 'npm:@aws-sdk/client-s3@3'
import { prosesHapus, type R2 } from './proses.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// perbandingan waktu-konstan (panjang beda -> tetap membandingkan seluruh isi)
function samaRahasia(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b)
  let beda = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) beda |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return beda === 0
}

let rahasiaTersimpan: string | null = null   // disimpan selama instance hidup - panggilan berikutnya tidak membaca DB lagi

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metode tidak diizinkan' }, 405)
  // rahasia = 64 karakter heksa (migrasi 20261119020000): header kosong / bentuk lain ditolak sebelum menyentuh database
  const kiriman = req.headers.get('x-kunci-hapus') || ''
  if (!/^[0-9a-f]{64}$/.test(kiriman)) return json({ error: 'tidak diizinkan' }, 401)
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    if (!rahasiaTersimpan) {
      const { data: rahasia, error: eRahasia } = await supabase.rpc('inv_media_rutin_kunci_internal')
      if (eRahasia) { console.error('hapus-media-rutin: gagal membaca rahasia', eRahasia.message); return json({ error: 'tidak bisa memeriksa izin' }, 500) }
      if (typeof rahasia === 'string' && rahasia.length >= 32) rahasiaTersimpan = rahasia
    }
    if (!rahasiaTersimpan || !samaRahasia(kiriman, rahasiaTersimpan)) return json({ error: 'tidak diizinkan' }, 401)

    const pemicu = req.headers.get('x-pemicu') === 'cron' ? 'cron' : 'manual'
    const accountId = Deno.env.get('R2_ACCOUNT_ID'), accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID'), secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucket = Deno.env.get('R2_BUCKET_NAME'), basisUrl = Deno.env.get('R2_PUBLIC_BASE_URL')
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !basisUrl) return json({ error: 'R2 belum dikonfigurasi' }, 500)
    const s3 = new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } })

    const r2: R2 = {
      ada: async (kunci) => {
        try { const h = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: kunci })); return { ada: true, ukuran: Number(h.ContentLength || 0) } }
        catch (e) {
          const g = e as { name?: string; $metadata?: { httpStatusCode?: number } } | null
          if (g?.$metadata?.httpStatusCode === 404 || g?.name === 'NotFound' || g?.name === 'NoSuchKey') return { ada: false, ukuran: 0 }
          throw e
        }
      },
      hapus: async (kunci) => { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: kunci })) },
    }
    const hasil = await prosesHapus({ rpc: (n, a) => supabase.rpc(n, a), r2, basisUrl, pemicu, runId: crypto.randomUUID() })
    console.log('hapus-media-rutin', JSON.stringify(hasil))
    return json(hasil)
  } catch (e) {
    console.error('hapus-media-rutin error:', e)
    return json({ error: String((e as { message?: string } | null)?.message || e).slice(0, 300) }, 500)
  }
})
