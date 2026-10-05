import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { getLocalDateStr } from '../lib/dateHelpers'
import { simpanSelesaiMaintenanceRutin, unggahFotoKeLogMaintenance, BATAS_VIDEO_MB, type FotoGagal } from '../lib/maintenanceRutinSelesai'
import { fetchRotasiBatch, rotateMedia } from '../lib/mediaRotasi'
import { Card, Lbl, Sel, Inp, Btn, Modal } from './ui/Primitives'
import { FotoZoomViewer, fotoMaintenanceKeViewer, type FotoViewer } from './FotoZoomViewer'
import { DIVISI_CONFIG } from '../constants/panelTypes'
import { bandingDivisiProduksi, DIVISI_KOSONG } from '../lib/urutanDivisi'

// Dokumentasi foto/video "Done" (16 Sep 2026, fitur baru) - OPSIONAL, cermin dari pola sama
// persis yang dipakai MesinPublic.tsx (form "Tandai Selesai" via QR) supaya baris histori
// maintenance_rutin_log konsisten strukturnya ({url,type,uploaded_at}) gak peduli lewat admin
// atau QR - lihat komentar lebih lengkap di MesinPublic.tsx soal kenapa diduplikasi kecil
// (bukan di-share) di 2 tempat.
const MAX_FOTO_MB=100;
// Upload & urutan simpan sekarang di lib/maintenanceRutinSelesai.ts (5 Okt 2026, dipakai bareng QR).

