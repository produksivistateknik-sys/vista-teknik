// Modal "Tambah Panel ke Raw Schedule" (buat baris raw_schedule utk proses relevan yang belum ada).
// DIPINDAH APA ADANYA dari RawSchedule.tsx (Tahap 3c migrasi accordion, 10 Okt 2026) supaya tampilan lama &
// "Raw Schedule per WP" memakai alur yang SAMA - CLAUDE.md B.1. Isi fungsi & JSX tidak diubah.
import { useState } from 'react'
import { PRIORITAS } from '../constants/panelTypes'
import { getRelevantProsesForKode } from '../lib/panelHelpers'
import { Modal, Lbl, Btn, Sel } from './ui/Primitives'

export function useTambahPanelRaw({woData,rawData,createRaw,refetchRaw,log}:{woData:any[];rawData:any[];createRaw:(d:any)=>Promise<any>;refetchRaw:()=>any;log?:any}){
  const [addModal,setAddModal]=useState(false);
  const [addForm,setAddForm]=useState<{woId:string;panelIds:number[];prioritas:string}>({woId:"",panelIds:[],prioritas:"Sedang"});
  const getMissingRelevantProses=(p:any):string[]=>{
    const existingProsesP=rawData.filter((r:any)=>(r.panel_id||r.panelId)===p.id).map((r:any)=>r.proses);
    const activeKodes=Object.entries(p.checklist||{}).filter(([,v]:any)=>(v?.qty||0)>0).map(([k])=>k);
    const relevantSet=new Set<string>();
    activeKodes.forEach((kode:string)=>getRelevantProsesForKode(kode,p.tipe).forEach((pr:string)=>relevantSet.add(pr)));
    // NAMEPLATE/YELLOWMARK (16 Sep 2026) - dihapus dari Raw Schedule sesuai permintaan user,
    // getRelevantProsesForKode() TETAP nyertain keduanya (dipakai juga di TaskMonitoring/
    // RencanaHarian buat gating status "whole panel", jangan disentuh fungsi bersama itu) -
    // filter khusus di sini aja biar "Tambah Panel" gak pernah nawarin/bikin baris ini lagi.
    return [...relevantSet].filter((pr:string)=>pr!=="NAMEPLATE"&&pr!=="YELLOWMARK"&&!existingProsesP.includes(pr));
  };
  const panelOpts=addForm.woId?(woData.find(w=>w.id===Number(addForm.woId))?.panels||[]).filter((p:any)=>getMissingRelevantProses(p).length>0):[];
  const [addLoading,setAddLoading]=useState(false);
  const submitAdd=async()=>{
    if(addLoading)return;
    if(!addForm.woId||addForm.panelIds.length===0)return;
    const wo=woData.find(w=>w.id===Number(addForm.woId));
    if(!wo)return;
    setAddLoading(true);
    let totalPanelDitambah=0;
    for(const panelId of addForm.panelIds){
      const p=wo.panels.find(x=>x.id===panelId);
      if(!p)continue;
      const toAdd=getMissingRelevantProses(p);
      if(!toAdd.length)continue;
      for(const proses of toAdd){
        await createRaw({
          wo_id:wo.id,panel_id:p.id,proyek:wo.proyek,panel:p.nama,
          proses,prioritas:addForm.prioritas,schedule:{}
        });
      }
      totalPanelDitambah++;
      if(log) await log("TAMBAH RAW SCHEDULE","Tambah Panel "+p.nama+" ke Raw Schedule","raw_schedule",{module:"raw",action_type:"create",proyek:wo.proyek||"",panel:p.nama||"",wo_number:wo.wo||"",halaman:"Raw Schedule"});
    }
    await refetchRaw();
    setAddLoading(false);
    if(totalPanelDitambah===0){alert("Semua proses panel yang dipilih sudah ada!");}
    setAddModal(false);setAddForm({woId:"",panelIds:[],prioritas:"Sedang"});
  };
  const elemen=(
    <>
      {addModal&&(
        <Modal title="Tambah Panel ke Raw Schedule" onClose={()=>setAddModal(false)} width={480}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><Lbl>Work Order</Lbl>
              <Sel value={addForm.woId} onChange={e=>setAddForm({...addForm,woId:e.target.value,panelIds:[]})}>
                <option value="">-- Pilih WO --</option>
                {woData.filter((w:any)=>(w.panels||[]).some((p:any)=>getMissingRelevantProses(p).length>0)).map((w:any)=><option key={w.id} value={w.id}>WO {w.wo} — {w.proyek}</option>)}
              </Sel>
            </div>
            <div><Lbl>Panel ({addForm.panelIds.length} dipilih)</Lbl>
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <button type="button" onClick={()=>setAddForm({...addForm,panelIds:panelOpts.map((p:any)=>p.id)})}
                  style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",padding:0}}>Pilih Semua</button>
                <button type="button" onClick={()=>setAddForm({...addForm,panelIds:[]})}
                  style={{fontSize:11,color:"#64748b",background:"none",border:"none",cursor:"pointer",padding:0}}>Hapus Semua</button>
              </div>
              <div style={{maxHeight:220,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:6}}>
                {panelOpts.length===0&&(
                  <div style={{fontSize:12,color:"#94a3b8",padding:8,textAlign:"center" as const}}>Tidak ada panel tersedia</div>
                )}
                {panelOpts.map((p:any)=>{
                  const checked=addForm.panelIds.includes(p.id);
                  return(
                    <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",background:checked?"#eff6ff":"transparent"}}>
                      <input type="checkbox" checked={checked} onChange={()=>{
                        setAddForm(prev=>({...prev,panelIds:checked?prev.panelIds.filter(id=>id!==p.id):[...prev.panelIds,p.id]}));
                      }}/>
                      <span style={{fontSize:13,color:"#1e293b"}}>#{p.no_pnl||p.noPnl} — {p.nama}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div><Lbl>Prioritas</Lbl>
              <Sel value={addForm.prioritas} onChange={e=>setAddForm({...addForm,prioritas:e.target.value})}>
                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setAddModal(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={submitAdd} disabled={addLoading}>{addLoading?"Menambahkan...":"Tambah Panel"}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
  return{elemen,setAddModal};
}
