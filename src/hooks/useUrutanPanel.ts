// Prioritas & urutan panel Raw Schedule (dropdown PRIORITAS, geser panel lewat drag/menu ⋮). DIPINDAH APA ADANYA
// dari RawSchedule.tsx (Tahap 3c migrasi accordion, 10 Okt 2026) supaya tampilan lama & "Raw Schedule per WP"
// memakai jalur simpan yang SAMA (RPC atomik pindah_urutan_panel_raw lewat simpanPindahPanel, rollback lokal,
// activity_log UBAH PRIORITAS) - CLAUDE.md B.1. Isi fungsi tidak diubah.
import { useState } from 'react'
import { activityLogService } from '../services/activityLogService'
import { markRenharDirty, markRawDirty, clearRawDirty } from '../lib/globalState'
import { fetchPanelOrderMap, zonaDari, tetanggaSekarang, hitungKeyPindah, simpanPindahPanel, type Zona, type TargetPindah } from '../lib/rawPanelOrder'

export type DepsUrutanPanel={
  rawData:any[];setRawData:(f:any)=>void;
  // renhar yang tampil (tampilan lama: effectiveRenhar) - hanya utk snapshot rollback prioritas lokal
  effectiveRenhar:any[];setRenhar:(f:any)=>void;
  orderMap:Record<number,string>;setOrderMap:(f:any)=>void;
  user:any;
  // panel TERLIHAT urut tampilan (diisi induk saat render)
  blokUrutRef:{current:{panelId:number;zona:Zona}[]};
  tampilToastUrutan:(msg:string)=>void;
  setMenuUrutanPanel:(v:number|null)=>void;
};

