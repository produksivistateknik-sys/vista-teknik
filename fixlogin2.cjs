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
  const [success,setSuccess]=useState(false);

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
    setSuccess(true);
    setTimeout(()=>onLogin({...data,divisi:"admin",name:data.nama}),600);
    setLoading(false);
  };

  const goDivisi=async()=>{
    if(!selNama){setErr("Pilih nama!");return;}
    if(pwd!==DIVISI_CONFIG[div].password){setErr("Password salah!");return;}
    setLoading(true);
    const found=namaList.find(p=>p.nama===selNama);
    if(!found){setErr("Nama tidak ditemukan!");setLoading(false);return;}
    setSuccess(true);
    setTimeout(()=>onLogin({...found,divisi:div,name:found.nama}),600);
    setLoading(false);
  };

  const go=mode==="admin"?goAdmin:goDivisi;

  const loginCSS=\`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .login-wrap *{box-sizing:border-box;margin:0;padding:0;font-family:'Inter','Plus Jakarta Sans',sans-serif}
    .login-wrap{min-height:100vh;display:flex;align-items:stretch;background:#f8fafc}
    .login-left{width:45%;background:linear-gradient(145deg,#0f172a 0%,#1e3a8a 40%,#1d4ed8 100%);display:flex;flex-direction:column;padding:48px;position:relative;overflow:hidden}
    .login-left::before{content:'';position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.04)}
    .login-left::after{content:'';position:absolute;bottom:-80px;left:-60px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.03)}
    .login-right{width:55%;display:flex;align-items:center;justify-content:center;padding:48px 64px;background:#f8fafc}
    .login-card{width:100%;max-width:480px;background:#fff;border-radius:20px;padding:40px;box-shadow:0 4px 6px -1px rgba(0,0,0,.05),0 20px 60px -10px rgba(0,0,0,.1)}
    .login-input{width:100%;height:56px;padding:0 16px 0 48px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:all .2s}
    .login-input:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
    .login-input::placeholder{color:#94a3b8}
    .login-input-err{border-color:#fca5a5!important;background:#fff8f8!important}
    .login-btn{width:100%;height:56px;border-radius:12px;border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px}
    .login-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 25px rgba(37,99,235,.4)}
    .login-btn:disabled{opacity:.7;cursor:not-allowed;transform:none}
    .login-btn-success{background:linear-gradient(135deg,#16a34a,#15803d)!important}
    .login-seg{display:flex;background:#f1f5f9;border-radius:14px;padding:4px;gap:4px;margin-bottom:28px;height:52px}
    .login-seg-btn{flex:1;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:6px;color:#64748b;background:transparent}
    .login-seg-btn.active{background:#fff;color:#2563eb;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .login-label{font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;display:block}
    .login-input-wrap{position:relative;margin-bottom:20px}
    .login-input-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:16px;color:#94a3b8;pointer-events:none;display:flex;align-items:center}
    .login-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;display:flex;align-items:center;padding:4px}
    .login-select{width:100%;height:56px;padding:0 16px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:all .2s;appearance:none;cursor:pointer}
    .login-select:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
    .login-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:12px 16px;font-size:13px;margin-bottom:20px;display:flex;align-items:center;gap:8px}
    .login-success-overlay{position:fixed;inset:0;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;z-index:9999;font-size:48px;animation:fadeIn .3s ease}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .login-card{animation:slideIn .4s ease}
    @media(max-width:768px){
      .login-left{display:none}
      .login-right{width:100%;padding:24px}
    }
    .spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
    @keyframes spin{to{transform:rotate(360deg)}}
  \`;

  return(
    <div className="login-wrap">
      <style>{GCss}</style>
      <style>{loginCSS}</style>

      {success&&<div className="login-success-overlay">âœ…</div>}

      {/* LEFT BRANDING */}
      <div className="login-left">
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:52,position:"relative",zIndex:1}}>
          <div style={{width:44,height:44,background:"rgba(255,255,255,.15)",borderRadius:12,border:"1px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:20}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:"#fff",letterSpacing:.3}}>Vista Teknik</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",fontWeight:500,marginTop:1}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",position:"relative",zIndex:1}}>
          {/* SVG Illustration */}
          <div style={{marginBottom:32}}>
            <svg width="100%" height="140" viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="20" width="90" height="110" rx="4" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"/>
              <rect x="18" y="28" width="74" height="94" rx="2" fill="rgba(255,255,255,.05)"/>
              <rect x="22" y="32" width="30" height="8" rx="1" fill="rgba(255,255,255,.3)"/>
              <rect x="56" y="32" width="30" height="8" rx="1" fill="rgba(255,255,255,.3)"/>
              <rect x="22" y="44" width="64" height="14" rx="2" fill="rgba(37,99,235,.5)"/>
              <rect x="26" y="48" width="4" height="6" rx="1" fill="#f59e0b"/>
              <rect x="34" y="48" width="4" height="6" rx="1" fill="#f59e0b"/>
              <rect x="42" y="48" width="4" height="6" rx="1" fill="#ef4444"/>
              <rect x="50" y="48" width="4" height="6" rx="1" fill="#22c55e"/>
              <circle cx="74" cy="51" r="4" fill="rgba(255,255,255,.2)"/>
              <rect x="22" y="62" width="64" height="52" rx="2" fill="rgba(255,255,255,.05)"/>
              <rect x="26" y="66" width="28" height="4" rx="1" fill="rgba(255,255,255,.2)"/>
              <rect x="26" y="74" width="20" height="3" rx="1" fill="rgba(255,255,255,.15)"/>
              <circle cx="68" cy="70" r="6" fill="rgba(220,38,38,.5)"/>
              <circle cx="80" cy="70" r="6" fill="rgba(245,158,11,.5)"/>
              <circle cx="68" cy="84" r="6" fill="rgba(34,197,94,.5)"/>
              <circle cx="80" cy="84" r="6" fill="rgba(59,130,246,.5)"/>
              <rect x="120" y="10" width="100" height="120" rx="4" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.5"/>
              <rect x="128" y="18" width="84" height="104" rx="2" fill="rgba(255,255,255,.06)"/>
              <rect x="132" y="22" width="36" height="9" rx="1" fill="rgba(255,255,255,.35)"/>
              <rect x="172" y="22" width="36" height="9" rx="1" fill="rgba(255,255,255,.35)"/>
              <rect x="132" y="35" width="76" height="18" rx="2" fill="rgba(37,99,235,.6)"/>
              <rect x="137" y="40" width="5" height="8" rx="1" fill="#f59e0b"/>
              <rect x="146" y="40" width="5" height="8" rx="1" fill="#f59e0b"/>
              <rect x="155" y="40" width="5" height="8" rx="1" fill="#ef4444"/>
              <rect x="164" y="40" width="5" height="8" rx="1" fill="#22c55e"/>
              <circle cx="190" cy="44" r="5" fill="rgba(255,255,255,.25)"/>
              <rect x="132" y="57" width="76" height="60" rx="2" fill="rgba(255,255,255,.05)"/>
              <rect x="136" y="61" width="40" height="5" rx="1" fill="rgba(255,255,255,.25)"/>
              <rect x="136" y="70" width="28" height="4" rx="1" fill="rgba(255,255,255,.15)"/>
              <rect x="136" y="78" width="68" height="1" rx=".5" fill="rgba(255,255,255,.1)"/>
              <rect x="136" y="82" width="68" height="1" rx=".5" fill="rgba(255,255,255,.1)"/>
              <rect x="136" y="86" width="68" height="1" rx=".5" fill="rgba(255,255,255,.1)"/>
              <rect x="136" y="90" width="68" height="1" rx=".5" fill="rgba(255,255,255,.1)"/>
              <rect x="232" y="30" width="78" height="100" rx="4" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"/>
              <rect x="239" y="37" width="64" height="86" rx="2" fill="rgba(255,255,255,.05)"/>
              <rect x="243" y="41" width="26" height="7" rx="1" fill="rgba(255,255,255,.3)"/>
              <rect x="273" y="41" width="26" height="7" rx="1" fill="rgba(255,255,255,.3)"/>
              <rect x="243" y="52" width="56" height="14" rx="2" fill="rgba(37,99,235,.5)"/>
              <rect x="247" y="56" width="4" height="6" rx="1" fill="#f59e0b"/>
              <rect x="255" y="56" width="4" height="6" rx="1" fill="#ef4444"/>
              <rect x="263" y="56" width="4" height="6" rx="1" fill="#22c55e"/>
              <rect x="243" y="70" width="56" height="46" rx="2" fill="rgba(255,255,255,.05)"/>
              <polygon points="271,95 278,109 264,109" fill="rgba(245,158,11,.7)"/>
              <text x="271" y="107" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">!</text>
            </svg>
          </div>

          <div style={{fontSize:28,fontWeight:800,color:"#fff",lineHeight:1.3,marginBottom:14}}>
            Monitoring produksi<br/>panel listrik
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:32,maxWidth:320}}>
            Platform terintegrasi untuk kelola jadwal, distribusi, dan progress produksi secara real-time.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[
              {icon:"ðŸ“‹",text:"Multi admin dengan activity log"},
              {icon:"ðŸ“…",text:"Raw Schedule & Rencana Harian"},
              {icon:"âš¡",text:"Status H-7 mendesak otomatis"},
              {icon:"ðŸ”§",text:"Jadwal service & maintenance"},
            ].map(f=>(
              <div key={f.text} style={{display:"flex",alignItems:"center",gap:12,fontSize:13}}>
                <div style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{f.icon}</div>
                <span style={{color:"rgba(255,255,255,.85)",fontWeight:500}}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:32,position:"relative",zIndex:1}}>
          Â© 2026 Vista Teknik. All rights reserved.
        </div>
      </div>

      {/* RIGHT LOGIN */}
      <div className="login-right">
        <div className="login-card">
          <div style={{marginBottom:8}}>
            <div style={{fontSize:26,fontWeight:700,color:"#0f172a",marginBottom:6}}>Selamat datang</div>
            <div style={{fontSize:14,color:"#64748b"}}>Masuk ke akun Anda untuk melanjutkan</div>
          </div>

          <div style={{height:1,background:"#f1f5f9",margin:"20px 0"}}/>

          {/* Segmented Control */}
          <div className="login-seg">
            <button className={"login-seg-btn"+(mode==="admin"?" active":"")} onClick={()=>{setMode("admin");setErr("");}}>
              âš™ï¸ Admin
            </button>
            <button className={"login-seg-btn"+(mode==="divisi"?" active":"")} onClick={()=>{setMode("divisi");setErr("");}}>
              ðŸ‘· Operator
            </button>
          </div>

          {mode==="admin"?(
            <>
              <div className="login-input-wrap">
                <label className="login-label">Username</label>
                <div style={{position:"relative"}}>
                  <span className="login-input-icon">ðŸ‘¤</span>
                  <input className={"login-input"+(err?" login-input-err":"")}
                    value={username} onChange={e=>{setUsername(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan username..."/>
                </div>
              </div>
              <div className="login-input-wrap">
                <label className="login-label">Password</label>
                <div style={{position:"relative"}}>
                  <span className="login-input-icon">ðŸ”’</span>
                  <input className={"login-input"+(err?" login-input-err":"")}
                    type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password..." style={{paddingRight:48}}/>
                  <button className="login-eye" onClick={()=>setShow(!show)}>{show?"ðŸ™ˆ":"ðŸ‘"}</button>
                </div>
              </div>
            </>
          ):(
            <>
              <div className="login-input-wrap">
                <label className="login-label">Divisi</label>
                <select className="login-select" value={div} onChange={e=>{setDiv(e.target.value);setErr("");}}>
                  {Object.entries(DIVISI_CONFIG).filter(([k])=>k!=="admin").map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div className="login-input-wrap">
                <label className="login-label">Nama</label>
                <select className="login-select" value={selNama} onChange={e=>setSelNama(e.target.value)}>
                  <option value="">-- Pilih Nama --</option>
                  {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
                </select>
              </div>
              <div className="login-input-wrap">
                <label className="login-label">Password Divisi</label>
                <div style={{position:"relative"}}>
                  <span className="login-input-icon">ðŸ”’</span>
                  <input className={"login-input"+(err?" login-input-err":"")}
                    type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password divisi..." style={{paddingRight:48}}/>
                  <button className="login-eye" onClick={()=>setShow(!show)}>{show?"ðŸ™ˆ":"ðŸ‘"}</button>
                </div>
              </div>
            </>
          )}

          {err&&(
            <div className="login-err">
              <span>âš ï¸</span>
              <span>{err}</span>
            </div>
          )}

          <button className={"login-btn"+(success?" login-btn-success":"")} onClick={go} disabled={loading||success}>
            {loading?<><span className="spinner"/><span>Memuat...</span></>
             :success?<><span>âœ“</span><span>Berhasil!</span></>
             :<><span>Masuk</span><span>â†’</span></>}
          </button>

          <div style={{marginTop:20,textAlign:"center",fontSize:12,color:"#94a3b8"}}>
            {mode==="admin"
              ?<span>Login sebagai operator? <span style={{color:"#2563eb",fontWeight:600,cursor:"pointer"}} onClick={()=>setMode("divisi")}>Klik di sini</span></span>
              :<span>Login sebagai admin? <span style={{color:"#2563eb",fontWeight:600,cursor:"pointer"}} onClick={()=>setMode("admin")}>Klik di sini</span></span>
            }
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
  console.log('âœ… Login redesign berhasil!');
} else {
  console.log('âŒ startIdx:',startIdx,'nextFunc:',nextFunc);
}
