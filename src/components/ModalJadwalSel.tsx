// Modal "Jadwal <tanggal> — <proses>" (tambah/edit/hapus WP & komponen, pilih komponen BUSBAR, bobot WIRING)
// beserta modal ikutannya (Kapasitas Penuh / Kuota Orang Penuh). DIPINDAH APA ADANYA dari RawSchedule.tsx
// (Tahap 3b migrasi accordion, 9 Okt 2026) supaya tampilan lama & "Raw Schedule per WP" memakai modal,
// validasi kapasitas, sinkron renhar & log yang SAMA (CLAUDE.md B.1). Isi fungsi & JSX tidak diubah;
// satu-satunya tambahan: pilih-komponen-untuk-"Pindahin" hanya aktif bila induk menyediakan alurnya
// (setMoveKomponenState) - tampilan accordion punya alur pindah sendiri.
import { useState } from 'react'
import { activityLogService as activityLogServiceAsli } from '../services/activityLogService'
import * as fcsAsli from '../services/fcsService'
import { hariKeNFromMap } from '../services/fcsService'
import type { IoJadwalRaw } from '../lib/ioJadwalRaw'
import { ALL_PROSES, WP_LIST, PROSES_COLOR, WP_COLOR, BUSBAR_COLORS } from '../constants/panelTypes'
import { isKomponenRelevant, getBusbarKomponen, getProgressAsOfDate, getQtyProsesAsOfDate, WIRING_BOBOT_LIST, WIRING_BOBOT_LABEL, WIRING_BOBOT_COLOR, WIRING_BOBOT_TABLE, kebutuhanOrangWiring } from '../lib/panelHelpers'
import { markRenharDirty as markRenharDirtyAsli, markRawDirty as markRawDirtyAsli } from '../lib/globalState'
import { tanganiGagalSinkronRenhar } from '../lib/renharSinkron'
import { TODAY, fmtDate, getDayLabel } from '../lib/dateHelpers'
import { Modal, Lbl, Btn } from './ui/Primitives'

// Nama komponen dari kode BOM (tipe panel efektif) & "semua komponen WP ini sudah selesai di proses ini" -
// dipakai RawSchedule.tsx & modal ini (satu sumber).
export const namaKomponenDariKode=(woData:any[],getEffCfg:(tipe:string)=>any,panelId:number,kode:string):string=>{
  const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
  const tipe=panelData?.tipe;
  if(!tipe)return kode;
  const item=getEffCfg(tipe)?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode);
  return item?.nama||kode;
};
export const wpSelesai=(getEffCfg:(tipe:string)=>any,panelData:any,wp:string,proses:string)=>{
  if(!panelData)return false;
  const cfg=getEffCfg(panelData.tipe);
  const wpDef=cfg?.wps.find((w:any)=>w.wp===wp);
  if(!wpDef||!wpDef.items.length)return false;
  return wpDef.items.every((it:any)=>{
    const cl=panelData.checklist?.[it.kode];
    if(!cl)return false;
    return(cl.progress?.[proses]||0)>=100;
  });
};

export type DepsModalJadwalSel={
  woData:any[];rawData:any[];setRawData:(f:any)=>void;updateRaw:(id:number,data:any)=>Promise<any>;user:any;
  getEffCfg:(tipe:string)=>any;getMenitPerPcs:(tipe:string,proses:string,kode:string)=>number;wiringHariKerjaMap:Record<string,string[]>;
  withRenharQueue:(task:any,fn:(existing:any)=>Promise<void>)=>Promise<any>;createRenhar:(d:any)=>Promise<any>;updateRenhar:(id:any,d:any)=>Promise<any>;removeRenhar:(id:any)=>Promise<any>;setRenhar:(f:any)=>void;
  // opsional - alur "pilih komponen lalu Pindahin → klik tanggal tujuan" milik tampilan lama
  selectedForMove?:{wp:string;kode:string}[];setSelectedForMove?:(v:any)=>void;toggleSelectForMove?:(wp:string,kode:string)=>void;setMoveKomponenState?:(v:any)=>void;
  // opsional - sumber data/log lain (sandbox Raw Schedule per WP); tanpa io = Supabase & activity_log asli
  io?:IoJadwalRaw;
};

