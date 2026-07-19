import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Primitives'

export function ArsipTab({woData,pekerja,logActivity,user}:any){
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#1e293b",margin:0}}>📦 Arsip Work Order</h2>
          <p style={{fontSize:12,color:"#64748b",margin:"4px 0 0"}}>Histori WO yang sudah selesai dan diarsipkan</p>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO atau proyek..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
      </div>

      {loading?(
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
