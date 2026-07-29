import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Primitives'
import { activityLogService } from '../services/activityLogService'

const QC_STATUS_LABEL:Record<string,{label:string,color:string,bg:string}>={
  to_do:{label:"To Do",color:"#64748b",bg:"#f1f5f9"},
  in_progress:{label:"In Progress",color:"#ea580c",bg:"#fff7ed"},
  complete:{label:"Complete",color:"#16a34a",bg:"#f0fdf4"},
};

function ArsipPanelSubTab({user,refetchWO}:any){
  const[panelList,setPanelList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[unarsipLoadingId,setUnarsipLoadingId]=useState<number|null>(null);

  const fetchPanelArsip=async()=>{
    setLoading(true);
    const{data}=await supabase.from("panels_archived").select("*").order("diarsipkan_pada",{ascending:false});
    setPanelList(data??[]);
    setLoading(false);
  };
  useEffect(()=>{fetchPanelArsip();},[]);

  const filtered=panelList.filter((p:any)=>
    !search||p.nama?.toLowerCase().includes(search.toLowerCase())||p.proyek_snapshot?.toLowerCase().includes(search.toLowerCase())||p.wo_number_snapshot?.toLowerCase().includes(search.toLowerCase())
  );

  const unarsipkan=async(p:any)=>{
    if(!confirm(`Kembalikan panel "${p.nama}" ke tampilan aktif? Semua data (checklist, progress, riwayat timer, QC) dikembalikan utuh.`))return;
    setUnarsipLoadingId(p.id);
    const{error}=await supabase.rpc("unarsip_panel",{p_panel_id:p.id});
    setUnarsipLoadingId(null);
    if(error){alert("Gagal unarchive: "+error.message);return;}
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,action:"UNARCHIVE PANEL",
      description:"Kembalikan panel "+p.nama+" dari arsip ke WO "+(p.wo_number_snapshot||"")+" - "+(p.proyek_snapshot||""),
      module:"wo",halaman:"Manajemen WO",proyek:p.proyek_snapshot||"",panel:p.nama,wo_number:p.wo_number_snapshot||"",
    });
    setPanelList(prev=>prev.filter((x:any)=>x.id!==p.id));
    if(refetchWO)await refetchWO();
    alert("Panel "+p.nama+" berhasil dikembalikan ke tampilan aktif.");
  };

  const thS:any={padding:"8px 12px",textAlign:"left",fontSize:10,color:"#64748b",fontWeight:700,background:"#f8fafc"};
  const td:any={padding:"9px 12px",borderTop:"1px solid #f1f5f9",fontSize:12,verticalAlign:"middle"};

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <p style={{fontSize:12,color:"#64748b",margin:0}}>Panel individual yang sudah diarsipkan dari WO-nya - datanya dipindah utuh, bisa dikembalikan kapan saja.</p>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari panel/proyek/WO..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:220,outline:"none",fontFamily:"inherit"}}/>
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip panel...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada panel yang diarsipkan
        </div>
      ):(
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              <th style={thS}>No. WO</th>
              <th style={thS}>Proyek</th>
              <th style={thS}>Nama Panel</th>
              <th style={{...thS,textAlign:"center"}}>Progress</th>
              <th style={{...thS,textAlign:"center"}}>QC</th>
              <th style={thS}>Diarsipkan</th>
              <th style={{...thS,textAlign:"center"}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.map((p:any,i:number)=>{
                const qc=p.qc_checklist?._global?.status||"to_do";
                const qcInfo=QC_STATUS_LABEL[qc]||QC_STATUS_LABEL.to_do;
                return(
                  <tr key={p.id} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                    <td style={td}>{p.wo_number_snapshot||"—"}</td>
                    <td style={td}>{p.proyek_snapshot||"—"}</td>
                    <td style={{...td,fontWeight:700,color:"#1e293b"}}>{p.nama}</td>
                    <td style={{...td,textAlign:"center",fontWeight:800,color:"#1d4ed8"}}>{p.progress_snapshot??0}%</td>
                    <td style={{...td,textAlign:"center"}}>
                      <span style={{background:qcInfo.bg,color:qcInfo.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{qcInfo.label}</span>
                    </td>
                    <td style={{...td,color:"#94a3b8",fontSize:11}}>{p.diarsipkan_oleh} · {p.diarsipkan_pada?new Date(p.diarsipkan_pada).toLocaleDateString("id-ID"):"—"}</td>
                    <td style={{...td,textAlign:"center"}}>
                      <button onClick={()=>unarsipkan(p)} disabled={unarsipLoadingId===p.id}
                        style={{padding:"5px 12px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:11,fontWeight:700}}>
                        {unarsipLoadingId===p.id?"⏳...":"↩ Unarchive"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ArsipTab({woData,pekerja,logActivity,user,refetchWO}:any){
  const [subTab,setSubTab]=useState<"wo"|"panel">("wo");
  const [arsipList,setArsipList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [selArsip,setSelArsip]=useState<any>(null);

  useEffect(()=>{
    const fetchArsip=async()=>{
      setLoading(true);
      const{data}=await supabase.from("fcs_arsip_wo").select("*").order("diarsipkan_pada",{ascending:false});
      setArsipList(data??[]);
      setLoading(false);
    };
    fetchArsip();
  },[]);

  const filtered=arsipList.filter((a:any)=>
    !search||a.wo_number?.toLowerCase().includes(search.toLowerCase())||a.proyek?.toLowerCase().includes(search.toLowerCase())
  );

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap" as const,gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#1e293b",margin:0}}>📦 Arsip</h2>
          <p style={{fontSize:12,color:"#64748b",margin:"4px 0 0"}}>Histori WO dan panel yang sudah diarsipkan</p>
        </div>
        {subTab==="wo"&&(
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO atau proyek..."
            style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
        )}
      </div>

      <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid #e2e8f0"}}>
        {[{id:"wo",l:"Arsip WO"},{id:"panel",l:"Arsip Panel"}].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id as any)}
            style={{padding:"8px 18px",fontSize:12,fontWeight:subTab===t.id?700:500,
              color:subTab===t.id?"#1d4ed8":"#64748b",cursor:"pointer",
              background:subTab===t.id?"#eff6ff":"transparent",
              border:"none",borderBottom:subTab===t.id?"2px solid #1d4ed8":"2px solid transparent",
              fontFamily:"inherit",borderRadius:"6px 6px 0 0"}}>
            {t.l}
          </button>
        ))}
      </div>

      {subTab==="panel"?(
        <ArsipPanelSubTab user={user} refetchWO={refetchWO}/>
      ):loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada WO yang diarsipkan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {filtered.map((a:any)=>(
            <div key={a.id} onClick={()=>setSelArsip(a)}
              style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {a.wo_number} — {a.proyek}</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:2}}>
                  {a.total_panel} panel · {a.total_komponen} komponen · {Math.round(a.total_jam_kerja)} jam kerja
                </div>
              </div>
              <span style={{background:a.status_ketepatan==="tepat_waktu"?"#f0fdf4":"#fef2f2",
                color:a.status_ketepatan==="tepat_waktu"?"#16a34a":"#dc2626",
                border:`1px solid ${a.status_ketepatan==="tepat_waktu"?"#bbf7d0":"#fecaca"}`,
                borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                {a.status_ketepatan==="tepat_waktu"?"✅ Tepat Waktu":`⏰ Telat ${a.selisih_hari}h`}
              </span>
            </div>
          ))}
        </div>
      )}

      {selArsip&&(
        <Modal title={"WO "+selArsip.wo_number+" — "+selArsip.proyek} onClose={()=>setSelArsip(null)} width={560}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
            {[
              {l:"Total Panel",v:selArsip.total_panel},
              {l:"Total Komponen",v:selArsip.total_komponen},
              {l:"Total Jam Kerja",v:Math.round(selArsip.total_jam_kerja)+" jam"},
            ].map((s,i)=>(
              <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px",textAlign:"center" as const}}>
                <div style={{fontSize:18,fontWeight:800,color:"#1e293b"}}>{s.v}</div>
                <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase" as const,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>
            Target: {selArsip.target_selesai} → Selesai aktual: {selArsip.tanggal_selesai_aktual}
            {selArsip.status_ketepatan==="tepat_waktu"
              ?<span style={{color:"#16a34a",fontWeight:700,marginLeft:6}}>(Tepat waktu)</span>
              :<span style={{color:"#dc2626",fontWeight:700,marginLeft:6}}>(Telat {selArsip.selisih_hari} hari)</span>}
          </div>

          <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>👥 Ringkasan Operator</div>
          {(selArsip.ringkasan_operator||[]).length===0?(
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:16}}>Tidak ada data operator tercatat</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
              {(selArsip.ringkasan_operator||[]).map((op:any,i:number)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,background:"#f8fafc",borderRadius:6,padding:"6px 10px"}}>
                  <span style={{fontWeight:600,color:"#1e293b"}}>{op.nama}</span>
                  <span style={{color:"#64748b"}}>{Math.round(op.totalMenit/60)} jam · {op.jumlahSesi} sesi</span>
                </div>
              ))}
            </div>
          )}

          <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>📋 Rincian Panel</div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:200,overflowY:"auto" as const}}>
            {(selArsip.rincian_panel||[]).map((p:any,i:number)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,background:"#f8fafc",borderRadius:6,padding:"6px 10px"}}>
                <span style={{fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                <span style={{color:"#94a3b8"}}>{p.tipe} · {p.totalKomponen} komponen</span>
              </div>
            ))}
          </div>

          <div style={{fontSize:10,color:"#cbd5e1",marginTop:16,textAlign:"center" as const}}>
            Diarsipkan oleh {selArsip.diarsipkan_oleh} pada {new Date(selArsip.diarsipkan_pada).toLocaleDateString("id-ID")}
          </div>
        </Modal>
      )}
    </div>
  );
}
