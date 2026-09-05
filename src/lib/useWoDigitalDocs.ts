import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { uploadToR2, deleteFromR2, extractR2Key } from './r2Client'
import { watermarkPdf, stampTidakBerlaku } from './pdfWatermark'

// Dokumen gambar teknik WO Digital, EKSTRAK (4 Sep 2026) dari WoDigitalTab.tsx supaya bisa
// dipakai ulang di ManajemenWO.tsx (Admin, viewer-only - lihat prop canUpload di caller,
// hook ini sendiri gak nge-gate apa pun, itu tanggung jawab UI pemanggil). Fetch + realtime
// SENDIRI (independen dari fetchAll WoDigitalTab) - channel name pakai suffix random per
// instance karena WoDigitalTab & ManajemenWO SELALU sama-sama mounted bareng (App.tsx toggle
// display:none, bukan unmount beneran), nama channel statis bakal tabrakan.
export function useWoDigitalDocs() {
  const[wiList,setWiList]=useState<any[]>([])
  const[revList,setRevList]=useState<any[]>([])

  const fetchDocs=async()=>{
    const[{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_instructions" as any).select("*"),
      supabase.from("wi_revisions" as any).select("*").order("revision_number",{ascending:false}),
    ])
    setWiList(wi||[])
    setRevList(rev||[])
  }

  useEffect(()=>{
    fetchDocs()
    const suffix=Math.random().toString(36).slice(2)
    const ch=supabase.channel("realtime-wo-digital-docs-"+suffix)
      .on("postgres_changes",{event:"*",schema:"public",table:"work_instructions"},fetchDocs)
      .on("postgres_changes",{event:"*",schema:"public",table:"wi_revisions"},fetchDocs)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[])

  const wiOfPanel=(panelId:number)=>wiList.find((w:any)=>w.panel_id===panelId)
  const revisionsOf=(wiId:number)=>revList.filter((r:any)=>r.work_instruction_id===wiId)
  const currentRevOf=(wiId:number)=>revList.find((r:any)=>r.work_instruction_id===wiId&&r.is_current)

  // Watermark -> R2 (key unik per revisi) -> find-or-create work_instructions -> is_current
  // lama di-set false DULU baru insert revisi baru current=true (urutan penting, jangan
  // diubah - biar gak tabrakan sama unique partial index wi_revisions_one_current) -> activity
  // log -> refetch biar state lokal langsung konsisten (gak nunggu realtime round-trip).
  const uploadDoc=async(panelId:number,panelLabel:string,woId:number,woLabel:string,proyek:string,file:File,judul:string,revMark:string,uname:string,onStage?:(s:string)=>void)=>{
    onStage?.("Menempel watermark...")
    const fileBytes=await file.arrayBuffer()
    const{blob,pageCount}=await watermarkPdf(fileBytes,revMark)

    onStage?.("Mengupload...")
    const key=`wo-digital/${woId}/panel-${panelId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.pdf`
    const fileUrl=await uploadToR2(blob,key,"application/pdf")

    onStage?.("Menyimpan...")
    // isFirstDoc DITANGKAP SEBELUM mutasi apa pun (REVISI 5 Sep 2026, dipakai buat notifikasi
    // "gambar direvisi" di bawah - cuma revisi yang notif, upload pertama kali TIDAK, karena
    // event "WO baru"/"tambah panel" udah cukup mewakili momen itu).
    let wi=wiOfPanel(panelId)
    const isFirstDoc=!wi
    if(!wi){
      const{data,error}=await supabase.from("work_instructions" as any).insert({
        wo_id:woId,panel_id:panelId,judul:judul.trim()||"Gambar Teknik",
      }).select().single()
      if(error||!data)throw new Error(error?.message||"Gagal simpan dokumen")
      wi=data
    }
    // Ditangkap SEBELUM is_current di-set false (dipakai buat stempel "TIDAK BERLAKU" di
    // bawah) - revisi yang lagi current SEKARANG JUGA revisi yang bakal digantikan ini.
    const oldCurrentRev=isFirstDoc?null:currentRevOf(wi.id)
    await supabase.from("wi_revisions" as any).update({is_current:false}).eq("work_instruction_id",wi.id).eq("is_current",true)
    const maxRev=Math.max(0,...revisionsOf(wi.id).map((r:any)=>r.revision_number))
    const{error:revErr}=await supabase.from("wi_revisions" as any).insert({
      work_instruction_id:wi.id,revision_number:maxRev+1,rev_mark:revMark.trim()||null,
      file_url:fileUrl,page_count:pageCount,is_current:true,uploaded_by:uname,
    })
    if(revErr)throw new Error(revErr.message)

    await activityLogService.insert({
      user_name:uname,action:"UPLOAD WO DIGITAL",
      description:`Upload gambar teknik${maxRev>0?` (revisi ${maxRev+1})`:""} - ${panelLabel} (WO ${woLabel})`,
      module:"wo_digital",halaman:"WO Digital",
    })
    await fetchDocs()

    // Stempel "TIDAK BERLAKU" otomatis ke file revisi LAMA (6 Sep 2026) - begitu revisi baru
    // beres tersimpan, file lama diproses ulang (download -> tempel stempel -> upload) SUPAYA
    // PERMANEN (bukan overlay pas dibuka). GAGAL DI SINI TIDAK BOLEH gagalin upload revisi
    // baru yang udah beres di atas - try/catch sendiri, error dicatat ke activity log (bukan
    // cuma console) biar kelihatan di Riwayat Aktivitas buat tindak lanjut manual.
    //
    // Upload ke KEY BARU (bukan overwrite key lama) - file R2 di-serve dengan Cache-Control
    // immutable/max-age 1 tahun, overwrite di key yang sama berisiko browser/CDN yang udah
    // pernah cache file itu TETAP nampilin versi lama tanpa stempel. Key baru = selalu cache-
    // miss, stempel pasti kelihatan. wi_revisions.file_url baris lama diupdate ke key baru,
    // baru key lama dihapus (urutan ini jaga supaya gak ada window waktu DB nunjuk ke file yang
    // udah kehapus).
    if(oldCurrentRev?.file_url){
      try{
        const oldRes=await fetch(oldCurrentRev.file_url)
        if(!oldRes.ok)throw new Error(`Gagal ambil file revisi lama (HTTP ${oldRes.status})`)
        const oldBytes=await oldRes.arrayBuffer()
        const stampedBlob=await stampTidakBerlaku(oldBytes)
        const stampedKey=`wo-digital/${woId}/panel-${panelId}/${oldCurrentRev.id}_tidak-berlaku_${Date.now()}.pdf`
        const stampedUrl=await uploadToR2(stampedBlob,stampedKey,"application/pdf")
        const{error:stampErr}=await supabase.from("wi_revisions" as any).update({file_url:stampedUrl}).eq("id",oldCurrentRev.id)
        if(stampErr)throw new Error(stampErr.message)
        const oldKey=extractR2Key(oldCurrentRev.file_url)
        if(oldKey)await deleteFromR2(oldKey).catch(()=>{/* file lama gak kehapus - cuma sampah storage, gak fatal */})
        await fetchDocs()
      }catch(err:any){
        await activityLogService.insert({
          user_name:uname,action:"GAGAL STEMPEL TIDAK BERLAKU",
          description:`Gagal menstempel revisi lama - ${panelLabel} (WO ${woLabel}): ${err?.message||"unknown error"}`,
          module:"wo_digital",halaman:"WO Digital",
        }).catch(()=>{/* logging gagal - abaikan, jangan sampai nge-throw dari catch */})
      }
    }

    // Push notif "gambar direvisi" ke admin+operator (REVISI 5 Sep 2026) - fitur tambahan,
    // GAGAL DI SINI TIDAK BOLEH gagalin upload yang udah beres di atas, try/catch sendiri.
    if(!isFirstDoc){
      try{
        await supabase.functions.invoke("notify-wo-baru",{body:{trigger:"gambar_direvisi",wo_id:woId,wo_number:woLabel,proyek,panel_nama:panelLabel,uploader_nama:uname}})
      }catch{/* notifikasi gagal - diabaikan */}
    }
  }

  return{wiList,revList,wiOfPanel,revisionsOf,currentRevOf,uploadDoc,refetchDocs:fetchDocs}
}
