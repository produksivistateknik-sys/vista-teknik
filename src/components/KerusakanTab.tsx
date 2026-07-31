import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { fmtShort } from '../lib/dateHelpers'
import { Card, Lbl, Sel, Inp, Btn, Modal } from './ui/Primitives'

const BLANK_FORM={mesin_id:"",judul:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"};

export function KerusakanTab({mesinList,maintenanceList,setMaintenanceList,user}:any){
  const [form,setForm]=useState<any>(BLANK_FORM);
  const [stagedFoto,setStagedFoto]=useState<{file:File,previewUrl:string}[]>([]);
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [expanded,setExpanded]=useState<Set<any>>(new Set());
  const [updateFormId,setUpdateFormId]=useState<any>(null);
  const [updateText,setUpdateText]=useState("");
  const SC:any={open:{color:"#dc2626",bg:"#FCEBEB",border:"#F09595",label:"Open"},in_progress:{color:"#f59e0b",bg:"#FAEEDA",border:"#FAC775",label:"In Progress"},closed:{color:"#16a34a",bg:"#EAF3DE",border:"#C0DD97",label:"Closed"}};
  const getUname=()=>{const s=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");return user?.name||user?.nama||s?.nama||"Admin";};

  const toggleExpand=(id:any)=>setExpanded(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});

  const pilihFoto=(fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFoto(prev=>[...prev,...dipilih]);
  };
  const batalkanFotoStaged=(idx:number)=>{
    setStagedFoto(prev=>{const arr=[...prev];URL.revokeObjectURL(arr[idx]?.previewUrl);arr.splice(idx,1);return arr;});
  };

  const resetForm=()=>{
    setForm(BLANK_FORM);
    stagedFoto.forEach(s=>URL.revokeObjectURL(s.previewUrl));
    setStagedFoto([]);
  };

  const save=async()=>{
    if(!form.mesin_id||!form.judul.trim())return;
    setSaving(true);
    try{
      const fotoBaru:any[]=[];
      for(const s of stagedFoto){
        const path=`${form.mesin_id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from("maintenance-photos").upload(path,s.file,{contentType:s.file.type||"image/jpeg"});
        if(upErr)continue;
        const{data:urlData}=supabase.storage.from("maintenance-photos").getPublicUrl(path);
        fotoBaru.push({url:urlData.publicUrl,uploaded_at:new Date().toISOString()});
      }
      const payload:any={mesin_id:Number(form.mesin_id),judul:form.judul.trim(),kendala:form.kendala,perbaikan:form.perbaikan,tgl_kendala:form.tgl_kendala||null,tgl_perbaikan:form.tgl_perbaikan||null,teknisi:form.teknisi,status:form.status};
      if(editId){
        const existing=maintenanceList.find((m:any)=>m.id===editId);
        if(fotoBaru.length>0)payload.foto=[...(existing?.foto||[]),...fotoBaru];
        const{data,error}=await supabase.from("maintenance_log").update(payload).eq("id",editId).select("*,mesin(nama,kode)").single();
        if(!error){setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===editId?data:m));setEditId(null);setShowForm(false);resetForm();}
      } else {
        if(fotoBaru.length>0)payload.foto=fotoBaru;
        const{data,error}=await supabase.from("maintenance_log").insert(payload).select("*,mesin(nama,kode)").single();
        if(!error){
          setMaintenanceList((p:any[])=>[data,...p]);
          await activityLogService.insert({user_name:getUname(),action:"TAMBAH MAINTENANCE",description:"Tambah log maintenance "+data.mesin?.nama+" - "+data.judul,module:"maintenance",halaman:"Maintenance"});
          setShowForm(false);
          resetForm();
        }
      }
    } finally {
      setSaving(false);
    }
  };
  const del=async()=>{
    const item=maintenanceList.find((m:any)=>m.id===delId);
    await supabase.from("maintenance_log").delete().eq("id",delId);
    setMaintenanceList((p:any[])=>p.filter((m:any)=>m.id!==delId));
    setDelId(null);
    await activityLogService.insert({user_name:getUname(),action:"HAPUS LOG MAINTENANCE",description:"Hapus log: "+(item?.mesin?.nama||"-")+" - "+(item?.judul||item?.kendala||"-").slice(0,50),module:"maintenance",halaman:"Maintenance"});
  };
  const updateStatus=async(id:any,status:string)=>{
    await supabase.from("maintenance_log").update({status}).eq("id",id);
    setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?{...m,status}:m));
    const item=maintenanceList.find((m:any)=>m.id===id);
    await activityLogService.insert({user_name:getUname(),action:"UPDATE STATUS MAINTENANCE",description:"Update status: "+(item?.mesin?.nama||"-")+" -> "+status,module:"maintenance",halaman:"Maintenance"});
  };
  const tambahUpdate=async(id:any)=>{
    if(!updateText.trim())return;
    const item=maintenanceList.find((m:any)=>m.id===id);
    const entry={tanggal:new Date().toISOString().slice(0,10),catatan:updateText.trim(),oleh:getUname()};
    const newArr=[...(item?.update_harian||[]),entry];
    const{data,error}=await supabase.from("maintenance_log").update({update_harian:newArr}).eq("id",id).select("*,mesin(nama,kode)").single();
    if(!error){
      setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?data:m));
      setUpdateFormId(null);setUpdateText("");
      setExpanded(prev=>new Set(prev).add(id));
      await activityLogService.insert({user_name:getUname(),action:"TAMBAH UPDATE MAINTENANCE",description:"Tambah update: "+(item?.mesin?.nama||"-")+" - "+entry.catatan.slice(0,50),module:"maintenance",halaman:"Maintenance"});
    }
  };

  // Export ke Word (.doc) - trik lama tapi robust: HTML disimpan dgn ekstensi .doc + MIME
  // application/msword, Word buka ini native tanpa perlu library docx baru/dependency tambahan.
  // Gambar (foto) diikutsertakan sbg <img> - Word ambil dari URL publik Supabase Storage pas dibuka.
  const downloadWord=(m:any)=>{
    const sc=SC[m.status]||SC.open;
    const kendalaLines=(m.kendala||"").split("\n");
    const judulTampil=(m.judul||"").trim()||kendalaLines[0]||"(tanpa judul)";
    const deskripsiTampil=(m.judul||"").trim()?(m.kendala||""):kendalaLines.slice(1).join(" ").trim();
    const updateHarian=m.update_harian||[];
    const foto=m.foto||[];
    const esc=(s:any)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
    const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Laporan Maintenance</title></head>
<body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;">
  <h2 style="margin-bottom:4px;">Laporan Maintenance</h2>
  <p style="color:#555;margin-top:0;">${esc(judulTampil)}</p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
    <tr><td style="width:140px;padding:4px 0;"><b>Mesin</b></td><td style="padding:4px 0;">${esc(m.mesin?.nama)} (${esc(m.mesin?.kode)})</td></tr>
    <tr><td style="padding:4px 0;"><b>Status</b></td><td style="padding:4px 0;">${esc(sc.label)}</td></tr>
    <tr><td style="padding:4px 0;"><b>Tanggal Kendala</b></td><td style="padding:4px 0;">${esc(m.tgl_kendala||"-")}</td></tr>
    <tr><td style="padding:4px 0;"><b>Tanggal Perbaikan</b></td><td style="padding:4px 0;">${esc(m.tgl_perbaikan||"-")}</td></tr>
    <tr><td style="padding:4px 0;"><b>Teknisi / PIC</b></td><td style="padding:4px 0;">${esc(m.teknisi||"-")}</td></tr>
  </table>
  <h3>Deskripsi / Penyebab</h3>
  <p>${esc(deskripsiTampil||"-")}</p>
  <h3>Perbaikan</h3>
  <p>${esc(m.perbaikan||"-")}</p>
  ${(updateHarian.length>0||m.catatan)?`<h3>Riwayat Update</h3>${m.catatan?`<p><i>Catatan lama: ${esc(m.catatan)}</i></p>`:""}${updateHarian.map((u:any,ui:number)=>`<p><b>Hari ke-${ui+1}</b> (${esc(u.tanggal)}${u.oleh?", "+esc(u.oleh):""})<br/>${esc(u.catatan)}</p>`).join("")}`:""}
  ${foto.length>0?`<h3>Foto</h3>${foto.map((f:any)=>`<p><img src="${f.url}" style="max-width:320px;"/></p>`).join("")}`:""}
</body></html>`;
    const blob=new Blob(["﻿",html],{type:"application/msword"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`maintenance-${(m.mesin?.kode||m.id)}-${m.tgl_kendala||m.id}.doc`;a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit=(m:any)=>{
    setEditId(m.id);
    setForm({mesin_id:m.mesin_id?.toString()||"",judul:m.judul||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});
    setStagedFoto([]);
    setShowForm(true);
  };

  const filtered=(filterStatus==="ALL"?maintenanceList:maintenanceList.filter((m:any)=>m.status===filterStatus))
    .slice().sort((a:any,b:any)=>(b.tgl_kendala||"").localeCompare(a.tgl_kendala||"")||b.id-a.id);
  const stats=[{l:"Open",v:maintenanceList.filter((m:any)=>m.status==="open").length,c:"#dc2626"},{l:"In Progress",v:maintenanceList.filter((m:any)=>m.status==="in_progress").length,c:"#f59e0b"},{l:"Closed",v:maintenanceList.filter((m:any)=>m.status==="closed").length,c:"#16a34a"},{l:"Total Mesin",v:mesinList.length,c:"#2563eb"}];

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {stats.map((s:any,i:number)=>(<Card key={i} style={{padding:"12px 16px"}}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div></Card>))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
          {["ALL","open","in_progress","closed"].map((s:string)=>(<button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"5px 12px",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterStatus===s?"#1d4ed8":"#fff",color:filterStatus===s?"#fff":"#64748b",borderRight:"1px solid #e2e8f0"}}>{s==="ALL"?"Semua":SC[s]?.label}</button>))}
        </div>
        <Btn color="#1d4ed8" style={{marginLeft:"auto"}} onClick={()=>{setShowForm(!showForm);setEditId(null);resetForm();}}>{showForm?"✕ Tutup":"+ Tambah Log"}</Btn>
      </div>
      {showForm&&(
        <Card style={{marginBottom:14,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary,#1e293b)",marginBottom:12}}>{editId?"✏️ Edit Log":"➕ Tambah Log Kerusakan"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl><Sel value={form.mesin_id} onChange={(e:any)=>setForm({...form,mesin_id:e.target.value})}><option value="">-- Pilih Mesin --</option>{mesinList.map((m:any)=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}</Sel></div>
            <div><Lbl>Tgl Kendala</Lbl><Inp type="date" value={form.tgl_kendala} onChange={(e:any)=>setForm({...form,tgl_kendala:e.target.value})}/></div>
            <div><Lbl>Status</Lbl><Sel value={form.status} onChange={(e:any)=>setForm({...form,status:e.target.value})}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></Sel></div>
          </div>
          <div style={{marginBottom:12}}><Lbl>Judul Masalah</Lbl><Inp value={form.judul} onChange={(e:any)=>setForm({...form,judul:e.target.value})} placeholder="Ringkasan singkat masalahnya..."/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Deskripsi / Penyebab</Lbl><textarea value={form.kendala} onChange={(e:any)=>setForm({...form,kendala:e.target.value})} placeholder="Detail kendala, penyebab..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:72,fontFamily:"inherit"}}/></div>
            <div><Lbl>Perbaikan</Lbl><textarea value={form.perbaikan} onChange={(e:any)=>setForm({...form,perbaikan:e.target.value})} placeholder="Tindakan perbaikan..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:72,fontFamily:"inherit"}}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Teknisi / PIC</Lbl><Inp value={form.teknisi} onChange={(e:any)=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Tgl Perbaikan</Lbl><Inp type="date" value={form.tgl_perbaikan} onChange={(e:any)=>setForm({...form,tgl_perbaikan:e.target.value})}/></div>
          </div>
          <div style={{marginBottom:12}}>
            <Lbl>Foto (opsional)</Lbl>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:stagedFoto.length>0?8:0}}>
              {stagedFoto.map((s,si)=>(
                <div key={si} style={{position:"relative"}}>
                  <img src={s.previewUrl} style={{width:56,height:56,borderRadius:8,objectFit:"cover",border:"1.5px dashed #2563eb"}}/>
                  <button onClick={()=>batalkanFotoStaged(si)} style={{position:"absolute",top:-6,right:-6,width:17,height:17,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",fontSize:9,lineHeight:1}}>✕</button>
                </div>
              ))}
            </div>
            <label style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:"#64748b",background:"#f8fafc",border:"1.5px dashed #cbd5e1",borderRadius:10,padding:"8px 12px",cursor:"pointer"}}>
              📷 Tambah Foto
              <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={(e:any)=>{pilihFoto(e.target.files);e.target.value="";}}/>
            </label>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save} disabled={saving}>{saving?"Menyimpan...":editId?"Simpan":"Tambah"}</Btn>
            <Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);resetForm();}}>Batal</Btn>
          </div>
        </Card>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:12,border:"1px dashed #e2e8f0",borderRadius:10}}>Tidak ada data</div>}
        {filtered.map((m:any)=>{
          const sc=SC[m.status]||SC.open;
          const isExpanded=expanded.has(m.id);
          const kendalaLines=(m.kendala||"").split("\n");
          const judulTampil=(m.judul||"").trim()||kendalaLines[0]||"(tanpa judul)";
          const deskripsiTampil=(m.judul||"").trim()?(m.kendala||""):kendalaLines.slice(1).join(" ").trim();
          const updateHarian=m.update_harian||[];
          const jumlahUpdate=updateHarian.length+(m.catatan?1:0);
          const foto=m.foto||[];
          return(
            <Card key={m.id} style={{position:"relative",padding:"14px 16px 14px 16px",borderLeft:`3px solid ${sc.color}`}}>
              <div style={{position:"absolute",top:10,right:10,display:"flex",gap:4}}>
                <button onClick={()=>downloadWord(m)} title="Download laporan (Word)" style={{background:"transparent",border:"none",borderRadius:6,padding:4,cursor:"pointer",fontSize:12,color:"#cbd5e1"}}>📄</button>
                <button onClick={()=>openEdit(m)} title="Edit" style={{background:"transparent",border:"none",borderRadius:6,padding:4,cursor:"pointer",fontSize:12,color:"#cbd5e1"}}>✏️</button>
                <button onClick={()=>setDelId(m.id)} title="Hapus" style={{background:"transparent",border:"none",borderRadius:6,padding:4,cursor:"pointer",fontSize:12,color:"#cbd5e1"}}>🗑</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,paddingRight:44}}>
                <span style={{fontWeight:700,fontSize:13,color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</span>
                <span style={{fontSize:10.5,color:"#94a3b8",fontFamily:"monospace"}}>{m.mesin?.kode}</span>
                <select value={m.status} onChange={(e:any)=>updateStatus(m.id,e.target.value)}
                  style={{fontSize:9.5,padding:"1px 8px",borderRadius:20,border:`1px solid ${sc.border}`,background:sc.bg,color:sc.color,cursor:"pointer",fontWeight:700}}>
                  <option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option>
                </select>
              </div>
              <div style={{fontSize:12.5,color:"#334155",fontWeight:600,marginBottom:2}}>{judulTampil}</div>
              {deskripsiTampil&&<div style={{fontSize:11.5,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:8}}>{deskripsiTampil}</div>}
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",fontSize:11,color:"#94a3b8"}}>
                {m.teknisi&&<span>👤 {m.teknisi}</span>}
                {m.tgl_kendala&&<span>📅 {fmtShort(m.tgl_kendala)}</span>}
                {foto.length>0&&<span>📷 {foto.length}</span>}
                {jumlahUpdate>0&&(
                  <button onClick={()=>toggleExpand(m.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#2563eb",fontWeight:700,padding:0}}>
                    {jumlahUpdate} update {isExpanded?"▴":"▾"}
                  </button>
                )}
                {m.status!=="closed"&&(
                  <button onClick={()=>{setUpdateFormId(updateFormId===m.id?null:m.id);setUpdateText("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:700,padding:0,marginLeft:"auto"}}>
                    + Tambah Update
                  </button>
                )}
              </div>
              {updateFormId===m.id&&(
                <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
                  <input value={updateText} onChange={(e:any)=>setUpdateText(e.target.value)} placeholder={"Catatan update (otomatis "+fmtShort(new Date().toISOString().slice(0,10))+")..."}
                    style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:11.5}}
                    onKeyDown={(e:any)=>{if(e.key==="Enter")tambahUpdate(m.id);}}/>
                  <Btn color="#16a34a" style={{padding:"6px 12px",fontSize:11}} onClick={()=>tambahUpdate(m.id)}>Simpan</Btn>
                </div>
              )}
              {isExpanded&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f1f5f9",display:"flex",flexDirection:"column",gap:6}}>
                  {m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",background:"var(--wp2-bg,#f0fdf4)",borderRadius:6,padding:"6px 9px",lineHeight:1.4}}><b>Perbaikan:</b> {m.perbaikan}</div>}
                  {m.catatan&&<div style={{fontSize:11,color:"#94a3b8",background:"#f8fafc",borderRadius:6,padding:"6px 9px",lineHeight:1.4,fontStyle:"italic"}}><b>Catatan lama:</b> {m.catatan}</div>}
                  {updateHarian.map((u:any,ui:number)=>(
                    <div key={ui} style={{fontSize:11,color:"#475569",background:"#eff6ff",borderRadius:6,padding:"6px 9px",lineHeight:1.4,borderLeft:"2px solid #93c5fd"}}>
                      <b>Hari ke-{ui+1}</b> · {fmtShort(u.tanggal)}{u.oleh?" · "+u.oleh:""}<br/>{u.catatan}
                    </div>
                  ))}
                  {foto.length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:2}}>
                      {foto.map((f:any,fi:number)=>(
                        <a key={fi} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} style={{width:52,height:52,borderRadius:8,objectFit:"cover",border:"1px solid #e2e8f0"}}/></a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {delId&&(<Modal title="Hapus Log?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Log ini akan dihapus permanen.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Hapus</Btn></div></Modal>)}
    </div>
  );
}
