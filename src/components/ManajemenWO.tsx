import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { workOrderService } from '../services/workOrderService'
import { generateFCSSchedule, generateFCSWiring, generateAndSaveToRawSchedule } from '../services/fcsService'
import { PANEL_TYPES, ALL_PROSES } from '../constants/panelTypes'
import { buildPanelTypesFromBom, initChecklist, isKomponenRelevant, getRelevantProsesForKode, woOverall, panelOverall } from '../lib/panelHelpers'
import { getLocalDateStr, daysUntil, isDelayed, getStatus, pColor } from '../lib/dateHelpers'
import { setGlobalDirtyPanelIds } from '../lib/globalState'
import { Card, Btn, STitle, Badge, PBar, Modal, Lbl, Inp, Sel } from './ui/Primitives'

export function ManajemenWO({woData,setWoData,createWO,updateWO,removeWO,logActivity,logAct,log,user,refetchWO}:any){
  const [bomPanelTypesCache,setBomPanelTypesCache]=useState<any>(null);
  useEffect(()=>{
    Promise.all([
      supabase.from("bom_master").select("*"),
      supabase.from("panel_type_meta").select("*"),
      supabase.from("panel_wp_meta").select("*"),
    ]).then(([bomRes,typeMetaRes,wpMetaRes]:any)=>{
      if(bomRes.data&&bomRes.data.length>0){
        setBomPanelTypesCache(buildPanelTypesFromBom(bomRes.data,typeMetaRes.data,wpMetaRes.data));
      }
    });
  },[]);
  const getEffectiveCfg=(tipe:string)=>(bomPanelTypesCache?.[tipe]?.wps?.length>0)?bomPanelTypesCache[tipe]:(PANEL_TYPES as any)[tipe];
  const effectivePanelTypes=(bomPanelTypesCache&&Object.keys(bomPanelTypesCache).length>0)?bomPanelTypesCache:PANEL_TYPES;
  const [selectedQtyCells,setSelectedQtyCells]=useState<{panelId:number;kodes:string[]}|null>(null);
  const [qtyAnchor,setQtyAnchor]=useState<{panelId:number;kode:string}|null>(null);
  const blank={wo:"",proyek:"",target:""};
  const blankPanel={noPnl:"1",nama:"",tipe:"FS",qty:1,tingkatKesulitan:"EASY"};
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
  const [arsipModal,setArsipModal]=useState<any>(null);
  const [arsipLoading,setArsipLoading]=useState(false);

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

  const buildNp=(list:any[])=>list.filter(p=>p.nama).map((p,i)=>{
    if((p as any).id){
      const newQty=Number(p.qty)||1;
      const origQty=(p as any)._origQty!==undefined?Number((p as any)._origQty)||1:newQty;
      let finalChecklist=(p as any).checklist||initChecklist(p.tipe,newQty);
      if(origQty!==newQty&&origQty>0&&(p as any).checklist){
        const ratio=newQty/origQty;
        const scaledChecklist:any={};
        Object.entries(finalChecklist).forEach(([kode,cl]:any)=>{
          scaledChecklist[kode]={...cl,qty:Math.round((cl.qty||0)*ratio)};
        });
        finalChecklist=scaledChecklist;
      }
      return{
        id:(p as any).id,noPnl:Number(p.noPnl)||i+1,nama:p.nama,tipe:p.tipe,qty:newQty,
        checklist:finalChecklist,
        catatan:(p as any).catatan||"",
        tingkatKesulitan:(p as any).tingkatKesulitan||"EASY",
      };
    }
    return{
      noPnl:Number(p.noPnl)||i+1,nama:p.nama,tipe:p.tipe,qty:Number(p.qty)||1,
      checklist:initChecklist(p.tipe,Number(p.qty)||1,bomPanelTypesCache),catatan:"",
      tingkatKesulitan:(p as any).tingkatKesulitan||"EASY",
    };
  });

  const save=async()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    if(editId){
      const result=await updateWO(editId,{wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        const groups:Record<string,any[]>={};
        panels.filter(p=>p.nama).forEach(p=>{
          const tgl=(p as any).tanggal||form.target;
          if(!groups[tgl])groups[tgl]=[];
          groups[tgl].push(p);
        });
        const groupedPanels=Object.keys(groups).map(tgl=>({tanggal:tgl,panels:buildNp(groups[tgl])}));
        await workOrderService.saveWOWithSplit(editId,form.wo,form.proyek,form.target,groupedPanels,uname);
        if(refetchWO)await refetchWO();
        if(log) await log("EDIT WO","Edit WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"update",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
      }
    } else {
      const np=buildNp(panels);
      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        const{data:freshPanels}=await supabase.from("panels").select("*").eq("wo_id",result.data.id).order("no_pnl",{ascending:true});
        const newWo={...result.data,panels:freshPanels??np};
        setWoData(prev=>{
          if(prev.some(w=>w.id===result.data.id)){
            return prev.map(w=>w.id===result.data.id?newWo:w);
          }
          return [...prev,newWo];
        });
        if(log) await log("TAMBAH WO","Tambah WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"create",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
      }
    }
    setOpen(false);
  };
  const [dirtyQty,setDirtyQty]=useState<Record<string,Record<string,{newQty:number,oldQty:number}>>>({});
  useEffect(()=>{
    setGlobalDirtyPanelIds(new Set(Object.keys(dirtyQty).filter(pid=>Object.keys(dirtyQty[pid]||{}).length>0)));
  },[dirtyQty]);
  const [origChecklist,setOrigChecklist]=useState<Record<string,any>>({});

  const handleQtyCellClick=(panelId:number,kode:string,flatKodes:string[],shiftKey:boolean)=>{
    if(shiftKey&&qtyAnchor&&qtyAnchor.panelId===panelId){
      const startIdx=flatKodes.indexOf(qtyAnchor.kode);
      const endIdx=flatKodes.indexOf(kode);
      if(startIdx===-1||endIdx===-1)return;
      const lo=Math.min(startIdx,endIdx);
      const hi=Math.max(startIdx,endIdx);
      setSelectedQtyCells({panelId,kodes:flatKodes.slice(lo,hi+1)});
    } else {
      setQtyAnchor({panelId,kode});
      setSelectedQtyCells({panelId,kodes:[kode]});
    }
  };

  const handleQtyCopy=(woId:number,panelId:number,e:any)=>{
    if(!selectedQtyCells||selectedQtyCells.panelId!==panelId||selectedQtyCells.kodes.length<=1)return;
    const wo=woData.find((w:any)=>w.id===woId);
    const panel=wo?.panels?.find((p:any)=>p.id===panelId);
    if(!panel)return;
    const values=selectedQtyCells.kodes.map(kode=>panel.checklist?.[kode]?.qty??0);
    e.clipboardData.setData("text/plain",values.join("\n"));
    e.preventDefault();
  };

  const handleQtyPasteMulti=(woId:number,panelId:number,e:any)=>{
    if(!selectedQtyCells||selectedQtyCells.panelId!==panelId||selectedQtyCells.kodes.length<=1)return;
    const text=e.clipboardData.getData("text");
    const values=text.split(/\r?\n|\t/).map((v:string)=>v.trim()).filter((v:string)=>v!=="");
    if(values.length===0)return;
    e.preventDefault();
    selectedQtyCells.kodes.forEach((kode,idx)=>{
      const val=values.length===1?values[0]:values[idx];
      if(val===undefined)return;
      updateItemQty(woId,panelId,kode,parseFloat(val)||0);
    });
  };

  const updateItemQty=(woId,panelId,kode,qty)=>{
    const nq=Number(qty)||0;
    setOrigChecklist(prev=>{
      if(prev[String(panelId)])return prev;
      const panel=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
      return{...prev,[String(panelId)]:JSON.parse(JSON.stringify(panel?.checklist||{}))};
    });
    setDirtyQty(prev=>{
      const panel=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
      const oldQty=panel?.checklist?.[kode]?.qty??0;
      return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};
    });
    setWoData(prev=>prev.map(wo=>wo.id!==woId?wo:{...wo,panels:wo.panels.map(p=>{
      if(p.id!==panelId)return p;
      const nq2=Number(qty)||0;
      const oldQty2=p.checklist[kode]?.qty||1;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq2}};
      if(nq2===0){
        // qty 0 → reset semua progress
        nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
        nc[kode].progressByDate=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:{}}),{});
        nc[kode].history=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:[]}),{});
      } else if(nq2!==oldQty2 && oldQty2>0){
        // qty berubah → recalculate progress proporsional
        const ratio=oldQty2/nq2;
        const newProgress:any={};
        const newHistory:any={...(nc[kode].history||{})};
        ALL_PROSES.forEach(pr=>{
          const oldPct=nc[kode].progress?.[pr]||0;
          const newPct=Math.min(100,Math.round(oldPct*ratio));
          newProgress[pr]=newPct;
          // Update entry terakhir di history jika ada
          if(newHistory[pr]&&newHistory[pr].length>0){
            const lastIdx=newHistory[pr].length-1;
            newHistory[pr]=[...newHistory[pr]];
            newHistory[pr][lastIdx]={
              ...newHistory[pr][lastIdx],
              pct:newPct,
              ts:new Date().toISOString()
            };
          }
        });
        nc[kode].progress=newProgress;
        nc[kode].history=newHistory;
      }
      return{...p,checklist:nc};
    })}));
  };

  const cancelQtyEdit=(panelId)=>{
    const orig=origChecklist[panelId];
    if(!orig)return;
    setWoData(prev=>prev.map(wo=>({...wo,panels:wo.panels.map(p=>p.id!==panelId?p:{...p,checklist:orig})})));
    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});
  };

  const saveQtyEdit=async(woArg,panelId)=>{
    // ambil data terbaru dari woData state
    const currentWo=woData.find(w=>w.panels?.some((p:any)=>String(p.id)===String(panelId)))||woArg;
    const panel=currentWo?.panels?.find((p:any)=>String(p.id)===String(panelId));
    if(!panel){alert('Panel tidak ditemukan!');return;}
    const dirty=dirtyQty[String(panelId)]||{};
    const panelQtyMultiplier=Number(panel.qty)||1;
    const finalChecklist={...panel.checklist};
    if(panelQtyMultiplier>1){
      Object.keys(dirty).forEach(kode=>{
        const dirtyEntry=(dirty as any)[kode];
        if(dirtyEntry.newQty!==dirtyEntry.oldQty&&finalChecklist[kode]){
          finalChecklist[kode]={...finalChecklist[kode],qty:Math.round(Number(dirtyEntry.newQty)*panelQtyMultiplier)};
        }
      });
    }
    const{error}=await supabase.from('panels').update({checklist:finalChecklist}).eq('id',panel.id);
    if(error){alert('Gagal menyimpan: '+error.message);return;}
    setWoData(prev=>prev.map(w=>w.id!==currentWo.id?w:{...w,panels:w.panels.map((p:any)=>p.id===panel.id?{...p,checklist:finalChecklist}:p)}));
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
    const uname=user?.name||user?.nama||sess?.nama||'Admin';
    const qtyChangeLogRows:any[]=[];
    const changes=Object.entries(dirty)
      .filter(([,v])=>(v as any).newQty!==(v as any).oldQty)
      .map(([kode,v])=>{
        const cfg=getEffectiveCfg(panel.tipe);
        const wpFound=cfg?.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
        const nama=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
        const finalVal=panelQtyMultiplier>1?Math.round(Number((v as any).newQty)*panelQtyMultiplier):(v as any).newQty;
        qtyChangeLogRows.push({
          wo_id:currentWo.id,panel_id:panel.id,proyek:currentWo.proyek||'',panel:panel.nama||'',tipe_panel:panel.tipe||'',
          wp:wpFound?.wp||'',kode_komponen:kode,nama_komponen:nama,
          qty_lama:(v as any).oldQty,qty_baru:finalVal,changed_by:uname,
        });
        return nama+': '+(v as any).oldQty+' -> '+finalVal;
      });
    if(qtyChangeLogRows.length>0){
      await supabase.from('qty_change_log').insert(qtyChangeLogRows);
    }
    const tgl=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    await activityLogService.insert({
      user_name:uname,
      action:'EDIT QTY',
      description:'['+tgl+'] Edit Qty '+panel.nama+' ('+currentWo.proyek+'): '+changes.join(', '),
      module:'wo',
      halaman:'Manajemen WO',
      proyek:currentWo.proyek||'',
      panel:panel.nama||'',
      wo_number:currentWo.wo||'',
    });
    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    alert('Qty berhasil disimpan!');
  };

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
          <Card key={wo.id} style={{marginBottom:12,borderLeft:`3px solid ${st.color}`,padding:0,overflow:"hidden"}}>
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
                <button onClick={()=>{setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels((wo.panels||[]).map(p=>({id:p.id,noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty,checklist:p.checklist,catatan:p.catatan,tingkatKesulitan:(p as any).tingkatKesulitan||(p as any).tingkat_kesulitan||"EASY",tanggal:wo.target,_origQty:p.qty} as any)));setEditId(wo.id);setOpen(true);}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                <button onClick={()=>{setQuickGenModal(wo);setQuickGenTanggal(new Date().toISOString().slice(0,10));setQuickGenResult(null);setQuickGenSelectedPanelIds((wo.panels||[]).map((p:any)=>p.id));}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:12,fontWeight:600}}>⏱ FCS</button>
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
                        <span style={{fontWeight:700,color:"#475569",fontSize:12}}>#{p.noPnl}</span>
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
                                      onChange={e=>updateItemQty(wo.id,p.id,item.kode,e.target.value)}
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
                                        handleQtyCellClick(p.id,item.kode,flatKodes,e.shiftKey);
                                      }}
                                      onCopy={e=>handleQtyCopy(wo.id,p.id,e)}
                                      onPaste={e=>{
                                        if(selectedQtyCells&&selectedQtyCells.panelId===p.id&&selectedQtyCells.kodes.length>1&&selectedQtyCells.kodes.includes(item.kode)){
                                          handleQtyPasteMulti(wo.id,p.id,e);
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
                                          updateItemQty(wo.id,p.id,target.kode,numVal);
                                        });
                                      }}
                                      style={{width:56,padding:"4px 6px",borderRadius:6,
                                        border:selectedQtyCells&&selectedQtyCells.panelId===p.id&&selectedQtyCells.kodes.includes(item.kode)?"1.5px solid #2563eb":`1.5px solid ${isLocked?"#fecaca":"#e2e8f0"}`,
                                        background:selectedQtyCells&&selectedQtyCells.panelId===p.id&&selectedQtyCells.kodes.includes(item.kode)?"#eff6ff":isLocked?"#fef2f2":"#fff",fontSize:12,textAlign:"center",
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
                      <button onClick={()=>saveQtyEdit(wo,String(p.id))}
                        style={{padding:"8px 24px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #2563eb33"}}>
                        Simpan Perubahan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
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
  const woToDelete=woData.find(w=>w.id===delId);
  // 1. Ambil panel ids
  const panelIds=(woToDelete?.panels||[]).map((p:any)=>p.id);
  // 2. Hapus data turunan yang nempel ke panel_id (bukan wo_id langsung)
  if(panelIds.length>0){
    await supabase.from('fcs_timer_kerja').delete().in('panel_id',panelIds);
    await supabase.from('progress_checkpoint_log').delete().in('panel_id',panelIds);
    await supabase.from('kendala').delete().in('panel_id',panelIds);
  }
  // 3. Hapus renhar terkait wo
  await supabase.from('renhar').delete().eq('wo_id',delId);
  // 4. Hapus raw_schedule terkait wo
  await supabase.from('raw_schedule').delete().eq('wo_id',delId);
  // 4b. Hapus fcs_schedule terkait wo
  await supabase.from('fcs_schedule').delete().eq('wo_id',delId);
  // 5. Hapus panels terkait wo
  await supabase.from('panels').delete().eq('wo_id',delId);
  // 6. Hapus work order
  await supabase.from('work_orders').delete().eq('id',delId);
  // 7. Activity log
  await activityLogService.insert({
    user_name:uname,
    action:'HAPUS WO',
    description:'Hapus WO '+woToDelete?.wo+' - '+woToDelete?.proyek+' beserta semua data terkait',
    module:'wo',
    halaman:'Manajemen WO',
    proyek:woToDelete?.proyek||'',
    wo_number:woToDelete?.wo||'',
  });
  // 8. Update local state
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
            <div><Lbl>Target Tanggal</Lbl><Inp type="date" value={form.target} onChange={e=>setForm({...form,target:e.target.value})}/></div>
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
                <div><Lbl>Kesulitan</Lbl>
                  <Sel value={(p as any).tingkatKesulitan||"EASY"} onChange={e=>{const n=[...panels];n[i]={...n[i],tingkatKesulitan:e.target.value} as any;setPanels(n);}}>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                    <option value="VERY_HARD">Very Hard</option>
                  </Sel>
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
                    const lanjut=confirm("Panel yang dipilih UDAH punya jadwal di Raw Schedule.\n\nGenerate ulang bakal SKIP komponen yang udah lengkap terjadwal, dan cuma nambahin kekurangannya aja (top-up) - jadwal yang udah ada gak bakal dobel.\n\nYakin mau lanjut?");
                    if(lanjut){
                      res=await generateAndSaveToRawSchedule(quickGenModal.id,quickGenTanggal,"__force__"+uname,quickGenSelectedPanelIds);
                    } else {
                      setQuickGenLoading(false);
                      return;
                    }
                  }
                  setQuickGenResult(res);
                  setQuickGenLoading(false);
                  if(res.success&&refetchWO)await refetchWO();
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
