import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Banner broadcast "WO diubah Engineering" (17 Sep 2026, fitur baru) - hook dipakai App.tsx
// (Vista Teknik) DAN diduplikasi kecil di Vista Pekerja (repo terpisah, gak bisa share modul -
// pola yang sama dipakai di file lain lintas-repo di project ini, mis. KOMPONEN_PROSES_MAP).
// Beda dari bel notifikasi (App.tsx) yang agregat on-the-fly tanpa tabel sendiri - ini genuinely
// broadcast event (1 baris = 1 kejadian tambah/edit WO oleh Engineering) dengan status "dibaca"
// PER AKUN (tabel wo_engineering_events_dibaca, primary key (event_id,akun)) - 1 akun tandai
// baca TIDAK mempengaruhi akun lain, beda total dari fcs_notifikasi.dibaca yang boolean global.
//
// "akun" - identifier text bebas "teknik:<username admin>" atau "pekerja:<username operator>" -
// BUKAN foreign key (admins & operator_users itu 2 tabel independen, namespace username
// terpisah, bisa kebetulan sama), disusun di CALLER (App.tsx masing-masing app) dari session
// yang lagi login, dikirim ke hook ini apa adanya.
export type WoEngineeringEvent={
  id:number,wo_id:number|null,wo_number:string,proyek:string,
  jenis_perubahan:"tambah"|"edit",dilakukan_oleh:string,created_at:string,
}

const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[]
  let from=0
  const PAGE=1000
  while(true){
    const{data,error}=await build(from,from+PAGE-1)
    if(error)throw error
    all=all.concat(data??[])
    if(!data||data.length<PAGE)break
    from+=PAGE
  }
  return all
}

export function useWoEngineeringBroadcast(akun:string|null){
  const[events,setEvents]=useState<WoEngineeringEvent[]>([])
  const[dibacaIds,setDibacaIds]=useState<Set<number>>(new Set())

  const fetchAll=useCallback(async()=>{
    if(!akun){setEvents([]);setDibacaIds(new Set());return}
    try{
      const[ev,db]=await Promise.all([
        fetchAllPaged((from,to)=>supabase.from("wo_engineering_events").select("*").order("created_at",{ascending:true}).range(from,to)),
        fetchAllPaged((from,to)=>supabase.from("wo_engineering_events_dibaca").select("event_id").eq("akun",akun).range(from,to)),
      ])
      setEvents(ev as WoEngineeringEvent[])
      setDibacaIds(new Set(db.map((r:any)=>r.event_id)))
    }catch{/* fetch gagal - state lama dipertahankan, realtime/mount berikutnya coba lagi */}
  },[akun])

  useEffect(()=>{
    fetchAll()
    if(!akun)return
    // Dengarkan insert event baru (broadcast dari WoDigitalTab.tsx) DAN insert "dibaca" (biar
    // kalau akun yang sama lagi login di 2 tab/device, tandai baca di 1 tab langsung ilang juga
    // di tab lain, bukan cuma di App yang sama tempat tombolnya dipencet).
    const ch=supabase.channel("realtime-wo-engineering-broadcast-"+akun)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"wo_engineering_events"},fetchAll)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"wo_engineering_events_dibaca"},fetchAll)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[akun,fetchAll])

  // REVISI (17 Sep 2026, redesign visual) - dulu cuma nampilin 1 banner per waktu (FIFO,
  // "current"), sekarang SEMUA event belum dibaca ditumpuk (stack) sebagai kartu terpisah -
  // lihat WoEngineeringBanner.tsx, cocok sama bentuk "kartu mengambang" yang baru (beda dari
  // bentuk lama bar tipis full-width yang emang perlu dibatasi 1 biar gak numpuk jadi banyak
  // bar). Urutan tetap FIFO tertua dulu (events sudah di-order ascending dari query) - kartu
  // terlama muncul paling atas stack.
  const unread=events.filter(e=>!dibacaIds.has(e.id))

  const markAsRead=async(eventId:number)=>{
    if(!akun)return
    setDibacaIds(prev=>new Set(prev).add(eventId)) // optimistic - kartu ilang seketika dari data
    // upsert+ignoreDuplicates (bukan insert polos) - idempotent kalau tombol kepencet dobel atau
    // race sama realtime echo, primary key (event_id,akun) yang sudah ada gak boleh nge-throw.
    await supabase.from("wo_engineering_events_dibaca").upsert({event_id:eventId,akun},{onConflict:"event_id,akun",ignoreDuplicates:true})
  }

  return{unread,markAsRead}
}
