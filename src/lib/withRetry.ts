// Retry singkat dgn backoff pendek buat aksi penting yang gagal karena koneksi lambat/putus
// sekejap (25 Sep 2026, bagian dari fix "geser Raw Schedule balik lagi instan" - lihat
// RawSchedule.tsx confirmDrag). Cermin versi minimal dari withRetry di vista-pekerja
// (src/lib/koneksi.ts) - tanpa badge status koneksi (belum ada yang butuh itu di vista-teknik).
const RETRY_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [500, 1500, 3000]
const REQUEST_TIMEOUT_MS = 15000

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout - koneksi lambat')), ms)),
  ])
}

export async function withRetry<T>(fn: () => PromiseLike<T>, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<T> {
  let lastErr: any
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    try {
      return await withTimeout(fn(), timeoutMs)
    } catch (err) {
      lastErr = err
      if (i < RETRY_ATTEMPTS - 1) await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[i]))
    }
  }
  throw lastErr
}
