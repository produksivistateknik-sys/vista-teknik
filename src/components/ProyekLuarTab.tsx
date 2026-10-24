import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { activityLogService } from "../services/activityLogService";
import { DIVISI_CONFIG } from "../constants/panelTypes";
import { FotoZoomViewer, type FotoViewer } from "./FotoZoomViewer";
import { Card } from "./ui/Primitives";
import { ThumbMedia } from './ui/ThumbMedia'
import { isVideoFoto } from '../lib/mediaThumb'
import { UnduhWordProyekLuar } from './UnduhWordProyekLuar'
import type { PantauProyekLuar } from '../hooks/useProyekLuarPantau'
import { aktivitasPL, aktifHariIniPL, statusPantauPL, labelWaktuPL, jejakUbahCatatanPL, bentrokCatatanPL } from '../lib/proyekLuarPantau'

// ─────────────────────────────────────────────────────────────────────────────
// PROYEK LUAR (30 Agu 2026) - sidebar tab sendiri - laporan/dokumentasi pekerjaan operator di
// proyek eksternal, input dari Vista Pekerja (ProyekLuarView.tsx), tabel `proyek_luar` (migration
// 20260830010000_create_proyek_luar.sql, is_archived dari 20260831010000).
//
// Desain ulang (28 Sep 2026, preview disetujui user): daftar "outstanding" (belum diarsipkan)
// TAMPIL LANGSUNG - dulu search-first (list kosong sampai user ngetik). Search/Divisi/Status
// jadi filter TAMBAHAN. Toggle Aktif/Arsip memisah is_archived=false/true (dulu search di mode
// Aktif ikut nampilin yang diarsip). Admin sekarang bisa Arsipkan/Batalkan Arsip per laporan -
// kolom & aksi yang sama dengan tombol di Vista Pekerja (ProyekLuarView.toggleArsip).
//
// Kartu: catatan dipecah per BARIS jadi poin bernomor - hanya split newline apa adanya dari
// operator, SENGAJA tidak menebak pemecahan kalimat/koma di paragraf panjang.
//
// Pantau harian (24 Okt 2026): operator kini mengisi laporan BERTAHAP (dibuat saat mulai, catatan tersimpan otomatis, foto
// diunggah saat dipilih) -> daftar diurutkan menurut aktivitas terakhir (aktivitas_pada), label "Diperbarui HH:MM", filter
// "Aktif hari ini" (hari kerja WIB), penanda BARU (hijau) / DIPERBARUI (kuning) per admin - hilang setelah kartu terlihat
// di layar 2 detik (tandai_proyek_luar_dilihat). Data dimuat ulang saat ringkasan pantau berubah (hooks/useProyekLuarPantau,
// pemulih realtime + polling ringan) - aturan di lib/proyekLuarPantau (identik dgn vista-pekerja).
// ─────────────────────────────────────────────────────────────────────────────

const statusStyle:Record<string,{bg:string;color:string;label:string}>={
  berlangsung:{bg:"#fff7ed",color:"#c2410c",label:"Berlangsung"},
  selesai:{bg:"#f0fdf4",color:"#15803d",label:"Selesai"},
};
const MUTED="var(--text-muted,#64748b)";

