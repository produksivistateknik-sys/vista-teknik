import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { syncFCSToRawSchedule } from '../services/fcsService'

export function FCSScheduleTab({woData,user}:any){
  const [filterPekerjaan,setFilterPekerjaan]=useState("POTONG");
  const [scheduleList,setScheduleList]=useState<any[]>([]);
  const [kapasitasList,setKapasitasList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [expandedWO,setExpandedWO]=useState<string|null>(null);
  const [selectedPanels,setSelectedPanels]=useState<Record<string,number[]>>({});
  const [wpTanggal,setWpTanggal]=useState<Record<string,Record<string,string>>>({});
  const [wpPreview,setWpPreview]=useState<Record<string,Record<string,any[]>>>({});
  const [syncing,setSyncing]=useState<string|null>(null);
  const [calculating,setCalculating]=useState<string|null>(null);

  const WP_COLORS:any={
    WP1:{color:"#2563eb",bg:"#eff6ff"},
    WP2:{color:"#059669",bg:"#ecfdf5"},
    WP3:{color:"#d97706",bg:"#fffbeb"},
    WP4:{color:"#7c3aed",bg:"#f5f3ff"},
    WP5:{color:"#dc2626",bg:"#fef2f2"},
    WP6:{color:"#0891b2",bg:"#ecfeff"},
  };

  useEffect(()=>{fetchAll();},[filterPekerjaan,woData]);

  const fetchAll=async()=>{
    setLoading(true);
    const [{data:s},{data:k}]=await Promise.all([
      supabase.from("fcs_schedule").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .not("status","in",'("cancelled")')
        .order("tanggal",{ascending:true})
        .order("wp",{ascending:true}),
      supabase.from("fcs_kapasitas_override").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .order("tanggal",{ascending:true}),
    ]);
    setScheduleList(s??[]);
    setKapasitasList(k??[]);
    setLoading(false);
  };

  const kapasitasMap=useMemo(()=>{
    const map:Record<string,number>={};
    kapasitasList.forEach((k:any)=>{
      // Untuk WIRING CONTROL/POWER, kapasitas disimpan di jumlah_orang (bukan kapasitas_menit)
      if(k.tipe_kapasitas==="orang"&&k.jumlah_orang!=null){
        map[k.tanggal]=Number(k.jumlah_orang);
      } else {
        map[k.tanggal]=Number(k.kapasitas_menit)||0;
      }
    });
    return map;
  },[kapasitasList]);
  // Flag apakah proses ini pakai satuan orang (bukan menit)
  const isProsesSatuanOrang=["WIRING CONTROL","WIRING POWER"].includes(filterPekerjaan);

  // kapTerpakaiMap per WO - exclude WO yang sedang dihitung supaya tidak double-count
  const getKapTerpakaiExcludeWO=(woNum:string)=>{
    const map:Record<string,number>={};
    // Exclude WO yang sedang dihitung DAN data yang sudah synced (tidak perlu dihitung lagi)
    scheduleList.filter((s:any)=>String(s.wo_id)!==woNum&&s.status!=="synced").forEach((s:any)=>{
      // Untuk wiring (satuan orang), pakai qty_hari; untuk proses lain pakai total_menit
      const val=isProsesSatuanOrang?Number(s.qty_hari||0):Number(s.total_menit||0);
      map[s.tanggal]=(map[s.tanggal]||0)+val;
    });
    return map;
  };
  const kapTerpakaiMap=useMemo(()=>{
    const map:Record<string,number>={};
    scheduleList.forEach((s:any)=>{
      map[s.tanggal]=(map[s.tanggal]||0)+Number(s.total_menit);
    });
    return map;
  },[scheduleList]);

  const woGroups=useMemo(()=>{
    const groups:Record<string,{wo:string,woId:string,proyek:string,panels:Record<string,{nama:string,__wo_id:number,wps:Record<string,any[]>}>}>={};
    scheduleList.forEach((s:any)=>{
      const gk=String(s.wo_id);
      if(!groups[gk])groups[gk]={wo:s.wo_number,woId:gk,proyek:s.proyek,panels:{}};
      if(!groups[gk].panels[s.panel_id])groups[gk].panels[s.panel_id]={nama:s.panel_nama,__wo_id:s.wo_id,wps:{}};
      if(!groups[gk].panels[s.panel_id].wps[s.wp])groups[gk].panels[s.panel_id].wps[s.wp]=[];
      groups[gk].panels[s.panel_id].wps[s.wp].push(s);
    });
    return groups;
  },[scheduleList]);

  const addDaysStr=(date:string,n:number)=>{
    const d=new Date(date);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);
  };

  const hitungDistribusiWP=(rows:any[],tanggalMulai:string,existingTerpakai:Record<string,number>)=>{
    const tracker={...existingTerpakai};
    const result:any[]=[];
    let cur=tanggalMulai;
    let attempts=0;
    while(attempts<90&&(!kapasitasMap[cur]||kapasitasMap[cur]<=0)){cur=addDaysStr(cur,1);attempts++;}
    if(attempts>=90)return[];
    for(const row of rows){
      // Untuk wiring: 1 row = 1 hari, kebutuhan = qty_hari (jumlah orang)
      // Untuk proses lain: kebutuhan = menit_per_pcs * qty
      if(isProsesSatuanOrang){
        // Wiring: cari hari yang punya kapasitas orang cukup untuk row.qty_total orang
        const kebutuhanOrang=row.qty_total||1;
        let dayAttempts=0;
        while(dayAttempts<90){
          const kap=kapasitasMap[cur]||0;
          const terpakai=tracker[cur]||0;
          const sisa=kap-terpakai;
          if(sisa>=kebutuhanOrang){
            result.push({...row,tanggal:cur,qty_hari:kebutuhanOrang,total_menit_hari:kebutuhanOrang});
            tracker[cur]=(tracker[cur]||0)+kebutuhanOrang;
            // Advance cur ke hari berikutnya supaya row berikutnya tidak masuk di tanggal yang sama
            cur=addDaysStr(cur,1);
            let skipNext=0;
            while(skipNext<30&&(!kapasitasMap[cur]||kapasitasMap[cur]<=0)){cur=addDaysStr(cur,1);skipNext++;}
            break;
          }
          cur=addDaysStr(cur,1);
          let skip=0;
          while(skip<30&&(!kapasitasMap[cur]||kapasitasMap[cur]<=0)){cur=addDaysStr(cur,1);skip++;}
          dayAttempts++;
        }
        if(dayAttempts>=90){
          // Overflow: masukkan ke tanggal terakhir
          result.push({...row,tanggal:cur,qty_hari:kebutuhanOrang,total_menit_hari:kebutuhanOrang,overflow:true});
        }
      } else {
        // Proses biasa: distribusi berdasarkan menit
        let sisaQty=row.qty_total;
        let dayAttempts=0;
        while(sisaQty>0&&dayAttempts<90){
          const kap=kapasitasMap[cur]||0;
          const terpakai=tracker[cur]||0;
          const sisa=kap-terpakai;
          if(sisa<row.menit_per_pcs){
            cur=addDaysStr(cur,1);
            let skip=0;
            while(skip<30&&(!kapasitasMap[cur]||kapasitasMap[cur]<=0)){cur=addDaysStr(cur,1);skip++;}
            dayAttempts++;continue;
          }
          const maxQty=Math.floor(sisa/row.menit_per_pcs);
          const qtyHari=Math.min(sisaQty,maxQty);
          const mntHari=qtyHari*row.menit_per_pcs;
          result.push({...row,tanggal:cur,qty_hari:qtyHari,total_menit_hari:mntHari});
          tracker[cur]=(tracker[cur]||0)+mntHari;
          sisaQty-=qtyHari;
          dayAttempts++;
        }
        if(sisaQty>0){
          result.push({...row,tanggal:cur,qty_hari:sisaQty,total_menit_hari:sisaQty*row.menit_per_pcs,overflow:true});
        }
      }
    }
    return result;
  };

  const handleHitung=async(woNum:string,wp:string,panelIds:number[])=>{
    const key=`${woNum}_${wp}`;
    const tanggalMulai=wpTanggal[woNum]?.[wp]||new Date().toISOString().slice(0,10);
    setCalculating(key);
    const rows:any[]=[];
    panelIds.forEach(pid=>{
      const panel=woGroups[woNum]?.panels[pid];
      if(!panel)return;
      (panel.wps[wp]||[]).forEach((r:any)=>rows.push(r));
    });
    // Exclude kapasitas WO yang sedang dihitung supaya tidak double-count dirinya sendiri
    const kapExclude=getKapTerpakaiExcludeWO(woNum);
    // Tambahkan kapasitas yang sudah dipakai preview WP lain supaya WP2 tidak masuk di tanggal penuh WP1
    const kapIncludePreview:{[tgl:string]:number}={...kapExclude};
    const previewWO=wpPreview[woNum]||{};
    Object.entries(previewWO).forEach(([wpLain,previewRows]:any)=>{
      if(wpLain===wp)return;
      previewRows.forEach((r:any)=>{
        kapIncludePreview[r.tanggal]=(kapIncludePreview[r.tanggal]||0)+r.total_menit_hari;
      });
    });
    const preview=hitungDistribusiWP(rows,tanggalMulai,kapIncludePreview);
    // Sort preview berdasarkan tanggal supaya tampil urut
    const previewSorted=[...preview].sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
    setWpPreview(prev=>({...prev,[woNum]:{...(prev[woNum]||{}),[wp]:previewSorted}}));
    setCalculating(null);
  };

  const handleSync=async(woNum:string)=>{
    const realWoNumber=woGroups[woNum]?.wo||"";
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const panelIds=selectedPanels[woNum]||[];
    if(panelIds.length===0){alert("Pilih minimal 1 panel!");return;}
    const isWiring=["WIRING CONTROL","WIRING POWER"].includes(filterPekerjaan);
    if(isWiring){
      const belumHitungList:string[]=[];
      panelIds.forEach(pid=>{
        const panel=woGroups[woNum]?.panels[pid];
        if(!panel)return;
        Object.keys(panel.wps||{}).forEach(wpItem=>{
          const bobotKey=`${woNum}_${pid}_${wpItem}_bobot`;
          if(!wpPreview[woNum]?.[bobotKey]){
            belumHitungList.push(`${panel.nama} (${wpItem})`);
          }
        });
      });
      if(belumHitungList.length>0){
        alert(`Hitung dulu jadwal untuk: ${belumHitungList.join(", ")}`);return;
      }
    } else {
      const wps=new Set<string>();
      panelIds.forEach(pid=>{
        const panel=woGroups[woNum]?.panels[pid];
        if(panel)Object.keys(panel.wps).forEach(wp=>wps.add(wp));
      });
      const belumHitung=[...wps].filter(wp=>!wpPreview[woNum]?.[wp]);
      if(belumHitung.length>0){alert(`Hitung dulu jadwal untuk: ${belumHitung.join(", ")}`);return;}
    }
    setSyncing(woNum);
    try{
      if(isWiring){
        for(const pid of panelIds){
          const panel=woGroups[woNum]?.panels[pid];
          if(!panel)continue;
          for(const wpItem of Object.keys(panel.wps||{})){
            const bobotKey=`${woNum}_${pid}_${wpItem}_bobot`;
            const preview=wpPreview[woNum]?.[bobotKey]||[];
            await supabase.from("fcs_schedule").delete()
              .eq("panel_id",pid).eq("wo_number",realWoNumber).eq("jenis_pekerjaan",filterPekerjaan).eq("wp",wpItem);
            const bobotVal=(wpTanggal as any)[bobotKey]||"MEDIUM";
            const orangVal=parseInt((wpTanggal as any)[`${woNum}_${pid}_${wpItem}_orang`]||"1")||1;
            if(preview.length>0){
              const items=preview.map((r:any,i:number)=>({
                wo_id:woGroups[woNum]?.panels[pid]?.__wo_id||0,
                wo_number:realWoNumber,
                proyek:woGroups[woNum]?.proyek||"" ,
                panel_id:pid,
                panel_nama:woGroups[woNum]?.panels[pid]?.nama||"" ,
                tipe_panel:"FS",
                kode_komponen:bobotVal,
                nama_komponen:`Wiring ${bobotVal}`,
                wp:wpItem,
                jenis_pekerjaan:filterPekerjaan,
                tanggal:r.tanggal,
                qty_total:orangVal,
                qty_hari:orangVal,
                menit_per_pcs:0,
                total_menit:orangVal,
                status:"planning",
                urutan:i+1,
                generated_by:uname,
              }));
              await supabase.from("fcs_schedule").insert(items);
            }
          }
        }
      } else {
        const wps=new Set<string>();
        panelIds.forEach(pid=>{
          const panel=woGroups[woNum]?.panels[pid];
          if(panel)Object.keys(panel.wps).forEach(wp=>wps.add(wp));
        });
        for(const wp of wps){
          const preview=wpPreview[woNum]?.[wp]||[];
          for(const item of preview){
            await supabase.from("fcs_schedule")
              .update({tanggal:item.tanggal,qty_hari:item.qty_hari,total_menit:item.total_menit_hari})
              .eq("id",item.id);
          }
        }
      }
      let sukses=0;let gagal=0;
      for(const pid of panelIds){
        const panel=woGroups[woNum]?.panels[pid];
        if(!panel)continue;
        const res=await syncFCSToRawSchedule(realWoNumber,filterPekerjaan,uname,panel.nama,null);
        if(res.success)sukses++;else gagal++;
      }
      alert(`Sync selesai! ${sukses} panel berhasil${gagal>0?`, ${gagal} gagal`:""}`);
      fetchAll();
      setWpPreview(prev=>{const n={...prev};delete n[woNum];return n;});
    }catch(e:any){alert("Error: "+e.message);}
    setSyncing(null);
  };

  if(loading)return(
    <div style={{padding:40,textAlign:"center" as const,color:"#64748b"}}>
      <div style={{fontSize:24,marginBottom:8}}>⏳</div>
      <div>Memuat FCS Schedule...</div>
    </div>
  );

  return(
    <div className="fi">
      <div style={{fontWeight:800,fontSize:18,color:"var(--text-primary,#1e293b)",marginBottom:4}}>⏱ FCS Schedule</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Atur jadwal produksi per WP per panel, lalu sync ke Raw Schedule</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:16,background:"var(--card-bg,#fff)",padding:"10px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)"}}>
        <span style={{fontSize:11,fontWeight:700,color:"#64748b",alignSelf:"center"}}>PROSES:</span>
        {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
          <button key={p} onClick={()=>{setFilterPekerjaan(p);setWpPreview({});setSelectedPanels({});}}
            style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${filterPekerjaan===p?"#1d4ed8":"#e2e8f0"}`,
              background:filterPekerjaan===p?"#1d4ed8":"#f8fafc",
              color:filterPekerjaan===p?"#fff":"#64748b",
              fontSize:11,fontWeight:filterPekerjaan===p?700:400,cursor:"pointer"}}>
            {p}
          </button>
        ))}
        <button onClick={fetchAll} style={{marginLeft:"auto",height:28,padding:"0 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:11,cursor:"pointer"}}>↻ Refresh</button>
      </div>
      {Object.keys(woGroups).length===0?(
        <div style={{padding:40,textAlign:"center" as const,color:"#94a3b8",background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)"}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>Tidak ada FCS Schedule untuk proses {filterPekerjaan}</div>
          <div style={{fontSize:12,marginTop:4}}>Generate FCS dari Manajemen WO terlebih dahulu</div>
        </div>
      ):(
        Object.values(woGroups).map((wo:any)=>{
          const isExpanded=expandedWO===wo.woId;
          const allPanelIds=Object.keys(wo.panels).map(Number);
          const selPanels=selectedPanels[wo.woId]||[];
          const allWPs=[...new Set(Object.values(wo.panels).flatMap((p:any)=>Object.keys(p.wps)))].sort();
          const totalRows=Object.values(wo.panels).reduce((a:number,p:any)=>a+Object.values(p.wps).reduce((b:number,rows:any)=>b+(rows as any[]).length,0),0);
          return(
            <div key={wo.woId} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,marginBottom:10,overflow:"hidden"}}>
              <div onClick={()=>setExpandedWO(isExpanded?null:wo.woId)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",
                  background:isExpanded?"#f8faff":"var(--card-bg,#fff)",
                  borderBottom:isExpanded?"1px solid #e2e8f0":"none"}}>
                <span style={{fontSize:14}}>{isExpanded?"▼":"▶"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary,#1e293b)"}}>WO {wo.wo} — {wo.proyek}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{allPanelIds.length} panel · {totalRows} jadwal · {allWPs.join(", ")}</div>
                </div>
                {selPanels.length>0&&<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{selPanels.length} panel dipilih</span>}
              </div>
              {isExpanded&&(
                <div style={{padding:"14px 16px"}}>
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Pilih Panel ({selPanels.length}/{allPanelIds.length})</div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setSelectedPanels(p=>({...p,[wo.woId]:allPanelIds}))} style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Semua</button>
                        <button onClick={()=>setSelectedPanels(p=>({...p,[wo.woId]:[]}))} style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      </div>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {Object.entries(wo.panels).map(([pid,panel]:any)=>{
                        const checked=selPanels.includes(Number(pid));
                        // Cek apakah panel sudah di-sync (status='synced' di fcs_schedule)
                        const sudahSynced=scheduleList.some((s:any)=>s.panel_id===Number(pid)&&String(s.wo_id)===wo.woId&&s.status==="synced");
                        // Cek apakah panel masih planning (belum di-sync)
                        const adaDiFCS=scheduleList.some((s:any)=>s.panel_id===Number(pid)&&String(s.wo_id)===wo.woId&&s.status!=="synced");
                        return(
                          <label key={pid} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:7,
                            border:`1.5px solid ${sudahSynced?"#16a34a":checked?"#1d4ed8":"#e2e8f0"}`,
                            background:sudahSynced?"#f0fdf4":checked?"#eff6ff":"#f8fafc",
                            cursor:"pointer"}}>
                            <input type="checkbox" checked={checked} onChange={()=>{
                              if(sudahSynced&&!checked&&!confirm("Panel ini udah pernah di-sync. Pilih ulang buat SYNC ULANG (jadwal lama bakal ditimpa jadwal baru hasil Hitung ulang). Lanjut?"))return;
                              setSelectedPanels(prev=>{
                                const cur=prev[wo.woId]||[];
                                return{...prev,[wo.woId]:checked?cur.filter(x=>x!==Number(pid)):[...cur,Number(pid)]};
                              });
                            }}/>
                            <span style={{fontSize:12,color:sudahSynced?"#16a34a":checked?"#1d4ed8":"#1e293b",fontWeight:checked||sudahSynced?700:400}}>{panel.nama}</span>
                            {sudahSynced&&<span style={{fontSize:9,background:"#dcfce7",color:"#16a34a",borderRadius:4,padding:"1px 5px",fontWeight:700}}>✓ Synced</span>}
                            {!sudahSynced&&adaDiFCS&&<span style={{fontSize:9,background:"#fffbeb",color:"#d97706",borderRadius:4,padding:"1px 5px",fontWeight:700}}>FCS</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {selPanels.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>
                        {["WIRING CONTROL","WIRING POWER"].includes(filterPekerjaan)?"⚡ Bobot & Jadwal per Panel":"Atur Jadwal per WP"}
                      </div>
                      {["WIRING CONTROL","WIRING POWER"].includes(filterPekerjaan)?(
                        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                          {selPanels.flatMap(pid=>{
                            const panel=wo.panels[pid];
                            if(!panel)return[];
                            const panelWps=Object.keys(panel.wps||{});
                            if(panelWps.length===0)return[];
                            return panelWps.map(wpItem=>{
                            const wpColorX=WP_COLORS[wpItem]||{color:"#64748b",bg:"#f1f5f9"};
                            const bobotKey=`${wo.woId}_${pid}_${wpItem}_bobot`;
                            const bobotVal=(wpTanggal as any)[bobotKey]||"MEDIUM";
                            const orangKey=`${wo.woId}_${pid}_${wpItem}_orang`;
                            const orangVal=parseInt((wpTanggal as any)[orangKey]||"1")||1;
                            const tglKey=`${wo.woId}_${pid}_${wpItem}_tgl`;
                            const tglVal=(wpTanggal as any)[tglKey]||new Date().toISOString().slice(0,10);
                            const BOBOT_CFG:any={
                              EASY:{label:"Easy",hariOrang:1,color:"#16a34a",bg:"#f0fdf4"},
                              MEDIUM:{label:"Medium",hariOrang:2,color:"#d97706",bg:"#fffbeb"},
                              HARD:{label:"Hard",hariOrang:3,color:"#dc2626",bg:"#fef2f2"},
                              VERY_HARD:{label:"Very Hard",hariOrang:4,color:"#7c3aed",bg:"#f5f3ff"},
                            };
                            const cfg=BOBOT_CFG[bobotVal]||BOBOT_CFG.MEDIUM;
                            const hariTotal=Math.ceil(cfg.hariOrang/orangVal);
                            const previewW=wpPreview[wo.woId]?.[bobotKey];
                            return(
                              <div key={pid+"_"+wpItem} style={{border:`1.5px solid ${cfg.color}30`,borderRadius:8,padding:"10px 12px",background:cfg.bg+"40"}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap" as const}}>
                                  <span style={{background:wpColorX.color,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700}}>{wpItem}</span>
                                  <span style={{fontSize:12,fontWeight:700,color:"#1e293b",flex:1}}>{panel.nama}</span>
                                  <select value={bobotVal} onChange={e=>setWpTanggal((prev:any)=>({...prev,[bobotKey]:e.target.value}))}
                                    style={{padding:"3px 8px",borderRadius:5,border:`1.5px solid ${cfg.color}`,background:cfg.bg,color:cfg.color,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                    {Object.entries(BOBOT_CFG).map(([k,v]:any)=>(
                                      <option key={k} value={k}>{v.label} ({v.hariOrang} hari-org)</option>
                                    ))}
                                  </select>
                                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                                    <span style={{fontSize:10,color:"#64748b"}}>Org:</span>
                                    <input type="number" min="1" max="10" value={orangVal}
                                      onChange={e=>setWpTanggal((prev:any)=>({...prev,[orangKey]:e.target.value}))}
                                      style={{width:36,padding:"3px 4px",borderRadius:5,border:"1.5px solid #e2e8f0",fontSize:11,textAlign:"center" as const}}/>
                                  </div>
                                  <span style={{fontSize:10,color:cfg.color,fontWeight:700}}>{hariTotal} hari</span>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <div style={{fontSize:10,fontWeight:600,color:"#64748b"}}>Mulai:</div>
                                  <input type="date" value={tglVal}
                                    onChange={e=>setWpTanggal((prev:any)=>({...prev,[tglKey]:e.target.value}))}
                                    style={{padding:"3px 8px",borderRadius:6,border:"1.5px solid #e2e8f0",fontSize:11,fontFamily:"inherit"}}/>
                                  <button onClick={()=>{
                                    const kapExclude=getKapTerpakaiExcludeWO(wo.woId);
                                    const kapInclude:{[t:string]:number}={...kapExclude};
                                    Object.entries(wpPreview[wo.woId]||{}).forEach(([k,rows]:any)=>{
                                      if(k===bobotKey)return;
                                      rows.forEach((r:any)=>{kapInclude[r.tanggal]=(kapInclude[r.tanggal]||0)+r.total_menit_hari;});
                                    });
                                    const rows=Array.from({length:hariTotal},(_,i)=>({
                                      qty_total:orangVal,qty_hari:orangVal,menit_per_pcs:0,
                                      kode_komponen:bobotVal,nama_komponen:`Wiring ${bobotVal}`,
                                      wp:wpItem,id:`wiring_${pid}_${wpItem}_${i}`,
                                    }));
                                    const previewRows=hitungDistribusiWP(rows,tglVal,kapInclude);
                                    const sorted=[...previewRows].sort((a:any,b:any)=>a.tanggal.localeCompare(b.tanggal));
                                    setWpPreview((prev:any)=>({...prev,[wo.woId]:{...(prev[wo.woId]||{}),[bobotKey]:sorted}}));
                                  }} style={{padding:"3px 10px",borderRadius:5,border:"none",background:cfg.color,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                    Hitung →
                                  </button>
                                  {previewW&&<span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✓ {[...new Set(previewW.map((p:any)=>p.tanggal))].length} hari</span>}
                                </div>
                                {previewW&&(
                                  <div style={{marginTop:6,display:"flex",flexWrap:"wrap" as const,gap:4}}>
                                    {([...new Set(previewW.map((p:any)=>p.tanggal))] as string[]).map((tgl:string)=>{
                                      const dayRows=previewW.filter((p:any)=>p.tanggal===tgl);
                                      const org=dayRows.reduce((a:number,b:any)=>a+b.total_menit_hari,0);
                                      const kap=kapasitasMap[tgl]||0;
                                      const pct=kap>0?Math.round(org/kap*100):0;
                                      const color=pct>=90?"#dc2626":pct>=70?"#d97706":"#16a34a";
                                      return(
                                        <div key={tgl} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${color}30`,background:`${color}10`,fontSize:10}}>
                                          <div style={{fontWeight:600}}>{new Date(tgl).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</div>
                                          <div style={{color}}>{org}/{kap} org ({pct}%)</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                            });
                          })}
                        </div>
                      ):(
                      <div>
                      {allWPs.map(wp=>{
                        const wpColor=WP_COLORS[wp]||{color:"#64748b",bg:"#f1f5f9"};
                        const key=`${wo.woId}_${wp}`;
                        const preview=wpPreview[wo.woId]?.[wp];
                        const isCalc=calculating===key;
                        const komponenList:string[]=[];
                        selPanels.forEach(pid=>{
                          const panel=wo.panels[pid];
                          if(panel?.wps[wp]){panel.wps[wp].forEach((r:any)=>{if(!komponenList.includes(r.nama_komponen))komponenList.push(r.nama_komponen);});}
                        });
                        return(
                          <div key={wp} style={{border:`1.5px solid ${wpColor.color}30`,borderRadius:8,padding:"10px 12px",marginBottom:8,background:wpColor.bg+"40"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                              <span style={{background:wpColor.color,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{wp}</span>
                              <span style={{fontSize:11,color:"#64748b",flex:1}}>{komponenList.slice(0,3).join(", ")}{komponenList.length>3?` +${komponenList.length-3} lainnya`:""}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                              <div style={{fontSize:10,fontWeight:600,color:"#64748b"}}>Tanggal mulai:</div>
                              <input type="date"
                                value={wpTanggal[wo.woId]?.[wp]||new Date().toISOString().slice(0,10)}
                                onChange={e=>setWpTanggal(prev=>({...prev,[wo.woId]:{...(prev[wo.woId]||{}),[wp]:e.target.value}}))}
                                style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #e2e8f0",fontSize:11,fontFamily:"inherit"}}/>
                              <button onClick={()=>handleHitung(wo.woId,wp,selPanels)} disabled={isCalc}
                                style={{padding:"4px 12px",borderRadius:6,border:"none",background:isCalc?"#94a3b8":wpColor.color,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                {isCalc?"⏳...":"Hitung →"}
                              </button>
                              {preview&&<span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✓ {[...new Set(preview.map((p:any)=>p.tanggal))].length} hari · {preview.length} baris</span>}
                            </div>
                            {preview&&(
                              <div style={{marginTop:8,display:"flex",flexWrap:"wrap" as const,gap:4}}>
                                {([...new Set(preview.map((p:any)=>p.tanggal))] as string[]).map((tgl:string)=>{
                                  const dayRows=preview.filter((p:any)=>p.tanggal===tgl);
                                  const mnt=Math.round(dayRows.reduce((a:number,b:any)=>a+b.total_menit_hari,0)*100)/100;
                                  const kap=kapasitasMap[tgl]||0;
                                  const pct=kap>0?Math.round(mnt/kap*100):0;
                                  const color=pct>=90?"#dc2626":pct>=70?"#d97706":"#16a34a";
                                  return(
                                    <div key={tgl} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${color}30`,background:`${color}10`,fontSize:10}}>
                                      <div style={{fontWeight:600,color:"#1e293b"}}>{new Date(tgl).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</div>
                                      <div style={{color}}>{isProsesSatuanOrang?`${mnt}/${kap} orang (${pct}%)`:`${mnt} mnt (${pct}%)`}</div>
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
                  {/* Summary total orang per tanggal untuk WIRING */}
                  {["WIRING CONTROL","WIRING POWER"].includes(filterPekerjaan)&&selPanels.length>0&&Object.keys(wpPreview[wo.woId]||{}).length>0&&(()=>{
                    // Gabungkan semua preview panel per tanggal
                    const summaryMap:{[tgl:string]:number}={};
                    Object.entries(wpPreview[wo.woId]||{}).forEach(([k,rows]:any)=>{
                      if(!k.includes('_bobot'))return;
                      rows.forEach((r:any)=>{summaryMap[r.tanggal]=(summaryMap[r.tanggal]||0)+r.total_menit_hari;});
                    });
                    const tanggalList=Object.keys(summaryMap).sort();
                    if(tanggalList.length===0)return null;
                    return(
                      <div style={{marginBottom:12,padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#6366f1",marginBottom:8}}>📊 Total Kapasitas Orang per Hari</div>
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                          {tanggalList.map(tgl=>{
                            const total=summaryMap[tgl];
                            const kap=kapasitasMap[tgl]||0;
                            const pct=kap>0?Math.round(total/kap*100):0;
                            const color=pct>=100?"#dc2626":pct>=80?"#d97706":"#16a34a";
                            return(
                              <div key={tgl} style={{padding:"6px 10px",borderRadius:6,border:`1.5px solid ${color}30`,background:`${color}10`,textAlign:"center" as const,minWidth:80}}>
                                <div style={{fontSize:10,fontWeight:600,color:"#1e293b"}}>{new Date(tgl).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</div>
                                <div style={{fontSize:13,fontWeight:700,color}}>{total}/{kap} org</div>
                                <div style={{fontSize:9,color:"#94a3b8"}}>{pct}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {selPanels.length>0&&(
                    <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                      <button onClick={fetchAll} style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer"}}>↻ Refresh</button>
                      <button onClick={()=>handleSync(wo.woId)} disabled={syncing===wo.woId}
                        style={{padding:"7px 18px",borderRadius:7,border:"none",background:syncing===wo.woId?"#94a3b8":"#7c3aed",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        {syncing===wo.woId?"⏳ Syncing...":"⇄ Sync Panel Terpilih"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