export function useModalJadwalSel(deps:DepsModalJadwalSel){
  const{woData,rawData,setRawData,updateRaw,user,getEffCfg,getMenitPerPcs,wiringHariKerjaMap,withRenharQueue,createRenhar,updateRenhar,removeRenhar,setRenhar}=deps;
  const bisaPilihPindah=!!deps.setMoveKomponenState;
  const selectedForMove=bisaPilihPindah?(deps.selectedForMove||[]):[];
  const setSelectedForMove=deps.setSelectedForMove||(()=>{});
  const toggleSelectForMove=deps.toggleSelectForMove||(()=>{});
  const setMoveKomponenState=deps.setMoveKomponenState||(()=>{});
  const getNamaKomponenDariKode=(panelId:number,kode:string):string=>namaKomponenDariKode(woData,getEffCfg,panelId,kode);
  const isWpDone=(panelData:any,wp:string,proses:string)=>wpSelesai(getEffCfg,panelData,wp,proses);
  const PROSES_ORANG_RAW=["WIRING POWER","WIRING CONTROL"];
  // I/O (nama sama dgn impor lama -> isi fungsi di bawah tidak diubah)
  const{checkKapasitasDanKomponenSwapV2,executeSwapKomponenV2,checkKuotaOrangDanKomponenSwap,executeSwapKomponenOrang}=deps.io?.fcs??fcsAsli;
  const activityLogService=deps.io?.log??activityLogServiceAsli;
  const markRawDirty=deps.io?.kotor.markRaw??markRawDirtyAsli;
  const markRenharDirty=deps.io?.kotor.markRenhar??markRenharDirtyAsli;
  const [cellModal,setCellModal]=useState(null);
  const [modalWp,setModalWp]=useState("");
  const [modalKomponen,setModalKomponen]=useState([]);
  // REVISI TOTAL (12 Agu 2026): ganti modalOrangPerKomponen (jumlah orang tetap, dipilih manual)
  // dan bobotCepat/jumlahOrangBobot (batch-assign N hari sekaligus) - bobot sekarang dipilih SEKALI
  // per komponen (bukan per batch/tim), disimpan row-level (raw_schedule.bobot_komponen), kebutuhan
  // orang per hari dihitung otomatis (kebutuhanOrangWiring, lihat panelHelpers.ts). Planner gak perlu
  // lagi nebak "berapa hari"/jumlah orang - cascading engine (auto-geser) yang urus spread-nya.
  const [modalBobotPerKomponen,setModalBobotPerKomponen]=useState<Record<string,string>>({});
  const [swapModal,setSwapModal]=useState<any>(null);
  const [swapSelected,setSwapSelected]=useState<string[]>([]);
  const [swapExpandedPanel,setSwapExpandedPanel]=useState<Record<string,boolean>>({});
  const [swapLoading,setSwapLoading]=useState(false);
  const [swapOrangModal,setSwapOrangModal]=useState<any>(null);
  const [swapOrangSelected,setSwapOrangSelected]=useState<string[]>([]);
  const [swapOrangExpandedPanel,setSwapOrangExpandedPanel]=useState<Record<string,boolean>>({});
  const [swapOrangLoading,setSwapOrangLoading]=useState(false);
  const [busbarSel,setBusbarSel]=useState<string[]>([]);

  const openCellModal=(rawId,date)=>{
    setCellModal({rawId,date});
    setModalWp("");
    setModalKomponen([]);
    // Load existing busbar selections
    const row=rawData.find(r=>r.id===rawId);
    setBusbarSel(row?.busbar_schedule?.[date]||[]);
  };
  const rawRow=cellModal?rawData.find(r=>r.id===cellModal.rawId):null;
  const cellEntries=rawRow?.schedule?.[cellModal?.date]||[];
  const livePanelForCell=rawRow?woData.flatMap(w=>w.panels||[]).find(p=>Number(p.id)===Number(rawRow.panel_id||rawRow.panelId)):null;
  // Sisa qty yang beneran perlu dijadwalkan: total dikurangi yang lebih besar antara "sudah
  // dijadwalkan" (cegah dobel-jadwal, dari raw_schedule) dan "sudah dikerjakan beneran"
  // (progress asli operator, panels.checklist.qtyProses) - dipakai buat validasi kapasitas
  // DAN badge tampilan di daftar pilih komponen.
  const hitungSisaQty=(kode:string)=>{
    const prosesCek=rawRow?.proses;
    const totalQty=livePanelForCell?.checklist?.[kode]?.qty||0;
    let sudahTerjadwal=0;
    const schedule=rawRow?.schedule||{};
    Object.entries(schedule).forEach(([tgl,entries]:[string,any])=>{
      (entries as any[]).forEach((e:any)=>{
        if(cellModal&&tgl===cellModal.date&&e.wp===modalWp)return;
        if((e.komponen||[]).includes(kode))sudahTerjadwal+=e.qtyPerKomponen?.[kode]??totalQty;
      });
    });
    const qtyProsesSelesai=livePanelForCell?.checklist?.[kode]?.qtyProses?.[prosesCek||""]||0;
    const sudah=Math.max(sudahTerjadwal,qtyProsesSelesai);
    return{sisa:Math.max(0,totalQty-sudah),totalQty,qtyProsesSelesai};
  };
  const panelCfg=livePanelForCell?getEffCfg(livePanelForCell.tipe):null;
  const wpItemsAll=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];
  const komponenSudahAda=cellEntries.find(e=>e.wp===modalWp)?.komponen||[];
  const komponenSudahDipakaiTanggalLain=(()=>{
    const result=new Set<string>();
    const schedule=rawRow?.schedule||{};
    Object.entries(schedule).forEach(([tgl,entries]:[string,any])=>{
      if(tgl===cellModal?.date)return;
      (entries||[]).forEach((e:any)=>{
        (e.komponen||[]).forEach((kode:string)=>{
          const progress=livePanelForCell?.checklist?.[kode]?.progress?.[rawRow?.proses||""]||0;
          if(progress>=100){result.add(kode);return;}
          if(tgl>=TODAY)result.add(kode);
        });
      });
    });
    return result;
  })();
  const wpItems=wpItemsAll.filter(it=>{
    const qty=livePanelForCell?.checklist?.[it.kode]?.qty||0;
    if(qty<=0)return false;
    return isKomponenRelevant(it.kode,livePanelForCell?.tipe||"",rawRow?.proses||"")&&!komponenSudahAda.includes(it.kode)&&!komponenSudahDipakaiTanggalLain.has(it.kode);
  });

  const syncRenharKomp=async(rawId,date,wp,newKomp)=>{
    const newKompBersih=(newKomp||[]).filter((k:string)=>!k.startsWith("__wiring_"));
    await withRenharQueue({rawId,wp,tanggal:date},async(existing)=>{
      if(existing){
        markRenharDirty(existing.id);
        const upd=await updateRenhar(existing.id,{komponen:newKompBersih});
        if(!upd?.success)throw Object.assign(new Error(upd?.error||"Gagal menyimpan rencana harian"),{code:(upd as any)?.code});
        setRenhar(prev=>prev.map(r=>r.id===existing.id?{...r,komponen:newKompBersih}:r));
      } else {
        setRenhar(prev=>prev.map(r=>(String(r.raw_id||r.rawId)===String(rawId)&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKompBersih}:r));
      }
    });
  };
  const syncRenharDel=async(rawId,date,wp)=>{
    await withRenharQueue({rawId,wp,tanggal:date},async(existing)=>{
      if(existing){
        const del=await removeRenhar(existing.id);
        if(!del?.success)throw Object.assign(new Error(del?.error||"Gagal menghapus rencana harian"),{code:(del as any)?.code});
        setRenhar(prev=>prev.filter(r=>r.id!==existing.id));
      } else {
        setRenhar(prev=>prev.filter(r=>!(String(r.raw_id||r.rawId)===String(rawId)&&r.wp===wp&&r.tanggal===date)));
      }
    });
  };

  const ESTAFET_LOCK_AKTIF=false; // ganti ke true buat nyalain lock estafet lagi
  const checkEstafet=(kode:string,tipe:string,targetProses:string,panelId:number):{ok:boolean;prosesSebelum?:string}=>{
    if(!ESTAFET_LOCK_AKTIF)return{ok:true};
    const relevantProses=ALL_PROSES.filter((pr:string)=>isKomponenRelevant(kode,tipe,pr));
    const idx=relevantProses.indexOf(targetProses);
    if(idx<=0)return{ok:true};
    const prosesSebelum=relevantProses[idx-1];
    const rowSebelum=rawData.find((r:any)=>(r.panel_id||r.panelId)===panelId&&r.proses===prosesSebelum);
    if(!rowSebelum)return{ok:false,prosesSebelum};
    const schedule=rowSebelum.schedule||{};
    const adaTerjadwal=Object.values(schedule).some((entries:any)=>(entries||[]).some((e:any)=>(e.komponen||[]).includes(kode)));
    return{ok:adaTerjadwal,prosesSebelum};
  };

  const addEntry=async()=>{
    if(!modalWp||!modalKomponen.length)return;

    const tipePanelCek=livePanelForCell?.tipe;
    const prosesCek=rawRow?.proses;

    if(tipePanelCek&&prosesCek){
      const panelIdCek=livePanelForCell?.id;
      for(const kode of modalKomponen){
        const cekEstafet=checkEstafet(kode,tipePanelCek,prosesCek,panelIdCek);
        if(!cekEstafet.ok){
          const namaKomp=getNamaKomponenDariKode(panelIdCek,kode);
          alert(`⛔ Gak bisa dijadwalkan!\n\n"${namaKomp}" belum terjadwal di proses "${cekEstafet.prosesSebelum}".\n\nJadwalkan dulu di proses "${cekEstafet.prosesSebelum}" sebelum lanjut ke "${prosesCek}".`);
          return;
        }
      }
    }

    // Validasi kuota ORANG (khusus WIRING POWER/CONTROL) - kebutuhan orang dinamis per komponen
    // dari bobot (dipilih di modal ini/sudah tersimpan di row) + hari kerja aktual komponen itu.
    if(prosesCek&&PROSES_ORANG_RAW.includes(prosesCek)){
      const orangDibutuhkan=modalKomponen.reduce((s,k)=>{
        const bobot=modalBobotPerKomponen[k]??rawRow?.bobot_komponen?.[k];
        const hariKeN=hariKeNFromMap(wiringHariKerjaMap,livePanelForCell?.id,k,prosesCek,cellModal.date);
        return s+kebutuhanOrangWiring(bobot,hariKeN);
      },0);
      const cekOrang=await checkKuotaOrangDanKomponenSwap({
        tanggal:cellModal.date,
        jenisPekerjaan:prosesCek,
        orangDibutuhkan,
        excludeRawId:cellModal.rawId,
        excludeWp:modalWp,
      });
      if(!cekOrang.cukup){
        if(cekOrang.kuotaHari===0&&cekOrang.opsiSwap.length===0){
          alert("Kuota orang "+prosesCek+" tanggal ini belum diatur sama sekali.\n"+(cekOrang.error||"Silakan atur Override Tanggal dulu."));
          return;
        }
        setSwapOrangModal({tanggal:cellModal.date,proses:prosesCek,orangDibutuhkan,...cekOrang});
        setSwapOrangSelected([]);
        return;
      }
    }

    // Validasi kapasitas MENIT (proses lain selain wiring, hanya jika data FCS process time tersedia)
    if(tipePanelCek&&prosesCek&&prosesCek!=="BUSBAR"&&!PROSES_ORANG_RAW.includes(prosesCek)){
      let menitDibutuhkan=0;
      let adaDataProcessTime=false;
      for(const kode of modalKomponen){
        const qty=hitungSisaQty(kode).sisa;
        const menitPcs=getMenitPerPcs(tipePanelCek,prosesCek,kode);
        if(menitPcs>0)adaDataProcessTime=true;
        menitDibutuhkan+=qty*menitPcs;
      }
      if(adaDataProcessTime&&menitDibutuhkan>0){
        const cek=await checkKapasitasDanKomponenSwapV2({
          tanggal:cellModal.date,
          jenisPekerjaan:prosesCek,
          menitDibutuhkan,
          excludeRawId:cellModal.rawId,
          excludeWp:modalWp,
        });
        if(!cek.cukup){
          if(cek.opsiSwap.length>0){
            setSwapModal({tanggal:cellModal.date,proses:prosesCek,menitDibutuhkan,...cek});
            setSwapSelected([]);
            return;
          }
          // Gak ada yang bisa digeser (hari itu kosong/gak cukup dari komponen lain) - biasanya
          // karena qty komponen ini SENDIRIAN emang lebih besar dari kapasitas 1 hari (misal
          // Pintu 101pcs @ 7,5 menit/pcs = 757 menit, kapasitas harian cuma 672). Bukan diblokir
          // total kayak dulu - kasih peringatan aja, biar admin yang putuskan (overbook di
          // tanggal ini tetap tercatat & kelihatan jelas, sama seperti overbook lain di sistem
          // ini yang memang dibiarkan, bukan disembunyikan).
          const lanjutOverbook=window.confirm(
            "Kapasitas "+prosesCek+" tanggal ini gak cukup ("+cek.sisaKapasitas+" menit sisa, butuh "+menitDibutuhkan+" menit) dan tidak ada komponen lain yang bisa dipindah.\n\n"+
            "Tanggal ini akan OVERBOOK kalau dilanjutkan. Tetap tambahkan?"
          );
          if(!lanjutOverbook)return;
        }
      }
    }

    let finalKomp=modalKomponen;
    let updatedRow=null;
    let oldKomp:string[]=[];
    let isEdit=false;
    const isProsesOrangRow=prosesCek&&PROSES_ORANG_RAW.includes(prosesCek);
    // Bobot baru yang dipilih di modal ini digabung ke bobot_komponen level ROW (bukan per entry
    // - lihat panelHelpers.ts) - kode yang udah punya bobot tersimpan sebelumnya TETAP dipakai
    // (gak ke-timpa) kecuali sengaja diganti di picker.
    const newBobotKomponen=isProsesOrangRow?{...(rawRow?.bobot_komponen||{}),...modalBobotPerKomponen}:null;
    markRawDirty(cellModal.rawId);
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const existing=newSch[cellModal.date]||[];
      const wpEntry=existing.find(e=>e.wp===modalWp);
      let updated;
      if(wpEntry){
        oldKomp=wpEntry.komponen;isEdit=true;
        if(isProsesOrangRow){
          // Token __wiring_ lama (data existing, kalau ada) dipisah dari komponen asli, JANGAN
          // ikut kesaring "progress<100" (dia gak punya progress, defaultnya 0<100=true, jadi
          // selalu ke-anggap "belum selesai" dan bisa nyangkut sendirian tanpa komponen asli
          // begitu semua komponen aslinya udah 100% - itu akar bug "rilis tapi gak nongol di operator").
          const tokenLama=(wpEntry.komponen||[]).filter((kode:string)=>kode.startsWith("__wiring_"));
          const komponenLamaBelumSelesai=(wpEntry.komponen||[]).filter((kode:string)=>{
            if(kode.startsWith("__wiring_"))return false;
            const progress=livePanelForCell?.checklist?.[kode]?.progress?.[prosesCek||""]||0;
            return progress<100;
          });
          const realBaru=[...new Set([...komponenLamaBelumSelesai,...modalKomponen.filter((k:string)=>!k.startsWith("__wiring_"))])];
          // Token cuma ada gunanya kalau masih nempel di komponen asli - kalau semua komponen
          // aslinya udah beres/dihapus, buang tokennya juga (jangan biarin entri jadi token-doang).
          finalKomp=realBaru.length>0?[...new Set([...tokenLama,...realBaru])]:realBaru;
        } else {
          finalKomp=[...new Set([...wpEntry.komponen,...modalKomponen])];
        }
        updated=existing.map(e=>e.wp!==modalWp?e:{...e,komponen:finalKomp});
      }
      else{
        updated=[...existing,{wp:modalWp,komponen:modalKomponen,createdBy:user?.name||user?.nama||"Admin",createdAt:new Date().toISOString()}];
      }
      newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch,...(newBobotKomponen?{bobot_komponen:newBobotKomponen}:{})};
      return updatedRow;
    }));
    // (8 Okt 2026) syncRenharKomp dipindah ke SETELAH raw tersimpan & di-await (lihat bawah) -
    // dulu dipanggil tanpa await & hasilnya tidak pernah dicek.
    const ctxSinkron={rawId:cellModal.rawId,date:cellModal.date,wp:modalWp};
    setModalWp('');setModalKomponen([]);setModalBobotPerKomponen({});
    const isBusbarRow=rawRow?.proses==="BUSBAR";
    if(updatedRow){
      const updatePayload:any={schedule:updatedRow.schedule,updated_by:user?.name||user?.nama||'Admin',...(newBobotKomponen?{bobot_komponen:newBobotKomponen}:{})};
      if(isBusbarRow&&busbarSel!==undefined){
        const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
        updatePayload.busbar_schedule=newBusbarSch;
        // Update local state dengan busbar_schedule
        setRawData(prev=>prev.map(r=>{
          if(r.id!==cellModal.rawId)return r;
          return{...r,schedule:updatedRow.schedule,busbar_schedule:newBusbarSch};
        }));
      }
      const resRaw=await updateRaw(cellModal.rawId,updatePayload);
      // (8 Okt 2026) Dulu hasil tidak dicek. Gagal = beri tahu, renhar tidak disinkron (raw belum berubah).
      if(!resRaw?.success){
        console.error("[Raw Schedule] simpan WP gagal:",resRaw?.error);
        alert("Gagal menyimpan WP ke server: "+(resRaw?.error||"koneksi bermasalah")+"\n\nMuat ulang halaman lalu ulangi.");
        return;
      }
    }
    {
      const sinkron=()=>syncRenharKomp(ctxSinkron.rawId,ctxSinkron.date,ctxSinkron.wp,finalKomp);
      try{await sinkron();}catch(err:any){
        await tanganiGagalSinkronRenhar(err,`${rawRow?.panel||""} ${ctxSinkron.wp} (${ctxSinkron.date})`,sinkron);
      }
    }
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=user?.name||user?.nama||sess?.nama||sess?.name||'Admin';
    const getName=(k:string)=>panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k)?.nama||k;
    if(isEdit){
      const added=modalKomponen.filter(k=>!oldKomp.includes(k)).map(getName);
      const removed=oldKomp.filter(k=>!modalKomponen.includes(k)).map(getName);
      const parts=[];
      if(added.length) parts.push('Tambah: '+added.join(', '));
      if(removed.length) parts.push('Hapus: '+removed.join(', '));
      const desc=parts.length?parts.join(' | '):'Tidak ada perubahan';
      await activityLogService.insert({user_name:uname,action:'EDIT WP RAW SCHEDULE',description:'Edit '+modalWp+' '+rawRow?.panel+' - '+rawRow?.proyek+' ('+cellModal?.date+'): '+desc,module:'raw',halaman:'Raw Schedule',proyek:rawRow?.proyek||'',panel:rawRow?.panel||''});
    } else {
      const kompNames=finalKomp.map(getName).join(', ');
      await activityLogService.insert({user_name:uname,action:'TAMBAH WP RAW SCHEDULE',description:'Tambah '+modalWp+' ('+kompNames+') ke jadwal '+rawRow?.panel+' - '+rawRow?.proyek+' ('+cellModal?.date+')',module:'raw',halaman:'Raw Schedule',proyek:rawRow?.proyek||'',panel:rawRow?.panel||''});
    }
  };
  // Hapus 1 WP dari sel (rawId, tanggal) + sinkron renhar + log. Dipakai tombol "✕ Hapus" di modal (removeEntry)
  // dan menu "Hapus" tampilan accordion. Mengembalikan true bila jadwal tersimpan.
  const hapusWpDariSel=async(rawId:number,date:string,wp:string):Promise<boolean>=>{
    // Hitung new schedule dulu sebelum update state
    const currentRow=rawData.find(r=>r.id===rawId);
    if(!currentRow)return false;
    const newSch={...currentRow.schedule};
    const updated=(newSch[date]||[]).filter((e:any)=>e.wp!==wp);
    if(!updated.length) delete newSch[date]; else newSch[date]=updated;
    const updatedRow={...currentRow,schedule:newSch};
    // Update state dan Supabase
    markRawDirty(rawId);
    setRawData(prev=>prev.map(r=>r.id===rawId?updatedRow:r));
    const resRaw=await updateRaw(rawId,{schedule:newSch});
    // (8 Okt 2026) Dulu hasil simpan tidak dicek & syncRenharDel tanpa await.
    if(!resRaw?.success){
      console.error("[Raw Schedule] hapus WP gagal:",resRaw?.error);
      alert("Gagal menghapus WP di server: "+(resRaw?.error||"koneksi bermasalah")+"\n\nMuat ulang halaman lalu ulangi.");
      return false;
    }
    {
      const rawIdDel=rawId;
      const sinkron=()=>syncRenharDel(rawIdDel,date,wp);
      try{await sinkron();}catch(err:any){
        await tanganiGagalSinkronRenhar(err,`${currentRow?.panel||""} ${wp} (${date}) - hapus`,sinkron);
      }
    }
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS WP RAW SCHEDULE",description:"Hapus "+wp+" dari jadwal "+currentRow?.panel+" - "+currentRow?.proyek+" ("+date+")",module:"raw",halaman:"Raw Schedule",proyek:currentRow?.proyek||"",panel:currentRow?.panel||""});
    return true;
  };
  const removeEntry=async(wp)=>{await hapusWpDariSel(cellModal.rawId,cellModal.date,wp);};
  // Simpan jadwal BUSBAR 1 sel (raw BUSBAR, tanggal) = daftar kode busbar: busbar_schedule + sinkron renhar
  // + log JADWAL BUSBAR. Isi = handler tombol "Selesai" modal BUSBAR APA ADANYA (dipecah 10 Okt 2026 supaya
  // tombol "+ Jadwalkan" / "Hapus dari tanggal ini" Raw Schedule per WP memakai jalur yang SAMA). true = tersimpan.
  const simpanBusbarSel=async(rawId:number,date:string,kodeList:string[]):Promise<boolean>=>{
    const rawRow=rawData.find((r:any)=>r.id===rawId);
    const busbarSel=kodeList;
    const cellModal={rawId,date};
    const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
    markRawDirty(cellModal.rawId);
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      return{...r,busbar_schedule:newBusbarSch};
    }));
    const resRaw=await updateRaw(cellModal.rawId,{busbar_schedule:newBusbarSch});
    // (8 Okt 2026) Dulu hasil tidak dicek. Gagal = beri tahu, renhar tidak disinkron.
    if(!resRaw?.success){
      console.error("[Raw Schedule] simpan jadwal BUSBAR gagal:",resRaw?.error);
      alert("Gagal menyimpan jadwal BUSBAR ke server: "+(resRaw?.error||"koneksi bermasalah")+"\n\nMuat ulang halaman lalu ulangi.");
      return false;
    }
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
    const uname=user?.name||user?.nama||sess?.nama||'Admin';
    // Sync ke renhar - fresh-fetch lewat withRenharQueue, bukan cari di state renhar
    // yang bisa stale (Raw Schedule & Rencana Harian bisa mounted bareng).
    const busbarTask={rawId:cellModal.rawId,wp:"BUSBAR",tanggal:cellModal.date};
    if(busbarSel.length>0){
      const renharPayload={
        raw_id:cellModal.rawId,
        wo_id:rawRow?.wo_id||rawRow?.woId,
        panel_id:rawRow?.panel_id||rawRow?.panelId,
        panel:rawRow?.panel,
        proyek:rawRow?.proyek,
        proses:rawRow?.proses,
        wp:"BUSBAR",
        komponen:busbarSel,
        tanggal:cellModal.date,
        divisi:"assembling",
        prioritas:rawRow?.prioritas||"Sedang",
      };
      const sinkron=()=>withRenharQueue(busbarTask,async(existRenhar)=>{
        if(existRenhar){
          markRenharDirty(existRenhar.id);
          const upd=await updateRenhar(existRenhar.id,{...renharPayload});
          if(!upd?.success)throw Object.assign(new Error(upd?.error||"Gagal menyimpan rencana harian"),{code:(upd as any)?.code});
          setRenhar((prev:any[])=>prev.map((r:any)=>r.id===existRenhar.id?{...r,...renharPayload}:r));
        } else {
          const res=await createRenhar(renharPayload);
          if(!(res?.success&&res?.data))throw Object.assign(new Error(res?.error||"Gagal membuat renhar"),{code:(res as any)?.code});
          markRenharDirty(res.data.id);setRenhar((prev:any[])=>[...prev,res.data]);
        }
      });
      try{await sinkron();}catch(err:any){await tanganiGagalSinkronRenhar(err,`${rawRow?.panel||""} BUSBAR (${cellModal.date})`,sinkron);}
    } else {
      // Hapus renhar busbar jika kosong
      const sinkron=()=>withRenharQueue(busbarTask,async(existRenhar)=>{
        if(existRenhar){
          const del=await removeRenhar(existRenhar.id);
          if(!del?.success)throw Object.assign(new Error(del?.error||"Gagal menghapus rencana harian"),{code:(del as any)?.code});
          setRenhar((prev:any[])=>prev.filter((r:any)=>r.id!==existRenhar.id));
        }
      });
      try{await sinkron();}catch(err:any){await tanganiGagalSinkronRenhar(err,`${rawRow?.panel||""} BUSBAR (${cellModal.date}) - hapus`,sinkron);}
    }
    await activityLogService.insert({
      user_name:uname,
      action:'JADWAL BUSBAR',
      description:`Jadwal busbar ${rawRow?.panel} - ${rawRow?.proyek} (${cellModal?.date}): ${busbarSel.join(', ')||'kosong'}`,
      module:'raw',halaman:'Raw Schedule',
      proyek:rawRow?.proyek||'',panel:rawRow?.panel||''
    });
    return true;
  };
  // Modal edit sel + modal kapasitas/kuota ikutannya (dirender induk di posisi yang sama seperti dulu).
  const elemen=(
    <>
      {cellModal&&rawRow&&(
        <Modal title={`Jadwal ${getDayLabel(cellModal.date)} — ${rawRow.proses}`} onClose={()=>setCellModal(null)} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{rawRow.proyek} · {rawRow.panel}</div>
          {rawRow.proses!=="BUSBAR"&&cellEntries.length>0&&(
            <div style={{marginBottom:16}}>
              <Lbl>WP & Komponen Terjadwal</Lbl>
              {selectedForMove.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                  <span style={{fontSize:11,color:"#1d4ed8",flex:1}}>{selectedForMove.length} komponen dipilih</span>
                  <button onClick={()=>{setCellModal(null);setMoveKomponenState({rawId:cellModal.rawId,date:cellModal.date,items:selectedForMove});}}
                    style={{padding:"4px 10px",borderRadius:6,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔀 Pindahin →</button>
                  <button onClick={()=>setSelectedForMove([])}
                    style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                </div>
              )}
              {cellEntries.map(e=>{
                const wc=WP_COLOR[e.wp]||"#64748b";
                return(
                  <div key={e.wp} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{background:wc,color:'#fff',borderRadius:6,padding:'2px 10px',fontSize:12,fontWeight:700}}>{e.wp}</span>
                      <div style={{display:'flex',gap:6}}><button onClick={()=>{
                          setModalWp(e.wp);
                          const isWiringProses=PROSES_ORANG_RAW.includes(rawRow?.proses||"");
                          if(isWiringProses){
                            // Token __wiring_ (badge bobot) BUKAN komponen asli, gak punya progress -
                            // dulu ke-anggap "belum selesai" (progress default 0<100) dan ikut nyangkut
                            // di checkbox, bikin entri berakhir cuma-token-doang kalau semua komponen
                            // asli udah selesai. Dikecualikan eksplisit di sini.
                            const belumSelesai=(e.komponen||[]).filter((kode:string)=>{
                              if(kode.startsWith("__wiring_"))return false;
                              const progress=livePanelForCell?.checklist?.[kode]?.progress?.[rawRow?.proses||""]||0;
                              return progress<100;
                            });
                            setModalKomponen(belumSelesai);
                            setModalBobotPerKomponen(Object.fromEntries(belumSelesai.map((kode:string)=>[kode,rawRow?.bobot_komponen?.[kode]||"MEDIUM"])));
                          } else {
                            setModalKomponen([...e.komponen]);
                          }
                        }} style={{background:'#eff6ff',border:'1px solid #bfdbfe',cursor:'pointer',color:'#2563eb',fontSize:12,borderRadius:6,padding:'2px 10px',fontWeight:600}}>✏️ Edit</button><button onClick={()=>removeEntry(e.wp)} style={{background:'none',border:'none',cursor:'pointer',color:'#fca5a5',fontSize:13}}>✕ Hapus</button></div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {e.komponen.map(k=>{
                        // Handle format wiring khusus: __wiring_{org}org_{bobot}
                        if(k.startsWith("__wiring_")){
                          const parts=k.replace("__wiring_","").split("_");
                          const org=parts[0]; // misal "2org"
                          const bobot=parts.slice(1).join("_"); // misal "MEDIUM" atau "VERY_HARD"
                          const bobotLabel=bobot.replace("_"," ");
                          const bobotColor:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                          const bc=bobotColor[bobot]||"#6366f1";
                          return <span key={k} style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>⚡ {org} · {bobotLabel}</span>;
                        }
                        const item=panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
                        const isSelMove=selectedForMove.some(x=>x.wp===e.wp&&x.kode===k);
                        const clForCell=livePanelForCell?.checklist?.[k];
                        // Snapshot PERMANEN per-tanggal (reuse fungsi yang sama dgn RencanaHarian &
                        // fitur jejak) - dipanggil dgn cellModal.date, biar kartu di tanggal jejak
                        // (lama) beku selamanya, sementara kartu di tanggal live ikut update begitu
                        // ada checkpoint baru dari Vista Pekerja.
                        const progressKomp=getProgressAsOfDate(clForCell,rawRow?.proses||"",cellModal.date);
                        const isWiringProsesLabel=PROSES_ORANG_RAW.includes(rawRow?.proses||"");
                        const qtyDoneKomp=getQtyProsesAsOfDate(clForCell,rawRow?.proses||"",cellModal.date);
                        // qtyPerKomponen (qty dipecah ke tanggal ini doang, lihat fitur pecah qty
                        // kapasitas) diutamakan drpd qty total panel - kalau gak ada override,
                        // baru fallback ke qty total (kartu emang nunjuk semua qty di tanggal itu).
                        const qtyTotalKomp=e.qtyPerKomponen?.[k]??(Number(clForCell?.qty)||0);
                        const labelQtyPct=isWiringProsesLabel?`(${progressKomp}%)`:`(${qtyDoneKomp}/${qtyTotalKomp})`;
                        const isKompDone=progressKomp>=100;
                        // Warna chip SELALU ikut warna proses (gak berubah karena status) - status
                        // ditandai ikon terpisah aja (✓ selesai, • berprogres, kosong kalau belum).
                        const pc=PROSES_COLOR[rawRow?.proses||""]||"#64748b";
                        const statusIconKomp=isKompDone?"✓ ":progressKomp>0?"• ":"";
                        const digeserKeTgl=e.digeserKe?.[k]||null;
                        if(digeserKeTgl){
                          return <span key={k} title={"Jejak/histori (read-only) - "+labelQtyPct+" saat digeser ke "+digeserKeTgl+", gak bisa dikerjakan/dipindah lagi dari sini"}
                            style={{background:"#f1f5f9",color:"#94a3b8",border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"default"}}>🕓 {item?.nama?`${k} - ${item.nama}`:k} {labelQtyPct} ➡️ {digeserKeTgl}</span>;
                        }
                        const bobotLabelKomp=isWiringProsesLabel?` · ${WIRING_BOBOT_LABEL[rawRow?.bobot_komponen?.[k]||"MEDIUM"]}`:"";
                        return <span key={k} onClick={bisaPilihPindah?()=>toggleSelectForMove(e.wp,k):undefined} title={bisaPilihPindah?(isKompDone?"Sudah selesai · Klik buat pilih/batal pilih buat dipindah":"Klik buat pilih/batal pilih buat dipindah"):(isKompDone?"Sudah selesai":undefined)}
                          style={{background:isSelMove?pc:pc+"18",color:isSelMove?"#fff":pc,border:`1px solid ${isSelMove?pc:pc+"33"}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:bisaPilihPindah?"pointer":"default"}}>{statusIconKomp}{item?.nama?`${k} - ${item.nama}`:k} {labelQtyPct}{bobotLabelKomp}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16}}>
          {rawRow?.proses!=="BUSBAR"&&(<>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {WP_LIST.map(wp=>{
                const added=cellEntries.some(e=>e.wp===wp);
                const wpDone=isWpDone(livePanelForCell,wp,rawRow?.proses||"");
                const disabled=added||wpDone;const sel=modalWp===wp;const wc=WP_COLOR[wp];
                return(
                  <button key={wp} onClick={()=>{if(!disabled){setModalWp(sel?"":wp);setModalKomponen([]);}}} disabled={disabled}
                    style={{padding:"8px",borderRadius:8,border:`2px solid ${wpDone?"#16a34a":sel?wc:disabled?"#e2e8f0":"#e2e8f0"}`,background:wpDone?"#f0fdf4":sel?wc+"18":disabled?"#f8fafc":"#f8fafc",cursor:disabled?"not-allowed":"pointer",color:wpDone?"#16a34a":sel?wc:disabled?"#cbd5e1":"#64748b",fontWeight:700,fontSize:12,opacity:1,display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                    {wpDone?(<><span>✅</span>{wp}<span style={{fontSize:10,color:"#16a34a"}}>Selesai</span></>):(<><span style={{width:8,height:8,borderRadius:"50%",background:added?"#e2e8f0":wc}}/>{wp} {added?"(terjadwal)":sel?"✓":""}</>)}
                  </button>
                );
              })}
            </div>
            {modalWp&&wpItems.length>0&&(
              <>
                <Lbl>Pilih Komponen {modalWp}</Lbl>
                {PROSES_ORANG_RAW.includes(rawRow?.proses||"")?(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14}}>
                    {wpItems.map(it=>{
                      const sel=modalKomponen.includes(it.kode);
                      const kl=livePanelForCell?.checklist?.[it.kode];
                      const progress=kl?.progress?.[rawRow?.proses||""]||0;
                      const sudahSelesai=progress>=100;
                      const bobotTerpilih=modalBobotPerKomponen[it.kode]??rawRow?.bobot_komponen?.[it.kode]??"MEDIUM";
                      return(
                        <div key={it.kode} style={{border:`1px solid ${sudahSelesai?"#bbf7d0":sel?"#93c5fd":"#e2e8f0"}`,borderRadius:8,padding:"8px 12px",background:sudahSelesai?"#f0fdf4":sel?"#eff6ff":"#fff",opacity:sudahSelesai?0.7:1}}>
                          <label style={{display:"flex",alignItems:"center",gap:10,cursor:sudahSelesai?"not-allowed":"pointer"}}>
                            <input type="checkbox" checked={sel} disabled={sudahSelesai} onChange={()=>{
                              if(sudahSelesai)return;
                              if(sel){setModalKomponen(prev=>prev.filter(k=>k!==it.kode));}
                              else{
                                setModalKomponen(prev=>[...prev,it.kode]);
                                setModalBobotPerKomponen(prev=>({...prev,[it.kode]:prev[it.kode]??rawRow?.bobot_komponen?.[it.kode]??"MEDIUM"}));
                              }
                            }}/>
                            <span style={{flex:1,fontSize:12,color:sudahSelesai?"#16a34a":"#1e293b"}}>{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span></span>
                            <span style={{fontSize:10,color:sudahSelesai?"#16a34a":"#94a3b8",fontWeight:sudahSelesai?700:400}}>{sudahSelesai?"✓ Selesai":`progress ${progress}%`}</span>
                          </label>
                          {sel&&!sudahSelesai&&(
                            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginTop:8}}>
                              {WIRING_BOBOT_LIST.map(b=>{
                                const bsel=bobotTerpilih===b;const bc=WIRING_BOBOT_COLOR[b];
                                return(
                                  <button key={b} type="button" onClick={()=>setModalBobotPerKomponen(prev=>({...prev,[it.kode]:b}))}
                                    style={{padding:"5px 2px",borderRadius:6,border:`1.5px solid ${bsel?bc:"#e2e8f0"}`,background:bsel?bc+"18":"#fff",color:bsel?bc:"#64748b",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                    {WIRING_BOBOT_LABEL[b]}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ):null}
                {PROSES_ORANG_RAW.includes(rawRow?.proses||"")&&(()=>{
                  // Preview MURNI tampilan - reuse kebutuhanOrangWiring/hariKeNFromMap yang sama
                  // dipakai buat kalkulasi kapasitas real, gak ada angka hardcode. mulaiHariKeN
                  // dihitung dari histori aktual (bukan selalu 1) biar akurat kalau komponen ini
                  // udah pernah dikerjakan sebelumnya.
                  const selectedBelumSelesai=modalKomponen.filter(k=>{
                    const kl=livePanelForCell?.checklist?.[k];
                    return (kl?.progress?.[rawRow?.proses||""]||0)<100;
                  });
                  if(selectedBelumSelesai.length===0)return null;
                  const perKode=selectedBelumSelesai.map(k=>{
                    const bobot=modalBobotPerKomponen[k]??rawRow?.bobot_komponen?.[k]??"MEDIUM";
                    const mulaiHariKeN=hariKeNFromMap(wiringHariKerjaMap,livePanelForCell?.id,k,rawRow?.proses||"",cellModal?.date||"");
                    const tableLen=(WIRING_BOBOT_TABLE[bobot]||WIRING_BOBOT_TABLE.MEDIUM).length;
                    return{bobot,mulaiHariKeN,sisaHari:Math.max(1,tableLen-mulaiHariKeN+1)};
                  });
                  const maxDays=Math.max(...perKode.map(p=>p.sisaHari));
                  const relLabel=(off:number)=>off===0?"Hari ini":off===1?"Besok":off===2?"Lusa":`H+${off}`;
                  const kurva=Array.from({length:maxDays},(_,off)=>({
                    label:relLabel(off),
                    total:perKode.reduce((s,p)=>s+kebutuhanOrangWiring(p.bobot,p.mulaiHariKeN+off),0),
                  }));
                  return(
                    <div style={{background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:8,padding:10,marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#7c3aed",marginBottom:6}}>📊 Preview Kebutuhan Orang per Hari</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                        {kurva.map((row,i)=>(
                          <div key={i} style={{textAlign:"center" as const,minWidth:52}}>
                            <div style={{fontSize:9,color:"#64748b",marginBottom:2}}>{row.label}</div>
                            <div style={{fontSize:13,fontWeight:800,color:"#7c3aed"}}>{row.total}</div>
                            <div style={{fontSize:8,color:"#94a3b8"}}>orang</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {!PROSES_ORANG_RAW.includes(rawRow?.proses||"")&&(
                  <>
                  {/* BUG FIX (20 Sep 2026, ditemukan user - "Tutup Samping" CAPACITOR BANK
                      CLS-FONTAINE muncul lagi sbg pilihan padahal FINISHING-nya udah 100%) -
                      wpItems (dipakai bareng sama cabang PROSES_ORANG_RAW di atas) SEBELUMNYA
                      cuma nge-exclude komponen yang PERNAH tercatat di raw_schedule.schedule
                      (komponenSudahDipakaiTanggalLain) - kalau komponen sampai 100% TANPA pernah
                      lewat entry schedule proses itu (kasus nyata FS.29: checklist.progress.
                      FINISHING=100 tapi gak pernah nongol di schedule[tanggal].komponen manapun),
                      dia lolos gak ke-exclude sama sekali, tampil kayak belum pernah dikerjakan.
                      Cabang PROSES_ORANG_RAW (WIRING) di atas UDAH BENAR dari awal - baca
                      checklist.progress LANGSUNG (sudahSelesai=progress>=100), gak gantung ke
                      histori schedule. Di sini disamakan (satu sumber logika, CLAUDE.md B.1):
                      TIDAK dihapus diam-diam dari daftar (biar gak kelihatan kayak komponennya
                      "hilang" & bingung nyarinya) - tetap tampil TAPI disabled + badge "✓
                      Selesai", pola visual identik cabang WIRING. TIDAK ada perubahan data sama
                      sekali - murni tambahan pengecekan di render, wpItems/checklist/schedule
                      yang sudah ada gak disentuh. */}
                  {wpItems.filter((it:any)=>(livePanelForCell?.checklist?.[it.kode]?.progress?.[rawRow?.proses||""]||0)<100).length>0&&(
                    <button onClick={()=>{
                      const semuaKode=wpItems.filter((it:any)=>(livePanelForCell?.checklist?.[it.kode]?.progress?.[rawRow?.proses||""]||0)<100).map((it:any)=>it.kode);
                      const semuaTerpilih=semuaKode.every((k:string)=>modalKomponen.includes(k));
                      setModalKomponen(semuaTerpilih?[]:semuaKode);
                    }} style={{marginBottom:8,padding:"5px 12px",borderRadius:7,border:"1px dashed #94a3b8",background:"#f8fafc",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {wpItems.filter((it:any)=>(livePanelForCell?.checklist?.[it.kode]?.progress?.[rawRow?.proses||""]||0)<100).every((it:any)=>modalKomponen.includes(it.kode))?"✕ Batal Pilih Semua":"✓ Pilih Semua"}
                    </button>
                  )}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                    {wpItems.map(it=>{
                      const sel=modalKomponen.includes(it.kode);const wc=WP_COLOR[modalWp]||"#64748b";
                      const{sisa,totalQty}=hitungSisaQty(it.kode);
                      const adaProgres=totalQty>0&&sisa<totalQty;
                      const sudahSelesai=(livePanelForCell?.checklist?.[it.kode]?.progress?.[rawRow?.proses||""]||0)>=100;
                      return(<button key={it.kode} disabled={sudahSelesai}
                        onClick={()=>{if(sudahSelesai)return;setModalKomponen(prev=>sel?prev.filter(k=>k!==it.kode):[...prev,it.kode]);}}
                        title={sudahSelesai?"Sudah selesai - gak bisa dijadwalkan lagi":undefined}
                        style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${sudahSelesai?"#bbf7d0":sel?wc:"#e2e8f0"}`,background:sudahSelesai?"#f0fdf4":sel?wc+"18":"#f8fafc",color:sudahSelesai?"#16a34a":sel?wc:"#64748b",cursor:sudahSelesai?"not-allowed":"pointer",fontSize:11,fontWeight:600,opacity:sudahSelesai?0.85:1}}>
                        {sudahSelesai?"✓ ":sel?"✓ ":""}{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span>
                        {sudahSelesai?(
                          <span style={{fontSize:9,fontWeight:700,marginLeft:6,padding:"1px 6px",borderRadius:20,background:"#dcfce7",color:"#16a34a"}}>Selesai</span>
                        ):adaProgres&&(
                          <span style={{fontSize:9,fontWeight:700,marginLeft:6,padding:"1px 6px",borderRadius:20,
                            background:sisa===0?"#dcfce7":"#fef9c3",color:sisa===0?"#16a34a":"#92400e"}}>
                            {sisa}/{totalQty} tersisa
                          </span>
                        )}
                      </button>);
                    })}
                  </div>
                </>)}
                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>
                  {PROSES_ORANG_RAW.includes(rawRow?.proses||"")
                    ?"+ Tambah "+modalWp+" ("+modalKomponen.length+" komponen, "+modalKomponen.reduce((s,k)=>{
                        const bobot=modalBobotPerKomponen[k]??rawRow?.bobot_komponen?.[k];
                        const hariKeN=hariKeNFromMap(wiringHariKerjaMap,livePanelForCell?.id,k,rawRow?.proses||"",cellModal?.date||"");
                        return s+kebutuhanOrangWiring(bobot,hariKeN);
                      },0)+" orang)"
                    :"+ Tambah "+modalWp+" ("+modalKomponen.length+" komponen)"}
                </Btn>
              </>
            )}
          </>)}
          </div>
          {/* Busbar Komponen Section */}
          {rawRow?.proses==="BUSBAR"&&(()=>{
            const busbarItems=getBusbarKomponen(livePanelForCell?.tipe||"FS");
            return(
              <div style={{marginTop:12,padding:"12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                  🔌 Pilih Komponen Busbar:
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                  {busbarItems.map((b:string)=>{
                    const isSel=busbarSel.includes(b);
                    const bc=BUSBAR_COLORS[b]||"#64748b";
                    // Persentase progress (7 Sep 2026) - dulu modal ini cuma tombol pilih kode polos,
                    // gak nunjukin progress sama sekali, beda dari chip komponen proses lain di atas
                    // (labelQtyPct) yang selalu tampilin persen. Reuse getProgressAsOfDate yang sama.
                    const pctBModal=getProgressAsOfDate(livePanelForCell?.checklist?.[b],"BUSBAR",cellModal.date);
                    const isDoneBModal=pctBModal>=100;
                    const statusIconBModal=isDoneBModal?"✓ ":pctBModal>0?"● ":"";
                    return(
                      <button key={b} onClick={()=>setBusbarSel((p:string[])=>isSel?p.filter((x:string)=>x!==b):[...p,b])}
                        style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,
                          border:`1.5px solid ${isSel?bc:"#e2e8f0"}`,
                          background:isSel?bc+"18":"#fff",color:isSel?bc:"#64748b"}}>
                        {statusIconBModal}{b} ({pctBModal}%)
                      </button>
                    );
                  })}
                </div>
                {busbarSel.length>0&&(
                  <div style={{marginTop:8,fontSize:11,color:"#64748b"}}>
                    Dipilih: <strong>{busbarSel.join(", ")}</strong>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={async()=>{
              // Save busbar schedule saat klik Selesai
              if(rawRow?.proses==="BUSBAR"){
                if(!(await simpanBusbarSel(cellModal.rawId,cellModal.date,busbarSel)))return;
              }
              setCellModal(null);
            }}>Selesai</Btn>
          </div>
        </Modal>
      )}

      {swapModal&&(
        <Modal title={"Kapasitas Penuh — "+swapModal.tanggal} onClose={()=>{setSwapModal(null);setSwapSelected([]);}} width={540}>
          <div style={{display:"flex",flexDirection:"column" as const,maxHeight:"80vh"}}>
          <div style={{flexShrink:0}}>
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
              <span>⚠️</span>
              <span>Kapasitas {swapModal.proses} tanggal {fmtDate(swapModal.tanggal)} sudah penuh ({Math.round(swapModal.terpakaiSaatIni)}/{Math.round(swapModal.kapasitasHari)} menit). Komponen baru butuh {Math.round(swapModal.menitDibutuhkan)} menit. Pilih komponen di bawah untuk dipindah ke hari berikutnya.</span>
            </div>
            <Lbl>Komponen Terjadwal di {fmtDate(swapModal.tanggal)} (pilih untuk dipindah)</Lbl>
            <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Disusun berdasarkan prioritas: deadline paling jauh duluan (paling aman digeser)</div>
          </div>
          <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column" as const,gap:10,marginBottom:14,overflowY:"auto" as const}}>
            {(()=>{
              const groups:Record<string,{wo_number:string,wo_target:string,panels:Record<string,{panel_nama:string,items:any[]}>}>={};
              swapModal.opsiSwap.forEach((o:any)=>{
                const woKey=o.wo_number;
                if(!groups[woKey])groups[woKey]={wo_number:o.wo_number,wo_target:o.wo_target,panels:{}};
                const panelKey=String(o.panel_id);
                if(!groups[woKey].panels[panelKey])groups[woKey].panels[panelKey]={panel_nama:o.panel_nama,items:[]};
                groups[woKey].panels[panelKey].items.push(o);
              });
              return Object.values(groups).map((g:any,gi:number)=>(
                <div key={gi} style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",flexShrink:0}}>
                  <div style={{background:"#f8fafc",padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>WO {g.wo_number}</span>
                    <span style={{fontSize:10,color:"#94a3b8"}}>Deadline: {g.wo_target?fmtDate(g.wo_target):"-"}</span>
                  </div>
                  <div style={{padding:"8px 10px",display:"flex",flexDirection:"column" as const,gap:8}}>
                    {Object.entries(g.panels).map(([panelKey,pnl]:any,pi:number)=>{
                      const expKey=g.wo_number+"|"+panelKey;
                      const isExp=!!swapExpandedPanel[expKey];
                      const selectedCount=pnl.items.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).length;
                      return(
                        <div key={pi}>
                          <div onClick={()=>setSwapExpandedPanel(prev=>({...prev,[expKey]:!prev[expKey]}))}
                            style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"5px 4px",borderRadius:6}}>
                            <span style={{fontSize:11,fontWeight:600,color:"#475569"}}>{pnl.panel_nama}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              {selectedCount>0&&(
                                <span style={{fontSize:9,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{selectedCount} dipilih</span>
                              )}
                              <span style={{fontSize:9,color:"#94a3b8",background:"#f1f5f9",borderRadius:20,padding:"1px 8px"}}>{pnl.items.length} komponen</span>
                              <span style={{fontSize:10,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                            </div>
                          </div>
                          {isExp&&(
                            <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginTop:4}}>
                              {pnl.items.map((o:any)=>{
                                const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
                                const checked=swapSelected.includes(swapKey);
                                const hasProgress=o.progress>0;
                                return(
                                  <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                                    <input type="checkbox" checked={checked} style={{marginTop:2}}
                                      onChange={()=>setSwapSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,color:"#1e293b"}}>{o.nama_komponen}</div>
                                      <div style={{fontSize:10,color:"#94a3b8"}}>{o.qty} pcs · progress {o.progress}% · {Math.round(o.total_menit)} menit</div>
                                    </div>
                                    {hasProgress&&(
                                      <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>

          <div style={{flexShrink:0}}>
          {(()=>{
            const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);
            const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
            const cukupSetelahSwap=sisaSetelahSwap>=swapModal.menitDibutuhkan;
            return(
              <div style={{background:cukupSetelahSwap?"#f0fdf4":"#fffbeb",border:`1px solid ${cukupSetelahSwap?"#bbf7d0":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cukupSetelahSwap?"#16a34a":"#92400e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>{cukupSetelahSwap?"Setelah pindah, kapasitas cukup":"Pilih komponen lagi, masih belum cukup"}</span>
                <span style={{fontWeight:700}}>{Math.round(swapModal.terpakaiSaatIni-menitDipindah+swapModal.menitDibutuhkan)}/{Math.round(swapModal.kapasitasHari)} menit</span>
              </div>
            );
          })()}

          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>{setSwapModal(null);setSwapSelected([]);}}
              style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
            <button disabled={swapLoading||swapSelected.length===0} onClick={async()=>{
              const itemsToMove=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,total_menit:o.total_menit,progress:o.progress}));
              const menitDipindah=itemsToMove.reduce((s:number,it:any)=>s+Number(it.total_menit),0);
              const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
              if(sisaSetelahSwap<swapModal.menitDibutuhkan){alert("Kapasitas masih belum cukup, pilih komponen tambahan");return;}
              setSwapLoading(true);
              const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
              const uname=user?.name||user?.nama||sess?.nama||"Admin";
              const res=await executeSwapKomponenV2({
                items:itemsToMove,
                jenisPekerjaan:swapModal.proses,
                tanggalAsal:swapModal.tanggal,
              });
              setSwapLoading(false);
              if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
              await activityLogService.insert({
                user_name:uname,action:"SWAP KOMPONEN KAPASITAS",
                description:"Pindahkan "+swapSelected.length+" komponen dari "+fmtDate(swapModal.tanggal)+" ("+swapModal.proses+") ke hari berikutnya untuk beri ruang komponen baru",
                module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
              });
              setSwapModal(null);setSwapSelected([]);
              await addEntry();
            }}
              style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapLoading||swapSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapLoading||swapSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {swapLoading?"⏳ Memindahkan...":"Pindahkan & Tambah Komponen"}
            </button>
          </div>
          </div>
          </div>
        </Modal>
      )}

      {swapOrangModal&&(
        <Modal title={"Kuota Orang Penuh — "+swapOrangModal.tanggal} onClose={()=>{setSwapOrangModal(null);setSwapOrangSelected([]);}} width={540}>
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
            <span>⚠️</span>
            <span>Kuota {swapOrangModal.proses} tanggal {fmtDate(swapOrangModal.tanggal)}: {Number(swapOrangModal.terpakaiSaatIni.toFixed(1))}/{Number(swapOrangModal.kuotaHari.toFixed(1))} orang sudah terisi. Komponen baru butuh {Number(swapOrangModal.orangDibutuhkan.toFixed(1))} orang lagi (total jadi {Number((swapOrangModal.terpakaiSaatIni+swapOrangModal.orangDibutuhkan).toFixed(1))}). Pilih salah satu:</span>
          </div>

          <div>
              <Lbl>Komponen Terjadwal di {fmtDate(swapOrangModal.tanggal)} (pilih untuk dipindah)</Lbl>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Disusun berdasarkan prioritas: deadline paling jauh duluan (paling aman digeser)</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10,marginBottom:14,maxHeight:280,overflowY:"auto" as const}}>
                {(()=>{
                  const groups:Record<string,{wo_number:string,wo_target:string,panels:Record<string,{panel_nama:string,items:any[]}>}>={};
                  swapOrangModal.opsiSwap.forEach((o:any)=>{
                    const woKey=o.wo_number;
                    if(!groups[woKey])groups[woKey]={wo_number:o.wo_number,wo_target:o.wo_target,panels:{}};
                    const panelKey=String(o.panel_id);
                    if(!groups[woKey].panels[panelKey])groups[woKey].panels[panelKey]={panel_nama:o.panel_nama,items:[]};
                    groups[woKey].panels[panelKey].items.push(o);
                  });
                  return Object.values(groups).map((g:any,gi:number)=>(
                    <div key={gi} style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
                      <div style={{background:"#f8fafc",padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #e2e8f0"}}>
                        <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>WO {g.wo_number}</span>
                        <span style={{fontSize:10,color:"#94a3b8"}}>Deadline: {g.wo_target?fmtDate(g.wo_target):"-"}</span>
                      </div>
                      <div style={{padding:"8px 10px",display:"flex",flexDirection:"column" as const,gap:8}}>
                        {Object.entries(g.panels).map(([panelKey,pnl]:any,pi:number)=>{
                          const expKey=g.wo_number+"|"+panelKey;
                          const isExp=!!swapOrangExpandedPanel[expKey];
                          const selectedCount=pnl.items.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).length;
                          return(
                            <div key={pi}>
                              <div onClick={()=>setSwapOrangExpandedPanel(prev=>({...prev,[expKey]:!prev[expKey]}))}
                                style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"5px 4px",borderRadius:6}}>
                                <span style={{fontSize:11,fontWeight:600,color:"#475569"}}>{pnl.panel_nama}</span>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  {selectedCount>0&&(
                                    <span style={{fontSize:9,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{selectedCount} dipilih</span>
                                  )}
                                  <span style={{fontSize:9,color:"#94a3b8",background:"#f1f5f9",borderRadius:20,padding:"1px 8px"}}>{pnl.items.length} komponen</span>
                                  <span style={{fontSize:10,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                                </div>
                              </div>
                              {isExp&&(
                                <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginTop:4}}>
                                  {pnl.items.map((o:any)=>{
                                    const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
                                    const checked=swapOrangSelected.includes(swapKey);
                                    const hasProgress=o.progress>0;
                                    return(
                                      <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                                        <input type="checkbox" checked={checked} style={{marginTop:2}}
                                          onChange={()=>setSwapOrangSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                                        <div style={{flex:1}}>
                                          <div style={{fontSize:12,color:"#1e293b"}}>{getNamaKomponenDariKode(o.panel_id,o.kode_komponen)}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({o.kode_komponen})</span></div>
                                          <div style={{fontSize:10,color:"#94a3b8"}}>{o.jumlah_orang} orang · progress {o.progress}%</div>
                                        </div>
                                        {hasProgress&&(
                                          <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
              {(()=>{
                const orangDipindah=swapOrangModal.opsiSwap.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.jumlah_orang),0);
                const sisaSetelahSwap=swapOrangModal.sisaKuota+orangDipindah;
                const cukupSetelahSwap=sisaSetelahSwap>=swapOrangModal.orangDibutuhkan;
                return(
                  <div style={{background:cukupSetelahSwap?"#f0fdf4":"#fffbeb",border:`1px solid ${cukupSetelahSwap?"#bbf7d0":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cukupSetelahSwap?"#16a34a":"#92400e"}}>
                    {cukupSetelahSwap?"✅ Setelah pindah, kuota cukup":"Pilih komponen lagi, masih belum cukup"}
                  </div>
                );
              })()}
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button onClick={()=>{setSwapOrangModal(null);setSwapOrangSelected([]);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button disabled={swapOrangLoading||swapOrangSelected.length===0} onClick={async()=>{
                  const itemsToMove=swapOrangModal.opsiSwap.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,jumlah_orang:o.jumlah_orang,progress:o.progress}));
                  const orangDipindah=itemsToMove.reduce((s:number,it:any)=>s+Number(it.jumlah_orang),0);
                  const sisaSetelahSwap=swapOrangModal.sisaKuota+orangDipindah;
                  if(sisaSetelahSwap<swapOrangModal.orangDibutuhkan){alert("Kuota masih belum cukup, pilih komponen tambahan");return;}
                  setSwapOrangLoading(true);
                  const res=await executeSwapKomponenOrang({items:itemsToMove,jenisPekerjaan:swapOrangModal.proses,tanggalAsal:swapOrangModal.tanggal});
                  setSwapOrangLoading(false);
                  if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  await activityLogService.insert({
                    user_name:uname,action:"SWAP ORANG KAPASITAS",
                    description:"Pindahkan "+swapOrangSelected.length+" komponen dari "+fmtDate(swapOrangModal.tanggal)+" ("+swapOrangModal.proses+") ke hari berikutnya untuk beri ruang kuota orang",
                    module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
                  });
                  setSwapOrangModal(null);setSwapOrangSelected([]);
                  await addEntry();
                }}
                  style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapOrangLoading||swapOrangSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapOrangLoading||swapOrangSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {swapOrangLoading?"⏳ Memindahkan...":"Pindahkan & Tambah Komponen"}
                </button>
              </div>
            </div>
        </Modal>
      )}
    </>
  );
  return{cellModal,buka:openCellModal,elemen,setModalWp,setModalKomponen,setModalBobotPerKomponen,hapusWpDariSel,simpanBusbarSel};
}
