function Login({onLogin}){
  const [mode,setMode]=useState("divisi"); // "divisi" | "admin"
  const [div,setDiv]=useState("mekanik");
  const [namaList,setNamaList]=useState([]);
  const [selNama,setSelNama]=useState("");
  const [username,setUsername]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(mode==="divisi"&&div){
      supabase.from("pekerja").select("id,nama").eq("divisi",div).then(({data})=>{
        setNamaList(data??[]);setSelNama("");
      });
    }
  },[div,mode]);

  const goAdmin=async()=>{
    if(!username.trim()){setErr("Masukkan username!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    const{data,error}=await supabase.from("admins")
      .select("*").eq("username",username.trim()).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Username atau password salah!");setLoading(false);return;}
    await supabase.from("admins").update({last_login:new Date().toISOString()}).eq("id",data.id);
    await supabase.from("activity_log").insert({
      user_name:data.nama,admin_nama:data.nama,
      action:"Login ke sistem",aktivitas:"Login ke sistem",
      jenis:"auth",halaman:"Login",table_name:"auth",
    });
    localStorage.setItem("vista_admin_session",JSON.stringify({...data,divisi:"admin"}));
    onLogin({...data,divisi:"admin",name:data.nama});
    setLoading(false);
  };

  const goDivisi=async()=>{
    if(!selNama){setErr("Pilih nama!");return;}
    if(pwd!==DIVISI_CONFIG[div].password){setErr("Password salah!");return;}
    setLoading(true);
    const found=namaList.find(p=>p.nama===selNama);
    if(!found){setErr("Nama tidak ditemukan!");setLoading(false);return;}
    onLogin({...found,divisi:div,name:found.nama});
    setLoading(false);
  };

  const go=mode==="admin"?goAdmin:goDivisi;

  return(
    <div style={{minHeight:"100vh",display:"flex"}}>
      <style>{GCss}</style>
      <div style={{flex:1,background:"linear-gradient(145deg,#1e3a8a,#1d4ed8 60%,#3b82f6)",
        display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 72px",color:"#fff"}}>
        <div style={{fontSize:44,marginBottom:10}}>⚡</div>
        <div style={{fontSize:32,fontWeight:800,lineHeight:1.2,marginBottom:14}}>Monitoring<br/>Proses Produksi</div>
        <div style={{fontSize:14,opacity:.75,lineHeight:1.8,maxWidth:320}}>Platform terpadu monitoring progress produksi panel listrik secara real-time.</div>
        <div style={{marginTop:36,display:"flex",flexDirection:"column",gap:10}}>
          {["Multi Admin dengan activity tracking","Tabel produksi harian lengkap","Shift & PIC per komponen","Status H-7 Mendesak"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,opacity:.85}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:"#ffffff25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</span>{f}
            </div>
          ))}
        </div>
      </div>
      <div style={{width:440,display:"flex",alignItems:"center",justifyContent:"center",padding:40,background:"#fff"}}>
        <div style={{width:"100%",maxWidth:340}} className="fi">
          <div style={{fontWeight:800,fontSize:22,color:"#1e293b",marginBottom:4}}>Selamat Datang 👋</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Masuk ke akun Anda</div>
          <div style={{display:"flex",gap:8,marginBottom:20,background:"#f1f5f9",borderRadius:10,padding:4}}>
            <button onClick={()=>{setMode("admin");setErr("");}}
              style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",
                background:mode==="admin"?"#fff":"transparent",
                color:mode==="admin"?"#1d4ed8":"#64748b",fontWeight:700,fontSize:13,
                boxShadow:mode==="admin"?"0 1px 4px #00000015":"none",transition:"all .15s"}}>
              ⚙️ Admin
            </button>
            <button onClick={()=>{setMode("divisi");setErr("");}}
              style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",
                background:mode==="divisi"?"#fff":"transparent",
                color:mode==="divisi"?"#1d4ed8":"#64748b",fontWeight:700,fontSize:13,
                boxShadow:mode==="divisi"?"0 1px 4px #00000015":"none",transition:"all .15s"}}>
              👷 Operator
            </button>
          </div>
          {mode==="admin"?(
            <>
              <div style={{marginBottom:12}}><Lbl>Username</Lbl>
                <Inp value={username} onChange={e=>{setUsername(e.target.value);setErr("");}}
                  placeholder="contoh: rizky_admin" onKeyDown={e=>e.key==="Enter"&&go()}/>
              </div>
              <div style={{marginBottom:20}}><Lbl>Password</Lbl>
                <div style={{position:"relative"}}>
                  <Inp type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password..."
                    style={{border:`1.5px solid ${err?"#fca5a5":"#e2e8f0"}`,paddingRight:40}}/>
                  <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",
                    transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}>
                    {show?"🙈":"👁"}
                  </button>
                </div>
              </div>
            </>
          ):(
            <>
              <div style={{marginBottom:12}}><Lbl>Divisi</Lbl>
                <Sel value={div} onChange={e=>{setDiv(e.target.value);setErr("");}}>
                  {Object.entries(DIVISI_CONFIG).filter(([k])=>k!=="admin").map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:12}}><Lbl>Nama</Lbl>
                <Sel value={selNama} onChange={e=>setSelNama(e.target.value)}>
                  <option value="">-- Pilih Nama --</option>
                  {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:20}}><Lbl>Password Divisi</Lbl>
                <div style={{position:"relative"}}>
                  <Inp type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password divisi..."
                    style={{border:`1.5px solid ${err?"#fca5a5":"#e2e8f0"}`,paddingRight:40}}/>
                  <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",
                    transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}>
                    {show?"🙈":"👁"}
                  </button>
                </div>
              </div>
            </>
          )}
          {err&&<div style={{fontSize:11,color:"#dc2626",marginBottom:12,padding:"8px 12px",background:"#fef2f2",borderRadius:8}}>{err}</div>}
          <Btn color="#1d4ed8" style={{width:"100%",padding:13,fontSize:15,boxShadow:"0 4px 14px #2563eb33"}} onClick={go}>
            {loading?"Memuat...":"Masuk →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
