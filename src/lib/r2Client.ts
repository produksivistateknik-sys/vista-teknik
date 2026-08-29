// src/lib/r2Client.ts
// Helper upload/hapus foto ke Cloudflare R2 lewat Edge Function "r2-storage" - client TIDAK
// pernah pegang R2_SECRET_ACCESS_KEY, cuma dapat presigned URL bermasa-berlaku pendek lalu
// PUT langsung ke R2 (bukan lewat Edge Function, jadi gak ada limit ukuran file dari sana).
import { supabase } from './supabase'

export const uploadToR2 = async (file: Blob, key: string, contentType: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('r2-storage', { body: { action: 'presign-upload', key, contentType } })
  if (error || !data?.uploadUrl || !data?.publicUrl) throw new Error(error?.message || 'Gagal mendapatkan signed URL R2')
  const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
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
