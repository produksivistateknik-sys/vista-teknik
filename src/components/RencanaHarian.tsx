import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { PANEL_TYPES, DIVISI_PROSES, DIVISI_CONFIG, ALL_PROSES, PROSES_COLOR, WP_COLOR, PRIORITAS_COLOR, PROSES_ORANG_RAW_GLOBAL } from '../constants/panelTypes'
import { TODAY, addDays, fmtShort, getDayLabel, fmtDateFull, getHariKerjaSekarang } from '../lib/dateHelpers'
import { getProgressAsOfDate, computeProsesStatus, getRelevantProsesForKode, getBestProgressMap, type ProsesStatus } from '../lib/panelHelpers'
import { fetchWiringHariKerjaMap, hitungProyeksiWiring } from '../services/fcsService'
import { markRenharDirty } from '../lib/globalState'
import { releaseKomponenToRenhar } from '../services/renharService'
import { Card, Btn, Modal, Badge, Lbl } from './ui/Primitives'

// Warna status pipeline (readiness per-komponen) - beda dari statusStyle di TaskMonitoring.tsx
// (itu urusan tampilan sendiri, sengaja gak diseragamkan warnanya, cuma computeProsesStatus()
// yang sumbernya sama).
const STATUS_PIPELINE_STYLE:Record<ProsesStatus,{bg:string,color:string,border:string}>={
  "NOT YET":{bg:"#f1f5f9",color:"#64748b",border:"#e2e8f0"},
  "TO DO":{bg:"#eff6ff",color:"#2563eb",border:"#bfdbfe"},
  "IN PROGRESS":{bg:"#fffbeb",color:"#d97706",border:"#fde68a"},
  "DONE":{bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},
};
const STATUS_PIPELINE_LABEL:Record<ProsesStatus,string>={
  "NOT YET":"Not Yet","TO DO":"To Do","IN PROGRESS":"In Progress","DONE":"Done",
};

