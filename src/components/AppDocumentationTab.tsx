import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Inp, Btn } from './ui/Primitives'

const KATEGORI_LIST=["Monitoring","Produksi","System"];

export function AppDocumentationTab(){
  const [list,setList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [editId,setEditId]=useState<number|null>(null);
  const [form,setForm]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [newForm,setNewForm]=useState({nama_tab:"",kategori:"Monitoring",fungsi_singkat:"",isi_lengkap:""});

  const fetchList=async()=>{
    setLoading(true);
    const{data}=await supabase.from("app_documentation").select("*").order("kategori").order("nama_tab");
    setList(data??[]);
    setLoading(false);
  };
  useEffect(()=>{fetchList();},[]);

  const startEdit=(row:any)=>{
    setEditId(row.id);
    setForm({nama_tab:row.nama_tab,kategori:row.kategori,fungsi_singkat:row.fungsi_singkat,isi_lengkap:row.isi_lengkap||""});
  };
  const cancelEdit=()=>{setEditId(null);setForm({});};

  const saveEdit=async(id:number)=>{
    if(!form.nama_tab?.trim()||!form.fungsi_singkat?.trim()){alert("Nama tab & fungsi singkat wajib diisi.");return;}
    setSaving(true);
    const{error}=await supabase.from("app_documentation").update({
      nama_tab:form.nama_tab.trim(),kategori:form.kategori,fungsi_singkat:form.fungsi_singkat.trim(),
      isi_lengkap:form.isi_lengkap||"",updated_at:new Date().toISOString(),
    }).eq("id",id);
    setSaving(false);
    if(error){alert("Gagal simpan: "+error.message);return;}
    setEditId(null);setForm({});
    await fetchList();
  };

  const removeRow=async(row:any)=>{
    if(!window.confirm(`Hapus dokumentasi "${row.nama_tab}"? AI Assistant gak akan bisa jelasin tab ini lagi.`))return;
    const{error}=await supabase.from("app_documentation").delete().eq("id",row.id);
    if(error){alert("Gagal hapus: "+error.message);return;}
    await fetchList();
  };

  const addNew=async()=>{
    if(!newForm.nama_tab.trim()||!newForm.fungsi_singkat.trim()){alert("Nama tab & fungsi singkat wajib diisi.");return;}
    setSaving(true);
    const{error}=await supabase.from("app_documentation").insert({
      nama_tab:newForm.nama_tab.trim(),kategori:newForm.kategori,
      fungsi_singkat:newForm.fungsi_singkat.trim(),isi_lengkap:newForm.isi_lengkap||"",
    });
    setSaving(false);
    if(error){alert("Gagal tambah: "+error.message);return;}
    setNewForm({nama_tab:"",kategori:"Monitoring",fungsi_singkat:"",isi_lengkap:""});
    setShowAdd(false);
    await fetchList();
  };

  const grouped:Record<string,any[]>={};
  list.forEach((r:any)=>{(grouped[r.kategori]=grouped[r.kategori]||[]).push(r);});

  const textareaStyle={padding:"8px 10px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:12,fontFamily:"inherit",resize:"vertical" as const};
  const selectStyle={padding:"8px 10px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:12};

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:16}}>
        <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.5}}>
          Dokumentasi ini dipakai AI Assistant buat jawab pertanyaan "apa itu tab X" / "jelasin fitur aplikasi ini" -
          edit di sini langsung, gak perlu minta bantuan developer tiap ada perubahan.
        </div>
        <Btn color="#16a34a" onClick={()=>setShowAdd(s=>!s)} style={{fontSize:12,whiteSpace:"nowrap"}}>{showAdd?"Batal":"+ Tambah Tab"}</Btn>
      </div>

      {showAdd&&(
        <Card style={{padding:16,marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
          <Inp placeholder="Nama tab (mis. Raw Schedule)" value={newForm.nama_tab} onChange={(e:any)=>setNewForm((f:any)=>({...f,nama_tab:e.target.value}))}/>
          <select value={newForm.kategori} onChange={(e:any)=>setNewForm((f:any)=>({...f,kategori:e.target.value}))} style={selectStyle}>
            {KATEGORI_LIST.map(k=><option key={k} value={k}>{k}</option>)}
          </select>
          <Inp placeholder="Fungsi singkat (1-2 kalimat)" value={newForm.fungsi_singkat} onChange={(e:any)=>setNewForm((f:any)=>({...f,fungsi_singkat:e.target.value}))}/>
          <textarea placeholder="Isi lengkap (kolom yang ada, cara pakai, siapa yang biasanya pakai)" value={newForm.isi_lengkap}
            onChange={(e:any)=>setNewForm((f:any)=>({...f,isi_lengkap:e.target.value}))} rows={3} style={textareaStyle}/>
          <Btn color="#1d4ed8" onClick={addNew} style={{alignSelf:"flex-start",padding:"7px 16px"}}>{saving?"...":"Simpan"}</Btn>
        </Card>
      )}

      {loading?(
        <div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:12}}>Memuat...</div>
      ):list.length===0?(
        <div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:12}}>Belum ada dokumentasi tab.</div>
      ):(
        Object.entries(grouped).map(([kategori,rows])=>(
          <div key={kategori} style={{marginBottom:24}}>
            <div style={{fontWeight:800,fontSize:12,color:"#1d4ed8",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>{kategori}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rows.map((row:any)=>(
                <Card key={row.id} style={{padding:14}}>
                  {editId===row.id?(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <Inp value={form.nama_tab} onChange={(e:any)=>setForm((f:any)=>({...f,nama_tab:e.target.value}))}/>
                      <select value={form.kategori} onChange={(e:any)=>setForm((f:any)=>({...f,kategori:e.target.value}))} style={selectStyle}>
                        {KATEGORI_LIST.map(k=><option key={k} value={k}>{k}</option>)}
                      </select>
                      <Inp value={form.fungsi_singkat} onChange={(e:any)=>setForm((f:any)=>({...f,fungsi_singkat:e.target.value}))}/>
                      <textarea value={form.isi_lengkap} onChange={(e:any)=>setForm((f:any)=>({...f,isi_lengkap:e.target.value}))} rows={4} style={textareaStyle}/>
                      <div style={{display:"flex",gap:8}}>
                        <Btn color="#1d4ed8" onClick={()=>saveEdit(row.id)} style={{padding:"6px 14px",fontSize:11}}>{saving?"...":"Simpan"}</Btn>
                        <Btn color="#94a3b8" onClick={cancelEdit} style={{padding:"6px 14px",fontSize:11}}>Batal</Btn>
                      </div>
                    </div>
                  ):(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{row.nama_tab}</div>
                        <div style={{display:"flex",gap:10,flexShrink:0}}>
                          <button onClick={()=>startEdit(row)} style={{border:"none",background:"none",color:"#1d4ed8",cursor:"pointer",fontSize:11,fontWeight:700,padding:0}}>Edit</button>
                          <button onClick={()=>removeRow(row)} style={{border:"none",background:"none",color:"#dc2626",cursor:"pointer",fontSize:11,fontWeight:700,padding:0}}>Hapus</button>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#475569",marginTop:4}}>{row.fungsi_singkat}</div>
                      {row.isi_lengkap&&<div style={{fontSize:11,color:"#94a3b8",marginTop:6,whiteSpace:"pre-wrap" as const,lineHeight:1.5}}>{row.isi_lengkap}</div>}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
