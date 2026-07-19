import { useState } from 'react'
import { KomponenStokTab } from './KomponenStokTab'

export function InventarisWrapper({user,activityLog}:any){
  const [invTab,setInvTab]=useState("data");
  const btnS=(active:boolean):any=>({
    padding:"8px 18px",fontSize:12,fontWeight:active?700:500,
    color:active?"#1d4ed8":"#64748b",cursor:"pointer",
    background:active?"#eff6ff":"transparent",
    border:"none",borderBottom:active?"2px solid #1d4ed8":"2px solid transparent",
    fontFamily:"inherit",borderRadius:"6px 6px 0 0",
  });
  return(
    <div>
      <div style={{display:"flex",gap:2,marginBottom:14,borderBottom:"1px solid #e2e8f0"}}>
        <button style={btnS(invTab==="data")} onClick={()=>setInvTab("data")}>📋 Data Komponen</button>
        <button style={btnS(invTab==="riwayat")} onClick={()=>setInvTab("riwayat")}>🕒 Riwayat Transaksi</button>
      </div>
      <KomponenStokTab user={user} activityLog={activityLog} invTab={invTab}/>
    </div>
  );
}
