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
    setTimeout(()=>onLogin({...data,divisi:"admin",name:data.nama}),800);
    setLoading(false);
  };

  const goDivisi=async()=>{
    if(!selNama){setErr("Pilih nama!");return;}
    if(pwd!==DIVISI_CONFIG[div].password){setErr("Password salah!");return;}
    setLoading(true);
    const found=namaList.find(p=>p.nama===selNama);
    if(!found){setErr("Nama tidak ditemukan!");setLoading(false);return;}
    setSuccess(true);
    setTimeout(()=>onLogin({...found,divisi:div,name:found.nama}),800);
    setLoading(false);
  };

  const go=mode==="admin"?goAdmin:goDivisi;

  const css=\`
    @keyframes lgFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes lgSpin{to{transform:rotate(360deg)}}
    @keyframes lgSuccess{0%{transform:scale(.8);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
    @keyframes lgPulse{0%,100%{opacity:1}50%{opacity:.5}}
    .lg-card{animation:lgFadeIn .5s cubic-bezier(.22,1,.36,1) forwards}
    .lg-inp{width:100%;height:52px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s,background .2s}
    .lg-inp:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-inp.err{border-color:#f87171;background:#fff8f8}
    .lg-inp::placeholder{color:#94a3b8}
    .lg-sel{width:100%;height:52px;padding:0 16px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s;appearance:none;cursor:pointer}
    .lg-sel:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-btn{width:100%;height:52px;border-radius:10px;border:none;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px;box-shadow:0 4px 14px rgba(37,99,235,.3)}
    .lg-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.4)}
    .lg-btn:active:not(:disabled){transform:translateY(0)}
    .lg-btn:disabled{opacity:.75;cursor:not-allowed;transform:none}
    .lg-btn.success{background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 4px 14px rgba(22,163,74,.3)}
    .lg-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:lgSpin .65s linear infinite}
    .lg-seg{display:flex;background:#f1f5f9;border-radius:12px;padding:4px;gap:3px}
    .lg-seg-btn{flex:1;height:44px;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:6px;color:#64748b;background:transparent}
    .lg-seg-btn.on{background:#fff;color:#2563eb;box-shadow:0 1px 6px rgba(0,0,0,.1)}
    .lg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:11px 14px;font-size:13px;display:flex;align-items:center;gap:8px}
    .lg-label{font-size:12px;font-weight:600;color:#475569;margin-bottom:7px;letter-spacing:.2px;text-transform:uppercase}
    .lg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;color:#94a3b8;pointer-events:none}
    .lg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:4px;display:flex;align-items:center}
    .lg-success-overlay{position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)}
    .lg-success-icon{font-size:64px;animation:lgSuccess .5s cubic-bezier(.22,1,.36,1) forwards}
    @media(max-width:700px){.lg-left{display:none!important}.lg-right{width:100%!important;padding:24px!important}}
  \`;

  return(
    <div style={{minHeight:"100vh",display:"flex",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      <style>{css}</style>

      {success&&(
        <div className="lg-success-overlay">
          <div style={{textAlign:"center"}}>
            <div className="lg-success-icon">✅</div>
            <div style={{marginTop:12,fontSize:16,fontWeight:700,color:"#16a34a"}}>Login berhasil!</div>
          </div>
        </div>
      )}

      {/* LEFT */}
      <div className="lg-left" style={{width:"45%",background:"linear-gradient(145deg,#0f172a 0%,#1e3a8a 45%,#1d4ed8 100%)",display:"flex",flexDirection:"column",padding:"44px 48px",color:"#fff",position:"relative",overflow:"hidden",flexShrink:0}}>
        {/* BG circles */}
        <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:240,height:240,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{position:"absolute",top:"40%",left:"60%",width:160,height:160,borderRadius:"50%",background:"rgba(37,99,235,.15)"}}/>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:56,position:"relative",zIndex:1}}>
          <div style={{width:42,height:42,background:"rgba(255,255,255,.15)",borderRadius:11,border:"1px solid rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:19,letterSpacing:-1}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:.3,lineHeight:1.2}}>Vista Teknik</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontWeight:500,marginTop:2}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>

        {/* SVG Panel Illustration */}
        <div style={{position:"relative",zIndex:1,marginBottom:28}}>
          <svg width="100%" height="130" viewBox="0 0 340 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Panel 1 */}
            <rect x="8" y="15" width="88" height="108" rx="5" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"/>
            <rect x="16" y="23" width="72" height="92" rx="3" fill="rgba(255,255,255,.04)"/>
            <rect x="20" y="27" width="32" height="9" rx="2" fill="rgba(255,255,255,.25)"/>
            <rect x="56" y="27" width="28" height="9" rx="2" fill="rgba(255,255,255,.2)"/>
            <rect x="20" y="40" width="64" height="16" rx="2" fill="rgba(29,78,216,.6)"/>
            <rect x="25" y="45" width="5" height="6" rx="1" fill="#f59e0b"/>
            <rect x="34" y="45" width="5" height="6" rx="1" fill="#f59e0b"/>
            <rect x="43" y="45" width="5" height="6" rx="1" fill="#ef4444"/>
            <rect x="52" y="45" width="5" height="6" rx="1" fill="#22c55e"/>
            <circle cx="74" cy="48" r="5" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.3)" strokeWidth="1"/>
            <rect x="20" y="60" width="64" height="48" rx="2" fill="rgba(255,255,255,.04)"/>
            <rect x="24" y="64" width="36" height="4" rx="1" fill="rgba(255,255,255,.2)"/>
            <rect x="24" y="72" width="24" height="3" rx="1" fill="rgba(255,255,255,.13)"/>
            <circle cx="66" cy="68" r="6" fill="rgba(220,38,38,.5)"/>
            <circle cx="78" cy="68" r="6" fill="rgba(245,158,11,.5)"/>
            <circle cx="66" cy="82" r="6" fill="rgba(34,197,94,.5)"/>
            <circle cx="78" cy="82" r="6" fill="rgba(59,130,246,.5)"/>
            {/* Panel 2 - center, bigger */}
            <rect x="114" y="5" width="112" height="122" rx="5" fill="rgba(255,255,255,.09)" stroke="rgba(255,255,255,.28)" strokeWidth="2"/>
            <rect x="122" y="13" width="96" height="106" rx="3" fill="rgba(255,255,255,.05)"/>
            <rect x="126" y="17" width="44" height="10" rx="2" fill="rgba(255,255,255,.3)"/>
            <rect x="174" y="17" width="40" height="10" rx="2" fill="rgba(255,255,255,.22)"/>
            <rect x="126" y="31" width="88" height="20" rx="3" fill="rgba(29,78,216,.65)"/>
            <rect x="131" y="37" width="6" height="8" rx="1" fill="#f59e0b"/>
            <rect x="141" y="37" width="6" height="8" rx="1" fill="#f59e0b"/>
            <rect x="151" y="37" width="6" height="8" rx="1" fill="#ef4444"/>
            <rect x="161" y="37" width="6" height="8" rx="1" fill="#22c55e"/>
            <circle cx="195" cy="41" r="6" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.35)" strokeWidth="1"/>
            <rect x="126" y="55" width="88" height="58" rx="3" fill="rgba(255,255,255,.04)"/>
            <rect x="130" y="60" width="50" height="5" rx="1" fill="rgba(255,255,255,.22)"/>
            <rect x="130" y="70" width="36" height="4" rx="1" fill="rgba(255,255,255,.15)"/>
            <rect x="130" y="78" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <rect x="130" y="83" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <rect x="130" y="88" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <rect x="130" y="93" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <polygon points="170,100 178,114 162,114" fill="rgba(245,158,11,.75)"/>
            <text x="170" y="112" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">!</text>
            {/* Panel 3 */}
            <rect x="244" y="22" width="88" height="100" rx="5" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.18)" strokeWidth="1.5"/>
            <rect x="252" y="30" width="72" height="84" rx="3" fill="rgba(255,255,255,.04)"/>
            <rect x="256" y="34" width="30" height="8" rx="2" fill="rgba(255,255,255,.22)"/>
            <rect x="290" y="34" width="28" height="8" rx="2" fill="rgba(255,255,255,.18)"/>
            <rect x="256" y="46" width="60" height="15" rx="2" fill="rgba(29,78,216,.55)"/>
            <rect x="261" y="51" width="5" height="5" rx="1" fill="#f59e0b"/>
            <rect x="270" y="51" width="5" height="5" rx="1" fill="#ef4444"/>
            <rect x="279" y="51" width="5" height="5" rx="1" fill="#22c55e"/>
            <rect x="256" y="65" width="60" height="44" rx="2" fill="rgba(255,255,255,.04)"/>
            <rect x="260" y="69" width="32" height="4" rx="1" fill="rgba(255,255,255,.18)"/>
            <rect x="260" y="77" width="22" height="3" rx="1" fill="rgba(255,255,255,.12)"/>
          </svg>
        </div>

        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:26,fontWeight:800,lineHeight:1.3,marginBottom:12}}>
            Monitoring produksi<br/>panel listrik
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:28,maxWidth:300}}>
            Platform terintegrasi untuk kelola jadwal, distribusi, dan progress produksi secara real-time.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {i:"📋",t:"Multi admin dengan activity log"},
              {i:"📅",t:"Raw Schedule & Rencana Harian"},
              {i:"⚡",t:"Status H-7 mendesak otomatis"},
              {i:"🔧",t:"Jadwal service & maintenance"},
            ].map(f=>(
              <div key={f.t} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{f.i}</div>
                <span style={{color:"rgba(255,255,255,.82)",fontWeight:500}}>{f.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:"auto",paddingTop:32,position:"relative",zIndex:1}}>
          © 2026 Vista Teknik. All rights reserved.
        </div>
      </div>

      {/* RIGHT */}
      <div className="lg-right" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 64px"}}>
        <div className="lg-card" style={{width:"100%",maxWidth:440,background:"#fff",borderRadius:20,padding:"36px 40px",boxShadow:"0 4px 6px rgba(0,0,0,.04),0 24px 60px rgba(0,0,0,.08)"}}>

          <div style={{marginBottom:6}}>
            <div style={{fontSize:24,fontWeight:700,color:"#0f172a",marginBottom:5}}>Selamat datang</div>
            <div style={{fontSize:13,color:"#64748b"}}>Masuk ke akun Anda untuk melanjutkan</div>
          </div>

          <div style={{height:1,background:"#f1f5f9",margin:"20px 0"}}/>

          {/* Segment */}
          <div className="lg-seg" style={{marginBottom:24}}>
            <button className={"lg-seg-btn"+(mode==="admin"?" on":"")} onClick={()=>{setMode("admin");setErr("");}}>
              ⚙️ Admin
            </button>
            <button className={"lg-seg-btn"+(mode==="divisi"?" on":"")} onClick={()=>{setMode("divisi");setErr("");}}>
              👷 Operator
            </button>
          </div>

          {mode==="admin"?(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="lg-label">Username</div>
                <div style={{position:"relative"}}>
                  <span className="lg-icon">👤</span>
                  <input className={"lg-inp"+(err?" err":"")} value={username}
                    onChange={e=>{setUsername(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan username..."/>
                </div>
              </div>
              <div>
                <div className="lg-label">Password</div>
                <div style={{position:"relative"}}>
                  <span className="lg-icon">🔒</span>
                  <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password..." style={{paddingRight:44}}/>
                  <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
                </div>
              </div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="lg-label">Divisi</div>
                <div style={{position:"relative"}}>
                  <select className="lg-sel" value={div} onChange={e=>{setDiv(e.target.value);setErr("");}}>
                    {Object.entries(DIVISI_CONFIG).filter(([k])=>k!=="admin").map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </div>
              </div>
              <div>
                <div className="lg-label">Nama</div>
                <div style={{position:"relative"}}>
                  <select className="lg-sel" value={selNama} onChange={e=>setSelNama(e.target.value)}>
                    <option value="">-- Pilih Nama --</option>
                    {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </div>
              </div>
              <div>
                <div className="lg-label">Password Divisi</div>
                <div style={{position:"relative"}}>
                  <span className="lg-icon">🔒</span>
                  <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password divisi..." style={{paddingRight:44}}/>
                  <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
                </div>
              </div>
            </div>
          )}

          {err&&(
            <div className="lg-err" style={{marginTop:16}}>
              <span>⚠️</span><span>{err}</span>
            </div>
          )}

          <button className={"lg-btn"+(success?" success":"")} onClick={go} disabled={loading||success} style={{marginTop:20}}>
            {loading?<><span className="lg-spinner"/><span>Memuat...</span></>
             :success?<><span>✓</span><span>Berhasil!</span></>
             :<><span>Masuk</span><span style={{fontSize:16}}>→</span></>}
          </button>

          <div style={{marginTop:16,textAlign:"center",fontSize:12,color:"#94a3b8"}}>
            {mode==="admin"
              ?<>Operator? <span style={{color:"#2563eb",fontWeight:600,cursor:"pointer"}} onClick={()=>setMode("divisi")}>Gunakan tab Operator</span></>
              :<>Admin? <span style={{color:"#2563eb",fontWeight:600,cursor:"pointer"}} onClick={()=>setMode("admin")}>Gunakan tab Admin</span></>
            }
          </div>

          <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #f1f5f9",textAlign:"center",fontSize:11,color:"#cbd5e1"}}>
            © 2026 Vista Teknik · Electrical Switchboard Manufacturing
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
  console.log('✅ Login redesign berhasil!');
} else {
  console.log('❌ Tidak ditemukan! start:',startIdx,'next:',nextFunc);
}
