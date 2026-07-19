import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Sel, Btn, Lbl, Inp, Modal } from './ui/Primitives'

export function MaintenanceTab({mesinList,maintenanceList,setMaintenanceList,user}){
  const [form,setForm]=useState({mesin_id:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [filterMesin,setFilterMesin]=useState("ALL");
  const [showForm,setShowForm]=useState(false);

  const save=async()=>{
    if(!form.mesin_id||!form.kendala.trim())return;
    const payload={mesin_id:Number(form.mesin_id),kendala:form.kendala,perbaikan:form.perbaikan,
      tgl_kendala:form.tgl_kendala||null,tgl_perbaikan:form.tgl_perbaikan||null,
      teknisi:form.teknisi,status:form.status};
    if(editId){
      const{data,error}=await supabase.from("maintenance_log").update(payload).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(!error){setMaintenanceList(prev=>prev.map(m=>m.id===editId?data:m));setEditId(null);setShowForm(false);}
    } else {
      const{data,error}=await supabase.from("maintenance_log").insert(payload).select("*,mesin(nama,kode)").single();
      if(!error){setMaintenanceList(prev=>[data,...prev]);setShowForm(false);}
    }
    setForm({mesin_id:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  };

  const del=async()=>{
    await supabase.from("maintenance_log").delete().eq("id",delId);
    setMaintenanceList(prev=>prev.filter(m=>m.id!==delId));setDelId(null);
  };

  const STATUS_COLOR={open:"#dc2626",in_progress:"#f59e0b",closed:"#16a34a"};
  const STATUS_LABEL={open:"🔴 Open",in_progress:"🟡 In Progress",closed:"✅ Closed"};

  const filtered=maintenanceList.filter(m=>
    (filterStatus==="ALL"||m.status===filterStatus)&&
    (filterMesin==="ALL"||m.mesin_id===Number(filterMesin))
  );

  const stats=[
    {l:"Total",v:maintenanceList.length,c:"#2563eb"},
    {l:"Open",v:maintenanceList.filter(m=>m.status==="open").length,c:"#dc2626"},
    {l:"In Progress",v:maintenanceList.filter(m=>m.status==="in_progress").length,c:"#f59e0b"},
    {l:"Closed",v:maintenanceList.filter(m=>m.status==="closed").length,c:"#16a34a"},
  ];

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {stats.map((s,i)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Sel value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{minWidth:140}}>
            <option value="ALL">Semua Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </Sel>
          <Sel value={filterMesin} onChange={e=>setFilterMesin(e.target.value)} style={{minWidth:160}}>
            <option value="ALL">Semua Mesin</option>
            {mesinList.map(m=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}
          </Sel>
        </div>
        <Btn color="#1d4ed8" onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});}}>
          {showForm?"✕ Tutup":"+ Tambah Log"}
        </Btn>
      </div>

      {showForm&&(
        <Card style={{marginBottom:16,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:14}}>{editId?"✏️ Edit Log":"➕ Tambah Log Maintenance"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl>
              <Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}>
                <option value="">-- Pilih Mesin --</option>
                {mesinList.map(m=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}
              </Sel>
            </div>
            <div><Lbl>Tanggal Kendala</Lbl><Inp type="date" value={form.tgl_kendala} onChange={e=>setForm({...form,tgl_kendala:e.target.value})}/></div>
            <div><Lbl>Tanggal Perbaikan</Lbl><Inp type="date" value={form.tgl_perbaikan} onChange={e=>setForm({...form,tgl_perbaikan:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Kendala</Lbl>
              <textarea value={form.kendala} onChange={e=>setForm({...form,kendala:e.target.value})}
                placeholder="Deskripsi kendala..."
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",
                  color:"#1e293b",fontSize:12,resize:"vertical",minHeight:80,fontFamily:"inherit"}}/>
            </div>
            <div><Lbl>Perbaikan</Lbl>
              <textarea value={form.perbaikan} onChange={e=>setForm({...form,perbaikan:e.target.value})}
                placeholder="Tindakan perbaikan..."
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",
                  color:"#1e293b",fontSize:12,resize:"vertical",minHeight:80,fontFamily:"inherit"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Status</Lbl>
              <Sel value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </Sel>
            </div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}>
              <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn>
              <Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn>
            </div>
          </div>
        </Card>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>
            <div style={{fontSize:32,marginBottom:8}}>🔧</div>
            <div style={{fontSize:13,fontWeight:600}}>Belum ada log maintenance</div>
          </div>
        ):filtered.map(m=>{
          const sc=STATUS_COLOR[m.status]||"#64748b";
          return(
            <div key={m.id} style={{background:"#fff",borderRadius:10,border:`1px solid ${sc}30`,
              padding:"14px 16px",borderLeft:`4px solid ${sc}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:10}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>{m.mesin?.nama||"—"}</span>
                  <span style={{fontFamily:"monospace",fontSize:11,color:"#64748b",background:"#f1f5f9",borderRadius:4,padding:"1px 6px"}}>{m.mesin?.kode}</span>
                  <span style={{background:sc+"18",color:sc,border:`1px solid ${sc}33`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                  <button onClick={()=>setDelId(m.id)}
                    style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Kendala</div>
                  <div style={{fontSize:12,color:"#374151",background:"#fef2f2",borderRadius:7,padding:"8px 10px",lineHeight:1.5}}>{m.kendala||"—"}</div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Perbaikan</div>
                  <div style={{fontSize:12,color:"#374151",background:"#f0fdf4",borderRadius:7,padding:"8px 10px",lineHeight:1.5}}>{m.perbaikan||"—"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:11,color:"#64748b"}}>
                {m.tgl_kendala&&<span>📅 Kendala: <strong>{m.tgl_kendala}</strong></span>}
                {m.tgl_perbaikan&&<span>✅ Perbaikan: <strong>{m.tgl_perbaikan}</strong></span>}
                {m.teknisi&&<span>👤 Teknisi: <strong>{m.teknisi}</strong></span>}
              </div>
            </div>
          );
        })}
      </div>

      {delId&&(
        <Modal title="Hapus Log?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>Log maintenance ini akan dihapus permanen.</div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
