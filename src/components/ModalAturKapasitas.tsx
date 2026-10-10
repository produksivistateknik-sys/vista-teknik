// Modal "Atur Kapasitas" (override kapasitas menit / kuota orang per tanggal & proses + rebalance otomatis).
// DIPINDAH APA ADANYA dari RawSchedule.tsx (Tahap 3c migrasi accordion, 10 Okt 2026) supaya tampilan lama &
// "Raw Schedule per WP" memakai modal & jalur simpan yang SAMA (setOverrideAndRebalance) - CLAUDE.md B.1.
import { useState } from 'react'
import * as fcsAsli from '../services/fcsService'
import type { IoJadwalRaw } from '../lib/ioJadwalRaw'
import { ALL_PROSES } from '../constants/panelTypes'
import { fmtDate } from '../lib/dateHelpers'
import { Modal, Lbl, Btn, Inp } from './ui/Primitives'

export function useAturKapasitas({user,refetchRaw,io}:{user:any;refetchRaw?:()=>any;io?:IoJadwalRaw}){
  const{setOverrideAndRebalance}=io?.fcs??fcsAsli; // tanpa io = Supabase asli
  const [overrideModal,setOverrideModal]=useState<{tanggalMulai:string,tanggalAkhir:string,proses:string[]}|null>(null);
  const [overrideValue,setOverrideValue]=useState("");
  const [overrideJamKerja,setOverrideJamKerja]=useState("8");
  const [overrideEfektivitas,setOverrideEfektivitas]=useState("80");
  const [overrideSaving,setOverrideSaving]=useState(false);
  const [overrideResult,setOverrideResult]=useState<any>(null);
  const [overrideProgress,setOverrideProgress]=useState("");
  const elemen=(
    <>
      {overrideModal&&(
        <Modal title="Atur Kapasitas" onClose={()=>{setOverrideModal(null);setOverrideResult(null);}} width={480}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <Lbl>Tanggal Mulai</Lbl>
              <Inp type="date" value={overrideModal.tanggalMulai} onChange={e=>setOverrideModal({...overrideModal,tanggalMulai:e.target.value})}/>
            </div>
            <div>
              <Lbl>Tanggal Akhir</Lbl>
              <Inp type="date" value={overrideModal.tanggalAkhir} onChange={e=>setOverrideModal({...overrideModal,tanggalAkhir:e.target.value})}/>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Jenis Pekerjaan ({overrideModal.proses.length} dipilih)</div>
              <div style={{display:"flex",gap:6}}>
                <button type="button" onClick={()=>setOverrideModal({...overrideModal,proses:[...ALL_PROSES]})}
                  style={{fontSize:10,color:"#16a34a",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                <button type="button" onClick={()=>setOverrideModal({...overrideModal,proses:[]})}
                  style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {ALL_PROSES.map(p=>{
                const checked=overrideModal.proses.includes(p);
                return(
                  <button key={p} type="button" onClick={()=>{
                    setOverrideModal({...overrideModal,proses:checked?overrideModal.proses.filter(x=>x!==p):[...overrideModal.proses,p]});
                  }}
                    style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${checked?"#1d4ed8":"#e2e8f0"}`,
                      background:checked?"#eff6ff":"#fff",color:checked?"#1d4ed8":"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          {overrideModal.proses.length>0&&overrideModal.proses.every(p=>["WIRING CONTROL","WIRING POWER"].includes(p))?(
            <div style={{marginBottom:14}}>
              <Lbl>Jumlah Orang</Lbl>
              <Inp type="number" min="0" value={overrideValue} onChange={e=>setOverrideValue(e.target.value)} placeholder="misal 6"/>
            </div>
          ):(
            <div style={{marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                <div>
                  <Lbl>Jam Kerja</Lbl>
                  <Inp type="number" min="0" step="0.5" value={overrideJamKerja} onChange={e=>setOverrideJamKerja(e.target.value)}/>
                </div>
                <div>
                  <Lbl>Efektivitas %</Lbl>
                  <Inp type="number" min="0" max="100" value={overrideEfektivitas} onChange={e=>setOverrideEfektivitas(e.target.value)}/>
                </div>
              </div>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                {overrideJamKerja} jam × 60 × {overrideEfektivitas}% = <strong>{Math.round((Number(overrideJamKerja)||0)*60*(Number(overrideEfektivitas)||0)/100)} menit</strong>/hari
              </div>
            </div>
          )}
          {!overrideResult?(
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>setOverrideModal(null)}>Batal</Btn>
              <Btn color="#1d4ed8" disabled={overrideSaving||(overrideModal.proses.length>0&&overrideModal.proses.every(p=>["WIRING CONTROL","WIRING POWER"].includes(p))?!overrideValue:(!overrideJamKerja||!overrideEfektivitas))||overrideModal.proses.length===0||!overrideModal.tanggalMulai||!overrideModal.tanggalAkhir} onClick={async()=>{
                setOverrideSaving(true);
                const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                const uname=user?.name||user?.nama||sess?.nama||"Admin";
                const allShifted:any[]=[];
                let cur=new Date(overrideModal.tanggalMulai);
                const end=new Date(overrideModal.tanggalAkhir);
                let safety=0;
                // AUDIT FIX (21 Sep 2026) - dulu res.success===false DIAM-DIAM diabaikan (gak ada
                // else), allShifted tetap dianggap hasil final yg valid - kalau SEMUA gagal,
                // modal nutup nunjukin "✅ Kapasitas tersimpan" padahal nol yg beneran tersimpan.
                // Sekarang kegagalan dikumpulkan & dilaporkan eksplisit ke admin (CLAUDE.md A.2).
                const gagalList:string[]=[];
                while(cur<=end&&safety<366){
                  const tgl=cur.toISOString().slice(0,10);
                  for(const proses of overrideModal.proses){
                    setOverrideProgress(tgl+" — "+proses);
                    const isOrangOv=["WIRING CONTROL","WIRING POWER"].includes(proses);
                    const kapasitasMenitHitung=Math.round((Number(overrideJamKerja)||0)*60*(Number(overrideEfektivitas)||0)/100);
                    const res=await setOverrideAndRebalance({
                      tanggal:tgl,
                      jenisPekerjaan:proses,
                      kapasitasMenit:isOrangOv?undefined:kapasitasMenitHitung,
                      jumlahOrang:isOrangOv?Number(overrideValue):undefined,
                      createdBy:uname,
                    });
                    if(res.success)allShifted.push(...res.shifted);
                    else gagalList.push(`${tgl} — ${proses}: ${res.error||"gagal tanpa keterangan"}`);
                  }
                  cur.setDate(cur.getDate()+1);
                  safety++;
                }
                setOverrideSaving(false);
                if(gagalList.length>0){
                  alert(`Gagal simpan kapasitas utk ${gagalList.length} kombinasi tanggal/proses:\n\n`+gagalList.join("\n"));
                }
                setOverrideProgress("");
                setOverrideResult(allShifted);
                if(refetchRaw) await refetchRaw();
              }}>
                {overrideSaving?(overrideProgress||"Menyimpan..."):"Simpan"}
              </Btn>
            </div>
          ):(
            <div>
              {overrideResult.length===0?(
                <div style={{textAlign:"center",padding:"16px 0",color:"#16a34a",fontWeight:700,fontSize:13}}>✅ Kapasitas tersimpan, gak ada yang perlu digeser</div>
              ):(
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#92400e",marginBottom:8}}>⚠ {overrideResult.length} komponen digeser ke tanggal berikutnya:</div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:280,overflowY:"auto" as const,marginBottom:14}}>
                    {overrideResult.map((s:any,i:number)=>(
                      <div key={i} style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 12px",fontSize:11}}>
                        <div style={{fontWeight:700,color:"#1e293b"}}>{s.namaKomponen} — {s.panelNama}</div>
                        <div style={{color:"#64748b"}}>WO {s.woNumber} · {s.proyek}</div>
                        <div style={{color:s.overflow?"#dc2626":"#92400e",fontWeight:600,marginTop:2}}>
                          {s.overflow
                            ?`${fmtDate(s.dariTanggal)} — TIDAK dipindah (gak ketemu slot kosong 60 hari, tetap overbook di sini)`
                            :`${fmtDate(s.dariTanggal)} → ${fmtDate(s.keTanggal)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <Btn color="#1d4ed8" onClick={()=>{setOverrideModal(null);setOverrideResult(null);}}>Tutup</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
  return{elemen,setOverrideModal,setOverrideValue,setOverrideResult};
}