export function useUrutanPanel(deps:DepsUrutanPanel){
  const{rawData,setRawData,effectiveRenhar,setRenhar,orderMap,setOrderMap,user,blokUrutRef,tampilToastUrutan,setMenuUrutanPanel}=deps;
  const [savingUrutan,setSavingUrutan]=useState(false);
  const namaUserAktif=()=>{
    let sess:any={};try{sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");}catch{}
    return user?.name||user?.nama||sess?.nama||"Admin";
  };
  const rowsPanelOf=(panelId:number)=>rawData.filter((r:any)=>Number(r.panel_id||r.panelId)===panelId);
  const semuaPanelInfo=(map:Record<number,string>)=>{
    const seen=new Map<number,any>();
    rawData.forEach((r:any)=>{
      const id=Number(r.panel_id||r.panelId);
      if(!id||seen.has(id))return;
      seen.set(id,{panelId:id,zona:zonaDari(r.prioritas),key:map[id]||null});
    });
    return[...seen.values()];
  };
  // Optimistic prioritas lokal (raw + renhar) + snapshot buat rollback.
  const terapkanPrioritasLokal=(panelId:number,val:string)=>{
    const rowsPanel=rowsPanelOf(panelId);
    const snapRaw=rowsPanel.map((r:any)=>({id:r.id,prioritas:r.prioritas}));
    const snapRenhar=effectiveRenhar.filter((r:any)=>Number(r.panel_id||r.panelId)===panelId).map((r:any)=>({id:r.id,prioritas:r.prioritas}));
    rowsPanel.forEach((r:any)=>markRawDirty(r.id));
    snapRenhar.forEach((r:any)=>markRenharDirty(r.id));
    setRawData((prev:any[])=>prev.map((r:any)=>Number(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    setRenhar((prev:any[])=>prev.map((r:any)=>Number(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    return()=>{
      setRawData((prev:any[])=>prev.map((r:any)=>{const s=snapRaw.find(x=>x.id===r.id);return s?{...r,prioritas:s.prioritas}:r;}));
      setRenhar((prev:any[])=>prev.map((r:any)=>{const s=snapRenhar.find(x=>x.id===r.id);return s?{...r,prioritas:s.prioritas}:r;}));
    };
  };
  const logUbahPrioritas=async(panelId:number,lama:string,baru:string,sumber:string)=>{
    const r0=rowsPanelOf(panelId)[0];
    await activityLogService.insert({
      user_name:namaUserAktif(),action:"UBAH PRIORITAS",
      description:`Prioritas ${r0?.panel} (${r0?.proyek}) ${lama} → ${baru} (${sumber})`,
      module:"raw",halaman:"Raw Schedule",proyek:r0?.proyek||"",panel:r0?.panel||"",
    });
  };

  // Dropdown PRIORITAS - posisi di zona baru tetap ngikut order_key panel itu (keputusan user).
  const updatePrioritasPanel=async(panelIdRaw:any,val:string)=>{
    const panelId=Number(panelIdRaw);
    const rowsPanel=rowsPanelOf(panelId);
    if(!rowsPanel.length)return;
    const lama=zonaDari(rowsPanel[0].prioritas);
    if(lama===val)return;
    const rollback=terapkanPrioritasLokal(panelId,val);
    const res=await simpanPindahPanel({panelId,orderKey:null,prioritas:val as Zona,materialize:[],user:namaUserAktif()});
    rowsPanel.forEach((r:any)=>clearRawDirty(r.id));
    if(!res.ok){
      rollback();
      alert(`Gagal mengubah prioritas ${rowsPanel[0].panel}: ${res.message}\n\nPrioritas dikembalikan ke ${lama}.`);
      return;
    }
    await logUbahPrioritas(panelId,lama,val,"dropdown");
  };

  // Geser panel (drag handle ⠿ / menu ⋮). target = zona + tetangga TERLIHAT di zona itu.
  const pindahPanel=async(panelId:number,target:TargetPindah)=>{
    if(savingUrutan)return;
    const sekarang=tetanggaSekarang(blokUrutRef.current,panelId);
    if(sekarang&&sekarang.zona===target.zona&&sekarang.prevId===target.prevId&&sekarang.nextId===target.nextId)return; // gak pindah
    const rowsPanel=rowsPanelOf(panelId);
    if(!rowsPanel.length)return;
    const namaPanel=rowsPanel[0].panel;
    const zonaLama=zonaDari(rowsPanel[0].prioritas);
    const lintas=zonaLama!==target.zona;
    const snapKey=orderMap[panelId];
    const materializedSemua:number[]=[];
    const pasangKeyLokal=(base:Record<number,string>,h:{orderKey:string;materialize:{panel_id:number;order_key:string}[]})=>{
      const n={...base,[panelId]:h.orderKey};
      h.materialize.forEach(m=>{n[m.panel_id]=m.order_key;materializedSemua.push(m.panel_id);});
      return n;
    };
    setSavingUrutan(true);
    let hasil=hitungKeyPindah(semuaPanelInfo(orderMap),panelId,target);
    setOrderMap(prev=>pasangKeyLokal(prev,hasil));
    const rollbackPrioritas=lintas?terapkanPrioritasLokal(panelId,target.zona):null;
    const simpan=()=>simpanPindahPanel({panelId,orderKey:hasil.orderKey,prioritas:lintas?target.zona:null,materialize:hasil.materialize,user:namaUserAktif()});
    let res=await simpan();
    if(!res.ok){
      // Retry SEKALI pakai key segar dari server - kasus utama: 23505 (user lain barusan nyisip
      // di celah yang sama, key kembar ditolak unique index). Tampilan gak berubah selama retry.
      try{
        const segar=await fetchPanelOrderMap();
        hasil=hitungKeyPindah(semuaPanelInfo(segar),panelId,target);
        setOrderMap(pasangKeyLokal(segar,hasil));
        res=await simpan();
      }catch(e:any){res={ok:false,message:String(e?.message||e)};}
    }
    rowsPanel.forEach((r:any)=>clearRawDirty(r.id));
    setSavingUrutan(false);
    if(!res.ok){
      // RPC atomik -> DB pasti masih keadaan lama; balikin tampilan dalam 1 render.
      setOrderMap(prev=>{
        const n={...prev};
        if(snapKey)n[panelId]=snapKey;else delete n[panelId];
        materializedSemua.forEach(id=>{delete n[id];});
        return n;
      });
      rollbackPrioritas?.();
      alert(`Gagal memindahkan ${namaPanel}: ${res.message}\n\nUrutan${lintas?" & prioritas":""} dikembalikan seperti semula.`);
      return;
    }
    if(lintas){
      tampilToastUrutan(`Prioritas ${namaPanel} diubah: ${zonaLama} → ${target.zona}`);
      await logUbahPrioritas(panelId,zonaLama,target.zona,"geser urutan panel");
    }
  };

  // Menu ⋮ - SENGAJA cuma di dalam zona yang sama (pindah zona cuma lewat drag dgn indikator
  // amber, atau dropdown PRIORITAS - biar prioritas gak pernah berubah diam-diam lewat "Naik 1").
  const pindahViaMenu=(panelId:number,aksi:"atas"|"naik"|"turun"|"bawah")=>{
    setMenuUrutanPanel(null);
    const me=blokUrutRef.current.find(b=>b.panelId===panelId);
    if(!me)return;
    const bz=blokUrutRef.current.filter(b=>b.zona===me.zona).map(b=>b.panelId);
    const i=bz.indexOf(panelId);
    let t:TargetPindah|null=null;
    if(aksi==="atas"&&i>0)t={zona:me.zona,prevId:null,nextId:bz[0]};
    if(aksi==="naik"&&i>0)t={zona:me.zona,prevId:bz[i-2]??null,nextId:bz[i-1]};
    if(aksi==="turun"&&i<bz.length-1)t={zona:me.zona,prevId:bz[i+1],nextId:bz[i+2]??null};
    if(aksi==="bawah"&&i<bz.length-1)t={zona:me.zona,prevId:bz[bz.length-1],nextId:null};
    if(t)pindahPanel(panelId,t);
  };
  return{savingUrutan,rowsPanelOf,updatePrioritasPanel,pindahPanel,pindahViaMenu};
}
