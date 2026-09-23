import { useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { Card, Lbl, Inp, Sel, Btn, Modal } from './ui/Primitives'

// Sama persis KEY/LABEL DIVISI_CONFIG di vista-pekerja/src/App.tsx (repo terpisah, gak ada
// shared package - duplikat kecil, sama pola dengan konstanta lain yang direplikasi lintas repo
// di codebase ini). KEY yang disimpan (bukan label) supaya bisa langsung dicocokkan sama
// `user.divisi` login Vista Pekerja pas targeting push notification maintenance.
const DIVISI_OPTIONS=[
  {value:"mekanik",label:"Mekanik (Potong/Bending/Stel/Finishing)"},
  {value:"painting",label:"Painting (+Rendam)"},
  {value:"assembling",label:"Assembling (Luar/Dalam)"},
  {value:"wiring_ctrl",label:"Wiring Control"},
  {value:"wiring_pwr",label:"Wiring Power"},
  {value:"qc",label:"QC"},
  {value:"nameplate",label:"Nameplate"},
  {value:"komponen",label:"QS"}, // label "Komponen (Warehouse/QS)"->"QS" (23 Sep 2026) - Warehouse sudah dihapus dari divisi ini 14 Agu 2026, key TETAP "komponen"
];
const divisiLabel=(v:string)=>DIVISI_OPTIONS.find(d=>d.value===v)?.label||v;

export function MasterMesinTab({mesinList,setMesinList,user}:any){
  const [printQR,setPrintQR]=useState<any>(null);
  const [printingAll,setPrintingAll]=useState(false);
  const [form,setForm]=useState({kode:"",nama:"",lokasi:"",status:"aktif",divisi:""});
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const save=async()=>{
    if(!form.kode.trim()||!form.nama.trim())return;
    if(editId){
      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status,divisi:form.divisi||null}).eq("id",editId).select().single();
      if(!error){
        setMesinList((prev:any[])=>prev.map(m=>m.id===editId?data:m));
        setEditId(null);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif",divisi:""});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"EDIT MESIN",description:"Edit mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    } else {
      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status,divisi:form.divisi||null}).select().single();
      if(!error){
        setMesinList((prev:any[])=>[...prev,data]);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif",divisi:""});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"TAMBAH MESIN",description:"Tambah mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    }
  };
  const del=async()=>{
    if(!delId)return;
    const mesin=mesinList.find((m:any)=>m.id===delId);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const{error}=await supabase.from("mesin").update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq("id",delId);
    if(!error){
      setMesinList((prev:any[])=>prev.filter(m=>m.id!==delId));
      setDelId(null);
      await activityLogService.insert({user_name:uname,action:"HAPUS MESIN",description:"Hapus mesin: "+(mesin?.kode||"")+" - "+(mesin?.nama||""),module:"maintenance",halaman:"System"});
    }
  };
  const STATUS_COLOR={aktif:"#16a34a",rusak:"#dc2626",maintenance:"#f59e0b",nonaktif:"#64748b"};

  // Cetak Semua QR (18 Sep 2026, fitur baru diminta user) - dulu print QR cuma bisa 1 mesin per
  // klik (modal printQR di bawah) - QR fisik yang perlu diganti ulang (root cause domain Vercel
  // beku, lihat komentar di modal printQR) jumlahnya banyak, 1-per-1 gak praktis. Sekalian buka
  // 1 window print-preview berisi kartu QR SEMUA mesin di mesinList (list ini SUDAH terfilter
  // exclude soft-delete dari parent - lihat cara mesinList di-fetch di App.tsx/System tab, sama
  // sumber yang dipakai tabel di atas) - user tinggal Print/Ctrl+P sekali, browser yang atur
  // page break antar kartu (CSS grid + break-inside:avoid per kartu).
  const cetakSemuaQR=async()=>{
    if(mesinList.length===0||printingAll)return;
    setPrintingAll(true);
    try{
      const items=await Promise.all(mesinList.map(async(m:any)=>{
        const url="https://admin.vistaproduksi.com/mesin?id="+m.id;
        const dataUrl=await QRCode.toDataURL(url,{width:200,margin:2,color:{dark:"#1e293b",light:"#ffffff"}});
        return{m,url,dataUrl};
      }));
      const w=window.open("","_blank");
      if(!w){setPrintingAll(false);return;}
      const cards=items.map(({m,url,dataUrl})=>
        '<div class="kartu">'
        +'<h3>'+m.nama+'</h3>'
        +'<p class="sub">'+m.kode+(m.lokasi?' · '+m.lokasi:'')+'</p>'
        +'<img src="'+dataUrl+'" width="160" height="160"/>'
        +'<p class="url">'+url+'</p>'
        +'</div>'
      ).join("");
      w.document.write('<!DOCTYPE html><html><head><title>QR Semua Mesin</title>'
        +'<style>'
        +'body{font-family:Arial;padding:24px;background:#fff;margin:0}'
        +'.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}'
        +'.kartu{border:1px solid #e2e8f0;border-radius:8px;padding:16px 12px;text-align:center;break-inside:avoid;page-break-inside:avoid}'
        +'.kartu h3{margin:0 0 4px;font-size:14px}'
        +'.kartu .sub{color:#64748b;margin:0 0 10px;font-size:11px}'
        +'.kartu img{border:1px solid #e2e8f0;border-radius:6px;padding:6px}'
        +'.kartu .url{font-size:9px;color:#94a3b8;margin:8px 0 0;word-break:break-all}'
        +'@media print{.grid{grid-template-columns:repeat(3,1fr)}}'
        +'</style></head><body>'
        +'<div class="grid">'+cards+'</div>'
        +'<scri'+'pt>setTimeout(function(){window.print();},600);</scri'+'pt>'
        +'</body></html>');
      w.document.close();
    } finally {
      setPrintingAll(false);
    }
  };


  const thS={background:"#1e3a8a",color:"#fff",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,borderRight:"1px solid #ffffff18"};

  return(
    <div>
      <Card style={{marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:14}}>
          {editId?"✏️ Edit Mesin":"➕ Tambah Mesin"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 150px 1fr auto",gap:12,alignItems:"flex-end"}}>
          <div><Lbl>Kode</Lbl><Inp value={form.kode} onChange={e=>setForm({...form,kode:e.target.value})} placeholder="MSN-001"/></div>
          <div><Lbl>Nama Mesin</Lbl><Inp value={form.nama} onChange={e=>setForm({...form,nama:e.target.value})} placeholder="Nama mesin..."/></div>
          <div><Lbl>Lokasi</Lbl><Inp value={form.lokasi} onChange={e=>setForm({...form,lokasi:e.target.value})} placeholder="Lantai 1 / Area B..."/></div>
          <div><Lbl>Status</Lbl>
            <Sel value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="aktif">Aktif</option>
              <option value="maintenance">Maintenance</option>
              <option value="rusak">Rusak</option>
              <option value="nonaktif">Nonaktif</option>
            </Sel>
          </div>
          <div><Lbl>Divisi (buat notifikasi maintenance)</Lbl>
            <Sel value={form.divisi} onChange={e=>setForm({...form,divisi:e.target.value})}>
              <option value="">— Belum ditentukan —</option>
              {DIVISI_OPTIONS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
            </Sel>
          </div>
          <div style={{display:"flex",gap:8,paddingBottom:2}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={()=>{setEditId(null);setForm({kode:"",nama:"",lokasi:"",status:"aktif",divisi:""});}}>Batal</Btn>}
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:16}}>
        {Object.entries(STATUS_COLOR).map(([s,c])=>(
          <Card key={s} style={{padding:"12px 16px",borderLeft:`3px solid ${c}`}}>
            <div style={{fontSize:20,fontWeight:800,color:c}}>{mesinList.filter(m=>m.status===s).length}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
        <Btn color="#16a34a" onClick={cetakSemuaQR} disabled={printingAll||mesinList.length===0}>
          {printingAll?"⏳ Menyiapkan...":`🖨 Cetak Semua QR (${mesinList.length})`}
        </Btn>
      </div>

      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={thS}>KODE</th>
              <th style={thS}>NAMA MESIN</th>
              <th style={thS}>LOKASI</th>
              <th style={{...thS,textAlign:"center"}}>STATUS</th>
              <th style={thS}>DIVISI</th>
              <th style={{...thS,textAlign:"center"}}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {mesinList.map((m,i)=>{
              const c=STATUS_COLOR[m.status]||"#64748b";
              const rBg=i%2===0?"#fff":"#f8fafc";
              const td={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
              return(
                <tr key={m.id}>
                  <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>{m.kode}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{m.nama}</td>
                  <td style={{...td,color:"#64748b"}}>{m.lokasi||"—"}</td>
                  <td style={{...td,textAlign:"center"}}>
                    <span style={{background:c+"18",color:c,border:`1px solid ${c}33`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{...td,color:m.divisi?"#1e293b":"#cbd5e1",fontStyle:m.divisi?"normal":"italic",fontSize:11}}>{m.divisi?divisiLabel(m.divisi):"belum ditentukan"}</td>
                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>{setEditId(m.id);setForm({kode:m.kode,nama:m.nama,lokasi:m.lokasi||"",status:m.status,divisi:m.divisi||""});}}
                        style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                      <button onClick={()=>setDelId(m.id)}
                        style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                      <button onClick={()=>setPrintQR(m)}
                        style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:600}}>QR</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {delId&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Mesin <strong>{mesinList.find(m=>m.id===delId)?.nama}</strong> akan dihapus.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
      {printQR&&(
        // BUG FIX (18 Sep 2026, root cause "sesi upload dokumentasi gak muncul khusus
        // Painting") - domain QR dulu vista-teknik-new.vercel.app, ternyata deployment
        // Vercel itu BEKU sejak 5 Sep 2026 (gak lagi auto-deploy dari git push - dicek
        // langsung: bundle JS-nya nol kecocokan utk fitur 16-18 Sep, termasuk upload
        // dokumentasi ini). Setiap scan QR fisik di mesin manapun jadi selalu ketemu kode
        // 13 hari basi, terlepas device operatornya baru di-refresh atau enggak - BUKAN
        // soal tab basi (itu dugaan awal, sudah kepalang di-fix di MesinPublic.tsx pakai
        // useVersionCheck, TAPI gak akan mempan di sini karena version.json-nya IKUT beku).
        // Ganti ke admin.vistaproduksi.com - domain asli yang beneran auto-deploy (dicek:
        // build 17 Sep 15:03, up to date). QR FISIK yang SUDAH tertempel di mesin masih
        // perlu dicetak ulang manual - kode ini cuma benerin QR yang di-print BARU
        // mulai sekarang.
        <Modal title={"QR Code — "+printQR.nama} onClose={()=>setPrintQR(null)} width={380}>
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              Scan QR untuk melihat info & jadwal maintenance mesin ini
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <canvas ref={(canvas:any)=>{
                if(canvas&&!(canvas as any).__qr_done){
                  (canvas as any).__qr_done=true;
                  const url="https://admin.vistaproduksi.com/mesin?id="+printQR.id;
                  QRCode.toCanvas(canvas,url,{width:180,margin:2,color:{dark:"#1e293b",light:"#ffffff"}},(err:any)=>{if(err)console.error(err);});
                }
              }}/>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:4,fontFamily:"monospace",wordBreak:"break-all" as const,padding:"0 8px"}}>
              {"https://admin.vistaproduksi.com/mesin?id="+printQR.id}
            </div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:20}}>
              {printQR.kode} · {printQR.nama}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setPrintQR(null)}>Tutup</Btn>
              <Btn color="#1d4ed8" onClick={async()=>{
                const url="https://admin.vistaproduksi.com/mesin?id="+printQR.id;
                const dataUrl=await QRCode.toDataURL(url,{width:200,margin:2,color:{dark:"#1e293b",light:"#ffffff"}});
                const w=window.open("","_blank","width=420,height=520");
                if(!w)return;
                w.document.write('<!DOCTYPE html><html><head><title>QR '+printQR.kode+'</title>'
                  +'<style>body{font-family:Arial;text-align:center;padding:32px;background:#fff}</style>'
                  +'</head><body>'
                  +'<h2 style="margin:0 0 4px;font-size:18px">'+printQR.nama+'</h2>'
                  +'<p style="color:#64748b;margin:0 0 4px;font-size:13px">'+printQR.kode+(printQR.lokasi?' · '+printQR.lokasi:'')+'</p>'
                  +'<p style="color:#94a3b8;margin:0 0 16px;font-size:11px">Scan untuk info maintenance</p>'
                  +'<div style="display:inline-block;padding:12px;border:1px solid #e2e8f0;border-radius:8px">'
                  +'<img src="'+dataUrl+'" width="200" height="200"/></div>'
                  +'<p style="font-size:10px;color:#94a3b8;margin-top:12px;word-break:break-all">'+url+'</p>'
                  +'<scri'+'pt>setTimeout(function(){window.print();},500);</scri'+'pt>'
                  +'</body></html>');
                w.document.close();
              }}>
                🖨 Print QR
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
