import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { uploadToR2 } from './r2Client'
import { watermarkPdf } from './pdfWatermark'

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
  const uploadDoc=async(panelId:number,panelLabel:string,woId:number,woLabel:string,file:File,judul:string,revMark:string,uname:string,onStage?:(s:string)=>void)=>{
    onStage?.("Menempel watermark...")
    const fileBytes=await file.arrayBuffer()
    const{blob,pageCount}=await watermarkPdf(fileBytes)

    onStage?.("Mengupload...")
    const key=`wo-digital/${woId}/panel-${panelId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.pdf`
    const fileUrl=await uploadToR2(blob,key,"application/pdf")

    onStage?.("Menyimpan...")
    let wi=wiOfPanel(panelId)
    if(!wi){
      const{data,error}=await supabase.from("work_instructions" as any).insert({
        wo_id:woId,panel_id:panelId,judul:judul.trim()||"Gambar Teknik",
      }).select().single()
      if(error||!data)throw new Error(error?.message||"Gagal simpan dokumen")
      wi=data
    }
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
  }

  return{wiList,revList,wiOfPanel,revisionsOf,currentRevOf,uploadDoc,refetchDocs:fetchDocs}
}
