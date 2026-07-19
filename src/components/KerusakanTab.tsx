import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { Card, Lbl, Sel, Inp, Btn, Modal } from './ui/Primitives'

export function KerusakanTab({mesinList,maintenanceList,setMaintenanceList,user}:any){
  const [form,setForm]=useState({mesin_id:"",kendala:"",perbaikan:"",catatan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const [showForm,setShowForm]=useState(false);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [view,setView]=useState("kanban");
  const SC:any={open:{color:"#dc2626",bg:"#FCEBEB",border:"#F09595",label:"Open"},in_progress:{color:"#f59e0b",bg:"#FAEEDA",border:"#FAC775",label:"In Progress"},closed:{color:"#16a34a",bg:"#EAF3DE",border:"#C0DD97",label:"Closed"}};
  const getUname=()=>{const s=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");return user?.name||user?.nama||s?.nama||"Admin";};
  const save=async()=>{
    if(!form.mesin_id||!form.kendala.trim())return;
    const payload={mesin_id:Number(form.mesin_id),kendala:form.kendala,perbaikan:form.perbaikan,catatan:form.catatan,tgl_kendala:form.tgl_kendala||null,tgl_perbaikan:form.tgl_perbaikan||null,teknisi:form.teknisi,status:form.status};
    if(editId){
      const{data,error}=await supabase.from("maintenance_log").update(payload).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(!error){setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===editId?data:m));setEditId(null);setShowForm(false);}
    } else {
      const{data,error}=await supabase.from("maintenance_log").insert(payload).select("*,mesin(nama,kode)").single();
      if(!error){
        setMaintenanceList((p:any[])=>[data,...p]);
        await activityLogService.insert({user_name:getUname(),action:"TAMBAH MAINTENANCE",description:"Tambah log maintenance "+data.mesin?.nama,module:"maintenance",halaman:"Maintenance"});
        setShowForm(false);
      }
    }
    setForm({mesin_id:"",kendala:"",perbaikan:"",catatan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  };
  const del=async()=>{
  const item=maintenanceList.find((m:any)=>m.id===delId);
  await supabase.from("maintenance_log").delete().eq("id",delId);
  setMaintenanceList((p:any[])=>p.filter((m:any)=>m.id!==delId));
  setDelId(null);
  await activityLogService.insert({user_name:getUname(),action:"HAPUS LOG MAINTENANCE",description:"Hapus log: "+(item?.mesin?.nama||"-")+" - "+(item?.kendala||"-").slice(0,50),module:"maintenance",halaman:"Maintenance"});
};
  const updateStatus=async(id:any,status:string)=>{
  await supabase.from("maintenance_log").update({status}).eq("id",id);
  setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?{...m,status}:m));
  const item=maintenanceList.find((m:any)=>m.id===id);
  await activityLogService.insert({user_name:getUname(),action:"UPDATE STATUS MAINTENANCE",description:"Update status: "+(item?.mesin?.nama||"-")+" -> "+status,module:"maintenance",halaman:"Maintenance"});
};
  const filtered=filterStatus==="ALL"?maintenanceList:maintenanceList.filter((m:any)=>m.status===filterStatus);
  const stats=[{l:"Open",v:maintenanceList.filter((m:any)=>m.status==="open").length,c:"#dc2626"},{l:"In Progress",v:maintenanceList.filter((m:any)=>m.status==="in_progress").length,c:"#f59e0b"},{l:"Closed",v:maintenanceList.filter((m:any)=>m.status==="closed").length,c:"#16a34a"},{l:"Total Mesin",v:mesinList.length,c:"#2563eb"}];
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {stats.map((s:any,i:number)=>(<Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div></Card>))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
          {["ALL","open","in_progress","closed"].map((s:string)=>(<button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"5px 12px",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterStatus===s?"#1d4ed8":"#fff",color:filterStatus===s?"#fff":"#64748b",borderRight:"1px solid #e2e8f0"}}>{s==="ALL"?"Semua":SC[s]?.label}</button>))}
        </div>
        <div style={{display:"flex",gap:4,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden",marginLeft:"auto"}}>
          <button onClick={()=>setView("kanban")} style={{padding:"5px 10px",border:"none",background:view==="kanban"?"#f1f5f9":"#fff",cursor:"pointer",fontSize:13}}>⊞</button>
          <button onClick={()=>setView("list")} style={{padding:"5px 10px",border:"none",background:view==="list"?"#f1f5f9":"#fff",cursor:"pointer",fontSize:13}}>☰</button>
        </div>
        <Btn color="#1d4ed8" onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",kendala:"",perbaikan:"",catatan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"})}}>{showForm?"✕ Tutup":"+ Tambah Log"}</Btn>
      </div>
      {showForm&&(
        <Card style={{marginBottom:14,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary,#1e293b)",marginBottom:12}}>{editId?"✏️ Edit Log":"➕ Tambah Log Maintenance"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl><Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}><option value="">-- Pilih Mesin --</option>{mesinList.map((m:any)=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}</Sel></div>
            <div><Lbl>Tgl Kendala</Lbl><Inp type="date" value={form.tgl_kendala} onChange={e=>setForm({...form,tgl_kendala:e.target.value})}/></div>
            <div><Lbl>Tgl Perbaikan</Lbl><Inp type="date" value={form.tgl_perbaikan} onChange={e=>setForm({...form,tgl_perbaikan:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Kendala</Lbl><textarea value={form.kendala} onChange={e=>setForm({...form,kendala:e.target.value})} placeholder="Deskripsi kendala..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:72,fontFamily:"inherit"}}/></div>
            <div><Lbl>Perbaikan</Lbl><textarea value={form.perbaikan} onChange={e=>setForm({...form,perbaikan:e.target.value})} placeholder="Tindakan perbaikan..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:72,fontFamily:"inherit"}}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Status</Lbl><Sel value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></Sel></div>
            <div><Lbl>Catatan Harian</Lbl><textarea value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Catatan perkembangan..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:60,fontFamily:"inherit"}}/></div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}><Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn><Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn></div>
          </div>
        </Card>
      )}
      {view==="kanban"?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {["open","in_progress","closed"].map((col:string)=>{
            const sc=SC[col];const items=filtered.filter((m:any)=>m.status===col);
            return(<div key={col}>
              <div style={{padding:"8px 12px",marginBottom:8,background:sc.bg,borderLeft:`3px solid ${sc.color}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:sc.color}}>{sc.label}</span>
                <span style={{fontSize:11,background:sc.border,color:sc.color,borderRadius:20,padding:"1px 8px",fontWeight:700}}>{items.length}</span>
              </div>
              {items.map((m:any)=>(
                <div key={m.id} style={{background:"var(--card-bg,#fff)",border:`0.5px solid ${sc.border}`,borderRadius:10,padding:12,marginBottom:8,borderLeft:`3px solid ${sc.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div><div style={{fontWeight:700,fontSize:13,color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</div><div style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>{m.mesin?.kode}</div></div>
                    <select value={m.status} onChange={e=>updateStatus(m.id,e.target.value)} style={{fontSize:10,padding:"2px 6px",borderRadius:6,border:`1px solid ${sc.color}`,background:sc.bg,color:sc.color,cursor:"pointer",fontWeight:700}}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></select>
                  </div>
                  <div style={{fontSize:12,color:"#475569",marginBottom:6,lineHeight:1.5}}>{m.kendala}</div>
                  {m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",background:"var(--wp2-bg,#f0fdf4)",borderRadius:6,padding:"5px 8px",marginBottom:6,lineHeight:1.4}}>{m.perbaikan}</div>}
                  {m.catatan&&<div style={{fontSize:11,color:"#2563eb",background:"#eff6ff",borderRadius:6,padding:"5px 8px",marginBottom:8,lineHeight:1.4,borderLeft:"2px solid #93c5fd"}}>📝 {m.catatan}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:11,color:"#94a3b8"}}>{m.teknisi&&<span>👤 {m.teknisi}</span>}{m.tgl_kendala&&<span style={{marginLeft:6}}>📅 {m.tgl_kendala}</span>}</div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",catatan:m.catatan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                      <button onClick={()=>setDelId(m.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
              {items.length===0&&<div style={{textAlign:"center",padding:"24px",color:"#94a3b8",fontSize:12,border:"1px dashed #e2e8f0",borderRadius:8}}>Tidak ada</div>}
            </div>);
          })}
        </div>
      ):(
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Mesin</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Kendala</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Perbaikan</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Catatan</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Teknisi</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Tgl Kendala</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Tgl Perbaikan</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"center",borderRight:"1px solid #ffffff10"}}>Status</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"center"}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(<tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Tidak ada data</td></tr>):filtered.map((m:any,i:number)=>{const sc=SC[m.status]||SC.open;const bg=i%2===0?"#fff":"#f8fafc";const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"top",fontSize:12};return(
                <tr key={m.id}>
                  <td style={{...td,fontWeight:700}}><div style={{color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</div><div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>{m.mesin?.kode}</div></td>
                  <td style={{...td,maxWidth:200,color:"#475569"}}>{m.kendala}</td>
                  <td style={{...td,maxWidth:200,color:"#16a34a"}}>{m.perbaikan||"—"}</td>
                  <td style={{...td,maxWidth:160,color:"#2563eb"}}>{m.catatan||"—"}</td>
                  <td style={{...td,color:"#64748b"}}>{m.teknisi||"—"}</td>
                  <td style={{...td,fontSize:11,color:"#94a3b8"}}>{m.tgl_kendala||"—"}</td>
                  <td style={{...td,fontSize:11,color:"#94a3b8"}}>{m.tgl_perbaikan||"—"}</td>
                  <td style={{...td,textAlign:"center"}}><span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{sc.label}</span></td>
                  <td style={{...td,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}>
                    <button onClick={()=>{const t=["LAPORAN MAINTENANCE","Mesin: "+(m.mesin?.nama||"-"),"Kode: "+(m.mesin?.kode||"-"),"Tgl Kendala: "+(m.tgl_kendala||"-"),"Tgl Perbaikan: "+(m.tgl_perbaikan||"-"),"Teknisi: "+(m.teknisi||"-"),"Status: "+m.status,"","Kendala:",m.kendala||"-","","Perbaikan:",m.perbaikan||"-","","Catatan:",m.catatan||"-"].join("\n");const b=new Blob([t],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="maintenance-"+(m.mesin?.kode||m.id)+".txt";a.click();URL.revokeObjectURL(u);}} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#1d4ed8",fontWeight:700}}>↓ TXT</button>
                    <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",catatan:m.catatan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                    <button onClick={()=>setDelId(m.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                  </div></td>
                </tr>);})}
            </tbody>
          </table>
        </div>
      )}
      {delId&&(<Modal title="Hapus Log?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Log ini akan dihapus permanen.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Hapus</Btn></div></Modal>)}
    </div>
  );
}
