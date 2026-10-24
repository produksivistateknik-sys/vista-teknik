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
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { laporError } from '../lib/laporError'
import { hariKerjaWib } from '../lib/tanggalWib'
import type { RecordPL } from '../lib/laporanProyekLuarDocx'
import { aktivitasPL, aktifHariIniPL, statusPantauPL, labelWaktuPL, jejakUbahCatatanPL, bentrokCatatanPL, poinCatatanPL, entriAktifPL, adaEntriHariIniPL } from '../lib/proyekLuarPantau'

// ─────────────────────────────────────────────────────────────────────────────
// PROYEK LUAR (30 Agu 2026) - sidebar tab sendiri - laporan/dokumentasi pekerjaan operator di
// proyek eksternal, input dari Vista Pekerja (ProyekLuarView.tsx), tabel `proyek_luar` (migration
// 20260830010000_create_proyek_luar.sql, is_archived dari 20260831010000).
//
// Desain ulang (28 Sep 2026, preview disetujui user): daftar "outstanding" (belum diarsipkan)
// TAMPIL LANGSUNG. Search/Divisi/Status jadi filter TAMBAHAN. Toggle Aktif/Arsip memisah is_archived.
// Admin bisa Arsipkan/Batalkan Arsip per proyek.
//
// Pantau harian (24 Okt 2026): urut aktivitas terakhir (aktivitas_pada), "Diperbarui HH:MM", filter "Aktif hari ini" (hari
// kerja WIB), penanda BARU HARI INI (hijau) / DIPERBARUI (kuning) per admin - hilang setelah kartu terlihat 2 detik
// (tandai_proyek_luar_dilihat). Dimuat ulang saat ringkasan pantau berubah (hooks/useProyekLuarPantau, pemulih realtime).
//
// MULTI-HARI (25 Okt 2026, migration 20261025010000, keputusan user): kartu = PROYEK (proyek_luar), isinya ENTRI per hari
// (proyek_luar_entri: tanggal, penulis, catatan, foto). "Belum ada laporan hari ini" utk proyek Berlangsung tanpa entri hari
// kerja ini. Admin: ubah catatan entri (cek bentrok), Selesai / buka kembali, ubah nama & lokasi, hapus lunak & pulihkan
// (proyek / entri) - semua lewat RPC (jejak di proyek_luar_aksi_log). Catatan ditampilkan per baris, nomor yang diketik
// operator dibuang (poinCatatanPL - sama dgn Word). Arsip tetap per proyek (tulis langsung, spt sebelumnya).
// ─────────────────────────────────────────────────────────────────────────────

const statusStyle:Record<string,{bg:string;color:string;label:string}>={
  berlangsung:{bg:"#fff7ed",color:"#c2410c",label:"Berlangsung"},
  selesai:{bg:"#f0fdf4",color:"#15803d",label:"Selesai"},
};
const MUTED="var(--text-muted,#64748b)";
const WARNA_PANTAU={baru:{bg:"#ecfdf5",border:"#86efac",fg:"#15803d",label:"BARU HARI INI"},diperbarui:{bg:"#fefce8",border:"#fde047",fg:"#a16207",label:"DIPERBARUI"}} as const;
const HARI_TAMPIL=3; // entri yang tampil sebelum "Tampilkan semua"

const fmtTanggal=(t:string)=>{
  if(!t)return"-";
  const d=new Date(t+"T00:00:00");
  return isNaN(d.getTime())?t:d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
};
const fmtTanggalHari=(t:string)=>{
  const d=new Date(t+"T00:00:00");
  return isNaN(d.getTime())?t:d.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
};