export function MaintenanceRutinTab({mesinList,rutinList,setRutinList,rutinLogList,user,today,terlambat,mingguIni}:any){
  const [form,setForm]=useState({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const [doneId,setDoneId]=useState<any>(null);
  const [filterFrek,setFilterFrek]=useState("ALL");
  // File dokumentasi yang distaged buat modal "Done" yang lagi kebuka (doneId) - direset tiap
  // modal dibuka/ditutup/berhasil submit.
  const [stagedFoto,setStagedFoto]=useState<{file:File,previewUrl:string}[]>([]);
  const [doneSaving,setDoneSaving]=useState(false);
  // Status unggah dokumentasi setelah "Selesai" tersimpan (5 Okt 2026) - lihat lib/maintenanceRutinSelesai.ts.
  const [unggahDone,setUnggahDone]=useState<{logId:number;rutinId:number;terkirim:number;total:number;gagal:FotoGagal[];berjalan:boolean}|null>(null);
  useEffect(()=>{
    if(!unggahDone?.berjalan)return;
    const cegah=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="Foto masih diunggah - yakin tinggalkan halaman?";return e.returnValue;};
    window.addEventListener("beforeunload",cegah);
    return()=>window.removeEventListener("beforeunload",cegah);
  },[unggahDone?.berjalan]);
  // Accordion histori dokumentasi (17 Sep 2026, Phase A - lihat Phase B: kolom
  // maintenance_rutin_log.foto). rutinLogList SUDAH di-fetch penuh di parent
  // (MaintenancePageTab.tsx) + auto-refresh via realtime tiap ada INSERT/UPDATE
  // maintenance_rutin_log - jadi expand di sini MURNI filter di memori, TIDAK ada
  // query baru. Data kecil (dicek live 16 Sep: 9 jadwal aktif, cuma 15 log total,
  // rata-rata 3/jadwal, maks 5) - gak perlu pagination/scroll internal.
  const [expandedIds,setExpandedIds]=useState<Set<number>>(new Set());
  const toggleExpand=(id:number)=>setExpandedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});

  // Rotate PERMANEN thumbnail dokumentasi (17 Sep 2026) - metadata rotasi_derajat per-URL
  // (media_rotasi), file R2 TIDAK diubah - lihat lib/mediaRotasi.ts & migration
  // 20260917030000_media_rotasi.sql. rutinLogList kecil (lihat komentar di atas) - fetch batch
  // 1x tiap data berubah, bukan per-thumbnail.
  const [rotasiMap,setRotasiMap]=useState<Record<string,number>>({});
  useEffect(()=>{
    const urls=(rutinLogList||[]).flatMap((l:any)=>(l.foto||[]).map((f:any)=>f.url));
    fetchRotasiBatch(urls).then(setRotasiMap);
  },[rutinLogList]);
  const [rotatingUrl,setRotatingUrl]=useState<string|null>(null);
  // Klik thumbnail dokumentasi -> FotoZoomViewer (sama dgn QC: zoom, prev/next, Download), bukan tab baru.
  const [fotoViewer,setFotoViewer]=useState<{fotos:FotoViewer[],startIndex:number,label:string}|null>(null);
  const doRotateThumb=async(e:any,url:string)=>{
    e.preventDefault();e.stopPropagation();
    if(rotatingUrl)return;
    setRotatingUrl(url);
    try{
      const next=await rotateMedia(url,rotasiMap[url]||0,user?.nama||user?.name||"Admin");
      setRotasiMap(prev=>({...prev,[url]:next}));
    }catch{alert("Gagal menyimpan rotasi - coba lagi.");}
    finally{setRotatingUrl(null);}
  };
  const pilihFoto=(fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const tolak:string[]=[];
    const dipilih=Array.from(fileList).filter(f=>{
      const batas=f.type.startsWith("video/")?BATAS_VIDEO_MB:MAX_FOTO_MB;
      if(f.size>batas*1024*1024){tolak.push(f.name+" ("+(f.size/1024/1024).toFixed(0)+" MB, maks "+batas+" MB)");return false;}
      return true;
    }).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    if(tolak.length>0)alert(`File berikut dilewati karena terlalu besar:\n${tolak.join("\n")}`);
    setStagedFoto(prev=>[...prev,...dipilih]);
  };
  const batalkanFotoStaged=(idx:number)=>{
    setStagedFoto(prev=>{const arr=[...prev];URL.revokeObjectURL(arr[idx]?.previewUrl);arr.splice(idx,1);return arr;});
  };
  const resetStagedFoto=()=>{
    stagedFoto.forEach(s=>URL.revokeObjectURL(s.previewUrl));
    setStagedFoto([]);
  };
  const FC:any={harian:{label:"Harian",bg:"#E6F1FB",color:"#0C447C",border:"#85B7EB"},mingguan:{label:"Mingguan",bg:"#EEEDFE",color:"#3C3489",border:"#AFA9EC"},bulanan:{label:"Bulanan",bg:"#E1F5EE",color:"#085041",border:"#5DCAA5"},"3bulan":{label:"3 Bulanan",bg:"#FAEEDA",color:"#633806",border:"#EF9F27"},tahunan:{label:"Tahunan",bg:"#FCEBEB",color:"#791F1F",border:"#F09595"}};
  const calcNext=(d:string,f:string)=>{if(!d)return"";const dt=new Date(d);if(f==="harian")dt.setDate(dt.getDate()+1);else if(f==="mingguan")dt.setDate(dt.getDate()+7);else if(f==="bulanan")dt.setMonth(dt.getMonth()+1);else if(f==="3bulan")dt.setMonth(dt.getMonth()+3);else if(f==="tahunan")dt.setFullYear(dt.getFullYear()+1);return dt.toISOString().slice(0,10);};
  const getStatus=(r:any)=>{if(!r.jatuh_tempo)return{label:"Belum dijadwalkan",color:"#64748b",bg:"#f1f5f9"};if(r.jatuh_tempo<today)return{label:"Terlambat",color:"#dc2626",bg:"#fef2f2"};const diff=Math.ceil((new Date(r.jatuh_tempo).getTime()-new Date(today).getTime())/86400000);if(diff===0)return{label:"Hari ini!",color:"#dc2626",bg:"#fef2f2"};if(diff<=3)return{label:diff+"hr lagi",color:"#f59e0b",bg:"#fffbeb"};if(diff<=7)return{label:diff+"hr lagi",color:"#2563eb",bg:"#eff6ff"};return{label:diff+"hr lagi",color:"#16a34a",bg:"#f0fdf4"};};
  const save=async()=>{
    if(!form.mesin_id||!form.jenis_maintenance.trim())return;
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    // BUG FIX (23 Sep 2026, audit "error Supabase gak dicek") - dulu cuma destructure {data},
    // error diabaikan - kalau gagal, `data` null, if(data){...} di-skip (gak ada state update/
    // activity log), TAPI form/modal tetap ke-reset di baris terakhir (dulu di luar kedua
    // cabang) - user lihat form nutup kayak berhasil tersimpan padahal DB gak berubah.
    if(editId){
      const{data,error}=await supabase.from("maintenance_rutin").update({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
      }).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(error){alert("Gagal menyimpan: "+error.message);return;}
      setRutinList((p:any[])=>p.map((r:any)=>r.id===editId?data:r));
      await activityLogService.insert({user_name:uname,action:"EDIT MAINTENANCE RUTIN",
        description:"Edit jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
        module:"maintenance",halaman:"Maintenance"});
    } else {
      const{data,error}=await supabase.from("maintenance_rutin").insert({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
        is_active:true,
      }).select("*,mesin(nama,kode)").single();
      if(error){alert("Gagal menyimpan: "+error.message);return;}
      setRutinList((p:any[])=>[...p,data]);
      await activityLogService.insert({user_name:uname,action:"TAMBAH MAINTENANCE RUTIN",
        description:"Tambah jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
        module:"maintenance",halaman:"Maintenance"});
    }
    setShowForm(false);setEditId(null);
    setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  };
  const del=async()=>{
  const item=rutinList.find((r:any)=>r.id===delId);
  // BUG FIX (23 Sep 2026) - dulu hasil update gak di-destructure SAMA SEKALI (gak ada data
  // maupun error dibaca) - modal tetap nutup & list tetap ke-filter lokal walau gagal di DB.
  const{error}=await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);
  if(error){alert("Gagal menonaktifkan: "+error.message);return;}
  setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));
  setDelId(null);
  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
  await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"NONAKTIF MAINTENANCE RUTIN",description:"Nonaktifkan jadwal: "+(item?.jenis_maintenance||"-")+" - "+(item?.mesin?.nama||"-"),module:"maintenance",halaman:"Maintenance"});
};

  const tutupDone=()=>{resetStagedFoto();setUnggahDone(null);setDoneSaving(false);setDoneId(null);};
  const jalankanUnggahDone=async(logId:number,rutinId:number,files:File[])=>{
    setUnggahDone({logId,rutinId,terkirim:0,total:files.length,gagal:[],berjalan:true});
    const hasil=await unggahFotoKeLogMaintenance(logId,rutinId,files,(terkirim,total)=>
      setUnggahDone(prev=>prev?{...prev,terkirim,total}:prev));
    if(hasil.gagal.length===0){tutupDone();return;}
    setUnggahDone({logId,rutinId,terkirim:hasil.terkirim,total:files.length,gagal:hasil.gagal,berjalan:false});
  };
  const markDone=async(item:any)=>{
    setDoneSaving(true);
    const todayStr=getLocalDateStr();
    const nextDate=calcNext(todayStr,item.frekuensi);
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    const fileTerpilih=stagedFoto.map(s=>s.file);
    // (5 Okt 2026) Jadwal & log disimpan LEBIH DULU lewat helper bersama (gagal -> alert, modal tetap
    // terbuka, jadwal dikembalikan); foto diunggah SETELAHNYA & ditempel ke log yg sama.
    let hasil:{rutinBaru:any;logId:number};
    try{
      hasil=await simpanSelesaiMaintenanceRutin({rutin:item,teknisi:uname,via:"admin",tanggal:todayStr,jatuhTempoBaru:nextDate,selectRutin:"*,mesin(nama,kode)"});
    }catch(err:any){alert("Gagal menyimpan: "+(err?.message||"koneksi bermasalah"));setDoneSaving(false);return;}
    setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?hasil.rutinBaru:r));
    try{
      await activityLogService.insert({
        user_name:uname,
        action:"MAINTENANCE RUTIN DONE",
        description:"Selesai: "+item.jenis_maintenance+" - "+item.mesin?.nama+" ("+todayStr+"). Jadwal berikutnya: "+nextDate+(fileTerpilih.length?" ("+fileTerpilih.length+" file dokumentasi)":""),
        module:"maintenance",halaman:"Maintenance"
      });
    }catch(err){console.error("activity_log MAINTENANCE RUTIN DONE gagal:",err);}
    if(fileTerpilih.length===0){tutupDone();return;}
    await jalankanUnggahDone(hasil.logId,item.id,fileTerpilih);
  };
  // SATU SUMBER LOGIKA (CLAUDE.md B.1) - semua log utk 1 rutin_id, terbaru dulu. Dipakai getLatestLog
  // (kolom Terakhir, "via QR"/"Admin") DAN accordion Riwayat Dokumentasi (17 Sep 2026) - jangan
  // duplikasi filter+sort ini di 2 tempat, biar urutan/hasil gak bisa "kesplit" beda.
  const getLogsForRutin=(rutinId:number)=>
    (rutinLogList||[]).filter((l:any)=>l.rutin_id===rutinId)
      .slice().sort((a:any,b:any)=>(b.dilakukan_pada||"").localeCompare(a.dilakukan_pada||"")||b.id-a.id);
  // Entry terbaru per rutin_id dari maintenance_rutin_log - buat nunjukin siapa & lewat mana
  // (admin vs QR pekerja) terakhir nandain jadwal ini selesai.
  const getLatestLog=(rutinId:number)=>{
    const rows=getLogsForRutin(rutinId);
    return rows.length===0?null:rows[0];
  };
  const kepatuhan=rutinList.length>0?Math.round((rutinList.filter((r:any)=>r.terakhir_dilakukan&&r.jatuh_tempo>=today).length/rutinList.length)*100):0;
  const filtered=filterFrek==="ALL"?rutinList:rutinList.filter((r:any)=>r.frekuensi===filterFrek);
  // Kelompok 2 level Divisi -> Mesin (29 Sep 2026) - MURNI urutan render dari `filtered` yang sama
  // (data/query gak berubah, filter frekuensi tetap berlaku). Divisi = mesin.divisi (diisi di
  // Master Mesin) lewat mesinList yang sudah ke-fetch; urutan divisi dari lib/urutanDivisi.ts
  // (SATU sumber dgn Rekap Permintaan Barang). Mesin gak ketemu/divisi kosong -> grup "Belum
  // ditentukan" di paling bawah, tetap tampil. Urutan mesin dalam divisi = urutan kemunculan
  // pertama di data asli, urutan jadwal dalam mesin = urutan asli - gak diurut ulang.
  const labelDivisi=(k:string)=>k===DIVISI_KOSONG?"Belum ditentukan":(DIVISI_CONFIG as any)[k]?.label||k;
  const mesinById:Record<string,any>=Object.fromEntries(mesinList.map((m:any)=>[m.id,m]));
  const grupDivisi=(()=>{
    const div:Record<string,{urutMesin:string[],mesin:Record<string,{nama:string,kode:string,rows:any[]}>}>={};
    filtered.forEach((r:any)=>{
      const m=mesinById[r.mesin_id];
      const d=(div[m?.divisi||DIVISI_KOSONG]||={urutMesin:[],mesin:{}});
      const mk=String(r.mesin_id??DIVISI_KOSONG);
      if(!d.mesin[mk]){d.mesin[mk]={nama:m?.nama||r.mesin?.nama||"—",kode:m?.kode||r.mesin?.kode||"",rows:[]};d.urutMesin.push(mk);}
      d.mesin[mk].rows.push(r);
    });
    return Object.keys(div).sort((a,b)=>bandingDivisiProduksi(a,b,labelDivisi))
      .map(dk=>({dk,label:labelDivisi(dk),mesin:div[dk].urutMesin.map(mk=>({mk,...div[dk].mesin[mk]}))}));
  })();
  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[{l:"Terlambat",v:terlambat.length,c:"#dc2626"},{l:"Jatuh tempo minggu ini",v:mingguIni.length,c:"#f59e0b"},{l:"Total jadwal",v:rutinList.length,c:"#2563eb"},{l:"Kepatuhan",v:kepatuhan+"%",c:"#16a34a"}].map((s:any,i:number)=>(<Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div></Card>))}
      </div>
      {([...terlambat,...mingguIni]).length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>Perlu perhatian</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[...terlambat,...mingguIni].slice(0,4).map((r:any)=>{const st=getStatus(r);const fc=FC[r.frekuensi]||FC.bulanan;return(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:st.bg,border:`1px solid ${st.color}30`,borderRadius:8,borderLeft:`3px solid ${st.color}`}}>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.jenis_maintenance}</div><div style={{fontSize:11,color:"#64748b"}}>{r.mesin?.nama} · {r.teknisi||"Belum assign"}</div></div>
                <span style={{background:fc.bg,color:fc.color,border:`1px solid ${fc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{fc.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:st.color,whiteSpace:"nowrap"}}>{st.label}</span>
                <button onClick={()=>setDoneId(r)} style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#fff",fontWeight:700}}>Selesai</button>
              </div>
            );})}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
          {["ALL","harian","mingguan","bulanan","3bulan","tahunan"].map((f:string)=>(<button key={f} onClick={()=>setFilterFrek(f)} style={{padding:"5px 10px",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterFrek===f?"#1d4ed8":"#fff",color:filterFrek===f?"#fff":"#64748b",borderRight:"1px solid #e2e8f0"}}>{f==="ALL"?"Semua":FC[f]?.label}</button>))}
        </div>
        <Btn color="#1d4ed8" style={{marginLeft:"auto"}} onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});}}>{showForm?"Tutup":"+ Tambah Jadwal"}</Btn>
      </div>
      {showForm&&(
        <Card style={{marginBottom:14,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:12}}>{editId?"Edit":"Tambah Jadwal Rutin"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl><Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}><option value="">-- Pilih --</option>{mesinList.map((m:any)=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}</Sel></div>
            <div><Lbl>Jenis Maintenance</Lbl><Inp value={form.jenis_maintenance} onChange={e=>setForm({...form,jenis_maintenance:e.target.value})} placeholder="Pelumasan, ganti oli..."/></div>
            <div><Lbl>Frekuensi</Lbl><Sel value={form.frekuensi} onChange={e=>setForm({...form,frekuensi:e.target.value})}>{Object.entries(FC).map(([k,v]:any)=><option key={k} value={k}>{v.label}</option>)}</Sel></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Terakhir Dilakukan</Lbl><Inp type="date" value={form.terakhir_dilakukan} onChange={e=>setForm({...form,terakhir_dilakukan:e.target.value,jatuh_tempo:calcNext(e.target.value,form.frekuensi)})}/></div>
            <div><Lbl>Jatuh Tempo</Lbl><Inp type="date" value={form.jatuh_tempo} onChange={e=>setForm({...form,jatuh_tempo:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Catatan</Lbl><Inp value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Catatan tambahan..."/></div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}><Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn><Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn></div>
          </div>
        </Card>
      )}
      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Jenis Maintenance","Frekuensi","Teknisi","Terakhir","Jatuh Tempo","Status","Aksi"].map((h:string)=><th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0?(<tr><td colSpan={7} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Belum ada jadwal</td></tr>):
            grupDivisi.map((g:any)=>[(
              <tr key={"div-"+g.dk}>
                <td colSpan={7} style={{background:"#0f2555",color:"#fff",fontWeight:800,fontSize:13,padding:"8px 12px"}}>
                  {g.label}<span style={{fontSize:11,fontWeight:400,opacity:.75,marginLeft:8}}>{g.mesin.length} mesin</span>
                </td>
              </tr>
            ),...g.mesin.map((m:any)=>[(
              <tr key={"msn-"+g.dk+"-"+m.mk}>
                <td colSpan={7} style={{background:"#e8eef8",color:"#0f2555",fontWeight:700,fontSize:12,padding:"7px 12px 7px 26px",borderBottom:"1px solid #d6e0f0"}}>
                  {m.nama}
                  {m.kode&&<span style={{fontFamily:"monospace",fontSize:10.5,fontWeight:400,color:"#94a3b8",marginLeft:8}}>{m.kode}</span>}
                  <span style={{fontSize:10.5,fontWeight:400,color:"#64748b",marginLeft:8}}>· {m.rows.length} jadwal</span>
                </td>
              </tr>
            ),...m.rows.map((r:any,i:number)=>{const fc=FC[r.frekuensi]||FC.bulanan;const st=getStatus(r);const bg=i%2===0?"#fff":"#f8fafc";const td:any={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"middle"};const latestLog=getLatestLog(r.id);const logs=getLogsForRutin(r.id);const isExpanded=expandedIds.has(r.id);return[(
              <tr key={r.id}>
                <td style={{...td,fontWeight:600,color:"#475569",paddingLeft:40}}>{r.jenis_maintenance}</td>
                <td style={td}><span style={{background:fc.bg,color:fc.color,border:`1px solid ${fc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{fc.label}</span></td>
                <td style={{...td,color:"#64748b"}}>{r.teknisi||"—"}</td>
                <td style={{...td,fontSize:11,color:"#94a3b8"}}>{r.terakhir_dilakukan||"—"}{latestLog&&<div style={{fontSize:9.5,color:latestLog.completed_via==="qr_worker"?"#7c3aed":"#94a3b8",fontWeight:700,marginTop:1}}>{latestLog.completed_via==="qr_worker"?`via QR (${latestLog.teknisi})`:"Admin ("+latestLog.teknisi+")"}</div>}</td>
                <td style={{...td,fontSize:11,fontWeight:600,color:st.color}}>{r.jatuh_tempo||"—"}</td>
                <td style={td}><span style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{st.label}</span></td>
                <td style={{...td,textAlign:"center"}}>
                  <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                    {logs.length>0&&(
                      <button onClick={()=>toggleExpand(r.id)} title={isExpanded?"Sembunyikan riwayat dokumentasi":"Lihat riwayat dokumentasi"}
                        style={{background:isExpanded?"#eff6ff":"#f8fafc",border:`1px solid ${isExpanded?"#bfdbfe":"#e2e8f0"}`,borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:isExpanded?"#1d4ed8":"#64748b",fontWeight:700}}>
                        {isExpanded?"▲":"▼"} {logs.length}
                      </button>
                    )}
                    <button onClick={()=>setDoneId(r)} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:700}}>Done</button>
                    <button onClick={()=>{setEditId(r.id);setForm({mesin_id:r.mesin_id?.toString()||"",jenis_maintenance:r.jenis_maintenance||"",frekuensi:r.frekuensi||"mingguan",teknisi:r.teknisi||"",terakhir_dilakukan:r.terakhir_dilakukan||"",jatuh_tempo:r.jatuh_tempo||"",catatan:r.catatan||""});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                    <button onClick={()=>setDelId(r.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                  </div>
                </td>
              </tr>
            ),isExpanded&&logs.length>0&&(
              <tr key={r.id+"-hist"}>
                <td colSpan={7} style={{background:"#f8fafc",padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>📋 Riwayat Dokumentasi ({logs.length})</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {logs.map((l:any)=>{const foto=l.foto||[];return(
                      <div key={l.id} style={{display:"flex",gap:12,alignItems:"flex-start",background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{minWidth:150}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#1e293b"}}>{l.dilakukan_pada||"—"}</div>
                          <div style={{fontSize:10,fontWeight:700,color:l.completed_via==="qr_worker"?"#7c3aed":"#94a3b8",marginTop:1}}>{l.completed_via==="qr_worker"?"via QR":"Admin"} ({l.teknisi||"—"})</div>
                          {l.catatan&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{l.catatan}</div>}
                        </div>
                        {foto.length>0?(
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {foto.map((f:any,fi:number)=>{const fRot=rotasiMap[f.url]||0;return(
                              <div key={fi} style={{position:"relative",width:48,height:48}}>
                                <div onClick={()=>setFotoViewer({fotos:foto.map(fotoMaintenanceKeViewer),startIndex:fi,label:`${r.jenis_maintenance||"Maintenance"}_${l.dilakukan_pada||""}`})}
                                  title={f.type==="video"?"Buka video":"Buka foto"} style={{cursor:"pointer"}}>
                                  {f.type==="video"?(
                                    <video src={f.url} style={{width:48,height:48,borderRadius:6,objectFit:"cover",border:"1px solid #e2e8f0",background:"#000",transform:fRot?`rotate(${fRot}deg)`:undefined}}/>
                                  ):(
                                    <img src={f.url} style={{width:48,height:48,borderRadius:6,objectFit:"cover",border:"1px solid #e2e8f0",transform:fRot?`rotate(${fRot}deg)`:undefined}}/>
                                  )}
                                </div>
                                <button onClick={(e:any)=>doRotateThumb(e,f.url)} disabled={rotatingUrl===f.url} title="Putar 90°"
                                  style={{position:"absolute",bottom:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#1e293b",color:"#fff",border:"2px solid #fff",fontSize:9,lineHeight:"14px",cursor:rotatingUrl===f.url?"default":"pointer",padding:0,opacity:rotatingUrl===f.url?0.6:1}}>
                                  <i className="ti ti-rotate-clockwise" style={{fontSize:10}}/>
                                </button>
                              </div>
                            );})}
                          </div>
                        ):(
                          <span style={{fontSize:10,color:"#cbd5e1",fontStyle:"italic",paddingTop:2}}>Tanpa dokumentasi</span>
                        )}
                      </div>
                    );})}
                  </div>
                </td>
              </tr>
            )];})])])}
          </tbody>
        </table>
      </div>
      {doneId&&(<Modal title="Tandai Selesai?" onClose={()=>{if(unggahDone?.berjalan||doneSaving)return;tutupDone();}} width={400}>
        <div style={{fontSize:13,color:"#475569",marginBottom:8}}><strong>{doneId.jenis_maintenance}</strong> — {doneId.mesin?.nama}</div>
        <div style={{fontSize:12,color:"#064e3b",background:"#f0fdf4",borderRadius:8,padding:"10px 12px",marginBottom:14}}>Jadwal berikutnya otomatis dihitung dari hari ini.</div>
        {/* Dokumentasi OPSIONAL (16 Sep 2026) - sama persis konsepnya kayak form "Tandai Selesai" QR (MesinPublic.tsx). */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <label style={{display:"inline-flex",alignItems:"center",gap:5,background:"#f8fafc",border:"1px dashed #cbd5e1",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,color:"#475569",cursor:"pointer"}}>
              📎 Lampirkan foto/video (opsional)
              <input type="file" accept="image/*,video/*" multiple style={{display:"none"}}
                onChange={(e:any)=>{pilihFoto(e.target.files);e.target.value="";}}/>
            </label>
            {stagedFoto.length>0&&<span style={{fontSize:10.5,color:"#94a3b8"}}>{stagedFoto.length} file dipilih</span>}
          </div>
          {stagedFoto.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
              {stagedFoto.map((s,si)=>(
                <div key={si} style={{position:"relative",width:52,height:52}}>
                  {s.file.type.startsWith("video/")?(
                    <video src={s.previewUrl} style={{width:52,height:52,borderRadius:8,objectFit:"cover",border:"1px solid #e2e8f0",background:"#000"}}/>
                  ):(
                    <img src={s.previewUrl} style={{width:52,height:52,borderRadius:8,objectFit:"cover",border:"1px solid #e2e8f0"}}/>
                  )}
                  <button onClick={()=>batalkanFotoStaged(si)}
                    style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:"#dc2626",color:"#fff",border:"2px solid #fff",fontSize:10,lineHeight:"14px",cursor:"pointer",padding:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {unggahDone?(
          <div style={{fontSize:12,lineHeight:1.5}}>
            {unggahDone.berjalan?(
              <div style={{color:"#1d4ed8",fontWeight:700,marginBottom:10}}>✓ Selesai tersimpan · mengunggah foto {Math.min(unggahDone.terkirim+1,unggahDone.total)}/{unggahDone.total}…</div>
            ):(
              <>
                <div style={{color:"#b45309",fontWeight:700}}>✓ Selesai tersimpan · {unggahDone.gagal.length} dari {unggahDone.total} foto gagal terkirim{unggahDone.terkirim>0?" ("+unggahDone.terkirim+" sudah tersimpan)":""}</div>
                <div style={{color:"#94a3b8",fontSize:11,marginBottom:12}}>{unggahDone.gagal.map(g=>g.file.name+": "+g.alasan).join(" · ")}</div>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <Btn outline color="#64748b" onClick={tutupDone}>Tutup tanpa foto</Btn>
                  <Btn color="#1d4ed8" onClick={()=>jalankanUnggahDone(unggahDone.logId,unggahDone.rutinId,unggahDone.gagal.map(g=>g.file))}>Coba lagi</Btn>
                </div>
              </>
            )}
          </div>
        ):(
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn outline color="#64748b" onClick={tutupDone} disabled={doneSaving}>Batal</Btn>
          <Btn color="#16a34a" onClick={()=>markDone(doneId)} disabled={doneSaving}>{doneSaving?"Menyimpan...":"Selesai"}</Btn>
        </div>
        )}
      </Modal>)}
      {fotoViewer&&<FotoZoomViewer fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
      {delId&&(<Modal title="Nonaktifkan?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Jadwal ini akan dinonaktifkan.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Nonaktifkan</Btn></div></Modal>)}
    </div>
  );
}
