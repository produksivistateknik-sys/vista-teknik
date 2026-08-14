import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Inp, Btn } from './ui/Primitives'

export function SubBagianPasswordCard(){
  const [pwList,setPwList]=useState<any[]>([]);
  const [pwEdit,setPwEdit]=useState<Record<string,string>>({});
  const [pwSaving,setPwSaving]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);

  const subBagianIconLocal:Record<string,string>={
    Warehouse:"📦",Assembling:"🔧",QS:"📋",QC:"🔍",
    Potong:"✂️",Bending:"📐",Stel:"🔩",Finishing:"✨",
    Painting:"🎨","Assembling Luar":"⚙️","Assembling Dalam":"🔌",
  };

  // Rendam+Painting digabung jadi 1 sub-bagian login "Painting" di Vista Pekerja - "Rendam"
  // sengaja gak ada lagi di sini (dulu 2 field password terpisah, sekarang cuma 1).
  // "Warehouse" dihapus dari grup Tracking Komponen (14 Agu 2026) - login-nya sudah ditutup di
  // Vista Pekerja (subBagianPassword.komponen gak punya key ini lagi), fungsinya pindah ke tab
  // "Progress" login "Gudang" (password sendiri, gak lewat sistem sub-bagian ini). Row lama di
  // fcs_sub_bagian_password DIBIARKAN (gak di-DROP), cuma gak ditampilkan di sini lagi.
  const SUBBAGIAN_GROUPS:{label:string,icon:string,color:string,members:string[]}[]=[
    {label:"Mekanik",icon:"🔧",color:"#d97706",members:["Potong","Bending","Stel","Finishing"]},
    {label:"Painting",icon:"🎨",color:"#7c3aed",members:["Painting"]},
    {label:"Assembling",icon:"⚙️",color:"#059669",members:["Assembling Luar","Assembling Dalam"]},
    {label:"Tracking Komponen",icon:"📦",color:"#0d9488",members:["Assembling","QS","QC"]},
  ];

  const fetchPwList=async()=>{
    setLoading(true);
    const{data}=await supabase.from("fcs_sub_bagian_password").select("*").order("sub_bagian");
    setPwList(data??[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchPwList();
    const ch=supabase.channel("realtime-fcs-sub-bagian-password")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_sub_bagian_password"},fetchPwList)
      .subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[]);

  const savePassword=async(subBagian:string)=>{
    const newPwd=pwEdit[subBagian];
    if(!newPwd||!newPwd.trim())return;
    setPwSaving(subBagian);
    const{error}=await supabase.from("fcs_sub_bagian_password").update({password:newPwd}).eq("sub_bagian",subBagian);
    setPwSaving(null);
    if(error){alert("Gagal: "+error.message);}
    else{await fetchPwList();setPwEdit(prev=>({...prev,[subBagian]:""}));}
  };

  const findPw=(sb:string)=>pwList.find((p:any)=>p.sub_bagian===sb);

  return(
    <div style={{marginBottom:32}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,paddingBottom:10,borderBottom:"2px solid #e2e8f0"}}>
        <div style={{width:32,height:32,borderRadius:8,background:"#fef3c7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"🔑"}</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Password Sub-Bagian</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>Password bersama per sub-bagian untuk login Vista Pekerja (tanpa akun individual, nama bebas diketik)</div>
        </div>
        <span style={{marginLeft:"auto",background:"#fef3c7",color:"#b45309",borderRadius:20,padding:"2px 12px",fontSize:11,fontWeight:700}}>{pwList.length} sub-bagian</span>
      </div>
      {loading?(
        <div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:12}}>Memuat...</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {SUBBAGIAN_GROUPS.map(group=>(
            <div key={group.label}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:14}}>{group.icon}</span>
                <span style={{fontWeight:800,fontSize:12,color:group.color,textTransform:"uppercase" as const,letterSpacing:.4}}>{group.label}</span>
                <div style={{flex:1,height:1,background:"#f1f5f9"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
                {group.members.map(sb=>{
                  const p=findPw(sb);
                  if(!p)return null;
                  return(
                    <Card key={sb} style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10,minHeight:132}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:15}}>{subBagianIconLocal[sb]||"🔑"}</span>
                        <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>{sb}</span>
                      </div>
                      <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:7,padding:"6px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <span style={{fontSize:9,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:.4}}>Sekarang</span>
                        <span style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:"#1e293b",letterSpacing:1}}>{p.password}</span>
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:"auto"}}>
                        <Inp value={pwEdit[sb]||""} onChange={(e:any)=>setPwEdit(prev=>({...prev,[sb]:e.target.value}))}
                          placeholder="Password baru..." style={{flex:1,fontSize:12}}/>
                        <Btn color="#1d4ed8" onClick={()=>savePassword(sb)} style={{padding:"7px 12px",fontSize:11}}>
                          {pwSaving===sb?"...":"Simpan"}
                        </Btn>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
