from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

NEW_KOMPONEN_STOK = r"""function KomponenStokTab({user}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({nama:"",stok:0});
  const [editId,setEditId]=useState<any>(null);
  const [search,setSearch]=useState("");
  const [showKeluar,setShowKeluar]=useState<any>(null);
  const [keluarForm,setKeluarForm]=useState({jumlah:1,proyek:"",panel:"",keterangan:""});
  const [delId,setDelId]=useState<any>(null);

  const getUname=()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    return user?.name||user?.nama||sess?.nama||"Admin";
  };

  useEffect(()=>{
    fetchStok();
  },[]);

  const fetchStok=async()=>{
    setLoading(true);
    const{data}=await supabase.from("komponen_stok").select("*").order("nama",{ascending:true});
    setStokList(data??[]);
    setLoading(false);
  };

  const save=async()=>{
    if(!form.nama.trim())return;
    const uname=getUname();
    if(editId){
      const{data}=await supabase.from("komponen_stok").update({
        nama:form.nama.trim(),stok:Number(form.stok)||0,updated_at:new Date().toISOString()
      }).eq("id",editId).select().single();
      if(data){
        setStokList(prev=>prev.map(s=>s.id===editId?data:s));
        await activityLogService.insert({user_name:uname,action:"EDIT KOMPONEN STOK",
          description:"Edit komponen: "+form.nama+" stok: "+form.stok,module:"stok",halaman:"System"});
      }
      setEditId(null);
    } else {
      const{data}=await supabase.from("komponen_stok").insert({
        nama:form.nama.trim(),stok:Number(form.stok)||0,created_by:uname
      }).select().single();
      if(data){
        setStokList(prev=>[...prev,data]);
        await activityLogService.insert({user_name:uname,action:"TAMBAH KOMPONEN STOK",
          description:"Tambah komponen: "+form.nama+" stok awal: "+form.stok,module:"stok",halaman:"System"});
      }
    }
    setForm({nama:"",stok:0});
  };

  const startEdit=(s:any)=>{setEditId(s.id);setForm({nama:s.nama,stok:s.stok});};
  const cancelEdit=()=>{setEditId(null);setForm({nama:"",stok:0});};

  const keluarkan=async()=>{
    if(!showKeluar)return;
    const jml=Number(keluarForm.jumlah)||0;
    if(jml<=0){alert("Jumlah harus lebih dari 0!");return;}
    if(jml>showKeluar.stok){alert("Stok tidak cukup! Stok tersedia: "+showKeluar.stok);return;}
    if(!keluarForm.proyek.trim()){alert("Proyek harus diisi!");return;}
    const newStok=showKeluar.stok-jml;
    const uname=getUname();
    const{data}=await supabase.from("komponen_stok").update({
      stok:newStok,updated_at:new Date().toISOString()
    }).eq("id",showKeluar.id).select().single();
    if(data){
      setStokList(prev=>prev.map(s=>s.id===showKeluar.id?data:s));
      await activityLogService.insert({
        user_name:uname,
        action:"KELUAR KOMPONEN",
        description:`Keluar: ${showKeluar.nama} x${jml} pcs → Proyek: ${keluarForm.proyek}, Panel: ${keluarForm.panel||"-"}, Ket: ${keluarForm.keterangan||"-"}. Sisa stok: ${newStok}`,
        module:"stok",halaman:"System",proyek:keluarForm.proyek,panel:keluarForm.panel
      });
      setShowKeluar(null);
      setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""});
    }
  };

  const hapus=async()=>{
    const item=stokList.find(s=>s.id===delId);
    await supabase.from("komponen_stok").delete().eq("id",delId);
    setStokList(prev=>prev.filter(s=>s.id!==delId));
    setDelId(null);
    const uname=getUname();
    await activityLogService.insert({user_name:uname,action:"HAPUS KOMPONEN STOK",
      description:"Hapus komponen: "+(item?.nama||"-"),module:"stok",halaman:"System"});
  };

  const filtered=stokList.filter(s=>s.nama.toLowerCase().includes(search.toLowerCase()));

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10",
    textTransform:"uppercase",letterSpacing:.4};

  return(
    <div className="fi">
      {/* Form tambah/edit */}
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>
          {editId?"✏️ Edit Komponen":"➕ Tambah Komponen"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:200}}>
            <Lbl>Nama Komponen</Lbl>
            <Inp value={form.nama} onChange={(e:any)=>setForm({...form,nama:e.target.value})}
              placeholder="Contoh: Frame, Box Control, UNP..."
              onKeyDown={(e:any)=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:120}}>
            <Lbl>Stok Awal (pcs)</Lbl>
            <Inp type="number" min="0" value={form.stok}
              onChange={(e:any)=>setForm({...form,stok:e.target.value})}
              onKeyDown={(e:any)=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={cancelEdit}>Batal</Btn>}
          </div>
        </div>
      </Card>

      {/* Search */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama komponen..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:250}}/>
        <span style={{fontSize:11,color:"#94a3b8"}}>{filtered.length} komponen</span>
      </div>

      {/* Tabel */}
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{...thS,width:40,textAlign:"center" as const}}>No</th>
              <th style={thS}>Nama Komponen</th>
              <th style={{...thS,textAlign:"center" as const,width:100}}>Stok (pcs)</th>
              <th style={{...thS,textAlign:"center" as const,width:180}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={4} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>
                  {search?"Komponen tidak ditemukan":"Belum ada komponen. Tambahkan di atas."}
                </td></tr>
              ):filtered.map((s:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const isEdit=editId===s.id;
                const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",
                  borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
                const stokColor=s.stok===0?"#dc2626":s.stok<=5?"#f59e0b":"#16a34a";
                return(
                  <tr key={s.id}>
                    <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{s.nama}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:stokColor+"18",color:stokColor,border:`1px solid ${stokColor}33`,
                        borderRadius:20,padding:"2px 12px",fontSize:11,fontWeight:800}}>
                        {s.stok} pcs
                      </span>
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                        <button onClick={()=>{setShowKeluar(s);setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""}); }}
                          style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,
                            padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#1d4ed8",fontWeight:600}}>
                          📤 Keluarkan
                        </button>
                        <button onClick={()=>startEdit(s)}
                          style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,
                            padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                        <button onClick={()=>setDelId(s.id)}
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
      )}

      {/* Modal Keluarkan */}
      {showKeluar&&(
        <Modal title={"📤 Keluarkan: "+showKeluar.nama} onClose={()=>setShowKeluar(null)} width={420}>
          <div style={{marginBottom:8,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:12}}>
            Stok tersedia: <strong style={{color:"#1d4ed8"}}>{showKeluar.stok} pcs</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
            <div>
              <Lbl>Jumlah Keluar (pcs)</Lbl>
              <Inp type="number" min="1" max={showKeluar.stok} value={keluarForm.jumlah}
                onChange={(e:any)=>setKeluarForm({...keluarForm,jumlah:e.target.value})}/>
            </div>
            <div>
              <Lbl>Proyek *</Lbl>
              <Inp value={keluarForm.proyek} onChange={(e:any)=>setKeluarForm({...keluarForm,proyek:e.target.value})}
                placeholder="Nama proyek..."/>
            </div>
            <div>
              <Lbl>Panel</Lbl>
              <Inp value={keluarForm.panel} onChange={(e:any)=>setKeluarForm({...keluarForm,panel:e.target.value})}
                placeholder="Nama panel (opsional)..."/>
            </div>
            <div>
              <Lbl>Keterangan</Lbl>
              <Inp value={keluarForm.keterangan} onChange={(e:any)=>setKeluarForm({...keluarForm,keterangan:e.target.value})}
                placeholder="Keterangan tambahan (opsional)..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowKeluar(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={keluarkan}>📤 Keluarkan</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Hapus */}
      {delId&&(
        <Modal title="Hapus Komponen?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Komponen <strong>{stokList.find(s=>s.id===delId)?.nama}</strong> akan dihapus permanen.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={hapus}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
"""

