import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { PANEL_TYPES } from '../constants/panelTypes'
import { isKomponenRelevant } from '../lib/panelHelpers'
import { setGlobalProsesRelevan } from '../lib/globalState'
import { Lbl, Inp, Sel, Btn } from './ui/Primitives'

export function KapasitasPekerjaanTab(){
  const [processList,setProcessList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [bomList,setBomList]=useState<any[]>([]);
  const [showAddBom,setShowAddBom]=useState(false);
  const [editBom,setEditBom]=useState<any>(null);
  const [bomForm,setBomForm]=useState({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",urutan:0});
  const [filterTipeBom,setFilterTipeBom]=useState("FS");
  const [bomSearch,setBomSearch]=useState("");
  const [migrating,setMigrating]=useState(false);
  const [migrateResult,setMigrateResult]=useState<string>("");
  const [migratingChecklist,setMigratingChecklist]=useState(false);
  const [migrateChecklistResult,setMigrateChecklistResult]=useState<string>("");
  const [wizardTipe,setWizardTipe]=useState<string>("");
  const [wizardStep,setWizardStep]=useState(0);
  const [wizardWp,setWizardWp]=useState("WP1");
  const [wizardColor,setWizardColor]=useState("#3b82f6");
  const [wizardRange,setWizardRange]=useState("");
  const [wizardAllNama,setWizardAllNama]=useState<string[]>([]);
  const [wizardSelectedNama,setWizardSelectedNama]=useState<string[]>([]);
  const [wizardProsesPerNama,setWizardProsesPerNama]=useState<Record<string,string[]>>({});
  const [wizardSaving,setWizardSaving]=useState(false);
  const WP_OPTIONS=["WP1","WP2","WP3","WP4","WP5","WP6"];
  const [expandedWpKey,setExpandedWpKey]=useState<string|null>(null);
  const WP_COLOR_PRESET=["#f59e0b","#22c55e","#06b6d4","#f97316","#8b5cf6","#ec4899","#3b82f6","#ef4444"];

  const openWizard=async(tipe:string)=>{
    const{data}=await supabase.from("bom_master").select("nama_komponen");
    const uniqueNama=Array.from(new Set((data||[]).map((r:any)=>r.nama_komponen))).sort();
    setWizardAllNama(uniqueNama);
    setWizardTipe(tipe);
    setWizardWp("WP1");
    setWizardColor("#3b82f6");
    setWizardRange("");
    setWizardSelectedNama([]);
    setWizardProsesPerNama({});
    setWizardStep(1);
  };
  const toggleWizardNama=(nama:string)=>{
    setWizardSelectedNama(prev=>prev.includes(nama)?prev.filter(n=>n!==nama):[...prev,nama]);
  };
  const toggleWizardProses=(nama:string,proses:string)=>{
    setWizardProsesPerNama(prev=>{
      const curr=prev[nama]||[];
      const next=curr.includes(proses)?curr.filter(p=>p!==proses):[...curr,proses];
      return{...prev,[nama]:next};
    });
  };
  const saveWizardWp=async()=>{
    setWizardSaving(true);
    try{
      await supabase.from("panel_wp_meta").upsert({tipe_panel:wizardTipe,wp:wizardWp,color:wizardColor,range_label:wizardRange},{onConflict:"tipe_panel,wp"});
      const{data:existingBom}=await supabase.from("bom_master").select("kode_komponen").eq("tipe_panel",wizardTipe);
      let maxNum=0;
      (existingBom||[]).forEach((r:any)=>{
        const m=String(r.kode_komponen).match(/(\d+)$/);
        if(m)maxNum=Math.max(maxNum,parseInt(m[1],10));
      });
      for(const nama of wizardSelectedNama){
        maxNum++;
        const kodeBaru=`${wizardTipe}.${maxNum}`;
        await supabase.from("bom_master").insert({kode_komponen:kodeBaru,nama_komponen:nama,tipe_panel:wizardTipe,wp:wizardWp,urutan:0});
        const prosesList=wizardProsesPerNama[nama]||[];
        if(prosesList.length>0){
          await supabase.from("bom_proses_relevan").insert(prosesList.map(p=>({kode_komponen:kodeBaru,tipe_panel:wizardTipe,jenis_pekerjaan:p})));
        }
      }
      const{data:allRelevan}=await supabase.from("bom_proses_relevan").select("*");
      const relevanSet=new Set<string>();
      const hasMappingSet=new Set<string>();
      (allRelevan||[]).forEach((r:any)=>{
        relevanSet.add(r.kode_komponen+"|"+r.tipe_panel+"|"+r.jenis_pekerjaan);
        hasMappingSet.add(r.kode_komponen+"|"+r.tipe_panel);
      });
      setGlobalProsesRelevan(relevanSet,hasMappingSet);
      await fetchPanelTypeMeta();
      await fetchBom();
      setWizardStep(0);
    }catch(err:any){
      alert("Gagal: "+err.message);
    }
    setWizardSaving(false);
  };
  const [prosesRelevanModal,setProsesRelevanModal]=useState<any>(null);
  const [selectedProsesRelevan,setSelectedProsesRelevan]=useState<string[]>([]);
  const [savingProsesRelevan,setSavingProsesRelevan]=useState(false);

  const openProsesModal=async(b:any)=>{
    const{data}=await supabase.from("bom_proses_relevan").select("jenis_pekerjaan")
      .eq("kode_komponen",b.kode_komponen).eq("tipe_panel",b.tipe_panel);
    setSelectedProsesRelevan((data||[]).map((r:any)=>r.jenis_pekerjaan));
    setProsesRelevanModal(b);
  };
  const toggleProsesRelevan=(proses:string)=>{
    setSelectedProsesRelevan(prev=>prev.includes(proses)?prev.filter(p=>p!==proses):[...prev,proses]);
  };
  const saveProsesRelevan=async()=>{
    if(!prosesRelevanModal)return;
    setSavingProsesRelevan(true);
    await supabase.from("bom_proses_relevan").delete()
      .eq("kode_komponen",prosesRelevanModal.kode_komponen).eq("tipe_panel",prosesRelevanModal.tipe_panel);
    if(selectedProsesRelevan.length>0){
      const rows=selectedProsesRelevan.map(p=>({kode_komponen:prosesRelevanModal.kode_komponen,tipe_panel:prosesRelevanModal.tipe_panel,jenis_pekerjaan:p}));
      await supabase.from("bom_proses_relevan").insert(rows);
    }
    const{data:allRelevan}=await supabase.from("bom_proses_relevan").select("*");
    const relevanSet=new Set<string>();
    const hasMappingSet=new Set<string>();
    (allRelevan||[]).forEach((r:any)=>{
      relevanSet.add(r.kode_komponen+"|"+r.tipe_panel+"|"+r.jenis_pekerjaan);
      hasMappingSet.add(r.kode_komponen+"|"+r.tipe_panel);
    });
    setGlobalProsesRelevan(relevanSet,hasMappingSet);
    setSavingProsesRelevan(false);
    setProsesRelevanModal(null);
  };
  const [panelTypeList,setPanelTypeList]=useState<any[]>([]);
  const [panelWpList,setPanelWpList]=useState<any[]>([]);
  const [expandedTipePanel,setExpandedTipePanel]=useState<string|null>(null);
  const [showAddTipe,setShowAddTipe]=useState(false);
  const [tipeForm,setTipeForm]=useState({tipe_panel:"",label:""});
  const [editWpMeta,setEditWpMeta]=useState<any>(null);
  const [wpForm,setWpForm]=useState({tipe_panel:"",wp:"",color:"#3b82f6",range_label:""});
  const [showAddWp,setShowAddWp]=useState(false);

  const fetchPanelTypeMeta=async()=>{
    const{data:t}=await supabase.from("panel_type_meta").select("*").order("tipe_panel");
    const{data:w}=await supabase.from("panel_wp_meta").select("*").order("wp");
    setPanelTypeList(t??[]);
    setPanelWpList(w??[]);
  };
  useEffect(()=>{fetchPanelTypeMeta();},[]);

  const saveTipePanel=async()=>{
    if(!tipeForm.tipe_panel||!tipeForm.label)return;
    const{error}=await supabase.from("panel_type_meta").insert(tipeForm);
    if(error){alert("Gagal: "+error.message);return;}
    await fetchPanelTypeMeta();
    setShowAddTipe(false);
    setTipeForm({tipe_panel:"",label:""});
  };
  const deleteTipePanel=async(tipe:string)=>{
    if(!confirm(`Yakin hapus tipe panel "${tipe}"? Semua WP di dalamnya juga ikut kehapus.`))return;
    await supabase.from("panel_wp_meta").delete().eq("tipe_panel",tipe);
    await supabase.from("panel_type_meta").delete().eq("tipe_panel",tipe);
    await fetchPanelTypeMeta();
  };
  const saveWpMeta=async()=>{
    if(!wpForm.tipe_panel||!wpForm.wp)return;
    if(editWpMeta){
      const{error}=await supabase.from("panel_wp_meta").update(wpForm).eq("id",editWpMeta.id);
      if(error){alert("Gagal: "+error.message);return;}
    } else {
      const{error}=await supabase.from("panel_wp_meta").insert(wpForm);
      if(error){alert("Gagal: "+error.message);return;}
    }
    await fetchPanelTypeMeta();
    setShowAddWp(false);
    setEditWpMeta(null);
    setWpForm({tipe_panel:"",wp:"",color:"#3b82f6",range_label:""});
  };
  const deleteWpMeta=async(id:number)=>{
    if(!confirm("Yakin hapus WP ini?"))return;
    await supabase.from("panel_wp_meta").delete().eq("id",id);
    await fetchPanelTypeMeta();
  };

  const migrateChecklistKode=async()=>{
    if(!confirm("Ini bakal SESUAIKAN ulang kode di checklist SEMUA panel yang udah ada, biar nyambung sama Master Data BOM terkini. Progress/qty/tanggal yang udah ada TETAP DIPINDAH (gak hilang), cuma kode-nya yang disesuaikan. Lanjut?"))return;
    setMigratingChecklist(true);
    setMigrateChecklistResult("");
    try{
      const mappingPerTipe:Record<string,Record<string,string>>={};
      Object.entries(PANEL_TYPES).forEach(([tipe,cfg]:any)=>{
        const oldKodeToNama:Record<string,string>={};
        cfg.wps.forEach((w:any)=>w.items.forEach((it:any)=>{oldKodeToNama[it.kode]=it.nama;}));
        const namaToNewKode:Record<string,string>={};
        bomList.filter((b:any)=>b.tipe_panel===tipe).forEach((b:any)=>{namaToNewKode[b.nama_komponen]=b.kode_komponen;});
        const map:Record<string,string>={};
        Object.entries(oldKodeToNama).forEach(([oldKode,nama])=>{
          const newKode=namaToNewKode[nama as string];
          if(newKode&&newKode!==oldKode)map[oldKode]=newKode;
        });
        mappingPerTipe[tipe]=map;
      });
      console.log("=== MAPPING PER TIPE (buat debug) ===",JSON.stringify(mappingPerTipe,null,2));

      const hasProgress=(val:any)=>Object.values(val?.progress||{}).some((v:any)=>Number(v)>0);

      const{data:allPanels}=await supabase.from("panels").select("id,tipe,nama,checklist");
      let updatedCount=0,skippedCount=0,duplikatDibersihkan=0,dipindahDariLama=0;
      let totalAmbigu=0;
      const ambiguDetails:string[]=[];
      for(const p of (allPanels||[]) as any[]){
        const map=mappingPerTipe[p.tipe];
        if(!map||Object.keys(map).length===0){skippedCount++;continue;}
        const cl=p.checklist||{};
        const existingKodes=new Set(Object.keys(cl));
        const newCl:any={...cl};
        let changed=false;
        const ambiguPanel:string[]=[];
        Object.entries(cl).forEach(([kode,val]:any)=>{
          const target=map[kode];
          if(!target||target===kode)return;
          if(existingKodes.has(target)){
            const oldPunyaProgress=hasProgress(val);
            const targetPunyaProgress=hasProgress(cl[target]);
            if(!oldPunyaProgress){
              delete newCl[kode];
              changed=true;
              duplikatDibersihkan++;
            } else if(oldPunyaProgress&&!targetPunyaProgress){
              newCl[target]=val;
              delete newCl[kode];
              changed=true;
              dipindahDariLama++;
            } else {
              ambiguPanel.push(`${kode}(progress)<->${target}(progress)`);
              totalAmbigu++;
            }
            return;
          }
          newCl[target]=val;
          delete newCl[kode];
          changed=true;
        });
        if(ambiguPanel.length>0&&ambiguDetails.length<5){
          ambiguDetails.push(`${p.nama}(${p.tipe}): ${ambiguPanel.join(", ")}`);
        }
        if(changed){
          await supabase.from("panels").update({checklist:newCl}).eq("id",p.id);
          updatedCount++;
        } else {
          skippedCount++;
        }
      }
      setMigrateChecklistResult(`Selesai! ${updatedCount} panel di-update (${duplikatDibersihkan} duplikat basi dihapus, ${dipindahDariLama} data lama dipindah ke posisi baru), ${skippedCount} gak perlu diubah${totalAmbigu>0?`. ${totalAmbigu} kode BENERAN ambigu (dua2nya ada progress) - PERLU DICEK MANUAL. Contoh: ${ambiguDetails.join(" | ")}`:""}.`);
    }catch(err:any){
      setMigrateChecklistResult("Gagal: "+err.message);
    }
    setMigratingChecklist(false);
  };

  const migrateFromPanelTypes=async()=>{
    if(!confirm("Ini bakal nambahin SEMUA komponen dari PANEL_TYPES (config lama) ke Master Data BOM. Komponen yang kode+tipe-nya sama bakal di-skip (gak dobel). Lanjut?"))return;
    setMigrating(true);
    setMigrateResult("");
    const rows:any[]=[];
    Object.entries(PANEL_TYPES).forEach(([tipe,cfg]:any)=>{
      (cfg.wps||[]).forEach((wpDef:any)=>{
        (wpDef.items||[]).forEach((item:any,idx:number)=>{
          rows.push({
            kode_komponen:item.kode,
            nama_komponen:item.nama,
            tipe_panel:tipe,
            wp:wpDef.wp,
            urutan:idx,
          });
        });
      });
    });
    const{data,error}=await supabase.from("bom_master").upsert(rows,{onConflict:"kode_komponen,tipe_panel",ignoreDuplicates:true}).select();
    setMigrating(false);
    if(error){setMigrateResult("Gagal: "+error.message);return;}
    setMigrateResult(`Selesai! ${data?.length||0} komponen baru ditambahkan dari total ${rows.length} yang diproses (sisanya sudah ada sebelumnya, di-skip).`);
    await fetchBom();
  };
  const [activeTab,setActiveTab]=useState("processtime");
  const [editProc,setEditProc]=useState<any>(null);
  const [showAddProc,setShowAddProc]=useState(false);
  const [procForm,setProcForm]=useState({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
  const [overrideList,setOverrideList]=useState<any[]>([]);
  const [editOverride,setEditOverride]=useState<any>(null);
  const [overrideForm,setOverrideForm]=useState({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"] as string[],jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});
  const [overrideJenisDropdownOpen,setOverrideJenisDropdownOpen]=useState(false);
  const PROSES_ORANG=["WIRING POWER","WIRING CONTROL"];
  const isProsesOrang=(p:string)=>PROSES_ORANG.includes(p);
  const [overrideMode,setOverrideMode]=useState<"single"|"rentang">("single");
  const [rentangForm,setRentangForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),tanggalAkhir:new Date().toISOString().slice(0,10),hariAktif:[1,2,3,4,5,7] as number[],jenis_pekerjaan:["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"] as string[],jam_kerja:8,efektivitas_pct:80,keterangan:""});
  const [rentangSaving,setRentangSaving]=useState(false);
  const [rentangResult,setRentangResult]=useState<{sukses:number;skip:number}|null>(null);

  const HARI_LABEL_OV:any={1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab",7:"Min"};
  const [filterProsesOverride,setFilterProsesOverride]=useState<string[]>([]);

  const overrideListFiltered=useMemo(()=>{
    if(filterProsesOverride.length===0)return overrideList;
    return overrideList.filter((o:any)=>filterProsesOverride.includes(o.jenis_pekerjaan));
  },[overrideList,filterProsesOverride]);

  const overrideJam=overrideListFiltered.filter((o:any)=>o.tipe_kapasitas!=="orang");
  const overrideOrang=overrideListFiltered.filter((o:any)=>o.tipe_kapasitas==="orang");

  const toggleHariRentang=(h:number)=>{
    setRentangForm(prev=>({...prev,hariAktif:prev.hariAktif.includes(h)?prev.hariAktif.filter(x=>x!==h):[...prev.hariAktif,h].sort()}));
  };

  const saveRentangOverride=async()=>{
    if(!rentangForm.tanggalMulai||!rentangForm.tanggalAkhir||rentangForm.hariAktif.length===0)return;
    if(rentangForm.tanggalAkhir<rentangForm.tanggalMulai){alert("Tanggal akhir harus setelah tanggal mulai");return;}
    setRentangSaving(true);
    setRentangResult(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const createdBy=sess?.nama||sess?.name||"Admin";
    const prosesList=Array.isArray(rentangForm.jenis_pekerjaan)?rentangForm.jenis_pekerjaan:[rentangForm.jenis_pekerjaan];
    const rows:any[]=[];
    let cur=new Date(rentangForm.tanggalMulai);
    const end=new Date(rentangForm.tanggalAkhir);
    let safety=0;
    while(cur<=end&&safety<366){
      const hari=cur.getDay()===0?7:cur.getDay();
      if(rentangForm.hariAktif.includes(hari)){
        const tgl=cur.toISOString().slice(0,10);
        for(const proses of prosesList){
          const isOrangRentang=isProsesOrang(proses);
          rows.push({
            tanggal:tgl,
            jenis_pekerjaan:proses,
            ...(isOrangRentang
              ?{tipe_kapasitas:"orang",jumlah_orang:Number(rentangForm.jumlah_orang),jam_kerja:null,efektivitas_pct:100}
              :{tipe_kapasitas:"jam",jam_kerja:Number(rentangForm.jam_kerja),efektivitas_pct:Number(rentangForm.efektivitas_pct),jumlah_orang:null}),
            keterangan:rentangForm.keterangan,
            created_by:createdBy,
          });
        }
      }
      cur.setDate(cur.getDate()+1);
      safety++;
    }
    if(rows.length===0){setRentangSaving(false);alert("Tidak ada tanggal yang match dengan hari terpilih");return;}
    const{data,error}=await supabase.from("fcs_kapasitas_override").upsert(rows,{onConflict:"tanggal,jenis_pekerjaan",ignoreDuplicates:false}).select();
    setRentangSaving(false);
    if(error){alert("Gagal: "+error.message);return;}
    setRentangResult({sukses:data?.length||0,skip:rows.length-(data?.length||0)});
    await fetchOverride();
  };
  const [filterTipe,setFilterTipe]=useState("FS");
  const [filterPekerjaan,setFilterPekerjaan]=useState("ALL");
  const [search,setSearch]=useState("");

  const HARI_LABEL:any={1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab",7:"Min"};
  const ALL_PROSES=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
  const ALL_TIPE=panelTypeList.length>0?panelTypeList.map((t:any)=>t.tipe_panel):["FS","F3B","WM_MS","WM_POLY"];
  const ALL_WP=["WP1","WP2","WP3","WP4","WP5","WP6"];

  useEffect(()=>{
    fetchAll();
    fetchOverride();
    fetchBom();
  },[]);

  const naturalKodeSort=(a:string,b:string)=>{
    const parse=(k:string)=>{
      const m=String(k).match(/^(.*?)(\d+)$/);
      return m?{prefix:m[1],num:parseInt(m[2],10)}:{prefix:k,num:0};
    };
    const pa=parse(a),pb=parse(b);
    if(pa.prefix!==pb.prefix)return pa.prefix.localeCompare(pb.prefix);
    return pa.num-pb.num;
  };

  const fetchBom=async()=>{
    const{data}=await supabase.from("bom_master").select("*");
    const sorted=(data??[]).slice().sort((a:any,b:any)=>{
      if(a.tipe_panel!==b.tipe_panel)return a.tipe_panel.localeCompare(b.tipe_panel);
      return naturalKodeSort(a.kode_komponen,b.kode_komponen);
    });
    setBomList(sorted);
  };

  const saveBom=async()=>{
    if(!bomForm.kode_komponen||!bomForm.nama_komponen)return;
    if(editBom){
      const{error}=await supabase.from("bom_master").update({...bomForm,updated_at:new Date().toISOString()}).eq("id",editBom.id);
      if(error){alert("Gagal: "+error.message);return;}
    } else {
      const m=String(bomForm.kode_komponen).match(/^(.*?)(\d+)$/);
      if(m){
        const prefix=m[1],startNum=parseInt(m[2],10);
        const{data:existingSameTipe}=await supabase.from("bom_master").select("id,kode_komponen").eq("tipe_panel",bomForm.tipe_panel);
        const toShift=(existingSameTipe||[]).map((r:any)=>{
          const mm=String(r.kode_komponen).match(/^(.*?)(\d+)$/);
          if(!mm||mm[1]!==prefix)return null;
          const num=parseInt(mm[2],10);
          if(num<startNum)return null;
          return{id:r.id,num};
        }).filter(Boolean).sort((a:any,b:any)=>b.num-a.num);
        for(const item of toShift as any[]){
          const oldKode=prefix+item.num;
          const newKode=prefix+(item.num+1);
          await supabase.from("bom_master").update({kode_komponen:newKode}).eq("id",item.id);
          await supabase.from("fcs_process_time").update({kode_komponen:newKode}).eq("kode_komponen",oldKode).eq("tipe_panel",bomForm.tipe_panel);
        }
      }
      const{error}=await supabase.from("bom_master").insert(bomForm);
      if(error){alert("Gagal: "+error.message);return;}
    }
    await fetchBom();
    setShowAddBom(false);
    setEditBom(null);
    setBomForm({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",urutan:0});
  };

  const deleteBom=async(id:number)=>{
    if(!confirm("Yakin hapus komponen ini dari Master Data BOM? Kode yang lebih besar bakal otomatis turun ngisi kekosongan."))return;
    const target=bomList.find((b:any)=>b.id===id);
    const{error}=await supabase.from("bom_master").delete().eq("id",id);
    if(error){alert("Gagal: "+error.message);return;}
    if(target){
      const m=String(target.kode_komponen).match(/^(.*?)(\d+)$/);
      if(m){
        const prefix=m[1],delNum=parseInt(m[2],10);
        const{data:remaining}=await supabase.from("bom_master").select("id,kode_komponen").eq("tipe_panel",target.tipe_panel);
        const toShift=(remaining||[]).map((r:any)=>{
          const mm=String(r.kode_komponen).match(/^(.*?)(\d+)$/);
          if(!mm||mm[1]!==prefix)return null;
          const num=parseInt(mm[2],10);
          if(num<=delNum)return null;
          return{id:r.id,num};
        }).filter(Boolean).sort((a:any,b:any)=>a.num-b.num);
        for(const item of toShift as any[]){
          const oldKode=prefix+item.num;
          const newKode=prefix+(item.num-1);
          await supabase.from("bom_master").update({kode_komponen:newKode}).eq("id",item.id);
          await supabase.from("fcs_process_time").update({kode_komponen:newKode}).eq("kode_komponen",oldKode).eq("tipe_panel",target.tipe_panel);
        }
      }
    }
    await fetchBom();
  };

  const fetchOverride=async()=>{
    const{data}=await supabase.from("fcs_kapasitas_override").select("*").order("tanggal",{ascending:false});
    setOverrideList(data??[]);
  };

  const saveOverride=async()=>{
    if(overrideForm.jenis_pekerjaan.length===0){alert("Pilih minimal 1 jenis pekerjaan");return;}
    const isOrang=isProsesOrang(overrideForm.jenis_pekerjaan[0]);
    if(!overrideForm.tanggal)return;
    if(isOrang&&!overrideForm.jumlah_orang)return;
    if(!isOrang&&!overrideForm.jam_kerja)return;
    const payload:any=isOrang
      ?{tipe_kapasitas:"orang",jumlah_orang:Number(overrideForm.jumlah_orang),jam_kerja:null,efektivitas_pct:100,keterangan:overrideForm.keterangan}
      :{tipe_kapasitas:"jam",jam_kerja:Number(overrideForm.jam_kerja),efektivitas_pct:Number(overrideForm.efektivitas_pct),jumlah_orang:null,keterangan:overrideForm.keterangan};
    if(editOverride){
      const{error}=await supabase.from("fcs_kapasitas_override").update(payload).eq("id",editOverride.id);
      if(!error){await fetchOverride();setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});}
      else alert("Gagal simpan: "+error.message);
    } else {
      const sudahAda=overrideForm.jenis_pekerjaan.filter(jp=>overrideList.some((o:any)=>o.tanggal===overrideForm.tanggal&&o.jenis_pekerjaan===jp));
      const belumAda=overrideForm.jenis_pekerjaan.filter(jp=>!sudahAda.includes(jp));
      if(belumAda.length===0){
        alert("Semua jenis pekerjaan yang dipilih sudah ada override untuk tanggal ini. Gunakan tombol Edit di tabel untuk mengubahnya.");
        return;
      }
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const rows=belumAda.map(jp=>({
        tanggal:overrideForm.tanggal,
        jenis_pekerjaan:jp,
        ...payload,
        created_by:sess?.nama||sess?.name||"Admin",
      }));
      const{error}=await supabase.from("fcs_kapasitas_override").insert(rows);
      if(!error){
        await fetchOverride();
        setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});
        if(sudahAda.length>0){
          alert("Berhasil ditambahkan untuk: "+belumAda.join(", ")+".\nDilewati karena sudah ada override: "+sudahAda.join(", ")+" (gunakan tombol Edit untuk mengubahnya).");
        }
      }
      else alert("Gagal simpan: "+error.message);
    }
  };

  const deleteOverride=async(id:number)=>{
    await supabase.from("fcs_kapasitas_override").delete().eq("id",id);
    setOverrideList(prev=>prev.filter((o:any)=>o.id!==id));
  };

  const fetchAll=async()=>{
    setLoading(true);
    const{data:p}=await supabase.from("fcs_process_time").select("*").order("tipe_panel,wp,kode_komponen");
    setProcessList(p??[]);
    setLoading(false);
  };

  const saveProcess=async()=>{
    if(!procForm.kode_komponen.trim()||!procForm.nama_komponen.trim())return;
    if(editProc){
      const{error}=await supabase.from("fcs_process_time").update({
        nama_komponen:procForm.nama_komponen,
        tipe_panel:procForm.tipe_panel,
        wp:procForm.wp,
        jenis_pekerjaan:procForm.jenis_pekerjaan,
        menit_per_pcs:Number(procForm.menit_per_pcs),
      }).eq("id",editProc.id);
      if(!error){
        setProcessList(prev=>prev.map(p=>p.id===editProc.id?{...p,...procForm}:p));
        setEditProc(null);setShowAddProc(false);
      }
    } else {
      const{data,error}=await supabase.from("fcs_process_time").insert({
        kode_komponen:procForm.kode_komponen.trim(),
        nama_komponen:procForm.nama_komponen.trim(),
        tipe_panel:procForm.tipe_panel,
        wp:procForm.wp,
        jenis_pekerjaan:procForm.jenis_pekerjaan,
        menit_per_pcs:Number(procForm.menit_per_pcs),
      }).select().single();
      if(!error&&data){
        setProcessList(prev=>[...prev,data]);
        setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
        setShowAddProc(false);
      } else if(error){
        alert("Gagal simpan: "+error.message);
      }
    }
  };

  const deleteProcess=async(id:number)=>{
    await supabase.from("fcs_process_time").delete().eq("id",id);
    setProcessList(prev=>prev.filter(p=>p.id!==id));
  };

  const toggleHari=(item:any,hari:number)=>{
    const curr=item.hari_kerja||[];
    const updated=curr.includes(hari)?curr.filter((h:number)=>h!==hari):[...curr,hari].sort();
    setEditKap({...item,hari_kerja:updated});
  };

  const combosList=useMemo(()=>{
    const combos:any[]=[];
    bomList.forEach((b:any)=>{
      ALL_PROSES.forEach((proses:string)=>{
        if(!isKomponenRelevant(b.kode_komponen,b.tipe_panel,proses))return;
        const existing=processList.find((p:any)=>p.kode_komponen===b.kode_komponen&&p.tipe_panel===b.tipe_panel&&p.jenis_pekerjaan===proses);
        combos.push({
          id:existing?existing.id:null,
          kode_komponen:b.kode_komponen,
          nama_komponen:b.nama_komponen,
          tipe_panel:b.tipe_panel,
          wp:b.wp,
          jenis_pekerjaan:proses,
          menit_per_pcs:existing?Number(existing.menit_per_pcs):0,
        });
      });
    });
    return combos;
  },[processList,bomList]);

  const filteredProcess=combosList.filter((p:any)=>{
    const matchTipe=filterTipe==="ALL"||p.tipe_panel===filterTipe;
    const matchPek=filterPekerjaan==="ALL"||p.jenis_pekerjaan===filterPekerjaan;
    const matchSearch=!search||p.nama_komponen.toLowerCase().includes(search.toLowerCase())||p.kode_komponen.toLowerCase().includes(search.toLowerCase());
    return matchTipe&&matchPek&&matchSearch;
  });

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 12px",fontWeight:600,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Sub-tab switcher */}
      <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid #e2e8f0"}}>
        {[{id:"processtime",l:"⚡ Process Time"},{id:"bom",l:"📋 Master Data BOM"},{id:"jenispanel",l:"🗂 Jenis Panel"}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:"8px 18px",fontSize:12,fontWeight:activeTab===t.id?700:500,
              color:activeTab===t.id?"#1d4ed8":"#64748b",cursor:"pointer",
              background:activeTab===t.id?"#eff6ff":"transparent",
              border:"none",borderBottom:activeTab===t.id?"2px solid #1d4ed8":"2px solid transparent",
              fontFamily:"inherit",borderRadius:"6px 6px 0 0"}}>
            {t.l}
          </button>
        ))}
      </div>


      {/* TAB: Process Time */}
      {activeTab==="processtime"&&(
        <div>
          {/* Sub-tab tipe panel */}
          <div style={{display:"flex",gap:2,marginBottom:14,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content"}}>
            {ALL_TIPE.map(t=>{
              const cnt=processList.filter((p:any)=>p.tipe_panel===t).length;
              return(
                <button key={t} onClick={()=>setFilterTipe(t)}
                  style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,
                    fontWeight:filterTipe===t?700:500,
                    background:filterTipe===t?"#fff":"transparent",
                    color:filterTipe===t?"#1d4ed8":"#64748b",
                    boxShadow:filterTipe===t?"0 1px 3px #00000015":"none",
                    fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                  {t}
                  <span style={{background:filterTipe===t?"#eff6ff":"#e2e8f0",color:filterTipe===t?"#1d4ed8":"#94a3b8",
                    borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Cari komponen..."
              style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:200}}/>
            <select value={filterPekerjaan} onChange={e=>setFilterPekerjaan(e.target.value)}
              style={{height:30,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",fontFamily:"inherit"}}>
              <option value="ALL">Semua Pekerjaan</option>
              {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filteredProcess.length} komponen</span>
            <button onClick={()=>{setEditProc(null);setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:filterTipe,wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});setShowAddProc(true);}}
              style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah Komponen</button>
          </div>

          {/* Grouped by Jenis Pekerjaan */}
          {(filterPekerjaan==="ALL"?ALL_PROSES:[filterPekerjaan]).map((proses:string)=>{
            const groupItems=filteredProcess.filter((p:any)=>p.jenis_pekerjaan===proses);
            if(groupItems.length===0&&!(showAddProc&&proses===procForm.jenis_pekerjaan))return null;
            const procColors:any={
              POTONG:"#f59e0b",BENDING:"#8b5cf6",STEL:"#06b6d4",RENDAM:"#0ea5e9",PAINTING:"#ec4899",
              RAKIT:"#10b981","PASANG KOMPONEN":"#3b82f6",BUSBAR:"#f43f5e",
              "WIRING CONTROL":"#6366f1","WIRING POWER":"#0ea5e9","QC TEST":"#84cc16",PACKING:"#64748b"
            };
            const pc=procColors[proses]||"#64748b";
            return(
              <div key={proses} style={{marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{width:8,height:8,borderRadius:99,background:pc,display:"inline-block"}}/>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>{proses}</span>
                  <span style={{background:pc+"15",color:pc,borderRadius:20,padding:"1px 9px",fontSize:10,fontWeight:700}}>{groupItems.length} komponen</span>
                  <div style={{flex:1,height:1,background:"#f1f5f9"}}/>
                </div>



                <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      <th style={thS}>Kode</th>
                      <th style={thS}>Nama Komponen</th>
                      <th style={{...thS,textAlign:"center" as const}}>Tipe Panel</th>
                      <th style={{...thS,textAlign:"center" as const}}>WP</th>
                      <th style={{...thS,textAlign:"center" as const}}>Menit/Pcs</th>
                      <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
                    </tr></thead>
                    <tbody>
                      {groupItems.map((p:any,i:number)=>{
                        const rBg=i%2===0?"#fff":"#f8fafc";
                        const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                        return(
                          <tr key={`${p.tipe_panel}_${p.kode_komponen}_${p.jenis_pekerjaan}`}>
                            <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>{p.kode_komponen}</td>
                            <td style={{...td,fontWeight:500,color:"#1e293b"}}>{p.nama_komponen}</td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.tipe_panel}</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.wp}</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <input type="number" defaultValue={p.menit_per_pcs}
                                onBlur={(e:any)=>{
                                  const val=Number(e.target.value)||0;
                                  if(val===p.menit_per_pcs)return;
                                  if(p.id){
                                    supabase.from("fcs_process_time").update({menit_per_pcs:val}).eq("id",p.id).then(()=>{
                                      setProcessList(prev=>prev.map((x:any)=>x.id===p.id?{...x,menit_per_pcs:val}:x));
                                    });
                                  } else {
                                    supabase.from("fcs_process_time").insert({
                                      kode_komponen:p.kode_komponen,nama_komponen:p.nama_komponen,tipe_panel:p.tipe_panel,
                                      wp:p.wp,jenis_pekerjaan:p.jenis_pekerjaan,menit_per_pcs:val,
                                    }).select().single().then(({data,error}:any)=>{
                                      if(!error&&data)setProcessList(prev=>[...prev,data]);
                                    });
                                  }
                                }}
                                onPaste={(e:any)=>{
                                  const text=e.clipboardData.getData("text");
                                  const values=text.split(/\r?\n|\t/).map((v:string)=>v.trim()).filter((v:string)=>v!=="");
                                  if(values.length<=1)return;
                                  e.preventDefault();
                                  values.forEach((v:string,k:number)=>{
                                    const targetRow=groupItems[i+k];
                                    if(!targetRow)return;
                                    const val=parseFloat(v)||0;
                                    if(targetRow.id){
                                      supabase.from("fcs_process_time").update({menit_per_pcs:val}).eq("id",targetRow.id).then(()=>{
                                        setProcessList(prev=>prev.map((x:any)=>x.id===targetRow.id?{...x,menit_per_pcs:val}:x));
                                      });
                                    } else {
                                      supabase.from("fcs_process_time").insert({
                                        kode_komponen:targetRow.kode_komponen,nama_komponen:targetRow.nama_komponen,tipe_panel:targetRow.tipe_panel,
                                        wp:targetRow.wp,jenis_pekerjaan:targetRow.jenis_pekerjaan,menit_per_pcs:val,
                                      }).select().single().then(({data,error}:any)=>{
                                        if(!error&&data)setProcessList(prev=>[...prev,data]);
                                      });
                                    }
                                  });
                                }}
                                style={{width:55,padding:"4px 6px",borderRadius:6,border:"1px solid #e2e8f0",
                                  textAlign:"center" as const,fontWeight:800,fontSize:13,fontFamily:"'DM Mono',monospace",
                                  color:p.menit_per_pcs>0?"#1d4ed8":"#94a3b8",outline:"none"}}/>
                              <span style={{fontSize:10,color:"#94a3b8",marginLeft:3}}>mnt</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {filteredProcess.length===0&&(
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:28,marginBottom:8}}>📋</div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Tidak ada komponen untuk filter ini</div>
              <div style={{fontSize:11}}>Coba ganti filter tipe panel atau jenis pekerjaan</div>
            </div>
          )}
        </div>
      )}

            {activeTab==="bom"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap" as const}}>
            <input value={bomSearch} onChange={e=>setBomSearch(e.target.value)} placeholder="Cari kode/nama komponen..."
              style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:12,minWidth:200}}/>
            <select value={filterTipeBom} onChange={e=>setFilterTipeBom(e.target.value)}
              style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:12}}>
              <option value="ALL">Semua Tipe</option>
              {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button disabled={migrating} onClick={migrateFromPanelTypes}
              style={{marginLeft:"auto",padding:"7px 16px",borderRadius:8,border:"1.5px solid #9333ea",background:"#faf5ff",color:"#9333ea",fontSize:12,fontWeight:700,cursor:migrating?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {migrating?"⏳ Migrasi...":"⬇ Migrasi dari PANEL_TYPES"}
            </button>
            <button onClick={()=>{setShowAddBom(true);setEditBom(null);setBomForm({kode_komponen:"",nama_komponen:"",tipe_panel:filterTipeBom==="ALL"?"FS":filterTipeBom,wp:"WP1",urutan:0});}}
              style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah Komponen</button>
          </div>
          {migrateResult&&(
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#16a34a",fontWeight:600}}>{migrateResult}</div>
          )}
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{fontSize:12,fontWeight:700,color:"#92400e"}}>Checklist Panel Existing Belum Sinkron?</div>
              <div style={{fontSize:11,color:"#92400e",marginTop:2}}>Kalau kode di BOM pernah digeser, checklist panel LAMA bisa jadi gak nyambung lagi. Klik ini buat nyesuain ulang (progress/qty gak hilang).</div>
            </div>
            <button disabled={migratingChecklist} onClick={migrateChecklistKode}
              style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #d97706",background:"#fff",color:"#d97706",fontSize:11,fontWeight:700,cursor:migratingChecklist?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
              {migratingChecklist?"Memproses...":"Sinkronkan Checklist Panel"}
            </button>
          </div>
          {migrateChecklistResult&&(
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#16a34a",fontWeight:600}}>{migrateChecklistResult}</div>
          )}
          <div style={{overflowX:"auto" as const,borderRadius:8,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  <th style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,color:"#64748b",fontWeight:700}}>KODE</th>
                  <th style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,color:"#64748b",fontWeight:700}}>NAMA KOMPONEN</th>
                  <th style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,color:"#64748b",fontWeight:700}}>TIPE PANEL</th>
                  <th style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,color:"#64748b",fontWeight:700}}>WP</th>
                  <th style={{padding:"8px 12px",textAlign:"center" as const,fontSize:10,color:"#64748b",fontWeight:700}}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {bomList.filter((b:any)=>
                  (filterTipeBom==="ALL"||b.tipe_panel===filterTipeBom) &&
                  (!bomSearch||b.kode_komponen.toLowerCase().includes(bomSearch.toLowerCase())||b.nama_komponen.toLowerCase().includes(bomSearch.toLowerCase()))
                ).map((b:any,i:number)=>(
                  <tr key={b.id} style={{background:i%2===0?"#fff":"#f8fafc",borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"7px 12px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"#1e293b"}}>{b.kode_komponen}</td>
                    <td style={{padding:"7px 12px",color:"#374151"}}>{b.nama_komponen}</td>
                    <td style={{padding:"7px 12px"}}><span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{b.tipe_panel}</span></td>
                    <td style={{padding:"7px 12px"}}><span style={{background:"#f1f5f9",color:"#64748b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{b.wp}</span></td>
                    <td style={{padding:"7px 12px",textAlign:"center" as const}}>
                      <button onClick={()=>openProsesModal(b)} title="Atur proses relevan"
                        style={{background:"none",border:"none",cursor:"pointer",color:"#7c3aed",fontSize:12,marginRight:8}}>🔧</button>
                      <button onClick={()=>{setEditBom(b);setBomForm({kode_komponen:b.kode_komponen,nama_komponen:b.nama_komponen,tipe_panel:b.tipe_panel,wp:b.wp,urutan:b.urutan||0});setShowAddBom(true);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#1d4ed8",fontSize:12,marginRight:8}}>✎</button>
                      <button onClick={()=>deleteBom(b.id)}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12}}>🗑</button>
                    </td>
                  </tr>
                ))}
                {bomList.filter((b:any)=>
                  (filterTipeBom==="ALL"||b.tipe_panel===filterTipeBom) &&
                  (!bomSearch||b.kode_komponen.toLowerCase().includes(bomSearch.toLowerCase())||b.nama_komponen.toLowerCase().includes(bomSearch.toLowerCase()))
                ).length===0&&(
                  <tr><td colSpan={5} style={{padding:24,textAlign:"center" as const,color:"#94a3b8",fontSize:12}}>Belum ada komponen. Klik "+ Tambah Komponen" buat mulai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {showAddBom&&(
            <div onClick={()=>{setShowAddBom(false);setEditBom(null);}}
              style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
              <div onClick={(e:any)=>e.stopPropagation()}
                style={{background:"#fff",borderRadius:12,padding:20,width:400,maxWidth:"100%"}}>
                <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{editBom?"Edit":"Tambah"} Komponen BOM</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                  <div>
                    <Lbl>Kode Komponen</Lbl>
                    <Inp value={bomForm.kode_komponen} onChange={(e:any)=>setBomForm({...bomForm,kode_komponen:e.target.value})} placeholder="misal FS.1"/>
                  </div>
                  <div>
                    <Lbl>Nama Komponen</Lbl>
                    <Inp value={bomForm.nama_komponen} onChange={(e:any)=>setBomForm({...bomForm,nama_komponen:e.target.value})} placeholder="misal Groundplate"/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <Lbl>Tipe Panel</Lbl>
                      <Sel value={bomForm.tipe_panel} onChange={(e:any)=>setBomForm({...bomForm,tipe_panel:e.target.value})}>
                        {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
                      </Sel>
                    </div>
                    <div>
                      <Lbl>WP</Lbl>
                      <Sel value={bomForm.wp} onChange={(e:any)=>setBomForm({...bomForm,wp:e.target.value})}>
                        {ALL_WP.map(w=><option key={w} value={w}>{w}</option>)}
                      </Sel>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
                  <Btn outline color="#64748b" onClick={()=>{setShowAddBom(false);setEditBom(null);}}>Batal</Btn>
                  <Btn color="#1d4ed8" onClick={saveBom}>Simpan</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab==="jenispanel"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,color:"#64748b"}}>Kelola tipe panel & pembagian WP-nya (label, warna, range kode) - langsung dari sini, gak perlu edit kode lagi</div>
            <button onClick={()=>{setShowAddTipe(true);setTipeForm({tipe_panel:"",label:""});}}
              style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>+ Tambah Tipe Panel</button>
          </div>
          {panelTypeList.length===0?(
            <div style={{padding:24,textAlign:"center" as const,color:"#94a3b8",fontSize:12}}>Belum ada tipe panel. Klik "+ Tambah Tipe Panel" buat mulai.</div>
          ):(
            panelTypeList.map((t:any)=>{
              const wps=panelWpList.filter((w:any)=>w.tipe_panel===t.tipe_panel);
              const isExp=expandedTipePanel===t.tipe_panel;
              return(
                <div key={t.tipe_panel} style={{border:"1px solid #e2e8f0",borderRadius:10,marginBottom:10,overflow:"hidden"}}>
                  <div onClick={()=>setExpandedTipePanel(isExp?null:t.tipe_panel)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",background:isExp?"#f8faff":"#fff"}}>
                    <span style={{fontSize:14}}>{isExp?"▼":"▶"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t.tipe_panel} — {t.label}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{wps.length} WP</div>
                    </div>
                    <button onClick={(e:any)=>{e.stopPropagation();deleteTipePanel(t.tipe_panel);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:14}}>🗑</button>
                  </div>
                  {isExp&&(
                    <div style={{padding:"12px 16px",borderTop:"1px solid #e2e8f0"}}>
                      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                        <button onClick={()=>openWizard(t.tipe_panel)}
                          style={{padding:"5px 12px",borderRadius:6,border:"1px solid #1d4ed8",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah WP</button>
                      </div>
                      {wps.map((w:any)=>{
                        const wpKey=w.tipe_panel+"_"+w.wp;
                        const isWpExp=expandedWpKey===wpKey;
                        const komponenDiWp=bomList.filter((b:any)=>b.tipe_panel===w.tipe_panel&&b.wp===w.wp);
                        return(
                        <div key={w.id} style={{borderRadius:8,border:"1px solid #e2e8f0",marginBottom:6,overflow:"hidden"}}>
                          <div onClick={()=>setExpandedWpKey(isWpExp?null:wpKey)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",cursor:"pointer",background:isWpExp?"#f8faff":"#fff"}}>
                            <span style={{fontSize:11}}>{isWpExp?"▼":"▶"}</span>
                            <span style={{width:16,height:16,borderRadius:4,background:w.color,flexShrink:0}}/>
                            <span style={{fontWeight:700,fontSize:12,color:"#1e293b",minWidth:50}}>{w.wp}</span>
                            <span style={{fontSize:11,color:"#64748b",flex:1}}>{w.range_label} · {komponenDiWp.length} komponen</span>
                            <button onClick={(e:any)=>{e.stopPropagation();setEditWpMeta(w);setWpForm({tipe_panel:w.tipe_panel,wp:w.wp,color:w.color,range_label:w.range_label||""});setShowAddWp(true);}}
                              style={{background:"none",border:"none",cursor:"pointer",color:"#2563eb",fontSize:13}}>✎</button>
                            <button onClick={(e:any)=>{e.stopPropagation();deleteWpMeta(w.id);}}
                              style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:13}}>🗑</button>
                          </div>
                          {isWpExp&&(
                            <div style={{padding:"8px 10px",borderTop:"1px solid #e2e8f0",background:"#fafbfc"}}>
                              {komponenDiWp.length===0?(
                                <div style={{fontSize:11,color:"#94a3b8",padding:"8px 0"}}>Belum ada komponen di WP ini.</div>
                              ):komponenDiWp.map((b:any)=>(
                                <div key={b.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,background:"#fff",border:"1px solid #f1f5f9",marginBottom:4}}>
                                  <span style={{fontSize:10,color:"#94a3b8",fontWeight:700,minWidth:60}}>{b.kode_komponen}</span>
                                  <span style={{fontSize:12,color:"#1e293b",flex:1}}>{b.nama_komponen}</span>
                                  <button onClick={()=>openProsesModal(b)} title="Atur proses relevan"
                                    style={{background:"none",border:"none",cursor:"pointer",color:"#7c3aed",fontSize:12,marginRight:4}}>🔧</button>
                                  <button onClick={()=>{setEditBom(b);setBomForm({kode_komponen:b.kode_komponen,nama_komponen:b.nama_komponen,tipe_panel:b.tipe_panel,wp:b.wp,urutan:b.urutan||0});setShowAddBom(true);}}
                                    style={{background:"none",border:"none",cursor:"pointer",color:"#1d4ed8",fontSize:12,marginRight:4}}>✎</button>
                                  <button onClick={()=>deleteBom(b.id)}
                                    style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12}}>🗑</button>
                                </div>
                              ))}
                              <button onClick={()=>{
                                setWizardTipe(w.tipe_panel);setWizardWp(w.wp);setWizardColor(w.color);setWizardRange(w.range_label||"");
                                supabase.from("bom_master").select("nama_komponen").then(({data}:any)=>{
                                  const uniqueNama=Array.from(new Set((data||[]).map((r:any)=>r.nama_komponen))).sort();
                                  setWizardAllNama(uniqueNama);
                                  setWizardSelectedNama([]);setWizardProsesPerNama({});setWizardStep(2);
                                });
                              }} style={{marginTop:6,padding:"5px 10px",borderRadius:6,border:"1px dashed #94a3b8",background:"#fff",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah Komponen ke WP Ini</button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {showAddTipe&&(
        <div onClick={()=>setShowAddTipe(false)} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:20,width:360}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>+ Tambah Tipe Panel</div>
            <div style={{marginBottom:10}}>
              <Lbl>Kode Tipe (unik, misal FS, WM_MS)</Lbl>
              <Inp value={tipeForm.tipe_panel} onChange={(e:any)=>setTipeForm({...tipeForm,tipe_panel:e.target.value.toUpperCase()})}/>
            </div>
            <div style={{marginBottom:16}}>
              <Lbl>Label Tampilan</Lbl>
              <Inp value={tipeForm.label} onChange={(e:any)=>setTipeForm({...tipeForm,label:e.target.value})}/>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn outline color="#64748b" onClick={()=>setShowAddTipe(false)}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={saveTipePanel}>Simpan</Btn>
            </div>
          </div>
        </div>
      )}
      {showAddWp&&(
        <div onClick={()=>{setShowAddWp(false);setEditWpMeta(null);}} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:20,width:360}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>{editWpMeta?"Edit WP":"+ Tambah WP"}</div>
            <div style={{marginBottom:10}}>
              <Lbl>Kode WP (misal WP1)</Lbl>
              <Inp value={wpForm.wp} disabled={!!editWpMeta} onChange={(e:any)=>setWpForm({...wpForm,wp:e.target.value.toUpperCase()})}/>
            </div>
            <div style={{marginBottom:10}}>
              <Lbl>Warna</Lbl>
              <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                {WP_COLOR_PRESET.map(c=>(
                  <button key={c} type="button" onClick={()=>setWpForm({...wpForm,color:c})}
                    style={{width:30,height:30,borderRadius:8,background:c,cursor:"pointer",border:wpForm.color===c?"3px solid #1e293b":"1.5px solid #e2e8f0"}}/>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <Lbl>Range/Keterangan (misal FS.1-10)</Lbl>
              <Inp value={wpForm.range_label} onChange={(e:any)=>setWpForm({...wpForm,range_label:e.target.value})}/>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn outline color="#64748b" onClick={()=>{setShowAddWp(false);setEditWpMeta(null);}}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={saveWpMeta}>Simpan</Btn>
            </div>
          </div>
        </div>
      )}
      {prosesRelevanModal&&(
        <div onClick={()=>setProsesRelevanModal(null)} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:20,width:380,maxHeight:"80vh",overflowY:"auto" as const}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>🔧 Atur Proses Relevan</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>{prosesRelevanModal.kode_komponen} — {prosesRelevanModal.nama_komponen} ({prosesRelevanModal.tipe_panel})</div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Centang proses yang BUTUH komponen ini. Yang gak dicentang berarti komponen ini gak muncul di proses itu.</div>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
              {ALL_PROSES.map((proses:string)=>(
                <label key={proses} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,border:`1.5px solid ${selectedProsesRelevan.includes(proses)?"#7c3aed":"#e2e8f0"}`,background:selectedProsesRelevan.includes(proses)?"#f5f3ff":"#f8fafc",cursor:"pointer"}}>
                  <input type="checkbox" checked={selectedProsesRelevan.includes(proses)} onChange={()=>toggleProsesRelevan(proses)}/>
                  <span style={{fontSize:12,fontWeight:selectedProsesRelevan.includes(proses)?700:400,color:selectedProsesRelevan.includes(proses)?"#7c3aed":"#475569"}}>{proses}</span>
                </label>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn outline color="#64748b" onClick={()=>setProsesRelevanModal(null)}>Batal</Btn>
              <Btn color="#7c3aed" onClick={saveProsesRelevan}>{savingProsesRelevan?"Menyimpan...":"Simpan"}</Btn>
            </div>
          </div>
        </div>
      )}
      {wizardStep>0&&(
        <div onClick={()=>setWizardStep(0)} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:20,width:480,maxHeight:"85vh",overflowY:"auto" as const}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>+ Tambah WP — {wizardTipe}</div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:16}}>Langkah {wizardStep} dari 3</div>

            {wizardStep===1&&(
              <div>
                <div style={{marginBottom:10}}>
                  <Lbl>Pilih WP</Lbl>
                  <Sel value={wizardWp} onChange={(e:any)=>setWizardWp(e.target.value)}>
                    {WP_OPTIONS.map(wp=><option key={wp} value={wp}>{wp}</option>)}
                  </Sel>
                </div>
                <div style={{marginBottom:10}}>
                  <Lbl>Warna</Lbl>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                    {WP_COLOR_PRESET.map(c=>(
                      <button key={c} type="button" onClick={()=>setWizardColor(c)}
                        style={{width:30,height:30,borderRadius:8,background:c,cursor:"pointer",border:wizardColor===c?"3px solid #1e293b":"1.5px solid #e2e8f0"}}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <Lbl>Range/Keterangan (opsional)</Lbl>
                  <Inp value={wizardRange} onChange={(e:any)=>setWizardRange(e.target.value)} placeholder={`misal ${wizardTipe}.1-5`}/>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                  <Btn outline color="#64748b" onClick={()=>setWizardStep(0)}>Batal</Btn>
                  <Btn color="#1d4ed8" onClick={()=>setWizardStep(2)}>Lanjut →</Btn>
                </div>
              </div>
            )}

            {wizardStep===2&&(
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Centang komponen yang dipakai di {wizardWp} buat tipe panel ini:</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:5,maxHeight:320,overflowY:"auto" as const,marginBottom:16}}>
                  {wizardAllNama.map(nama=>(
                    <label key={nama} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",borderRadius:6,border:`1.5px solid ${wizardSelectedNama.includes(nama)?"#1d4ed8":"#e2e8f0"}`,background:wizardSelectedNama.includes(nama)?"#eff6ff":"#f8fafc",cursor:"pointer"}}>
                      <input type="checkbox" checked={wizardSelectedNama.includes(nama)} onChange={()=>toggleWizardNama(nama)}/>
                      <span style={{fontSize:12,fontWeight:wizardSelectedNama.includes(nama)?700:400}}>{nama}</span>
                    </label>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <Btn outline color="#64748b" onClick={()=>setWizardStep(1)}>← Kembali</Btn>
                  <Btn color="#1d4ed8" onClick={()=>wizardSelectedNama.length>0&&setWizardStep(3)}>Lanjut ({wizardSelectedNama.length} dipilih) →</Btn>
                </div>
              </div>
            )}

            {wizardStep===3&&(
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Centang proses yang butuh tiap komponen:</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:12,maxHeight:400,overflowY:"auto" as const,marginBottom:16}}>
                  {wizardSelectedNama.map(nama=>(
                    <div key={nama} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:10}}>
                      <div style={{fontWeight:700,fontSize:12,marginBottom:6}}>{nama}</div>
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                        {ALL_PROSES.map((proses:string)=>{
                          const checked=(wizardProsesPerNama[nama]||[]).includes(proses);
                          return(
                            <button key={proses} onClick={()=>toggleWizardProses(nama,proses)}
                              style={{padding:"3px 8px",borderRadius:5,border:`1.5px solid ${checked?"#7c3aed":"#e2e8f0"}`,background:checked?"#f5f3ff":"#fff",color:checked?"#7c3aed":"#94a3b8",fontSize:10,fontWeight:checked?700:400,cursor:"pointer"}}>
                              {proses}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <Btn outline color="#64748b" onClick={()=>setWizardStep(2)}>← Kembali</Btn>
                  <Btn color="#16a34a" onClick={saveWizardWp}>{wizardSaving?"Menyimpan...":"Simpan WP Ini"}</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddProc&&(
        <div onClick={()=>{setShowAddProc(false);setEditProc(null);}}
          style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:560,padding:20,maxHeight:"85vh",overflowY:"auto" as const}}>
            <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:14}}>{editProc?"✏️ Edit Process Time":"➕ Tambah Process Time"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tipe Panel</div>
                <select value={procForm.tipe_panel} onChange={e=>setProcForm({...procForm,tipe_panel:e.target.value,kode_komponen:"",nama_komponen:""})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13}}>
                  {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>WP</div>
                <select value={procForm.wp} onChange={e=>setProcForm({...procForm,wp:e.target.value,kode_komponen:"",nama_komponen:""})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13}}>
                  {ALL_WP.map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Komponen (dari Master Data BOM)</div>
              <select value={procForm.kode_komponen} disabled={!!editProc}
                onChange={e=>{
                  const kode=e.target.value;
                  const item=bomList.find((b:any)=>b.tipe_panel===procForm.tipe_panel&&b.wp===procForm.wp&&b.kode_komponen===kode);
                  setProcForm({...procForm,kode_komponen:kode,nama_komponen:item?.nama_komponen||""});
                }}
                style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,background:editProc?"#f1f5f9":"#fff"}}>
                <option value="">-- Pilih komponen --</option>
                {bomList.filter((b:any)=>b.tipe_panel===procForm.tipe_panel&&b.wp===procForm.wp).map((b:any)=>(
                  <option key={b.kode_komponen} value={b.kode_komponen}>{b.kode_komponen} — {b.nama_komponen}</option>
                ))}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                <select value={procForm.jenis_pekerjaan} onChange={e=>setProcForm({...procForm,jenis_pekerjaan:e.target.value})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13}}>
                  {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Menit/Pcs</div>
                <input type="number" min="0" step="0.25" value={procForm.menit_per_pcs}
                  onChange={e=>setProcForm({...procForm,menit_per_pcs:parseFloat(e.target.value)||0})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,textAlign:"center" as const}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>{setShowAddProc(false);setEditProc(null);}}
                style={{padding:"8px 16px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
              <button onClick={saveProcess}
                style={{padding:"8px 18px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editProc?"Simpan":"+ Tambah"}</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Override Tanggal */}

    </div>
  );
}
