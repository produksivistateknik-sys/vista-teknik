import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { checkKapasitasDanKomponenSwapV2, executeSwapKomponenV2, checkKuotaOrangDanKomponenSwap, executeSwapKomponenOrang, setOverrideAndRebalance } from '../services/fcsService'
import {
  PANEL_TYPES, ALL_PROSES, WP_LIST, PRIORITAS, PROSES_COLOR, WP_COLOR, PRIORITAS_COLOR,
  DIVISI_PROSES, BUSBAR_COLORS, DIVISI_CONFIG, PROSES_ORANG_RAW_GLOBAL,
} from '../constants/panelTypes'
import { isKomponenRelevant, getBusbarKomponen, getRelevantProsesForKode } from '../lib/panelHelpers'
import { TODAY, addDays, fmtDate, getDayLabel, fmtDateFull } from '../lib/dateHelpers'
import { Modal, Card, Badge, Lbl, Btn, Inp, Sel } from './ui/Primitives'

export function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,refetchRenhar,logActivity,logAct,log,user,livePanelTypes}:any){
  const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);
  const [cellModal,setCellModal]=useState(null);
  const [riwayatOpen,setRiwayatOpen]=useState(false);
  const [qtyChangeLog,setQtyChangeLog]=useState<any[]>([]);
  const [qtyChangeUnread,setQtyChangeUnread]=useState(0);
  const fetchQtyChangeLog=async()=>{
    const{data}=await supabase.from("qty_change_log").select("*").order("created_at",{ascending:false}).limit(100);
    setQtyChangeLog(data||[]);
    setQtyChangeUnread((data||[]).filter((d:any)=>!d.is_read).length);
  };
  useEffect(()=>{fetchQtyChangeLog();},[]);
  const openRiwayat=()=>{
    setRiwayatOpen(true);
  };
  const confirmQtyChange=async(id:number)=>{
    await supabase.from("qty_change_log").update({is_read:true}).eq("id",id);
    setQtyChangeLog(prev=>prev.map(d=>d.id===id?{...d,is_read:true}:d));
    setQtyChangeUnread(prev=>Math.max(0,prev-1));
  };
  const [moveKomponenState,setMoveKomponenState]=useState<any>(null);
  const [selectedForMove,setSelectedForMove]=useState<{wp:string;kode:string}[]>([]);
  const toggleSelectForMove=(wp:string,kode:string)=>{
    setSelectedForMove(prev=>{
      const exists=prev.some(x=>x.wp===wp&&x.kode===kode);
      return exists?prev.filter(x=>!(x.wp===wp&&x.kode===kode)):[...prev,{wp,kode}];
    });
  };
  const executeMoveKomponen=async(rawId:number,fromDate:string,toDate:string,items:{wp:string;kode:string}[])=>{
    const row=rawData.find((r:any)=>r.id===rawId);
    if(!row)return;
    const schedule={...(row.schedule||{})};
    let fromEntries=schedule[fromDate]||[];
    for(const{wp,kode}of items){
      fromEntries=fromEntries.map((e:any)=>e.wp===wp?{...e,komponen:e.komponen.filter((k:string)=>k!==kode)}:e);
    }
    fromEntries=fromEntries.filter((e:any)=>e.komponen.length>0);
    schedule[fromDate]=fromEntries;
    let toEntries=schedule[toDate]||[];
    for(const{wp,kode}of items){
      const existingEntry=toEntries.find((e:any)=>e.wp===wp);
      if(existingEntry){
        if(!existingEntry.komponen.includes(kode))existingEntry.komponen=[...existingEntry.komponen,kode];
        toEntries=toEntries.map((e:any)=>e.wp===wp?existingEntry:e);
      } else {
        toEntries=[...toEntries,{wp,komponen:[kode]}];
      }
    }
    schedule[toDate]=toEntries;
    setRawData((prev:any[])=>prev.map(r=>r.id===rawId?{...r,schedule}:r));
    await supabase.from("raw_schedule").update({schedule}).eq("id",rawId);
    setMoveKomponenState(null);
    setSelectedForMove([]);
  };
  const [dragInfo,setDragInfo]=useState(null);
  const [dragOverCell,setDragOverCell]=useState(null);
  const [dragMode,setDragMode]=useState(null);
  const [addModal,setAddModal]=useState(false);
  const [selDate,setSelDate]=useState(null);
  const [addForm,setAddForm]=useState<{woId:string;panelIds:number[];prioritas:string}>({woId:"",panelIds:[],prioritas:"Sedang"});
  const [modalWp,setModalWp]=useState("");
  const [modalKomponen,setModalKomponen]=useState([]);
  const [modalOrangPerKomponen,setModalOrangPerKomponen]=useState<Record<string,number>>({});
  const [bobotCepat,setBobotCepat]=useState<string>("");
  const [jumlahOrangBobot,setJumlahOrangBobot]=useState(1);
  const BOBOT_HARI_MAP:Record<string,number>={EASY:1,MEDIUM:2,HARD:4,VERY_HARD:6};
  const BOBOT_LABEL_MAP:Record<string,string>={EASY:"Easy",MEDIUM:"Medium",HARD:"Hard",VERY_HARD:"Very Hard"};
  const BOBOT_COLOR_MAP:Record<string,string>={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
  const totalHariBobot=bobotCepat?Math.ceil((BOBOT_HARI_MAP[bobotCepat]||1)/(jumlahOrangBobot||1)):0;
  const PROSES_ORANG_RAW=["WIRING POWER","WIRING CONTROL"];

  const renderKotakWiring=(komp:any,tanggal:string,rowId:number,panelId:number)=>{
    const aktif=tanggal>=komp.mulai&&tanggal<=komp.selesai;
    const isTerlambat=komp.terlambat&&tanggal===komp.selesai;
    const wc=isTerlambat?"#dc2626":WP_COLOR[komp.wp]||"#64748b";
    const namaKomp=getNamaKomponenDariKode(panelId,komp.kode);
    return(
      <td key={tanggal} onClick={(e:any)=>{e.stopPropagation();handleCellClick(rowId,tanggal,e);}}
        style={{borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",padding:"1px",textAlign:"center" as const,cursor:"pointer",background:tanggal===TODAY?"#eff6ff":isSunday(tanggal)?"#fff1f2":"#fff",height:22}}>
        {aktif?(
          <div style={{display:"inline-flex",alignItems:"center",gap:3,background:wc+"22",color:wc,border:`1px solid ${wc}44`,borderRadius:4,padding:"1px 5px",maxWidth:"100%"}}>
            {isTerlambat&&<i className="ti ti-clock-exclamation" style={{fontSize:8}}/>}
            <span style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:55}}>{namaKomp}</span>
            <span style={{fontSize:7,display:"flex",alignItems:"center",gap:1}}><i className="ti ti-users" style={{fontSize:7}}/>{komp.jumlahOrang}</span>
          </div>
        ):(
          <span style={{color:"#e2e8f0",fontSize:14}}>+</span>
        )}
      </td>
    );
  };

  const getSemuaKomponenSebagaiSubBaris=(row:any):any[]|null=>{
    if(!PROSES_ORANG_RAW.includes(row.proses))return null;
    const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(row.panel_id||row.panelId));
    const semuaKomponen:any[]=[];
    for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
      for(const entry of entries){
        for(const kode of entry.komponen||[]){
          const sudahAda=semuaKomponen.some(k=>k.wp===entry.wp&&k.kode===kode);
          if(sudahAda)continue;
          const rentang=entry.rentangTanggal?.[kode];
          const jmlOrang=entry.orangPerKomponen?.[kode]||1;
          const progress=panelData?.checklist?.[kode]?.progress?.[row.proses]||0;
          const terlambat=rentang?.selesai&&TODAY>rentang.selesai&&progress<100;
          semuaKomponen.push({wp:entry.wp,kode,mulai:rentang?.mulai||tglKey,selesai:rentang?.selesai||tglKey,jumlahOrang:jmlOrang,progress,terlambat});
        }
      }
    }
    if(semuaKomponen.length===0)return null;
    semuaKomponen.sort((a,b)=>a.mulai.localeCompare(b.mulai)||a.wp.localeCompare(b.wp));
    return semuaKomponen;
  };

  const getRentangInfoUntukTanggal=(row:any,tanggal:string)=>{
    if(!PROSES_ORANG_RAW.includes(row.proses))return null;
    // Cari SEMUA komponen (lintas WP) yang rentangnya mencakup tanggal ini
    const semuaKomponenAktif:any[]=[];
    for(const entries of Object.values(row.schedule||{}) as any[]){
      for(const entry of entries){
        if(!entry.rentangTanggal)continue;
        for(const kode of entry.komponen||[]){
          const rentang=entry.rentangTanggal[kode];
          if(!rentang)continue;
          if(tanggal>=rentang.mulai&&tanggal<=rentang.selesai){
            semuaKomponenAktif.push({wp:entry.wp,kode,mulai:rentang.mulai,selesai:rentang.selesai});
          }
        }
      }
    }
    if(semuaKomponenAktif.length===0)return null;
    // Union: cari mulai paling awal dan selesai paling akhir dari SEMUA komponen yg overlap di tanggal ini
    const unionMulai=semuaKomponenAktif.reduce((min,k)=>k.mulai<min?k.mulai:min,semuaKomponenAktif[0].mulai);
    const unionSelesai=semuaKomponenAktif.reduce((max,k)=>k.selesai>max?k.selesai:max,semuaKomponenAktif[0].selesai);
    return{mulai:unionMulai,selesai:unionSelesai,isStart:tanggal===unionMulai,komponenList:semuaKomponenAktif};
  };
  const [filterProses,setFilterProses]=useState<string[]>([]);
  const toggleFilterProses=(pr:string)=>{
    setFilterProses(prev=>prev.includes(pr)?prev.filter(p=>p!==pr):[...prev,pr]);
  };
  const [filterProyek,setFilterProyek]=useState<string[]>([]);
  const [proyekDropdownOpen,setProyekDropdownOpen]=useState(false);
  const toggleFilterProyek=(p:string)=>{
    setFilterProyek(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);
    setFilterPanel("ALL");
  };
  const [filterPanel,setFilterPanel]=useState("ALL");
  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);
  const [swapModal,setSwapModal]=useState<any>(null);
  const [swapSelected,setSwapSelected]=useState<string[]>([]);
  const [swapExpandedPanel,setSwapExpandedPanel]=useState<Record<string,boolean>>({});
  const [swapLoading,setSwapLoading]=useState(false);
  const [swapOrangModal,setSwapOrangModal]=useState<any>(null);
  const [swapOrangSelected,setSwapOrangSelected]=useState<string[]>([]);
  const [swapOrangExpandedPanel,setSwapOrangExpandedPanel]=useState<Record<string,boolean>>({});
  const [capacityCollapsed,setCapacityCollapsed]=useState(false);
  const [overrideModal,setOverrideModal]=useState<{tanggalMulai:string,tanggalAkhir:string,proses:string[]}|null>(null);
  const [overrideValue,setOverrideValue]=useState("");
  const [overrideJamKerja,setOverrideJamKerja]=useState("8");
  const [overrideEfektivitas,setOverrideEfektivitas]=useState("80");
  const [overrideSaving,setOverrideSaving]=useState(false);
  const [overrideResult,setOverrideResult]=useState<any>(null);
  const [overrideProgress,setOverrideProgress]=useState("");
  const [swapOrangLoading,setSwapOrangLoading]=useState(false);
  const [lemburLoading,setLemburLoading]=useState(false);
  const [processTimeList,setProcessTimeList]=useState<any[]>([]);
  const [notifAvailable,setNotifAvailable]=useState<any[]>([]);

  const fetchNotifAvailable=async()=>{
    const{data}=await supabase.from("fcs_notifikasi").select("*").eq("dibaca",false).eq("tipe","available").order("created_at",{ascending:false});
    setNotifAvailable(data??[]);
  };

  const tandaiNotifDibaca=async(id:number)=>{
    await supabase.from("fcs_notifikasi").update({dibaca:true}).eq("id",id);
    setNotifAvailable(prev=>prev.filter((n:any)=>n.id!==id));
  };

  const [pilihKomponenModal,setPilihKomponenModal]=useState<any>(null);

  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k},{data:pt}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit,jumlah_orang,tipe_kapasitas"),
        supabase.from("fcs_process_time").select("tipe_panel,jenis_pekerjaan,kode_komponen,menit_per_pcs").eq("is_active",true),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
      setProcessTimeList(pt??[]);
    };
    fetchCap();
    fetchNotifAvailable();
    const ch=supabase.channel("realtime-fcs-cap-raw-rawschedule")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fcs_notifikasi"},fetchNotifAvailable)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const getNamaKomponenDariKode=(panelId:number,kode:string):string=>{
    const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
    const tipe=panelData?.tipe;
    if(!tipe)return kode;
    const item=getEffCfg(tipe)?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode);
    return item?.nama||kode;
  };

  const getKomponenBelumDikerjakan=(proses:string):any[]=>{
    const hasil:any[]=[];
    rawData.filter((row:any)=>row.proses===proses).forEach((row:any)=>{
      const panelId=row.panel_id||row.panelId;
      const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
      if(!panelData)return;
      const sudahDitambah=new Set<string>();
      Object.values(row.schedule||{}).forEach((entries:any)=>{
        entries.forEach((entry:any)=>{
          (entry.komponen||[]).forEach((kode:string)=>{
            if(sudahDitambah.has(kode))return;
            const progress=panelData.checklist?.[kode]?.progress?.[proses]||0;
            if(progress>0)return;
            const cfg=getEffCfg(panelData.tipe);
            const item=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode);
            if(!item)return;
            sudahDitambah.add(kode);
            hasil.push({rawId:row.id,panelId,panel:row.panel,proyek:row.proyek,kode,nama:item.nama,wp:entry.wp});
          });
        });
      });
    });
    return hasil;
  };

  const getMenitPerPcs=(tipePanel:string,proses:string,kode:string):number=>{
    const pt=processTimeList.find((p:any)=>p.tipe_panel===tipePanel&&p.jenis_pekerjaan===proses&&p.kode_komponen===kode);
    return pt?Number(pt.menit_per_pcs):0;
  };

  const getKomponenStatus=(panelId,proses,kode)=>{
    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
    if(!panelData)return"belum_mulai";
    const cl=panelData.checklist?.[kode];
    if(!cl)return"belum_mulai";
    const v=cl.progress?.[proses]||0;
    if(v>=100)return"finish";
    if(v>0)return"on_progress";
    return"belum_mulai";
  };

  const getTaskStatus=(row,date,wp,komponen)=>{
    const panelId=row.panel_id||row.panelId;
    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
    if(!panelData)return"belum_mulai";
    const proses=row.proses;
    const allDone=komponen.every(kode=>{
      const cl=panelData.checklist?.[kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>=100;
    });
    if(allDone&&komponen.length>0)return"finish";
    const anyStarted=komponen.some(kode=>{
      const cl=panelData.checklist?.[kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>0;
    });
    if(anyStarted)return"on_progress";
    return"belum_mulai";
  };

  const isWpDone=(panelData,wp,proses)=>{
    if(!panelData)return false;
    const cfg=getEffCfg(panelData.tipe);
    const wpDef=cfg?.wps.find(w=>w.wp===wp);
    if(!wpDef||!wpDef.items.length)return false;
    return wpDef.items.every(it=>{
      const cl=panelData.checklist?.[it.kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>=100;
    });
  };

  const onDragStart=(e,rawId,fromDate,entries)=>{
    e.dataTransfer.effectAllowed="move";
    setDragInfo({rawId,fromDate,entries});
  };

  const onDragOver=(e,rawId,date)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    setDragOverCell({rawId,date});
  };

  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    setDragOverCell(null);
    if(!dragInfo)return;
    if(dragInfo.rawId!==rawId){setDragInfo(null);return;}
    if(dragInfo.fromDate===toDate){setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});
    setDragInfo(null);
  };

  const days=useMemo(()=>Array.from({length:30},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
  const [busbarSel,setBusbarSel]=useState<string[]>([]);

  // Keyboard handler Ctrl+C / Ctrl+V / Esc / Delete
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="c"){
        if(selectedCells.length>0){e.preventDefault();copySelected();}
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="v"){
        if(copiedCells.length>0&&lastSelected){
          e.preventDefault();
          pasteToCell(lastSelected.rawId,lastSelected.date);
        }
      }
      if(e.key==="Escape"){setSelectedCells([]);setCopiedCells([]);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedCells,copiedCells,lastSelected,rawData,woData]);
  // ── COPY PASTE FUNCTIONS ──
  const toggleMarkerCell=async(rawId:number,date:string)=>{
    const rowM=rawData.find((r:any)=>r.id===rawId);
    if(!rowM)return;
    const existing=rowM.schedule?.[date]||[];
    const newSchedule={...(rowM.schedule||{})};
    if(existing.length>0){
      delete newSchedule[date];
    } else {
      newSchedule[date]=[{wp:rowM.proses,komponen:["MARKED"]}];
    }
    await updateRaw(rowM.id,{schedule:newSchedule});
    setRawData((prev:any)=>prev.map((r:any)=>r.id===rawId?{...r,schedule:newSchedule}:r));
  };
  // PROSES yang cuma penanda tanggal (bukan per-komponen) - klik cell langsung toggle, gak ada modal, gak masuk renhar
  const PROSES_MARKER_ONLY=["QC TEST","PACKING"];

  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    const rowClicked=rawData.find((r:any)=>r.id===rawId);
    if(rowClicked&&PROSES_MARKER_ONLY.includes(rowClicked.proses)){
      e.stopPropagation();
      toggleMarkerCell(rawId,date);
      return;
    }
    if(moveKomponenState){
      if(moveKomponenState.rawId!==rawId){
        alert("Cuma bisa pindahin ke tanggal lain di BARIS (proses) yang sama.");
        return;
      }
      if(moveKomponenState.date===date){
        setMoveKomponenState(null);
        return;
      }
      executeMoveKomponen(rawId,moveKomponenState.date,date,moveKomponenState.items);
      return;
    }
    setCtxMenu(null);
    if(e.shiftKey&&lastSelected){
      // Select range - hanya di row yang sama (seperti spreadsheet horizontal)
      const allDays=days;
      const startDayIdx=allDays.indexOf(lastSelected.date);
      const endDayIdx=allDays.indexOf(date);
      const minDay=Math.min(startDayIdx,endDayIdx);
      const maxDay=Math.max(startDayIdx,endDayIdx);
      // Jika row berbeda, select semua row di antara keduanya
      const rows=rawData;
      const startRowIdx=rows.findIndex(r=>r.id===lastSelected.rawId);
      const endRowIdx=rows.findIndex(r=>r.id===rawId);
      const minRow=Math.min(startRowIdx,endRowIdx);
      const maxRow=Math.max(startRowIdx,endRowIdx);
      const newSelected:any[]=[];
      for(let r=minRow;r<=maxRow;r++){
        for(let d=minDay;d<=maxDay;d++){
          newSelected.push({rawId:rows[r].id,date:allDays[d]});
        }
      }
      setSelectedCells(newSelected);
    } else if(e.altKey){
      // Alt+klik = toggle individual cell (multi select tidak berurutan)
      setSelectedCells(prev=>{
        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});
    } else {
      // Klik biasa tanpa modifier
      if(selectedCells.length>0||copiedCells.length>0){
        // Ada selection/copied → clear dan mulai fresh atau buka modal
        if(copiedCells.length>0){
          // Dalam mode paste → set anchor
          setSelectedCells([{rawId,date}]);
          setLastSelected({rawId,date});
        } else {
          // Clear selection, buka modal
          setSelectedCells([]);
          setLastSelected(null);
          openCellModal(rawId,date);
        }
      } else {
        // Tidak ada selection → buka modal
        openCellModal(rawId,date);
      }
    }
  };

  const handleContextMenu=(rawId:number,date:string,e:React.MouseEvent)=>{
    e.preventDefault();
    setCtxMenu({x:e.clientX,y:e.clientY,rawId,date});
    // Jika cell belum ter-select, select dulu
    if(!selectedCells.some(c=>c.rawId===rawId&&c.date===date)){
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };

  const deleteSelected=async()=>{
    if(!selectedCells.length)return;
    const batchUpdates:Record<number,any>={};
    for(const cell of selectedCells){
      const row=rawData.find(r=>r.id===cell.rawId);
      if(!row)continue;
      if(!batchUpdates[row.id]){
        batchUpdates[row.id]={schedule:{...row.schedule},busbar_schedule:{...(row.busbar_schedule||{})}};
      }
      delete batchUpdates[row.id].schedule[cell.date];
      delete batchUpdates[row.id].busbar_schedule[cell.date];
    }
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
  };

  const copySelected=()=>{
    if(!selectedCells.length)return;
    const copied=selectedCells.map(c=>{
      const row=rawData.find(r=>r.id===c.rawId);
      return{
        rawId:c.rawId,date:c.date,
        entries:row?.schedule?.[c.date]||[],
        busbar:row?.busbar_schedule?.[c.date]||[],
      };
    });
    setCopiedCells(copied);
  };

  const pasteToCell=async(targetRawId:number,targetDate:string)=>{
    if(!copiedCells.length)return;
    const allDays=days;
    const targetDayIdx=allDays.indexOf(targetDate);
    if(targetDayIdx===-1)return;
    const targetRowIdx=rawData.findIndex(r=>r.id===targetRawId);
    const srcRowIds=[...new Set(copiedCells.map((c:any)=>c.rawId))];
    const minSrcDayIdx=Math.min(...copiedCells.map((c:any)=>allDays.indexOf(c.date)));
    const minSrcRowIdx=Math.min(...srcRowIds.map((id:any)=>rawData.findIndex(r=>r.id===id)));
    const batchUpdates:Record<number,any>={};
    for(const cell of copiedCells){
      const srcDayIdx=allDays.indexOf(cell.date);
      const srcRowIdx=rawData.findIndex(r=>r.id===cell.rawId);
      const dayOffset=srcDayIdx-minSrcDayIdx;
      const rowOffset=srcRowIdx-minSrcRowIdx;
      const destDayIdx=targetDayIdx+dayOffset;
      const destRowIdx=targetRowIdx+rowOffset;
      if(destDayIdx<0||destDayIdx>=allDays.length)continue;
      if(destRowIdx<0||destRowIdx>=rawData.length)continue;
      const destDate=allDays[destDayIdx];
      const destRow=rawData[destRowIdx];
      if(!destRow)continue;
      if(!batchUpdates[destRow.id]){
        batchUpdates[destRow.id]={schedule:{...destRow.schedule},busbar_schedule:{...(destRow.busbar_schedule||{})}};
      }
      if(cell.entries.length>0) batchUpdates[destRow.id].schedule[destDate]=cell.entries;
      if(cell.busbar.length>0) batchUpdates[destRow.id].busbar_schedule[destDate]=cell.busbar;
    }
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
    setCopiedCells([]);
  };

  const openCellModal=(rawId,date)=>{
    setCellModal({rawId,date});
    setModalWp("");
    setModalKomponen([]);
    // Load existing busbar selections
    const row=rawData.find(r=>r.id===rawId);
    setBusbarSel(row?.busbar_schedule?.[date]||[]);
  };
  const rawRow=cellModal?rawData.find(r=>r.id===cellModal.rawId):null;
  const cellEntries=rawRow?.schedule?.[cellModal?.date]||[];
  const livePanelForCell=rawRow?woData.flatMap(w=>w.panels||[]).find(p=>Number(p.id)===Number(rawRow.panel_id||rawRow.panelId)):null;
  // Sisa qty yang beneran perlu dijadwalkan: total dikurangi yang lebih besar antara "sudah
  // dijadwalkan" (cegah dobel-jadwal, dari raw_schedule) dan "sudah dikerjakan beneran"
  // (progress asli operator, panels.checklist.qtyProses) - dipakai buat validasi kapasitas
  // DAN badge tampilan di daftar pilih komponen.
  const hitungSisaQty=(kode:string)=>{
    const prosesCek=rawRow?.proses;
    const totalQty=livePanelForCell?.checklist?.[kode]?.qty||0;
    let sudahTerjadwal=0;
    const schedule=rawRow?.schedule||{};
    Object.entries(schedule).forEach(([tgl,entries]:[string,any])=>{
      (entries as any[]).forEach((e:any)=>{
        if(cellModal&&tgl===cellModal.date&&e.wp===modalWp)return;
        if((e.komponen||[]).includes(kode))sudahTerjadwal+=e.qtyPerKomponen?.[kode]??totalQty;
      });
    });
    const qtyProsesSelesai=livePanelForCell?.checklist?.[kode]?.qtyProses?.[prosesCek||""]||0;
    const sudah=Math.max(sudahTerjadwal,qtyProsesSelesai);
    return{sisa:Math.max(0,totalQty-sudah),totalQty,qtyProsesSelesai};
  };
  const panelCfg=livePanelForCell?getEffCfg(livePanelForCell.tipe):null;
  const wpItemsAll=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];
  const komponenSudahAda=cellEntries.find(e=>e.wp===modalWp)?.komponen||[];
  const komponenSudahDipakaiTanggalLain=(()=>{
    const result=new Set<string>();
    const schedule=rawRow?.schedule||{};
    Object.entries(schedule).forEach(([tgl,entries]:[string,any])=>{
      if(tgl===cellModal?.date)return;
      (entries||[]).forEach((e:any)=>{
        (e.komponen||[]).forEach((kode:string)=>{
          const progress=livePanelForCell?.checklist?.[kode]?.progress?.[rawRow?.proses||""]||0;
          if(progress>=100){result.add(kode);return;}
          if(tgl>=TODAY)result.add(kode);
        });
      });
    });
    return result;
  })();
  const wpItems=wpItemsAll.filter(it=>{
    const qty=livePanelForCell?.checklist?.[it.kode]?.qty||0;
    if(qty<=0)return false;
    return isKomponenRelevant(it.kode,livePanelForCell?.tipe||"",rawRow?.proses||"")&&!komponenSudahAda.includes(it.kode)&&!komponenSudahDipakaiTanggalLain.has(it.kode);
  });

  const syncRenharKomp=async(rawId,date,wp,newKomp)=>{
    const newKompBersih=(newKomp||[]).filter((k:string)=>!k.startsWith("__wiring_"));
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await updateRenhar(existing.id,{komponen:newKompBersih});
      if(refetchRenhar) await refetchRenhar();
    } else {
      setRenhar(prev=>prev.map(r=>((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKompBersih}:r));
    }
  };
  const syncRenharDel=async(rawId,date,wp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await removeRenhar(existing.id);
      if(refetchRenhar) await refetchRenhar();
    } else {
      setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
    }
  };

  const previewTanggalBobot=(()=>{
    if(!bobotCepat||!cellModal)return[] as string[];
    const dates:string[]=[];
    let cur=cellModal.date;
    let attempts=0;
    while(dates.length<totalHariBobot&&attempts<30){
      dates.push(cur);
      const next=new Date(cur);next.setDate(next.getDate()+1);
      cur=next.toISOString().slice(0,10);
      attempts++;
    }
    return dates;
  })();
  const simpanDenganBobot=async()=>{
    if(!bobotCepat||!modalWp||modalKomponen.length===0||!cellModal)return;
    const dates=previewTanggalBobot;
    if(dates.length===0)return;
    const row=rawData.find((r:any)=>r.id===cellModal.rawId);
    if(!row)return;
    const schedule={...(row.schedule||{})};
    const token=`__wiring_${jumlahOrangBobot}org_${bobotCepat}`;
    for(const tgl of dates){
      const existing=schedule[tgl]||[];
      const wpEntry=existing.find((e:any)=>e.wp===modalWp);
      const newKomp=[token,...modalKomponen];
      if(wpEntry){
        schedule[tgl]=existing.map((e:any)=>e.wp===modalWp?{...e,komponen:Array.from(new Set([...e.komponen,...newKomp]))}:e);
      } else {
        schedule[tgl]=[...existing,{wp:modalWp,komponen:newKomp}];
      }
    }
    setRawData((prev:any[])=>prev.map((r:any)=>r.id===cellModal.rawId?{...r,schedule}:r));
    await supabase.from("raw_schedule").update({schedule}).eq("id",cellModal.rawId);
    setCellModal(null);
    setModalWp("");setModalKomponen([]);setBobotCepat("");setJumlahOrangBobot(1);setModalOrangPerKomponen({});
    alert(`Berhasil! Jadwal masuk ke ${dates.length} hari: ${dates.join(", ")}`);
  };

  const ESTAFET_LOCK_AKTIF=false; // ganti ke true buat nyalain lock estafet lagi
  const checkEstafet=(kode:string,tipe:string,targetProses:string,panelId:number):{ok:boolean;prosesSebelum?:string}=>{
    if(!ESTAFET_LOCK_AKTIF)return{ok:true};
    const relevantProses=ALL_PROSES.filter((pr:string)=>isKomponenRelevant(kode,tipe,pr));
    const idx=relevantProses.indexOf(targetProses);
    if(idx<=0)return{ok:true};
    const prosesSebelum=relevantProses[idx-1];
    const rowSebelum=rawData.find((r:any)=>(r.panel_id||r.panelId)===panelId&&r.proses===prosesSebelum);
    if(!rowSebelum)return{ok:false,prosesSebelum};
    const schedule=rowSebelum.schedule||{};
    const adaTerjadwal=Object.values(schedule).some((entries:any)=>(entries||[]).some((e:any)=>(e.komponen||[]).includes(kode)));
    return{ok:adaTerjadwal,prosesSebelum};
  };

  const addEntry=async()=>{
    if(!modalWp||!modalKomponen.length)return;

    const tipePanelCek=livePanelForCell?.tipe;
    const prosesCek=rawRow?.proses;

    if(tipePanelCek&&prosesCek){
      const panelIdCek=livePanelForCell?.id;
      for(const kode of modalKomponen){
        const cekEstafet=checkEstafet(kode,tipePanelCek,prosesCek,panelIdCek);
        if(!cekEstafet.ok){
          const namaKomp=getNamaKomponenDariKode(panelIdCek,kode);
          alert(`⛔ Gak bisa dijadwalkan!\n\n"${namaKomp}" belum terjadwal di proses "${cekEstafet.prosesSebelum}".\n\nJadwalkan dulu di proses "${cekEstafet.prosesSebelum}" sebelum lanjut ke "${prosesCek}".`);
          return;
        }
      }
    }

    // Validasi kuota ORANG (khusus WIRING POWER/CONTROL)
    if(prosesCek&&PROSES_ORANG_RAW.includes(prosesCek)){
      const orangDibutuhkan=modalKomponen.reduce((s,k)=>s+(modalOrangPerKomponen[k]||1),0);
      const cekOrang=await checkKuotaOrangDanKomponenSwap({
        tanggal:cellModal.date,
        jenisPekerjaan:prosesCek,
        orangDibutuhkan,
        excludeRawId:cellModal.rawId,
        excludeWp:modalWp,
      });
      if(!cekOrang.cukup){
        if(cekOrang.kuotaHari===0&&cekOrang.opsiSwap.length===0){
          alert("Kuota orang "+prosesCek+" tanggal ini belum diatur sama sekali.\n"+(cekOrang.error||"Silakan atur Override Tanggal dulu."));
          return;
        }
        setSwapOrangModal({tanggal:cellModal.date,proses:prosesCek,orangDibutuhkan,...cekOrang});
        setSwapOrangSelected([]);
        return;
      }
    }

    // Validasi kapasitas MENIT (proses lain selain wiring, hanya jika data FCS process time tersedia)
    if(tipePanelCek&&prosesCek&&prosesCek!=="BUSBAR"&&!PROSES_ORANG_RAW.includes(prosesCek)){
      let menitDibutuhkan=0;
      let adaDataProcessTime=false;
      for(const kode of modalKomponen){
        const qty=hitungSisaQty(kode).sisa;
        const menitPcs=getMenitPerPcs(tipePanelCek,prosesCek,kode);
        if(menitPcs>0)adaDataProcessTime=true;
        menitDibutuhkan+=qty*menitPcs;
      }
      if(adaDataProcessTime&&menitDibutuhkan>0){
        const cek=await checkKapasitasDanKomponenSwapV2({
          tanggal:cellModal.date,
          jenisPekerjaan:prosesCek,
          menitDibutuhkan,
          excludeRawId:cellModal.rawId,
          excludeWp:modalWp,
        });
        if(!cek.cukup){
          if(cek.opsiSwap.length>0){
            setSwapModal({tanggal:cellModal.date,proses:prosesCek,menitDibutuhkan,...cek});
            setSwapSelected([]);
            return;
          } else {
            alert("Kapasitas "+prosesCek+" tanggal ini sudah penuh dan tidak ada komponen lain yang bisa dipindah.\n"+(cek.error||""));
            return;
          }
        }
      }
    }

    let finalKomp=modalKomponen;
    let updatedRow=null;
    let oldKomp:string[]=[];
    let isEdit=false;
    const isProsesOrangRow=prosesCek&&PROSES_ORANG_RAW.includes(prosesCek);
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const existing=newSch[cellModal.date]||[];
      const wpEntry=existing.find(e=>e.wp===modalWp);
      let updated;
      if(wpEntry){
        oldKomp=wpEntry.komponen;isEdit=true;
        if(isProsesOrangRow){
          const komponenLamaBelumSelesai=(wpEntry.komponen||[]).filter((kode:string)=>{
            const progress=livePanelForCell?.checklist?.[kode]?.progress?.[prosesCek||""]||0;
            return progress<100;
          });
          finalKomp=[...new Set([...komponenLamaBelumSelesai,...modalKomponen])];
        } else {
          finalKomp=[...new Set([...wpEntry.komponen,...modalKomponen])];
        }
        const newOrangMap=isProsesOrangRow?{...(wpEntry.orangPerKomponen||{}),...modalOrangPerKomponen}:wpEntry.orangPerKomponen;
        updated=existing.map(e=>e.wp!==modalWp?e:{...e,komponen:finalKomp,...(isProsesOrangRow?{orangPerKomponen:newOrangMap}:{})});
      }
      else{
        updated=[...existing,{wp:modalWp,komponen:modalKomponen,...(isProsesOrangRow?{orangPerKomponen:modalOrangPerKomponen}:{}),createdBy:user?.name||user?.nama||"Admin",createdAt:new Date().toISOString()}];
      }
      newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharKomp(cellModal.rawId,cellModal.date,modalWp,finalKomp);
    setModalWp('');setModalKomponen([]);setModalOrangPerKomponen({});
    const isBusbarRow=rawRow?.proses==="BUSBAR";
    if(updatedRow){
      const updatePayload:any={schedule:updatedRow.schedule,updated_by:user?.name||user?.nama||'Admin'};
      if(isBusbarRow&&busbarSel!==undefined){
        const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
        updatePayload.busbar_schedule=newBusbarSch;
        // Update local state dengan busbar_schedule
        setRawData(prev=>prev.map(r=>{
          if(r.id!==cellModal.rawId)return r;
          return{...r,schedule:updatedRow.schedule,busbar_schedule:newBusbarSch};
        }));
      }
      await updateRaw(cellModal.rawId,updatePayload);
    }
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=user?.name||user?.nama||sess?.nama||sess?.name||'Admin';
    const getName=(k:string)=>panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k)?.nama||k;
    if(isEdit){
      const added=modalKomponen.filter(k=>!oldKomp.includes(k)).map(getName);
      const removed=oldKomp.filter(k=>!modalKomponen.includes(k)).map(getName);
      const parts=[];
      if(added.length) parts.push('Tambah: '+added.join(', '));
      if(removed.length) parts.push('Hapus: '+removed.join(', '));
      const desc=parts.length?parts.join(' | '):'Tidak ada perubahan';
      await activityLogService.insert({user_name:uname,action:'EDIT WP RAW SCHEDULE',description:'Edit '+modalWp+' '+rawRow?.panel+' - '+rawRow?.proyek+' ('+cellModal?.date+'): '+desc,module:'raw',halaman:'Raw Schedule',proyek:rawRow?.proyek||'',panel:rawRow?.panel||''});
    } else {
      const kompNames=finalKomp.map(getName).join(', ');
      await activityLogService.insert({user_name:uname,action:'TAMBAH WP RAW SCHEDULE',description:'Tambah '+modalWp+' ('+kompNames+') ke jadwal '+rawRow?.panel+' - '+rawRow?.proyek+' ('+cellModal?.date+')',module:'raw',halaman:'Raw Schedule',proyek:rawRow?.proyek||'',panel:rawRow?.panel||''});
    }
  };
  const removeEntry=async(wp)=>{
    // Hitung new schedule dulu sebelum update state
    const currentRow=rawData.find(r=>r.id===cellModal.rawId);
    if(!currentRow)return;
    const newSch={...currentRow.schedule};
    const updated=(newSch[cellModal.date]||[]).filter((e:any)=>e.wp!==wp);
    if(!updated.length) delete newSch[cellModal.date]; else newSch[cellModal.date]=updated;
    const updatedRow={...currentRow,schedule:newSch};
    // Update state dan Supabase
    setRawData(prev=>prev.map(r=>r.id===cellModal.rawId?updatedRow:r));
    await updateRaw(cellModal.rawId,{schedule:newSch});
    syncRenharDel(cellModal.rawId,cellModal.date,wp);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS WP RAW SCHEDULE",description:"Hapus "+wp+" dari jadwal "+rawRow?.panel+" - "+rawRow?.proyek+" ("+cellModal?.date+")",module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""});
  };

  const confirmDrag=async(mode)=>{
    if(!dragMode)return;
    const{rawId,fromDate,entries,toDate}=dragMode;
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==rawId)return r;
      const newSch={...r.schedule};
      if(mode==="move")delete newSch[fromDate];
      const existing=newSch[toDate]||[];
      const merged=[...existing];
      entries.forEach(e=>{
        const found=merged.find(m=>m.wp===e.wp);
        if(found)found.komponen=[...new Set([...found.komponen,...e.komponen])];
        else merged.push({...e});
      });
      newSch[toDate]=merged;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    if(mode==="move"){
      // Renhar yang udah pernah didistribusi/dirilis buat kombinasi ini perlu IKUT PINDAH
      // tanggalnya di database, bukan cuma di state lokal - kalau enggak, Vista Pekerja
      // (yang baca renhar.tanggal langsung dari DB) masih nampilin di tanggal LAMA walau
      // raw_schedule-nya udah pindah, sementara Rencana Harian (baca raw_schedule) udah gak
      // nampilin di tanggal lama itu lagi - dua sisi jadi gak sinkron.
      const renharUntukDipindah=renhar.filter((r:any)=>(r.raw_id||r.rawId)===rawId&&r.tanggal===fromDate&&entries.some((e:any)=>e.wp===r.wp));
      setRenhar(prev=>prev.map((r:any)=>{
        const match=renharUntukDipindah.find((x:any)=>x.id===r.id);
        if(!match)return r;
        const entry=entries.find((e:any)=>e.wp===r.wp);
        return{...r,tanggal:toDate,komponen:entry.komponen};
      }));
      for(const r of renharUntukDipindah){
        const entry=entries.find((e:any)=>e.wp===r.wp);
        if(entry)await updateRenhar(r.id,{tanggal:toDate,komponen:entry.komponen});
      }
    }
    setDragMode(null);setDragInfo(null);
    if(updatedRow) await updateRaw(rawId,{schedule:updatedRow.schedule});
    // Activity log drag & drop
    const row=rawData.find(r=>r.id===rawId);
    const wpList=entries.map(e=>e.wp).join(", ");
    const kompList=entries.flatMap(e=>e.komponen||[]).join(", ");
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,
      action:mode==="move"?"PINDAH JADWAL":"COPY JADWAL",
      description:(mode==="move"?"Pindah":"Copy")+" jadwal "+row?.panel+" ("+row?.proyek+") proses "+row?.proses+" WP: "+wpList+" dari "+fromDate+" ke "+toDate,
      module:"raw",
      halaman:"Raw Schedule",
      proyek:row?.proyek||"",
      panel:row?.panel||"",
    });
  };

  const updatePrioritasPanel=async(panelId,val)=>{
    const toUpdate=rawData.filter(r=>(r.panel_id||r.panelId)===panelId);
    setRawData(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    setRenhar(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    for(const r of toUpdate){ await updateRaw(r.id,{prioritas:val}); }
  };

  const getMissingRelevantProses=(p:any):string[]=>{
    const existingProsesP=rawData.filter((r:any)=>(r.panel_id||r.panelId)===p.id).map((r:any)=>r.proses);
    const activeKodes=Object.entries(p.checklist||{}).filter(([,v]:any)=>(v?.qty||0)>0).map(([k])=>k);
    const relevantSet=new Set<string>();
    activeKodes.forEach((kode:string)=>getRelevantProsesForKode(kode,p.tipe).forEach((pr:string)=>relevantSet.add(pr)));
    return [...relevantSet].filter((pr:string)=>!existingProsesP.includes(pr));
  };
  const panelOpts=addForm.woId?(woData.find(w=>w.id===Number(addForm.woId))?.panels||[]).filter((p:any)=>getMissingRelevantProses(p).length>0):[];
  const [addLoading,setAddLoading]=useState(false);
  const submitAdd=async()=>{
    if(addLoading)return;
    if(!addForm.woId||addForm.panelIds.length===0)return;
    const wo=woData.find(w=>w.id===Number(addForm.woId));
    if(!wo)return;
    setAddLoading(true);
    let totalPanelDitambah=0;
    for(const panelId of addForm.panelIds){
      const p=wo.panels.find(x=>x.id===panelId);
      if(!p)continue;
      const toAdd=getMissingRelevantProses(p);
      if(!toAdd.length)continue;
      for(const proses of toAdd){
        await createRaw({
          wo_id:wo.id,panel_id:p.id,proyek:wo.proyek,panel:p.nama,
          proses,prioritas:addForm.prioritas,schedule:{}
        });
      }
      totalPanelDitambah++;
      if(log) await log("TAMBAH RAW SCHEDULE","Tambah Panel "+p.nama+" ke Raw Schedule","raw_schedule",{module:"raw",action_type:"create",proyek:wo.proyek||"",panel:p.nama||"",wo_number:wo.wo||"",halaman:"Raw Schedule"});
    }
    await refetchRaw();
    setAddLoading(false);
    if(totalPanelDitambah===0){alert("Semua proses panel yang dipilih sudah ada!");}
    setAddModal(false);setAddForm({woId:"",panelIds:[],prioritas:"Sedang"});
  };

  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    const tasks:any[]=[];
    rawData.forEach(r=>{
      if(PROSES_MARKER_ONLY.includes(r.proses))return; // QC TEST/PACKING cuma penanda, gak masuk Rencana Harian
      // WP biasa dari schedule
      (r.schedule?.[selDate]||[]).forEach((e:any)=>{
        tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
          proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
          wp:e.wp,komponen:e.komponen,tanggal:selDate});
      });
      // Busbar dari busbar_schedule
      if(r.proses==="BUSBAR"){
        const busbarItems=r.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
            proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
            wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,isBusbar:true});
        }
      }
    });
    return tasks;
  },[rawData,selDate]);

  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };

  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi,existing}=assignModal;
    if(existing){
      await updateRenhar(existing.id,{pekerja:selPekerja});
      setRenhar(prev=>prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r));
    } else {
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:selPekerja,
      });
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
    if(log) await log("DISTRIBUSI RAW SCHEDULE","Distribusi "+task.proses+" - "+task.panel+" ("+task.tanggal+")","renhar",{module:"rencana",action_type:"distribute",proyek:task.proyek||"",panel:task.panel||"",wo_number:task.woId?.toString()||"",halaman:"Raw Schedule"});
    setAssignModal(null);setSelPekerja([]);
  };

  const distributeAll=async()=>{
    for(const task of dateTasks){
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
      if(renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal))continue;
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:[],
      });
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
  };

  const thS={background:"#1e2330",color:"#c8d0e8",padding:"3px 6px",fontWeight:600,fontSize:9,whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center" as "center",borderRight:"1px solid #2d3348",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>‹ Minggu Lalu</button>
          <button onClick={()=>setWeekStart(TODAY)} style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #3b5bdb",background:weekStart===TODAY?"#eff3ff":"#fff",color:"#3b5bdb",cursor:"pointer",fontSize:11,fontWeight:500,fontFamily:"inherit"}}>Hari Ini</button>
          <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Minggu Depan ›</button>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setAddModal(true)} style={{height:28,padding:"0 14px",borderRadius:5,border:"none",background:"#3b5bdb",color:"#fff",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah Panel</button>
            <button onClick={openRiwayat} style={{height:28,padding:"0 12px",borderRadius:5,border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
              🔔 Riwayat Perubahan
              {qtyChangeUnread>0&&(
                <span style={{background:"#dc2626",color:"#fff",borderRadius:"50%",minWidth:16,height:16,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{qtyChangeUnread}</span>
              )}
            </button>
          </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",background:"#fff",borderRadius:10,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
        <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Filter:</span>
        <div style={{position:"relative" as const}}>
          <button onClick={()=>setProyekDropdownOpen(!proyekDropdownOpen)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            {filterProyek.length===0?"Semua Proyek":`${filterProyek.length} Proyek dipilih`}
            <span style={{fontSize:9}}>▾</span>
          </button>
          {proyekDropdownOpen&&(
            <>
              <div onClick={()=>setProyekDropdownOpen(false)} style={{position:"fixed" as const,inset:0,zIndex:998}}/>
              <div style={{position:"absolute" as const,top:"110%",left:0,zIndex:999,background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",padding:8,minWidth:200,maxHeight:280,overflowY:"auto" as const}}>
                <label style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,borderBottom:"1px solid #f1f5f9",marginBottom:4}}>
                  <input type="checkbox" checked={filterProyek.length===0} onChange={()=>{setFilterProyek([]);setFilterPanel("ALL");}}/>
                  Semua Proyek
                </label>
                {[...new Set(rawData.map(r=>r.proyek))].map(p=>(
                  <label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:12}}>
                    <input type="checkbox" checked={filterProyek.includes(p)} onChange={()=>toggleFilterProyek(p)}/>
                    {p}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <select value={filterPanel} onChange={e=>setFilterPanel(e.target.value)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",maxWidth:260}}>
          <option value="ALL">Semua Panel</option>
          {[...new Set(rawData.filter(r=>filterProyek.length===0||filterProyek.includes(r.proyek)).map(r=>r.panel))].map(p=>(<option key={p} value={p}>{p}</option>))}
        </select>
        {(filterProyek.length>0||filterPanel!=="ALL")&&(
          <button onClick={()=>{setFilterProyek([]);setFilterPanel("ALL");}} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:600,cursor:"pointer"}}>✕ Reset</button>
        )}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>Filter Proses:</span>
        <button onClick={()=>setFilterProses([])} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${filterProses.length===0?"#1d4ed8":"#e2e8f0"}`,background:filterProses.length===0?"#1d4ed8":"#fff",color:filterProses.length===0?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua</button>
        {ALL_PROSES.map(pr=>{const pc=PROSES_COLOR[pr]||"#64748b";const isSel=filterProses.includes(pr);return(<button key={pr} onClick={()=>toggleFilterProses(pr)} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr}</button>);})}
      </div>

      {pilihKomponenModal&&(
        <Modal title="Pilih Komponen Lain yang Bisa Diambil" onClose={()=>setPilihKomponenModal(null)} width={520}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>
            Daftar komponen {pilihKomponenModal.proses} yang belum pernah dijadwalkan. Klik salah satu untuk lompat ke baris itu dan tambahkan ke hari ini.
          </div>
          {(()=>{
            const daftarKomponen=getKomponenBelumDikerjakan(pilihKomponenModal.proses);
            if(daftarKomponen.length===0){
              return(<div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:12}}>Semua komponen sudah terjadwal</div>);
            }
            return(
              <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:340,overflowY:"auto" as const}}>
                {daftarKomponen.map((k:any,ki:number)=>(
                  <button key={ki} onClick={async()=>{
                      await tandaiNotifDibaca(pilihKomponenModal.notifId);
                      setPilihKomponenModal(null);
                      openCellModal(k.rawId,TODAY);
                      setModalWp(k.wp);
                      const rowTarget=rawData.find((r:any)=>r.id===k.rawId);
                      const existingEntry=(rowTarget?.schedule?.[TODAY]||[]).find((e:any)=>e.wp===k.wp);
                      const panelDataTarget=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(k.panelId));
                      const komponenLamaBelumSelesai=(existingEntry?.komponen||[]).filter((kd:string)=>{
                        const progress=panelDataTarget?.checklist?.[kd]?.progress?.[pilihKomponenModal.proses]||0;
                        return progress<100;
                      });
                      setModalKomponen([...new Set([...komponenLamaBelumSelesai,k.kode])]);
                      setModalOrangPerKomponen((prev:any)=>({...prev,[k.kode]:prev[k.kode]||1}));
                    }}
                    style={{textAlign:"left" as const,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:"#fff"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{k.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({k.kode})</span></div>
                      <div style={{fontSize:10,color:"#64748b"}}>{k.panel} · {k.proyek}</div>
                    </div>
                    <i className="ti ti-arrow-right" style={{fontSize:14,color:"#1d4ed8"}}/>
                  </button>
                ))}
              </div>
            );
          })()}
        </Modal>
      )}

      {notifAvailable.length>0&&(
        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            💡 Operator Selesai Lebih Cepat ({notifAvailable.length})
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
            {notifAvailable.map((n:any)=>(
              <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,background:"#fff",borderRadius:8,padding:"10px 12px",border:"1px solid #dbeafe"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#1e293b"}}>
                    <strong>{n.pekerja_nama}</strong> selesai <strong>{n.nama_komponen}</strong> ({n.panel_nama}) lebih cepat
                  </div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                    Rencana selesai {fmtDate(n.tanggal_rencana_selesai)}, aktual {fmtDate(n.tanggal_aktual_selesai)}. Ada komponen lain yang bisa diambil.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                  <button onClick={()=>setPilihKomponenModal({notifId:n.id,proses:n.proses})}
                    style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap" as const}}>Pilih Komponen</button>
                  <button onClick={()=>tandaiNotifDibaca(n.id)}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#64748b",whiteSpace:"nowrap" as const}}>Tandai dibaca</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fcsKapasitas.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div onClick={()=>setCapacityCollapsed(!capacityCollapsed)}
            style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:capacityCollapsed?0:10,cursor:"pointer",display:"flex",alignItems:"center",gap:6,userSelect:"none" as const}}>
            <span style={{fontSize:10,transition:"transform .15s",transform:capacityCollapsed?"rotate(-90deg)":"rotate(0deg)",display:"inline-block"}}>▾</span>
            ⚡ Capacity Utilization {filterProses.length>0?"— "+filterProses.join(", "):"(semua proses)"} <span style={{fontWeight:400,fontSize:9,color:"#94a3b8"}}>(dari Raw Schedule)</span>
          </div>
          {!capacityCollapsed&&(
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {days.slice(0,7).map(d=>{
              const prosesToShow=filterProses.length===0?["POTONG","BENDING","STEL","FINISHING","PAINTING","WIRING CONTROL","WIRING POWER"]:filterProses;
              const perProses:{nama:string;terpakai:number;kapasitas:number;adaOverride:boolean;satuan:string}[]=prosesToShow.map((pr:string)=>{
                const isOrangPr=PROSES_ORANG_RAW_GLOBAL.includes(pr);
                const ov=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr&&k.tanggal===d);
                const kapasitasPr=ov?(isOrangPr?Number(ov.jumlah_orang||0):Number(ov.kapasitas_menit||0)):0;
                let terpakaiPr=0;
                rawData.filter((r:any)=>r.proses===pr).forEach((r:any)=>{
                  const panelId=r.panel_id||r.panelId;
                  const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
                  if(!panelData)return;
                  const entries=r.schedule?.[d]||[];
                  entries.forEach((e:any)=>{
                    if(isOrangPr){
                      const orangMap:Record<string,number>=e.orangPerKomponen||{};
                      (e.komponen||[]).forEach((kode:string)=>{
                        if(!kode.startsWith('__wiring_'))return;
                        if(orangMap[kode]!==undefined){
                          terpakaiPr+=orangMap[kode];
                        } else {
                          const m=kode.match(/^__wiring_(\d+)org_/);
                          terpakaiPr+=m?parseInt(m[1],10):1;
                        }
                      });
                    } else {
                      (e.komponen||[]).forEach((kode:string)=>{
                        const qty=panelData.checklist?.[kode]?.qty||0;
                        const menitPcs=getMenitPerPcs(panelData.tipe,pr,kode);
                        terpakaiPr+=qty*menitPcs;
                      });
                    }
                  });
                });
                return {nama:pr,terpakai:terpakaiPr,kapasitas:kapasitasPr,adaOverride:!!ov,satuan:isOrangPr?"orang":"mnt"};
              });
              const adaOverride=perProses.some(pp=>pp.adaOverride);
              return(
                <div key={d} style={{background:"var(--card-bg,#fff)",border:"1px solid #e2e8f030",borderRadius:8,padding:"8px 12px",minWidth:130,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{getDayLabel(d)}</div>
                  {!adaOverride?(
                    <button onClick={()=>{setOverrideModal({tanggalMulai:d,tanggalAkhir:d,proses:filterProses.length>0?filterProses:["POTONG"]});setOverrideValue("");setOverrideResult(null);}}
                      style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0,fontFamily:"inherit"}}>⚠ Belum diatur · Atur</button>
                  ):(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:5,textAlign:"left" as const}}>
                      {perProses.map(pp=>{
                        if(!pp.adaOverride){
                          return(
                            <div key={pp.nama} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:9}}>
                              <span style={{color:"#64748b"}}>{pp.nama}</span>
                              <button onClick={()=>{setOverrideModal({tanggalMulai:d,tanggalAkhir:d,proses:[pp.nama]});setOverrideValue("");setOverrideResult(null);}}
                                style={{color:"#dc2626",fontWeight:700,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0,fontSize:9,fontFamily:"inherit"}}>Belum diatur · Atur</button>
                            </div>
                          );
                        }
                        const pctPr=pp.kapasitas>0?Math.min(Math.round((pp.terpakai/pp.kapasitas)*100),100):0;
                        const colorPr=pctPr>=95?"#dc2626":pctPr>=80?"#f59e0b":"#16a34a";
                        return(
                          <div key={pp.nama} onClick={()=>{setOverrideModal({tanggalMulai:d,tanggalAkhir:d,proses:[pp.nama]});setOverrideValue("");setOverrideResult(null);}}
                            style={{cursor:"pointer"}} title="Klik buat edit kapasitas">
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:9,marginBottom:2}}>
                              <span style={{color:"#64748b"}}>{pp.nama} ✎</span>
                              <span style={{fontWeight:700,color:"#1e293b"}}>{Math.round(pp.terpakai)}/{pp.kapasitas} {pp.satuan}</span>
                            </div>
                            <div style={{width:"100%",height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                              <div style={{width:pctPr+"%",height:"100%",background:colorPr,borderRadius:99}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 120px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
          <thead style={{position:"sticky",top:0,zIndex:10}}>
            <tr>
              <th style={{...thS,textAlign:"left",minWidth:80,position:"sticky",left:0,zIndex:5,background:"#1e2330"}}>PROYEK</th>
              <th style={{...thS,textAlign:"left",minWidth:150,position:"sticky",left:80,zIndex:5,background:"#1e2330"}}>PANEL</th>
              <th style={{...thS,minWidth:110,position:"sticky",left:230,zIndex:5,background:"#1e2330"}}>PROSES</th>
              <th style={{...thS,minWidth:90,position:"sticky",left:340,zIndex:5,background:"#1e2330"}}>PRIORITAS</th>
              {days.map(d=>(
                <th key={d} onClick={()=>setSelDate(d===selDate?null:d)}
                  style={{...thS,minWidth:120,cursor:"pointer",background:d===TODAY?"#1e40af":isSunday(d)?"#7f1d1d":selDate===d?"#1d4ed8":"#1e3a8a",borderBottom:d===TODAY?"2px solid #60a5fa":selDate===d?"2px solid #93c5fd":"none"}}>
                  <div>{getDayLabel(d)}</div>
                  {d===TODAY&&<div style={{fontSize:9,opacity:.7}}>Hari Ini</div>}
                  {selDate===d&&<div style={{fontSize:9,color:"#93c5fd"}}>▼ Review</div>}
                </th>
              ))}
              <th style={{...thS,minWidth:40,position:"sticky",right:0,zIndex:5}}>✕</th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const PRIO_ORDER={"Tinggi":0,"Sedang":1,"Rendah":2};
              const visibleRows=rawData.filter(row=>
                (filterProses.length===0||filterProses.includes(row.proses))&&
                (filterProyek.length===0||filterProyek.includes(row.proyek))&&
                (filterPanel==="ALL"||row.panel===filterPanel)
              ).sort((a,b)=>{
                const pa=PRIO_ORDER[a.prioritas]??1;const pb=PRIO_ORDER[b.prioritas]??1;
                if(pa!==pb)return pa-pb;
                const aId=a.panel_id||a.panelId;const bId=b.panel_id||b.panelId;
                if(aId!==bId)return aId-bId;
                const ai=ALL_PROSES.indexOf(a.proses);const bi=ALL_PROSES.indexOf(b.proses);
                return ai-bi;
              });
              const panelRowCount:Record<string,number>={};
              visibleRows.forEach(row=>{
                const pid=String(row.panel_id||row.panelId);
                panelRowCount[pid]=(panelRowCount[pid]||0)+1;
              });
              return visibleRows.map((row,ri)=>{
                const pc=PROSES_COLOR[row.proses]||"#64748b";
                const priColor=PRIORITAS_COLOR[row.prioritas]||"#64748b";
                const rBg=ri%2===0?"#fff":"#f8fafc";
                const prevRow=visibleRows[ri-1];
                const prevPanelId=prevRow?(prevRow.panel_id||prevRow.panelId):null;
                const curPanelId=row.panel_id||row.panelId;
                const isNewPanel=!prevRow||prevPanelId!==curPanelId;
                const panelTopBorder=isNewPanel&&ri>0?"3px solid #1e293b":"1px solid #f1f5f9";
                const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"2px 4px",verticalAlign:"middle",borderTop:panelTopBorder};
                const rowSpanCount=panelRowCount[String(curPanelId)]||1;
                const subBarisKomponen=getSemuaKomponenSebagaiSubBaris(row);

                if(false&&subBarisKomponen&&subBarisKomponen.length>0){
                  return(
                    <Fragment key={row.id}>
                      {subBarisKomponen.map((komp:any,ki:number)=>(
                        <tr key={row.id+"-"+komp.wp+"-"+komp.kode}>
                          {isNewPanel&&ki===0&&(
                            <>
                              <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:9,color:"#475569",background:"#fff",minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center" as const,verticalAlign:"middle"}}>{row.proyek}</td>
                              <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:9,color:"#1e293b",background:"#fff",minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.3,textAlign:"center" as const,verticalAlign:"middle"}}>{row.panel}</td>
                            </>
                          )}
                          {ki===0&&(
                            <td rowSpan={subBarisKomponen.length} style={{...td,position:"sticky",left:230,zIndex:2,textAlign:"center" as const,background:"#fff",verticalAlign:"top",paddingTop:8}}>
                              <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap" as const}}>{row.proses}</span>
                            </td>
                          )}
                          {ki===0&&(
                            <td rowSpan={subBarisKomponen.length} style={{...td,position:"sticky",left:340,zIndex:2,textAlign:"center" as const,background:"#fff",verticalAlign:"top",paddingTop:8}}>
                              <select value={row.prioritas||"Sedang"} onChange={e=>updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                                style={{padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"}}>
                                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                              </select>
                            </td>
                          )}
                          {days.map(d=>renderKotakWiring(komp,d,row.id,row.panel_id||row.panelId))}
                          <td style={{...td,textAlign:"center" as const,position:"sticky",right:0,zIndex:2,background:"#fff"}}>
                            
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                }

                return(
                  <tr key={row.id}>
                    {isNewPanel&&(
                      <>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:9,color:"#475569",background:"#fff",minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center" as const,verticalAlign:"middle"}}>{row.proyek}</td>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:9,color:"#1e293b",background:"#fff",minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.3,textAlign:"center" as const,verticalAlign:"middle"}}>{row.panel}</td>
                      </>
                    )}
                    <td style={{...td,position:"sticky",left:230,zIndex:2,textAlign:"center",background:rBg}}>
                      <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap"}}>{row.proses}</span>
                    </td>
                    <td style={{...td,position:"sticky",left:340,zIndex:2,textAlign:"center",background:rBg}}>
                      <select value={row.prioritas||"Sedang"} onChange={e=>updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                        style={{padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"}}>
                        {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    {days.map(d=>{
                      const rentangInfo=getRentangInfoUntukTanggal(row,d);
                      if(rentangInfo&&!rentangInfo.isStart)return null;
                      let colSpanCount=1;
                      if(rentangInfo&&rentangInfo.isStart){
                        colSpanCount=days.filter(dd=>dd>=rentangInfo.mulai&&dd<=rentangInfo.selesai).length;
                      }
                      const entries=row.schedule?.[d]||[];
                      const busbarEntries:string[]=row.busbar_schedule?.[d]||[];
                      // Kode yang dari TANGGAL INI (d) udah digeser otomatis ke besok (belum
                      // sempat dikerjakan) - dipakai buat nampilin indikator "→ digeser" di sisi
                      // sumbernya juga, biar keliatan dari kedua sisi (bukan cuma di tujuan).
                      const kodeDigeserKeBesok=new Set<string>(
                        (row.schedule?.[addDays(d,1)]||[])
                          .filter((e:any)=>e.carriedOverFrom===d)
                          .flatMap((e:any)=>e.komponen||[])
                      );
                      const isOver=dragOverCell?.rawId===row.id&&dragOverCell?.date===d;
                      const isSelDate=selDate===d;
                      const isDraggableEntry=!rentangInfo;
                      return(
                        <td key={d} colSpan={colSpanCount} onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}} style={{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rentangInfo?"#eff6ff":rBg,outline:isOver?"2px dashed #2563eb":copiedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px dashed #3b82f6":selectedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px solid #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}
                          onDragOver={e=>onDragOver(e,row.id,d)}
                          onDrop={e=>onDrop(e,row.id,d)}
                          onDragLeave={()=>setDragOverCell(null)}>
                          {entries.length>0?(
                            PROSES_ORANG_RAW.includes(row.proses)?(
                              <div onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}
                                onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}
                                draggable={true} onDragStart={e=>onDragStart(e,row.id,d,entries)}
                                style={{display:"flex",flexDirection:"column" as const,gap:3,padding:"4px 6px",borderRadius:6,cursor:"grab"}}>
                                {entries.map((entry:any)=>(entry.komponen||[]).map((kode:string)=>{
                                    if(kode.startsWith("__wiring_"))return null;
                                    const jmlOrang=entry.orangPerKomponen?.[kode]||1;
                                  const wc=WP_COLOR[entry.wp]||"#64748b";
                                  const panelDataForTelat=woData.flatMap((w:any)=>w.panels||[]).find((pp:any)=>Number(pp.id)===Number(row.panel_id||row.panelId));
                                  const progressUntukTelat=panelDataForTelat?.checklist?.[kode]?.progress?.[row.proses]||0;
                                  const isTelat=d<TODAY&&progressUntukTelat<100;
                                  const digeserKeBesok=kodeDigeserKeBesok.has(kode);
                                  return(
                                    <div key={entry.wp+kode} title={entry.carriedOverFrom?"Lanjutan dari "+entry.carriedOverFrom+" (belum sempat dikerjakan)":digeserKeBesok?"Belum selesai - otomatis digeser ke "+addDays(d,1):isTelat?"Belum selesai, tanggal udah lewat":""} style={{display:"inline-flex",alignItems:"center",gap:3,background:isTelat?"#fef2f2":wc+"22",color:isTelat?"#dc2626":wc,border:`1px solid ${isTelat?"#fca5a5":wc+"44"}`,borderRadius:4,padding:"1px 5px",maxWidth:"100%"}}>
                                      {entry.carriedOverFrom&&<span style={{fontSize:9}}>🔁</span>}
                                      {digeserKeBesok&&<span style={{fontSize:9}}>➡️</span>}
                                      {isTelat&&<span style={{fontSize:9,fontWeight:900}}>⚠️</span>}
                                      <span style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:55}}>{getNamaKomponenDariKode(row.panel_id||row.panelId,kode)}{entry.qtyPerKomponen?.[kode]!==undefined?` (${entry.qtyPerKomponen[kode]})`:""}</span>
                                      <span style={{fontSize:7,display:"flex",alignItems:"center",gap:1}}><i className="ti ti-users" style={{fontSize:7}}/>{jmlOrang}</span>
                                </div>
                                  );
                                }))}
                              </div>
                            ):(
                            <div draggable={isDraggableEntry} onDragStart={e=>{if(isDraggableEntry)onDragStart(e,row.id,d,entries);}}
                               onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}
                              style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",cursor:isDraggableEntry?"grab":"pointer",padding:"3px",borderRadius:6,border:isSelDate?"1px solid #bfdbfe":"1px solid transparent"}}>
                              {entries.map(e=>{
                                const status=getTaskStatus(row,d,e.wp,e.komponen);
                                const statusStyle=status==="finish"?{background:"#16a34a",opacity:.9}:status==="on_progress"?{background:"#f59e0b"}:{background:PROSES_COLOR[row.proses]||"#64748b"};
                                const statusIcon=status==="finish"?"✓":status==="on_progress"?"●":"";
                                const adaDigeserKeBesok=(e.komponen||[]).some((k:string)=>kodeDigeserKeBesok.has(k));
                                return(<div key={e.wp} title={e.carriedOverFrom?"Lanjutan dari "+e.carriedOverFrom+" (belum sempat dikerjakan)":adaDigeserKeBesok?"Sebagian belum selesai - otomatis digeser ke "+addDays(d,1):""} style={{...statusStyle,color:"#fff",borderRadius:3,padding:"1px 4px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",gap:2}}>{e.carriedOverFrom&&<span style={{fontSize:9}}>🔁</span>}{adaDigeserKeBesok&&<span style={{fontSize:9}}>➡️</span>}{statusIcon&&<span style={{fontSize:9}}>{statusIcon}</span>}{e.wp}<span style={{fontSize:9,opacity:.8,marginLeft:2}}>({e.komponen.length})</span></div>);
                              })}
                            </div>
                            )
                          ):(
                            <div onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}
                              style={{width:"100%",minHeight:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s",padding:"2px"}}
                              onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor="#94a3b8";e.currentTarget.style.color="#94a3b8";}}
                              onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#e2e8f0";}}>
                              {row.proses==="BUSBAR"&&busbarEntries.length>0?(
                                <div style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center"}}>
                                  {busbarEntries.map((b:string)=>(
                                    <span key={b} style={{background:(BUSBAR_COLORS[b]||"#64748b")+"22",
                                      color:BUSBAR_COLORS[b]||"#64748b",
                                      border:`1px solid ${BUSBAR_COLORS[b]||"#64748b"}44`,
                                      borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700}}>
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              ):(
                                <span>+</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{...td,textAlign:"center",position:"sticky",right:0,zIndex:2}}>
                      
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {selDate&&(
        <Card style={{marginTop:16,border:"1.5px solid #bfdbfe",background:"#f0f8ff"}} className="su">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#1d4ed8"}}>📋 {fmtDateFull(selDate)}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{dateTasks.length} pekerjaan · Distribusi dilakukan di tab Rencana Harian</div>
            </div>
            <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>✕</button>
          </div>
          {(()=>{
            const panelGroupMap:Record<string,any[]>={};
            dateTasks.forEach(t=>{
              const gk=`${t.proyek}__${t.panel}__${t.panelId}`;
              if(!panelGroupMap[gk])panelGroupMap[gk]=[];
              panelGroupMap[gk].push(t);
            });
            return Object.entries(panelGroupMap).map(([gk,tasks],gi)=>{
              const t0=tasks[0];
              const cardKey=`panelcard__${gk}__${selDate}`;
              const isExpanded=expandedTasks[cardKey];
              const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t0.panelId);
              const cfg2=panelData?getEffCfg(panelData.tipe):null;
              const allSt=tasks.map(t=>getTaskStatus(t,t.tanggal,t.wp,t.komponen));
              const overallSt=allSt.every(s=>s==="finish")?"finish":allSt.some(s=>s==="on_progress"||s==="finish")?"on_progress":"belum_mulai";
              const stColor=overallSt==="finish"?"#16a34a":overallSt==="on_progress"?"#f59e0b":"#64748b";
              const stLabel=overallSt==="finish"?"✓ Finish":overallSt==="on_progress"?"● On Progress":"○ Belum Mulai";
              return(
                <div key={gi} onClick={()=>setExpandedTasks(prev=>({...prev,[cardKey]:!prev[cardKey]}))} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1.5px solid ${stColor}40`,cursor:"pointer",userSelect:"none" as "none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t0.proyek}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{t0.panel}</div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tDot=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#94a3b8";
                        return(
                          <span key={ti} style={{display:"inline-flex",gap:3,alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"2px 7px"}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:tDot,flexShrink:0}}/>
                            <Badge label={t.proses} color={pc}/>
                            <span style={{background:wc,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{t.wp}</span>
                          </span>
                        );
                      })}
                      <Badge label={t0.prioritas||"Sedang"} color={PRIORITAS_COLOR[t0.prioritas]||"#64748b"}/>
                      <span style={{fontSize:11,fontWeight:700,color:stColor,whiteSpace:"nowrap"}}>{stLabel}</span>
                    </div>
                    <span style={{color:"#94a3b8",fontSize:14,flexShrink:0,marginLeft:4}}>{isExpanded?"▲":"▼"}</span>
                  </div>
                  {isExpanded&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e2e8f0",display:"flex",flexDirection:"column",gap:8}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tColor=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#64748b";
                        const tLabel=tSt==="finish"?"✓ Finish":tSt==="on_progress"?"● On Progress":"○ Belum Mulai";
                        const grp:{finish:any[],on_progress:any[],belum_mulai:any[]}={finish:[],on_progress:[],belum_mulai:[]};
                        t.komponen.forEach(k=>{
                          const s=getKomponenStatus(t.panelId,t.proses,k);
                          const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
                          grp[s as keyof typeof grp].push({kode:k,nama:item?.nama||k});
                        });
                        const stGroups=[
                          {key:"finish",label:"✓ Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
                          {key:"on_progress",label:"● On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
                          {key:"belum_mulai",label:"○ Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
                        ];
                        return(
                          <div key={ti} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:`1px solid ${tColor}30`}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                              <Badge label={t.proses} color={pc}/>
                              <span style={{background:wc,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span>
                              <span style={{fontSize:11,fontWeight:700,color:tColor}}>{tLabel}</span>
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                              {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:"#e2e8f0",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>;})}
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {stGroups.filter(g=>grp[g.key as keyof typeof grp].length>0).map(g=>(
                                <div key={g.key} style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:6,padding:"6px 10px"}}>
                                  <div style={{fontWeight:800,fontSize:10,color:g.color,marginBottom:4,letterSpacing:.3}}>{g.label} ({grp[g.key as keyof typeof grp].length})</div>
                                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                    {grp[g.key as keyof typeof grp].map(it=>(<span key={it.kode} style={{background:"#fff",border:`1px solid ${g.border}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600,color:"#475569"}}>{it.nama}</span>))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </Card>
      )}

      {moveKomponenState&&(
        <div style={{position:"fixed" as const,top:16,left:"50%",transform:"translateX(-50%)",zIndex:10000,background:"#1e293b",color:"#fff",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 24px rgba(0,0,0,0.25)"}}>
          <span style={{fontSize:12}}>🔀 Klik tanggal TUJUAN buat pindahin komponen ini (di baris yang sama)</span>
          <button onClick={()=>setMoveKomponenState(null)} style={{background:"#334155",border:"none",color:"#fff",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
        </div>
      )}
      {riwayatOpen&&(
        <div onClick={()=>setRiwayatOpen(false)} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.4)",zIndex:10000,display:"flex",justifyContent:"flex-end"}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{width:380,maxWidth:"100%",background:"#fff",height:"100%",padding:20,overflowY:"auto" as const,boxShadow:"-4px 0 20px rgba(0,0,0,0.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontWeight:800,fontSize:16}}>Riwayat Perubahan Qty</div>
              <button onClick={()=>setRiwayatOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#94a3b8"}}>✕</button>
            </div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Perubahan qty komponen dari Manajemen WO.</div>
            {qtyChangeLog.length===0?(
              <div style={{textAlign:"center" as const,color:"#94a3b8",fontSize:12,padding:"30px 0"}}>Belum ada riwayat perubahan.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {qtyChangeLog.map((d:any)=>{
                  const naik=Number(d.qty_baru)>Number(d.qty_lama);
                  return(
                    <div key={d.id} onClick={()=>{setFilterProyek(d.proyek?[d.proyek]:[]);setFilterPanel(d.panel||"ALL");setRiwayatOpen(false);}}
                      title="Klik buat langsung liat baris ini di Raw Schedule"
                      style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",cursor:"pointer",border:"1px solid transparent",transition:"border-color .15s"}}
                      onMouseEnter={(e:any)=>e.currentTarget.style.borderColor="#93c5fd"}
                      onMouseLeave={(e:any)=>e.currentTarget.style.borderColor="transparent"}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:4}}>
                        <span>{d.proyek} · {d.panel}</span>
                        <span>{new Date(d.created_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                        {d.wp&&<span style={{background:WP_COLOR[d.wp]||"#64748b",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{d.wp}</span>}
                        <span style={{flex:1}}>{d.nama_komponen}</span>
                        <span style={{color:"#94a3b8"}}>{d.qty_lama}</span>
                        <span style={{color:"#94a3b8"}}>→</span>
                        <span style={{color:naik?"#16a34a":"#dc2626",fontWeight:700}}>{d.qty_baru}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                        <div style={{fontSize:10,color:"#94a3b8"}}>Diubah oleh {d.changed_by}</div>
                        {d.is_read?(
                          <span style={{fontSize:10,color:"#16a34a",fontWeight:600}}>✓ Sudah dibaca</span>
                        ):(
                          <button onClick={(e:any)=>{e.stopPropagation();confirmQtyChange(d.id);}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #16a34a",background:"#f0fdf4",color:"#16a34a",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Konfirmasi</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {cellModal&&rawRow&&(
        <Modal title={`Jadwal ${getDayLabel(cellModal.date)} — ${rawRow.proses}`} onClose={()=>setCellModal(null)} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{rawRow.proyek} · {rawRow.panel}</div>
          {cellEntries.length>0&&(
            <div style={{marginBottom:16}}>
              <Lbl>WP & Komponen Terjadwal</Lbl>
              {selectedForMove.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                  <span style={{fontSize:11,color:"#1d4ed8",flex:1}}>{selectedForMove.length} komponen dipilih</span>
                  <button onClick={()=>{setCellModal(null);setMoveKomponenState({rawId:cellModal.rawId,date:cellModal.date,items:selectedForMove});}}
                    style={{padding:"4px 10px",borderRadius:6,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔀 Pindahin →</button>
                  <button onClick={()=>setSelectedForMove([])}
                    style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                </div>
              )}
              {cellEntries.map(e=>{
                const wc=WP_COLOR[e.wp]||"#64748b";
                return(
                  <div key={e.wp} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{background:wc,color:'#fff',borderRadius:6,padding:'2px 10px',fontSize:12,fontWeight:700}}>{e.wp}</span>
                      <div style={{display:'flex',gap:6}}><button onClick={()=>{
                          setModalWp(e.wp);
                          const isWiringProses=PROSES_ORANG_RAW.includes(rawRow?.proses||"");
                          if(isWiringProses){
                            const belumSelesai=(e.komponen||[]).filter((kode:string)=>{
                              const progress=livePanelForCell?.checklist?.[kode]?.progress?.[rawRow?.proses||""]||0;
                              return progress<100;
                            });
                            setModalKomponen(belumSelesai);
                          } else {
                            setModalKomponen([...e.komponen]);
                          }
                        }} style={{background:'#eff6ff',border:'1px solid #bfdbfe',cursor:'pointer',color:'#2563eb',fontSize:12,borderRadius:6,padding:'2px 10px',fontWeight:600}}>✏️ Edit</button><button onClick={()=>removeEntry(e.wp)} style={{background:'none',border:'none',cursor:'pointer',color:'#fca5a5',fontSize:13}}>✕ Hapus</button></div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {e.komponen.map(k=>{
                        // Handle format wiring khusus: __wiring_{org}org_{bobot}
                        if(k.startsWith("__wiring_")){
                          const parts=k.replace("__wiring_","").split("_");
                          const org=parts[0]; // misal "2org"
                          const bobot=parts.slice(1).join("_"); // misal "MEDIUM" atau "VERY_HARD"
                          const bobotLabel=bobot.replace("_"," ");
                          const bobotColor:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                          const bc=bobotColor[bobot]||"#6366f1";
                          return <span key={k} style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>⚡ {org} · {bobotLabel}</span>;
                        }
                        const item=panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
                        const isSelMove=selectedForMove.some(x=>x.wp===e.wp&&x.kode===k);
                        const progressKomp=livePanelForCell?.checklist?.[k]?.progress?.[rawRow?.proses||""]||0;
                        const isKompDone=progressKomp>=100;
                        return <span key={k} onClick={()=>toggleSelectForMove(e.wp,k)} title={isKompDone?"Sudah selesai · Klik buat pilih/batal pilih buat dipindah":"Klik buat pilih/batal pilih buat dipindah"}
                          style={{background:isSelMove?wc:isKompDone?"#dcfce7":wc+"18",color:isSelMove?"#fff":isKompDone?"#16a34a":wc,border:`1px solid ${isSelMove?wc:isKompDone?"#86efac":wc+"33"}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer"}}>{isSelMove?"✓ ":isKompDone?"✅ ":"🔀 "}{item?.nama||k}{e.qtyPerKomponen?.[k]!==undefined?` (${e.qtyPerKomponen[k]})`:""}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16}}>
          {rawRow?.proses!=="BUSBAR"&&(<>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {WP_LIST.map(wp=>{
                const added=cellEntries.some(e=>e.wp===wp);
                const wpDone=isWpDone(livePanelForCell,wp,rawRow?.proses||"");
                const disabled=added||wpDone;const sel=modalWp===wp;const wc=WP_COLOR[wp];
                return(
                  <button key={wp} onClick={()=>{if(!disabled){setModalWp(sel?"":wp);setModalKomponen([]);}}} disabled={disabled}
                    style={{padding:"8px",borderRadius:8,border:`2px solid ${wpDone?"#16a34a":sel?wc:disabled?"#e2e8f0":"#e2e8f0"}`,background:wpDone?"#f0fdf4":sel?wc+"18":disabled?"#f8fafc":"#f8fafc",cursor:disabled?"not-allowed":"pointer",color:wpDone?"#16a34a":sel?wc:disabled?"#cbd5e1":"#64748b",fontWeight:700,fontSize:12,opacity:1,display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                    {wpDone?(<><span>✅</span>{wp}<span style={{fontSize:10,color:"#16a34a"}}>Selesai</span></>):(<><span style={{width:8,height:8,borderRadius:"50%",background:added?"#e2e8f0":wc}}/>{wp} {added?"(terjadwal)":sel?"✓":""}</>)}
                  </button>
                );
              })}
            </div>
            {modalWp&&wpItems.length>0&&(
              <>
                <Lbl>Pilih Komponen {modalWp}</Lbl>
                {PROSES_ORANG_RAW.includes(rawRow?.proses||"")&&(
                  <div style={{background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:8,padding:10,marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#7c3aed",marginBottom:6}}>🎚 Bobot Cepat (opsional - otomatis distribusi ke beberapa hari)</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
                      {Object.keys(BOBOT_HARI_MAP).map(b=>{
                        const sel=bobotCepat===b;const bc=BOBOT_COLOR_MAP[b];
                        return(
                          <button key={b} type="button" onClick={()=>setBobotCepat(sel?"":b)}
                            style={{padding:"6px 4px",borderRadius:7,border:`2px solid ${sel?bc:"#e2e8f0"}`,background:sel?bc+"18":"#fff",color:sel?bc:"#64748b",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                            {BOBOT_LABEL_MAP[b]}
                          </button>
                        );
                      })}
                    </div>
                    {bobotCepat&&(
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <span style={{fontSize:11,color:"#64748b"}}>Jumlah orang:</span>
                          <input type="number" min="1" step="1" value={jumlahOrangBobot}
                            onChange={e=>setJumlahOrangBobot(parseInt(e.target.value)||1)}
                            style={{width:50,textAlign:"center" as const,padding:"4px",borderRadius:6,border:"1px solid #e9d5ff",fontSize:12}}/>
                          <span style={{fontSize:11,color:"#7c3aed",fontWeight:600}}>= {totalHariBobot} hari</span>
                        </div>
                        {previewTanggalBobot.length>0&&(
                          <div style={{fontSize:10,color:"#64748b",marginBottom:8}}>Jadwal akan masuk ke {previewTanggalBobot.length} hari: {previewTanggalBobot.join(", ")}</div>
                        )}
                        <button type="button" onClick={simpanDenganBobot} disabled={!modalWp||modalKomponen.length===0}
                          style={{width:"100%",padding:"8px",borderRadius:7,border:"none",background:modalKomponen.length>0?"#7c3aed":"#e2e8f0",color:"#fff",fontSize:12,fontWeight:700,cursor:modalKomponen.length>0?"pointer":"not-allowed",fontFamily:"inherit"}}>
                          Simpan dengan Distribusi Bobot →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {PROSES_ORANG_RAW.includes(rawRow?.proses||"")?(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14}}>
                    {wpItems.map(it=>{
                      const sel=modalKomponen.includes(it.kode);
                      const kl=livePanelForCell?.checklist?.[it.kode];
                      const progress=kl?.progress?.[rawRow?.proses||""]||0;
                      const sudahSelesai=progress>=100;
                      return(
                        <div key={it.kode} style={{border:`1px solid ${sudahSelesai?"#bbf7d0":sel?"#93c5fd":"#e2e8f0"}`,borderRadius:8,padding:"8px 12px",background:sudahSelesai?"#f0fdf4":sel?"#eff6ff":"#fff",opacity:sudahSelesai?0.7:1}}>
                          <label style={{display:"flex",alignItems:"center",gap:10,cursor:sudahSelesai?"not-allowed":"pointer"}}>
                            <input type="checkbox" checked={sel} disabled={sudahSelesai} onChange={()=>{
                              if(sudahSelesai)return;
                              if(sel){setModalKomponen(prev=>prev.filter(k=>k!==it.kode));}
                              else{
                                setModalKomponen(prev=>[...prev,it.kode]);
                                setModalOrangPerKomponen(prev=>({...prev,[it.kode]:prev[it.kode]||1}));
                              }
                            }}/>
                            <span style={{flex:1,fontSize:12,color:sudahSelesai?"#16a34a":"#1e293b"}}>{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span></span>
                            <span style={{fontSize:10,color:sudahSelesai?"#16a34a":"#94a3b8",fontWeight:sudahSelesai?700:400}}>{sudahSelesai?"✓ Selesai":`progress ${progress}%`}</span>
                            {sel&&!sudahSelesai&&(
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <i className="ti ti-users" style={{fontSize:13,color:"#1d4ed8"}}/>
                                <input type="number" min="1" step="1" value={modalOrangPerKomponen[it.kode]||1}
                                  onChange={e=>setModalOrangPerKomponen(prev=>({...prev,[it.kode]:parseInt(e.target.value)||1}))}
                                  style={{width:48,textAlign:"center" as const,padding:"4px",borderRadius:6,border:"1px solid #93c5fd",fontSize:12}}/>
                              </div>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <>
                  {wpItems.length>0&&(
                    <button onClick={()=>{
                      const semuaKode=wpItems.map((it:any)=>it.kode);
                      const semuaTerpilih=semuaKode.every((k:string)=>modalKomponen.includes(k));
                      setModalKomponen(semuaTerpilih?[]:semuaKode);
                    }} style={{marginBottom:8,padding:"5px 12px",borderRadius:7,border:"1px dashed #94a3b8",background:"#f8fafc",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {wpItems.every((it:any)=>modalKomponen.includes(it.kode))?"✕ Batal Pilih Semua":"✓ Pilih Semua"}
                    </button>
                  )}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                    {wpItems.map(it=>{
                      const sel=modalKomponen.includes(it.kode);const wc=WP_COLOR[modalWp]||"#64748b";
                      const{sisa,totalQty}=hitungSisaQty(it.kode);
                      const adaProgres=totalQty>0&&sisa<totalQty;
                      return(<button key={it.kode} onClick={()=>setModalKomponen(prev=>sel?prev.filter(k=>k!==it.kode):[...prev,it.kode])} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${sel?wc:"#e2e8f0"}`,background:sel?wc+"18":"#f8fafc",color:sel?wc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600}}>
                        {sel?"✓ ":""}{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span>
                        {adaProgres&&(
                          <span style={{fontSize:9,fontWeight:700,marginLeft:6,padding:"1px 6px",borderRadius:20,
                            background:sisa===0?"#dcfce7":"#fef9c3",color:sisa===0?"#16a34a":"#92400e"}}>
                            {sisa}/{totalQty} tersisa
                          </span>
                        )}
                      </button>);
                    })}
                  </div>
                </>)}
                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>
                  {PROSES_ORANG_RAW.includes(rawRow?.proses||"")
                    ?"+ Tambah "+modalWp+" ("+modalKomponen.length+" komponen, "+modalKomponen.reduce((s,k)=>s+(modalOrangPerKomponen[k]||1),0)+" orang)"
                    :"+ Tambah "+modalWp+" ("+modalKomponen.length+" komponen)"}
                </Btn>
              </>
            )}
          </>)}
          </div>
          {/* Busbar Komponen Section */}
          {rawRow?.proses==="BUSBAR"&&(()=>{
            const busbarItems=getBusbarKomponen(livePanelForCell?.tipe||"FS");
            return(
              <div style={{marginTop:12,padding:"12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                  🔌 Pilih Komponen Busbar:
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                  {busbarItems.map((b:string)=>{
                    const isSel=busbarSel.includes(b);
                    const bc=BUSBAR_COLORS[b]||"#64748b";
                    return(
                      <button key={b} onClick={()=>setBusbarSel((p:string[])=>isSel?p.filter((x:string)=>x!==b):[...p,b])}
                        style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,
                          border:`1.5px solid ${isSel?bc:"#e2e8f0"}`,
                          background:isSel?bc+"18":"#fff",color:isSel?bc:"#64748b"}}>
                        {b}
                      </button>
                    );
                  })}
                </div>
                {busbarSel.length>0&&(
                  <div style={{marginTop:8,fontSize:11,color:"#64748b"}}>
                    Dipilih: <strong>{busbarSel.join(", ")}</strong>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={async()=>{
              // Save busbar schedule saat klik Selesai
              if(rawRow?.proses==="BUSBAR"){
                const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
                setRawData(prev=>prev.map(r=>{
                  if(r.id!==cellModal.rawId)return r;
                  return{...r,busbar_schedule:newBusbarSch};
                }));
                await updateRaw(cellModal.rawId,{busbar_schedule:newBusbarSch});
                const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
                const uname=user?.name||user?.nama||sess?.nama||'Admin';
                // Sync ke renhar
                if(busbarSel.length>0){
                  const existRenhar=renhar.find((r:any)=>
                    (r.raw_id||r.rawId)===cellModal.rawId&&
                    r.tanggal===cellModal.date&&
                    r.wp==="BUSBAR"
                  );
                  const renharPayload={
                    raw_id:cellModal.rawId,
                    wo_id:rawRow?.wo_id||rawRow?.woId,
                    panel_id:rawRow?.panel_id||rawRow?.panelId,
                    panel:rawRow?.panel,
                    proyek:rawRow?.proyek,
                    proses:rawRow?.proses,
                    wp:"BUSBAR",
                    komponen:busbarSel,
                    tanggal:cellModal.date,
                    divisi:"assembling",
                    prioritas:rawRow?.prioritas||"Sedang",
                  };
                  if(existRenhar){
                    await updateRenhar(existRenhar.id,{...renharPayload});
                    setRenhar((prev:any[])=>prev.map((r:any)=>r.id===existRenhar.id?{...r,...renharPayload}:r));
                  } else {
                    console.log('Creating renhar busbar:', renharPayload);
                    const res=await createRenhar(renharPayload);
                    console.log('Renhar result:', res);
                    if(res?.success&&res?.data) setRenhar((prev:any[])=>[...prev,res.data]);
                  }
                } else {
                  // Hapus renhar busbar jika kosong
                  const existRenhar=renhar.find((r:any)=>
                    (r.raw_id||r.rawId)===cellModal.rawId&&
                    r.tanggal===cellModal.date&&
                    r.wp==="BUSBAR"
                  );
                  if(existRenhar){
                    await removeRenhar(existRenhar.id);
                    setRenhar((prev:any[])=>prev.filter((r:any)=>r.id!==existRenhar.id));
                  }
                }
                await activityLogService.insert({
                  user_name:uname,
                  action:'JADWAL BUSBAR',
                  description:`Jadwal busbar ${rawRow?.panel} - ${rawRow?.proyek} (${cellModal?.date}): ${busbarSel.join(', ')||'kosong'}`,
                  module:'raw',halaman:'Raw Schedule',
                  proyek:rawRow?.proyek||'',panel:rawRow?.panel||''
                });
              }
              setCellModal(null);
            }}>Selesai</Btn>
          </div>
        </Modal>
      )}

      {swapModal&&(
        <Modal title={"Kapasitas Penuh — "+swapModal.tanggal} onClose={()=>{setSwapModal(null);setSwapSelected([]);}} width={540}>
          <div style={{display:"flex",flexDirection:"column" as const,maxHeight:"80vh"}}>
          <div style={{flexShrink:0}}>
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
              <span>⚠️</span>
              <span>Kapasitas {swapModal.proses} tanggal {fmtDate(swapModal.tanggal)} sudah penuh ({Math.round(swapModal.terpakaiSaatIni)}/{Math.round(swapModal.kapasitasHari)} menit). Komponen baru butuh {Math.round(swapModal.menitDibutuhkan)} menit. Pilih komponen di bawah untuk dipindah ke hari berikutnya.</span>
            </div>
            <Lbl>Komponen Terjadwal di {fmtDate(swapModal.tanggal)} (pilih untuk dipindah)</Lbl>
            <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Disusun berdasarkan prioritas: deadline paling jauh duluan (paling aman digeser)</div>
          </div>
          <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column" as const,gap:10,marginBottom:14,overflowY:"auto" as const}}>
            {(()=>{
              const groups:Record<string,{wo_number:string,wo_target:string,panels:Record<string,{panel_nama:string,items:any[]}>}>={};
              swapModal.opsiSwap.forEach((o:any)=>{
                const woKey=o.wo_number;
                if(!groups[woKey])groups[woKey]={wo_number:o.wo_number,wo_target:o.wo_target,panels:{}};
                const panelKey=String(o.panel_id);
                if(!groups[woKey].panels[panelKey])groups[woKey].panels[panelKey]={panel_nama:o.panel_nama,items:[]};
                groups[woKey].panels[panelKey].items.push(o);
              });
              return Object.values(groups).map((g:any,gi:number)=>(
                <div key={gi} style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",flexShrink:0}}>
                  <div style={{background:"#f8fafc",padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>WO {g.wo_number}</span>
                    <span style={{fontSize:10,color:"#94a3b8"}}>Deadline: {g.wo_target?fmtDate(g.wo_target):"-"}</span>
                  </div>
                  <div style={{padding:"8px 10px",display:"flex",flexDirection:"column" as const,gap:8}}>
                    {Object.entries(g.panels).map(([panelKey,pnl]:any,pi:number)=>{
                      const expKey=g.wo_number+"|"+panelKey;
                      const isExp=!!swapExpandedPanel[expKey];
                      const selectedCount=pnl.items.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).length;
                      return(
                        <div key={pi}>
                          <div onClick={()=>setSwapExpandedPanel(prev=>({...prev,[expKey]:!prev[expKey]}))}
                            style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"5px 4px",borderRadius:6}}>
                            <span style={{fontSize:11,fontWeight:600,color:"#475569"}}>{pnl.panel_nama}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              {selectedCount>0&&(
                                <span style={{fontSize:9,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{selectedCount} dipilih</span>
                              )}
                              <span style={{fontSize:9,color:"#94a3b8",background:"#f1f5f9",borderRadius:20,padding:"1px 8px"}}>{pnl.items.length} komponen</span>
                              <span style={{fontSize:10,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                            </div>
                          </div>
                          {isExp&&(
                            <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginTop:4}}>
                              {pnl.items.map((o:any)=>{
                                const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
                                const checked=swapSelected.includes(swapKey);
                                const hasProgress=o.progress>0;
                                return(
                                  <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                                    <input type="checkbox" checked={checked} style={{marginTop:2}}
                                      onChange={()=>setSwapSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,color:"#1e293b"}}>{o.nama_komponen}</div>
                                      <div style={{fontSize:10,color:"#94a3b8"}}>{o.qty} pcs · progress {o.progress}% · {Math.round(o.total_menit)} menit</div>
                                    </div>
                                    {hasProgress&&(
                                      <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>

          <div style={{flexShrink:0}}>
          {(()=>{
            const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);
            const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
            const cukupSetelahSwap=sisaSetelahSwap>=swapModal.menitDibutuhkan;
            return(
              <div style={{background:cukupSetelahSwap?"#f0fdf4":"#fffbeb",border:`1px solid ${cukupSetelahSwap?"#bbf7d0":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cukupSetelahSwap?"#16a34a":"#92400e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>{cukupSetelahSwap?"Setelah pindah, kapasitas cukup":"Pilih komponen lagi, masih belum cukup"}</span>
                <span style={{fontWeight:700}}>{Math.round(swapModal.terpakaiSaatIni-menitDipindah+swapModal.menitDibutuhkan)}/{Math.round(swapModal.kapasitasHari)} menit</span>
              </div>
            );
          })()}

          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>{setSwapModal(null);setSwapSelected([]);}}
              style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
            <button disabled={swapLoading||swapSelected.length===0} onClick={async()=>{
              const itemsToMove=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,total_menit:o.total_menit}));
              const menitDipindah=itemsToMove.reduce((s:number,it:any)=>s+Number(it.total_menit),0);
              const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
              if(sisaSetelahSwap<swapModal.menitDibutuhkan){alert("Kapasitas masih belum cukup, pilih komponen tambahan");return;}
              setSwapLoading(true);
              const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
              const uname=user?.name||user?.nama||sess?.nama||"Admin";
              const res=await executeSwapKomponenV2({
                items:itemsToMove,
                jenisPekerjaan:swapModal.proses,
                tanggalAsal:swapModal.tanggal,
              });
              setSwapLoading(false);
              if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
              await activityLogService.insert({
                user_name:uname,action:"SWAP KOMPONEN KAPASITAS",
                description:"Pindahkan "+swapSelected.length+" komponen dari "+fmtDate(swapModal.tanggal)+" ("+swapModal.proses+") ke hari berikutnya untuk beri ruang komponen baru",
                module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
              });
              setSwapModal(null);setSwapSelected([]);
              await addEntry();
            }}
              style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapLoading||swapSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapLoading||swapSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {swapLoading?"⏳ Memindahkan...":"Pindahkan & Tambah Komponen"}
            </button>
          </div>
          </div>
          </div>
        </Modal>
      )}

      {swapOrangModal&&(
        <Modal title={"Kuota Orang Penuh — "+swapOrangModal.tanggal} onClose={()=>{setSwapOrangModal(null);setSwapOrangSelected([]);}} width={540}>
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
            <span>⚠️</span>
            <span>Kuota {swapOrangModal.proses} tanggal {fmtDate(swapOrangModal.tanggal)}: {Math.round(swapOrangModal.terpakaiSaatIni)}/{Math.round(swapOrangModal.kuotaHari)} orang sudah terisi. Komponen baru butuh {Math.round(swapOrangModal.orangDibutuhkan)} orang lagi (total jadi {Math.round(swapOrangModal.terpakaiSaatIni+swapOrangModal.orangDibutuhkan)}). Pilih salah satu:</span>
          </div>

          <div>
              <Lbl>Komponen Terjadwal di {fmtDate(swapOrangModal.tanggal)} (pilih untuk dipindah)</Lbl>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Disusun berdasarkan prioritas: deadline paling jauh duluan (paling aman digeser)</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10,marginBottom:14,maxHeight:280,overflowY:"auto" as const}}>
                {(()=>{
                  const groups:Record<string,{wo_number:string,wo_target:string,panels:Record<string,{panel_nama:string,items:any[]}>}>={};
                  swapOrangModal.opsiSwap.forEach((o:any)=>{
                    const woKey=o.wo_number;
                    if(!groups[woKey])groups[woKey]={wo_number:o.wo_number,wo_target:o.wo_target,panels:{}};
                    const panelKey=String(o.panel_id);
                    if(!groups[woKey].panels[panelKey])groups[woKey].panels[panelKey]={panel_nama:o.panel_nama,items:[]};
                    groups[woKey].panels[panelKey].items.push(o);
                  });
                  return Object.values(groups).map((g:any,gi:number)=>(
                    <div key={gi} style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
                      <div style={{background:"#f8fafc",padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #e2e8f0"}}>
                        <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>WO {g.wo_number}</span>
                        <span style={{fontSize:10,color:"#94a3b8"}}>Deadline: {g.wo_target?fmtDate(g.wo_target):"-"}</span>
                      </div>
                      <div style={{padding:"8px 10px",display:"flex",flexDirection:"column" as const,gap:8}}>
                        {Object.entries(g.panels).map(([panelKey,pnl]:any,pi:number)=>{
                          const expKey=g.wo_number+"|"+panelKey;
                          const isExp=!!swapOrangExpandedPanel[expKey];
                          const selectedCount=pnl.items.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).length;
                          return(
                            <div key={pi}>
                              <div onClick={()=>setSwapOrangExpandedPanel(prev=>({...prev,[expKey]:!prev[expKey]}))}
                                style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"5px 4px",borderRadius:6}}>
                                <span style={{fontSize:11,fontWeight:600,color:"#475569"}}>{pnl.panel_nama}</span>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  {selectedCount>0&&(
                                    <span style={{fontSize:9,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{selectedCount} dipilih</span>
                                  )}
                                  <span style={{fontSize:9,color:"#94a3b8",background:"#f1f5f9",borderRadius:20,padding:"1px 8px"}}>{pnl.items.length} komponen</span>
                                  <span style={{fontSize:10,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                                </div>
                              </div>
                              {isExp&&(
                                <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginTop:4}}>
                                  {pnl.items.map((o:any)=>{
                                    const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
                                    const checked=swapOrangSelected.includes(swapKey);
                                    const hasProgress=o.progress>0;
                                    return(
                                      <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                                        <input type="checkbox" checked={checked} style={{marginTop:2}}
                                          onChange={()=>setSwapOrangSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                                        <div style={{flex:1}}>
                                          <div style={{fontSize:12,color:"#1e293b"}}>{getNamaKomponenDariKode(o.panel_id,o.kode_komponen)}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({o.kode_komponen})</span></div>
                                          <div style={{fontSize:10,color:"#94a3b8"}}>{o.jumlah_orang} orang · progress {o.progress}%</div>
                                        </div>
                                        {hasProgress&&(
                                          <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
              {(()=>{
                const orangDipindah=swapOrangModal.opsiSwap.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.jumlah_orang),0);
                const sisaSetelahSwap=swapOrangModal.sisaKuota+orangDipindah;
                const cukupSetelahSwap=sisaSetelahSwap>=swapOrangModal.orangDibutuhkan;
                return(
                  <div style={{background:cukupSetelahSwap?"#f0fdf4":"#fffbeb",border:`1px solid ${cukupSetelahSwap?"#bbf7d0":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cukupSetelahSwap?"#16a34a":"#92400e"}}>
                    {cukupSetelahSwap?"✅ Setelah pindah, kuota cukup":"Pilih komponen lagi, masih belum cukup"}
                  </div>
                );
              })()}
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button onClick={()=>{setSwapOrangModal(null);setSwapOrangSelected([]);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button disabled={swapOrangLoading||swapOrangSelected.length===0} onClick={async()=>{
                  const itemsToMove=swapOrangModal.opsiSwap.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,jumlah_orang:o.jumlah_orang}));
                  const orangDipindah=itemsToMove.reduce((s:number,it:any)=>s+Number(it.jumlah_orang),0);
                  const sisaSetelahSwap=swapOrangModal.sisaKuota+orangDipindah;
                  if(sisaSetelahSwap<swapOrangModal.orangDibutuhkan){alert("Kuota masih belum cukup, pilih komponen tambahan");return;}
                  setSwapOrangLoading(true);
                  const res=await executeSwapKomponenOrang({items:itemsToMove,jenisPekerjaan:swapOrangModal.proses,tanggalAsal:swapOrangModal.tanggal});
                  setSwapOrangLoading(false);
                  if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  await activityLogService.insert({
                    user_name:uname,action:"SWAP ORANG KAPASITAS",
                    description:"Pindahkan "+swapOrangSelected.length+" komponen dari "+fmtDate(swapOrangModal.tanggal)+" ("+swapOrangModal.proses+") ke hari berikutnya untuk beri ruang kuota orang",
                    module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
                  });
                  setSwapOrangModal(null);setSwapOrangSelected([]);
                  await addEntry();
                }}
                  style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapOrangLoading||swapOrangSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapOrangLoading||swapOrangSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {swapOrangLoading?"⏳ Memindahkan...":"Pindahkan & Tambah Komponen"}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {overrideModal&&(
        <Modal title="Atur Kapasitas" onClose={()=>{setOverrideModal(null);setOverrideResult(null);}} width={480}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <Lbl>Tanggal Mulai</Lbl>
              <Inp type="date" value={overrideModal.tanggalMulai} onChange={e=>setOverrideModal({...overrideModal,tanggalMulai:e.target.value})}/>
            </div>
            <div>
              <Lbl>Tanggal Akhir</Lbl>
              <Inp type="date" value={overrideModal.tanggalAkhir} onChange={e=>setOverrideModal({...overrideModal,tanggalAkhir:e.target.value})}/>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Jenis Pekerjaan ({overrideModal.proses.length} dipilih)</div>
              <div style={{display:"flex",gap:6}}>
                <button type="button" onClick={()=>setOverrideModal({...overrideModal,proses:[...ALL_PROSES]})}
                  style={{fontSize:10,color:"#16a34a",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                <button type="button" onClick={()=>setOverrideModal({...overrideModal,proses:[]})}
                  style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {ALL_PROSES.map(p=>{
                const checked=overrideModal.proses.includes(p);
                return(
                  <button key={p} type="button" onClick={()=>{
                    setOverrideModal({...overrideModal,proses:checked?overrideModal.proses.filter(x=>x!==p):[...overrideModal.proses,p]});
                  }}
                    style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${checked?"#1d4ed8":"#e2e8f0"}`,
                      background:checked?"#eff6ff":"#fff",color:checked?"#1d4ed8":"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          {overrideModal.proses.length>0&&overrideModal.proses.every(p=>["WIRING CONTROL","WIRING POWER"].includes(p))?(
            <div style={{marginBottom:14}}>
              <Lbl>Jumlah Orang</Lbl>
              <Inp type="number" min="0" value={overrideValue} onChange={e=>setOverrideValue(e.target.value)} placeholder="misal 6"/>
            </div>
          ):(
            <div style={{marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                <div>
                  <Lbl>Jam Kerja</Lbl>
                  <Inp type="number" min="0" step="0.5" value={overrideJamKerja} onChange={e=>setOverrideJamKerja(e.target.value)}/>
                </div>
                <div>
                  <Lbl>Efektivitas %</Lbl>
                  <Inp type="number" min="0" max="100" value={overrideEfektivitas} onChange={e=>setOverrideEfektivitas(e.target.value)}/>
                </div>
              </div>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                {overrideJamKerja} jam × 60 × {overrideEfektivitas}% = <strong>{Math.round((Number(overrideJamKerja)||0)*60*(Number(overrideEfektivitas)||0)/100)} menit</strong>/hari
              </div>
            </div>
          )}
          {!overrideResult?(
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>setOverrideModal(null)}>Batal</Btn>
              <Btn color="#1d4ed8" disabled={overrideSaving||(overrideModal.proses.length>0&&overrideModal.proses.every(p=>["WIRING CONTROL","WIRING POWER"].includes(p))?!overrideValue:(!overrideJamKerja||!overrideEfektivitas))||overrideModal.proses.length===0||!overrideModal.tanggalMulai||!overrideModal.tanggalAkhir} onClick={async()=>{
                setOverrideSaving(true);
                const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                const uname=user?.name||user?.nama||sess?.nama||"Admin";
                const allShifted:any[]=[];
                let cur=new Date(overrideModal.tanggalMulai);
                const end=new Date(overrideModal.tanggalAkhir);
                let safety=0;
                while(cur<=end&&safety<366){
                  const tgl=cur.toISOString().slice(0,10);
                  for(const proses of overrideModal.proses){
                    setOverrideProgress(tgl+" — "+proses);
                    const isOrangOv=["WIRING CONTROL","WIRING POWER"].includes(proses);
                    const kapasitasMenitHitung=Math.round((Number(overrideJamKerja)||0)*60*(Number(overrideEfektivitas)||0)/100);
                    const res=await setOverrideAndRebalance({
                      tanggal:tgl,
                      jenisPekerjaan:proses,
                      kapasitasMenit:isOrangOv?undefined:kapasitasMenitHitung,
                      jumlahOrang:isOrangOv?Number(overrideValue):undefined,
                      createdBy:uname,
                    });
                    if(res.success)allShifted.push(...res.shifted);
                  }
                  cur.setDate(cur.getDate()+1);
                  safety++;
                }
                setOverrideSaving(false);
                setOverrideProgress("");
                setOverrideResult(allShifted);
                if(refetchRaw) await refetchRaw();
              }}>
                {overrideSaving?(overrideProgress||"Menyimpan..."):"Simpan"}
              </Btn>
            </div>
          ):(
            <div>
              {overrideResult.length===0?(
                <div style={{textAlign:"center",padding:"16px 0",color:"#16a34a",fontWeight:700,fontSize:13}}>✅ Kapasitas tersimpan, gak ada yang perlu digeser</div>
              ):(
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#92400e",marginBottom:8}}>⚠ {overrideResult.length} komponen digeser ke tanggal berikutnya:</div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:280,overflowY:"auto" as const,marginBottom:14}}>
                    {overrideResult.map((s:any,i:number)=>(
                      <div key={i} style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 12px",fontSize:11}}>
                        <div style={{fontWeight:700,color:"#1e293b"}}>{s.namaKomponen} — {s.panelNama}</div>
                        <div style={{color:"#64748b"}}>WO {s.woNumber} · {s.proyek}</div>
                        <div style={{color:s.overflow?"#dc2626":"#92400e",fontWeight:600,marginTop:2}}>
                          {fmtDate(s.dariTanggal)} → {fmtDate(s.keTanggal)}{s.overflow?" (overflow, tetep kelebihan)":""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <Btn color="#1d4ed8" onClick={()=>{setOverrideModal(null);setOverrideResult(null);}}>Tutup</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}

      {assignModal&&(()=>{
        const{task,divisi,existing}=assignModal;const dc=DIVISI_CONFIG[divisi];
        const pekerjaDivisi=pekerja.filter(p=>p.divisi===divisi);
        return(
          <Modal title={`${assignModal.isExisting?"Edit":"Distribusi"} Pekerja — ${task.proses}`} onClose={()=>{setAssignModal(null);setSelPekerja([]);}} width={460}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{task.proyek} · {task.panel}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              <Badge label={task.proses} color={PROSES_COLOR[task.proses]||"#64748b"}/>
              <Badge label={`${task.wp}`} color={WP_COLOR[task.wp]||"#64748b"}/>
              <Badge label={dc.label} color={dc.color}/>
            </div>
            <Lbl>Pilih Pekerja ({dc.label})</Lbl>
            {pekerjaDivisi.length===0?(
              <div style={{padding:"16px",background:"#f8fafc",borderRadius:8,fontSize:12,color:"#94a3b8",textAlign:"center"}}>Belum ada pekerja di divisi {dc.label}.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaDivisi.map(p=>{
                  const isSel=selPekerja.includes(p.id);
                  return(
                    <div key={p.id} onClick={()=>setSelPekerja(prev=>isSel?prev.filter(id=>id!==p.id):[...prev,p.id])}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${isSel?dc.color:"#e2e8f0"}`,background:isSel?dc.bg:"#f8fafc",transition:"all .15s"}}>
                      <div style={{width:28,height:28,borderRadius:8,background:isSel?dc.color:dc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{isSel?"✓":dc.icon}</div>
                      <span style={{fontWeight:isSel?700:500,fontSize:13,color:isSel?dc.color:"#475569"}}>{p.nama}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {selPekerja.length>0&&(
              <div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:14,fontSize:12,color:"#16a34a",fontWeight:600}}>
                ✓ {selPekerja.length} pekerja dipilih: {selPekerja.map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>{setAssignModal(null);setSelPekerja([]);}}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmDistribute}>{assignModal.isExisting?"Simpan Perubahan":"Distribusi"}</Btn>
            </div>
          </Modal>
        );
      })()}

      {dragMode&&(
        <Modal title="Pindah atau Copy?" onClose={()=>setDragMode(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:16}}>Dari <strong>{getDayLabel(dragMode.fromDate)}</strong> ke <strong>{getDayLabel(dragMode.toDate)}</strong></div>
          <div style={{display:"flex",gap:10}}>
            <Btn color="#dc2626" style={{flex:1}} onClick={()=>confirmDrag("move")}>📦 Pindah</Btn>
            <Btn color="#2563eb" style={{flex:1}} onClick={()=>confirmDrag("copy")}>📋 Copy</Btn>
          </div>
        </Modal>
      )}

      {addModal&&(
        <Modal title="Tambah Panel ke Raw Schedule" onClose={()=>setAddModal(false)} width={480}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><Lbl>Work Order</Lbl>
              <Sel value={addForm.woId} onChange={e=>setAddForm({...addForm,woId:e.target.value,panelId:""})}>
                <option value="">-- Pilih WO --</option>
                {woData.filter((w:any)=>(w.panels||[]).some((p:any)=>getMissingRelevantProses(p).length>0)).map((w:any)=><option key={w.id} value={w.id}>WO {w.wo} — {w.proyek}</option>)}
              </Sel>
            </div>
            <div><Lbl>Panel ({addForm.panelIds.length} dipilih)</Lbl>
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <button type="button" onClick={()=>setAddForm({...addForm,panelIds:panelOpts.map((p:any)=>p.id)})}
                  style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",padding:0}}>Pilih Semua</button>
                <button type="button" onClick={()=>setAddForm({...addForm,panelIds:[]})}
                  style={{fontSize:11,color:"#64748b",background:"none",border:"none",cursor:"pointer",padding:0}}>Hapus Semua</button>
              </div>
              <div style={{maxHeight:220,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:6}}>
                {panelOpts.length===0&&(
                  <div style={{fontSize:12,color:"#94a3b8",padding:8,textAlign:"center" as const}}>Tidak ada panel tersedia</div>
                )}
                {panelOpts.map((p:any)=>{
                  const checked=addForm.panelIds.includes(p.id);
                  return(
                    <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",background:checked?"#eff6ff":"transparent"}}>
                      <input type="checkbox" checked={checked} onChange={()=>{
                        setAddForm(prev=>({...prev,panelIds:checked?prev.panelIds.filter(id=>id!==p.id):[...prev.panelIds,p.id]}));
                      }}/>
                      <span style={{fontSize:13,color:"#1e293b"}}>#{p.no_pnl||p.noPnl} — {p.nama}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div><Lbl>Prioritas</Lbl>
              <Sel value={addForm.prioritas} onChange={e=>setAddForm({...addForm,prioritas:e.target.value})}>
                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setAddModal(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={submitAdd} disabled={addLoading}>{addLoading?"Menambahkan...":"Tambah Panel"}</Btn>
          </div>
        </Modal>
      )}
    {/* Context Menu */}
    {ctxMenu&&(
      <>
        <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setCtxMenu(null)}/>
        <div style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:9999,
          background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,
          boxShadow:"0 4px 16px #00000020",padding:"4px 0",minWidth:180}}>
          {selectedCells.length>0&&copiedCells.length===0&&(
            <button onClick={()=>{copySelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"var(--text-primary,#1e293b)",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📋 Copy ({selectedCells.length} cell dipilih)
            </button>
          )}
          {copiedCells.length>0&&(
            <button onClick={()=>{pasteToCell(ctxMenu.rawId,ctxMenu.date);setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#1d4ed8",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#eff6ff"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📌 Paste di sini ({copiedCells.length} cell)
            </button>
          )}
          {selectedCells.length===0&&copiedCells.length===0&&(
            <button onClick={()=>{openCellModal(ctxMenu.rawId,ctxMenu.date);setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"var(--text-primary,#1e293b)",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              ✏️ Edit Jadwal
            </button>
          )}
          {selectedCells.length>0&&(
            <button onClick={()=>{deleteSelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#dc2626",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#fef2f2"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              🗑 Hapus ({selectedCells.length} cell)
            </button>
          )}
          <div style={{borderTop:"1px solid var(--border-light,#f1f5f9)",margin:"4px 0"}}/>
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
              border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#94a3b8",textAlign:"left" as const}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            ✕ Tutup
          </button>
        </div>
      </>
    )}
    </div>
  );
}