export function RencanaHarian({rawData,woData,renhar,setRenhar,pekerja,createRenhar,updateRenhar,removeRenhar,refetchRaw,withRenharQueue,logActivity,logAct,log,user,livePanelTypes}:any){
  const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [selDate,setSelDate]=useState(TODAY);
  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);
  const [selProses,setSelProses]=useState("ALL");
  const [statusFilter,setStatusFilter]=useState<"ALL"|ProsesStatus>("ALL");
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
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

  // WIRING CONTROL/POWER: "hari kerja ke-N" (dari histori fcs_timer_kerja) dipakai allTasks di
  // bawah buat tau kelanjutan hari kerja mana yang beneran "mendarat" di selDate - fungsi SAMA
  // PERSIS (hitungProyeksiWiring, fcsService.ts) yang dipakai Raw Schedule buat kalkulasi
  // kapasitas, satu sumber kebenaran, gak bisa "kesplit". Sama pola fetch kayak RawSchedule.tsx.
  const [wiringHariKerjaMap,setWiringHariKerjaMap]=useState<Record<string,string[]>>({});
  const wiringPanelIds=useMemo(()=>[...new Set(rawData.filter((r:any)=>PROSES_ORANG_RAW_GLOBAL.includes(r.proses)).map((r:any)=>Number(r.panel_id||r.panelId)))],[rawData]);
  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      const map=await fetchWiringHariKerjaMap(wiringPanelIds as number[]);
      if(!cancelled)setWiringHariKerjaMap(map);
    };
    load();
    const ch=supabase.channel("realtime-fcs-timer-kerja-rencana")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},load)
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[JSON.stringify(wiringPanelIds)]);

  // Operator yang BENERAN ngerjain di selDate (bisa beda dari pekerja_per_komponen renhar, yang
  // cuma nyatet assignment planner - satu komponen bisa dikerjain operator BEDA di hari beda kalau
  // ganti shift/orang). Sumbernya fcs_timer_kerja (sama kayak fitur Review Potong/Tracking Pekerja),
  // di-scope ke selDate doang (bukan semua tanggal) biar query-nya ringan. Ambil SEMUA record (bukan
  // cuma yang lagi aktif kayak timerAktifData di atas) - histori tanggal lama juga butuh ini.
  const [operatorHistoryData,setOperatorHistoryData]=useState<any[]>([]);
  useEffect(()=>{
    let cancelled=false;
    supabase.from("fcs_timer_kerja").select("panel_id,kode_komponen,proses,pekerja_id").eq("tanggal",selDate).then(({data}:any)=>{
      if(!cancelled)setOperatorHistoryData(data??[]);
    });
    const ch=supabase.channel("realtime-operator-history-rencana")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja",filter:"tanggal=eq."+selDate},()=>{
        supabase.from("fcs_timer_kerja").select("panel_id,kode_komponen,proses,pekerja_id").eq("tanggal",selDate).then(({data}:any)=>{
          if(!cancelled)setOperatorHistoryData(data??[]);
        });
      })
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
  },[selDate]);
  const getOperatorNamesForKode=(panelId:any,kode:string,proses:string):string[]=>{
    const ids=[...new Set(operatorHistoryData.filter((t:any)=>String(t.panel_id)===String(panelId)&&t.kode_komponen===kode&&t.proses===proses).map((t:any)=>t.pekerja_id))];
    return ids.map((id:any)=>pekerja.find((p:any)=>p.id===id)?.nama).filter(Boolean);
  };

  // Fallback kalau BELUM ADA yang mulai timer di selDate buat komponen ini (kasus carry-over
  // yang belum dilanjutkan lagi hari ini) - biar kolom operator gak pernah keliatan kosong/gak
  // jelas padahal komponennya udah pernah dikerjain (cuma bukan hari ini). Sumbernya RPC
  // latest_operator_per_komponen (agregasi SQL: tanggal aktivitas TERAKHIR <= selDate per
  // panel+kode+proses, plus semua operator yang kerja di tanggal itu) - dihitung di server biar
  // gak perlu tarik ribuan baris fcs_timer_kerja ke browser. WAJIB paginasi .range() - RPC yang
  // balikin table kena cap 1000 baris juga sama kayak .select() biasa (udah kejadian sebelumnya
  // di renhar, jangan diulang di sini).
  const [fallbackOperatorData,setFallbackOperatorData]=useState<any[]>([]);
  useEffect(()=>{
    let cancelled=false;
    const fetchFallback=async()=>{
      let all:any[]=[],from=0;
      while(true){
        const{data,error}:any=await supabase.rpc("latest_operator_per_komponen",{as_of_date:selDate}).range(from,from+999);
        if(error||!data)break;
        all=all.concat(data);
        if(data.length<1000)break;
        from+=1000;
      }
      if(!cancelled)setFallbackOperatorData(all);
    };
    fetchFallback();
    // Targeted refresh (audit egress Agu 2026) - dulu SETIAP event fcs_timer_kerja di seluruh
    // pabrik nge-trigger fetchFallback() ulang (scan seluruh WO/panel via RPC). Sekarang re-query
    // RPC yang sama tapi di-filter (via PostgREST .eq(), didukung utk RPC yang return table) ke
    // kombinasi panel+kode+proses yang berubah aja, lalu merge ke hasil yang sudah ada.
    const refreshFallbackKey=async(panelId:any,kode:string,proses:string)=>{
      if(!panelId||!kode||!proses)return;
      const{data,error}:any=await supabase.rpc("latest_operator_per_komponen",{as_of_date:selDate})
        .eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses",proses);
      if(error)return;
      if(cancelled)return;
      setFallbackOperatorData(prev=>{
        const rest=prev.filter((t:any)=>!(String(t.panel_id)===String(panelId)&&t.kode_komponen===kode&&t.proses===proses));
        return[...rest,...(data||[])];
      });
    };
    const ch=supabase.channel("realtime-fallback-operator-rencana")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},(payload:any)=>{
        const row=payload.new||payload.old;
        if(row?.panel_id)refreshFallbackKey(row.panel_id,row.kode_komponen,row.proses);
        else fetchFallback();
      })
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
  },[selDate]);
  const getFallbackOperatorForKode=(panelId:any,kode:string,proses:string):{names:string[],tanggal:string|null}=>{
    const rows=fallbackOperatorData.filter((t:any)=>String(t.panel_id)===String(panelId)&&t.kode_komponen===kode&&t.proses===proses);
    if(rows.length===0)return{names:[],tanggal:null};
    const ids=[...new Set(rows.map((t:any)=>t.pekerja_id))];
    const names=ids.map((id:any)=>pekerja.find((p:any)=>p.id===id)?.nama).filter(Boolean);
    return{names,tanggal:rows[0].tanggal};
  };

  // Fallback TERAKHIR kalau fcs_timer_kerja gak punya baris SAMA SEKALI buat komponen ini
  // (progress dikunci lewat "Kunci Progress" di Vista Pekerja tanpa timer - proses non-WIRING/
  // non-BUSBAR memang gak wajib timer buat lock, lihat audit operator kosong) - progress_
  // checkpoint_log tetap nyimpen pekerja_nama (teks, bukan id) tiap kali dikunci, dipakai di sini
  // biar operator gak keliatan "Pilih sendiri di tablet" padahal sebenarnya sudah ada yang ngerjain.
  const [checkpointOperatorData,setCheckpointOperatorData]=useState<any[]>([]);
  useEffect(()=>{
    let cancelled=false;
    const fetchCheckpoint=async()=>{
      let all:any[]=[],from=0;
      while(true){
        const{data,error}:any=await supabase.from("progress_checkpoint_log").select("panel_id,kode_komponen,proses,pekerja_nama,tanggal").lte("tanggal",selDate).range(from,from+999);
        if(error||!data)break;
        all=all.concat(data);
        if(data.length<1000)break;
        from+=1000;
      }
      if(!cancelled)setCheckpointOperatorData(all);
    };
    fetchCheckpoint();
    // Targeted refresh (audit egress Agu 2026) - sama pola kayak refreshFallbackKey di atas,
    // cuma re-query kombinasi panel+kode+proses yang berubah, bukan seluruh histori checkpoint.
    const refreshCheckpointKey=async(panelId:any,kode:string,proses:string)=>{
      if(!panelId||!kode||!proses)return;
      const{data,error}=await supabase.from("progress_checkpoint_log")
        .select("panel_id,kode_komponen,proses,pekerja_nama,tanggal")
        .eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses",proses).lte("tanggal",selDate);
      if(error||cancelled)return;
      setCheckpointOperatorData(prev=>{
        const rest=prev.filter((t:any)=>!(String(t.panel_id)===String(panelId)&&t.kode_komponen===kode&&t.proses===proses));
        return[...rest,...(data||[])];
      });
    };
    const ch=supabase.channel("realtime-checkpoint-operator-rencana")
      .on("postgres_changes",{event:"*",schema:"public",table:"progress_checkpoint_log"},(payload:any)=>{
        const row=payload.new||payload.old;
        if(row?.panel_id)refreshCheckpointKey(row.panel_id,row.kode_komponen,row.proses);
        else fetchCheckpoint();
      })
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
  },[selDate]);
  const getCheckpointOperatorForKode=(panelId:any,kode:string,proses:string):{names:string[],tanggal:string|null}=>{
    const rows=checkpointOperatorData.filter((t:any)=>String(t.panel_id)===String(panelId)&&t.kode_komponen===kode&&t.proses===proses);
    if(rows.length===0)return{names:[],tanggal:null};
    const terbaru=rows.slice().sort((a:any,b:any)=>b.tanggal.localeCompare(a.tanggal))[0];
    const names=[...new Set(rows.filter((r:any)=>r.tanggal===terbaru.tanggal).flatMap((r:any)=>String(r.pekerja_nama||"").split(",").map((n:string)=>n.trim()).filter(Boolean)))];
    return{names,tanggal:terbaru.tanggal};
  };

  // Maksa re-render tiap detik SELAMA ada timer yang lagi jalan, biar label durasi "Sedang
  // Dikerjakan (X menit)" keliatan jalan live - sebelumnya beku, cuma keupdate kalau ada
  // perubahan lain di tabel fcs_timer_kerja (start/stop timer manapun). Interval cuma nyala
  // pas ada timer aktif buat hemat, gak jalan terus-terusan pas nganggur.
  const [,setTimerTick]=useState(0);
  useEffect(()=>{
    if(timerAktifData.length===0)return;
    const iv=setInterval(()=>setTimerTick(t=>t+1),1000);
    return ()=>clearInterval(iv);
  },[timerAktifData]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
  const allPanelsFlat=useMemo(()=>woData.flatMap((w:any)=>(w.panels||[]).map((p:any)=>({...p,_wo:w}))),[woData]);
  // WIRING CONTROL/POWER: kelanjutan hari kerja yang BELUM punya entri asli di row.schedule[selDate]
  // digabung LANGSUNG ke allTasks di sini (bukan array "proyeksi" terpisah lagi, lihat commit
  // sebelumnya) - operator yang ngerjain wiring emang beneran dialokasikan (dikonfirmasi lewat
  // fcs_timer_kerja), jadi diperlakukan IDENTIK proses lain: dapat tombol Rilis/Tarik asli
  // (toggleReleaseKomponen/createRenhar di bawah cuma nulis ke tabel renhar, SAMA SEKALI gak
  // nyentuh raw_schedule/kalkulasi kapasitas bobot) - tanpa label "proyeksi" apapun. "Real selalu
  // menang, gak boleh dobel-hitung": kode yang SUDAH ada entri asli di row.schedule[selDate]
  // di-skip (persis pola kodeRealHariIni di RawSchedule.tsx, Capacity Utilization card - dulu
  // pola dedup ini gak ikut kebawa pas logic proyeksi ini dipakai di Rencana Harian, jadi kode
  // yang udah real malah dobel tampil: sekali normal, sekali lagi sebagai "hantu" proyeksi).
  const allTasks=useMemo(()=>{
    const tasks=[];
    rawData.forEach(row=>{
      // NAMEPLATE/YELLOWMARK murni penanda whole-panel (komponen:["MARKED"], bukan kode BOM asli) -
      // jangan pernah masuk allTasks, supaya gak ikut kena distributeAll/Rilis Semua (yang bakal
      // bikin baris renhar palsu). Progress & tampilannya ditangani section terpisah di bawah,
      // baca raw_schedule langsung, gak lewat renhar sama sekali.
      if(row.proses==="NAMEPLATE"||row.proses==="YELLOWMARK")return;
      const entries=row.schedule?.[selDate]||[];
      entries.forEach(e=>{
        tasks.push({
          rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
          proyek:row.proyek,panel:row.panel,proses:row.proses,
          prioritas:row.prioritas||"Sedang",
          wp:e.wp,komponen:e.komponen,tanggal:selDate,
          carriedOverFrom:e.carriedOverFrom||null,
          digeserKe:e.digeserKe||null,
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
      if(PROSES_ORANG_RAW_GLOBAL.includes(row.proses)){
        const panelIdRow=row.panel_id||row.panelId;
        const panelData=allPanelsFlat.find((p:any)=>p.id===panelIdRow);
        const kodeRealSelDate=new Set<string>(entries.flatMap((e:any)=>e.komponen||[]));
        // Kalau satu kode punya BEBERAPA entry asli (mis. dijadwal ulang manual tanpa lewat
        // pointer digeserKe, jadi entry lama gak ketandai "sudah pindah") - cuma entry PALING
        // BARU per kode yang boleh diproyeksikan maju. Tanpa ini, entry lama & baru bisa
        // dobel-proyeksi ke tanggal yang sama (kode yang sama muncul 2x).
        const latestLiveDateByKode:Record<string,string>={};
        Object.entries(row.schedule||{}).forEach(([ld,ents]:[string,any])=>{
          (ents||[]).forEach((e:any)=>(e.komponen||[]).forEach((kode:string)=>{
            if(kode.startsWith("__wiring_"))return;
            if(!latestLiveDateByKode[kode]||ld>latestLiveDateByKode[kode])latestLiveDateByKode[kode]=ld;
          }));
        });
        Object.entries(row.schedule||{}).forEach(([liveDate,liveEntries]:[string,any])=>{
          if(liveDate===selDate)return;
          (liveEntries||[]).forEach((e:any)=>{
            const kodeLanjut:string[]=[];
            (e.komponen||[]).forEach((kode:string)=>{
              if(kode.startsWith("__wiring_"))return;
              if(e.digeserKe?.[kode])return;
              if(kodeRealSelDate.has(kode))return;
              if(latestLiveDateByKode[kode]!==liveDate)return;
              const progress=panelData?.checklist?.[kode]?.progress?.[row.proses]||0;
              if(progress>=100)return;
              const bobot=row.bobot_komponen?.[kode];
              const mendarat=hitungProyeksiWiring(panelIdRow,kode,row.proses,e.wp,liveDate,bobot,wiringHariKerjaMap).some(p=>p.tanggal===selDate);
              if(mendarat)kodeLanjut.push(kode);
            });
            if(kodeLanjut.length>0){
              tasks.push({
                rawId:row.id,woId:row.wo_id||row.woId,panelId:panelIdRow,
                proyek:row.proyek,panel:row.panel,proses:row.proses,
                prioritas:row.prioritas||"Sedang",
                wp:e.wp,komponen:kodeLanjut,tanggal:selDate,
                carriedOverFrom:liveDate,digeserKe:null,
              });
            }
          });
        });
      }
    });
    return tasks;
  },[rawData,selDate,allPanelsFlat,wiringHariKerjaMap]);

  // Section terpisah, gak lewat renhar/allTasks sama sekali: baca raw_schedule langsung buat
  // NAMEPLATE/YELLOWMARK (penanda "dijadwalkan hari ini"), digabung sama progress LIVE dari
  // panels.nameplate_progress/yellowmark_progress (sistem yang sudah ada, lihat NameplateView
  // di Vista Pekerja) - biar planner tahu siapa lagi kerjakan apa tanpa perlu alur Rilis/Tarik.
  const npYmMarked=useMemo(()=>{
    const items:any[]=[];
    rawData.forEach((row:any)=>{
      if(row.proses!=="NAMEPLATE"&&row.proses!=="YELLOWMARK")return;
      const entries=row.schedule?.[selDate]||[];
      if(entries.length===0)return;
      const panel=allPanelsFlat.find((p:any)=>p.id===(row.panel_id||row.panelId));
      if(!panel)return;
      items.push({rawId:row.id,proses:row.proses,panel});
    });
    return items;
  },[rawData,selDate,allPanelsFlat]);
  const fmtRelatif=(iso:string)=>{
    if(!iso)return"";
    const menit=Math.floor((Date.now()-new Date(iso).getTime())/60000);
    if(menit<1)return"baru saja";
    if(menit<60)return`${menit} menit lalu`;
    const jam=Math.floor(menit/60);
    if(jam<24)return`${jam} jam lalu`;
    return`${Math.floor(jam/24)} hari lalu`;
  };

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
  // String(...) di raw_id - Supabase Realtime kadang ngirim kolom integer/bigint sebagai STRING
  // di payload event (beda dari fetch normal yang balikin number) - kalau row ini kena update
  // via realtime, r.raw_id bisa jadi "123" padahal task.rawId tetap number 123, bikin === gagal
  // diam2 dan getRenharEntry balik undefined - PERSIS gejala "udah rilis di DB tapi kelihatan
  // Belum Dirilis di layar" tanpa data-nya beneran berubah.
  const getRenharEntry=(task)=>renhar.find(r=>String(r.raw_id||r.rawId)===String(task.rawId)&&r.wp===task.wp&&r.tanggal===task.tanggal);
  // withRenharQueue sekarang dibagi dari App.tsx (lihat komentar di sana) - Rencana Harian &
  // Raw Schedule pakai queue yang SAMA, bukan masing2 punya sendiri, biar tulisan lintas-tab
  // yang mounted bareng tetap terserialisasi.
  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=getRenharEntry(task);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };

  // Kunci per (raw_id+wp+tanggal+kode) selagi toggle-nya masih diproses - klik susulan yang
  // masuk SEBELUM request pertama kelar diabaikan, bukan diantre. Ini nutup 2 masalah:
  // 1. Klik ganda/cepat (dobel-tap) yang kena tombol yang BARU SAJA berubah label (Rilis <->
  //    Tarik) gara2 optimistic update instan - sebelumnya klik kedua ini kebaca sebagai
  //    "batalkan rilis yang barusan berhasil", padahal user cuma mau klik sekali.
  // 2. Keputusan ADD/REMOVE sekarang selalu dari `existing.komponen_released` yang di-fetch
  //    FRESH di dalam withRenharQueue - bukan dari status `sudahRelease` yang dibekukan pas
  //    render/klik terjadi (itu bisa basi kalau ada request lain yang lebih dulu selesai).
  // Investigasi lanjutan (cek activity_log) nemuin akar masalah SEBENARNYA: bukan bug data,
  // tapi klik BERULANG di tombol yang sama (2-3 detik berselang - di luar jangkauan lock di
  // atas yang cuma nahan klik dalam hitungan milidetik) - user gak yakin klik pertama masuk
  // (gak ada konfirmasi visual jelas) jadi klik lagi, dan klik ke-2/3 itu kena tombol yang
  // SUDAH berubah jadi "Tarik" - toggle-nya sendiri sudah benar tiap kali, tapi jumlah klik
  // ganjil bikin hasil akhir kebalikan dari klik pertama. Fix: toast konfirmasi instan tiap
  // berhasil (biar gak ada dorongan klik ulang) + konfirmasi wajib sebelum "Tarik" (aksi yang
  // lebih "mahal" kalau ke-klik gak sengaja) - "Rilis" tetap satu klik langsung, gak diperlambat.
  const [pendingRelease,setPendingRelease]=useState<Set<string>>(new Set());
  const [toast,setToast]=useState<string|null>(null);
  const toastTimerRef=useRef<any>(null);
  const showToast=(msg:string)=>{
    setToast(msg);
    if(toastTimerRef.current)clearTimeout(toastTimerRef.current);
    toastTimerRef.current=setTimeout(()=>setToast(null),2500);
  };

  // Auto-geser sekarang trigger MANUAL (cron dinonaktifkan) - tombol kecil di baris navigasi
  // tanggal (bukan banner) yang nge-cek lewat dry-run preview apa ada hari ketinggalan belum
  // "ditarik". Realtime listen ke auto_geser_runs juga - kalau admin lain di tab lain udah klik
  // duluan, tombol ini ikut ilang tanpa perlu refresh manual.
  const [catchupInfo,setCatchupInfo]=useState<{hariMulai:string,jumlahKomponenTotal:number}|null>(null);
  const [catchupLoading,setCatchupLoading]=useState(false);
  const cekCatchup=async()=>{
    try{
      const res=await fetch(supabaseUrl+"/functions/v1/auto-geser-harian?dryRun=1",{
        method:"POST",headers:{"Authorization":"Bearer "+supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({dryRun:true}),
      });
      const d=await res.json();
      if(d?.success&&d.jumlahKomponenTotal>0){
        setCatchupInfo({hariMulai:d.hariMulai,jumlahKomponenTotal:d.jumlahKomponenTotal});
      } else {
        setCatchupInfo(null);
      }
    }catch{ /* gagal cek diam-diam - tombol cuma gak muncul, gak ganggu tampilan lain */ }
  };
  useEffect(()=>{
    cekCatchup();
    const ch=supabase.channel("realtime-auto-geser-runs-rencana")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"auto_geser_runs"},()=>cekCatchup())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);
  const tarikKeHariIni=async()=>{
    if(catchupLoading)return;
    setCatchupLoading(true);
    try{
      const uname=user?.name||user?.nama||"Admin";
      const res=await fetch(supabaseUrl+"/functions/v1/auto-geser-harian",{
        method:"POST",headers:{"Authorization":"Bearer "+supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({triggeredBy:uname}),
      });
      const d=await res.json();
      if(d?.success){
        if(d.jumlahKomponenTotal>0){
          const bagianDidorong=d.komponenDidorongTotal>0?`, ↪️ ${d.komponenDidorongTotal} didorong ke tanggal lain (kapasitas penuh)`:"";
          showToast(`✅ ${d.komponenLangsungTotal} komponen berhasil ditarik${bagianDidorong}`);
        } else {
          showToast("✅ Sudah ditarik, gak ada yang perlu digeser");
        }
        // BUG FIX (5 Sep 2026) - overbookWarnings dari edge function (mis. kapasitas WIRING
        // belum dikonfigurasi buat hari target, jadi sejumlah unit SENGAJA gak ikut ditarik -
        // rule no-displacement biar gak keulang insiden "loncat jauh" versi lama auto-geser)
        // dulu cuma kebaca dari activity_log lewat query manual - gak pernah ditunjukkin ke
        // admin yang mengklik tombol ini, jadi toast sukses di atas bikin kesannya semua beres
        // padahal ada komponen yang ketinggalan tanpa disadari. Sekarang tampil eksplisit lewat
        // alert (bukan toast biasa yang keburu hilang 2.5 detik) - ini butuh tindakan manual
        // (isi kapasitas kerja), jadi gak boleh kelewat.
        if(d.overbookWarnings&&d.overbookWarnings.length>0){
          alert("⚠️ PERLU REVIEW MANUAL - sebagian komponen TIDAK ikut ditarik:\n\n"+d.overbookWarnings.join("\n\n"));
        }
        setCatchupInfo(null);
        await refetchRaw?.();
      } else {
        alert("Gagal tarik: "+(d?.error||"unknown error"));
      }
    }catch(err:any){
      alert("Gagal tarik: "+(err?.message||String(err)));
    }
    setCatchupLoading(false);
  };
  const toggleReleaseKomponen=async(task:any,kode:string,namaTampil:string,kemungkinanSudahRelease:boolean)=>{
    const key=`${task.rawId}_${task.wp}_${task.tanggal}_${kode}`;
    if(pendingRelease.has(key))return;
    // Konfirmasi cuma buat aksi "Tarik" (batalkan rilis) - dipakai heuristik dari status render
    // terakhir (bisa sedikit basi, gak masalah karena keputusan ADD/REMOVE final tetap dari data
    // fresh di bawah - ini cuma buat nentuin perlu nanya "yakin?" atau enggak).
    if(kemungkinanSudahRelease){
      if(!window.confirm(`Batalkan rilis "${namaTampil}"? Operator gak akan bisa lihat/kerjakan lagi sampai dirilis ulang.`))return;
    }
    setPendingRelease(prev=>new Set(prev).add(key));
    try{
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>(ps as string[]).includes(task.proses))?.[0]||"mekanik";
      await withRenharQueue(task,async(existing)=>{
        if(existing){
          // IDEMPOTEN: tentukan hasil akhir dari NIAT klik (kemungkinanSudahRelease -> mau
          // Tarik; sebaliknya -> mau Rilis), BUKAN dari toggle buta berdasarkan fresh-fetch.
          // Kalau state lokal sempat basi (gak sinkron sama DB), klik Rilis SELALU berakhir
          // released, klik Tarik SELALU berakhir tidak-released - gak pernah kebalik lagi.
          const mauRilis=!kemungkinanSudahRelease;
          const{komponen:komponenBaru,komponen_released:releasedBaru}=releaseKomponenToRenhar(existing,[kode],mauRilis?"rilis":"tarik");
          await updateRenhar(existing.id,{komponen:komponenBaru,komponen_released:releasedBaru});
          markRenharDirty(existing.id);
          setRenhar((prev:any)=>prev.some((r:any)=>r.id===existing.id)?prev.map((r:any)=>r.id===existing.id?{...r,komponen:komponenBaru,komponen_released:releasedBaru}:r):[...prev,{...existing,komponen:komponenBaru,komponen_released:releasedBaru}]);
          showToast(mauRilis?`✅ "${namaTampil}" berhasil dirilis`:`↩️ "${namaTampil}" dibatalkan rilisnya`);
        } else {
          const result=await createRenhar({
            raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
            proyek:task.proyek,panel:task.panel,proses:task.proses,
            prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:Array.from(new Set(task.komponen||[])),
            tanggal:task.tanggal,divisi,pekerja:[],komponen_released:[kode],
          });
          if(!(result?.success&&result.data))throw Object.assign(new Error(result?.error||"Gagal membuat renhar"),{code:(result as any)?.code});
          markRenharDirty(result.data.id);
          setRenhar((prev:any)=>prev.some((r:any)=>r.id===result.data.id)?prev:[...prev,result.data]);
          showToast(`✅ "${namaTampil}" berhasil dirilis`);
        }
      });
    } finally {
      setPendingRelease(prev=>{const n=new Set(prev);n.delete(key);return n;});
    }
  };
  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi}=assignModal;
    await withRenharQueue(task,async(existing)=>{
      if(existing){
        await updateRenhar(existing.id,{pekerja:selPekerja});
        markRenharDirty(existing.id);
        setRenhar(prev=>prev.some(r=>r.id===existing.id)?prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r):[...prev,{...existing,pekerja:selPekerja}]);
      } else {
        const result=await createRenhar({
          raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
          proyek:task.proyek,panel:task.panel,proses:task.proses,
          prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:Array.from(new Set(task.komponen||[])),
          tanggal:task.tanggal,divisi,pekerja:selPekerja,
        });
        if(!(result?.success&&result.data))throw Object.assign(new Error(result?.error||"Gagal membuat renhar"),{code:(result as any)?.code});
        markRenharDirty(result.data.id);
        setRenhar(prev=>prev.some(r=>r.id===result.data.id)?prev:[...prev,result.data]);
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
          const releasedLamaLen=(existing.komponen_released||[]).length;
          const komponenLamaLen=(existing.komponen||[]).length;
          const{komponen:komponenBaru,komponen_released:releasedBaru}=releaseKomponenToRenhar(existing,allKode,"rilis");
          if(releasedBaru.length===releasedLamaLen&&komponenBaru.length===komponenLamaLen)return;
          await updateRenhar(existing.id,{komponen:komponenBaru,komponen_released:releasedBaru});
          markRenharDirty(existing.id);
          setRenhar(prev=>prev.some(r=>r.id===existing.id)?prev.map(r=>r.id===existing.id?{...r,komponen:komponenBaru,komponen_released:releasedBaru}:r):[...prev,{...existing,komponen:komponenBaru,komponen_released:releasedBaru}]);
        } else {
          const result=await createRenhar({
            raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
            proyek:task.proyek,panel:task.panel,proses:task.proses,
            prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:Array.from(new Set(task.komponen||[])),
            tanggal:task.tanggal,divisi,pekerja:[],komponen_released:allKode,
          });
          if(!(result?.success&&result.data))throw Object.assign(new Error(result?.error||"Gagal membuat renhar"),{code:(result as any)?.code});
          markRenharDirty(result.data.id);
          setRenhar(prev=>prev.some(r=>r.id===result.data.id)?prev:[...prev,result.data]);
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
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:9999,
          background:"#1e293b",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:600,
          boxShadow:"0 8px 24px #00000040",pointerEvents:"none"}}>
          {toast}
        </div>
      )}
      <Card style={{marginBottom:10,padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Btn outline color="#2563eb" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,-7))}>{"◀"}</Btn>
          <button onClick={()=>{setWeekStart(TODAY);setSelDate(TODAY);}} style={{padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:700,color:"#64748b",cursor:"pointer"}}>Hari Ini</button>
          <Btn outline color="#2563eb" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,7))}>{"▶"}</Btn>
          <span style={{fontSize:13,fontWeight:700,color:"#1e293b",marginLeft:4}}>{fmtShort(weekStart)} — {fmtShort(addDays(weekStart,6))}</span>
          {catchupInfo&&(
            <Btn color="#d97706" disabled={catchupLoading} onClick={tarikKeHariIni}
              title={"Ada "+catchupInfo.jumlahKomponenTotal+" komponen belum selesai dari "+fmtShort(catchupInfo.hariMulai)+", belum ditarik ke hari ini - auto-geser sekarang manual, gak jalan otomatis lagi."}
              style={{fontSize:11,padding:"5px 12px",marginLeft:"auto"}}>
              {catchupLoading?"⏳ Memproses...":`↪️ Tarik dari ${fmtShort(catchupInfo.hariMulai)} (${catchupInfo.jumlahKomponenTotal})`}
            </Btn>
          )}
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
        <button onClick={()=>setSelProses("ALL")} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${selProses==="ALL"?"#1d4ed8":"#e2e8f0"}`,background:selProses==="ALL"?"#1d4ed8":"#fff",color:selProses==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua ({allTasks.length+npYmMarked.length})</button>
        {ALL_PROSES.filter(pr=>allTasks.some(t=>t.proses===pr)).map(pr=>{
          const pc=PROSES_COLOR[pr]||"#64748b";const cnt=allTasks.filter(t=>t.proses===pr).length;const isSel=selProses===pr;
          return(<button key={pr} onClick={()=>setSelProses(isSel?"ALL":pr)} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr} ({cnt})</button>);
        })}
        {["NAMEPLATE","YELLOWMARK"].filter(pr=>npYmMarked.some((t:any)=>t.proses===pr)).map(pr=>{
          const pc=PROSES_COLOR[pr]||"#64748b";const cnt=npYmMarked.filter((t:any)=>t.proses===pr).length;const isSel=selProses===pr;
          return(<button key={pr} onClick={()=>setSelProses(isSel?"ALL":pr)} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr} ({cnt})</button>);
        })}
      </div>
      {/* Filter status pipeline (NOT YET/TO DO/IN PROGRESS/DONE) - cuma berlaku ke tabel proses
          yang masuk rantai ALL_PROSES (NAMEPLATE/YELLOWMARK gak punya kolom ini sama sekali). */}
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        {(["ALL","NOT YET","TO DO","IN PROGRESS","DONE"] as const).map(s=>{
          const sc=s==="ALL"?"#475569":STATUS_PIPELINE_STYLE[s].color;
          const isSel=statusFilter===s;
          return(
            <button key={s} onClick={()=>setStatusFilter(isSel?"ALL":s)}
              style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${isSel?sc:"#e2e8f0"}`,background:isSel?sc+"18":"#fff",color:isSel?sc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>
              {s==="ALL"?"Semua Status":STATUS_PIPELINE_LABEL[s]}
            </button>
          );
        })}
      </div>
      {filteredTasks.length===0&&npYmMarked.filter((t:any)=>selProses==="ALL"||t.proses===selProses).length===0&&(
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
        const thS={background:"#1e3a8a",color:"#fff",padding:"6px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap" as const,textAlign:"left" as const,position:"sticky" as const,top:0,borderRight:"1px solid #ffffff18"};
        return(
          <div key={proses} style={{marginBottom:20}}>
            <div style={{background:pc,borderRadius:"7px 7px 0 0",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:900,fontSize:15,color:"#fff"}}>{proses}</span>
                {dc&&<span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{dc.icon} {dc.label}</span>}
                {tasks.length>0&&<span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{tasks.length} tugas</span>}
              </div>
              {tasks.length>0&&<span style={{fontSize:11,color:"#ffffff99",fontWeight:600}}>{distTasks}/{totalTasksKomp} dirilis</span>}
            </div>
            {tasks.length>0&&(
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
                    <th style={{...thS,width:110,textAlign:"center"}}>Status Pipeline</th>
                    <th style={{...thS,width:120,textAlign:"center"}}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(()=>{
                  const renderedRows=tasks.flatMap((t,ti)=>{
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
                        const relevantProsesKode=panelData?getRelevantProsesForKode(kode,panelData.tipe):undefined;
                        const pipelineStatus=computeProsesStatus(getBestProgressMap(panelData?.checklist?.[kode]),t.proses,relevantProsesKode);
                        if(statusFilter!=="ALL"&&pipelineStatus!==statusFilter)return null;
                        const idxGlobal=ti*100+ki;
                        const rBg=idxGlobal%2===0?"#fff":"#f8fafc";
                        const sudahRelease=released.includes(kode);
                        const digeserKeTanggal=t.digeserKe?.[kode]||null;
                        // BUSBAR nyimpen pekerja_per_komponen[kode] sebagai OBJEK per-tahap
                        // ({FABRIKASI:[..],PLATING:[..],...}), bukan array datar kayak proses
                        // lain - flatten semua tahap jadi satu daftar id biar gak crash .map().
                        const ppkKode=ppk[kode];
                        const opIdsKode:number[]=Array.isArray(ppkKode)?ppkKode:(ppkKode&&typeof ppkKode==="object"?Object.values(ppkKode).flat() as number[]:[]);
                        // Prioritas: (1) nama dari timer beneran di tanggal INI (ground truth siapa
                        // yang ngerjain hari ini) - (2) kalau belum ada yang mulai timer HARI INI
                        // (kasus carry-over yang belum dilanjutkan lagi), fallback ke operator
                        // TERAKHIR yang beneran ngerjain (tanggal berapapun sebelumnya) - biar kolom
                        // operator gak pernah keliatan kosong/gak jelas padahal ada riwayatnya -
                        // (3) kalau fcs_timer_kerja gak punya baris SAMA SEKALI (progress dikunci
                        // tanpa timer), fallback ke pekerja_nama di progress_checkpoint_log -
                        // (4) fallback terakhir ke assignment planner (pekerja_per_komponen) kalau
                        // gak ada riwayat apapun sama sekali.
                        const operatorTimerKode=getOperatorNamesForKode(t.panelId,kode,t.proses);
                        const fallbackOp=operatorTimerKode.length===0?getFallbackOperatorForKode(t.panelId,kode,t.proses):null;
                        const checkpointOp=(operatorTimerKode.length===0&&(!fallbackOp||fallbackOp.names.length===0))?getCheckpointOperatorForKode(t.panelId,kode,t.proses):null;
                        const lanjutanOp=(fallbackOp&&fallbackOp.names.length>0)?fallbackOp:checkpointOp;
                        const isLanjutan=operatorTimerKode.length===0&&!!lanjutanOp&&lanjutanOp.names.length>0;
                        const workersKode=operatorTimerKode.length>0?operatorTimerKode:(isLanjutan?lanjutanOp!.names:opIdsKode.map((id:number)=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean));
                        const td={padding:"5px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:digeserKeTanggal?"#fafafa":sudahRelease?"#f0fdf4":rBg,verticalAlign:"middle",opacity:digeserKeTanggal?0.6:1};
                        return(
                          <tr key={ti+"-"+kode}>
                            <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{ti+1}.{ki+1}</td>
                            <td style={{...td,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                            <td style={{...td,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                            <td style={{...td,textAlign:"center"}}>{t.proses!=="BUSBAR"&&<span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span>}</td>
                            <td style={{...td,textAlign:"center"}}><span style={{background:priColor+"18",color:priColor,border:`1px solid ${priColor}33`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{t.prioritas}</span></td>
                            <td style={{...td}}>
                              <span style={{background:"#f1f5f9",borderRadius:4,padding:"2px 7px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama?`${kode} - ${item.nama}`:kode}</span>
                              {t.carriedOverFrom&&(
                                <span title={"Belum selesai di "+fmtShort(t.carriedOverFrom)+", lanjut ke hari ini"}
                                  style={{marginLeft:5,background:"#fff7ed",border:"1px solid #fed7aa",color:"#c2410c",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>
                                  🔁 Lanjutan {fmtShort(t.carriedOverFrom)}
                                </span>
                              )}
                              {digeserKeTanggal&&(()=>{
                                // Kasus1 (0% - gak sempat disentuh sama sekali di tanggal ini) dapat
                                // label beda dari kasus2 (partial - udah ada progress) biar user bisa
                                // bedain "gak sempat dikerjakan" vs "udah dikerjain tapi belum tuntas".
                                const pctDiTanggalIni=getProgressAsOfDate(panelData?.checklist?.[kode],t.proses,t.tanggal);
                                const tidakDikerjakan=pctDiTanggalIni<=0;
                                return(
                                  <span title={(tidakDikerjakan?"Gak sempat dikerjakan sama sekali di ":"Belum selesai di ")+t.tanggal+", dipindah ke "+fmtShort(digeserKeTanggal)+" (otomatis krn kapasitas, atau dipindah manual lewat Raw Schedule) - data di sini disimpan sbg histori, gak bisa diaksi lagi"}
                                    style={{marginLeft:5,background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#64748b",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>
                                    {tidakDikerjakan?"🚫 Digeser - Tidak Dikerjakan":"➡️ Digeser ke "+fmtShort(digeserKeTanggal)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{...td}}>
                              {!sudahRelease&&!digeserKeTanggal?(
                                <span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum dirilis</span>
                              ):workersKode.length>0?(
                                <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                                  {workersKode.map((n:string)=>(<span key={n} style={{background:isLanjutan?"#f8fafc":"#eff6ff",border:isLanjutan?"1px solid #e2e8f0":"1px solid #bfdbfe",color:isLanjutan?"#64748b":"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>👤 {n}</span>))}
                                  {isLanjutan&&<span title={"Terakhir ngerjain "+fmtShort(lanjutanOp!.tanggal!)+", belum ada yang mulai lagi hari ini"} style={{fontSize:9,color:"#94a3b8",fontStyle:"italic"}}>lanjutan {fmtShort(lanjutanOp!.tanggal!)}</span>}
                                </div>
                              ):digeserKeTanggal?(
                                <span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>-</span>
                              ):(<span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Pilih sendiri di tablet</span>)}
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              {(()=>{
                                // Row jejak (digeserKeTanggal) HARUS tetap tampilin status asli walau
                                // kebetulan gak ada row renhar di tanggal hop ini (renhar cuma ada di
                                // tanggal yang beneran dirilis manual - tanggal "numpang lewat" pas
                                // cascading kapasitas gak pernah dapet rilis manual apapun). Dulu bug:
                                // !sudahRelease dicek duluan tanpa peduli jejak, jadi histori di tanggal
                                // hop kelihatan "Belum Dirilis" padahal itu data historis biasa.
                                if(!sudahRelease&&!digeserKeTanggal){
                                  return <span style={{background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#94a3b8",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>Belum Dirilis</span>;
                                }
                                // Snapshot PERMANEN progress persis di tanggal t.tanggal - bukan progress
                                // terkini/keseluruhan, biar buka tanggal yang sudah lewat tetap nunjukin
                                // angka yang benar walau kerjaannya udah lanjut/kelar di hari-hari setelahnya.
                                const pctKerja=getProgressAsOfDate(panelData?.checklist?.[kode],t.proses,t.tanggal);
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
                                // Jejak 0% (gak sempat disentuh sama sekali di tanggal ini) - status beda
                                // dari "Belum Dikerjakan" hidup (yang masih actionable hari ini), karena
                                // ini histori beku, gak akan pernah dikerjakan lagi di tanggal ini.
                                if(digeserKeTanggal){
                                  return <span style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#94a3b8",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>⚪ Tidak Dikerjakan (0%)</span>;
                                }
                                // Timer aktif cuma relevan buat hari kerja SEKARANG - tanggal yang udah
                                // lewat itu sejarah/beku, gak ada timer yang "lagi jalan" buat hari itu.
                                const timerAktif=t.tanggal===getHariKerjaSekarang()?getTimerAktif(t.panelId,kode,t.proses):null;
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
                              {digeserKeTanggal?(
                                // Baris jejak/histori beku - status pipeline itu LIVE (kondisi sekarang),
                                // bisa kontradiksi sama kolom Status di sebelah kiri yang murni snapshot
                                // tanggal ini (mis. histori bilang "Tidak Dikerjakan" tapi sekarang udah
                                // Done di tanggal lain). Daripada bingungin, tampilin netral aja di sini.
                                <span style={{fontSize:11,color:"#cbd5e1"}}>–</span>
                              ):(
                                <span style={{background:STATUS_PIPELINE_STYLE[pipelineStatus].bg,color:STATUS_PIPELINE_STYLE[pipelineStatus].color,border:`1px solid ${STATUS_PIPELINE_STYLE[pipelineStatus].border}`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" as const}}>
                                  {STATUS_PIPELINE_LABEL[pipelineStatus]}
                                </span>
                              )}
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              {digeserKeTanggal?(
                                <span style={{fontSize:10,color:"#94a3b8",fontStyle:"italic"}}>Sudah digeser, aksi di {fmtShort(digeserKeTanggal)}</span>
                              ):(()=>{
                                const pendingKey=`${t.rawId}_${t.wp}_${t.tanggal}_${kode}`;
                                const isPending=pendingRelease.has(pendingKey);
                                return(
                                  <Btn color={sudahRelease?"#dc2626":"#2563eb"} disabled={isPending}
                                    style={{fontSize:11,padding:"5px 14px",opacity:isPending?0.55:1,cursor:isPending?"default":"pointer"}}
                                    onClick={()=>toggleReleaseKomponen(t,kode,item?.nama||kode,sudahRelease)}>
                                    {isPending?"⏳":sudahRelease?"↩️ Tarik":"📤 Rilis"}
                                  </Btn>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      }).filter(Boolean);
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
                  });
                  if(renderedRows.length===0&&statusFilter!=="ALL"){
                    return(
                      <tr><td colSpan={10} style={{padding:"20px",textAlign:"center",color:"#94a3b8",fontSize:12}}>
                        Tidak ada komponen dengan status "{STATUS_PIPELINE_LABEL[statusFilter as ProsesStatus]}" di {proses}.
                      </td></tr>
                    );
                  }
                  return renderedRows;
                  })()}
                </tbody>
              </table>
            </div>
            )}
          </div>
        );
      })}
      {["NAMEPLATE","YELLOWMARK"].filter(proses=>(selProses==="ALL"||selProses===proses)&&npYmMarked.some((t:any)=>t.proses===proses)).map(proses=>{
        const tasks=npYmMarked.filter((t:any)=>t.proses===proses);
        const isNameplate=proses==="NAMEPLATE";
        const pc=PROSES_COLOR[proses]||"#64748b";
        const divisiKey=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(proses))?.[0];
        const dc=divisiKey?DIVISI_CONFIG[divisiKey]:null;
        const thS={background:"#1e3a8a",color:"#fff",padding:"6px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap" as const,textAlign:"left" as const,position:"sticky" as const,top:0,borderRight:"1px solid #ffffff18"};
        return(
          <div key={proses} style={{marginBottom:20}}>
            <div style={{background:pc,borderRadius:"7px 7px 0 0",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:900,fontSize:15,color:"#fff"}}>{proses}</span>
                {dc&&<span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{dc.icon} {dc.label}</span>}
                <span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{tasks.length} tugas</span>
              </div>
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
                  {tasks.map((t:any,ti:number)=>{
                    const panel=t.panel;
                    const pct=(isNameplate?panel.nameplate_progress:panel.yellowmark_progress)||0;
                    const foto=(isNameplate?panel.nameplate_photos:panel.yellowmark_photos)||[];
                    const updatedBy=isNameplate?panel.nameplate_updated_by:panel.yellowmark_updated_by;
                    const updatedAt=isNameplate?panel.nameplate_updated_at:panel.yellowmark_updated_at;
                    const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
                    const rBg=ti%2===0?"#fff":"#f8fafc";
                    const td={padding:"5px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle" as const};
                    return(
                      <tr key={t.rawId}>
                        <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{ti+1}</td>
                        <td style={{...td,fontWeight:600,color:"#475569"}}>{panel._wo?.proyek}</td>
                        <td style={{...td,fontWeight:600,color:"#1e293b"}}>{panel.nama}</td>
                        <td style={{...td,textAlign:"center",color:"#cbd5e1"}}>–</td>
                        <td style={{...td,textAlign:"center"}}><span style={{background:priColor+"18",color:priColor,border:`1px solid ${priColor}33`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{t.prioritas}</span></td>
                        <td style={{...td}}>
                          <span style={{background:"#f1f5f9",borderRadius:4,padding:"2px 7px",fontSize:10,color:"#475569",fontWeight:600}}>Fabrikasi {pct}% · {foto.length} foto</span>
                        </td>
                        <td style={{...td}}>
                          {updatedBy?(
                            <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>👤 {updatedBy}</span>
                          ):(<span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada progress</span>)}
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          {pct>=100&&foto.length>=1?(
                            <span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✅ Selesai</span>
                          ):pct>0||foto.length>0?(
                            <span style={{background:"#fffbeb",border:"1px solid #fde68a",color:"#ca8a04",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>🟡 Sedang Dikerjakan ({pct}%)</span>
                          ):(
                            <span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>🔴 Belum Dikerjakan</span>
                          )}
                        </td>
                        <td style={{...td,textAlign:"center",fontSize:10,color:"#94a3b8"}}>{updatedAt?fmtRelatif(updatedAt):"–"}</td>
                      </tr>
                    );
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
