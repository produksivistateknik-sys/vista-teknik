import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { uploadToR2, deleteFromR2, extractR2Key } from './r2Client'
import { watermarkPdf, stampTidakBerlaku } from './pdfWatermark'
import { broadcastWoEngineeringEvent } from './useWoEngineeringBroadcast'

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
    // isFirstDoc DITANGKAP SEBELUM mutasi apa pun - dipakai milih trigger notifikasi di bawah
    // ("gambar_ditambahkan" utk pertama kali, "gambar_direvisi" utk revisi).
    //
    // BUG FIX (9 Sep 2026) - dulu upload pertama kali TIDAK memicu notifikasi sama sekali,
    // asumsinya event "WO baru"/"tambah panel" udah cukup mewakili momen itu. Asumsi itu
    // keliru begitu panelnya sudah lama ada (dibuat hari/minggu sebelumnya) dan dokumennya
    // baru ditambahkan belakangan - gak ada event apa pun yang mewakili momen itu, jadi
    // upload pertama kali diam-diam tanpa notif (kasus WO 066/CLS-FONTAINE, panel LVMDP).
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
        // BUG FIX (6 Sep 2026) - kegagalan hapus di sini dulu di-swallow TOTAL diam-diam (gak
        // ada log sama sekali). Ini bukan cuma "sampah storage" - kalau gagal, file LAMA TANPA
        // STEMPEL masih tetap bisa diakses publik di URL asalnya (walau wi_revisions.file_url
        // di DB sudah diupdate ke versi stamped di atas) - siapapun yang masih punya link/cache
        // lama tetap bisa buka gambar yang sudah gak berlaku tanpa tanda TIDAK BERLAKU. Log
        // (non-blocking) biar kelihatan di Riwayat Aktivitas buat dihapus manual dari R2.
        const oldKey=extractR2Key(oldCurrentRev.file_url)
        if(oldKey){
          await deleteFromR2(oldKey).catch(async()=>{
            await activityLogService.insert({
              user_name:uname,action:"GAGAL HAPUS FILE LAMA R2",
              description:`Stempel TIDAK BERLAKU berhasil, tapi file lama tanpa stempel gagal dihapus dari R2 (key: ${oldKey}) - ${panelLabel} (WO ${woLabel}). URL lama masih bisa diakses kalau ada yang masih punya link-nya.`,
              module:"wo_digital",halaman:"WO Digital",
            }).catch(()=>{/* logging gagal - abaikan */})
          })
        }
        await fetchDocs()
      }catch(err:any){
        await activityLogService.insert({
          user_name:uname,action:"GAGAL STEMPEL TIDAK BERLAKU",
          description:`Gagal menstempel revisi lama - ${panelLabel} (WO ${woLabel}): ${err?.message||"unknown error"}`,
          module:"wo_digital",halaman:"WO Digital",
        }).catch(()=>{/* logging gagal - abaikan, jangan sampai nge-throw dari catch */})
      }
    }

    // Push notif ke admin+operator (REVISI 5 Sep 2026, DIPERLUAS 9 Sep 2026 supaya upload
    // pertama kali JUGA notif, bukan cuma revisi) - fitur tambahan, GAGAL DI SINI TIDAK BOLEH
    // gagalin upload yang udah beres di atas, try/catch sendiri.
    try{
      await supabase.functions.invoke("notify-wo-baru",{body:{trigger:isFirstDoc?"gambar_ditambahkan":"gambar_direvisi",wo_id:woId,wo_number:woLabel,proyek,panel_nama:panelLabel,uploader_nama:uname}})
    }catch{/* notifikasi gagal - diabaikan */}

    // Banner broadcast "WO diubah Engineering" (17 Sep 2026, BUG FIX sore) - upload/revisi gambar
    // teknik dulu TIDAK memicu banner in-app sama sekali (cuma push notif OS di atas), jalur kode
    // terpisah dari form Tambah/Edit WO yang kelewat pas investigasi awal fitur ini - user lapor
    // "notif gak muncul" pas Engineering upload revisi. isFirstDoc->"tambah" (badge "Ditambahkan"),
    // revisi ulang->"edit" (badge "Diedit"), sama pemetaan yang dipakai trigger push notif barusan.
    // Gagal insert TIDAK BOLEH gagalin upload yang udah beres di atas - try/catch sendiri, gak
    // digantungkan ke divisi (hook ini gak nge-gate apa pun, tanggung jawab UI pemanggil - lihat
    // komentar atas file).
    try{
      await broadcastWoEngineeringEvent({woId,woNumber:woLabel,proyek,jenisPerubahan:isFirstDoc?"tambah":"edit",dilakukanOleh:uname})
    }catch{/* banner broadcast gagal - diabaikan, upload tetap tersimpan */}
  }

  // Batalkan revisi (19 Sep 2026, FITUR BARU) - dulu TIDAK ADA cara membatalkan revisi yang
  // kadung salah upload & tayang sebagai "Berlaku" (dicek live, gak ada tombol/fungsi ini sama
  // sekali) - kasus nyata: IHSAN salah upload gambar panel YD EXPANDER - SIDOARJO 2 (WO 065).
  // Cuma bisa membatalkan revisi yang LAGI "Berlaku" (is_current=true) - kalau mau batalkan
  // revisi lama yang udah kesuperseded, gak ada urgensinya (udah "Tidak Berlaku" duluan). TIDAK
  // ADA DELETE - baris tetap ada (is_cancelled=true + alasan/siapa/kapan, audit trail), file R2
  // TIDAK disentuh sama sekali. Revisi SEBELUMNYA yang belum dibatalkan (kalau ada) otomatis
  // jadi "Berlaku" lagi - kalau gak ada (kasus IHSAN di atas, itu revisi #1/pertama), slot balik
  // ke "Belum ada dokumen".
  const cancelRevisi=async(revisionId:number,panelLabel:string,woId:number,woLabel:string,proyek:string,alasan:string,uname:string)=>{
    const rev=revList.find((r:any)=>r.id===revisionId)
    if(!rev)throw new Error("Revisi tidak ditemukan (mungkin sudah berubah, coba refresh).")
    if(!rev.is_current)throw new Error("Cuma revisi yang lagi Berlaku yang bisa dibatalkan.")
    const{error:cancelErr}=await supabase.from("wi_revisions" as any).update({
      is_cancelled:true,is_current:false,cancel_reason:alasan.trim(),cancelled_by:uname,cancelled_at:new Date().toISOString(),
    }).eq("id",revisionId)
    if(cancelErr)throw new Error(cancelErr.message)

    // Revisi sebelumnya yang belum dibatalkan & bukan revisi yang baru dibatalkan ini, nomor
    // revisi TERTINGGI (paling baru sebelum yang dibatalkan) - jadi "Berlaku" lagi.
    const kandidat=revList
      .filter((r:any)=>r.work_instruction_id===rev.work_instruction_id&&r.id!==revisionId&&!r.is_cancelled)
      .sort((a:any,b:any)=>b.revision_number-a.revision_number)
    if(kandidat[0]){
      const{error:restoreErr}=await supabase.from("wi_revisions" as any).update({is_current:true}).eq("id",kandidat[0].id)
      if(restoreErr)throw new Error(restoreErr.message)
    }

    await activityLogService.insert({
      user_name:uname,action:"BATALKAN REVISI WO DIGITAL",
      description:`Batalkan gambar teknik${kandidat[0]?` (balik ke revisi ${kandidat[0].revision_number})`:" (tidak ada revisi sebelumnya, slot kosong lagi)"} - ${panelLabel} (WO ${woLabel}). Alasan: ${alasan.trim()}`,
      module:"wo_digital",halaman:"WO Digital",
    })
    await fetchDocs()

    try{
      await supabase.functions.invoke("notify-wo-baru",{body:{trigger:"gambar_dibatalkan",wo_id:woId,wo_number:woLabel,proyek,panel_nama:panelLabel,uploader_nama:uname,alasan:alasan.trim()}})
    }catch{/* notifikasi gagal - diabaikan, pembatalan tetap tersimpan */}

    try{
      await broadcastWoEngineeringEvent({woId,woNumber:woLabel,proyek,jenisPerubahan:"batal",dilakukanOleh:uname})
    }catch{/* banner broadcast gagal - diabaikan */}
  }

  return{wiList,revList,wiOfPanel,revisionsOf,currentRevOf,uploadDoc,cancelRevisi,refetchDocs:fetchDocs}
}
