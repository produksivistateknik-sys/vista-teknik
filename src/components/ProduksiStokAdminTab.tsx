import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { produksiStokService } from '../services/produksiStokService'
import { stokTransaksiService } from '../services/stokTransaksiService'
import { activityLogService } from '../services/activityLogService'
import { Card, Lbl, Inp, Sel, Btn, Modal } from './ui/Primitives'

// PRODUKSI STOK - ADMIN (2 Okt 2026). Produksi komponen setengah jadi SENGAJA utk stok, TERPISAH
// TOTAL dari WO/Raw Schedule. Tahap tiap batch diambil dari aturan proses WO (bom_proses_relevan
// komponen BOM acuan item stok) saat batch dibuat. Semua tulis lewat RPC; angka tersedia/baik
// dibaca dari view v_produksi_stok_tahap (rumus SQL yang sama dgn validasi server).
// Lihat supabase/migrations/20261002030000_produksi_stok.sql.

const WARNA_STATUS:Record<string,{c:string,bg:string,l:string}>={
  aktif:{c:"#b45309",bg:"#fffbeb",l:"Aktif"},
  selesai:{c:"#16a34a",bg:"#f0fdf4",l:"Selesai"},
  batal:{c:"#64748b",bg:"#f1f5f9",l:"Dibatalkan"},
};

