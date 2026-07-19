export function getLocalDateStr(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
export const TODAY=getLocalDateStr();
export function daysUntil(t){ return Math.ceil((new Date(t)-new Date(TODAY))/86400000); }
export function isDelayed(t){ return daysUntil(t)<0; }
export function isUrgent(t){ const d=daysUntil(t); return d>=0&&d<=7; }  // H-7
export function getStatus(t,pct){
  if(pct===100) return {label:"SELESAI",   color:"#16a34a", bg:"#dcfce7"};
  if(isDelayed(t)) return {label:"TERLAMBAT",color:"#dc2626", bg:"#fee2e2"};
  if(isUrgent(t))  return {label:"MENDESAK", color:"#ea580c", bg:"#ffedd5"};
  return {label:"ON TRACK",color:"#2563eb", bg:"#dbeafe"};
}
export function pColor(v){
  if(v===100)return"#16a34a"; if(v>=75)return"#ca8a04";
  if(v>=50)return"#ea580c";  if(v>=25)return"#dc2626";
  if(v>0)return"#7c3aed";    return"#94a3b8";
}
export function pBg(v){
  if(v===100)return"#dcfce7"; if(v>=75)return"#fef9c3";
  if(v>=50)return"#ffedd5";  if(v>=25)return"#fee2e2";
  if(v>0)return"#f3f0ff";    return"#f1f5f9";
}
export function addDays(s,n){ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
export function fmtDate(s){ return new Date(s).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
export function fmtShort(s){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }
export function getDayLabel(s){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }
export function fmtDateFull(s){ return new Date(s).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
