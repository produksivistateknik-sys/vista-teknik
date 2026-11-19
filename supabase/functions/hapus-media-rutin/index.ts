/*
Hapus otomatis foto/video Maintenance Rutin > 30 hari sejak diunggah (19 Nov 2026, Tahap 2 - keputusan user). Riwayat TETAP ada.

Dipanggil HANYA oleh:
  - pg_cron 'hapus-media-rutin-harian' 02.00 WIB (header x-pemicu: cron) - menghapus hanya bila saklar 'otomatis';
  - inv_media_rutin_jalankan_manual() dari SQL Editor (x-pemicu: manual) - saklar 'manual' atau 'otomatis'.
Keduanya mengirim header x-kunci-hapus = rahasia di tabel inv_rahasia_internal (dibuat acak oleh migrasi 20261119020000, tidak
terbaca anon). Tanpa header yang cocok -> 401 sebelum kerja apa pun. Isi body diabaikan; tidak menerima nama berkas.
Mode uji (header x-uji: r2, tetap wajib rahasia): HANYA mengecek satu kunci yang pasti tidak ada di R2 & mengembalikan kode HTTP-nya -
tidak menyentuh saklar, log, maupun berkas apa pun.
Deploy: npx supabase functions deploy hapus-media-rutin --no-verify-jwt --project-ref aoxhxfsqjnquwsxjrsmo
  (--no-verify-jwt: pemanggil dari pg_net tidak membawa JWT; penjaganya header rahasia. anon key = JWT sah, jadi verify_jwt
  saja tidak cukup menjaga.)
R2 lewat aws4fetch (fetch biasa + tanda tangan SigV4), BUKAN @aws-sdk/client-s3: insiden 19 Nov 2026 18.57 WIB - eksekusi manual
pertama mati (pg_net 503, tanpa catatan) tepat setelah DeleteObject berkas pertama, yaitu saat HeadObject ke kunci yang sudah
tidak ada; di Deno lokal SDK normal, jadi diduga perilaku node-compat SDK di runtime Edge Supabase. Dengan fetch, 404 = kode status.
Secret yang dipakai (sudah ada, sama dgn r2-storage): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
R2_PUBLIC_BASE_URL; SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis dari Supabase.
Logika per berkas & aturan jalur: ./proses.ts. Aturan "boleh dihapus": fungsi SQL inv_media_rutin_status (satu sumber).
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'
import { prosesHapus, bersihkanPesan, type R2 } from './proses.ts'

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

    const accountId = Deno.env.get('R2_ACCOUNT_ID'), accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID'), secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucket = Deno.env.get('R2_BUCKET_NAME'), basisUrl = Deno.env.get('R2_PUBLIC_BASE_URL')
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !basisUrl) return json({ error: 'R2 belum dikonfigurasi' }, 500)
    // retries 2 (bawaan aws4fetch 10x utk 5xx/429 bisa melewati batas waktu per panggilan); tiap permintaan dibatalkan setelah 15 dtk
    const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto', retries: 2 })
    // kunci sudah divalidasi pola ketat di proses.ts (hanya huruf/angka/_/./-, tanpa %, ?, #, ..) -> aman disambung ke path
    const urlObjek = (kunci: string) => `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${kunci}`

    const r2: R2 = {
      ada: async (kunci) => {
        const r = await aws.fetch(urlObjek(kunci), { method: 'HEAD', signal: AbortSignal.timeout(15_000) })
        await r.body?.cancel()
        if (r.status === 200) return { ada: true, ukuran: Number(r.headers.get('content-length') || 0) }
        if (r.status === 404) return { ada: false, ukuran: 0 }
        throw new Error('R2 cek berkas: HTTP ' + r.status)
      },
      hapus: async (kunci) => {
        const r = await aws.fetch(urlObjek(kunci), { method: 'DELETE', signal: AbortSignal.timeout(15_000) })
        await r.body?.cancel()
        if (r.status !== 204 && r.status !== 200) throw new Error('R2 hapus berkas: HTTP ' + r.status)
      },
    }

    if (req.headers.get('x-uji') === 'r2') {
      const cek = await r2.ada('maintenance-rutin/0/0_ujitidakada.jpg')   // kunci yang pasti tidak ada
      return json({ uji: 'r2', kunci_tidak_ada: cek.ada ? 'ADA (aneh)' : 'tidak ada (404) - benar' })
    }

    const pemicu = req.headers.get('x-pemicu') === 'cron' ? 'cron' : 'manual'
    const hasil = await prosesHapus({ rpc: (n, a) => supabase.rpc(n, a), r2, basisUrl, pemicu, runId: crypto.randomUUID() })
    console.log('hapus-media-rutin', JSON.stringify(hasil))
    return json(hasil)
  } catch (e) {
    console.error('hapus-media-rutin error:', e)
    return json({ error: bersihkanPesan(e).slice(0, 300) }, 500)
  }
})
