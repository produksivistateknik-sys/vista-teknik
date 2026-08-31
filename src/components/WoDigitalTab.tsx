import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { activityLogService } from "../services/activityLogService";
import { uploadToR2 } from "../lib/r2Client";
import { watermarkPdf } from "../lib/pdfWatermark";
import { Card, Badge, Modal, Lbl, Btn, Inp } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// WO DIGITAL (31 Agu 2026) - digitalisasi gambar teknik (construction drawing CAD, PDF dari
// software eksternal) yang biasanya dicetak fisik jadi panduan kerja operator. Admin upload
// PDF di sini, sistem tempel watermark logo Vista (pdfWatermark.ts, pdf-lib) sebelum simpan ke
// R2, operator akses/download versi digital dari Vista Pekerja (WoDigitalView.tsx).
//
// Search-first (pola sama persis ProyekLuarTab.tsx) - daftar WO baru muncul setelah ketik
// nomor WO/proyek, biar gak nge-dump seluruh WO tiap kali tab dibuka.
//
// Revisi: 1 work_instruction (slot drawing per WO/panel) bisa punya banyak wi_revisions -
// cuma SATU yang is_current=true ("Berlaku", badge hijau), sisanya "Tidak Berlaku" (badge abu)
// tapi tetap tersimpan buat riwayat. Dijamin di level DB lewat unique partial index
// (wi_revisions_one_current, migration 20260831030000).
//
// Tabel BELUM masuk src/types/supabase-generated.ts - pakai (table as any), pola yang sudah
// ada di codebase ini buat tabel baru yang belum di-generate types-nya.
// ─────────────────────────────────────────────────────────────────────────────
export function WoDigitalTab({user}:{user?:any}={}){
  // Role Engineering (31 Agu 2026) - cuma Engineering yang boleh upload/upload-revisi gambar
  // teknik. Admin (dan siapa pun selain engineering) VIEW-ONLY - tombol Upload disembunyikan.
  const canUpload=user?.divisi==="engineering";
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[panelsAll,setPanelsAll]=useState<any[]>([]);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[expandedWoId,setExpandedWoId]=useState<number|null>(null);
  const[expandedRiwayat,setExpandedRiwayat]=useState<Record<number,boolean>>({});

  const fetchAll=async()=>{
    setLoading(true);
    const[{data:wo},{data:panels},{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_orders").select("id,wo,proyek,target,is_archived").order("created_at",{ascending:false}),
      supabase.from("panels").select("id,wo_id,nama"),
      supabase.from("work_instructions" as any).select("*"),
      supabase.from("wi_revisions" as any).select("*").order("revision_number",{ascending:false}),
    ]);
    setWoList(wo||[]);
    setPanelsAll(panels||[]);
    setWiList(wi||[]);
    setRevList(rev||[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchAll();
    const ch=supabase.channel("realtime-wo-digital-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"work_instructions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"wi_revisions"},fetchAll)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const q=search.trim().toLowerCase();
  const filteredWo=useMemo(()=>{
    // Aktif langsung tampil semua (search cuma mempersempit) - Arsip tetap search-first
    // (jumlahnya historis, bisa banyak, sama alasan ArsipQCView.tsx).
    if(viewMode==="arsip"&&!q)return[];
    return woList.filter(w=>{
      if(viewMode==="arsip"?!w.is_archived:!!w.is_archived)return false;
      if(q&&!(w.wo||"").toLowerCase().includes(q)&&!(w.proyek||"").toLowerCase().includes(q))return false;
      return true;
    });
  },[woList,q,viewMode]);

  // WO Digital = 1 dokumen construction drawing per WO (mencakup SEMUA panel di WO itu
  // sekaligus, sama seperti PDF asli dari CAD - multi-halaman berisi semua view). Gak ada
  // lagi upload per-panel (31 Agu 2026) - panel_id di work_instructions TETAP nullable
  // (skema gak berubah), cuma UI-nya yang disederhanakan jadi 1 slot per WO (panel_id selalu
  // null dari jalur upload ini).
  const panelNamesOf=(woId:number)=>panelsAll.filter(p=>p.wo_id===woId).map(p=>p.nama);
  const wiOf=(woId:number)=>wiList.find((w:any)=>w.wo_id===woId&&!w.panel_id);
  const revisionsOf=(wiId:number)=>revList.filter((r:any)=>r.work_instruction_id===wiId);
  const currentRevOf=(wiId:number)=>revList.find((r:any)=>r.work_instruction_id===wiId&&r.is_current);

  const statsOfWo=(woId:number)=>{
    const wi=wiOf(woId);
    const current=wi?currentRevOf(wi.id):null;
    return{docCount:current?1:0,totalPages:current?.page_count||0,lastUpload:current?.uploaded_at||""};
  };

  // ── Upload modal ──
  const[uploadTarget,setUploadTarget]=useState<{woId:number,woLabel:string}|null>(null);
  const[uploadFile,setUploadFile]=useState<File|null>(null);
  const[uploadJudul,setUploadJudul]=useState("");
  const[uploadRevMark,setUploadRevMark]=useState("");
  const[uploading,setUploading]=useState(false);
  const[uploadStage,setUploadStage]=useState("");

  const openUpload=(woId:number,woLabel:string)=>{
    const existing=wiOf(woId);
    setUploadTarget({woId,woLabel});
    setUploadFile(null);
    setUploadJudul(existing?.judul||`Gambar Teknik - WO ${woLabel}`);
    setUploadRevMark("");
  };

  const doUpload=async()=>{
    if(!uploadTarget||!uploadFile)return;
    if(!uploadFile.type.includes("pdf")){alert("File harus berupa PDF.");return;}
    setUploading(true);
    try{
      setUploadStage("Menempel watermark...");
      const fileBytes=await uploadFile.arrayBuffer();
      const{blob,pageCount}=await watermarkPdf(fileBytes);

      setUploadStage("Mengupload...");
      const key=`wo-digital/${uploadTarget.woId}/wo/${Date.now()}_${Math.random().toString(36).slice(2,8)}.pdf`;
      const fileUrl=await uploadToR2(blob,key,"application/pdf");

      setUploadStage("Menyimpan...");
      let wi=wiOf(uploadTarget.woId);
      if(!wi){
        const{data,error}=await supabase.from("work_instructions" as any).insert({
          wo_id:uploadTarget.woId,panel_id:null,judul:uploadJudul.trim()||"Gambar Teknik",
        }).select().single();
        if(error||!data){alert("Gagal simpan: "+(error?.message||"unknown error"));setUploading(false);setUploadStage("");return;}
        wi=data;
      }
      // Revisi lama di-set tidak berlaku dulu, BARU insert revisi baru berlaku - urutan ini
      // penting biar gak pernah tabrakan sama unique partial index (cuma 1 is_current=true).
      await supabase.from("wi_revisions" as any).update({is_current:false}).eq("work_instruction_id",wi.id).eq("is_current",true);
      const maxRev=Math.max(0,...revisionsOf(wi.id).map((r:any)=>r.revision_number));
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=sess?.nama||sess?.name||"Admin";
      const{error:revErr}=await supabase.from("wi_revisions" as any).insert({
        work_instruction_id:wi.id,revision_number:maxRev+1,rev_mark:uploadRevMark.trim()||null,
        file_url:fileUrl,page_count:pageCount,is_current:true,uploaded_by:uname,
      });
      if(revErr){alert("Gagal simpan revisi: "+revErr.message);setUploading(false);setUploadStage("");return;}

      await activityLogService.insert({
        user_name:uname,action:"UPLOAD WO DIGITAL",
        description:`Upload gambar teknik${maxRev>0?` (revisi ${maxRev+1})`:""} - WO ${uploadTarget.woLabel}`,
        module:"wo_digital",halaman:"WO Digital",
      });

      setUploadTarget(null);setUploadFile(null);setUploadJudul("");setUploadRevMark("");
      fetchAll();
    }catch(err:any){
      alert("Gagal upload: "+(err?.message||"unknown error"));
    }
    setUploading(false);setUploadStage("");
  };

  const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—";

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nomor WO / proyek..."
          style={{flex:2,minWidth:200,padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",
            fontSize:13,background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)"}}/>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setViewMode("aktif")} style={{padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",
            fontSize:12.5,fontWeight:700,background:viewMode==="aktif"?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:viewMode==="aktif"?"#fff":"#64748b"}}>
            Aktif
          </button>
          <button onClick={()=>setViewMode("arsip")} style={{padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",
            fontSize:12.5,fontWeight:700,background:viewMode==="arsip"?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:viewMode==="arsip"?"#fff":"#64748b"}}>
            🗄️ Arsip
          </button>
        </div>
      </div>

      {viewMode==="arsip"&&!q?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <i className="ti ti-search" style={{fontSize:28,display:"block",marginBottom:8}}/>
          Ketik nomor WO atau nama proyek untuk menampilkan daftar.
        </div>
      ):loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>
      ):filteredWo.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>{viewMode==="arsip"?"Belum ada WO diarsipkan.":"Belum ada WO aktif."}</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filteredWo.map(w=>{
            const isExp=expandedWoId===w.id;
            const woWi=wiOf(w.id);
            const stats=statsOfWo(w.id);
            return(
              <Card key={w.id} style={{padding:0,overflow:"hidden",border:"1px solid var(--border-color,#e2e8f0)"}}>
                <div className="erp-clickable-row" onClick={()=>setExpandedWoId(isExp?null:w.id)} style={{padding:"16px 18px",cursor:"pointer",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",
                  background:isExp?"var(--bg-secondary,#f8fafc)":"transparent"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,flex:1,minWidth:0}}>
                    <div style={{width:42,height:42,borderRadius:9,background:"var(--bg-secondary,#f1f5f9)",border:"1px solid var(--border-color,#e2e8f0)",display:"flex",
                      alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className="ti ti-folder" style={{fontSize:19,color:"#475569"}}/>
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>WO {w.wo}</div>
                      <div style={{fontWeight:800,fontSize:15,color:"var(--text-primary,#0f172a)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.proyek}</div>
                      <div style={{fontSize:11.5,color:"#94a3b8",marginTop:4,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span><i className="ti ti-files" style={{fontSize:12,verticalAlign:"-2px"}}/> {stats.docCount} dokumen</span>
                        {stats.totalPages>0&&<span><i className="ti ti-copy" style={{fontSize:12,verticalAlign:"-2px"}}/> {stats.totalPages} halaman</span>}
                        {stats.lastUpload&&<span><i className="ti ti-clock" style={{fontSize:12,verticalAlign:"-2px"}}/> {fmtTgl(stats.lastUpload)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {stats.docCount>0?<Badge label="Berlaku" color="#16a34a" bg="#f0fdf4"/>:<Badge label="Belum Ada Dokumen" color="#94a3b8" bg="var(--bg-secondary,#f1f5f9)"/>}
                    {w.is_archived&&<Badge label="Arsip WO" color="#64748b" bg="var(--bg-secondary,#f1f5f9)"/>}
                  </div>
                </div>
                {isExp&&(
                  <div style={{padding:"14px 16px",borderTop:"1px solid var(--border-color,#f1f5f9)",display:"flex",flexDirection:"column",gap:10}}>
                    {(()=>{const panelNames=panelNamesOf(w.id);return panelNames.length>0?(
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.4,marginBottom:6}}>Panel di WO ini ({panelNames.length})</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {panelNames.map(n=>(
                            <span key={n} style={{fontSize:11,color:"#475569",background:"var(--bg-secondary,#f1f5f9)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:6,padding:"3px 9px"}}>{n}</span>
                          ))}
                        </div>
                      </div>
                    ):null;})()}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--bg-secondary,#f8fafc)",borderRadius:10,padding:"10px 12px"}}>
                      <div>
                        <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-primary,#1e293b)"}}>Gambar Teknik WO</div>
                        {woWi?<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{woWi.judul}</div>:<div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum ada gambar</div>}
                      </div>
                      {canUpload&&<Btn color="#1d4ed8" onClick={()=>openUpload(w.id,w.wo)}>{woWi?"Upload Revisi":"+ Upload"}</Btn>}
                    </div>
                    {woWi&&<WiCard wi={woWi} revisions={revisionsOf(woWi.id)} current={currentRevOf(woWi.id)} expanded={!!expandedRiwayat[woWi.id]} onToggleRiwayat={()=>setExpandedRiwayat(p=>({...p,[woWi.id]:!p[woWi.id]}))} fmtTgl={fmtTgl}/>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {uploadTarget&&(
        <Modal title={"Upload Gambar Teknik"} onClose={()=>{if(!uploading)setUploadTarget(null);}} width={460}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:12,color:"#64748b"}}>
              WO {uploadTarget.woLabel} (seluruh panel)
            </div>
            <div>
              <Lbl>Judul Dokumen</Lbl>
              <Inp value={uploadJudul} onChange={(e:any)=>setUploadJudul(e.target.value)} disabled={uploading} placeholder="mis. Construction Drawing LVMDP"/>
            </div>
            <div>
              <Lbl>Kode Revisi (opsional, dari title block PDF)</Lbl>
              <Inp value={uploadRevMark} onChange={(e:any)=>setUploadRevMark(e.target.value)} disabled={uploading} placeholder="mis. REV. A"/>
            </div>
            <div>
              <Lbl>File PDF</Lbl>
              <label style={{display:"flex",alignItems:"center",gap:8,padding:"14px",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"var(--bg-secondary,#f8fafc)",cursor:uploading?"default":"pointer"}}>
                <input type="file" accept="application/pdf" disabled={uploading} style={{display:"none"}}
                  onChange={e=>setUploadFile(e.target.files?.[0]||null)}/>
                <i className="ti ti-upload" style={{fontSize:18,color:"#64748b"}}/>
                <span style={{fontSize:12.5,color:"#64748b",fontWeight:600}}>{uploadFile?uploadFile.name:"Pilih file PDF (construction drawing)..."}</span>
              </label>
            </div>
            {uploading&&(
              <div style={{textAlign:"center",padding:12,background:"#eff6ff",borderRadius:10,fontSize:12.5,fontWeight:700,color:"#1d4ed8"}}>{uploadStage}</div>
            )}
            <Btn color="#1d4ed8" onClick={doUpload} disabled={uploading||!uploadFile}>{uploading?"Memproses...":"Upload & Tempel Watermark"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WiCard({wi,revisions,current,expanded,onToggleRiwayat,fmtTgl}:{wi:any,revisions:any[],current:any,expanded:boolean,onToggleRiwayat:()=>void,fmtTgl:(s:string)=>string}){
  const lainnya=revisions.filter(r=>!r.is_current);
  return(
    <div style={{background:"var(--bg-secondary,#f8fafc)",borderRadius:10,padding:"10px 12px"}}>
      {current?(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
          <div style={{minWidth:0,flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <Badge label="Berlaku" color="#16a34a" bg="#f0fdf4"/>
              {current.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{current.rev_mark}</span>}
              <span style={{fontSize:10,color:"#94a3b8"}}>{current.page_count?current.page_count+" hal.":""}</span>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>oleh {current.uploaded_by} · {fmtTgl(current.uploaded_at)}</div>
          </div>
          <a href={current.file_url} target="_blank" rel="noreferrer" style={{fontSize:12,fontWeight:700,color:"#2563eb",textDecoration:"none",whiteSpace:"nowrap"}}>Lihat PDF →</a>
        </div>
      ):<div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum ada revisi berlaku.</div>}
      {lainnya.length>0&&(
        <div style={{marginTop:8}}>
          <button onClick={onToggleRiwayat} style={{background:"none",border:"none",color:"#64748b",fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>
            {expanded?"▼":"▶"} Riwayat revisi ({lainnya.length})
          </button>
          {expanded&&(
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
              {lainnya.map(r=>(
                <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 8px",background:"var(--card-bg,#fff)",borderRadius:6,border:"1px solid var(--border-color,#e2e8f0)"}}>
                  <div style={{minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <Badge label="Tidak Berlaku" color="#64748b" bg="#f1f5f9"/>
                      {r.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{r.rev_mark}</span>}
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>oleh {r.uploaded_by} · {fmtTgl(r.uploaded_at)}</div>
                  </div>
                  <a href={r.file_url} target="_blank" rel="noreferrer" style={{fontSize:11,fontWeight:600,color:"#94a3b8",textDecoration:"none",whiteSpace:"nowrap"}}>Lihat →</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
