import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Card, Lbl, Inp, Sel } from './ui/Primitives'

export function TrackingKomponenAdmin(){
  const[pwList,setPwList]=useState<any[]>([]);
  const[pwEdit,setPwEdit]=useState<Record<string,string>>({});
  const[pwSaving,setPwSaving]=useState<string|null>(null);
  const[showPwPanel,setShowPwPanel]=useState(false);

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[fotoMap,setFotoMap]=useState<Record<number,any[]>>({});
  const[loadingRiwayat,setLoadingRiwayat]=useState(false);

  const fetchPwList=async()=>{
    const{data}=await supabase.from("fcs_sub_bagian_password").select("*").order("sub_bagian");
    setPwList(data??[]);
  };

  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe,komponen_status").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };

  const fetchRiwayat=async(panelId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("panel_id",panelId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);
    if(tr&&tr.length>0){
      const ids=tr.map((t:any)=>t.id);
      const{data:fotos}=await supabase.from("fcs_tracking_komponen_foto").select("*").in("tracking_id",ids);
      const map:Record<number,any[]>={};
      (fotos??[]).forEach((f:any)=>{
        if(!map[f.tracking_id])map[f.tracking_id]=[];
        map[f.tracking_id].push(f);
      });
      setFotoMap(map);
    } else {
      setFotoMap({});
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{fetchPwList();fetchWoList();},[]);
  useEffect(()=>{
    setSelectedPanelId(null);
    setRiwayat([]);
    if(selectedWoId)fetchPanelList(selectedWoId);
  },[selectedWoId]);
  useEffect(()=>{
    if(selectedPanelId)fetchRiwayat(selectedPanelId);
    else setRiwayat([]);
  },[selectedPanelId]);

  const savePassword=async(subBagian:string)=>{
    const newPwd=pwEdit[subBagian];
    if(!newPwd||!newPwd.trim()){alert("Password tidak boleh kosong");return;}
    setPwSaving(subBagian);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const{error}=await supabase.from("fcs_sub_bagian_password").update({
      password:newPwd.trim(),
      updated_at:new Date().toISOString(),
      updated_by:sess?.nama||sess?.name||"Admin",
    }).eq("sub_bagian",subBagian);
    if(error){alert("Gagal simpan: "+error.message);}
    else{await fetchPwList();setPwEdit(prev=>({...prev,[subBagian]:""}));}
    setPwSaving(null);
  };

  const deleteTracking=async(trackingId:number)=>{
    if(!confirm("Hapus riwayat ini beserta fotonya?"))return;
    const fotos=fotoMap[trackingId]||[];
    for(const foto of fotos){
      const path=foto.file_url.split("/tracking-komponen/")[1];
      if(path)await supabase.storage.from("tracking-komponen").remove([path]);
    }
    await supabase.from("fcs_tracking_komponen").delete().eq("id",trackingId);
    if(selectedPanelId)fetchRiwayat(selectedPanelId);
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";

  const subBagianIcon:Record<string,string>={Warehouse:"📦",Assembling:"🔧",QS:"📋",QC:"🔍",Potong:"✂️",Bending:"📐",Stel:"🔩",Finishing:"✨",Rendam:"💧",Painting:"🎨","Assembling Luar":"⚙️","Assembling Dalam":"🔌"};

  const countPerSubBagian=["Warehouse","Assembling","QS"].map(sb=>({
    sb,
    count:riwayat.filter((r:any)=>r.sub_bagian===sb).length,
  }));

  const[modalSubBagian,setModalSubBagian]=useState<string|null>(null);
  const riwayatModalSubBagian=modalSubBagian?riwayat.filter((r:any)=>r.sub_bagian===modalSubBagian):[];

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontWeight:800,fontSize:20,color:"#1e293b"}}>📦 Tracking Komponen</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Monitoring serah terima komponen antar bagian</div>
        </div>
        <Btn outline color="#64748b" onClick={()=>setShowPwPanel(p=>!p)}>
          {showPwPanel?"Tutup Pengaturan":"⚙️ Atur Password"}
        </Btn>
      </div>

      {showPwPanel&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>Password Sub-bagian</div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
            {pwList.map((p:any)=>(
              <div key={p.sub_bagian} style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" as const}}>
                <div style={{minWidth:120}}>
                  <Lbl>{subBagianIcon[p.sub_bagian]} {p.sub_bagian}</Lbl>
                  <div style={{fontSize:12,fontWeight:600,color:"#64748b"}}>Saat ini: {p.password}</div>
                </div>
                <div style={{flex:1,minWidth:160}}>
                  <Inp value={pwEdit[p.sub_bagian]||""} onChange={(e:any)=>setPwEdit(prev=>({...prev,[p.sub_bagian]:e.target.value}))}
                    placeholder="Password baru..."/>
                </div>
                <Btn color="#1d4ed8" onClick={()=>savePassword(p.sub_bagian)} style={{padding:"9px 16px"}}>
                  {pwSaving===p.sub_bagian?"...":"Simpan"}
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{marginBottom:16}}>
        <Lbl>Pilih Work Order</Lbl>
        <Sel value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}>
          <option value="">-- Pilih Work Order --</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </Sel>
      </Card>

      {selectedWoId&&(
        <Card style={{marginBottom:16}}>
          <Lbl>Pilih Panel</Lbl>
          <Sel value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}>
            <option value="">-- Pilih Panel --</option>
            {panelList.map((p:any)=>(
              <option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>
            ))}
          </Sel>
          {panelList.length===0&&(
            <div style={{fontSize:12,fontWeight:600,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>
          )}
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {countPerSubBagian.map(({sb,count})=>{
          const isActive=!!(selectedWoId&&selectedPanelId);
          const selectedPanelObj=panelList.find((p:any)=>p.id===selectedPanelId);
          const sbStatus=selectedPanelObj?.komponen_status?.[sb]?.status||"to_do";
          const statusStyle=sbStatus==="complete"?{bg:"#f0fdf4",color:"#16a34a",label:"Complete"}:sbStatus==="in_progress"?{bg:"#fff7ed",color:"#ea580c",label:"In Progress"}:{bg:"#f1f5f9",color:"#64748b",label:"To Do"};
          return(
            <Card key={sb} onClick={()=>{if(isActive)setModalSubBagian(sb);}}
              style={{textAlign:"center" as const,cursor:isActive?"pointer":"not-allowed",opacity:isActive?1:0.5,transition:"all .15s"}}
              onMouseEnter={(e:any)=>{if(isActive){e.currentTarget.style.boxShadow="0 4px 12px #00000018";e.currentTarget.style.transform="translateY(-2px)";}}}
              onMouseLeave={(e:any)=>{e.currentTarget.style.boxShadow="0 1px 3px #00000008";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",fontSize:22,boxShadow:"0 3px 10px #0d948844"}}>
                {subBagianIcon[sb]}
              </div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{sb}</div>
              <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8",marginTop:2,marginBottom:8}}>{isActive?(count>0?`${count} entri`:"Belum ada entri"):"Pilih WO & panel"}</div>
              {isActive&&(
                <span style={{background:statusStyle.bg,color:statusStyle.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>
                  {statusStyle.label}
                </span>
              )}
            </Card>
          );
        })}
      </div>

      {selectedWoId&&selectedPanelId&&(
        <>
          <div style={{fontSize:12,fontWeight:800,color:"#0f172a",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>Riwayat Lengkap</div>
          {loadingRiwayat?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8"}}>Memuat...</div>
          ):riwayat.length===0?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk WO ini</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
              {riwayat.map((r:any)=>(
                <Card key={r.id}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:17}}>
                        {subBagianIcon[r.sub_bagian]}
                      </div>
                      <div>
                        <div style={{fontWeight:800,fontSize:15,color:"#0f172a"}}>{r.sub_bagian}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#94a3b8",marginTop:2}}>oleh {r.operator_name} · {fmtDateTime(r.created_at)}</div>
                      </div>
                    </div>
                    <button onClick={()=>deleteTracking(r.id)}
                      style={{border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}
                      title="Hapus riwayat">🗑️</button>
                  </div>
                  {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginTop:8,lineHeight:1.6}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginTop:10}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:72,height:72,objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {modalSubBagian&&(
        <div onClick={()=>setModalSubBagian(null)}
          style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto" as const,padding:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 3px 10px #0d948844"}}>
                  {subBagianIcon[modalSubBagian]}
                </div>
                <div style={{fontWeight:800,fontSize:17,color:"#0f172a"}}>{modalSubBagian}</div>
              </div>
              <button onClick={()=>setModalSubBagian(null)}
                style={{border:"none",background:"#f1f5f9",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:16,color:"#64748b"}}>✕</button>
            </div>
            {riwayatModalSubBagian.length===0?(
              <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13,fontWeight:600}}>Belum ada riwayat untuk {modalSubBagian}</div>
            ):(
              <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
                {riwayatModalSubBagian.map((r:any)=>(
                  <div key={r.id} style={{background:"#f8fafc",borderRadius:10,padding:14}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:6}}>oleh {r.operator_name} · {fmtDateTime(r.created_at)}</div>
                    {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6}}>{r.catatan}</div>}
                    {(fotoMap[r.id]||[]).length>0&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                        {(fotoMap[r.id]||[]).map((foto:any)=>(
                          <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                            <img src={foto.file_url} style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0"}}/>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