export function ProyekLuarTab({pantau}:{pantau?:PantauProyekLuar}={}){
  const[loading,setLoading]=useState(true);
  const[loadError,setLoadError]=useState<string|null>(null);
  const[list,setList]=useState<any[]>([]);
  const[entriSemua,setEntriSemua]=useState<any[]>([]);
  const[filterDivisi,setFilterDivisi]=useState("ALL");
  const[filterStatus,setFilterStatus]=useState("ALL");
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip"|"dihapus">("aktif");
  const[hanyaHariIni,setHanyaHariIni]=useState(false);
  const[savingId,setSavingId]=useState<number|null>(null);
  const[sibuk,setSibuk]=useState(false);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewer[],startIndex:number,label:string}|null>(null);
  const[wordAwal,setWordAwal]=useState<RecordPL|null>(null);
  const[semuaHari,setSemuaHari]=useState<Set<number>>(new Set());
  const[lihatDihapus,setLihatDihapus]=useState<Set<number>>(new Set());
  const sesiAdmin=(()=>{try{return JSON.parse(localStorage.getItem("vista_admin_session")||"{}")}catch{return{}}})();
  const bolehUbah=sesiAdmin?.divisi==="admin";
  const oleh=String(sesiAdmin?.nama||sesiAdmin?.name||"Admin").trim();
  const[editCat,setEditCat]=useState<{id:number;teks:string;dasar:string|null}|null>(null);
  const[editInfo,setEditInfo]=useState<{id:number;nama:string;lokasi:string}|null>(null);
  const[toast,setToast]=useState<{msg:string;error?:boolean}|null>(null);
  const toastTimer=useRef<any>(null);
  const tampilToast=(msg:string,error=false)=>{
    setToast({msg,error});
    if(toastTimer.current)clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(()=>setToast(null),4000);
  };

  // silent: dipakai pemuat ulang (pantau) biar list gak "berkedip". Paginasi eksplisit (fetchAllPaged, .order + .range).
  const fetchList=async(silent=false)=>{
    if(!silent)setLoading(true);
    try{
      const[p,e]=await Promise.all([
        fetchAllPaged((a,z)=>supabase.from("proyek_luar" as any).select("*").order("id").range(a,z)),
        fetchAllPaged((a,z)=>supabase.from("proyek_luar_entri" as any).select("*").order("id").range(a,z)),
      ]);
      setList(p);setEntriSemua(e);setLoadError(null);
    }catch(err:any){
      console.error("Gagal memuat proyek_luar / entri:",err);
      setLoadError(err?.message||String(err));
    }finally{if(!silent)setLoading(false);}
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
  // Ringkasan pantau berubah (entri berubah -> trigger menaikkan aktivitas/updated_at proyek) -> muat ulang data lengkap.
  const tandaTerakhir=useRef<string|null>(null);
  useEffect(()=>{
    if(!pantau?.tanda)return;
    if(tandaTerakhir.current===null){tandaTerakhir.current=pantau.tanda;return;}
    if(tandaTerakhir.current===pantau.tanda)return;
    tandaTerakhir.current=pantau.tanda;
    fetchList(true);
  },[pantau?.tanda]);

  // Penanda hilang setelah kartu terlihat (>= 50%, atau >= 40% tinggi layar utk kartu tinggi) selama 2 detik.
  const statusKartu=(l:any)=>pantau?.penanda?statusPantauPL(l,pantau.dilihat.get(Number(l.id))):null;
  const pengamat=useRef<IntersectionObserver|null>(null);
  const timerLihat=useRef<Map<number,any>>(new Map());
  const antreLihat=useRef<Set<number>>(new Set());
  const kirimLihat=useRef<any>(null);
  const tandaiRef=useRef(pantau?.tandai);
  useEffect(()=>{tandaiRef.current=pantau?.tandai;});
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

  // ── data turunan ──
  const entriPer=useMemo(()=>{
    const m=new Map<number,any[]>();
    for(const e of entriSemua){const k=Number(e.proyek_id);if(!m.has(k))m.set(k,[]);m.get(k)!.push(e);}
    return m;
  },[entriSemua]);
  const divisiList=useMemo(()=>[...new Set(list.map(l=>l.divisi))],[list]);
  const q=search.trim().toLowerCase();
  const dalamMode=useMemo(()=>list.filter(l=>viewMode==="dihapus"?!!l.dihapus_pada:!l.dihapus_pada&&(viewMode==="arsip"?!!l.is_archived:!l.is_archived))
    .sort((a,b)=>(Date.parse(aktivitasPL(b)||"")||0)-(Date.parse(aktivitasPL(a)||"")||0)||b.id-a.id),[list,viewMode]);
  const jmlHariIni=useMemo(()=>dalamMode.filter(l=>aktifHariIniPL(l)).length,[dalamMode]);
  const jmlKosongHariIni=useMemo(()=>dalamMode.filter(l=>l.status==="berlangsung"&&!adaEntriHariIniPL(entriPer.get(Number(l.id)))).length,[dalamMode,entriPer]);
  const filtered=useMemo(()=>dalamMode.filter(l=>{
    if(filterDivisi!=="ALL"&&l.divisi!==filterDivisi)return false;
    if(filterStatus!=="ALL"&&l.status!==filterStatus)return false;
    if(hanyaHariIni&&!aktifHariIniPL(l))return false;
    if(q){
      const operator=(entriPer.get(Number(l.id))||[]).map(e=>e.operator_nama||"").join(" ");
      if(!`${l.nama_lokasi||""} ${l.lokasi||""} ${l.operator_nama||""} ${operator}`.toLowerCase().includes(q))return false;
    }
    return true;
  }),[dalamMode,filterDivisi,filterStatus,q,hanyaHariIni,entriPer]);
  const adaFilter=filterDivisi!=="ALL"||filterStatus!=="ALL"||!!q||hanyaHariIni;
  // Word: satu record = satu entri hari (proyek tidak dihapus).
  const recordWord=useMemo(()=>list.filter(p=>!p.dihapus_pada).flatMap(p=>entriAktifPL(entriPer.get(Number(p.id))).map((e):RecordPL=>({
    id:Number(e.id),proyek_id:Number(p.id),nama_lokasi:p.nama_lokasi,lokasi:p.lokasi,tanggal:e.tanggal,catatan:e.catatan,status:p.status,
    operator_nama:e.operator_nama,divisi:e.divisi,foto:Array.isArray(e.foto)?e.foto:[]}))),[list,entriPer]);

  // ── aksi (semua RPC dicek error) ──
  const rpc=async(fn:string,args:any,apa:string)=>{
    const{data,error}=await supabase.rpc(fn as any,args);
    if(error){console.error(`[Proyek Luar] ${apa} gagal:`,error);laporError("supabase_error",error,{aksi:apa});throw error;}
    return data as any;
  };
  const jalankan=async(apa:string,kerja:()=>Promise<any>,berhasil:string)=>{
    if(sibuk)return;
    setSibuk(true);
    try{await kerja();tampilToast(berhasil);await fetchList(true);}
    catch(err:any){tampilToast(`Gagal ${apa}: ${err?.message||err}`,true);}
    finally{setSibuk(false);}
  };
  const simpanCatatan=async(e:any)=>{
    if(!editCat||sibuk)return;
    setSibuk(true);
    try{
      const{data,error}=await supabase.rpc("ubah_catatan_entri_proyek_luar" as any,{p_entri_id:e.id,p_catatan:editCat.teks,p_oleh:oleh,p_pekerja_id:null,p_admin:true,p_dasar:editCat.dasar,p_cek_dasar:true} as any);
      if(error&&bentrokCatatanPL(error)){
        const{data:baru,error:e2}=await supabase.from("proyek_luar_entri" as any).select("*").eq("id",e.id).range(0,0);
        if(e2)throw e2;
        const r:any=(baru as any)?.[0];
        if(r){setEntriSemua(prev=>prev.map(x=>x.id===e.id?r:x));setEditCat({id:e.id,teks:editCat.teks,dasar:r.catatan??null});}
        tampilToast(`Catatan baru saja diubah ${r?.catatan_diubah_oleh||"orang lain"}. Tulisan Anda masih di kotak - periksa versi terbaru, lalu tekan Simpan lagi untuk menimpa.`,true);
        return;
      }
      if(error)throw error;
      setEntriSemua(prev=>prev.map(x=>x.id===e.id?{...x,...(data as any)}:x));
      setEditCat(null);tampilToast("Catatan tersimpan");
      pantau?.tandai([Number(e.proyek_id)]); // perubahan sendiri tidak perlu menyala
    }catch(err:any){
      console.error("[Proyek Luar] simpan catatan gagal:",err);
      tampilToast("Gagal menyimpan catatan: "+(err?.message||err),true);
    }finally{setSibuk(false);}
  };
  const ubahStatus=(l:any,status:"selesai"|"berlangsung")=>jalankan(status==="selesai"?"menandai Selesai":"membuka kembali",
    async()=>{await rpc("ubah_status_proyek_luar",{p_proyek_id:l.id,p_status:status,p_oleh:oleh,p_pekerja_id:null,p_admin:true},"ubah status proyek luar");pantau?.tandai([l.id]);},
    status==="selesai"?`"${l.nama_lokasi}" ditandai Selesai`:`"${l.nama_lokasi}" dibuka kembali`);
  const hapusEntri=(e:any)=>{
    if(!confirm(`Hapus entri ${fmtTanggal(e.tanggal)} oleh ${e.operator_nama}?\n\nEntri disembunyikan (bisa dipulihkan), foto tidak dihapus dari penyimpanan.`))return;
    jalankan("menghapus entri",()=>rpc("hapus_entri_proyek_luar",{p_entri_id:e.id,p_oleh:oleh,p_pekerja_id:null,p_admin:true},"hapus entri proyek luar"),"Entri dihapus");
  };
  const hapusProyek=(l:any)=>{
    if(!confirm(`Hapus proyek "${l.nama_lokasi}"?\n\nProyek pindah ke tampilan "Dihapus" dan bisa dipulihkan.`))return;
    jalankan("menghapus proyek",()=>rpc("hapus_proyek_luar",{p_proyek_id:l.id,p_oleh:oleh,p_pekerja_id:null,p_admin:true},"hapus proyek luar"),`"${l.nama_lokasi}" dihapus`);
  };
  const pulihkan=(proyekId:number,entriId:number|null)=>jalankan("memulihkan",
    ()=>rpc("pulihkan_proyek_luar",{p_proyek_id:proyekId,p_entri_id:entriId,p_oleh:oleh},"pulihkan proyek luar"),entriId?"Entri dipulihkan":"Proyek dipulihkan");
  const simpanInfo=()=>{
    if(!editInfo)return;
    const ei=editInfo;
    jalankan("mengubah nama/lokasi",async()=>{await rpc("ubah_info_proyek_luar",{p_proyek_id:ei.id,p_nama:ei.nama,p_lokasi:ei.lokasi,p_oleh:oleh},"ubah info proyek luar");setEditInfo(null);},"Nama & lokasi tersimpan");
  };
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
    await activityLogService.insert({user_name:oleh,action:jadiArsip?"ARSIP PROYEK LUAR":"BATAL ARSIP PROYEK LUAR",
      description:(jadiArsip?"Arsipkan":"Batalkan arsip")+" Proyek Luar: "+l.nama_lokasi+" ("+l.lokasi+")",
      module:"proyek_luar",halaman:"Proyek Luar"}); // gagal dicatat di console oleh service
  };

  const selStyle=(extra:any={})=>({padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:13,
    background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)",...extra});
  const tabBtn=(aktif:boolean)=>({padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,
    background:aktif?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:aktif?"#fff":"#64748b"});
  const tombolKecil=(warna="#475569",latar="var(--card-bg,#fff)",garis="var(--border-color,#e2e8f0)")=>({padding:"5px 12px",borderRadius:7,border:`1px solid ${garis}`,
    background:latar,color:warna,fontSize:12,fontWeight:700,cursor:sibuk?"wait":"pointer",flexShrink:0});
  const kosong=(teks:string)=>(<div style={{padding:"28px 4px",color:"#94a3b8",fontSize:13,textAlign:"left"}}>{teks}</div>);
  const hk=hariKerjaWib();

  const blokEntri=(l:any,e:any)=>{
    const fotoList:any[]=Array.isArray(e.foto)?e.foto:[];
    const poin=poinCatatanPL(e.catatan);
    const jejak=jejakUbahCatatanPL(e);
    const dc=(DIVISI_CONFIG as any)[e.divisi];
    return(
      <div key={e.id} style={{borderTop:"1px solid var(--border-color,#e2e8f0)",paddingTop:10,marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:13,color:"var(--text-primary,#1e293b)"}}>{fmtTanggalHari(e.tanggal)}{e.tanggal===hk&&<span style={{marginLeft:6,fontSize:10.5,fontWeight:800,color:"#15803d"}}>HARI INI</span>}</span>
          <span style={{fontSize:11.5,color:MUTED}}>👤 {e.operator_nama} ({dc?.label||e.divisi}) · Diperbarui {labelWaktuPL(e.aktivitas_pada)}</span>
        </div>
        {editCat?.id===e.id?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <textarea value={editCat.teks} onChange={ev=>setEditCat({id:e.id,teks:ev.target.value,dasar:editCat.dasar})} rows={Math.min(14,Math.max(4,editCat.teks.split(/\r?\n/).length+1))}
              style={{width:"100%",padding:10,borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:13,lineHeight:1.5,fontFamily:"inherit",resize:"vertical",color:"var(--text-primary,#1e293b)",background:"var(--card-bg,#fff)"}}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditCat(null)} disabled={sibuk} style={tombolKecil()}>Batal</button>
              <button onClick={()=>simpanCatatan(e)} disabled={sibuk} style={tombolKecil("#fff","#1d4ed8","#1d4ed8")}>{sibuk?"Menyimpan...":"Simpan catatan"}</button>
            </div>
          </div>
        ):poin.length===0?(
          <div style={{fontSize:13,color:"#94a3b8"}}>Belum ada catatan.</div>
        ):(
          <ol style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:6}}>
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
        {jejak&&editCat?.id!==e.id&&<div style={{fontSize:11,color:MUTED,marginTop:6}}>Diubah oleh {jejak.oleh} · {labelWaktuPL(jejak.pada)}</div>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:8,flexWrap:"wrap"}}>
          {fotoList.length===0?<span style={{fontSize:12,color:"#94a3b8"}}>Belum ada foto.</span>:(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{display:"flex",gap:6}}>
                {fotoList.slice(0,4).map((f:any,fi:number)=>(
                  <div key={f.url||fi} onClick={()=>setFotoViewer({fotos:fotoList,startIndex:fi,label:`${l.nama_lokasi} · ${fmtTanggal(e.tanggal)}`})} title="Lihat foto"
                    style={{width:44,height:44,borderRadius:7,overflow:"hidden",cursor:"pointer",background:"#f1f5f9",border:"1px solid var(--border-color,#e2e8f0)",position:"relative"}}>
                    <ThumbMedia url={f.url} thumb={f.thumb} video={isVideoFoto(f)}/>
                    {fi===3&&fotoList.length>4&&(<div style={{position:"absolute",inset:0,background:"#0f172a99",color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+{fotoList.length-4}</div>)}
                  </div>
                ))}
              </div>
              <span style={{fontSize:12,color:MUTED}}>{fotoList.length} foto</span>
            </div>
          )}
          {bolehUbah&&editCat?.id!==e.id&&(
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setEditCat({id:e.id,teks:e.catatan||"",dasar:e.catatan??null})} style={{border:0,background:"none",padding:0,color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ubah catatan</button>
              <button onClick={()=>hapusEntri(e)} disabled={sibuk} style={{border:0,background:"none",padding:0,color:"#b91c1c",fontSize:12,fontWeight:600,cursor:"pointer"}}>Hapus entri</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return(
    <div className="fi" style={{textAlign:"left"}}>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama proyek / lokasi / operator..."
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
          {bolehUbah&&<button onClick={()=>setViewMode("dihapus")} style={tabBtn(viewMode==="dihapus")}>🗑 Dihapus</button>}
        </div>
        <button onClick={()=>setHanyaHariIni(x=>!x)} title="Proyek yang entri / catatan / foto / statusnya berubah pada hari kerja ini (07.00-06.59 WIB)"
          style={{...tabBtn(hanyaHariIni),background:hanyaHariIni?"#15803d":"var(--bg-secondary,#f1f5f9)"}}>Aktif hari ini ({jmlHariIni})</button>
      </div>

      {!loading&&!loadError&&(
        <div style={{fontSize:12.5,color:MUTED,marginBottom:12}}>
          <b style={{color:"var(--text-primary,#1e293b)"}}>{dalamMode.length}</b>{" "}
          {viewMode==="aktif"?"proyek outstanding — belum diarsipkan":viewMode==="arsip"?"proyek diarsipkan":"proyek dihapus (bisa dipulihkan)"}
          {viewMode!=="dihapus"&&<> · <b style={{color:"#15803d"}}>{jmlHariIni}</b> aktif hari ini{jmlKosongHariIni>0&&<> · {jmlKosongHariIni} Berlangsung belum ada laporan hari ini</>}</>}
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
        ?(viewMode==="arsip"?"Belum ada proyek diarsipkan.":viewMode==="dihapus"?"Tidak ada proyek yang dihapus.":"Tidak ada proyek outstanding — semua sudah diarsipkan.")
        :"Tidak ada proyek yang cocok dengan filter.")
      :(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(l=>{
            const st=statusStyle[l.status]||statusStyle.berlangsung;
            const dc=(DIVISI_CONFIG as any)[l.divisi];
            const semuaE=entriPer.get(Number(l.id))||[];
            const aktifE=entriAktifPL(semuaE);
            const dihapusE=semuaE.filter(e=>e.dihapus_pada);
            const tgl=aktifE.map(e=>e.tanggal).sort();
            const rentang=tgl.length?(tgl[0]===tgl[tgl.length-1]?fmtTanggal(tgl[0]):`${fmtTanggal(tgl[0])} – ${fmtTanggal(tgl[tgl.length-1])}`):fmtTanggal(l.tanggal);
            const jmlFoto=aktifE.reduce((n,e)=>n+(Array.isArray(e.foto)?e.foto.length:0),0);
            const tampilE=semuaHari.has(l.id)?aktifE:aktifE.slice(0,HARI_TAMPIL);
            const sp=statusKartu(l), wp=sp?WARNA_PANTAU[sp]:null;
            const kosongHariIni=l.status==="berlangsung"&&!l.dihapus_pada&&!aktifE.some(e=>e.tanggal===hk);
            return(
              <div key={l.id} data-pl-id={l.id} ref={refKartu(!!sp)}>
              <Card style={{padding:"14px 16px",textAlign:"left",...(wp?{background:wp.bg,border:`1px solid ${wp.border}`}:{})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  {editInfo?.id===l.id?(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:"1 1 320px"}}>
                      <input value={editInfo.nama} onChange={e=>setEditInfo({...editInfo,nama:e.target.value})} placeholder="Nama proyek" style={selStyle({flex:"1 1 160px",padding:"6px 10px"})}/>
                      <input value={editInfo.lokasi} onChange={e=>setEditInfo({...editInfo,lokasi:e.target.value})} placeholder="Lokasi" style={selStyle({flex:"1 1 160px",padding:"6px 10px"})}/>
                      <button onClick={()=>setEditInfo(null)} style={tombolKecil()}>Batal</button>
                      <button onClick={simpanInfo} disabled={sibuk} style={tombolKecil("#fff","#1d4ed8","#1d4ed8")}>Simpan</button>
                    </div>
                  ):(
                    <div style={{minWidth:0,flex:"1 1 220px"}}>
                      <div style={{fontWeight:700,fontSize:15,color:"var(--text-primary,#1e293b)",overflowWrap:"anywhere"}}>
                        {l.nama_lokasi}
                        {bolehUbah&&!l.dihapus_pada&&<button onClick={()=>setEditInfo({id:l.id,nama:l.nama_lokasi||"",lokasi:l.lokasi||""})} title="Ubah nama & lokasi" style={{border:0,background:"none",color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer",marginLeft:6}}>ubah</button>}
                      </div>
                      <div style={{fontSize:12,color:MUTED,marginTop:2}}>📍 {l.lokasi||l.nama_lokasi} · {dc?.label||l.divisi}</div>
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {wp&&<span style={{background:"#fff",color:wp.fg,border:`1px solid ${wp.border}`,borderRadius:99,padding:"2px 8px",fontSize:10.5,fontWeight:800,letterSpacing:.4}}>{wp.label}</span>}
                      {l.dihapus_pada&&<span style={{background:"#fef2f2",color:"#b91c1c",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700}}>Dihapus</span>}
                      <span style={{background:st.bg,color:st.color,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700}}>{st.label}</span>
                    </div>
                    <span style={{fontSize:12,color:MUTED}}>{rentang} · {aktifE.length} hari · {jmlFoto} foto</span>
                    {aktivitasPL(l)&&<span style={{fontSize:12,color:MUTED}} title="Terakhir ada entri / catatan / foto / status berubah">Diperbarui {labelWaktuPL(aktivitasPL(l))}</span>}
                  </div>
                </div>
                <div style={{fontSize:11.5,color:MUTED,marginTop:4}}>
                  Dibuat oleh {l.dibuat_oleh||l.operator_nama}
                  {l.status==="selesai"&&l.selesai_oleh&&<> · Selesai oleh {l.selesai_oleh}{l.selesai_pada?` (${labelWaktuPL(l.selesai_pada)})`:""}</>}
                  {l.dihapus_pada&&<> · Dihapus oleh {l.dihapus_oleh} ({labelWaktuPL(l.dihapus_pada)})</>}
                </div>

                {kosongHariIni&&<div style={{marginTop:10,fontSize:12,color:"#b45309",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"6px 10px"}}>Belum ada laporan hari ini ({fmtTanggal(hk)}).</div>}
                {aktifE.length===0&&!kosongHariIni&&<div style={{marginTop:10,fontSize:12.5,color:"#94a3b8"}}>Belum ada entri.</div>}
                {tampilE.map(e=>blokEntri(l,e))}
                {aktifE.length>HARI_TAMPIL&&(
                  <button onClick={()=>setSemuaHari(s=>{const n=new Set(s);if(n.has(l.id))n.delete(l.id);else n.add(l.id);return n;})}
                    style={{marginTop:10,border:0,background:"none",padding:0,color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    {semuaHari.has(l.id)?"Tampilkan 3 hari terakhir saja":`Tampilkan semua ${aktifE.length} hari`}
                  </button>
                )}
                {bolehUbah&&dihapusE.length>0&&(
                  <div style={{marginTop:10}}>
                    <button onClick={()=>setLihatDihapus(s=>{const n=new Set(s);if(n.has(l.id))n.delete(l.id);else n.add(l.id);return n;})}
                      style={{border:0,background:"none",padding:0,color:MUTED,fontSize:12,fontWeight:600,cursor:"pointer"}}>🗑 {dihapusE.length} entri dihapus {lihatDihapus.has(l.id)?"▲":"▼"}</button>
                    {lihatDihapus.has(l.id)&&dihapusE.map(e=>(
                      <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:12,color:MUTED,marginTop:6}}>
                        <span>{fmtTanggal(e.tanggal)} · {e.operator_nama} · dihapus {e.dihapus_oleh} ({labelWaktuPL(e.dihapus_pada)})</span>
                        <button onClick={()=>pulihkan(l.id,e.id)} disabled={sibuk} style={tombolKecil("#1d4ed8")}>Pulihkan</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6,marginTop:12,flexWrap:"wrap"}}>
                  {l.dihapus_pada?(
                    bolehUbah&&<button onClick={()=>pulihkan(l.id,null)} disabled={sibuk} style={tombolKecil("#1d4ed8","#eff6ff","#bfdbfe")}>Pulihkan proyek</button>
                  ):(<>
                    <button onClick={()=>{const r=recordWord.find(x=>x.proyek_id===l.id);if(r)setWordAwal(r);}} disabled={!aktifE.length}
                      title={aktifE.length?"Unduh laporan proyek ini sebagai dokumen Word (.docx) yang bisa diedit":"Belum ada entri"}
                      style={{...tombolKecil("#1d4ed8","#eff6ff","#bfdbfe"),opacity:aktifE.length?1:.5}}>Unduh Word</button>
                    {bolehUbah&&(l.status==="berlangsung"
                      ?<button onClick={()=>ubahStatus(l,"selesai")} disabled={sibuk} style={tombolKecil("#15803d","#f0fdf4","#bbf7d0")}>Tandai Selesai</button>
                      :<button onClick={()=>ubahStatus(l,"berlangsung")} disabled={sibuk} style={tombolKecil("#c2410c","#fff7ed","#fed7aa")}>Buka kembali</button>)}
                    <button onClick={()=>toggleArsip(l)} disabled={savingId!=null} style={{...tombolKecil(),opacity:savingId!=null&&savingId!==l.id?.5:1}}>
                      {savingId===l.id?"Menyimpan...":l.is_archived?"Batalkan Arsip":"Arsipkan"}
                    </button>
                    {bolehUbah&&<button onClick={()=>hapusProyek(l)} disabled={sibuk} style={tombolKecil("#b91c1c","#fff","#fecaca")}>Hapus</button>}
                  </>)}
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

      {wordAwal&&<UnduhWordProyekLuar awal={wordAwal} semua={recordWord} onClose={()=>setWordAwal(null)}/>}
      {fotoViewer&&<FotoZoomViewer fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
    </div>
  );
}
