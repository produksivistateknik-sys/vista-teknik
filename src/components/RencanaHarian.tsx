import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { PANEL_TYPES, DIVISI_PROSES, DIVISI_CONFIG, ALL_PROSES, PROSES_COLOR, WP_COLOR, PRIORITAS_COLOR } from '../constants/panelTypes'
import { TODAY, addDays, fmtShort, getDayLabel, fmtDateFull } from '../lib/dateHelpers'
import { Card, Btn, Modal, Badge, Lbl } from './ui/Primitives'

export function RencanaHarian({rawData,woData,renhar,setRenhar,pekerja,createRenhar,updateRenhar,removeRenhar,logActivity,logAct,log,user,livePanelTypes}:any){
  const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [selDate,setSelDate]=useState(TODAY);
  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);
  const [selProses,setSelProses]=useState("ALL");
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  // Antrian per (raw_id+wp+tanggal) - cegah dobel-insert renhar kalau tombol Rilis/Distribusi
  // diklik dua kali cepat / koneksi lambat (dua panggilan sama-sama baca "belum ada row" dari
  // state lokal yang belum sempat update, dua-duanya insert baru).
  const renharOpQueue=useRef<Record<string,Promise<any>>>({});
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);
  const [timerAktifData,setTimerAktifData]=useState<any[]>([]);

  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit,jumlah_orang,tipe_kapasitas"),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
    };
    fetchCap();
    const ch=supabase.channel("realtime-fcs-cap-raw-rencana")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // Timer yang lagi aktif berjalan (belum di-Stop) - buat status "Sedang Dikerjakan" walau qty belum diisi
  useEffect(()=>{
    const fetchTimerAktif=async()=>{
      const hariIni=new Date().toISOString().slice(0,10);
      const{data}=await supabase.from("fcs_timer_kerja").select("panel_id,kode_komponen,proses,mulai").is("selesai",null).eq("tanggal",hariIni);
      setTimerAktifData(data??[]);
    };
    fetchTimerAktif();
    const ch=supabase.channel("realtime-timer-aktif-rencana")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},fetchTimerAktif)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const getTimerAktif=(panelId:any,kode:string,proses:string)=>
    timerAktifData.find((t:any)=>String(t.panel_id)===String(panelId)&&t.kode_komponen===kode&&t.proses===proses);
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

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
  const allTasks=useMemo(()=>{
    const tasks=[];
    rawData.forEach(row=>{
      const entries=row.schedule?.[selDate]||[];
      entries.forEach(e=>{
        tasks.push({
          rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
          proyek:row.proyek,panel:row.panel,proses:row.proses,
          prioritas:row.prioritas||"Sedang",
          wp:e.wp,komponen:e.komponen,tanggal:selDate,
        });
      });
      // Tambah busbar tasks dari busbar_schedule
      if(row.proses==="BUSBAR"){
        const busbarItems=row.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          // Cek apakah sudah ada dari renhar (hindari duplikat)
          const alreadyInSchedule=entries.some(e=>e.wp==="BUSBAR");
          if(!alreadyInSchedule){
            tasks.push({
              rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
              proyek:row.proyek,panel:row.panel,proses:row.proses,
              prioritas:row.prioritas||"Sedang",
              wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,
              isBusbar:true,
            });
          }
        }
      }
    });
    return tasks;
  },[rawData,selDate]);
  const filteredTasks=selProses==="ALL"?allTasks:allTasks.filter(t=>t.proses===selProses);
  const byProses=useMemo(()=>{
    const map={};
    filteredTasks.forEach(t=>{if(!map[t.proses])map[t.proses]=[];map[t.proses].push(t);});
    return map;
  },[filteredTasks]);
  const taskCountByDay=useMemo(()=>{
    const map={};
    days.forEach(d=>{let count=0;rawData.forEach(row=>{const e=row.schedule?.[d]||[];count+=e.length;});map[d]=count;});
    return map;
  },[days,rawData]);
  const getRenharEntry=(task)=>renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal);
  // Serialisasi per (raw_id+wp+tanggal) + fetch fresh dari DB sebelum putuskan create-atau-
  // update, biar dua panggilan yang nembak nyaris bersamaan (double-klik Rilis/Distribusi,
  // atau koneksi lambat) gak dua-duanya insert row baru buat kombinasi yang sama.
  const withRenharQueue=async(task:any,fn:(existingFresh:any)=>Promise<void>)=>{
    const key=`${task.rawId}_${task.wp}_${task.tanggal}`;
    const prev=renharOpQueue.current[key]||Promise.resolve();
    const thisOp=prev.then(async()=>{
      const{data}=await supabase.from("renhar").select("*")
        .eq("raw_id",task.rawId).eq("wp",task.wp).eq("tanggal",task.tanggal).limit(1);
      await fn(data?.[0]||null);
    });
    renharOpQueue.current[key]=thisOp;
    await thisOp;
  };
  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=getRenharEntry(task);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };

  const toggleReleaseKomponen=async(task:any,kode:string,sedangDirilis:boolean)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>(ps as string[]).includes(task.proses))?.[0]||"mekanik";
    await withRenharQueue(task,async(existing)=>{
      if(existing){
        const releasedLama=existing.komponen_released||[];
        const releasedBaru=sedangDirilis?releasedLama.filter((k:string)=>k!==kode):[...releasedLama,kode];
        await updateRenhar(existing.id,{komponen_released:releasedBaru});
        setRenhar((prev:any)=>prev.some((r:any)=>r.id===existing.id)?prev.map((r:any)=>r.id===existing.id?{...r,komponen_released:releasedBaru}:r):[...prev,{...existing,komponen_released:releasedBaru}]);
      } else {
        const result=await createRenhar({
          raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
          proyek:task.proyek,panel:task.panel,proses:task.proses,
          prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
          tanggal:task.tanggal,divisi,pekerja:[],komponen_released:[kode],
        });
        if(result?.success&&result.data){setRenhar((prev:any)=>prev.some((r:any)=>r.id===result.data.id)?prev:[...prev,result.data]);}
      }
    });
  };
  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi}=assignModal;
    await withRenharQueue(task,async(existing)=>{
      if(existing){
        await updateRenhar(existing.id,{pekerja:selPekerja});
        setRenhar(prev=>prev.some(r=>r.id===existing.id)?prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r):[...prev,{...existing,pekerja:selPekerja}]);
      } else {
        const result=await createRenhar({
          raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
          proyek:task.proyek,panel:task.panel,proses:task.proses,
          prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
          tanggal:task.tanggal,divisi,pekerja:selPekerja,
        });
        if(result?.success&&result.data){setRenhar(prev=>prev.some(r=>r.id===result.data.id)?prev:[...prev,result.data]);}
      }
    });
    if(log) await log("DISTRIBUSI RENHAR","Distribusi operator proses "+task.proses+" - "+task.panel+" ("+task.tanggal+")","renhar",{module:"rencana",action_type:"distribute",proyek:task.proyek||"",panel:task.panel||"",wo_number:task.woId?.toString()||"",halaman:"Rencana Harian"});
    setAssignModal(null);setSelPekerja([]);
  };
  const distributeAll=async()=>{
    for(const task of filteredTasks){
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
      const allKode=task.komponen||[];
      await withRenharQueue(task,async(existing)=>{
        if(existing){
          const releasedLama=existing.komponen_released||[];
          const releasedBaru=[...new Set([...releasedLama,...allKode])];
          if(releasedBaru.length===releasedLama.length)return;
          await updateRenhar(existing.id,{komponen_released:releasedBaru});
          setRenhar(prev=>prev.some(r=>r.id===existing.id)?prev.map(r=>r.id===existing.id?{...r,komponen_released:releasedBaru}:r):[...prev,{...existing,komponen_released:releasedBaru}]);
        } else {
          const result=await createRenhar({
            raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
            proyek:task.proyek,panel:task.panel,proses:task.proses,
            prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
            tanggal:task.tanggal,divisi,pekerja:[],komponen_released:allKode,
          });
          if(result?.success&&result.data){setRenhar(prev=>prev.some(r=>r.id===result.data.id)?prev:[...prev,result.data]);}
        }
      });
    }
  };
  const isDist=(task)=>!!getRenharEntry(task);
  const countKomponen=(list)=>list.reduce((s,t)=>s+(t.komponen||[]).filter(k=>!k.startsWith("__wiring_")).length,0);
  const countReleased=(list)=>list.reduce((s,t)=>{
    const rh=getRenharEntry(t);
    const released=rh?.komponen_released||[];
    return s+(t.komponen||[]).filter(k=>!k.startsWith("__wiring_")).filter(k=>released.includes(k)).length;
  },0);
  const distCount=countReleased(filteredTasks);
  const totalKompFiltered=countKomponen(filteredTasks);
  const allDist=totalKompFiltered>0&&distCount===totalKompFiltered;
  return(
    <div className="fi">
      <Card style={{marginBottom:10,padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Btn outline color="#2563eb" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,-7))}>{"◀"}</Btn>
          <button onClick={()=>{setWeekStart(TODAY);setSelDate(TODAY);}} style={{padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:700,color:"#64748b",cursor:"pointer"}}>Hari Ini</button>
          <Btn outline color="#2563eb" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,7))}>{"▶"}</Btn>
          <span style={{fontSize:13,fontWeight:700,color:"#1e293b",marginLeft:4}}>{fmtShort(weekStart)} — {fmtShort(addDays(weekStart,6))}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
          {days.map(d=>{
            const isSel=d===selDate;const isToday=d===TODAY;const cnt=taskCountByDay[d]||0;
            return(
              <button key={d} onClick={()=>setSelDate(d)}
                style={{padding:"8px 4px",borderRadius:10,border:`2px solid ${isSel?"#2563eb":isToday?"#93c5fd":"#e2e8f0"}`,
                  background:isSel?"#2563eb":isToday?"#eff6ff":"#fff",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                <div style={{fontSize:10,fontWeight:600,color:isSel?"#fff":isToday?"#2563eb":"#94a3b8",marginBottom:2}}>{getDayLabel(d).split(" ")[0]}</div>
                <div style={{fontSize:14,fontWeight:800,color:isSel?"#fff":isToday?"#1d4ed8":"#1e293b"}}>{getDayLabel(d).split(" ")[1]||d.slice(8)}</div>
                {cnt>0&&<div style={{marginTop:4,background:isSel?"#ffffff33":"#2563eb",borderRadius:20,padding:"1px 6px",fontSize:9,fontWeight:700,color:"#fff",display:"inline-block"}}>{cnt}</div>}
              </button>
            );
          })}
        </div>
      </Card>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>📅 {fmtDateFull(selDate)}</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {totalKompFiltered>0&&<span style={{fontSize:12,color:"#64748b"}}>{distCount}/{totalKompFiltered} dirilis</span>}
          {!allDist&&totalKompFiltered>0&&<Btn color="#16a34a" style={{fontSize:12,padding:"6px 16px"}} onClick={distributeAll}>📤 Rilis Semua</Btn>}
          {allDist&&totalKompFiltered>0&&<span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700}}>✅ Semua Dirilis</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setSelProses("ALL")} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${selProses==="ALL"?"#1d4ed8":"#e2e8f0"}`,background:selProses==="ALL"?"#1d4ed8":"#fff",color:selProses==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua ({allTasks.length})</button>
        {ALL_PROSES.filter(pr=>allTasks.some(t=>t.proses===pr)).map(pr=>{
          const pc=PROSES_COLOR[pr]||"#64748b";const cnt=allTasks.filter(t=>t.proses===pr).length;const isSel=selProses===pr;
          return(<button key={pr} onClick={()=>setSelProses(isSel?"ALL":pr)} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr} ({cnt})</button>);
        })}
      </div>
      {filteredTasks.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📭</div>
          <div style={{fontSize:14,fontWeight:600}}>Tidak ada pekerjaan pada tanggal ini</div>
          <div style={{fontSize:12,marginTop:4}}>Tambahkan jadwal di Raw Schedule terlebih dahulu</div>
        </div>
      )}
      {ALL_PROSES.filter(proses=>byProses[proses]).map(proses=>{
        const tasks=byProses[proses]||[];
        const pc=PROSES_COLOR[proses]||"#64748b";
        const divisiKey=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(proses))?.[0];
        const dc=divisiKey?DIVISI_CONFIG[divisiKey]:null;
        const distTasks=countReleased(tasks);
        const totalTasksKomp=countKomponen(tasks);
        const thS={background:"#1e3a8a",color:"#fff",padding:"6px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap",textAlign:"left",position:"sticky",top:0,borderRight:"1px solid #ffffff18"};
        return(
          <div key={proses} style={{marginBottom:20}}>
            <div style={{background:pc,borderRadius:"7px 7px 0 0",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:900,fontSize:15,color:"#fff"}}>{proses}</span>
                {dc&&<span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{dc.icon} {dc.label}</span>}
                <span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{tasks.length} tugas</span>
              </div>
              <span style={{fontSize:11,color:"#ffffff99",fontWeight:600}}>{distTasks}/{totalTasksKomp} dirilis</span>
            </div>
            <div style={{overflowX:"auto",border:"1px solid #e2e8f0",borderTop:"none",borderRadius:"0 0 10px 10px"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed"}}>
                <thead>
                  <tr>
                    <th style={{...thS,width:40,textAlign:"center"}}>No</th>
                    <th style={{...thS,width:130}}>Proyek</th>
                    <th style={{...thS,width:200}}>Nama Panel</th>
                    <th style={{...thS,width:60,textAlign:"center"}}>WP</th>
                    <th style={{...thS,width:80,textAlign:"center"}}>Prioritas</th>
                    <th style={{...thS,width:250}}>Komponen</th>
                    <th style={{...thS,width:160}}>Operator</th>
                    <th style={{...thS,width:110,textAlign:"center"}}>Status</th>
                    <th style={{...thS,width:120,textAlign:"center"}}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.flatMap((t,ti)=>{
                    const dist=isDist(t);const rh=getRenharEntry(t);
                    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t.panelId);
                    const cfg2=panelData?getEffCfg(panelData.tipe):null;
                    const wc=WP_COLOR[t.wp]||"#64748b";const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
                    const isWiringTask=true; // semua proses pakai flow Rilis/Tarik per-komponen (operator pilih sendiri di Vista Pekerja)

                    if(isWiringTask){
                      const ppk=rh?.pekerja_per_komponen||{};
                      const released=rh?.komponen_released||[];
                      return(t.komponen||[]).filter(kode=>!kode.startsWith("__wiring_")).map((kode,ki)=>{
                        const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===kode);
                        const idxGlobal=ti*100+ki;
                        const rBg=idxGlobal%2===0?"#fff":"#f8fafc";
                        const sudahRelease=released.includes(kode);
                        const workersKode=(ppk[kode]||[]).map((id:number)=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean);
                        const td={padding:"5px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:sudahRelease?"#f0fdf4":rBg,verticalAlign:"middle"};
                        return(
                          <tr key={ti+"-"+kode}>
                            <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{ti+1}.{ki+1}</td>
                            <td style={{...td,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                            <td style={{...td,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                            <td style={{...td,textAlign:"center"}}><span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span></td>
                            <td style={{...td,textAlign:"center"}}><span style={{background:priColor+"18",color:priColor,border:`1px solid ${priColor}33`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{t.prioritas}</span></td>
                            <td style={{...td}}>
                              <span style={{background:"#f1f5f9",borderRadius:4,padding:"2px 7px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||kode}</span>
                            </td>
                            <td style={{...td}}>
                              {!sudahRelease?(
                                <span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum dirilis</span>
                              ):workersKode.length>0?(
                                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{workersKode.map((n:string)=>(<span key={n} style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>👤 {n}</span>))}</div>
                              ):(<span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Pilih sendiri di tablet</span>)}
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              {(()=>{
                                if(!sudahRelease){
                                  return <span style={{background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#94a3b8",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>Belum Dirilis</span>;
                                }
                                const pctKerja=panelData?.checklist?.[kode]?.progress?.[t.proses]||0;
                                // BUSBAR: tambahin label tahap aktif (Fabrikasi/Plating/Heat-Shrink/Pasang)
                                // kalau datanya ada - proses lain gak punya field ini jadi tetap tampil polos.
                                const busbarTahapAktif=t.proses==="BUSBAR"?panelData?.checklist?.[kode]?.busbarTahap?.tahapAktif:null;
                                const BUSBAR_TAHAP_LABEL:Record<string,string>={FABRIKASI:"Fabrikasi",PLATING:"Plating",HEATSHRINK:"Heat-Shrink",PASANG:"Pasang"};
                                const labelTahap=busbarTahapAktif&&BUSBAR_TAHAP_LABEL[busbarTahapAktif]?` · ${BUSBAR_TAHAP_LABEL[busbarTahapAktif]}`:"";
                                if(pctKerja>=100){
                                  return <span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✅ Selesai</span>;
                                }
                                if(pctKerja>0){
                                  return <span style={{background:"#fffbeb",border:"1px solid #fde68a",color:"#ca8a04",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>🟡 Sedang Dikerjakan ({pctKerja}%{labelTahap})</span>;
                                }
                                const timerAktif=getTimerAktif(t.panelId,kode,t.proses);
                                if(timerAktif){
                                  const totalDetikAktif=Math.max(0,Math.floor((Date.now()-new Date(timerAktif.mulai).getTime())/1000));
                                  const menitBerjalan=Math.floor(totalDetikAktif/60);
                                  const labelDurasiAktif=menitBerjalan>0?`${menitBerjalan} menit`:`${totalDetikAktif} detik`;
                                  return <span style={{background:"#fffbeb",border:"1px solid #fde68a",color:"#ca8a04",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>🟡 Sedang Dikerjakan ({labelDurasiAktif})</span>;
                                }
                                return <span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>🔴 Belum Dikerjakan</span>;
                              })()}
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              <Btn color={sudahRelease?"#dc2626":"#2563eb"} style={{fontSize:11,padding:"5px 14px"}} onClick={()=>toggleReleaseKomponen(t,kode,sudahRelease)}>{sudahRelease?"↩️ Tarik":"📤 Rilis"}</Btn>
                            </td>
                          </tr>
                        );
                      });
                    }

                    const workers=(rh?.pekerja||[]).map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean);
                    const rBg=ti%2===0?"#fff":"#f8fafc";
                    const td={padding:"5px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:dist?"#f0fdf4":rBg,verticalAlign:"middle"};
                    return[(
                      <tr key={ti}>
                        <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{ti+1}</td>
                        <td style={{...td,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                        <td style={{...td,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                        <td style={{...td,textAlign:"center"}}><span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span></td>
                        <td style={{...td,textAlign:"center"}}><span style={{background:priColor+"18",color:priColor,border:`1px solid ${priColor}33`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{t.prioritas}</span></td>
                        <td style={{...td}}>
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return(<span key={k} style={{background:"#f1f5f9",borderRadius:4,padding:"2px 7px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>);})}
                          </div>
                        </td>
                        <td style={{...td}}>
                          {workers.length>0?(
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{workers.map(n=>(<span key={n} style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>👤 {n}</span>))}</div>
                          ):(<span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum diassign</span>)}
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          {dist?<span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✅ Terdistribusi</span>
                            :<span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>⏳ Belum</span>}
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          <Btn color={dist?"#0891b2":"#2563eb"} style={{fontSize:11,padding:"5px 14px"}} onClick={()=>openAssign(t)}>{dist?"👥 Edit":"👤 Distribusi"}</Btn>
                        </td>
                      </tr>
                    )];
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {assignModal&&(()=>{
        const{task,divisi,existing}=assignModal;const dc=DIVISI_CONFIG[divisi];
        const pekerjaDivisi=pekerja.filter(p=>p.divisi===divisi);
        return(
          <Modal title={(assignModal.isExisting?"Edit":"Distribusi")+" — "+task.proses} onClose={()=>{setAssignModal(null);setSelPekerja([]);}} width={460}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{task.proyek} · {task.panel}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              <Badge label={task.proses} color={PROSES_COLOR[task.proses]||"#64748b"}/>
              <Badge label={task.wp} color={WP_COLOR[task.wp]||"#64748b"}/>
              {dc&&<Badge label={dc.label} color={dc.color}/>}
              <Badge label={task.prioritas} color={PRIORITAS_COLOR[task.prioritas]||"#64748b"}/>
            </div>
            <Lbl>{"Pilih Operator ("+(dc?.label||divisi)+")"}</Lbl>
            {pekerjaDivisi.length===0?(
              <div style={{padding:"16px",background:"#f8fafc",borderRadius:8,fontSize:12,color:"#94a3b8",textAlign:"center"}}>Belum ada pekerja di divisi ini.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaDivisi.map(p=>{
                  const isSel=selPekerja.includes(p.id);
                  return(
                    <div key={p.id} onClick={()=>setSelPekerja(prev=>isSel?prev.filter(id=>id!==p.id):[...prev,p.id])}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${isSel?(dc?.color||"#2563eb"):"#e2e8f0"}`,background:isSel?(dc?.bg||"#eff6ff"):"#f8fafc",transition:"all .15s"}}>
                      <div style={{width:28,height:28,borderRadius:8,background:isSel?(dc?.color||"#2563eb"):(dc?.bg||"#eff6ff"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:isSel?"#fff":(dc?.color||"#2563eb")}}>{isSel?"✓":(dc?.icon||"👤")}</div>
                      <span style={{fontWeight:isSel?700:500,fontSize:13,color:isSel?(dc?.color||"#2563eb"):"#475569"}}>{p.nama}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {selPekerja.length>0&&(
              <div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:14,fontSize:12,color:"#16a34a",fontWeight:600}}>
                ✓ {selPekerja.length} operator dipilih: {selPekerja.map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>{setAssignModal(null);setSelPekerja([]);}}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmDistribute}>{assignModal.isExisting?"Simpan":"Distribusi"}</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
