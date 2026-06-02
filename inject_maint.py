import sys

maintenance_code = """
function MaintenancePageTab({user}:any){
  const [subTab,setSubTab]=useState("kerusakan");
  const [mesinList,setMesinList]=useState<any[]>([]);
  const [maintenanceList,setMaintenanceList]=useState<any[]>([]);
  const [rutinList,setRutinList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const [{data:ms},{data:ml},{data:rl}]=await Promise.all([
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode"),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
        supabase.from("maintenance_rutin").select("*,mesin(nama,kode)").eq("is_active",true).order("jatuh_tempo"),
      ]);
      setMesinList(ms??[]);setMaintenanceList(ml??[]);setRutinList(rl??[]);setLoading(false);
    };load();
  },[]);
  const today=new Date().toISOString().slice(0,10);
  const terlambat=rutinList.filter((r:any)=>r.jatuh_tempo&&r.jatuh_tempo<today);
  const mingguIni=rutinList.filter((r:any)=>{
    if(!r.jatuh_tempo||r.jatuh_tempo<today)return false;
    const diff=(new Date(r.jatuh_tempo).getTime()-new Date(today).getTime())/86400000;
    return diff<=7;
  });
  return(
    <div className="fi">
      <div style={{display:"flex",gap:0,marginBottom:16,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden",width:"fit-content"}}>
        {[{id:"kerusakan",label:"Kerusakan"},{id:"rutin",label:"Maintenance Rutin"}].map((t:any)=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"9px 20px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
              background:subTab===t.id?"#1d4ed8":"transparent",
              color:subTab===t.id?"#fff":"#64748b",
              borderRight:"1px solid #e2e8f0",transition:"all .15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat data...</div>:
        subTab==="kerusakan"?
        <KerusakanTab mesinList={mesinList} maintenanceList={maintenanceList} setMaintenanceList={setMaintenanceList} user={user}/>:
        <MaintenanceRutinTab mesinList={mesinList} rutinList={rutinList} setRutinList={setRutinList} user={user} today={today} terlambat={terlambat} mingguIni={mingguIni}/>
      }
    </div>
  );
}

function KerusakanTab({mesinList,maintenanceList,setMaintenanceList,user}:any){
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
  const del=async()=>{await supabase.from("maintenance_log").delete().eq("id",delId);setMaintenanceList((p:any[])=>p.filter((m:any)=>m.id!==delId));setDelId(null);};
  const updateStatus=async(id:any,status:string)=>{await supabase.from("maintenance_log").update({status}).eq("id",id);setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?{...m,status}:m));};
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
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:12}}>{editId?"✏️ Edit Log":"➕ Tambah Log Maintenance"}</div>
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
            <div><Lbl>Catatan Harian</Lbl><Inp value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Catatan perkembangan..."/></div>
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
                <div key={m.id} style={{background:"#fff",border:`0.5px solid ${sc.border}`,borderRadius:10,padding:12,marginBottom:8,borderLeft:`3px solid ${sc.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div><div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{m.mesin?.nama||"—"}</div><div style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>{m.mesin?.kode}</div></div>
                    <select value={m.status} onChange={e=>updateStatus(m.id,e.target.value)} style={{fontSize:10,padding:"2px 6px",borderRadius:6,border:`1px solid ${sc.color}`,background:sc.bg,color:sc.color,cursor:"pointer",fontWeight:700}}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></select>
                  </div>
                  <div style={{fontSize:12,color:"#475569",marginBottom:6,lineHeight:1.5}}>{m.kendala}</div>
                  {m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",background:"#f0fdf4",borderRadius:6,padding:"5px 8px",marginBottom:6,lineHeight:1.4}}>{m.perbaikan}</div>}
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
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map((m:any)=>{const sc=SC[m.status]||SC.open;return(
            <div key={m.id} style={{background:"#fff",borderRadius:10,border:`0.5px solid ${sc.border}`,padding:"12px 16px",borderLeft:`3px solid ${sc.color}`,display:"flex",gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                  <span style={{fontWeight:700,fontSize:13}}>{m.mesin?.nama||"—"}</span>
                  <span style={{fontFamily:"monospace",fontSize:11,color:"#64748b",background:"#f1f5f9",borderRadius:4,padding:"1px 6px"}}>{m.mesin?.kode}</span>
                  <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{sc.label}</span>
                </div>
                <div style={{fontSize:12,color:"#475569",marginBottom:3}}>{m.kendala}</div>
                {m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",marginBottom:3}}>{m.perbaikan}</div>}
                {m.catatan&&<div style={{fontSize:11,color:"#2563eb",background:"#eff6ff",borderRadius:5,padding:"2px 8px",marginBottom:3,display:"inline-block"}}>📝 {m.catatan}</div>}
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{m.teknisi&&<span>👤 {m.teknisi} </span>}{m.tgl_kendala&&<span>📅 {m.tgl_kendala}</span>}{m.tgl_perbaikan&&<span> → ✅ {m.tgl_perbaikan}</span>}</div>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",catatan:m.catatan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>✏️</button>
                <button onClick={()=>setDelId(m.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
              </div>
            </div>
          );})}
        </div>
      )}
      {delId&&(<Modal title="Hapus Log?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Log ini akan dihapus permanen.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Hapus</Btn></div></Modal>)}
    </div>
  );
}

function MaintenanceRutinTab({mesinList,rutinList,setRutinList,user,today,terlambat,mingguIni}:any){
  const [form,setForm]=useState({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const [doneId,setDoneId]=useState<any>(null);
  const [filterFrek,setFilterFrek]=useState("ALL");
  const FC:any={harian:{label:"Harian",bg:"#E6F1FB",color:"#0C447C",border:"#85B7EB"},mingguan:{label:"Mingguan",bg:"#EEEDFE",color:"#3C3489",border:"#AFA9EC"},bulanan:{label:"Bulanan",bg:"#E1F5EE",color:"#085041",border:"#5DCAA5"},"3bulan":{label:"3 Bulanan",bg:"#FAEEDA",color:"#633806",border:"#EF9F27"},tahunan:{label:"Tahunan",bg:"#FCEBEB",color:"#791F1F",border:"#F09595"}};
  const calcNext=(d:string,f:string)=>{if(!d)return"";const dt=new Date(d);if(f==="harian")dt.setDate(dt.getDate()+1);else if(f==="mingguan")dt.setDate(dt.getDate()+7);else if(f==="bulanan")dt.setMonth(dt.getMonth()+1);else if(f==="3bulan")dt.setMonth(dt.getMonth()+3);else if(f==="tahunan")dt.setFullYear(dt.getFullYear()+1);return dt.toISOString().slice(0,10);};
  const getStatus=(r:any)=>{if(!r.jatuh_tempo)return{label:"Belum dijadwalkan",color:"#64748b",bg:"#f1f5f9"};if(r.jatuh_tempo<today)return{label:"Terlambat",color:"#dc2626",bg:"#fef2f2"};const diff=Math.ceil((new Date(r.jatuh_tempo).getTime()-new Date(today).getTime())/86400000);if(diff===0)return{label:"Hari ini!",color:"#dc2626",bg:"#fef2f2"};if(diff<=3)return{label:diff+"hr lagi",color:"#f59e0b",bg:"#fffbeb"};if(diff<=7)return{label:diff+"hr lagi",color:"#2563eb",bg:"#eff6ff"};return{label:diff+"hr lagi",color:"#16a34a",bg:"#f0fdf4"};};
  const save=async()=>{
    if(!form.mesin_id||!form.jenis_maintenance.trim())return;
    const jt=form.jatuh_tempo||calcNext(form.terakhir_dilakukan,form.frekuensi);
    const payload={mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance,frekuensi:form.frekuensi,teknisi:form.teknisi,terakhir_dilakukan:form.terakhir_dilakukan||null,jatuh_tempo:jt||null,catatan:form.catatan,is_active:true};
    if(editId){
      const{data,error}=await supabase.from("maintenance_rutin").update(payload).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(!error){setRutinList((p:any[])=>p.map((r:any)=>r.id===editId?data:r));setEditId(null);setShowForm(false);}
    } else {
      const{data,error}=await supabase.from("maintenance_rutin").insert(payload).select("*,mesin(nama,kode)").single();
      if(!error){setRutinList((p:any[])=>[...p,data]);setShowForm(false);}
    }
    setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  };
  const markDone=async(item:any)=>{
    const jt=calcNext(today,item.frekuensi);
    const{data}=await supabase.from("maintenance_rutin").update({terakhir_dilakukan:today,jatuh_tempo:jt}).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));await supabase.from("maintenance_rutin_log").insert({rutin_id:item.id,dilakukan_pada:today,teknisi:item.teknisi,catatan:"Selesai"});}
    setDoneId(null);
  };
  const del=async()=>{await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));setDelId(null);};
  const kepatuhan=rutinList.length>0?Math.round((rutinList.filter((r:any)=>r.terakhir_dilakukan&&r.jatuh_tempo>=today).length/rutinList.length)*100):0;
  const filtered=filterFrek==="ALL"?rutinList:rutinList.filter((r:any)=>r.frekuensi===filterFrek);
  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[{l:"Terlambat",v:terlambat.length,c:"#dc2626"},{l:"Jatuh tempo minggu ini",v:mingguIni.length,c:"#f59e0b"},{l:"Total jadwal",v:rutinList.length,c:"#2563eb"},{l:"Kepatuhan",v:kepatuhan+"%",c:"#16a34a"}].map((s:any,i:number)=>(<Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div></Card>))}
      </div>
      {([...terlambat,...mingguIni]).length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>Perlu perhatian</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[...terlambat,...mingguIni].slice(0,4).map((r:any)=>{const st=getStatus(r);const fc=FC[r.frekuensi]||FC.bulanan;return(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:st.bg,border:`1px solid ${st.color}30`,borderRadius:8,borderLeft:`3px solid ${st.color}`}}>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.jenis_maintenance}</div><div style={{fontSize:11,color:"#64748b"}}>{r.mesin?.nama} · {r.teknisi||"Belum assign"}</div></div>
                <span style={{background:fc.bg,color:fc.color,border:`1px solid ${fc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{fc.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:st.color,whiteSpace:"nowrap"}}>{st.label}</span>
                <button onClick={()=>setDoneId(r)} style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#fff",fontWeight:700}}>Selesai</button>
              </div>
            );})}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
          {["ALL","harian","mingguan","bulanan","3bulan","tahunan"].map((f:string)=>(<button key={f} onClick={()=>setFilterFrek(f)} style={{padding:"5px 10px",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterFrek===f?"#1d4ed8":"#fff",color:filterFrek===f?"#fff":"#64748b",borderRight:"1px solid #e2e8f0"}}>{f==="ALL"?"Semua":FC[f]?.label}</button>))}
        </div>
        <Btn color="#1d4ed8" style={{marginLeft:"auto"}} onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});}}>{showForm?"Tutup":"+ Tambah Jadwal"}</Btn>
      </div>
      {showForm&&(
        <Card style={{marginBottom:14,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:12}}>{editId?"Edit":"Tambah Jadwal Rutin"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl><Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}><option value="">-- Pilih --</option>{mesinList.map((m:any)=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}</Sel></div>
            <div><Lbl>Jenis Maintenance</Lbl><Inp value={form.jenis_maintenance} onChange={e=>setForm({...form,jenis_maintenance:e.target.value})} placeholder="Pelumasan, ganti oli..."/></div>
            <div><Lbl>Frekuensi</Lbl><Sel value={form.frekuensi} onChange={e=>setForm({...form,frekuensi:e.target.value})}>{Object.entries(FC).map(([k,v]:any)=><option key={k} value={k}>{v.label}</option>)}</Sel></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Terakhir Dilakukan</Lbl><Inp type="date" value={form.terakhir_dilakukan} onChange={e=>setForm({...form,terakhir_dilakukan:e.target.value,jatuh_tempo:calcNext(e.target.value,form.frekuensi)})}/></div>
            <div><Lbl>Jatuh Tempo</Lbl><Inp type="date" value={form.jatuh_tempo} onChange={e=>setForm({...form,jatuh_tempo:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Catatan</Lbl><Inp value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Catatan tambahan..."/></div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}><Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn><Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn></div>
          </div>
        </Card>
      )}
      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Mesin","Jenis Maintenance","Frekuensi","Teknisi","Terakhir","Jatuh Tempo","Status","Aksi"].map((h:string)=><th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0?(<tr><td colSpan={8} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Belum ada jadwal</td></tr>):
            filtered.map((r:any,i:number)=>{const fc=FC[r.frekuensi]||FC.bulanan;const st=getStatus(r);const bg=i%2===0?"#fff":"#f8fafc";const td:any={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"middle"};return(
              <tr key={r.id}>
                <td style={td}><div style={{fontWeight:700}}>{r.mesin?.nama||"—"}</div><div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>{r.mesin?.kode}</div></td>
                <td style={{...td,fontWeight:600,color:"#475569"}}>{r.jenis_maintenance}</td>
                <td style={td}><span style={{background:fc.bg,color:fc.color,border:`1px solid ${fc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{fc.label}</span></td>
                <td style={{...td,color:"#64748b"}}>{r.teknisi||"—"}</td>
                <td style={{...td,fontSize:11,color:"#94a3b8"}}>{r.terakhir_dilakukan||"—"}</td>
                <td style={{...td,fontSize:11,fontWeight:600,color:st.color}}>{r.jatuh_tempo||"—"}</td>
                <td style={td}><span style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{st.label}</span></td>
                <td style={{...td,textAlign:"center"}}>
                  <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                    <button onClick={()=>setDoneId(r)} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:700}}>Done</button>
                    <button onClick={()=>{setEditId(r.id);setForm({mesin_id:r.mesin_id?.toString()||"",jenis_maintenance:r.jenis_maintenance||"",frekuensi:r.frekuensi||"mingguan",teknisi:r.teknisi||"",terakhir_dilakukan:r.terakhir_dilakukan||"",jatuh_tempo:r.jatuh_tempo||"",catatan:r.catatan||""});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                    <button onClick={()=>setDelId(r.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {doneId&&(<Modal title="Tandai Selesai?" onClose={()=>setDoneId(null)} width={400}><div style={{fontSize:13,color:"#475569",marginBottom:8}}><strong>{doneId.jenis_maintenance}</strong> — {doneId.mesin?.nama}</div><div style={{fontSize:12,color:"#064e3b",background:"#f0fdf4",borderRadius:8,padding:"10px 12px",marginBottom:20}}>Jadwal berikutnya otomatis dihitung dari hari ini.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDoneId(null)}>Batal</Btn><Btn color="#16a34a" onClick={()=>markDone(doneId)}>Selesai</Btn></div></Modal>)}
      {delId&&(<Modal title="Nonaktifkan?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Jadwal ini akan dinonaktifkan.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Nonaktifkan</Btn></div></Modal>)}
    </div>
  );
}
"""

with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

target = 'function RecycleBinTab({user}:any){'
idx = c.index(target)
c = c[:idx] + maintenance_code.strip() + '\n\n' + c[idx:]

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Done! Lines:', c.count('\n'))
print('MaintenancePageTab:', c.count('function MaintenancePageTab'))
print('KerusakanTab:', c.count('function KerusakanTab'))
print('RecycleBinTab:', c.count('function RecycleBinTab'))