export function ProduksiStokAdminTab({user}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [batchList,setBatchList]=useState<any[]>([]);
  const [tahapList,setTahapList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [errMuat,setErrMuat]=useState<string|null>(null);
  const [filterStatus,setFilterStatus]=useState<"aktif"|"selesai"|"batal"|"ALL">("aktif");
  const [form,setForm]=useState<{komponenId:string,target:string}>({komponenId:"",target:""});
  const [previewTahap,setPreviewTahap]=useState<{tahap:string[]|null,err:string|null}>({tahap:null,err:null});
  const [saving,setSaving]=useState(false);
  const [logModal,setLogModal]=useState<{batch:any,rows:any[]}|null>(null);

  const getUname=()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    return user?.name||user?.nama||sess?.nama||"Admin";
  };

  const fetchAll=async()=>{
    try{
      const[s,b]=await Promise.all([stokTransaksiService.ambilStok(),produksiStokService.ambilBatch()]);
      const t=await produksiStokService.ambilTahap(b.map((x:any)=>x.id));
      setStokList(s);setBatchList(b);setTahapList(t);setErrMuat(null);
    }catch(err:any){
      console.error("[ProduksiStok admin] gagal memuat:",err);
      setErrMuat(err?.message||String(err));
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    fetchAll();
    // Debounce: 1 simpan progress = update tahap + insert log + update batch (3 event).
    let t:any=null;
    const muatUlang=()=>{clearTimeout(t);t=setTimeout(fetchAll,800);};
    const ch=supabase.channel("realtime-produksi-stok-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"produksi_stok_batch"},muatUlang)
      .on("postgres_changes",{event:"*",schema:"public",table:"produksi_stok_tahap"},muatUlang)
      .subscribe();
    return()=>{clearTimeout(t);supabase.removeChannel(ch);};
  },[]);

  // Pratinjau rantai tahap begitu komponen dipilih - dari aturan WO (bom_proses_relevan acuan).
  useEffect(()=>{
    const k=stokList.find(s=>String(s.id)===form.komponenId);
    if(!k){setPreviewTahap({tahap:null,err:null});return;}
    if(!k.bom_tipe_panel||!k.bom_kode_komponen){setPreviewTahap({tahap:null,err:"Komponen ini belum punya Komponen BOM acuan - isi dulu di tab Data Komponen."});return;}
    let batal=false;
    produksiStokService.tahapBerlaku(k.bom_tipe_panel,k.bom_kode_komponen)
      .then(t=>{if(!batal)setPreviewTahap(t.length?{tahap:t,err:null}:{tahap:null,err:`Acuan ${k.bom_tipe_panel} ${k.bom_kode_komponen} tidak punya proses POTONG s/d PAINTING di Master Data proses relevan.`});})
      .catch(e=>{if(!batal)setPreviewTahap({tahap:null,err:"Gagal membaca aturan proses: "+e.message});});
    return()=>{batal=true;};
  },[form.komponenId,stokList]);

  const buatBatch=async()=>{
    const target=Number(form.target);
    if(!form.komponenId){alert("Pilih komponen dulu!");return;}
    if(!Number.isInteger(target)||target<=0){alert("Target qty harus bilangan bulat lebih dari 0!");return;}
    setSaving(true);
    try{
      const hasil=await produksiStokService.buat(Number(form.komponenId),target,getUname());
      const k=stokList.find(s=>String(s.id)===form.komponenId);
      await activityLogService.insert({user_name:getUname(),action:"BUAT BATCH PRODUKSI STOK",module:"stok",halaman:"System",
        description:`Batch produksi stok #${hasil?.batch?.id}: ${k?.nama} (${k?.kode||"-"}) target ${target} pcs - tahap ${(hasil?.tahap||[]).map((x:any)=>x.tahap).join(" > ")}`});
      setForm({komponenId:"",target:""});
      await fetchAll();
    }catch(err:any){
      alert("Gagal membuat batch: "+(err?.message||err));
    }finally{
      setSaving(false);
    }
  };

  const ubahTarget=async(b:any)=>{
    const v=window.prompt(`Target baru untuk batch #${b.id} (sekarang ${b.target_qty} pcs).\n\nBoleh lebih kecil dari progress yang sudah berjalan - barang yang sudah terlanjur diproses TETAP dituntaskan (stok bisa lebih dari target baru).`,String(b.target_qty));
    if(v===null)return;
    const target=Number(v);
    if(!Number.isInteger(target)||target<=0){alert("Target harus bilangan bulat lebih dari 0!");return;}
    if(target===b.target_qty)return;
    try{
      const hasil=await produksiStokService.ubahTarget(b.id,target,getUname());
      await activityLogService.insert({user_name:getUname(),action:"UBAH TARGET PRODUKSI STOK",module:"stok",halaman:"System",
        description:`Batch produksi stok #${b.id}: target ${b.target_qty} -> ${target} pcs${hasil?.batch?.status==="selesai"?" (batch langsung selesai)":""}`});
      await fetchAll();
    }catch(err:any){alert("Gagal mengubah target: "+(err?.message||err));}
  };

  const batalkan=async(b:any,tahapBatch:any[])=>{
    const akhir=tahapBatch[tahapBatch.length-1];
    const baikAkhir=akhir?.qty_baik||0;
    const alasan=window.prompt(`Batalkan batch #${b.id}?\n\n`+
      (baikAkhir>0?`${baikAkhir} pcs yang sudah selesai ${akhir.tahap} TETAP dimasukkan ke stok.\n`:`Belum ada barang yang selesai ${akhir?.tahap||"tahap akhir"} - tidak ada yang masuk stok.\n`)+
      `Barang setengah jadi di tahap lain DITINGGALKAN (tidak dilanjutkan).\n\nAlasan pembatalan (opsional):`,"");
    if(alasan===null)return;
    try{
      await produksiStokService.batal(b.id,getUname(),alasan||null);
      await activityLogService.insert({user_name:getUname(),action:"BATAL PRODUKSI STOK",module:"stok",halaman:"System",
        description:`Batch produksi stok #${b.id} dibatalkan${baikAkhir>0?` - ${baikAkhir} pcs masuk stok`:""}${alasan?` - alasan: ${alasan}`:""}`});
      await fetchAll();
    }catch(err:any){alert("Gagal membatalkan: "+(err?.message||err));}
  };

  const bukaLog=async(b:any)=>{
    try{setLogModal({batch:b,rows:await produksiStokService.ambilLog(b.id)});}
    catch(err:any){alert("Gagal memuat riwayat: "+(err?.message||err));}
  };

  const fmtTgl=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";
  const namaKomponen=(id:number)=>{const k=stokList.find(s=>s.id===id);return k?k.nama:"#"+id;};
  const kodeKomponen=(id:number)=>stokList.find(s=>s.id===id)?.kode||"";
  const tampil=batchList.filter(b=>filterStatus==="ALL"||b.status===filterStatus);
  const jumlah=(s:string)=>batchList.filter(b=>b.status===s).length;

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat produksi stok...</div>;
  if(errMuat)return <div style={{textAlign:"center",padding:40,color:"#b91c1c"}}>Gagal memuat produksi stok: {errMuat}<br/><span style={{fontSize:11,color:"#94a3b8"}}>Refresh halaman untuk mencoba lagi.</span></div>;

  return(
    <div className="fi">
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:4}}>🏭 Buat Batch Produksi Stok</div>
        <div style={{fontSize:11,color:"#94a3b8",marginBottom:12}}>Produksi komponen setengah jadi untuk stok - terpisah dari WO. Tahap mengikuti aturan proses Master Data untuk komponen BOM acuan item ini.</div>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr) auto",gap:10,alignItems:"end"}}>
          <div>
            <Lbl>Komponen Stok</Lbl>
            <Sel value={form.komponenId} onChange={(e:any)=>setForm({...form,komponenId:e.target.value})}>
              <option value="">— Pilih komponen —</option>
              {stokList.map(s=><option key={s.id} value={s.id}>{s.nama}{s.kode?` (${s.kode})`:""}{s.bom_kode_komponen?"":" — belum ada acuan BOM"}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Target Qty (pcs)</Lbl>
            <Inp type="number" min={1} value={form.target} onChange={(e:any)=>setForm({...form,target:e.target.value})} placeholder="mis. 10"/>
          </div>
          <Btn onClick={buatBatch} disabled={saving||!previewTahap.tahap} style={{height:38,opacity:saving||!previewTahap.tahap?0.5:1}}>{saving?"Menyimpan...":"+ Buat Batch"}</Btn>
        </div>
        {previewTahap.err&&<div style={{marginTop:10,fontSize:11,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"7px 10px"}}>{previewTahap.err}</div>}
        {previewTahap.tahap&&(
          <div style={{marginTop:10,fontSize:11,color:"#475569"}}>
            Tahap batch ini: {previewTahap.tahap.map((t,i)=>(
              <span key={t}><span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:4,padding:"1px 7px",fontWeight:700,fontSize:10}}>{t}</span>{i<previewTahap.tahap!.length-1?" → ":""}</span>
            ))}
          </div>
        )}
      </Card>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap" as const}}>
        {([["aktif","Aktif"],["selesai","Selesai"],["batal","Dibatalkan"],["ALL","Semua"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setFilterStatus(k)}
            style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              border:filterStatus===k?"1.5px solid #1d4ed8":"1px solid #e2e8f0",background:filterStatus===k?"#eff6ff":"#fff",color:filterStatus===k?"#1d4ed8":"#64748b"}}>
            {l}{k!=="ALL"?` (${jumlah(k)})`:` (${batchList.length})`}
          </button>
        ))}
      </div>

      {tampil.length===0?(
        <Card style={{textAlign:"center",color:"#94a3b8",padding:32}}>Belum ada batch {filterStatus==="ALL"?"":WARNA_STATUS[filterStatus]?.l.toLowerCase()}.</Card>
      ):tampil.map(b=>{
        const th=tahapList.filter(t=>t.batch_id===b.id).sort((x,y)=>x.urutan-y.urutan);
        const akhir=th[th.length-1];
        const ws=WARNA_STATUS[b.status];
        return(
          <Card key={b.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap" as const}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{namaKomponen(b.komponen_id)}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                  Batch #{b.id} · {kodeKomponen(b.komponen_id)} · acuan {b.bom_tipe_panel} {b.bom_kode_komponen} · dibuat {fmtTgl(b.created_at)} oleh {b.created_by||"-"}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{background:ws.bg,color:ws.c,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:800}}>{ws.l}</span>
                <span style={{fontSize:13,fontWeight:800,color:"#1e293b"}}>{akhir?.qty_baik||0}/{b.target_qty} pcs</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginTop:12}}>
              {th.map(t=>{
                const pct=Math.min(100,Math.round((t.qty_baik/b.target_qty)*100));
                return(
                  <div key={t.tahap} style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{width:84,fontSize:10.5,fontWeight:700,color:"#475569"}}>{t.tahap}</span>
                    <div style={{flex:1,height:8,borderRadius:99,background:"#eef0f4",overflow:"hidden",minWidth:0}}>
                      <div style={{width:pct+"%",height:"100%",background:t.qty_baik>=b.target_qty?"#16a34a":"#f59e0b",borderRadius:99}}/>
                    </div>
                    <span style={{width:190,fontSize:10.5,color:"#64748b",textAlign:"right" as const,flexShrink:0}}>
                      baik <b style={{color:"#1e293b"}}>{t.qty_baik}</b>{t.qty_reject>0&&<> · reject <b style={{color:"#dc2626"}}>{t.qty_reject}</b></>}{b.status==="aktif"&&<> · tersedia <b>{t.tersedia}</b></>}
                    </span>
                  </div>
                );
              })}
            </div>
            {b.status==="batal"&&<div style={{marginTop:8,fontSize:11,color:"#64748b"}}>Dibatalkan oleh {b.dibatalkan_oleh||"-"} {fmtTgl(b.selesai_at)}{b.alasan_batal?` — ${b.alasan_batal}`:""}</div>}
            {b.status==="selesai"&&<div style={{marginTop:8,fontSize:11,color:"#16a34a"}}>Selesai {fmtTgl(b.selesai_at)} — stok masuk tercatat otomatis.</div>}
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap" as const}}>
              <Btn outline color="#475569" onClick={()=>bukaLog(b)} style={{padding:"6px 12px",fontSize:11}}>🕒 Riwayat Sesi</Btn>
              {b.status==="aktif"&&<Btn outline color="#1d4ed8" onClick={()=>ubahTarget(b)} style={{padding:"6px 12px",fontSize:11}}>✏️ Ubah Target</Btn>}
              {b.status==="aktif"&&<Btn outline color="#dc2626" onClick={()=>batalkan(b,th)} style={{padding:"6px 12px",fontSize:11}}>✕ Batalkan</Btn>}
            </div>
          </Card>
        );
      })}

      {logModal&&(
        <Modal title={`🕒 Riwayat Sesi — Batch #${logModal.batch.id} ${namaKomponen(logModal.batch.komponen_id)}`} onClose={()=>setLogModal(null)} width={720}>
          {logModal.rows.length===0?<div style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada sesi kerja.</div>:(
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>{["Waktu","Tahap","Selesai","Reject","Operator","Foto","Catatan"].map(h=>(
                  <th key={h} style={{background:"#1e3a8a",color:"#fff",padding:"7px 10px",textAlign:"left" as const,fontSize:10,fontWeight:600}}>{h}</th>))}</tr></thead>
                <tbody>{logModal.rows.map((r:any)=>(
                  <tr key={r.id}>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9",color:"#64748b"}}>{fmtTgl(r.created_at)}</td>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9",fontWeight:700}}>{r.tahap}</td>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9"}}>{r.qty_sesi_ini}</td>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9",color:r.qty_reject_sesi_ini>0?"#dc2626":"#94a3b8"}}>{r.qty_reject_sesi_ini}</td>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9"}}>{r.operator_nama||"-"}</td>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9"}}>{(r.foto_urls||[]).map((u:string,i:number)=><a key={i} href={u} target="_blank" rel="noreferrer" style={{marginRight:6,color:"#1d4ed8"}}>foto {i+1}</a>)}</td>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #f1f5f9",color:"#64748b"}}>{r.catatan||"-"}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
