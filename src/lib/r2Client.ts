// src/lib/r2Client.ts
// Helper upload/hapus foto ke Cloudflare R2 lewat Edge Function "r2-storage" - client TIDAK
// pernah pegang R2_SECRET_ACCESS_KEY, cuma dapat presigned URL bermasa-berlaku pendek lalu
// PUT langsung ke R2 (bukan lewat Edge Function, jadi gak ada limit ukuran file dari sana).
import { supabase } from './supabase'

// Batas waktu OPSIONAL (5 Okt 2026) - tanpa opsi, perilaku sama persis seperti dulu (semua pemanggil
// lama tidak terpengaruh). Dipakai Maintenance Rutin: dulu upload di jaringan pabrik bisa menggantung
// tanpa akhir, halaman ditinggal & catatan tidak pernah tersimpan (insiden BAK DEGREASING 5 Okt).
export type OpsiUploadR2 = { batasWaktuIzinMs?: number; batasWaktuUnggahMs?: number }
const denganBatasWaktu = <T,>(p: Promise<T>, ms: number | undefined, pesan: string): Promise<T> =>
  !ms ? p : Promise.race([p, new Promise<T>((_, tolak) => setTimeout(() => tolak(new Error(pesan)), ms))])

export const uploadToR2 = async (file: Blob, key: string, contentType: string, opsi?: OpsiUploadR2): Promise<string> => {
  const { data, error } = await denganBatasWaktu(
    supabase.functions.invoke('r2-storage', { body: { action: 'presign-upload', key, contentType } }),
    opsi?.batasWaktuIzinMs, 'Waktu habis saat meminta izin upload (koneksi lambat)')
  if (error || !data?.uploadUrl || !data?.publicUrl) throw new Error(error?.message || 'Gagal mendapatkan signed URL R2')
  // Cache-Control WAJIB dikirim persis sama kayak yang di-sign di presign-upload (r2-storage
  // edge function) - signature presigned URL S3/R2 gagal (403) kalau header yang disign gak
  // dikirim balik pas PUT beneran.
  const pengendali = opsi?.batasWaktuUnggahMs ? new AbortController() : null
  const pewaktu = pengendali ? setTimeout(() => pengendali.abort(), opsi!.batasWaktuUnggahMs) : null
  let putRes: Response
  try {
    putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' }, body: file, signal: pengendali?.signal })
  } catch (err: any) {
    if (pengendali?.signal.aborted) throw new Error('Waktu habis saat mengunggah file (koneksi lambat)')
    throw err
  } finally {
    if (pewaktu) clearTimeout(pewaktu)
  }
  if (!putRes.ok) throw new Error(`Upload ke R2 gagal (status ${putRes.status})`)
  return data.publicUrl as string
}

export const deleteFromR2 = async (key: string): Promise<void> => {
  await supabase.functions.invoke('r2-storage', { body: { action: 'delete', key } })
}

// URL publik R2 diketahui client (bukan secret, cuma domain baca) - dipakai fotoHelpers.ts
// buat bedain foto lama (Supabase) vs foto baru (R2) pas hapus.
export const r2PublicBaseUrl = (): string | undefined => import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined

export const extractR2Key = (url: string): string | null => {
  const base = r2PublicBaseUrl()
  if (!base || !url.startsWith(base)) return null
  return decodeURIComponent(url.slice(base.length).replace(/^\/+/, ''))
}
