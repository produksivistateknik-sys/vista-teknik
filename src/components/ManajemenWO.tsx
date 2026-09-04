import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { workOrderService } from '../services/workOrderService'
import { rawScheduleService } from '../services/rawScheduleService'
import { generateFCSSchedule, generateFCSWiring, generateAndSaveToRawSchedule } from '../services/fcsService'
import { PANEL_TYPES } from '../constants/panelTypes'
import { initChecklist, isKomponenRelevant, getRelevantProsesForKode, woOverall, panelOverall } from '../lib/panelHelpers'
import { getLocalDateStr, daysUntil, isDelayed, getStatus, pColor } from '../lib/dateHelpers'
import { setGlobalDirtyPanelIds } from '../lib/globalState'
import { usePanelQtyEditor } from '../lib/usePanelQtyEditor'
import { useWoDigitalDocs } from '../lib/useWoDigitalDocs'
import { Card, Btn, STitle, Badge, PBar, Modal, Lbl, Inp, Sel } from './ui/Primitives'

export function ManajemenWO({woData,setWoData,createWO,updateWO,logActivity,logAct,log,user,refetchWO,highlightWoId,livePanelTypes}:any){
  // livePanelTypes (audit egress Agu 2026) - dulu component ini fetch+build ulang bom_master/
  // panel_type_meta/panel_wp_meta sendiri (duplikat App.tsx yang udah nge-compute livePanelTypes
  // persis sama dan nge-pass ke TaskMonitoring/DetailProgress/RawSchedule/dll), sekarang reuse
  // prop yang sama biar gak double-fetch 3 tabel tiap ManajemenWO ke-mount.
  const bomPanelTypesCache=livePanelTypes;
  const getEffectiveCfg=(tipe:string)=>(bomPanelTypesCache?.[tipe]?.wps?.length>0)?bomPanelTypesCache[tipe]:(PANEL_TYPES as any)[tipe];
  const effectivePanelTypes=(bomPanelTypesCache&&Object.keys(bomPanelTypesCache).length>0)?bomPanelTypesCache:PANEL_TYPES;
  // Qty-per-komponen editor (3 Sep 2026, di-extract ke usePanelQtyEditor.ts - dipakai bareng
  // WoDigitalTab.tsx/Engineering juga). getPanel/getWoContext/applyChecklist di-bind ke woData
  // nested-per-WO punya komponen ini - behavior SAMA PERSIS kayak sebelum di-extract.
  const{selectedQtyCells,dirtyQty,handleQtyCellClick,handleQtyCopy,handleQtyPasteMulti,updateItemQty,cancelQtyEdit,saveQtyEdit}=usePanelQtyEditor({
    getPanel:(panelId)=>woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>String(p.id)===panelId),
    getWoContext:(panelId)=>{const wo=woData.find((w:any)=>(w.panels||[]).some((p:any)=>String(p.id)===panelId));return wo?{id:wo.id,wo:wo.wo,proyek:wo.proyek}:undefined;},
    applyChecklist:(panelId,newChecklist)=>setWoData((prev:any)=>prev.map((w:any)=>({...w,panels:(w.panels||[]).map((p:any)=>String(p.id)===panelId?{...p,checklist:newChecklist}:p)}))),
    getEffectiveCfg,
    getUname:()=>{const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');return user?.name||user?.nama||sess?.nama||'Admin';},
  });
  // Gambar WO (REVISI 4 Sep 2026) - reuse useWoDigitalDocs.ts, SAMA PERSIS sumber data yang
  // dipakai Engineering (WoDigitalTab.tsx) - bukan tabel/jalur terpisah. Admin VIEWER-ONLY di
  // sini (gak ada tombol Upload) - upload tetap eksklusif Engineering, konsisten sama desain
  // awal WO Digital.
  const{wiOfPanel:wiOfPanelDoc,revisionsOf:revisionsOfDoc,currentRevOf:currentRevOfDoc}=useWoDigitalDocs();
  const fmtTglDoc=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—";
  const blank={wo:"",proyek:"",target:""};
  const blankPanel={noPnl:"1",nama:"",tipe:"FS",qty:1,jumlahCell:0};
  const [fcsModal,setFcsModal]=useState<any>(null);
  const [quickGenModal,setQuickGenModal]=useState<any>(null);
  const [quickGenTanggal,setQuickGenTanggal]=useState(new Date().toISOString().slice(0,10));
  const [quickGenLoading,setQuickGenLoading]=useState(false);
  const [quickGenResult,setQuickGenResult]=useState<any>(null);
  const [quickGenSelectedPanelIds,setQuickGenSelectedPanelIds]=useState<number[]>([]);
  const [fcsLoading,setFcsLoading]=useState(false);
  const [fcsResult,setFcsResult]=useState<any>(null);
  const [fcsForm,setFcsForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});
  const [selectedPanelIds,setSelectedPanelIds]=useState<number[]>([]);
  // State bobot per panel untuk WIRING CONTROL/WIRING POWER
  // format: {panelId: {bobot: "EASY"|"MEDIUM"|"HARD"|"VERY_HARD", jumlahOrang: number}}
  const [panelBobot,setPanelBobot]=useState<Record<number,{bobot:string,jumlahOrang:number}>>({});
  const WIRING_PROSES=["WIRING CONTROL","WIRING POWER"];
  const BOBOT_CONFIG:Record<string,{label:string,hariOrang:number,color:string,bg:string}>={
    EASY:{label:"Easy",hariOrang:1,color:"#16a34a",bg:"#f0fdf4"},
    MEDIUM:{label:"Medium",hariOrang:2,color:"#d97706",bg:"#fffbeb"},
    HARD:{label:"Hard",hariOrang:3,color:"#dc2626",bg:"#fef2f2"},
    VERY_HARD:{label:"Very Hard",hariOrang:4,color:"#7c3aed",bg:"#f5f3ff"},
  };
  const [selectedKomponen,setSelectedKomponen]=useState<string[]>([]);
  const [form,setForm]=useState(blank);
  const [panels,setPanels]=useState([{...blankPanel}]);
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [open,setOpen]=useState(false);
  const [expandedWo,setExpandedWo]=useState({});
  const [expandedPanel,setExpandedPanel]=useState({});
  // Scroll+highlight ke WO tertentu (dipicu klik notifikasi push "WO Baru Ditambahkan" -
  // highlightWoId datang dari App.tsx via query param ?wo_id=). glowWoId cuma nyala sebentar
  // (efek visual sementara), beda dari expandedWo yang permanen sampai user collapse manual.
  const woCardRefs=useRef<Record<number,HTMLDivElement|null>>({});
  const [glowWoId,setGlowWoId]=useState<number|null>(null);
  useEffect(()=>{
    if(!highlightWoId)return;
    const id=Number(highlightWoId);
    if(!woData.some((w:any)=>w.id===id))return; // WO-nya belum ke-load di state, tunggu render berikutnya
    setExpandedWo((p:any)=>({...p,[id]:true}));
    setGlowWoId(id);
    const el=woCardRefs.current[id];
    if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
    const t=setTimeout(()=>setGlowWoId((cur)=>cur===id?null:cur),3000);
    return()=>clearTimeout(t);
  },[highlightWoId,woData]);
  const [arsipModal,setArsipModal]=useState<any>(null);
  const [arsipLoading,setArsipLoading]=useState(false);
  const [arsipPanelModal,setArsipPanelModal]=useState<any>(null);
  const [selArsipPanelIds,setSelArsipPanelIds]=useState<Set<number>>(new Set());
  const [arsipPanelLoading,setArsipPanelLoading]=useState(false);

  const toggleArsipPanelId=(id:number)=>{
    setSelArsipPanelIds(prev=>{
      const next=new Set(prev);
      next.has(id)?next.delete(id):next.add(id);
      return next;
    });
  };

  const prosesArsipPanel=async()=>{
    if(selArsipPanelIds.size===0)return;
    setArsipPanelLoading(true);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const panelsToArsip=(arsipPanelModal.panels||[]).filter((p:any)=>selArsipPanelIds.has(p.id));
    const gagal:string[]=[];
    let sukses=0;
    for(const p of panelsToArsip){
      const progress=panelOverall(p);
      // BUG FIX (30 Agu 2026): arsip_panel() RPC hard-delete row panels - kena FK constraint
      // permintaan_panel_id_fkey kalau masih ada row permintaan yang nyantol ke panel ini (pola
      // SAMA PERSIS kayak bug WO-delete/cekYatimPiatu di workOrderService.ts). Beda dari kasus WO
      // (yang punya skenario "panel pindah ke WO sibling", jadi perlu cek "panel masih hidup?"),
      // di sini panelnya SENDIRI yang mau dihapus - jadi SEMUA permintaan/fcs_tracking_komponen
      // yang nunjuk ke panel ini otomatis yatim piatu begitu delete berhasil, gak perlu cek status.
      const{data:permRows}=await supabase.from("permintaan").select("id").eq("panel_id",p.id);
      const permIds=(permRows||[]).map((r:any)=>r.id);
      if(permIds.length>0){
        await supabase.from("permintaan_item").delete().in("permintaan_id",permIds);
        await supabase.from("permintaan").delete().in("id",permIds);
      }
      await supabase.from("fcs_tracking_komponen").delete().eq("panel_id",p.id);
      const{error}=await supabase.rpc("arsip_panel",{p_panel_id:p.id,p_user:uname,p_progress:progress});
      if(error){gagal.push(p.nama+": "+error.message);}
      else{
        sukses++;
        await activityLogService.insert({
          user_name:uname,action:"ARSIP PANEL",
          description:"Arsip panel "+p.nama+" ("+progress+"%) dari WO "+arsipPanelModal.wo+" - "+arsipPanelModal.proyek,
          module:"wo",halaman:"Manajemen WO",proyek:arsipPanelModal.proyek||"",panel:p.nama,wo_number:arsipPanelModal.wo,
        });
      }
    }
    setArsipPanelLoading(false);
    if(refetchWO)await refetchWO();
    if(gagal.length>0){
      alert(sukses+" panel berhasil diarsipkan.\n\nGagal ("+gagal.length+"):\n"+gagal.join("\n"));
    } else {
      alert(sukses+" panel berhasil diarsipkan dan disembunyikan dari Raw Schedule/Rencana Harian/Outstanding.");
    }
    setArsipPanelModal(null);
    setSelArsipPanelIds(new Set());
  };

  const arsipkanWO=async(wo:any)=>{
    setArsipLoading(true);
    try{
      const panelIds=(wo.panels||[]).map((p:any)=>p.id);
      const totalPanel=panelIds.length;
      const totalKomponen=(wo.panels||[]).reduce((s:number,p:any)=>s+Object.keys(p.checklist||{}).length,0);

      // Ambil semua raw_schedule untuk WO ini
      const{data:rawRows}=await supabase.from("raw_schedule").select("*").eq("wo_id",wo.id);
      // Ambil semua renhar untuk WO ini
      const{data:renharRows}=await supabase.from("renhar").select("*").eq("wo_id",wo.id);
      // Ambil semua timer kerja untuk panel-panel di WO ini
      const{data:timerRows}=panelIds.length>0?await supabase.from("fcs_timer_kerja").select("*,pekerja(nama)").in("panel_id",panelIds):{data:[]};
      // Catatan: tabel kendala tidak punya relasi wo_id/panel_id, jadi tidak bisa difilter per WO
      const kendalaRows:any[]=[];

      const totalJamKerja=(timerRows||[]).reduce((s:number,t:any)=>s+Number(t.durasi_menit||0),0)/60;

      const ringkasanOperatorMap:Record<string,{nama:string,totalMenit:number,jumlahSesi:number}>={};
      (timerRows||[]).forEach((t:any)=>{
        const nama=t.pekerja?.nama||"Tidak diketahui";
        if(!ringkasanOperatorMap[nama])ringkasanOperatorMap[nama]={nama,totalMenit:0,jumlahSesi:0};
        ringkasanOperatorMap[nama].totalMenit+=Number(t.durasi_menit||0);
        ringkasanOperatorMap[nama].jumlahSesi++;
      });
      const ringkasanOperator=Object.values(ringkasanOperatorMap);

      const rincianPanel=(wo.panels||[]).map((p:any)=>({
        id:p.id,nama:p.nama,tipe:p.tipe,qty:p.qty,
        totalKomponen:Object.keys(p.checklist||{}).length,
      }));

      const tanggalSelesaiAktual=getLocalDateStr();
      const selisihHari=Math.round((new Date(tanggalSelesaiAktual).getTime()-new Date(wo.target).getTime())/86400000);
      const statusKetepatan=selisihHari<=0?"tepat_waktu":"telat";

      const{error}=await supabase.from("fcs_arsip_wo").insert({
        wo_id:wo.id,wo_number:wo.wo,proyek:wo.proyek,
        target_selesai:wo.target,tanggal_selesai_aktual:tanggalSelesaiAktual,
        status_ketepatan:statusKetepatan,selisih_hari:Math.abs(selisihHari),
        total_panel:totalPanel,total_komponen:totalKomponen,total_jam_kerja:totalJamKerja,
        ringkasan_operator:ringkasanOperator,rincian_panel:rincianPanel,
        catatan_kendala:kendalaRows||[],
        snapshot_raw_schedule:rawRows||[],snapshot_renhar:renharRows||[],
        diarsipkan_oleh:user?.name||user?.nama||"Admin",
      });

      if(error){alert("Gagal arsipkan: "+error.message);setArsipLoading(false);return;}

      // Tandai WO sebagai sudah diarsipkan, supaya tidak muncul lagi di tampilan aktif
      await supabase.from("work_orders").update({is_archived:true}).eq("id",wo.id);

      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      await activityLogService.insert({
        user_name:uname,action:"ARSIPKAN WO",
        description:"Arsipkan WO "+wo.wo+" ("+wo.proyek+") - "+totalPanel+" panel, "+totalKomponen+" komponen",
        module:"wo",halaman:"Manajemen WO",proyek:wo.proyek||"",panel:""
      });

      setArsipModal(null);
      if(refetchWO)await refetchWO();
      alert("WO "+wo.wo+" berhasil diarsipkan dan disembunyikan dari tampilan aktif!");
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setArsipLoading(false);
  };

  // conflictSink opsional (8 Agu 2026): dipakai save() buat kumpulin peringatan kalau qty PANEL
  // diturunkan sampai bikin qty komponen ikut turun di bawah qtyProses yang udah dikerjakan operator -
  // sama kelas masalahnya kayak yang dicek saveQtyEdit, tapi lewat jalur qty PANEL (modal Edit WO), bukan qty per-komponen di grid.
  // qtyChangeSink opsional (8 Agu 2026): kumpulin {kode,newQty} per panelId buat sync ke
  // raw_schedule (rawScheduleService.syncQtyAfterEdit) setelah save() sukses - jalur qty PANEL ini
  // dulu gak pernah nyentuh raw_schedule sama sekali, beda dari saveQtyEdit yang udah disinkron.
  const buildNp=(list:any[],freshChecklistMap?:Record<string,any>,conflictSink?:string[],qtyChangeSink?:Record<string,{kode:string,newQty:number}[]>)=>list.filter(p=>p.nama).map((p,i)=>{
    if((p as any).id){
      const newQty=Number(p.qty)||1;
      const origQty=(p as any)._origQty!==undefined?Number((p as any)._origQty)||1:newQty;
      const freshChecklist=freshChecklistMap?.[String((p as any).id)];
      let finalChecklist=freshChecklist||(p as any).checklist||initChecklist(p.tipe,newQty);
      if(origQty!==newQty&&origQty>0&&(p as any).checklist){
        const ratio=newQty/origQty;
        const scaledChecklist:any={};
        const cfg=conflictSink?getEffectiveCfg(p.tipe):null;
        const panelIdStr=String((p as any).id);
        Object.entries(finalChecklist).forEach(([kode,cl]:any)=>{
          const newKodeQty=Math.round((cl.qty||0)*ratio);
          scaledChecklist[kode]={...cl,qty:newKodeQty};
          if(qtyChangeSink&&newKodeQty!==(cl.qty||0)){
            if(!qtyChangeSink[panelIdStr])qtyChangeSink[panelIdStr]=[];
            qtyChangeSink[panelIdStr].push({kode,newQty:newKodeQty});
          }
          if(conflictSink){
            const maxQtyProses=Math.max(0,...Object.values(cl.qtyProses||{}).map((v:any)=>Number(v)||0));
            if(maxQtyProses>newKodeQty){
              const nama=cfg?.wps?.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
              conflictSink.push(`${p.nama} - ${nama}: progress sudah dikerjakan ${maxQtyProses}, qty baru cuma ${newKodeQty}`);
            }
          }
        });
        finalChecklist=scaledChecklist;
      }
      return{
        id:(p as any).id,noPnl:Number((p as any).no_pnl??p.noPnl)||i+1,nama:p.nama,tipe:p.tipe,qty:newQty,
        checklist:finalChecklist,
        catatan:(p as any).catatan||"",
        jumlahCell:Number((p as any).jumlahCell)||0,
      };
    }
    return{
      noPnl:Number((p as any).no_pnl??p.noPnl)||i+1,nama:p.nama,tipe:p.tipe,qty:Number(p.qty)||1,
      checklist:initChecklist(p.tipe,Number(p.qty)||1,bomPanelTypesCache),catatan:"",
      jumlahCell:Number((p as any).jumlahCell)||0,
    };
  });

  const save=async()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    if(editId){
      // Snapshot SEBELUM update - buat deteksi "revisi WO" (field WO berubah) vs "tambah panel"
      // (baris tanpa id ditambahkan) di bawah, notifikasi (REVISI 5 Sep 2026). Diambil dari
      // woData (belum ke-overwrite sampai refetchWO() di bawah), bukan dari form/panels yang
      // udah keburu mutasi state lokal pas modal dibuka.
      const origWo=woData.find((w:any)=>w.id===editId);
      const woFieldsChanged=origWo&&(origWo.wo!==form.wo||origWo.proyek!==form.proyek||origWo.target!==form.target);
      const newPanelNames=panels.filter(p=>p.nama&&!(p as any).id).map(p=>p.nama);
      const result=await updateWO(editId,{wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        // ambil checklist TERBARU dari DB biar gak nimpa edit qty admin lain yang masuk selagi modal ini kebuka
        const panelIds=panels.filter(p=>p.nama&&(p as any).id).map(p=>(p as any).id);
        let freshChecklistMap:Record<string,any>={};
        if(panelIds.length>0){
          const{data:freshRows}=await supabase.from("panels").select("id,checklist").in("id",panelIds);
          freshChecklistMap=Object.fromEntries((freshRows||[]).map((r:any)=>[String(r.id),r.checklist]));
        }
        const groups:Record<string,any[]>={};
        panels.filter(p=>p.nama).forEach(p=>{
          const tgl=(p as any).tanggal||form.target;
          if(!groups[tgl])groups[tgl]=[];
          groups[tgl].push(p);
        });
        const konflikListPanel:string[]=[];
        const qtyChangeSinkPanel:Record<string,{kode:string,newQty:number}[]>={};
        const groupedPanels=Object.keys(groups).map(tgl=>({tanggal:tgl,panels:buildNp(groups[tgl],freshChecklistMap,konflikListPanel,qtyChangeSinkPanel)}));
        if(konflikListPanel.length>0){
          const lanjutPanel=window.confirm(
            'PERINGATAN: qty panel diubah sehingga qty sejumlah komponen ikut berkurang di bawah progress yang sudah dikerjakan operator:\n\n'+
            konflikListPanel.join('\n')+
            '\n\nProgress yang sudah ada TIDAK akan diubah/dipotong otomatis - cuma qty target-nya yang berubah. '+
            'Operator mungkin perlu koreksi manual di Vista Pekerja setelah ini. Lanjutkan simpan?'
          );
          if(!lanjutPanel)return;
        }
        await workOrderService.saveWOWithSplit(editId,form.wo,form.proyek,form.target,groupedPanels,uname);
        // FITUR (8 Agu 2026): sync qtyPerKomponen di raw_schedule yang udah ada - sama seperti
        // saveQtyEdit, biar jalur qty PANEL ini juga gak ninggalin raw_schedule basi.
        for(const panelIdStr of Object.keys(qtyChangeSinkPanel)){
          await rawScheduleService.syncQtyAfterEdit(Number(panelIdStr),qtyChangeSinkPanel[panelIdStr]);
        }
        if(refetchWO)await refetchWO();
        if(log) await log("EDIT WO","Edit WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"update",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
        // Push notif "revisi WO"/"tambah panel" (REVISI 5 Sep 2026) - fitur tambahan, GAGAL DI
        // SINI TIDAK BOLEH gagalin proses simpan yang udah beres di atas, try/catch sendiri.
        if(woFieldsChanged){
          try{
            await supabase.functions.invoke("notify-wo-baru",{body:{trigger:"revisi_wo",wo_id:editId,wo_number:form.wo,proyek:form.proyek,target:form.target,admin_nama:uname}});
          }catch{/* notifikasi gagal - diabaikan */}
        }
        if(newPanelNames.length>0){
          try{
            await supabase.functions.invoke("notify-wo-baru",{body:{trigger:"tambah_panel",wo_id:editId,wo_number:form.wo,proyek:form.proyek,admin_nama:uname,panel_names:newPanelNames}});
          }catch{/* notifikasi gagal - diabaikan */}
        }
      }
    } else {
      const np=buildNp(panels);
      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        const{data:freshPanels}=await supabase.from("panels").select("*").eq("wo_id",result.data.id).order("no_pnl",{ascending:true});
        const newWo={...result.data,panels:(freshPanels??np).map((p:any)=>({...p,noPnl:p.no_pnl??p.noPnl}))};
        setWoData(prev=>{
          if(prev.some(w=>w.id===result.data.id)){
            return prev.map(w=>w.id===result.data.id?newWo:w);
          }
          return [...prev,newWo];
        });
        if(log) await log("TAMBAH WO","Tambah WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"create",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
        // Push notif ke admin + SEMUA divisi operator (REVISI 5 Sep 2026, dulu admin doang) -
        // fitur tambahan, GAGAL DI SINI TIDAK BOLEH gagalin proses simpan yang udah beres di
        // atas, makanya dibungkus try/catch sendiri dan gak di-await sebagai bagian kondisi apapun.
        try{
          await supabase.functions.invoke("notify-wo-baru",{body:{trigger:"baru",wo_id:result.data.id,wo_number:form.wo,proyek:form.proyek,target:form.target,admin_nama:uname}});
        }catch{/* notifikasi gagal - diabaikan, WO tetap tersimpan */}
      }
    }
    setOpen(false);
  };
  useEffect(()=>{
    setGlobalDirtyPanelIds(new Set(Object.keys(dirtyQty).filter(pid=>Object.keys(dirtyQty[pid]||{}).length>0)));
  },[dirtyQty]);

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <STitle style={{marginBottom:0}}>Manajemen Work Order</STitle>
        <Btn color="#1d4ed8" onClick={()=>{setForm(blank);setPanels([{...blankPanel}]);setEditId(null);setOpen(true);}}>+ Tambah WO</Btn>
      </div>
      {woData.length===0&&!open&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>Belum ada Work Order</div>
          <div style={{fontSize:12,marginTop:4}}>Klik tombol "+ Tambah WO" untuk membuat WO pertama</div>
        </div>
      )}
      {[...woData].sort((a:any,b:any)=>(a.target||"9999-99-99").localeCompare(b.target||"9999-99-99")).map(wo=>{
        const pct=woOverall(wo);const st=getStatus(wo.target,pct);const isExp=expandedWo[wo.id];const d=daysUntil(wo.target);
        return(
          <div key={wo.id} ref={(el)=>{woCardRefs.current[wo.id]=el;}}>
          <Card style={{marginBottom:12,borderLeft:`3px solid ${st.color}`,padding:0,overflow:"hidden",
            ...(glowWoId===wo.id?{boxShadow:"0 0 0 3px #2563eb66",transition:"box-shadow .4s ease"}:{transition:"box-shadow .4s ease"})}}>
            <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"center",
              cursor:"pointer",background:isExp?"#f8faff":"#fff",borderBottom:isExp?"1px solid #e2e8f0":"none"}}
              onClick={()=>setExpandedWo(p=>({...p,[wo.id]:!p[wo.id]}))}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:15,fontFamily:"'DM Mono',monospace",color:"#1d4ed8"}}>WO {wo.wo}</span>
                    <span style={{color:"var(--text-primary,#1e293b)",fontWeight:700}}>{wo.proyek}</span>
                    <span style={{color:"#94a3b8",fontSize:12}}>📅 {wo.target}</span>
                    {pct<100&&<span style={{fontSize:11,color:st.color,fontWeight:600}}>
                      {isDelayed(wo.target)?`⚠️ -${Math.abs(d)}hr`:`H-${d}`}
                    </span>}
                  </div>
                  <div style={{marginTop:4,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    <Badge label={st.label} color={st.color} bg={st.bg}/>
                    <span style={{fontWeight:800,color:pColor(pct),fontFamily:"'DM Mono',monospace"}}>{pct}%</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{(wo.panels??[]).length} panel</span>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:7}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>{setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels((wo.panels||[]).map(p=>({id:p.id,noPnl:(p as any).no_pnl??p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty,checklist:p.checklist,catatan:p.catatan,jumlahCell:(p as any).jumlahCell??(p as any).jumlah_cell??0,tanggal:wo.target,_origQty:p.qty} as any)));setEditId(wo.id);setOpen(true);}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                <button onClick={()=>{setQuickGenModal(wo);setQuickGenTanggal(new Date().toISOString().slice(0,10));setQuickGenResult(null);setQuickGenSelectedPanelIds((wo.panels||[]).map((p:any)=>p.id));}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:12,fontWeight:600}}>⏱ FCS</button>
                <button onClick={()=>{setArsipPanelModal(wo);setSelArsipPanelIds(new Set());}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>📦 Arsip</button>
                <button onClick={()=>setDelId(wo.id)}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:600}}>🗑</button>
              </div>
            </div>
            {isExp&&[...(wo.panels||[])].sort((a:any,b:any)=>(Number(a.no_pnl)||0)-(Number(b.no_pnl)||0)).map(p=>{
              const pp=panelOverall(p);const isPExp=expandedPanel[p.id];const cfg=getEffectiveCfg(p.tipe);
              return(
                <div key={p.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{padding:"10px 16px 10px 28px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
                    cursor:"pointer",background:isPExp?"#f8fafc":"#fff",borderBottom:isPExp?"1px solid #f1f5f9":"none"}}
                    onClick={()=>setExpandedPanel(prev=>({...prev,[p.id]:!prev[p.id]}))}>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{isPExp?"▼":"▶"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,color:"#475569",fontSize:12}}>#{p.no_pnl??p.noPnl}</span>
                        <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{p.nama}</span>
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                        <Badge label={cfg?.label||p.tipe} color={cfg?.color||"#64748b"}/>
                        <Badge label={`Qty: ${p.qty}`} color="#0891b2"/>
                        <Badge label={`${pp}%`} color={pColor(pp)}/>
                      </div>
                    </div>
                    <div style={{minWidth:120}}><PBar pct={pp} h={6}/></div>
                  </div>
                  {isPExp&&cfg&&(
                    <div style={{padding:"12px 16px 12px 28px",background:"#fafbff"}}>
                      {cfg.wps.map(wpDef=>(
                        <div key={wpDef.wp} style={{marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span style={{fontWeight:800,fontSize:12,color:wpDef.color,background:wpDef.color+"18",border:`1px solid ${wpDef.color}33`,borderRadius:6,padding:"2px 10px"}}>{wpDef.wp}</span>
                            <span style={{fontSize:11,color:"#94a3b8"}}>{wpDef.range}</span>
                          </div>
                          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
                            {wpDef.items.map((item,ii)=>{
                              const cl=(p.checklist||{})[item.kode]||{qty:0};const isLocked=cl.qty===0;
                              return(
                                <div key={item.kode} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                                  borderBottom:ii<wpDef.items.length-1?"1px solid #f1f5f9":"none",
                                  background:isLocked?"#fffbfb":ii%2===0?wpDef.bg+"66":"#fff",opacity:isLocked?.6:1}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#94a3b8",minWidth:44}}>{item.kode}</span>
                                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-primary,#374151)",flex:1}}>
                                    {item.nama}{isLocked&&<span style={{marginLeft:6,fontSize:10,color:"#fca5a5"}}>🔒</span>}
                                  </span>
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <span style={{fontSize:11,color:"#94a3b8"}}>Qty:</span>
                                    <input type="number" min="0" id={`qtyinput_${p.id}_${item.kode}`} value={cl.qty===0?"":cl.qty}
                                      onChange={e=>updateItemQty(String(p.id),item.kode,e.target.value)}
                                      onKeyDown={e=>{
                                        if(e.key!=="Enter")return;
                                        e.preventDefault();
                                        const flatKodes2=cfg.wps.flatMap((w:any)=>w.items).map((it:any)=>it.kode);
                                        const curIdx=flatKodes2.indexOf(item.kode);
                                        const nextKode=flatKodes2[curIdx+1];
                                        if(nextKode){
                                          const nextEl=document.getElementById(`qtyinput_${p.id}_${nextKode}`);
                                          if(nextEl){(nextEl as HTMLInputElement).focus();(nextEl as HTMLInputElement).select();}
                                        }
                                      }}
                                      onClick={e=>{
                                        e.stopPropagation();
                                        const flatKodes=cfg.wps.flatMap((w:any)=>w.items).map((it:any)=>it.kode);
                                        handleQtyCellClick(String(p.id),item.kode,flatKodes,e.shiftKey);
                                      }}
                                      onCopy={e=>handleQtyCopy(String(p.id),e)}
                                      onPaste={e=>{
                                        if(selectedQtyCells&&selectedQtyCells.panelId===String(p.id)&&selectedQtyCells.kodes.length>1&&selectedQtyCells.kodes.includes(item.kode)){
                                          handleQtyPasteMulti(String(p.id),e);
                                          return;
                                        }
                                        const text=e.clipboardData.getData("text");
                                        const values=text.split(/\r?\n|\t/).map(v=>v.trim()).filter(v=>v!=="");
                                        if(values.length<=1)return;
                                        e.preventDefault();
                                        const flatItems=cfg.wps.flatMap((w:any)=>w.items);
                                        const startIdx2=flatItems.findIndex((it:any)=>it.kode===item.kode);
                                        if(startIdx2===-1)return;
                                        values.forEach((val,idx)=>{
                                          const target=flatItems[startIdx2+idx];
                                          if(!target)return;
                                          const numVal=parseFloat(val)||0;
                                          updateItemQty(String(p.id),target.kode,numVal);
                                        });
                                      }}
                                      style={{width:56,padding:"4px 6px",borderRadius:6,
                                        border:selectedQtyCells&&selectedQtyCells.panelId===String(p.id)&&selectedQtyCells.kodes.includes(item.kode)?"1.5px solid #2563eb":`1.5px solid ${isLocked?"#fecaca":"#e2e8f0"}`,
                                        background:selectedQtyCells&&selectedQtyCells.panelId===String(p.id)&&selectedQtyCells.kodes.includes(item.kode)?"#eff6ff":isLocked?"#fef2f2":"#fff",fontSize:12,textAlign:"center",
                                        fontWeight:700,fontFamily:"'DM Mono',monospace",color:isLocked?"#fca5a5":"var(--text-primary,#1e293b)"}}/>
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
                    <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"12px 16px",borderTop:"1px dashed #e2e8f0",marginTop:4,background:"#f8faff"}}>
                      <button onClick={()=>cancelQtyEdit(String(p.id))}
                        style={{padding:"8px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
                        Batal
                      </button>
                      <button onClick={()=>saveQtyEdit(String(p.id))}
                        style={{padding:"8px 24px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #2563eb33"}}>
                        Simpan Perubahan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
          </div>
        );
      })}
      {arsipModal&&(
        <Modal title="Arsipkan Work Order?" onClose={()=>{if(!arsipLoading)setArsipModal(null);}} width={420}>
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e",display:"flex",gap:8,alignItems:"flex-start"}}>
            <i className="ti ti-alert-triangle" style={{fontSize:16,marginTop:1}}/>
            <span>WO <strong>{arsipModal.wo}</strong> ({arsipModal.proyek}) akan diarsipkan. Semua data (Raw Schedule, Rencana Harian, riwayat kerja) akan disimpan permanen sebagai histori.</span>
          </div>
          <div style={{fontSize:12,color:"#475569",marginBottom:16}}>
            <div>📦 {(arsipModal.panels||[]).length} panel akan diarsipkan</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setArsipModal(null)} disabled={arsipLoading}>Batal</Btn>
            <Btn color="#16a34a" onClick={()=>arsipkanWO(arsipModal)} disabled={arsipLoading}>
              {arsipLoading?"⏳ Mengarsipkan...":"📦 Arsipkan Sekarang"}
            </Btn>
          </div>
        </Modal>
      )}
      {arsipPanelModal&&(
        <Modal title={"Arsip Panel — WO "+arsipPanelModal.wo+" ("+arsipPanelModal.proyek+")"}
          onClose={()=>{if(!arsipPanelLoading){setArsipPanelModal(null);setSelArsipPanelIds(new Set());}}} width={480}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>
            Pilih panel yang mau diarsipkan. Semua data terkait (Raw Schedule, Rencana Harian, checklist/progress, riwayat timer, QC, Nameplate/Yellowmark) dipindah ke arsip dan hilang dari tampilan aktif - bisa dikembalikan kapan saja lewat tab Arsip.
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:340,overflowY:"auto" as const,marginBottom:14}}>
            {(arsipPanelModal.panels||[]).length===0?(
              <div style={{textAlign:"center" as const,padding:20,color:"#94a3b8",fontSize:12}}>WO ini tidak punya panel.</div>
            ):(arsipPanelModal.panels||[]).map((p:any)=>{
              const pp=panelOverall(p);
              const checked=selArsipPanelIds.has(p.id);
              return(
                <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",
                  borderRadius:8,border:`1.5px solid ${checked?"#1d4ed8":"#e2e8f0"}`,background:checked?"#eff6ff":"#fff",cursor:"pointer"}}>
                  <input type="checkbox" checked={checked} onChange={()=>toggleArsipPanelId(p.id)}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>#{p.no_pnl??p.noPnl} {p.nama}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>{p.tipe} · Qty {p.qty}</div>
                  </div>
                  <div style={{minWidth:90,display:"flex",alignItems:"center",gap:6}}>
                    <PBar pct={pp} h={6}/>
                    <span style={{fontWeight:700,fontSize:11,color:pColor(pp)}}>{pp}%</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>{setArsipPanelModal(null);setSelArsipPanelIds(new Set());}} disabled={arsipPanelLoading}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={prosesArsipPanel} disabled={arsipPanelLoading||selArsipPanelIds.size===0}>
              {arsipPanelLoading?"⏳ Mengarsipkan...":`📦 Arsipkan ${selArsipPanelIds.size} Panel`}
            </Btn>
          </div>
        </Modal>
      )}
      {delId&&(
        <Modal title="Hapus WO?" onClose={()=>setDelId(null)} width={360}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Data tidak dapat dikembalikan.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={async()=>{
  const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
  const uname=sess?.nama||sess?.name||'Admin';
  // Logic cascade delete FK-safe DIEKSTRAK (4 Sep 2026) ke workOrderService.removeWithDependencies -
  // dipakai ulang juga oleh WoDigitalTab (Engineering). Behavior SAMA PERSIS: tiap step wajib
  // lolos cek error dulu, kalau ada yang gagal proses berhenti total (gak ada yang keburu
  // terhapus dianggap sukses) - lihat komentar bug fix 29 Agu 2026 di workOrderService.ts.
  try{
    await workOrderService.removeWithDependencies(delId as number,uname,{halaman:'Manajemen WO'});
  }catch(err:any){
    alert('Gagal menghapus WO: masih ada data terkait di tabel "'+err.message+'".\n\nProses dihentikan - tidak ada data yang berubah/terhapus. Cek data terkait sebelum coba lagi.');
    return;
  }
  setWoData(prev=>prev.filter(w=>w.id!==delId));
  setDelId(null);
}}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}
      {open&&(
        <Card style={{marginBottom:16,border:"2px solid #2563eb",background:"#f8faff"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:16,color:"var(--text-primary,#1e293b)"}}>{editId?"✏️ Edit WO":"📝 Tambah WO Baru"}</div>
            <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
            <div><Lbl>No WO</Lbl><Inp placeholder="016" value={form.wo} onChange={e=>setForm({...form,wo:e.target.value})}/></div>
            <div><Lbl>Nama Proyek</Lbl><Inp placeholder="Bali Tennis Court" value={form.proyek} onChange={e=>setForm({...form,proyek:e.target.value})}/></div>
            <div><Lbl>Target Tanggal</Lbl><Inp type="date" value={form.target} onChange={e=>{
              const newTarget=e.target.value;
              const oldTarget=form.target;
              // BUG FIX (29 Agu 2026): dulu ubah field ini doang gak nyentuh tanggal per-panel
              // (di-init = target LAMA pas modal dibuka, lihat setPanels di baris pembuka edit) -
              // pas Simpan, saveWOWithSplit ngeliat SEMUA panel "beda tanggal" dari target BARU
              // (karena masih nyangkut di tanggal lama) terus di-split ke WO sibling BARU dengan
              // TARGET LAMA, WO asli jadi 0 panel & ke-auto-delete - net effect: ubah deadline
              // malah bikin panel-panelnya nyangkut di deadline lama. Sekarang panel yang tanggal-
              // nya MASIH ikut default (== target lama, belum di-override manual lewat field per-
              // panel di bawah) ikut ke-update ke target baru. Panel yang SUDAH sengaja di-override
              // manual (tanggal beda dari target lama) TIDAK disentuh - fitur split-per-panel yang
              // sudah ada tetap jalan persis seperti sebelumnya.
              setPanels(panels.map(p=>((p as any).tanggal===oldTarget)?{...p,tanggal:newTarget}:p));
              setForm({...form,target:newTarget});
            }}/></div>
          </div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12,borderTop:"1px solid #e2e8f0",paddingTop:16}}>Panel</div>
          {panels.map((p,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:10,padding:14,marginBottom:10,border:"1px solid #e2e8f0"}}>
              <div style={{display:"grid",gridTemplateColumns:"50px 1fr 120px 55px 100px 130px 32px",gap:8,alignItems:"end"}}>
                <div><Lbl>No</Lbl><Inp value={p.noPnl} onChange={e=>{const n=[...panels];n[i]={...n[i],noPnl:e.target.value};setPanels(n);}} placeholder="1"/></div>
                <div><Lbl>Nama Panel</Lbl><Inp value={p.nama} onChange={e=>{const n=[...panels];n[i]={...n[i],nama:e.target.value};setPanels(n);}} placeholder="Nama panel..."/></div>
                <div><Lbl>Tipe</Lbl>
                  <Sel value={p.tipe} onChange={e=>{const n=[...panels];n[i]={...n[i],tipe:e.target.value};setPanels(n);}}>
                    {Object.entries(effectivePanelTypes).map(([k,v]:any)=><option key={k} value={k}>{v.label}</option>)}
                  </Sel>
                </div>
                <div><Lbl>Qty</Lbl><Inp type="number" min="1" value={p.qty} onChange={e=>{const n=[...panels];n[i]={...n[i],qty:e.target.value};setPanels(n);}}/></div>
                <div><Lbl>Jumlah Cell</Lbl>
                  <Inp type="number" min="0" value={(p as any).jumlahCell??0} onChange={e=>{const n=[...panels];n[i]={...n[i],jumlahCell:e.target.value} as any;setPanels(n);}}/>
                </div>
                <div><Lbl>Tanggal</Lbl>
                  <Inp type="date" value={(p as any).tanggal||form.target||""} onChange={e=>{const n=[...panels];n[i]={...n[i],tanggal:e.target.value} as any;setPanels(n);}}/>
                </div>
                <div style={{paddingBottom:2}}>
                  <button onClick={()=>setPanels(panels.filter((_,j)=>j!==i))}
                    style={{width:32,height:36,borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:14}}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={()=>{
            const maxNo=panels.reduce((max,p)=>{const n=parseInt(p.noPnl)||0;return n>max?n:max;},0);
            setPanels([...panels,{...blankPanel,noPnl:String(maxNo+1),tanggal:form.target} as any]);
          }}
            style={{width:"100%",padding:"9px",borderRadius:8,border:"1.5px dashed #cbd5e1",
              background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:16}}>
            + Tambah Panel
          </button>

          {editId&&(
            <>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12,borderTop:"1px solid #e2e8f0",paddingTop:16}}>📄 Gambar WO</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                {panels.filter((p:any)=>p.id).length===0?(
                  <div style={{fontSize:12,color:"#94a3b8",padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                    Belum ada panel tersimpan.
                  </div>
                ):panels.filter((p:any)=>p.id).map((p:any)=>{
                  const panelLabel=`Panel ${p.noPnl} - ${p.nama}`;
                  const wi=wiOfPanelDoc(p.id);
                  const current=wi?currentRevOfDoc(wi.id):null;
                  const revisions=wi?revisionsOfDoc(wi.id):[];
                  const lainnya=revisions.filter((r:any)=>!r.is_current);
                  return(
                    <div key={p.id} style={{display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",background:"#fff",borderRadius:8,border:"1px solid #e2e8f0"}}>
                        <span style={{fontSize:12,color:"#64748b"}}><b style={{color:"#1e293b"}}>{panelLabel}</b><br/>{current?`Berlaku: ${current.rev_mark||"(tanpa keterangan)"} · oleh ${current.uploaded_by} · ${fmtTglDoc(current.uploaded_at)}`:"Belum ada dokumen"}</span>
                        {current&&<button onClick={()=>window.open(current.file_url,"_blank")}
                          style={{padding:"5px 12px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>Lihat</button>}
                      </div>
                      {lainnya.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:6,paddingLeft:12}}>
                          {lainnya.map((r:any)=>(
                            <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 10px",background:"#f8fafc",borderRadius:6,border:"1px solid #e2e8f0"}}>
                              <div style={{minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                  <Badge label="Tidak Berlaku" color="#64748b" bg="#f1f5f9"/>
                                  {r.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{r.rev_mark}</span>}
                                </div>
                                <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>oleh {r.uploaded_by} · {fmtTglDoc(r.uploaded_at)}</div>
                              </div>
                              <button onClick={()=>window.open(r.file_url,"_blank")}
                                style={{background:"none",border:"none",fontSize:11,fontWeight:600,color:"#94a3b8",cursor:"pointer",whiteSpace:"nowrap",padding:0}}>Lihat →</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setOpen(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah WO"}</Btn>
          </div>
        </Card>
      )}
      {quickGenModal&&(
        <Modal title={"⏱ Generate ke Raw Schedule — WO "+quickGenModal.wo} onClose={()=>{setQuickGenModal(null);setQuickGenResult(null);}} width={420}>
          {!quickGenResult?(
            <div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>Sistem bakal otomatis jadwalin semua komponen aktif dari panel yang dipilih di bawah, distribusi ngikutin kapasitas harian, langsung masuk ke Raw Schedule.</div>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Pilih Panel ({quickGenSelectedPanelIds.length}/{(quickGenModal.panels||[]).length})</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setQuickGenSelectedPanelIds((quickGenModal.panels||[]).map((p:any)=>p.id))}
                      style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                    <button onClick={()=>setQuickGenSelectedPanelIds([])}
                      style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                  </div>
                </div>
                <div style={{maxHeight:140,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:8}}>
                  {(quickGenModal.panels||[]).map((p:any)=>{
                    const checked=quickGenSelectedPanelIds.includes(p.id);
                    return(
                      <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 6px",cursor:"pointer",borderRadius:6,background:checked?"#eff6ff":"transparent"}}>
                        <input type="checkbox" checked={checked}
                          onChange={()=>setQuickGenSelectedPanelIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                        <span style={{fontSize:12,color:"#1e293b"}}>{p.nama}</span>
                        <span style={{fontSize:10,color:"#94a3b8"}}>({p.tipe})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <Lbl>Tanggal Mulai</Lbl>
                <Inp type="date" value={quickGenTanggal} onChange={(e:any)=>setQuickGenTanggal(e.target.value)}/>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <Btn outline color="#64748b" onClick={()=>setQuickGenModal(null)}>Batal</Btn>
<Btn color="#16a34a" disabled={quickGenSelectedPanelIds.length===0} onClick={async()=>{
                  setQuickGenLoading(true);
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  let res=await generateAndSaveToRawSchedule(quickGenModal.id,quickGenTanggal,uname,quickGenSelectedPanelIds);
                  if(!res.success&&res.error==="__ALREADY_EXISTS__"){
                    const lanjut=confirm("Panel yang dipilih UDAH punya jadwal di Raw Schedule.\n\nGenerate ulang bakal SKIP TOTAL komponen yang udah pernah dijadwalkan (gak diapa-apain lagi, gak ditambah gak diubah) - cuma komponen yang BENAR-BENAR belum pernah ada di jadwal yang bakal diisi.\n\nYakin mau lanjut?");
                    if(lanjut){
                      res=await generateAndSaveToRawSchedule(quickGenModal.id,quickGenTanggal,"__force__"+uname,quickGenSelectedPanelIds);
                    } else {
                      setQuickGenLoading(false);
                      return;
                    }
                  }
                  setQuickGenResult(res);
                  setQuickGenLoading(false);
                  if(res.success){
                    // FIX (5 Agu 2026): generateAndSaveToRawSchedule gak pernah nulis activity_log
                    // sendiri - aksi bulk-generate (apalagi __force__, yang bisa nyentuh panel yang
                    // udah lama terjadwal) jadi gak kelihatan di histori manapun. Root cause laporan
                    // "SDP-PASTEURIZER tiba-tiba jadwal full lagi" cuma ketauan dari createdAt di
                    // dalam data schedule-nya sendiri, bukan dari Activity Log.
                    const namaPanel=(quickGenModal.panels||[]).filter((p:any)=>quickGenSelectedPanelIds.includes(p.id)).map((p:any)=>p.nama).join(', ');
                    await activityLogService.insert({
                      user_name:uname,action:'GENERATE JADWAL FCS',
                      description:'Generate jadwal Raw Schedule WO '+quickGenModal.wo+' - '+quickGenModal.proyek+' ('+quickGenSelectedPanelIds.length+' panel: '+namaPanel+'), mulai '+quickGenTanggal+', '+res.count+' baris dibuat',
                      module:'wo',halaman:'Manajemen WO',proyek:quickGenModal.proyek||'',wo_number:quickGenModal.wo||'',
                    });
                    if(refetchWO)await refetchWO();
                  }
                }}>{quickGenLoading?"⏳ Generating...":quickGenSelectedPanelIds.length===0?"Pilih panel dulu":"Generate → ("+quickGenSelectedPanelIds.length+" panel)"}</Btn>
              </div>
            </div>
          ):(
            <div style={{textAlign:"center" as const,padding:"20px 0"}}>
              {quickGenResult.success?(
                <div>
                  <div style={{fontSize:40,marginBottom:12}}>✅</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#16a34a",marginBottom:8}}>Berhasil!</div>
                  <div style={{fontSize:13,color:"#64748b"}}>{quickGenResult.count} jadwal dibuat di Raw Schedule</div>
                </div>
              ):(
                <div>
                  <div style={{fontSize:40,marginBottom:12}}>❌</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#dc2626",marginBottom:8}}>Gagal</div>
                  <div style={{fontSize:13,color:"#64748b"}}>{quickGenResult.error}</div>
                </div>
              )}
              <div style={{marginTop:16}}>
                <Btn color="#1d4ed8" onClick={()=>{setQuickGenModal(null);setQuickGenResult(null);}}>Tutup</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}

      {fcsModal&&(
        <Modal title={"⏱ Generate FCS — WO "+fcsModal.wo} onClose={()=>{setFcsModal(null);setFcsResult(null);setSelectedKomponen([]);setPanelBobot({});}} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
            <strong>{fcsModal.proyek}</strong> · {(fcsModal.panels||[]).length} panel · Target: {fcsModal.target}
          </div>
          {!fcsResult?(
            <div>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Pilih Panel ({selectedPanelIds.length}/{(fcsModal.panels||[]).length})</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setSelectedPanelIds((fcsModal.panels||[]).map((p:any)=>p.id))}
                      style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                    <button onClick={()=>setSelectedPanelIds([])}
                      style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                  </div>
                </div>
                <div style={{maxHeight:140,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:8}}>
                  {(fcsModal.panels||[]).map((p:any)=>{
                    const checked=selectedPanelIds.includes(p.id);
                    return(
                      <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 6px",cursor:"pointer",borderRadius:6,background:checked?"#eff6ff":"transparent"}}>
                        <input type="checkbox" checked={checked}
                          onChange={()=>setSelectedPanelIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                        <span style={{fontSize:12,color:"#1e293b"}}>{p.nama}</span>
                        <span style={{fontSize:10,color:"#94a3b8"}}>({p.tipe})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{marginBottom:14,padding:"10px 14px",background:"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe"}}>
                <div style={{fontSize:12,color:"#1d4ed8",fontWeight:600}}>⚡ Semua proses relevan akan digenerate otomatis sesuai komponen tiap panel</div>
              </div>
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
                ⚠️ Schedule lama status Planning untuk WO ini akan digantikan jadwal baru.
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setFcsModal(null)}
                  style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button disabled={fcsLoading||selectedPanelIds.length===0} onClick={async()=>{
                  setFcsLoading(true);
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  const panels=(fcsModal.panels||[]).filter((p:any)=>selectedPanelIds.includes(p.id));
                  let totalCount=0;const errors:string[]=[];
                  for(const panel of panels){
                    const cl=panel.checklist||{};
                    const prosesSet=new Set<string>();
                    Object.entries(cl).forEach(([kode,clVal]:any)=>{
                      if((clVal?.qty||0)<=0)return;
                      getRelevantProsesForKode(kode,panel.tipe).forEach((pr:string)=>prosesSet.add(pr));
                    });
                    const cfgWpMap=getEffectiveCfg(panel.tipe);
                    const kodeToWpMap:Record<string,string>={};
                    if(cfgWpMap){
                      cfgWpMap.wps.forEach((w:any)=>{
                        w.items.forEach((it:any)=>{kodeToWpMap[it.kode]=w.wp;});
                      });
                    }
                    for(const proses of prosesSet){
                      if(WIRING_PROSES.includes(proses)){
                        const relevantWps=new Set<string>();
                        Object.entries(cl).forEach(([kode,clVal]:any)=>{
                          if((clVal?.qty||0)<=0)return;
                          if(!isKomponenRelevant(kode,panel.tipe,proses))return;
                          const wpFound=kodeToWpMap[kode];
                          if(wpFound)relevantWps.add(wpFound);
                        });
                        if(relevantWps.size===0)relevantWps.add("WP1");
                        for(const wpTarget of relevantWps){
                          const resWp=await generateFCSWiring({
                            woId:fcsModal.id,woNumber:fcsModal.wo,proyek:fcsModal.proyek,
                            panelId:panel.id,panelNama:panel.nama,tipePanel:panel.tipe,
                            jenisPekerjaan:proses,
                            wp:wpTarget,
                            tanggalMulai:fcsForm.tanggalMulai,
                            generatedBy:uname,
                          });
                          if(resWp.success)totalCount+=resWp.count;
                          else errors.push(panel.nama+" ("+proses+" "+wpTarget+"): "+(resWp.error||"Error"));
                        }
                      } else {
                        const res=await generateFCSSchedule({
                          woId:fcsModal.id,woNumber:fcsModal.wo,proyek:fcsModal.proyek,
                          panelId:panel.id,panelNama:panel.nama,tipePanel:panel.tipe,
                          checklist:panel.checklist||{},
                          jenisPekerjaan:proses,
                          tanggalMulai:fcsForm.tanggalMulai,
                          generatedBy:uname,
                          selectedKomponen:null,
                        });
                        if(res.success)totalCount+=res.count;
                        else errors.push(panel.nama+" ("+proses+"): "+(res.error||"Error"));
                      }
                    }
                  }
                  if(totalCount>0&&refetchWO)await refetchWO();
                  setFcsResult({totalCount,errors,panels:panels.length});
                  setFcsLoading(false);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:(fcsLoading||selectedPanelIds.length===0)?"#94a3b8":"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:(fcsLoading||selectedPanelIds.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {fcsLoading?"Generating...":selectedPanelIds.length===0?"Pilih panel dulu":"⏱ Generate Schedule ("+selectedPanelIds.length+" panel)"}
                </button>
              </div>
            </div>
          ):(
            <div>
              {fcsResult.errors.length===0?(
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:40,marginBottom:12}}>✅</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#16a34a",marginBottom:8}}>Schedule Berhasil!</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:4}}>{fcsResult.panels} panel · {fcsResult.totalCount} baris jadwal</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>Mulai: <strong>{fcsForm.tanggalMulai}</strong></div>
                </div>
              ):(
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b",marginBottom:8}}>{fcsResult.totalCount} jadwal berhasil, {fcsResult.errors.length} error:</div>
                  {fcsResult.errors.map((e:string,i:number)=>(
                    <div key={i} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"8px 12px",marginBottom:6,fontSize:12,color:"#dc2626"}}>{e}</div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
                <button onClick={()=>{setFcsModal(null);setFcsResult(null);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Tutup</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );

}