# Sisipkan sebelum SystemTab
old_anchor = "\nfunction SystemTab("
new_anchor = "\n" + NEW_KOMPONEN_STOK + "\nfunction SystemTab("

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor, 1)
    print("✅ KomponenStokTab function added")
else:
    print("❌ SystemTab anchor not found")

# Tambah tab di SystemTab subTabs
old_subtabs = """  const subTabs=[
    {id:"masteruser",label:"👤 Master User"},
    {id:"mesin",label:"⚙️ Master Mesin"},
    {id:"pekerja",label:"👥 Master Pekerja"},
    {id:"recycle",label:"🗑 Recycle Bin"},
  ];"""

new_subtabs = """  const subTabs=[
    {id:"masteruser",label:"👤 Master User"},
    {id:"mesin",label:"⚙️ Master Mesin"},
    {id:"pekerja",label:"👥 Master Pekerja"},
    {id:"stok",label:"📦 Stok Komponen"},
    {id:"recycle",label:"🗑 Recycle Bin"},
  ];"""

if old_subtabs in content:
    content = content.replace(old_subtabs, new_subtabs)
    print("✅ Stok tab added to subTabs")
else:
    print("❌ subTabs not found")

# Tambah render di SystemTab
old_render = '          {subTab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} log={null} user={user}/>}'
new_render = old_render + '\n          {subTab==="stok"&&<KomponenStokTab user={user}/>}'

if old_render in content:
    content = content.replace(old_render, new_render)
    print("✅ KomponenStokTab render added")
else:
    print("❌ Render anchor not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
