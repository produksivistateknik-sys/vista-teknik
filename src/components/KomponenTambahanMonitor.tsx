import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card } from './ui/Primitives'

const STATUS_LABEL:Record<string,string> = { belum_mulai:'Belum Mulai', berjalan:'Sedang Dikerjakan', selesai:'Selesai' }
const STATUS_COLOR:Record<string,string> = { belum_mulai:'#94a3b8', berjalan:'#d97706', selesai:'#16a34a' }

function fmtJam(ts:string|null){
  if(!ts)return '-';
  const d=new Date(ts);
  return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}

function durasiLabel(mulai:string|null,selesai:string|null){
  if(!mulai)return '-';
  const end=selesai?new Date(selesai).getTime():Date.now();
  const menit=Math.max(0,Math.round((end-new Date(mulai).getTime())/60000));
  const jam=Math.floor(menit/60);
  return jam>0?`${jam}j ${menit%60}m`:`${menit}m`;
}

export function KomponenTambahanMonitor(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  const fetchItems=async()=>{
    const{data}=await supabase.from('komponen_tambahan').select('*').order('tanggal',{ascending:false}).order('created_at',{ascending:false}).limit(500);
    setItems(data??[]);
    setLoading(false);
  };

  useEffect(()=>{
    fetchItems();
    const ch=supabase.channel('komponen_tambahan_monitor')
      .on('postgres_changes',{event:'*',schema:'public',table:'komponen_tambahan'},()=>fetchItems())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const grouped:Record<string,Record<string,any[]>> = {};
  items.forEach(it=>{
    grouped[it.tanggal]=grouped[it.tanggal]||{};
    (grouped[it.tanggal][it.shift]=grouped[it.tanggal][it.shift]||[]).push(it);
  });
  const tanggalList=Object.keys(grouped).sort((a,b)=>b<a?-1:1);

  if(loading)return <Card style={{padding:20,textAlign:'center',color:'#94a3b8'}}>Memuat...</Card>;

  return(
    <div>
      <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>
        Monitoring komponen tambahan (ad-hoc) yang diinput operator Potong di luar jadwal/BOM normal. Read-only.
      </div>
      {tanggalList.length===0&&(
        <Card style={{padding:20,textAlign:'center',color:'#94a3b8'}}>Belum ada komponen tambahan.</Card>
      )}
      {tanggalList.map(tgl=>(
        <Card key={tgl} style={{marginBottom:12,padding:'12px 14px'}}>
          <div style={{fontWeight:800,fontSize:13,color:'#1e293b',marginBottom:8}}>📅 {tgl}</div>
          {Object.keys(grouped[tgl]).sort().map(shift=>(
            <div key={shift} style={{marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6d28d9',marginBottom:6}}>Shift {shift}</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {grouped[tgl][shift].map((it:any)=>(
                  <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,background:'#f8fafc',borderRadius:8,padding:'8px 10px',flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#334155'}}>{it.nama_komponen} <span style={{fontWeight:600,color:'#d97706'}}>({it.qty} pcs)</span></div>
                      <div style={{fontSize:10.5,color:'#94a3b8',marginTop:2}}>{it.proyek||'-'} • {it.wo||'-'} • {it.panel_nama||'-'}</div>
                    </div>
                    <div style={{fontSize:10.5,color:'#64748b'}}>👤 {it.operator_nama||'-'}</div>
                    <div style={{fontSize:10.5,color:'#64748b'}}>{fmtJam(it.waktu_mulai)} → {fmtJam(it.waktu_selesai)} ({durasiLabel(it.waktu_mulai,it.waktu_selesai)})</div>
                    <span style={{background:STATUS_COLOR[it.status]+'20',color:STATUS_COLOR[it.status],borderRadius:20,padding:'2px 9px',fontSize:10,fontWeight:700}}>{STATUS_LABEL[it.status]||it.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
