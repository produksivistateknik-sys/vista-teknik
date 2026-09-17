import { supabase } from './supabase'

// Rotate PERMANEN foto/video (17 Sep 2026) - file di R2 TIDAK diubah, orientasi disimpan
// sbg METADATA (tabel media_rotasi, key by URL) - semua viewer baca ini & terapkan
// transform:rotate() pas render. Helper ini DIDUPLIKASI KECIL di vista-pekerja
// (src/lib/mediaRotasi.ts di sana) - pola yang sama dipakai file lintas-repo lain di project
// ini (mis. useWoEngineeringBroadcast, KOMPONEN_PROSES_MAP) - 2 repo terpisah gak bisa share
// modul langsung.
//
// Kenapa key by URL (bukan id row asal foto) - lihat komentar lengkap di migration
// 20260917030000_media_rotasi.sql: foto/video tersebar di puluhan kolom/tabel berbeda
// (termasuk NESTED di dalam jsonb), URL file itu sendiri sudah unik per objek R2 by design -
// satu mekanisme lookup yang sama kepakai di mana pun foto itu aslinya disimpan.

const CHUNK=150 // batas aman .in() per query, list URL biasanya kecil (1 galeri/panel)

// Batch fetch rotasi utk banyak URL sekaligus (1 query per galeri yang dibuka, bukan per-foto)
export async function fetchRotasiBatch(urls:string[]):Promise<Record<string,number>>{
  const unik=[...new Set(urls.filter(Boolean))]
  if(unik.length===0)return{}
  const out:Record<string,number>={}
  for(let i=0;i<unik.length;i+=CHUNK){
    const slice=unik.slice(i,i+CHUNK)
    const{data,error}=await supabase.from('media_rotasi').select('url,rotasi_derajat').in('url',slice)
    if(error){console.error('gagal ambil media_rotasi:',error);continue}
    ;(data??[]).forEach((r:any)=>{out[r.url]=r.rotasi_derajat})
  }
  return out
}

// Putar 1 foto/video 90 derajat dari posisi SEKARANG (siklus 0->90->180->270->0) - upsert
// (bukan insert polos), row pertama kali kena rotate baru bikin baris baru di media_rotasi.
export async function rotateMedia(url:string,currentDeg:number,updatedBy:string):Promise<number>{
  const next=((currentDeg+90)%360) as 0|90|180|270
  const{error}=await supabase.from('media_rotasi').upsert({url,rotasi_derajat:next,updated_at:new Date().toISOString(),updated_by:updatedBy},{onConflict:'url'})
  if(error){console.error('gagal simpan rotasi:',error);throw error}
  return next
}
