const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const newLogin = `function Login({onLogin}){
  const [mode,setMode]=useState("admin");
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
    const{data,error}=await supabase.from("admins").select("*").eq("username",username.trim()).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Username atau password salah!");setLoading(false);return;}
    await supabase.from("admins").update({last_login:new Date().toISOString()}).eq("id",data.id);
    await supabase.from("activity_log").insert({user_name:data.nama,admin_nama:data.nama,action:"Login ke sistem",aktivitas:"Login ke sistem",jenis:"auth",halaman:"Login",table_name:"auth"});
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
    <div style={{minHeight:"100vh",display:"flex",background:"#f8fafc"}}>
      <style>{GCss}</style>
      <div style={{width:420,background:"linear-gradient(160deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%)",display:"flex",flexDirection:"column",padding:"40px 36px",color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:"#ffffff08"}}/>
        <div style={{position:"absolute",bottom:-40,left:-40,width:160,height:160,borderRadius:"50%",background:"#ffffff06"}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:48}}>
          <div style={{width:36,height:36,background:"#fff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#1d4ed8",fontWeight:900,fontSize:16}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:14,lineHeight:1.2}}>Vista Teknik</div>
            <div style={{fontSize:10,opacity:.7,fontWeight:500}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:26,fontWeight:800,lineHeight:1.3,marginBottom:12}}>Monitoring produksi panel listrik</div>
          <div style={{fontSize:13,opacity:.75,lineHeight:1.8,marginBottom:32}}>Platform terintegrasi untuk kelola jadwal, distribusi, dan progress produksi secara real-time.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {["Multi admin dengan activity log","Raw Schedule & Rencana Harian","Status H-7 mendesak otomatis","Jadwal service & maintenance"].map(f=>(
              <div key={f} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <span style={{width:18,height:18,borderRadius:"50%",background:"#ffffff20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0}}>✓</span>
                <span style={{opacity:.85}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,opacity:.5,marginTop:32}}>© 2026 Vista Teknik. All rights reserved.</div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
        <div style={{width:"100%",maxWidth:380}} className="fi">
          <div style={{fontWeight:700,fontSize:24,color:"#0f172a",marginBottom:4}}>Selamat datang</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:28}}>Masuk ke akun Anda untuk melanjutkan</div>
          <div style={{display:"flex",gap:0,marginBottom:24,border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
            <button onClick={()=>{setMode("admin");setErr("");}} style={{flex:1,padding:"10px",border:"none",cursor:"pointer",background:mode==="admin"?"#1d4ed8":"#fff",color:mode==="admin"?"#fff":"#64748b",fontWeight:600,fontSize:13,transition:"all .15s"}}>⚙️ Admin</button>
            <button onClick={()=>{setMode("divisi");setErr("");}} style={{flex:1,padding:"10px",border:"none",cursor:"pointer",background:mode==="divisi"?"#1d4ed8":"#fff",color:mode==="divisi"?"#fff":"#64748b",fontWeight:600,fontSize:13,transition:"all .15s"}}>👷 Operator</button>
          </div>
          {mode==="admin"?(
            <>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Username</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8"}}>👤</span>
                  <input value={username} onChange={e=>{setUsername(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Masukkan username..." style={{width:"100%",padding:"11px 12px 11px 38px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:13}}/>
                </div>
              </div>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Password</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8"}}>🔒</span>
                  <input type={show?"text":"password"} value={pwd} onChange={e=>{setPwd(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Masukkan password..." style={{width:"100%",padding:"11px 40px 11px 38px",borderRadius:8,border:"1.5px solid "+( err?"#fca5a5":"#e2e8f0"),background:"#f8fafc",color:"#1e293b",fontSize:13}}/>
                  <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14}}>{show?"🙈":"👁"}</button>
                </div>
              </div>
            </>
          ):(
            <>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Divisi</div>
                <Sel value={div} onChange={e=>{setDiv(e.target.value);setErr("");}}>
                  {Object.entries(DIVISI_CONFIG).filter(([k])=>k!=="admin").map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Nama</div>
                <Sel value={selNama} onChange={e=>setSelNama(e.target.value)}>
                  <option value="">-- Pilih Nama --</option>
                  {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Password Divisi</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8"}}>🔒</span>
                  <input type={show?"text":"password"} value={pwd} onChange={e=>{setPwd(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Masukkan password divisi..." style={{width:"100%",padding:"11px 40px 11px 38px",borderRadius:8,border:"1.5px solid "+(err?"#fca5a5":"#e2e8f0"),background:"#f8fafc",color:"#1e293b",fontSize:13}}/>
                  <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14}}>{show?"🙈":"👁"}</button>
                </div>
              </div>
            </>
          )}
          {err&&<div style={{fontSize:12,color:"#dc2626",marginBottom:16,padding:"10px 14px",background:"#fef2f2",borderRadius:8}}>{err}</div>}
          <button onClick={go} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",color:"#1e293b",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 1px 3px #00000010"}}>
            {loading?"Memuat...":"Masuk →"}
          </button>
          <div style={{marginTop:16,fontSize:12,color:"#94a3b8",textAlign:"center"}}>
            {mode==="admin"?<span>Operator? <span style={{color:"#1d4ed8",fontWeight:700,cursor:"pointer"}} onClick={()=>setMode("divisi")}>Klik di sini</span></span>:<span>Admin? <span style={{color:"#1d4ed8",fontWeight:700,cursor:"pointer"}} onClick={()=>setMode("admin")}>Klik di sini</span></span>}
          </div>
        </div>
      </div>
    </div>
  );
}`;
const startIdx = content.indexOf('function Login({onLogin}){');
const nextFunc = content.indexOf('\nfunction Dashboard(', startIdx);
if(startIdx !== -1 && nextFunc !== -1){
  content = content.slice(0, startIdx) + newLogin + '\n' + content.slice(nextFunc);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ Login updated!');
} else {
  console.log('❌ Tidak ditemukan! startIdx:',startIdx,'nextFunc:',nextFunc);
}