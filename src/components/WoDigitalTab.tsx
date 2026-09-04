import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { activityLogService } from "../services/activityLogService";
import { uploadToR2 } from "../lib/r2Client";
import { watermarkPdf } from "../lib/pdfWatermark";
import { workOrderService } from "../services/workOrderService";
import { PANEL_TYPES } from "../constants/panelTypes";
import { usePanelQtyEditor } from "../lib/usePanelQtyEditor";
import { initChecklist } from "../lib/panelHelpers";
import { Card, Badge, Modal, Lbl, Btn, Inp, Sel } from "./ui/Primitives";

const PdfViewer=lazy(()=>import("./PdfViewer").then(m=>({default:m.PdfViewer})));

// ─────────────────────────────────────────────────────────────────────────────
// WO DIGITAL (31 Agu 2026) - digitalisasi gambar teknik (construction drawing CAD, PDF dari
// software eksternal) yang biasanya dicetak fisik jadi panduan kerja operator. Engineering
// upload PDF di sini, sistem tempel watermark logo Vista (pdfWatermark.ts, pdf-lib) sebelum
// simpan ke R2, Admin (view-only) & operator akses/download versi digital dari Vista Pekerja
// (WoDigitalView.tsx).
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
//
// REDESIGN (1 Sep 2026) - klik card WO (yang sudah ada dokumen) SWAP seluruh tampilan list
// jadi halaman viewer full (bukan modal overlay lagi) - state `viewing` di level WoDigitalTab
// + early-return, pola sama kayak LaporanQCView.tsx (list->detail->list, tombol "‹ Kembali").
// Panel chip sekarang SELALU tampil di card (dulu baru muncul kalau expand). Upload/Riwayat
// revisi (khusus Engineering/admin) jadi baris terpisah di bawah header card, event-nya
// stopPropagation biar gak ke-trigger navigasi ke viewer pas diklik.
//
// REVISI (4 Sep 2026) - dokumen sekarang PER-PANEL, bukan 1 slot per WO lagi. Skema gak
// berubah (panel_id di work_instructions sudah nullable dari awal, migration 20260831030000) -
// cuma query/insert yang dulu selalu pakai panel_id:null sekarang di-scope ke panel_id
// spesifik. Card header gak lagi klik-untuk-lihat (gak ada 1 dokumen tunggal per WO lagi),
// upload/riwayat/lihat pindah ke masing-masing baris panel (gabung sama qty editor). 2
// dokumen lama (upload sebelum revisi ini, panel_id masih null) SENGAJA dibiarkan orphan -
// gak di-migrasi otomatis (ambigu WO 000 punya 2 panel, WO 056 sekarang 0 panel) - keputusan
// user, upload ulang manual per-panel kalau perlu. Vista Pekerja (WoDigitalView.tsx) ikut
// direvisi sama.
// ─────────────────────────────────────────────────────────────────────────────
export function WoDigitalTab({user,livePanelTypes}:{user?:any;livePanelTypes?:any}={}){
  // Role Engineering (31 Agu 2026) - cuma Engineering yang boleh upload/upload-revisi gambar
  // teknik, DAN (REVISI 3 Sep 2026) satu-satunya yang boleh Tambah/Edit WO+panel dari halaman
  // ini. Admin (dan siapa pun selain engineering) VIEW-ONLY.
  const canUpload=user?.divisi==="engineering";
  const getEffectiveCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const effectivePanelTypes=(livePanelTypes&&Object.keys(livePanelTypes).length>0)?livePanelTypes:PANEL_TYPES;
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[panelsAll,setPanelsAll]=useState<any[]>([]);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[expandedPanelQty,setExpandedPanelQty]=useState<Record<number,boolean>>({});
  const[viewing,setViewing]=useState<{url:string,title:string,subtitle?:string}|null>(null);

  const fetchAll=async()=>{
    setLoading(true);
    // Panel fetch (REVISI 3 Sep 2026) - dulu cuma "id,wo_id,nama" (buat chip nama doang), sekarang
    // select("*") - form Tambah/Edit & qty-editor per-komponen butuh tipe/qty/checklist/jumlah_cell
    // penuh.
    const[{data:wo},{data:panels},{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_orders").select("id,wo,proyek,target,is_archived").order("created_at",{ascending:false}),
      supabase.from("panels").select("*"),
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
    // Realtime work_orders/panels (REVISI 3 Sep 2026) - dulu cuma dengar work_instructions/
    // wi_revisions (khusus dokumen). Sekarang WO/panel bisa dibuat/diedit dari halaman ini SENDIRI
    // (Engineering) DAN dari Manajemen WO (admin) - keduanya harus saling kelihatan live.
    const ch=supabase.channel("realtime-wo-digital-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"work_instructions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"wi_revisions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"work_orders"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"panels"},fetchAll)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // Qty-per-komponen editor (reuse usePanelQtyEditor.ts - SAMA PERSIS logic Manajemen WO, lihat
  // komentar di file hook-nya). getPanel/getWoContext/applyChecklist di-bind ke panelsAll flat
  // (beda dari ManajemenWO yang nested per-WO) - behavior tetap identik.
  const{selectedQtyCells,dirtyQty,handleQtyCellClick,handleQtyCopy,handleQtyPasteMulti,updateItemQty,cancelQtyEdit,saveQtyEdit}=usePanelQtyEditor({
    getPanel:(panelId)=>panelsAll.find((p:any)=>String(p.id)===panelId),
    getWoContext:(panelId)=>{const p=panelsAll.find((p2:any)=>String(p2.id)===panelId);const w=p?woList.find((w2:any)=>w2.id===p.wo_id):null;return w?{id:w.id,wo:w.wo,proyek:w.proyek}:undefined;},
    applyChecklist:(panelId,newChecklist)=>setPanelsAll(prev=>prev.map((p:any)=>String(p.id)===panelId?{...p,checklist:newChecklist}:p)),
    getEffectiveCfg,
    getUname:()=>user?.name||user?.nama||"Admin",
  });

  // ── Tambah/Edit WO (REVISI 3 Sep 2026) - reuse workOrderService PERSIS sama Manajemen WO,
  // WO yang dibuat/diedit dari sini otomatis konsisten (tabel sama, gak ada jalur terpisah). ──
  const blankForm={wo:"",proyek:"",target:""};
  const blankPanelRow={noPnl:"1",nama:"",tipe:"FS",qty:1,jumlahCell:0};
  const[formOpen,setFormOpen]=useState(false);
  const[form,setForm]=useState(blankForm);
  const[formPanels,setFormPanels]=useState<any[]>([{...blankPanelRow}]);
  const[formEditId,setFormEditId]=useState<number|null>(null);
  const[formSaving,setFormSaving]=useState(false);

  const openTambahWo=()=>{setForm(blankForm);setFormPanels([{...blankPanelRow}]);setFormEditId(null);setFormOpen(true);};
  const openEditWo=(w:any)=>{
    const woPanels=panelsAll.filter((p:any)=>p.wo_id===w.id);
    setForm({wo:w.wo,proyek:w.proyek,target:w.target});
    setFormPanels(woPanels.map((p:any)=>({id:p.id,noPnl:p.no_pnl,nama:p.nama,tipe:p.tipe,qty:p.qty,checklist:p.checklist,catatan:p.catatan,jumlahCell:p.jumlah_cell??0,tanggal:w.target})));
    setFormEditId(w.id);
    setFormOpen(true);
  };
  // Panel existing (punya id) -> checklist DIPERTAHANKAN apa adanya (gak ada auto-rescale qty
  // panel->per-kode di sini, beda dari Manajemen WO yang punya buildNp+konfirmasi konflik sendiri -
  // form Engineering ini SENGAJA dipangkas, sesuai task). Panel baru -> checklist di-generate fresh
  // dari BOM (initChecklist), SAMA PERSIS cara Manajemen WO bikin panel baru.
  const buildPanelsForSave=()=>formPanels.map((p:any)=>p.id?({
    id:p.id,noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:Number(p.qty)||1,checklist:p.checklist||{},
    catatan:p.catatan||"",jumlahCell:Number(p.jumlahCell)||0,tanggal:p.tanggal,
  }):({
    noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:Number(p.qty)||1,
    checklist:initChecklist(p.tipe,Number(p.qty)||1,effectivePanelTypes),catatan:"",
    jumlahCell:Number(p.jumlahCell)||0,tanggal:p.tanggal,
  }));

  const saveWoForm=async()=>{
    if(!form.wo.trim()||!form.proyek.trim()||!form.target){alert("No WO, Nama Proyek, dan Target Tanggal wajib diisi.");return;}
    if(formPanels.some((p:any)=>!p.nama?.trim())){alert("Nama panel wajib diisi untuk semua baris.");return;}
    setFormSaving(true);
    const uname=user?.name||user?.nama||"Engineering";
    try{
      const panelsToSave=buildPanelsForSave();
      if(formEditId){
        // Grouped per tanggal-per-panel (fitur split existing di saveWOWithSplit) - panel yang
        // tanggal-nya di-override manual beda dari target utama otomatis di-split ke WO sibling,
        // sama persis Manajemen WO.
        const byTanggal:Record<string,any[]>={};
        panelsToSave.forEach((p:any)=>{const t=p.tanggal||form.target;(byTanggal[t]=byTanggal[t]||[]).push(p);});
        const groupedReal=Object.entries(byTanggal).map(([tanggal,panels])=>({tanggal,panels}));
        await workOrderService.saveWOWithSplit(formEditId,form.wo,form.proyek,form.target,groupedReal,uname);
      } else {
        const{data:newWo,error}=await supabase.from("work_orders").insert({wo:form.wo.trim(),proyek:form.proyek.trim(),target:form.target}).select().single();
        if(error||!newWo)throw new Error(error?.message||"Gagal buat WO");
        await activityLogService.insert({user_name:uname,action:"TAMBAH WO",description:"Tambah WO "+form.wo+" - "+form.proyek,module:"wo",halaman:"WO Digital",proyek:form.proyek,wo_number:form.wo});
        await workOrderService.savePanels(newWo.id,panelsToSave);
        try{
          await supabase.functions.invoke("notify-wo-baru",{body:{wo_id:newWo.id,wo_number:form.wo,proyek:form.proyek,target:form.target,admin_nama:uname}});
        }catch{/* notifikasi gagal - diabaikan, WO tetap tersimpan */}
      }
      setFormOpen(false);
      fetchAll();
    }catch(err:any){
      alert("Gagal simpan WO: "+(err?.message||"unknown error"));
    }
    setFormSaving(false);
  };

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

  // Dokumen per-panel (REVISI 4 Sep 2026) - 1 work_instruction per panel (panel_id di-isi,
  // bukan null lagi). wiOfPanel gantiin wiOf(woId) lama.
  const panelNamesOf=(woId:number)=>panelsAll.filter(p=>p.wo_id===woId).map(p=>p.nama);
  const wiOfPanel=(panelId:number)=>wiList.find((w:any)=>w.panel_id===panelId);
  const revisionsOf=(wiId:number)=>revList.filter((r:any)=>r.work_instruction_id===wiId);
  const currentRevOf=(wiId:number)=>revList.find((r:any)=>r.work_instruction_id===wiId&&r.is_current);

  // Stats WO sekarang agregat dari semua panel-nya (dulu 1 dokumen = 1 WO).
  const statsOfWo=(woId:number)=>{
    const woPanels=panelsAll.filter(p=>p.wo_id===woId);
    let docCount=0,totalPages=0,lastUpload="";
    woPanels.forEach(p=>{
      const wi=wiOfPanel(p.id);
      const current=wi?currentRevOf(wi.id):null;
      if(current){
        docCount++;
        totalPages+=current.page_count||0;
        if(!lastUpload||current.uploaded_at>lastUpload)lastUpload=current.uploaded_at;
      }
    });
    return{docCount,totalPanels:woPanels.length,totalPages,lastUpload};
  };

  // ── Upload modal (per-panel, REVISI 4 Sep 2026) ──
  const[uploadTarget,setUploadTarget]=useState<{panelId:number,panelLabel:string,woId:number,woLabel:string}|null>(null);
  const[uploadFile,setUploadFile]=useState<File|null>(null);
  const[uploadJudul,setUploadJudul]=useState("");
  const[uploadRevMark,setUploadRevMark]=useState("");
  const[uploading,setUploading]=useState(false);
  const[uploadStage,setUploadStage]=useState("");

  const openUpload=(panelId:number,panelLabel:string,woId:number,woLabel:string)=>{
    const existing=wiOfPanel(panelId);
    setUploadTarget({panelId,panelLabel,woId,woLabel});
    setUploadFile(null);
    setUploadJudul(existing?.judul||`Gambar Teknik - ${panelLabel}`);
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
      const key=`wo-digital/${uploadTarget.woId}/panel-${uploadTarget.panelId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.pdf`;
      const fileUrl=await uploadToR2(blob,key,"application/pdf");

      setUploadStage("Menyimpan...");
      let wi=wiOfPanel(uploadTarget.panelId);
      if(!wi){
        const{data,error}=await supabase.from("work_instructions" as any).insert({
          wo_id:uploadTarget.woId,panel_id:uploadTarget.panelId,judul:uploadJudul.trim()||"Gambar Teknik",
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
        description:`Upload gambar teknik${maxRev>0?` (revisi ${maxRev+1})`:""} - ${uploadTarget.panelLabel} (WO ${uploadTarget.woLabel})`,
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

  if(viewing){
    return(
      <Suspense fallback={<div style={{textAlign:"center",padding:60,color:"#94a3b8",fontSize:13}}>Memuat...</div>}>
        <PdfViewer url={viewing.url} title={viewing.title} subtitle={viewing.subtitle} onBack={()=>setViewing(null)}/>
      </Suspense>
    );
  }

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
        {canUpload&&<Btn color="#1d4ed8" onClick={openTambahWo}>+ Tambah WO</Btn>}
      </div>

      {formOpen&&(
        <Card style={{marginBottom:16,border:"2px solid #2563eb",background:"var(--bg-secondary,#f8faff)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:16,color:"var(--text-primary,#1e293b)"}}>{formEditId?"✏️ Edit WO":"📝 Tambah WO Baru"}</div>
            <button onClick={()=>setFormOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
            <div><Lbl>No WO</Lbl><Inp placeholder="016" value={form.wo} onChange={(e:any)=>setForm({...form,wo:e.target.value})}/></div>
            <div><Lbl>Nama Proyek</Lbl><Inp placeholder="Bali Tennis Court" value={form.proyek} onChange={(e:any)=>setForm({...form,proyek:e.target.value})}/></div>
            <div><Lbl>Target Tanggal</Lbl><Inp type="date" value={form.target} onChange={(e:any)=>{
              const newTarget=e.target.value;const oldTarget=form.target;
              setFormPanels(formPanels.map((p:any)=>(p.tanggal===oldTarget)?{...p,tanggal:newTarget}:p));
              setForm({...form,target:newTarget});
            }}/></div>
          </div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12,borderTop:"1px solid var(--border-color,#e2e8f0)",paddingTop:16}}>Panel</div>
          {formPanels.map((p,i)=>(
            <div key={i} style={{background:"var(--card-bg,#fff)",borderRadius:10,padding:14,marginBottom:10,border:"1px solid var(--border-color,#e2e8f0)"}}>
              <div style={{display:"grid",gridTemplateColumns:"50px 1fr 120px 55px 100px 130px 32px",gap:8,alignItems:"end"}}>
                <div><Lbl>No</Lbl><Inp value={p.noPnl} onChange={(e:any)=>{const n=[...formPanels];n[i]={...n[i],noPnl:e.target.value};setFormPanels(n);}} placeholder="1"/></div>
                <div><Lbl>Nama Panel</Lbl><Inp value={p.nama} onChange={(e:any)=>{const n=[...formPanels];n[i]={...n[i],nama:e.target.value};setFormPanels(n);}} placeholder="Nama panel..."/></div>
                <div><Lbl>Tipe</Lbl>
                  <Sel value={p.tipe} onChange={(e:any)=>{const n=[...formPanels];n[i]={...n[i],tipe:e.target.value};setFormPanels(n);}}>
                    {Object.entries(effectivePanelTypes).map(([k,v]:any)=><option key={k} value={k}>{v.label}</option>)}
                  </Sel>
                </div>
                <div><Lbl>Qty</Lbl><Inp type="number" min="1" value={p.qty} onChange={(e:any)=>{const n=[...formPanels];n[i]={...n[i],qty:e.target.value};setFormPanels(n);}}/></div>
                <div><Lbl>Jumlah Cell</Lbl>
                  <Inp type="number" min="0" value={p.jumlahCell??0} onChange={(e:any)=>{const n=[...formPanels];n[i]={...n[i],jumlahCell:e.target.value};setFormPanels(n);}}/>
                </div>
                <div><Lbl>Tanggal</Lbl>
                  <Inp type="date" value={p.tanggal||form.target||""} onChange={(e:any)=>{const n=[...formPanels];n[i]={...n[i],tanggal:e.target.value};setFormPanels(n);}}/>
                </div>
                <div style={{paddingBottom:2}}>
                  <button onClick={()=>setFormPanels(formPanels.filter((_,j)=>j!==i))}
                    style={{width:32,height:36,borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:14}}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={()=>{
            const maxNo=formPanels.reduce((max,p)=>{const n=parseInt(p.noPnl)||0;return n>max?n:max;},0);
            setFormPanels([...formPanels,{...blankPanelRow,noPnl:String(maxNo+1),tanggal:form.target}]);
          }}
            style={{width:"100%",padding:"9px",borderRadius:8,border:"1.5px dashed #cbd5e1",
              background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:16}}>
            + Tambah Panel
          </button>

          <div style={{fontWeight:700,fontSize:14,marginBottom:12,borderTop:"1px solid var(--border-color,#e2e8f0)",paddingTop:16}}>📄 Dokumen Gambar Teknik (per panel)</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            {formPanels.map((p:any,i:number)=>{
              if(!p.id){
                return(
                  <div key={i} style={{fontSize:12,color:"#94a3b8",padding:"10px 12px",background:"var(--bg-secondary,#f8fafc)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)"}}>
                    {p.nama||`Panel #${p.noPnl}`}: simpan WO dulu, baru bisa upload dokumen.
                  </div>
                );
              }
              const panelLabel=`Panel ${p.noPnl} - ${p.nama}`;
              const wi=wiOfPanel(p.id);
              const current=wi?currentRevOf(wi.id):null;
              const revisions=wi?revisionsOf(wi.id):[];
              const lainnya=revisions.filter((r:any)=>!r.is_current);
              return(
                <div key={p.id} style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)"}}>
                    <span style={{fontSize:12,color:"#64748b"}}><b style={{color:"var(--text-primary,#1e293b)"}}>{panelLabel}</b><br/>{current?`Berlaku: ${current.rev_mark||"(tanpa keterangan)"} · oleh ${current.uploaded_by} · ${fmtTgl(current.uploaded_at)}`:"Belum ada dokumen"}</span>
                    <Btn color="#1d4ed8" onClick={()=>openUpload(p.id,panelLabel,formEditId as number,form.wo)}>{current?"Upload Revisi":"+ Upload"}</Btn>
                  </div>
                  {lainnya.length>0&&(
                    <div style={{display:"flex",flexDirection:"column",gap:6,paddingLeft:12}}>
                      {lainnya.map((r:any)=>(
                        <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 10px",background:"var(--bg-secondary,#f8fafc)",borderRadius:6,border:"1px solid var(--border-color,#e2e8f0)"}}>
                          <div style={{minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <Badge label="Tidak Berlaku" color="#64748b" bg="#f1f5f9"/>
                              {r.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{r.rev_mark}</span>}
                            </div>
                            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>oleh {r.uploaded_by} · {fmtTgl(r.uploaded_at)}</div>
                          </div>
                          <button onClick={()=>setViewing({url:r.file_url,title:wi?.judul||panelLabel,subtitle:`${panelLabel} - WO ${form.wo}${r.rev_mark?` · ${r.rev_mark}`:""} · oleh ${r.uploaded_by} · ${fmtTgl(r.uploaded_at)}`})}
                            style={{background:"none",border:"none",fontSize:11,fontWeight:600,color:"#94a3b8",cursor:"pointer",whiteSpace:"nowrap",padding:0}}>Lihat →</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setFormOpen(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={saveWoForm} disabled={formSaving}>{formSaving?"Menyimpan...":(formEditId?"Simpan":"Tambah WO")}</Btn>
          </div>
        </Card>
      )}

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
            const stats=statsOfWo(w.id);
            const panelNames=panelNamesOf(w.id);
            return(
              <Card key={w.id} style={{padding:0,overflow:"hidden",border:"1px solid var(--border-color,#e2e8f0)"}}>
                <div style={{padding:"16px 18px",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,flex:1,minWidth:0}}>
                    <div style={{width:42,height:42,borderRadius:9,background:"var(--bg-secondary,#f1f5f9)",border:"1px solid var(--border-color,#e2e8f0)",display:"flex",
                      alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className="ti ti-folder" style={{fontSize:19,color:"#475569"}}/>
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>WO {w.wo}</div>
                      <div style={{fontWeight:800,fontSize:15,color:"var(--text-primary,#0f172a)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.proyek}</div>
                      {panelNames.length>0&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:6}}>
                          {panelNames.map(n=>(
                            <span key={n} style={{fontSize:11,color:"#475569",background:"var(--bg-secondary,#f1f5f9)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:6,padding:"3px 9px"}}>{n}</span>
                          ))}
                        </div>
                      )}
                      <div style={{fontSize:11.5,color:"#94a3b8",marginTop:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span><i className="ti ti-files" style={{fontSize:12,verticalAlign:"-2px"}}/> {stats.docCount}/{stats.totalPanels} panel punya dokumen</span>
                        {stats.totalPages>0&&<span><i className="ti ti-copy" style={{fontSize:12,verticalAlign:"-2px"}}/> {stats.totalPages} halaman</span>}
                        {stats.lastUpload&&<span><i className="ti ti-clock" style={{fontSize:12,verticalAlign:"-2px"}}/> {fmtTgl(stats.lastUpload)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {stats.totalPanels>0&&(stats.docCount===stats.totalPanels?<Badge label="Semua Ada Dokumen" color="#16a34a" bg="#f0fdf4"/>:stats.docCount>0?<Badge label={`${stats.docCount}/${stats.totalPanels} Dokumen`} color="#d97706" bg="#fffbeb"/>:<Badge label="Belum Ada Dokumen" color="#94a3b8" bg="var(--bg-secondary,#f1f5f9)"/>)}
                    {w.is_archived&&<Badge label="Arsip WO" color="#64748b" bg="var(--bg-secondary,#f1f5f9)"/>}
                    {canUpload&&(
                      <button onClick={e=>{e.stopPropagation();openEditWo(w);}}
                        style={{padding:"5px 12px",borderRadius:7,border:"1px solid var(--border-color,#e2e8f0)",background:"var(--bg-secondary,#f8fafc)",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                    )}
                  </div>
                </div>
                {/* Dokumen + Qty per-komponen (REVISI 4 Sep 2026 - dokumen digabung ke sini, per
                    panel bukan per WO lagi). Qty editor reuse usePanelQtyEditor.ts, TANPA FCS/
                    progress bar (sengaja dipangkas dari versi Manajemen WO, sesuai task Engineering). */}
                {panelsAll.filter((p:any)=>p.wo_id===w.id).map((p:any)=>{
                  const cfg=getEffectiveCfg(p.tipe);
                  const isPExp=expandedPanelQty[p.id];
                  const panelLabel=`Panel ${p.no_pnl} - ${p.nama}`;
                  const pWi=wiOfPanel(p.id);
                  const pCurrent=pWi?currentRevOf(pWi.id):null;
                  const pRevisions=pWi?revisionsOf(pWi.id):[];
                  const pLainnya=pRevisions.filter((r:any)=>!r.is_current);
                  const openPanelViewer=(rev:any)=>setViewing({url:rev.file_url,title:pWi?.judul||panelLabel,
                    subtitle:`${panelLabel} - WO ${w.wo}${rev.rev_mark?` · ${rev.rev_mark}`:""} · oleh ${rev.uploaded_by} · ${fmtTgl(rev.uploaded_at)}`});
                  return(
                    <div key={p.id} onClick={e=>e.stopPropagation()} style={{borderTop:"1px solid var(--border-color,#f1f5f9)"}}>
                      <div onClick={()=>setExpandedPanelQty(prev=>({...prev,[p.id]:!prev[p.id]}))}
                        style={{padding:"9px 16px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"var(--bg-secondary,#f8fafc)",flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:"#94a3b8"}}>{isPExp?"▼":"▶"}</span>
                        <span style={{fontWeight:700,color:"#475569",fontSize:12}}>#{p.no_pnl}</span>
                        <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:12.5}}>{p.nama}</span>
                        <Badge label={cfg?.label||p.tipe} color={cfg?.color||"#64748b"}/>
                        <Badge label={`Qty: ${p.qty}`} color="#0891b2"/>
                        {pCurrent?<Badge label="📄 Berlaku" color="#16a34a" bg="#f0fdf4"/>:<Badge label="📄 Belum Ada Dokumen" color="#94a3b8" bg="var(--bg-secondary,#f1f5f9)"/>}
                      </div>
                      {isPExp&&(
                        <div style={{padding:"10px 16px 10px 28px",background:"var(--bg-secondary,#fafbff)"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",marginBottom:10,background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",flexWrap:"wrap"}}>
                            <span style={{fontSize:12,color:"#64748b"}}>{pCurrent?`Berlaku: ${pCurrent.rev_mark||"(tanpa keterangan)"} · oleh ${pCurrent.uploaded_by} · ${fmtTgl(pCurrent.uploaded_at)}`:"Belum ada dokumen"}</span>
                            <div style={{display:"flex",gap:8,flexShrink:0}}>
                              {pCurrent&&<button onClick={()=>openPanelViewer(pCurrent)}
                                style={{padding:"5px 12px",borderRadius:7,border:"1px solid var(--border-color,#e2e8f0)",background:"var(--bg-secondary,#f8fafc)",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>Lihat</button>}
                              {canUpload&&<Btn color="#1d4ed8" onClick={()=>openUpload(p.id,panelLabel,w.id,w.wo)}>{pCurrent?"Upload Revisi":"+ Upload"}</Btn>}
                            </div>
                          </div>
                          {pLainnya.length>0&&(
                            <div style={{marginBottom:10}}>
                              {/* Auto-terbuka (fix 4 Sep 2026) - dulu di balik toggle collapsed, bikin
                                  keliatan kayak revisi lama "hilang" padahal cuma tersembunyi. Sekarang
                                  konsisten sama form Tambah/Edit yang udah auto-terbuka dari awal. */}
                              <div style={{color:"#64748b",fontSize:11,fontWeight:700,marginBottom:6}}>Riwayat revisi ({pLainnya.length})</div>
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {pLainnya.map((r:any)=>(
                                  <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 8px",background:"var(--card-bg,#fff)",borderRadius:6,border:"1px solid var(--border-color,#e2e8f0)"}}>
                                    <div style={{minWidth:0}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                        <Badge label="Tidak Berlaku" color="#64748b" bg="#f1f5f9"/>
                                        {r.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{r.rev_mark}</span>}
                                      </div>
                                      <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>oleh {r.uploaded_by} · {fmtTgl(r.uploaded_at)}</div>
                                    </div>
                                    <button onClick={()=>openPanelViewer(r)}
                                      style={{background:"none",border:"none",fontSize:11,fontWeight:600,color:"#94a3b8",cursor:"pointer",whiteSpace:"nowrap",padding:0}}>Lihat →</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {cfg&&cfg.wps.map((wpDef:any)=>(
                            <div key={wpDef.wp} style={{marginBottom:10}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <span style={{fontWeight:800,fontSize:12,color:wpDef.color,background:wpDef.color+"18",border:`1px solid ${wpDef.color}33`,borderRadius:6,padding:"2px 10px"}}>{wpDef.wp}</span>
                                <span style={{fontSize:11,color:"#94a3b8"}}>{wpDef.range}</span>
                              </div>
                              <div style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden"}}>
                                {wpDef.items.map((item:any,ii:number)=>{
                                  const cl=(p.checklist||{})[item.kode]||{qty:0};
                                  const flatKodes=cfg.wps.flatMap((ww:any)=>ww.items).map((it:any)=>it.kode);
                                  const isSel=selectedQtyCells&&selectedQtyCells.panelId===String(p.id)&&selectedQtyCells.kodes.includes(item.kode);
                                  return(
                                    <div key={item.kode} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                                      borderBottom:ii<wpDef.items.length-1?"1px solid #f1f5f9":"none",background:ii%2===0?wpDef.bg+"66":"var(--card-bg,#fff)"}}>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#94a3b8",minWidth:44}}>{item.kode}</span>
                                      <span style={{fontSize:12,fontWeight:600,color:"var(--text-primary,#374151)",flex:1}}>{item.nama}</span>
                                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                                        <span style={{fontSize:11,color:"#94a3b8"}}>Qty:</span>
                                        <input type="number" min="0" id={`engqty_${p.id}_${item.kode}`} value={cl.qty===0?"":cl.qty}
                                          onChange={e=>updateItemQty(String(p.id),item.kode,e.target.value)}
                                          onClick={e=>{e.stopPropagation();handleQtyCellClick(String(p.id),item.kode,flatKodes,e.shiftKey);}}
                                          onCopy={e=>handleQtyCopy(String(p.id),e)}
                                          onPaste={e=>handleQtyPasteMulti(String(p.id),e)}
                                          style={{width:56,padding:"4px 6px",borderRadius:6,
                                            border:isSel?"1.5px solid #2563eb":"1.5px solid var(--border-color,#e2e8f0)",
                                            background:isSel?"#eff6ff":"var(--card-bg,#fff)",fontSize:12,textAlign:"center",
                                            fontWeight:700,fontFamily:"'DM Mono',monospace",color:"var(--text-primary,#1e293b)"}}/>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {dirtyQty[String(p.id)]&&Object.keys(dirtyQty[String(p.id)]).length>0&&(
                        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"10px 16px",borderTop:"1px dashed var(--border-color,#e2e8f0)",background:"var(--bg-secondary,#f8faff)"}}>
                          <button onClick={()=>cancelQtyEdit(String(p.id))}
                            style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid var(--border-color,#e2e8f0)",background:"var(--bg-secondary,#f8fafc)",color:"#64748b",cursor:"pointer",fontSize:12.5,fontWeight:700,fontFamily:"inherit"}}>Batal</button>
                          <button onClick={()=>saveQtyEdit(String(p.id))}
                            style={{padding:"7px 20px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",cursor:"pointer",fontSize:12.5,fontWeight:700,fontFamily:"inherit"}}>Simpan Perubahan</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
      )}

      {uploadTarget&&(
        <Modal title={"Upload Gambar Teknik"} onClose={()=>{if(!uploading)setUploadTarget(null);}} width={460}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:12,color:"#64748b"}}>
              {uploadTarget.panelLabel} · WO {uploadTarget.woLabel}
            </div>
            <div>
              <Lbl>Judul Dokumen</Lbl>
              <Inp value={uploadJudul} onChange={(e:any)=>setUploadJudul(e.target.value)} disabled={uploading} placeholder="mis. Construction Drawing LVMDP"/>
            </div>
            <div>
              <Lbl>Keterangan Revisi (opsional)</Lbl>
              <Inp value={uploadRevMark} onChange={(e:any)=>setUploadRevMark(e.target.value)} disabled={uploading} placeholder="mis. Revisi 2 - update dimensi busbar"/>
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
