import { useState } from 'react'
import { RencanaHarian } from './RencanaHarian'
import { KomponenTambahanMonitor } from './KomponenTambahanMonitor'

export function RencanaHarianHome(props:any){
  const [subTab,setSubTab]=useState<'rencana'|'tambahan'>('rencana');
  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <button onClick={()=>setSubTab('rencana')}
          style={{padding:'7px 16px',borderRadius:8,border:`1.5px solid ${subTab==='rencana'?'#2563eb':'#e2e8f0'}`,
            background:subTab==='rencana'?'#2563eb':'#fff',color:subTab==='rencana'?'#fff':'#64748b',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          Rencana Harian
        </button>
        <button onClick={()=>setSubTab('tambahan')}
          style={{padding:'7px 16px',borderRadius:8,border:`1.5px solid ${subTab==='tambahan'?'#2563eb':'#e2e8f0'}`,
            background:subTab==='tambahan'?'#2563eb':'#fff',color:subTab==='tambahan'?'#fff':'#64748b',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          Komponen Tambahan
        </button>
      </div>
      <div style={{display:subTab==='rencana'?'block':'none'}}><RencanaHarian {...props}/></div>
      {subTab==='tambahan'&&<KomponenTambahanMonitor/>}
    </div>
  );
}
