import { useState } from 'react'
import { DIVISI_CONFIG, OPERATOR_ROLES } from '../constants/panelTypes'
import { Card, Lbl, Inp, Sel, Btn, Modal } from './ui/Primitives'

export function MasterPekerja({pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,log,user}){
  const [form,setForm]=useState({nama:"",divisi:"mekanik"});
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [filterDiv,setFilterDiv]=useState("ALL");
  const [search,setSearch]=useState("");

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>OPERATOR_ROLES.includes(k))
    .map(([k,v])=>({key:k,...v}));

  const filtered=pekerja.filter(p=>
    (filterDiv==="ALL"||p.divisi===filterDiv)&&
    p.nama.toLowerCase().includes(search.toLowerCase())
  );

  const save=async()=>{
    if(!form.nama.trim())return;
    if(editId){
      await updatePekerja(editId,{nama:form.nama.trim(),divisi:form.divisi});
      setEditId(null);
    } else {
      await createPekerja({nama:form.nama.trim(),divisi:form.divisi});
    }
    setForm({nama:"",divisi:"mekanik"});
  };

  const startEdit=(p)=>{setEditId(p.id);setForm({nama:p.nama,divisi:p.divisi});};
  const cancelEdit=()=>{setEditId(null);setForm({nama:"",divisi:"mekanik"});};

  const thS={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  return(
    <div className="fi">
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:14}}>
        {operatorDivisi.map(d=>{
          const cnt=pekerja.filter(p=>p.divisi===d.key).length;
          return(
            <div key={d.key} onClick={()=>setFilterDiv(filterDiv===d.key?"ALL":d.key)}
              style={{background:filterDiv===d.key?d.bg:"#fff",border:`1px solid ${filterDiv===d.key?d.color:"#e2e8f0"}`,
                borderLeft:`3px solid ${d.color}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",transition:"all .15s"}}>
              <div style={{fontSize:18,fontWeight:800,color:d.color}}>{cnt}</div>
              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,marginTop:2}}>{d.label}</div>
            </div>
          );
        })}
      </div>

      {/* Form */}
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>
          {editId?"✏️ Edit Pekerja":"➕ Tambah Pekerja Baru"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:180}}>
            <Lbl>Nama Lengkap</Lbl>
            <Inp value={form.nama} onChange={e=>setForm({...form,nama:e.target.value})}
              placeholder="Nama pekerja..." onKeyDown={e=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:160}}>
            <Lbl>Divisi</Lbl>
            <Sel value={form.divisi} onChange={e=>setForm({...form,divisi:e.target.value})}>
              {operatorDivisi.map(d=><option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
            </Sel>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save} style={{padding:"9px 20px"}}>
              {editId?"Simpan":"+ Tambah"}
            </Btn>
            {editId&&<Btn outline color="#64748b" onClick={cancelEdit} style={{padding:"9px 16px"}}>Batal</Btn>}
          </div>
        </div>
      </Card>

      {/* Filter + Search */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama pekerja..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:220}}/>
        <button onClick={()=>setFilterDiv("ALL")}
          style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,
            border:filterDiv==="ALL"?"1.5px solid #1d4ed8":"1.5px solid #e2e8f0",
            background:filterDiv==="ALL"?"#1d4ed8":"#fff",
            color:filterDiv==="ALL"?"#fff":"#64748b"}}>
          Semua ({pekerja.length})
        </button>
        {operatorDivisi.map(d=>{
          const cnt=pekerja.filter(p=>p.divisi===d.key).length;
          const isSel=filterDiv===d.key;
          return(
            <button key={d.key} onClick={()=>setFilterDiv(isSel?"ALL":d.key)}
              style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,
                border:isSel?`1.5px solid ${d.color}`:"1.5px solid #e2e8f0",
                background:isSel?d.color+"18":"#fff",color:isSel?d.color:"#64748b"}}>
              {d.label} ({cnt})
            </button>
          );
        })}
        <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{filtered.length} pekerja</span>
      </div>

      {/* Tabel */}
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={{...thS,width:40,textAlign:"center" as const}}>No</th>
              <th style={thS}>Nama</th>
              <th style={thS}>Divisi</th>
              <th style={{...thS,textAlign:"center" as const,width:100}}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={4} style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:13}}>
                Tidak ada pekerja ditemukan
              </td></tr>
            ):filtered.map((p,i)=>{
              const dc=DIVISI_CONFIG[p.divisi];
              const rBg=i%2===0?"#fff":"#f8fafc";
              const isEdit=editId===p.id;
              const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",
                borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
              return(
                <tr key={p.id}>
                  <td style={{...td,textAlign:"center",color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{p.nama}</td>
                  <td style={td}>
                    <span style={{background:dc?.bg,color:dc?.color,border:`1px solid ${dc?.color}30`,
                      borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>
                      {dc?.icon} {dc?.label}
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>startEdit(p)}
                        style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,
                          padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                      <button onClick={()=>setDelId(p.id)}
                        style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,
                          padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {delId&&(
        <Modal title="Hapus Pekerja?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Pekerja <strong>{pekerja.find(p=>p.id===delId)?.nama}</strong> akan dihapus dari database.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={()=>{setPekerja(prev=>prev.filter(p=>p.id!==delId));setDelId(null);}}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
