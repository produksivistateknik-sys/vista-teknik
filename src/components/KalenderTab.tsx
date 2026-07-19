import { useState, useMemo } from 'react'
import { woOverall } from '../lib/panelHelpers'
import { isDelayed, isUrgent, getLocalDateStr, fmtDate } from '../lib/dateHelpers'
import { Modal } from './ui/Primitives'

export function KalenderTab({woData}:{woData:any[]}){
  const [viewMonth,setViewMonth]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;});
  const [selectedDay,setSelectedDay]=useState<string|null>(null);

  const [year,month]=viewMonth.split("-").map(Number);
  const firstDay=new Date(year,month-1,1);
  const lastDay=new Date(year,month,0);
  const daysInMonth=lastDay.getDate();
  const startWeekday=firstDay.getDay();

  const eventsByDate=useMemo(()=>{
    const map:Record<string,any[]>={};
    (woData||[]).forEach((w:any)=>{
      if(!w.target)return;
      if(!w.target.startsWith(viewMonth))return;
      const pct=woOverall(w);
      const status=pct>=100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
      if(!map[w.target])map[w.target]=[];
      map[w.target].push({wo:w.wo,proyek:w.proyek,panelCount:(w.panels||[]).length,pct,status});
    });
    return map;
  },[woData,viewMonth]);

  const STATUS_COLOR_CAL:Record<string,string>={selesai:"#16a34a",terlambat:"#dc2626",mendesak:"#f59e0b",ontrack:"#2563eb"};

  const prevMonth=()=>{
    const d=new Date(year,month-2,1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  };
  const nextMonth=()=>{
    const d=new Date(year,month,1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  };

  const cells:any[]=[];
  for(let i=0;i<startWeekday;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);

  const MONTH_NAMES=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const DAY_NAMES=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

  return(
    <div style={{padding:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={prevMonth} style={{border:"1px solid #e2e8f0",borderRadius:6,background:"#fff",padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>‹</button>
          <span style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{MONTH_NAMES[month-1]} {year}</span>
          <button onClick={nextMonth} style={{border:"1px solid #e2e8f0",borderRadius:6,background:"#fff",padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>›</button>
        </div>
        <div style={{fontSize:10,color:"#94a3b8"}}>Menampilkan deadline Work Order</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"#e2e8f0",border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{background:"#f8fafc",padding:"6px 8px",fontSize:10,fontWeight:700,color:"#64748b",textAlign:"center" as const}}>{d}</div>
        ))}
        {cells.map((d,i)=>{
          if(d===null)return <div key={i} style={{background:"#fafafa",minHeight:90}}/>;
          const tgl=`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const events=eventsByDate[tgl]||[];
          const isToday=tgl===getLocalDateStr();
          return(
            <div key={i} onClick={()=>events.length>0&&setSelectedDay(tgl)}
              style={{background:"#fff",minHeight:90,padding:6,cursor:events.length>0?"pointer":"default",border:isToday?"2px solid #1d4ed8":"none"}}>
              <div style={{fontSize:10,fontWeight:700,color:isToday?"#1d4ed8":"#64748b",marginBottom:4}}>{d}</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                {events.slice(0,3).map((e:any,ei:number)=>(
                  <div key={ei} style={{fontSize:8.5,background:STATUS_COLOR_CAL[e.status]+"18",color:STATUS_COLOR_CAL[e.status],borderRadius:3,padding:"1px 4px",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>
                    WO {e.wo} - {e.proyek}
                  </div>
                ))}
                {events.length>3&&(
                  <div style={{fontSize:8,color:"#94a3b8",fontWeight:600}}>+{events.length-3} lagi</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selectedDay&&(
        <Modal title={"WO Jatuh Tempo "+fmtDate(selectedDay)} onClose={()=>setSelectedDay(null)} width={480}>
          <div style={{display:"flex",flexDirection:"column" as const,gap:8,maxHeight:400,overflowY:"auto" as const}}>
            {(eventsByDate[selectedDay]||[]).map((e:any,i:number)=>(
              <div key={i} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {e.wo}</span>
                  <span style={{background:STATUS_COLOR_CAL[e.status]+"18",color:STATUS_COLOR_CAL[e.status],borderRadius:6,padding:"1px 8px",fontSize:10,fontWeight:700}}>{e.status}</span>
                </div>
                <div style={{fontSize:12,color:"#64748b",marginTop:4}}>{e.proyek} · {e.panelCount} panel</div>
                <div style={{width:"100%",height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginTop:6}}>
                  <div style={{width:e.pct+"%",height:"100%",background:STATUS_COLOR_CAL[e.status],borderRadius:99}}/>
                </div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:2,textAlign:"right" as const}}>{e.pct}%</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
