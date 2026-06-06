from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

def find_function_bounds(text, func_name):
    pattern = rf'\nfunction {re.escape(func_name)}\s*\('
    matches = list(re.finditer(pattern, text))
    if not matches:
        return -1, -1
    match = matches[0]
    func_start = match.start() + 1
    i = match.end()
    paren_depth = 1
    while i < len(text) and paren_depth > 0:
        if text[i] == '(': paren_depth += 1
        elif text[i] == ')': paren_depth -= 1
        i += 1
    while i < len(text) and text[i] != '{':
        i += 1
    if i >= len(text): return -1, -1
    depth = 0
    while i < len(text):
        if text[i] == '{': depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0: return func_start, i + 1
        i += 1
    return -1, -1

NEW_KOMPONEN_STOK = r"""function KomponenStokTab({user,activityLog}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [masuklist,setMasukList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({nama:"",kode:"",stok:0});
  const [editId,setEditId]=useState<any>(null);
  const [search,setSearch]=useState("");
  const [filterKode,setFilterKode]=useState("ALL");
  const [filterTipe,setFilterTipe]=useState("ALL");
  const [showKeluar,setShowKeluar]=useState<any>(null);
  const [showMasuk,setShowMasuk]=useState<any>(null);
  const [keluarForm,setKeluarForm]=useState({jumlah:1,proyek:"",panel:"",keterangan:""});
  const [masukForm,setMasukForm]=useState({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""});
  const [delId,setDelId]=useState<any>(null);

  const getUname=()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    return user?.name||user?.nama||sess?.nama||"Admin";
  };

  useEffect(()=>{fetchAll();},[]);

  const fetchAll=async()=>{
    setLoading(true);
    const[{data:s},{data:m}]=await Promise.all([
      supabase.from("komponen_stok").select("*").order("nama",{ascending:true}),
      supabase.from("komponen_stok_masuk").select("*").order("tanggal",{ascending:false})
    ]);
    setStokList(s??[]);
    setMasukList(m??[]);
    setLoading(false);
  };

  const save=async()=>{
    if(!form.nama.trim())return;
    const uname=getUname();
    if(editId){
      const{data}=await supabase.from("komponen_stok").update({
        nama:form.nama.trim(),kode:form.kode.trim(),stok:Number(form.stok)||0,
        updated_at:new Date().toISOString()
      }).eq("id",editId).select().single();
      if(data){
        setStokList(prev=>prev.map(s=>s.id===editId?data:s));
        await activityLogService.insert({user_name:uname,action:"EDIT KOMPONEN STOK",
          description:"Edit komponen: "+form.nama+" ("+form.kode+")",module:"stok",halaman:"System"});
      }
      setEditId(null);
    } else {
      const{data}=await supabase.from("komponen_stok").insert({
        nama:form.nama.trim(),kode:form.kode.trim(),stok:Number(form.stok)||0,created_by:uname
      }).select().single();
      if(data){
        setStokList(prev=>[...prev,data]);
        await activityLogService.insert({user_name:uname,action:"TAMBAH KOMPONEN STOK",
          description:"Tambah komponen: "+form.nama+" ("+form.kode+") stok awal: "+form.stok,module:"stok",halaman:"System"});
      }
    }
    setForm({nama:"",kode:"",stok:0});
  };

  const startEdit=(s:any)=>{setEditId(s.id);setForm({nama:s.nama,kode:s.kode||"",stok:s.stok});};
  const cancelEdit=()=>{setEditId(null);setForm({nama:"",kode:"",stok:0});};

  const tambahMasuk=async()=>{
    if(!showMasuk)return;
    const jml=Number(masukForm.jumlah)||0;
    if(jml<=0){alert("Jumlah harus lebih dari 0!");return;}
    const uname=getUname();
    const newStok=showMasuk.stok+jml;
    // Update stok
    const{data:updated}=await supabase.from("komponen_stok").update({
      stok:newStok,updated_at:new Date().toISOString()
    }).eq("id",showMasuk.id).select().single();
    // Insert riwayat masuk
    const{data:masuk}=await supabase.from("komponen_stok_masuk").insert({
      komponen_id:showMasuk.id,nama:showMasuk.nama,
      jumlah:jml,tanggal:masukForm.tanggal,
      keterangan:masukForm.keterangan,created_by:uname
    }).select().single();
    if(updated) setStokList(prev=>prev.map(s=>s.id===showMasuk.id?updated:s));
    if(masuk) setMasukList(prev=>[masuk,...prev]);
    await activityLogService.insert({
      user_name:uname,action:"MASUK KOMPONEN",
      description:`Masuk: ${showMasuk.nama} (${showMasuk.kode||"-"}) +${jml} pcs — ${masukForm.keterangan||"-"}. Stok: ${newStok}`,
      module:"stok",halaman:"System"
    });
    setShowMasuk(null);
    setMasukForm({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""});
  };

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
        user_name:uname,action:"KELUAR KOMPONEN",
        description:`Keluar: ${showKeluar.nama} (${showKeluar.kode||"-"}) x${jml} pcs → Proyek: ${keluarForm.proyek}, Panel: ${keluarForm.panel||"-"}, Ket: ${keluarForm.keterangan||"-"}. Sisa: ${newStok}`,
        module:"stok",halaman:"System",proyek:keluarForm.proyek,panel:keluarForm.panel
      });
    }
    setShowKeluar(null);
    setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""});
  };

  const hapus=async()=>{
    const item=stokList.find(s=>s.id===delId);
    await supabase.from("komponen_stok_masuk").delete().eq("komponen_id",delId);
    await supabase.from("komponen_stok").delete().eq("id",delId);
    setStokList(prev=>prev.filter(s=>s.id!==delId));
    setMasukList(prev=>prev.filter(m=>m.komponen_id!==delId));
    setDelId(null);
    const uname=getUname();
    await activityLogService.insert({user_name:uname,action:"HAPUS KOMPONEN STOK",
      description:"Hapus komponen: "+(item?.nama||"-")+" ("+item?.kode+")",module:"stok",halaman:"System"});
  };

  // Hitung total masuk & keluar per komponen
  const getMasukTotal=(id:number)=>masuklist.filter(m=>m.komponen_id===id).reduce((a:number,m:any)=>a+m.jumlah,0);
  const getKeluarTotal=(id:number)=>{
    const log=(activityLog||[]).filter((l:any)=>l.action==="KELUAR KOMPONEN"&&l.description?.includes("("+stokList.find(s=>s.id===id)?.kode+")"));
    return log.reduce((a:number,l:any)=>{
      const m=l.description?.match(/x(\d+)\s*pcs/);
      return a+(m?Number(m[1]):0);
    },0);
  };
  const getMasukTerakhir=(id:number)=>{
    const m=masuklist.filter(x=>x.komponen_id===id)[0];
    return m?{tanggal:m.tanggal,jumlah:m.jumlah}:null;
  };
  const getKeluarTerakhir=(id:number)=>{
    const log=(activityLog||[]).find((l:any)=>l.action==="KELUAR KOMPONEN"&&l.description?.includes("("+stokList.find(s=>s.id===id)?.kode+")"));
    if(!log)return null;
    const m=log.description?.match(/x(\d+)\s*pcs/);
    return{tanggal:log.created_at?.slice(0,10),jumlah:m?Number(m[1]):0};
  };

  const kodeList=["ALL",...Array.from(new Set(stokList.map((s:any)=>s.kode).filter(Boolean)))];
  const filtered=stokList.filter(s=>
    (filterKode==="ALL"||s.kode===filterKode)&&
    s.nama.toLowerCase().includes(search.toLowerCase())
  );

  // Riwayat gabungan masuk + keluar dari activity log
  const riwayatMasuk=masuklist.map((m:any)=>({
    tanggal:m.tanggal,kode:stokList.find(s=>s.id===m.komponen_id)?.kode||"-",
    nama:m.nama,tipe:"masuk",jumlah:m.jumlah,
    keterangan:m.keterangan||"-",panel:"-",oleh:m.created_by||"-"
  }));
  const riwayatKeluar=(activityLog||[]).filter((l:any)=>l.action==="KELUAR KOMPONEN").map((l:any)=>{
    const mJml=l.description?.match(/x(\d+)\s*pcs/);
    const mKode=l.description?.match(/\(([^)]+)\)/);
    return{
      tanggal:l.created_at?.slice(0,10),
      kode:mKode?mKode[1]:"-",
      nama:l.description?.split(" x")?.[0]?.replace("Keluar: ",""),
      tipe:"keluar",jumlah:mJml?Number(mJml[1]):0,
      keterangan:l.description,panel:l.panel||"-",oleh:l.user_name
    };
  });
  const riwayat=[...riwayatMasuk,...riwayatKeluar]
    .filter(r=>filterTipe==="ALL"||(filterTipe==="masuk"&&r.tipe==="masuk")||(filterTipe==="keluar"&&r.tipe==="keluar"))
    .sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));

  const totalMasuk=masuklist.reduce((a:number,m:any)=>a+m.jumlah,0);
  const totalKeluar=stokList.reduce((a:number,s:any)=>a+getKeluarTotal(s.id),0);
  const totalStok=stokList.reduce((a:number,s:any)=>a+s.stok,0);

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10",
    textTransform:"uppercase",letterSpacing:.4};

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
        {[
          {l:"Total Komponen",v:stokList.length,c:"#2563eb"},
          {l:"Stok Tersedia",v:totalStok+" pcs",c:"#16a34a"},
          {l:"Total Masuk",v:"+"+totalMasuk,c:"#16a34a"},
          {l:"Total Keluar",v:"-"+totalKeluar,c:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"10px 14px"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:s.c,marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Form tambah/edit */}
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>
          {editId?"✏️ Edit Komponen":"➕ Tambah Komponen"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{minWidth:120}}>
            <Lbl>Kode</Lbl>
            <Inp value={form.kode} onChange={(e:any)=>setForm({...form,kode:e.target.value})}
              placeholder="FR-001..." style={{width:120}}/>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <Lbl>Nama Komponen</Lbl>
            <Inp value={form.nama} onChange={(e:any)=>setForm({...form,nama:e.target.value})}
              placeholder="Nama komponen..." onKeyDown={(e:any)=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:100}}>
            <Lbl>Stok Awal (pcs)</Lbl>
            <Inp type="number" min="0" value={form.stok}
              onChange={(e:any)=>setForm({...form,stok:e.target.value})}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={cancelEdit}>Batal</Btn>}
          </div>
        </div>
      </Card>

      {/* Filter + Search */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center"}}>
        <select value={filterKode} onChange={e=>setFilterKode(e.target.value)}
          style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:150}}>
          {kodeList.map(k=><option key={k} value={k}>{k==="ALL"?"Semua Kode":k}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama komponen..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",flex:1,minWidth:180}}/>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} komponen</span>
      </div>

      {/* Tabel Komponen */}
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{...thS,width:36,textAlign:"center" as const}}>No</th>
              <th style={thS}>Kode</th>
              <th style={thS}>Nama Komponen</th>
              <th style={{...thS,textAlign:"center" as const}}>QTY Total</th>
              <th style={{...thS,textAlign:"center" as const}}>Tgl Masuk</th>
              <th style={{...thS,textAlign:"center" as const}}>Jml Masuk</th>
              <th style={{...thS,textAlign:"center" as const}}>Tgl Keluar</th>
              <th style={{...thS,textAlign:"center" as const}}>Jml Keluar</th>
              <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>
                  Belum ada komponen
                </td></tr>
              ):filtered.map((s:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const isEdit=editId===s.id;
                const masukTerakhir=getMasukTerakhir(s.id);
                const keluarTerakhir=getKeluarTerakhir(s.id);
                const stokColor=s.stok===0?"#dc2626":s.stok<=5?"#f59e0b":"#16a34a";
                const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",
                  borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
                return(
                  <tr key={s.id}>
                    <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                    <td style={td}>
                      {s.kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                        borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{s.kode}</span>
                        :<span style={{color:"#cbd5e1",fontSize:10}}>—</span>}
                    </td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{s.nama}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:stokColor+"18",color:stokColor,border:`1px solid ${stokColor}33`,
                        borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>
                        {s.stok} pcs
                      </span>
                    </td>
                    <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>
                      {masukTerakhir?fmtDate(masukTerakhir.tanggal):"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,color:"#16a34a",fontWeight:700}}>
                      {masukTerakhir?"+"+masukTerakhir.jumlah:"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>
                      {keluarTerakhir?fmtDate(keluarTerakhir.tanggal):"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,color:"#dc2626",fontWeight:700}}>
                      {keluarTerakhir?"-"+keluarTerakhir.jumlah:"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        <button onClick={()=>{setShowMasuk(s);setMasukForm({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""}); }}
                          style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:5,
                            padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#16a34a",fontWeight:600}}>
                          +Masuk
                        </button>
                        <button onClick={()=>{setShowKeluar(s);setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""}); }}
                          style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,
                            padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#dc2626",fontWeight:600}}>
                          Keluar
                        </button>
                        <button onClick={()=>startEdit(s)}
                          style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5,
                            padding:"3px 6px",cursor:"pointer",fontSize:10,color:"#475569"}}>✏️</button>
                        <button onClick={()=>setDelId(s.id)}
                          style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,
                            padding:"3px 6px",cursor:"pointer",fontSize:10,color:"#dc2626"}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Riwayat Transaksi */}
      <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>📋 Riwayat Transaksi</span>
          <select value={filterTipe} onChange={e=>setFilterTipe(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,
              fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
            <option value="ALL">Semua Tipe</option>
            <option value="masuk">Masuk</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>
        <div style={{overflowX:"auto" as const}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              {["Tanggal","Kode","Komponen","Tipe","Jumlah","Proyek","Panel","Keterangan","Oleh"].map(h=>(
                <th key={h} style={{...thS,fontSize:9.5}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {riwayat.length===0?(
                <tr><td colSpan={9} style={{textAlign:"center",padding:"24px",color:"#94a3b8"}}>Belum ada riwayat</td></tr>
              ):riwayat.slice(0,50).map((r:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const td2:any={padding:"7px 10px",borderBottom:"1px solid #f5f7fa",
                  borderRight:"1px solid #f5f7fa",background:rBg,verticalAlign:"middle"};
                const isMasuk=r.tipe==="masuk";
                return(
                  <tr key={i}>
                    <td style={{...td2,color:"#94a3b8"}}>{fmtDate(r.tanggal)}</td>
                    <td style={td2}>
                      {r.kode&&r.kode!=="-"?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                        borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>{r.kode}</span>
                        :<span style={{color:"#cbd5e1"}}>—</span>}
                    </td>
                    <td style={{...td2,fontWeight:600,color:"#1e293b"}}>{r.nama}</td>
                    <td style={td2}>
                      <span style={{background:isMasuk?"#f0fdf4":"#fef2f2",
                        color:isMasuk?"#16a34a":"#dc2626",
                        border:`1px solid ${isMasuk?"#bbf7d0":"#fecaca"}`,
                        borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:700}}>
                        {isMasuk?"Masuk":"Keluar"}
                      </span>
                    </td>
                    <td style={{...td2,textAlign:"center" as const,fontWeight:700,color:isMasuk?"#16a34a":"#dc2626"}}>
                      {isMasuk?"+":"-"}{r.jumlah}
                    </td>
                    <td style={{...td2,color:"#475569"}}>{r.proyek||"—"}</td>
                    <td style={{...td2,color:"#475569"}}>{r.panel||"—"}</td>
                    <td style={{...td2,color:"#94a3b8",maxWidth:160,overflow:"hidden" as const,textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{r.keterangan||"—"}</td>
                    <td style={{...td2,color:"#64748b"}}>{r.oleh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Masuk */}
      {showMasuk&&(
        <Modal title={"+ Stok Masuk: "+showMasuk.nama} onClose={()=>setShowMasuk(null)} width={400}>
          <div style={{marginBottom:8,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:12}}>
            Stok saat ini: <strong style={{color:"#1d4ed8"}}>{showMasuk.stok} pcs</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
            <div>
              <Lbl>Jumlah Masuk (pcs)</Lbl>
              <Inp type="number" min="1" value={masukForm.jumlah}
                onChange={(e:any)=>setMasukForm({...masukForm,jumlah:e.target.value})}/>
            </div>
            <div>
              <Lbl>Tanggal Masuk</Lbl>
              <Inp type="date" value={masukForm.tanggal}
                onChange={(e:any)=>setMasukForm({...masukForm,tanggal:e.target.value})}/>
            </div>
            <div>
              <Lbl>Keterangan</Lbl>
              <Inp value={masukForm.keterangan}
                onChange={(e:any)=>setMasukForm({...masukForm,keterangan:e.target.value})}
                placeholder="Contoh: Terima dari supplier..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowMasuk(null)}>Batal</Btn>
            <Btn color="#16a34a" onClick={tambahMasuk}>+ Simpan Masuk</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Keluar */}
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
                placeholder="Keterangan tambahan..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowKeluar(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={keluarkan}>📤 Keluarkan</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Hapus */}
      {delId&&(
        <Modal title="Hapus Komponen?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Komponen <strong>{stokList.find(s=>s.id===delId)?.nama}</strong> dan semua riwayat masuknya akan dihapus permanen.
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

print("🔄 Replace KomponenStokTab...")
s, e = find_function_bounds(content, "KomponenStokTab")
if s == -1:
    print("❌ KomponenStokTab tidak ditemukan!")
    exit(1)
print(f"   Ditemukan karakter {s}–{e}")
content = content[:s] + NEW_KOMPONEN_STOK + content[e:]
APP_PATH.write_text(content, encoding="utf-8")
print("✅ Selesai!")
