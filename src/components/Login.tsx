import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { DIVISI_CONFIG } from '../constants/panelTypes'
import { GCss } from '../styles/globalCss'
import { VISTA_LOGO_DATA_URI } from '../lib/logoAsset'

export function Login({onLogin}){
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
    // Password di-hash (bcrypt) - verifikasi lewat RPC yang compare pakai crypt() di server,
    // bukan compare plaintext di WHERE client-side kayak sebelumnya.
    const{data,error}=await supabase.rpc("verify_admin_login",{p_username:username.trim(),p_password:pwd}).single();
    if(error||!data){setErr("Username atau password salah!");setLoading(false);return;}
    await supabase.from("admins").update({last_login:new Date().toISOString()}).eq("id",data.id);
    await activityLogService.insert({user_name:data.nama,action:"LOGIN",description:"Login ke sistem",module:"auth",halaman:"Login"});
    const{password:_pw,...safeData}=data;
    localStorage.setItem("vista_admin_session",JSON.stringify({...safeData,divisi:"admin"}));
    setSuccess(true);
    setTimeout(()=>onLogin({...safeData,divisi:"admin",name:data.nama}),800);
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

  const css=`
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
    @media(max-width:700px){.lg-left{display:none!important}.lg-right{width:100%!important;padding:24px!important}.lg-overlay{background:rgba(8,15,34,.72)!important}}
  `;

  return(
    <div style={{minHeight:"100vh",width:"100%",display:"flex",position:"relative",background:"#0f172a",backgroundImage:"url(/login-bg.jpg)",backgroundSize:"cover",backgroundPosition:"center"}}>
      <style>{GCss}</style>
      <style>{css}</style>

      <div className="lg-overlay" style={{position:"absolute",inset:0,background:"linear-gradient(100deg, rgba(8,15,34,.45) 0%, rgba(8,15,34,.62) 45%, rgba(8,15,34,.88) 100%)",zIndex:0}}/>

      {success&&(
        <div className="lg-success-overlay">
          <div style={{textAlign:"center"}}>
            <div className="lg-success-icon">✅</div>
            <div style={{marginTop:12,fontSize:16,fontWeight:700,color:"#16a34a"}}>Login berhasil!</div>
          </div>
        </div>
      )}

      {/* LEFT */}
      <div className="lg-left" style={{width:"45%",display:"flex",flexDirection:"column",padding:"20px 48px 44px",color:"#fff",position:"relative",zIndex:1,flexShrink:0}}>
        {/* Logo */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6,marginBottom:56,position:"relative",zIndex:1}}>
          <img src={VISTA_LOGO_DATA_URI} alt="Vista Teknik" style={{height:88,width:"auto",flexShrink:0,filter:"drop-shadow(0 2px 8px rgba(0,0,0,.35))"}}/>
          <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontWeight:500}}>Electrical Switchboard Manufacturing</div>
        </div>

        <div style={{position:"relative",zIndex:1,marginTop:8}}>
          <div style={{fontSize:26,fontWeight:800,lineHeight:1.3,marginBottom:12,textShadow:"0 2px 12px rgba(0,0,0,.35)"}}>
            Monitoring produksi<br/>panel listrik
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:28,maxWidth:300,textShadow:"0 1px 8px rgba(0,0,0,.35)"}}>
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
      <div className="lg-right" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 64px",position:"relative",zIndex:1}}>
        <div className="lg-card" style={{width:"100%",maxWidth:440,background:"rgba(255,255,255,.75)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",borderRadius:20,padding:"36px 40px",boxShadow:"0 4px 6px rgba(0,0,0,.04),0 24px 60px rgba(0,0,0,.08)"}}>

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
}