const fmtTanggal=(t:string)=>{
  if(!t)return"-";
  const d=new Date(t+"T00:00:00");
  return isNaN(d.getTime())?t:d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
};
const poinCatatan=(c:string|null)=>(c||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

const WARNA_PANTAU={baru:{bg:"#ecfdf5",border:"#86efac",fg:"#15803d",label:"BARU"},diperbarui:{bg:"#fefce8",border:"#fde047",fg:"#a16207",label:"DIPERBARUI"}} as const;

export function ProyekLuarTab({pantau}:{pantau?:PantauProyekLuar}={}){
  const[loading,setLoading]=useState(true);
  const[loadError,setLoadError]=useState<string|null>(null);
  const[list,setList]=useState<any[]>([]);
  const[filterDivisi,setFilterDivisi]=useState("ALL");
  const[filterStatus,setFilterStatus]=useState("ALL");
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[hanyaHariIni,setHanyaHariIni]=useState(false);
  const[savingId,setSavingId]=useState<number|null>(null);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewer[],startIndex:number,label:string}|null>(null);
  const[wordAwal,setWordAwal]=useState<any>(null); // dialog Unduh Word (24 Okt 2026)
  // Edit catatan (24 Okt 2026): hanya akun divisi admin; lewat RPC ubah_catatan_proyek_luar (jejak diubah_oleh/pada + log
  // proyek_luar_catatan_log). Admin boleh semua laporan; operator mengedit dari vista-pekerja (miliknya, selama Berlangsung).
  const sesiAdmin=(()=>{try{return JSON.parse(localStorage.getItem("vista_admin_session")||"{}")}catch{return{}}})();
  const bolehUbahCatatan=sesiAdmin?.divisi==="admin";
  const[editCat,setEditCat]=useState<{id:number;teks:string;dasar:string|null}|null>(null);
  const[simpanCat,setSimpanCat]=useState(false);
  const simpanCatatan=async(l:any)=>{
    if(!editCat||simpanCat)return;
    setSimpanCat(true);
    try{
      const oleh=String(sesiAdmin?.nama||sesiAdmin?.name||"Admin").trim();
      // p_dasar = catatan saat mulai mengedit: kalau operator mengubahnya sementara itu -> BENTROK, tidak ditimpa diam-diam.
      const{data,error}=await supabase.rpc("ubah_catatan_proyek_luar" as any,{p_id:l.id,p_catatan:editCat.teks,p_oleh:oleh,p_pekerja_id:null,p_admin:true,p_dasar:editCat.dasar,p_cek_dasar:true} as any);
      if(error&&bentrokCatatanPL(error)){
        const{data:baru,error:e2}=await supabase.from("proyek_luar" as any).select("*").eq("id",l.id).range(0,0);
        if(e2)throw e2;
        const r:any=(baru as any)?.[0];
        if(r){setList(prev=>prev.map(x=>x.id===l.id?r:x));setEditCat({id:l.id,teks:editCat.teks,dasar:r.catatan??null});}
        tampilToast(`Catatan baru saja diubah ${r?.catatan_diubah_oleh||"orang lain"}. Tulisan Anda masih di kotak - periksa versi terbaru, lalu tekan Simpan lagi untuk menimpa.`,true);
        return;
      }
      if(error)throw error;
      setList(prev=>prev.map(x=>x.id===l.id?{...x,...(data as any)}:x));
      setEditCat(null);tampilToast("Catatan tersimpan");
      pantau?.tandai([l.id]); // perubahan sendiri tidak perlu menyala
    }catch(err:any){
      console.error("[Proyek Luar] simpan catatan gagal:",err);
      tampilToast("Gagal menyimpan catatan: "+(err?.message||err),true);
    }finally{setSimpanCat(false);}
  };
  const[toast,setToast]=useState<{msg:string;error?:boolean}|null>(null);
  const toastTimer=useRef<any>(null);
  const tampilToast=(msg:string,error=false)=>{
    setToast({msg,error});
    if(toastTimer.current)clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(()=>setToast(null),3500);
  };

  // silent (4 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - dipakai listener realtime di bawah
  // biar list gak "berkedip" tiap ada laporan operator manapun yang berubah.
  const fetchList=async(silent=false)=>{
    if(!silent)setLoading(true);
    // Paginasi eksplisit by .range() - konsisten sama pola tabel lain yang bisa gede
    // (renhar/panels/dll pernah kena bug 1000-row cap tanpa ini).
    let all:any[]=[];
    let from=0;
    const pageSize=1000;
    for(;;){
      const{data,error}=await supabase.from("proyek_luar" as any).select("*").order("created_at",{ascending:false}).range(from,from+pageSize-1);
      if(error){
        console.error("Gagal memuat proyek_luar:",error);
        setLoadError(error.message);
        if(!silent)setLoading(false);
        return;
      }
      all=all.concat(data||[]);
      if(!data||data.length<pageSize)break;
      from+=pageSize;
    }
    setLoadError(null);
    setList(all);
    if(!silent)setLoading(false);
  };
  useEffect(()=>{
    fetchList();
    if(pantau)return; // dimuat ulang lewat ringkasan pantau (efek di bawah)
    const ch=supabase.channel("realtime-proyek-luar-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"proyek_luar"},()=>fetchList(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Ringkasan pantau (id + aktivitas + updated_at + arsip) berubah -> muat ulang data lengkap (realtime/sambung ulang/tab aktif/
  // polling ringan semuanya lewat hooks/useProyekLuarPantau - data lengkap TIDAK dipolling).
  const tandaTerakhir=useRef<string|null>(null);
  useEffect(()=>{
    if(!pantau?.tanda)return;
    if(tandaTerakhir.current===null){tandaTerakhir.current=pantau.tanda;return;}
    if(tandaTerakhir.current===pantau.tanda)return;
    tandaTerakhir.current=pantau.tanda;
    fetchList(true);
  },[pantau?.tanda]);

  // Penanda hilang setelah kartu terlihat >= 50% selama 2 detik (tab tersembunyi = display:none -> tidak terlihat).
  const statusKartu=(l:any)=>pantau?.penanda?statusPantauPL(l,pantau.dilihat.get(Number(l.id))):null;
  const pengamat=useRef<IntersectionObserver|null>(null);
  const timerLihat=useRef<Map<number,any>>(new Map());
  const antreLihat=useRef<Set<number>>(new Set());
  const kirimLihat=useRef<any>(null);
  const tandaiRef=useRef(pantau?.tandai);
  useEffect(()=>{tandaiRef.current=pantau?.tandai;});
  // Observer dibuat saat pertama dibutuhkan (callback ref kartu berjalan SEBELUM useEffect). Kartu yang lebih tinggi dari
  // layar dihitung terlihat bila >= 40% tinggi layar tampak.
  const dapatPengamat=()=>{
    if(pengamat.current||typeof IntersectionObserver==="undefined")return pengamat.current;
    const timers=timerLihat.current;
    pengamat.current=new IntersectionObserver(entri=>{
      for(const e of entri){
        const id=Number((e.target as HTMLElement).dataset.plId);
        if(!id)continue;
        const cukup=e.intersectionRatio>=0.5||e.intersectionRect.height>=window.innerHeight*0.4;
        if(e.isIntersecting&&cukup&&document.visibilityState==="visible"){
          if(!timers.has(id))timers.set(id,setTimeout(()=>{
            timers.delete(id);antreLihat.current.add(id);
            if(kirimLihat.current)clearTimeout(kirimLihat.current);
            kirimLihat.current=setTimeout(()=>{const ids=[...antreLihat.current];antreLihat.current.clear();tandaiRef.current?.(ids);},300);
          },2000));
        }else if(timers.has(id)){clearTimeout(timers.get(id));timers.delete(id);}
      }
    },{threshold:[0,0.25,0.5,0.75,1]});
    return pengamat.current;
  };
  useEffect(()=>()=>{
    const timers=timerLihat.current;
    pengamat.current?.disconnect();pengamat.current=null;
    timers.forEach(t=>clearTimeout(t));timers.clear();if(kirimLihat.current)clearTimeout(kirimLihat.current);
  },[]);
  const refKartu=(aktif:boolean)=>(el:HTMLDivElement|null)=>{
    const po=el?dapatPengamat():null;
    if(!el||!po)return;
    if(aktif)po.observe(el);else po.unobserve(el);
  };

  const divisiList=useMemo(()=>[...new Set(list.map(l=>l.divisi))],[list]);

  const q=search.trim().toLowerCase();
  // Urut aktivitas terakhir (dibuat / catatan / foto / status), terbaru di atas.
  const dalamMode=useMemo(()=>list.filter(l=>viewMode==="arsip"?!!l.is_archived:!l.is_archived)
    .sort((a,b)=>(Date.parse(aktivitasPL(b)||"")||0)-(Date.parse(aktivitasPL(a)||"")||0)||b.id-a.id),[list,viewMode]);
  const jmlHariIni=useMemo(()=>dalamMode.filter(l=>aktifHariIniPL(l)).length,[dalamMode]);
  const filtered=useMemo(()=>dalamMode.filter(l=>{
    if(filterDivisi!=="ALL"&&l.divisi!==filterDivisi)return false;
    if(filterStatus!=="ALL"&&l.status!==filterStatus)return false;
    if(hanyaHariIni&&!aktifHariIniPL(l))return false;
    if(q&&!(l.nama_lokasi||"").toLowerCase().includes(q)&&!(l.operator_nama||"").toLowerCase().includes(q))return false;
    return true;
  }),[dalamMode,filterDivisi,filterStatus,q,hanyaHariIni]);
  const adaFilter=filterDivisi!=="ALL"||filterStatus!=="ALL"||!!q||hanyaHariIni;

  const toggleArsip=async(l:any)=>{
    if(savingId!=null)return;
    const jadiArsip=!l.is_archived;
    setSavingId(l.id);
    // .select() biar update yang ditolak RLS (0 baris, tanpa error) ketahuan - jangan silent.
    const{data,error}=await supabase.from("proyek_luar" as any)
      .update({is_archived:jadiArsip,updated_at:new Date().toISOString()}).eq("id",l.id).select("id");
    setSavingId(null);
    if(error||!data||data.length===0){
      console.error("Gagal ubah arsip proyek_luar:",error||"0 baris terupdate");
      tampilToast("Gagal "+(jadiArsip?"mengarsipkan":"membatalkan arsip")+": "+(error?.message||"tidak ada data yang berubah"),true);
      return;
    }
    setList(prev=>prev.map(x=>x.id===l.id?{...x,is_archived:jadiArsip}:x));
    tampilToast(jadiArsip?`"${l.nama_lokasi}" diarsipkan`:`"${l.nama_lokasi}" dikembalikan ke Aktif`);
    let sess:any={};try{sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");}catch{}
    await activityLogService.insert({user_name:sess?.nama||"Admin",action:jadiArsip?"ARSIP PROYEK LUAR":"BATAL ARSIP PROYEK LUAR",
      description:(jadiArsip?"Arsipkan":"Batalkan arsip")+" laporan Proyek Luar: "+l.nama_lokasi+" ("+l.tanggal+", "+l.operator_nama+")",
      module:"proyek_luar",halaman:"Proyek Luar"});
  };

  const selStyle=(extra:any={})=>({padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:13,
    background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)",...extra});
  const tabBtn=(aktif:boolean)=>({padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,
    background:aktif?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:aktif?"#fff":"#64748b"});
  const kosong=(teks:string)=>(
    <div style={{padding:"28px 4px",color:"#94a3b8",fontSize:13,textAlign:"left"}}>{teks}</div>
  );

  return(
    <div className="fi" style={{textAlign:"left"}}>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama proyek / operator..."
          style={selStyle({flex:2,minWidth:200})}/>
        <select value={filterDivisi} onChange={e=>setFilterDivisi(e.target.value)} style={selStyle({cursor:"pointer"})}>
          <option value="ALL">Semua Divisi</option>
          {divisiList.map(d=>(<option key={d} value={d}>{(DIVISI_CONFIG as any)[d]?.label||d}</option>))}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle({cursor:"pointer"})}>
          <option value="ALL">Semua Status</option>
          <option value="berlangsung">Berlangsung</option>
          <option value="selesai">Selesai</option>
        </select>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setViewMode("aktif")} style={tabBtn(viewMode==="aktif")}>Aktif</button>
          <button onClick={()=>setViewMode("arsip")} style={tabBtn(viewMode==="arsip")}>🗄️ Arsip</button>
        </div>
        <button onClick={()=>setHanyaHariIni(x=>!x)} title="Laporan yang dibuat / catatan / foto / statusnya berubah pada hari kerja ini (07.00-06.59 WIB)"
          style={{...tabBtn(hanyaHariIni),background:hanyaHariIni?"#15803d":"var(--bg-secondary,#f1f5f9)"}}>Aktif hari ini ({jmlHariIni})</button>
      </div>

      {!loading&&!loadError&&(
        <div style={{fontSize:12.5,color:MUTED,marginBottom:12}}>
          <b style={{color:"var(--text-primary,#1e293b)"}}>{dalamMode.length}</b>{" "}
          {viewMode==="aktif"?"laporan outstanding — belum diarsipkan":"laporan diarsipkan"}
          {adaFilter&&<> · {filtered.length} cocok dengan filter</>}
        </div>
      )}

      {loading?kosong("Memuat data...")
      :loadError?(
        <div style={{padding:"12px 14px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",color:"#b91c1c",fontSize:13}}>
          ⚠ Gagal memuat laporan Proyek Luar ({loadError}).{" "}
          <button onClick={()=>fetchList()} style={{border:"none",background:"none",color:"#b91c1c",fontWeight:700,textDecoration:"underline",cursor:"pointer",padding:0}}>Coba lagi</button>
        </div>
      )
      :filtered.length===0?kosong(dalamMode.length===0
        ?(viewMode==="arsip"?"Belum ada laporan diarsipkan.":"Tidak ada laporan outstanding — semua sudah diarsipkan.")
        :"Tidak ada laporan yang cocok dengan filter.")
      :(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(l=>{
            const st=statusStyle[l.status]||statusStyle.berlangsung;
            const fotoList:any[]=Array.isArray(l.foto)?l.foto:[];
            const dc=(DIVISI_CONFIG as any)[l.divisi];
            const poin=poinCatatan(l.catatan);
            const sp=statusKartu(l), wp=sp?WARNA_PANTAU[sp]:null;
            const jejak=jejakUbahCatatanPL(l);
            return(
              <div key={l.id} data-pl-id={l.id} ref={refKartu(!!sp)}>
              <Card style={{padding:"14px 16px",textAlign:"left",...(wp?{background:wp.bg,border:`1px solid ${wp.border}`}:{})}}>
                {/* Baris atas: nama proyek | status + tanggal */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontWeight:700,fontSize:15,color:"var(--text-primary,#1e293b)",minWidth:0,flex:"1 1 220px",overflowWrap:"anywhere"}}>
                    {l.nama_lokasi}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {wp&&<span style={{background:"#fff",color:wp.fg,border:`1px solid ${wp.border}`,borderRadius:99,padding:"2px 8px",fontSize:10.5,fontWeight:800,letterSpacing:.4}}>{wp.label}</span>}
                    <span style={{background:st.bg,color:st.color,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700}}>{st.label}</span>
                    <span style={{fontSize:12,color:MUTED}}>{fmtTanggal(l.tanggal)}</span>
                  </div>
                </div>
                {/* Baris kedua: divisi | diperbarui */}
                <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",fontSize:12,color:MUTED,marginTop:3}}>
                  <span>{dc?.label||l.divisi}</span>
                  {aktivitasPL(l)&&<span title="Terakhir dibuat / catatan / foto / status berubah">Diperbarui {labelWaktuPL(aktivitasPL(l))}</span>}
                </div>

                <div style={{height:1,background:"var(--border-color,#e2e8f0)",margin:"12px 0"}}/>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:10.5,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",color:MUTED}}>Catatan Pekerjaan</span>
                  {bolehUbahCatatan&&editCat?.id!==l.id&&<button onClick={()=>setEditCat({id:l.id,teks:l.catatan||"",dasar:l.catatan??null})} style={{border:0,background:"none",padding:0,color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ubah catatan</button>}
                </div>
                {editCat?.id===l.id?(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <textarea value={editCat.teks} onChange={e=>setEditCat({id:l.id,teks:e.target.value,dasar:editCat.dasar})} rows={Math.min(14,Math.max(4,editCat.teks.split(/\r?\n/).length+1))}
                      style={{width:"100%",padding:10,borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:13,lineHeight:1.5,fontFamily:"inherit",resize:"vertical",color:"var(--text-primary,#1e293b)",background:"var(--card-bg,#fff)"}}/>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditCat(null)} disabled={simpanCat} style={{padding:"5px 12px",borderRadius:7,border:"1px solid var(--border-color,#e2e8f0)",background:"var(--card-bg,#fff)",color:"var(--text-secondary,#475569)",fontSize:12,fontWeight:600,cursor:"pointer"}}>Batal</button>
                      <button onClick={()=>simpanCatatan(l)} disabled={simpanCat} style={{padding:"5px 12px",borderRadius:7,border:0,background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:simpanCat?"wait":"pointer"}}>{simpanCat?"Menyimpan...":"Simpan catatan"}</button>
                    </div>
                  </div>
                ):poin.length===0?(
                  <div style={{fontSize:13,color:"#94a3b8"}}>Tidak ada catatan.</div>
                ):(
                  <ol style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:7}}>
                    {poin.map((p,i)=>(
                      <li key={i} style={{display:"flex",alignItems:"flex-start",gap:9}}>
                        <span style={{flexShrink:0,minWidth:20,height:20,borderRadius:5,background:"var(--bg-secondary,#f1f5f9)",
                          border:"1px solid var(--border-color,#e2e8f0)",color:MUTED,fontSize:11,fontWeight:700,
                          display:"inline-flex",alignItems:"center",justifyContent:"center",marginTop:1}}>{i+1}</span>
                        <span style={{fontSize:13,fontWeight:450,lineHeight:1.55,color:"var(--text-secondary,#334155)",overflowWrap:"anywhere"}}>{p}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {jejak&&editCat?.id!==l.id&&<div style={{fontSize:11,color:MUTED,marginTop:6}}>Diubah oleh {jejak.oleh} · {labelWaktuPL(jejak.pada)}</div>}

                {/* Foto dokumentasi */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,flexWrap:"wrap"}}>
                  {fotoList.length===0?(
                    <span style={{fontSize:12,color:"#94a3b8"}}>Belum ada foto dokumentasi.</span>
                  ):(<>
                    <div style={{display:"flex",gap:6}}>
                      {fotoList.slice(0,4).map((f:any,fi:number)=>(
                        <div key={fi} onClick={()=>setFotoViewer({fotos:fotoList,startIndex:fi,label:l.nama_lokasi})} title="Lihat foto"
                          style={{width:44,height:44,borderRadius:7,overflow:"hidden",cursor:"pointer",background:"#f1f5f9",
                            border:"1px solid var(--border-color,#e2e8f0)",position:"relative"}}>
                          <ThumbMedia url={f.url} thumb={f.thumb} video={isVideoFoto(f)}/>
                          {fi===3&&fotoList.length>4&&(
                            <div style={{position:"absolute",inset:0,background:"#0f172a99",color:"#fff",fontSize:12,fontWeight:700,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>+{fotoList.length-4}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <span style={{fontSize:12,color:MUTED}}>{fotoList.length} foto dokumentasi</span>
                  </>)}
                </div>

                {/* Baris bawah: operator | arsipkan */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:12}}>
                  <span style={{fontSize:12,color:MUTED,minWidth:0,overflowWrap:"anywhere"}}>👤 {l.operator_nama}</span>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>setWordAwal(l)} title="Unduh laporan proyek ini sebagai dokumen Word (.docx) yang bisa diedit"
                    style={{padding:"5px 12px",borderRadius:7,border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1d4ed8",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    Unduh Word
                  </button>
                  <button onClick={()=>toggleArsip(l)} disabled={savingId!=null}
                    style={{padding:"5px 12px",borderRadius:7,border:"1px solid var(--border-color,#e2e8f0)",background:"var(--card-bg,#fff)",
                      color:"var(--text-secondary,#475569)",fontSize:12,fontWeight:600,flexShrink:0,
                      cursor:savingId!=null?"not-allowed":"pointer",opacity:savingId!=null&&savingId!==l.id?.5:1}}>
                    {savingId===l.id?"Menyimpan...":l.is_archived?"Batalkan Arsip":"Arsipkan"}
                  </button>
                  </div>
                </div>
              </Card>
              </div>
            );
          })}
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:1000,maxWidth:"calc(100vw - 32px)",
          background:toast.error?"#b91c1c":"#1e293b",color:"#fff",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:600,
          boxShadow:"0 6px 20px #0003",textAlign:"left"}}>
          {toast.msg}
        </div>
      )}

      {wordAwal&&<UnduhWordProyekLuar awal={wordAwal} semua={list} onClose={()=>setWordAwal(null)}/>}
      {fotoViewer&&<FotoZoomViewer fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
    </div>
  );
}
