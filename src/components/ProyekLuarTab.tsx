import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { DIVISI_CONFIG } from "../constants/panelTypes";
import { FotoZoomViewer, type FotoViewer } from "./FotoZoomViewer";
import { Card, Badge } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// PROYEK LUAR (30 Agu 2026) - sidebar tab sendiri, READ-ONLY (admin cuma lihat, gak
// edit/hapus di sini) - laporan/dokumentasi pekerjaan operator di proyek eksternal, input
// dari Vista Pekerja (ProyekLuarView.tsx), tabel `proyek_luar` (migration
// 20260830010000_create_proyek_luar.sql).
//
// Search-first: daftar baru muncul setelah user mengetik nama proyek/operator (biar gak
// nge-dump seluruh laporan tiap kali tab dibuka), filter divisi/status baru aktif bareng
// pencarian.
//
// Tabel BELUM masuk src/types/supabase-generated.ts - pakai (table as any), pola yang
// sudah ada di codebase ini buat tabel baru yang belum di-generate types-nya.
// ─────────────────────────────────────────────────────────────────────────────
export function ProyekLuarTab(){
  const[loading,setLoading]=useState(true);
  const[list,setList]=useState<any[]>([]);
  const[filterDivisi,setFilterDivisi]=useState("ALL");
  const[filterStatus,setFilterStatus]=useState("ALL");
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[expandedId,setExpandedId]=useState<number|null>(null);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewer[],startIndex:number,label:string}|null>(null);

  // silent (4 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - dipakai listener realtime di bawah
  // (tanpa filter, halaman ini READ-ONLY) biar list gak "berkedip" tiap ada laporan operator
  // manapun yang berubah.
  const fetchList=async(silent=false)=>{
    if(!silent)setLoading(true);
    // Paginasi eksplisit by .range() - konsisten sama pola tabel lain yang bisa gede
    // (renhar/panels/dll pernah kena bug 1000-row cap tanpa ini).
    let all:any[]=[];
    let from=0;
    const pageSize=1000;
    for(;;){
      const{data,error}=await supabase.from("proyek_luar" as any).select("*").order("created_at",{ascending:false}).range(from,from+pageSize-1);
      if(error||!data)break;
      all=all.concat(data);
      if(data.length<pageSize)break;
      from+=pageSize;
    }
    setList(all);
    if(!silent)setLoading(false);
  };
  useEffect(()=>{
    fetchList();
    const ch=supabase.channel("realtime-proyek-luar-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"proyek_luar"},()=>fetchList(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const divisiList=useMemo(()=>[...new Set(list.map(l=>l.divisi))],[list]);

  const q=search.trim().toLowerCase();
  const filtered=useMemo(()=>{
    if(viewMode==="aktif"&&!q)return[];
    return list.filter(l=>{
      if(viewMode==="arsip"?!l.is_archived:false)return false;
      if(filterDivisi!=="ALL"&&l.divisi!==filterDivisi)return false;
      if(filterStatus!=="ALL"&&l.status!==filterStatus)return false;
      if(q&&!(l.nama_lokasi||"").toLowerCase().includes(q)&&!(l.operator_nama||"").toLowerCase().includes(q))return false;
      return true;
    });
  },[list,filterDivisi,filterStatus,q,viewMode]);

  const statusStyle:any={
    berlangsung:{bg:"#fffbeb",color:"#d97706",label:"Berlangsung"},
    selesai:{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"},
  };

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama proyek / operator..."
          style={{flex:2,minWidth:200,padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",
            fontSize:13,background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)"}}/>
        <select value={filterDivisi} onChange={e=>setFilterDivisi(e.target.value)} disabled={viewMode==="aktif"&&!q}
          style={{padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:13,
            background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)",opacity:(viewMode==="aktif"&&!q)?.5:1,cursor:(viewMode==="aktif"&&!q)?"not-allowed":"pointer"}}>
          <option value="ALL">Semua Divisi</option>
          {divisiList.map(d=>(<option key={d} value={d}>{(DIVISI_CONFIG as any)[d]?.label||d}</option>))}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} disabled={viewMode==="aktif"&&!q}
          style={{padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:13,
            background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)",opacity:(viewMode==="aktif"&&!q)?.5:1,cursor:(viewMode==="aktif"&&!q)?"not-allowed":"pointer"}}>
          <option value="ALL">Semua Status</option>
          <option value="berlangsung">Berlangsung</option>
          <option value="selesai">Selesai</option>
        </select>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setViewMode("aktif")} style={{padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",
            fontSize:12.5,fontWeight:700,background:viewMode==="aktif"?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:viewMode==="aktif"?"#fff":"#64748b"}}>
            Aktif
          </button>
          <button onClick={()=>setViewMode("arsip")} style={{padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",
            fontSize:12.5,fontWeight:700,background:viewMode==="arsip"?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:viewMode==="arsip"?"#fff":"#64748b"}}>
            🗄️ Arsip
          </button>
        </div>
      </div>

      {viewMode==="aktif"&&!q?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <i className="ti ti-search" style={{fontSize:28,display:"block",marginBottom:8}}/>
          Ketik nama proyek atau nama operator untuk menampilkan daftar laporan.
        </div>
      ):loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>{viewMode==="arsip"?"Belum ada laporan diarsip.":"Tidak ada laporan yang cocok."}</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(l=>{
            const isExp=expandedId===l.id;
            const st=statusStyle[l.status]||statusStyle.berlangsung;
            const fotoList:any[]=l.foto||[];
            const dc=(DIVISI_CONFIG as any)[l.divisi];
            const accent=l.status==="selesai"?"#16a34a":"#d97706";
            return(
              <Card key={l.id} style={{padding:0,overflow:"hidden",borderLeft:`3px solid ${accent}`}}>
                <div className="erp-clickable-row" onClick={()=>setExpandedId(isExp?null:l.id)} style={{padding:"14px 16px",cursor:"pointer",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",
                  background:isExp?"#f8faff":"transparent"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
                    <div style={{width:38,height:38,borderRadius:10,background:(dc?.color||accent)+"18",display:"flex",
                      alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:17}}>
                      {dc?.icon||"🏗"}
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontWeight:800,fontSize:14,color:"var(--text-primary,#1e293b)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.nama_lokasi}</span>
                        <Badge label={dc?.label||l.divisi} color={dc?.color||"#64748b"} bg={dc?.bg}/>
                      </div>
                      <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>
                        👤 {l.operator_nama} · 📅 {l.tanggal} · <i className="ti ti-photo" style={{fontSize:11}}/> {fotoList.length} foto
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {l.is_archived&&<Badge label="Arsip" color="#64748b" bg="#f1f5f9"/>}
                    <Badge label={st.label} color={st.color} bg={st.bg}/>
                  </div>
                </div>
                {isExp&&(
                  <div style={{padding:"14px 16px",borderTop:"1px solid var(--border-color,#f1f5f9)"}}>
                    {l.catatan&&<div style={{fontSize:13,color:"var(--text-secondary,#475569)",marginBottom:14,lineHeight:1.6,
                      background:"var(--bg-secondary,#f8fafc)",borderRadius:10,padding:"10px 12px"}}>{l.catatan}</div>}
                    {fotoList.length===0?(
                      <div style={{fontSize:12,color:"#94a3b8"}}>Belum ada foto dokumentasi.</div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8}}>
                        {fotoList.map((f:any,fi:number)=>(
                          <div key={fi} onClick={()=>setFotoViewer({fotos:fotoList,startIndex:fi,label:l.nama_lokasi})}
                            style={{aspectRatio:"1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#f1f5f9",
                              border:"1px solid var(--border-color,#e2e8f0)"}}>
                            <img src={f.url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {fotoViewer&&<FotoZoomViewer fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
    </div>
  );
}
