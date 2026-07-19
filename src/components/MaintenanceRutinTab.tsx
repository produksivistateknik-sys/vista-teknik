import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { getLocalDateStr } from '../lib/dateHelpers'
import { Card, Lbl, Sel, Inp, Btn, Modal } from './ui/Primitives'

export function MaintenanceRutinTab({mesinList,rutinList,setRutinList,user,today,terlambat,mingguIni}:any){
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
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    if(editId){
      const{data}=await supabase.from("maintenance_rutin").update({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
      }).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(data){
        setRutinList((p:any[])=>p.map((r:any)=>r.id===editId?data:r));
        await activityLogService.insert({user_name:uname,action:"EDIT MAINTENANCE RUTIN",
          description:"Edit jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
          module:"maintenance",halaman:"Maintenance"});
      }
    } else {
      const{data}=await supabase.from("maintenance_rutin").insert({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
        is_active:true,
      }).select("*,mesin(nama,kode)").single();
      if(data){
        setRutinList((p:any[])=>[...p,data]);
        await activityLogService.insert({user_name:uname,action:"TAMBAH MAINTENANCE RUTIN",
          description:"Tambah jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
          module:"maintenance",halaman:"Maintenance"});
      }
    }
    setShowForm(false);setEditId(null);
    setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  };
  const del=async()=>{
  const item=rutinList.find((r:any)=>r.id===delId);
  await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);
  setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));
  setDelId(null);
  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
  await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"NONAKTIF MAINTENANCE RUTIN",description:"Nonaktifkan jadwal: "+(item?.jenis_maintenance||"-")+" - "+(item?.mesin?.nama||"-"),module:"maintenance",halaman:"Maintenance"});
};

  const markDone=async(item:any)=>{
    const todayStr=getLocalDateStr();
    const nextDate=calcNext(todayStr,item.frekuensi);
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    const{data}=await supabase.from("maintenance_rutin").update({
      terakhir_dilakukan:todayStr,
      jatuh_tempo:nextDate,
    }).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){
      setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));
      await activityLogService.insert({
        user_name:uname,
        action:"MAINTENANCE RUTIN DONE",
        description:"Selesai: "+item.jenis_maintenance+" - "+item.mesin?.nama+" ("+todayStr+"). Jadwal berikutnya: "+nextDate,
        module:"maintenance",halaman:"Maintenance"
      });
    }
    setDoneId(null);
  };
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
