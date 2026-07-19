import { useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { Card, Lbl, Inp, Sel, Btn, Modal } from './ui/Primitives'

export function MasterMesinTab({mesinList,setMesinList,user}:any){
  const [printQR,setPrintQR]=useState<any>(null);
  const [form,setForm]=useState({kode:"",nama:"",lokasi:"",status:"aktif"});
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const save=async()=>{
    if(!form.kode.trim()||!form.nama.trim())return;
    if(editId){
      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).eq("id",editId).select().single();
      if(!error){
        setMesinList((prev:any[])=>prev.map(m=>m.id===editId?data:m));
        setEditId(null);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"EDIT MESIN",description:"Edit mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    } else {
      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).select().single();
      if(!error){
        setMesinList((prev:any[])=>[...prev,data]);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"TAMBAH MESIN",description:"Tambah mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    }
  };
  const STATUS_COLOR={aktif:"#16a34a",rusak:"#dc2626",maintenance:"#f59e0b",nonaktif:"#64748b"};


  const thS={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};

  return(
    <div>
      <Card style={{marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:14}}>
          {editId?"✏️ Edit Mesin":"➕ Tambah Mesin"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 150px auto",gap:12,alignItems:"flex-end"}}>
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
          <div style={{display:"flex",gap:8,paddingBottom:2}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={()=>{setEditId(null);setForm({kode:"",nama:"",lokasi:"",status:"aktif"});}}>Batal</Btn>}
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

      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={thS}>KODE</th>
              <th style={thS}>NAMA MESIN</th>
              <th style={thS}>LOKASI</th>
              <th style={{...thS,textAlign:"center"}}>STATUS</th>
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
                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>{setEditId(m.id);setForm({kode:m.kode,nama:m.nama,lokasi:m.lokasi||"",status:m.status});}}
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
        <Modal title={"QR Code — "+printQR.nama} onClose={()=>setPrintQR(null)} width={380}>
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              Scan QR untuk melihat info & jadwal maintenance mesin ini
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <canvas ref={(canvas:any)=>{
                if(canvas&&!(canvas as any).__qr_done){
                  (canvas as any).__qr_done=true;
                  const url="https://vista-teknik-new.vercel.app/mesin?id="+printQR.id;
                  QRCode.toCanvas(canvas,url,{width:180,margin:2,color:{dark:"#1e293b",light:"#ffffff"}},(err:any)=>{if(err)console.error(err);});
                }
              }}/>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:4,fontFamily:"monospace",wordBreak:"break-all" as const,padding:"0 8px"}}>
              {"https://vista-teknik-new.vercel.app/mesin?id="+printQR.id}
            </div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:20}}>
              {printQR.kode} · {printQR.nama}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setPrintQR(null)}>Tutup</Btn>
              <Btn color="#1d4ed8" onClick={async()=>{
                const url="https://vista-teknik-new.vercel.app/mesin?id="+printQR.id;
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
