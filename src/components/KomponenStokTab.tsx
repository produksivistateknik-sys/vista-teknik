import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { stokTransaksiService, transaksiMasuk, transaksiKeluar } from '../services/stokTransaksiService'
import { Card, Lbl, Inp, Btn, Modal } from './ui/Primitives'

// FONDASI STOK (2 Okt 2026) - semua perubahan stok lewat stokTransaksiService.catat (RPC atomik
// catat_transaksi_stok, tercatat di komponen_stok_transaksi). Riwayat masuk/keluar dibaca dari
// tabel transaksi & dipetakan ke bentuk lama (masuklist/keluarList) - tampilan gak berubah.
// Keluar dulu dihitung dari regex teks activity_log (gak pernah kebaca) - sekarang data asli.
export function KomponenStokTab({user,activityLog,invTab="data"}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [transaksi,setTransaksi]=useState<any[]>([]);
  const masuklist=transaksiMasuk(transaksi,stokList);
  const keluarList=transaksiKeluar(transaksi,stokList);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({nama:"",kode:"",stok:0,bomRef:""});
  // Acuan BOM (2 Okt 2026, Produksi Stok) - "TIPE|KODE" dari bom_master; tahap batch produksi
  // stok dibaca dari bom_proses_relevan acuan ini (satu aturan dgn WO).
  const [bomList,setBomList]=useState<any[]>([]);
  const [editId,setEditId]=useState<any>(null);
  const [search,setSearch]=useState("");
  const [filterKode,setFilterKode]=useState("ALL");
  const [filterTipe,setFilterTipe]=useState("FS");
  const [showKeluar,setShowKeluar]=useState<any>(null);
  const [showMasuk,setShowMasuk]=useState<any>(null);
  const [keluarForm,setKeluarForm]=useState({jumlah:1,proyek:"",panel:"",keterangan:""});
  const [masukForm,setMasukForm]=useState({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""});
  const [delId,setDelId]=useState<any>(null);
  const [qtySort,setQtySort]=useState<"none"|"asc"|"desc">("none");
  const toggleQtySort=()=>setQtySort(prev=>prev==="none"?"asc":prev==="asc"?"desc":"none");

  const getUname=()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    return user?.name||user?.nama||sess?.nama||"Admin";
  };

  useEffect(()=>{
    fetchAll();
    // Realtime listener untuk komponen_stok
    const ch=supabase.channel("realtime-komponen-stok")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.map(s=>s.id===payload.new.id?{...s,...payload.new}:s));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.some(s=>s.id===payload.new.id)?prev:[...prev,payload.new]);})
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.filter(s=>s.id!==payload.old.id));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok_transaksi"},
        (payload)=>{setTransaksi(prev=>prev.some(t=>t.id===payload.new.id)?prev:[payload.new,...prev]);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // A.2 (2 Okt 2026) - dulu error diabaikan, gagal baca tampil "kosong" tanpa pesan.
  const fetchAll=async()=>{
    setLoading(true);
    try{
      const[s,t,bom]=await Promise.all([stokTransaksiService.ambilStok(),stokTransaksiService.ambilTransaksi(),
        supabase.from("bom_master").select("tipe_panel,kode_komponen,nama_komponen,urutan").order("tipe_panel").order("urutan").range(0,1999)]);
      if(bom.error)throw new Error("baca bom_master: "+bom.error.message);
      setStokList(s);
      setTransaksi(t);
      setBomList(bom.data||[]);
    }catch(err:any){
      console.error("[KomponenStok] gagal memuat data:",err);
      alert("Gagal memuat data stok komponen: "+(err?.message||err)+"\n\nRefresh halaman untuk mencoba lagi.");
    }finally{
      setLoading(false);
    }
  };

  const save=async()=>{
    if(!form.nama.trim())return;
    const uname=getUname();
    // BUG FIX (23 Sep 2026, ditemukan lewat audit "error Supabase gak dicek") - dulu cuma
    // destructure {data}, error diabaikan total - kalau update/insert gagal, `data` null,
    // block if(data){...} di-skip (gak ada activity log, gak ada update state), TAPI form tetap
    // di-reset di baris terakhir (dulu di luar kedua cabang) - user lihat form kosong lagi kayak
    // berhasil tersimpan, padahal DB gak berubah sama sekali. Sekarang cek error eksplisit, alert
    // + return sebelum reset form kalau gagal (form TIDAK di-reset biar user gak kehilangan input).
    if(editId){
      // Nama/kode di-update langsung; ANGKA STOK gak lagi ditimpa diam-diam - kalau berubah, dicatat
      // sbg transaksi 'koreksi' lewat RPC (selisihnya dihitung di DB, tercatat atas nama user ini).
      const{data,error}=await sbStok.from("komponen_stok").update({
        nama:form.nama.trim(),kode:form.kode.trim(),...bomRefKolom(form.bomRef),
        updated_at:new Date().toISOString()
      }).eq("id",editId).select().single();
      if(error){alert("Gagal menyimpan: "+error.message);return;}
      let barisAkhir=data;
      if((Number(form.stok)||0)!==(Number(data.stok)||0)){
        try{
          const t=await stokTransaksiService.catat({komponenId:editId,tipe:"koreksi",jumlah:Number(form.stok)||0,
            keterangan:"Koreksi stok lewat form edit komponen",createdBy:uname});
          if(t)barisAkhir={...data,stok:t.stok_sesudah};
        }catch(err:any){
          alert("Nama/kode tersimpan, tapi koreksi stok GAGAL: "+(err?.message||err));
          setStokList(prev=>prev.map(s=>s.id===editId?data:s));
          return;
        }
      }
      setStokList(prev=>prev.map(s=>s.id===editId?barisAkhir:s));
      await activityLogService.insert({user_name:uname,action:"EDIT KOMPONEN STOK",
        description:"Edit komponen: "+form.nama+" ("+form.kode+")",module:"stok",halaman:"System"});
      setEditId(null);
    } else {
      const{data,error}=await sbStok.from("komponen_stok").insert({
        nama:form.nama.trim(),kode:form.kode.trim(),...bomRefKolom(form.bomRef),stok:Number(form.stok)||0,created_by:uname
      }).select().single();
      if(error){alert("Gagal menyimpan: "+error.message);return;}
      setStokList(prev=>[...prev,data]);
      await activityLogService.insert({user_name:uname,action:"TAMBAH KOMPONEN STOK",
        description:"Tambah komponen: "+form.nama+" ("+form.kode+") stok awal: "+form.stok,module:"stok",halaman:"System"});
    }
    setForm({nama:"",kode:"",stok:0,bomRef:""});
  };

  const startEdit=(s:any)=>{setEditId(s.id);setForm({nama:s.nama,kode:s.kode||"",stok:s.stok,bomRef:s.bom_kode_komponen?s.bom_tipe_panel+"|"+s.bom_kode_komponen:""});};
  const cancelEdit=()=>{setEditId(null);setForm({nama:"",kode:"",stok:0,bomRef:""});};
  // Kolom bom_tipe_panel/bom_kode_komponen (migration 20261002030000) belum ada di
  // supabase-generated.ts - tulis komponen_stok lewat client tanpa tipe. Hapus setelah tipe di-generate ulang.
  const sbStok:any=supabase;
  const bomRefKolom=(ref:string)=>{const[t,k]=ref?ref.split("|"):[null,null];return{bom_tipe_panel:t||null,bom_kode_komponen:k||null};};

  const tambahMasuk=async()=>{
    if(!showMasuk)return;
    const jml=Number(masukForm.jumlah)||0;
    if(jml<=0){alert("Jumlah harus lebih dari 0!");return;}
    const uname=getUname();
    // RPC atomik (2 Okt 2026) - kunci baris + update stok + catat transaksi 'masuk' dalam 1
    // transaksi DB. Gantiin pola fresh-read + update bersyarat (race lost-update 5 Sep 2026).
    let t:any;
    try{
      t=await stokTransaksiService.catatMasuk({komponenId:showMasuk.id,jumlah:jml,
        keterangan:masukForm.keterangan||null,createdBy:uname,tanggal:masukForm.tanggal});
    }catch(err:any){
      alert("Gagal menyimpan stok masuk: "+(err?.message||err));
      return;
    }
    setStokList(prev=>prev.map(s=>s.id===showMasuk.id?{...s,stok:t.stok_sesudah,updated_at:new Date().toISOString()}:s));
    setTransaksi(prev=>prev.some(x=>x.id===t.id)?prev:[t,...prev]);
    await activityLogService.insert({
      user_name:uname,action:"MASUK KOMPONEN",
      description:`Masuk: ${showMasuk.nama} (${showMasuk.kode||"-"}) +${jml} pcs — ${masukForm.keterangan||"-"}. Stok: ${t.stok_sesudah}`,
      module:"stok",halaman:"System"
    });
    setShowMasuk(null);
    setMasukForm({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""});
  };

  const keluarkan=async()=>{
    if(!showKeluar)return;
    const jml=Number(keluarForm.jumlah)||0;
    if(jml<=0){alert("Jumlah harus lebih dari 0!");return;}
    if(!keluarForm.proyek.trim()){alert("Proyek harus diisi!");return;}
    const uname=getUname();
    // RPC atomik - cek "stok cukup" sekarang di DB (baris dikunci), pesan error dari DB diteruskan
    // apa adanya (mis. "Stok tidak cukup! Stok tersedia: N").
    let t:any;
    try{
      t=await stokTransaksiService.catatKeluar({komponenId:showKeluar.id,jumlah:jml,
        proyek:keluarForm.proyek.trim(),panel:keluarForm.panel||null,keterangan:keluarForm.keterangan||null,createdBy:uname});
    }catch(err:any){
      alert("Gagal menyimpan stok keluar: "+(err?.message||err));
      return;
    }
    setStokList(prev=>prev.map(s=>s.id===showKeluar.id?{...s,stok:t.stok_sesudah,updated_at:new Date().toISOString()}:s));
    setTransaksi(prev=>prev.some(x=>x.id===t.id)?prev:[t,...prev]);
    await activityLogService.insert({
      user_name:uname,action:"KELUAR KOMPONEN",
      description:`Keluar: ${showKeluar.nama} (${showKeluar.kode||"-"}) x${jml} pcs → Proyek: ${keluarForm.proyek}, Panel: ${keluarForm.panel||"-"}, Ket: ${keluarForm.keterangan||"-"}. Sisa: ${t.stok_sesudah}`,
      module:"stok",halaman:"System",proyek:keluarForm.proyek,panel:keluarForm.panel
    });
    setShowKeluar(null);
    setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""});
  };

  const hapus=async()=>{
    const item=stokList.find(s=>s.id===delId);
    // A.2 (2 Okt 2026) - dulu kedua delete gak dicek error-nya, UI langsung buang baris walau DB
    // gagal. Riwayat transaksi ikut terhapus otomatis (FK ON DELETE CASCADE) - sama perilakunya
    // dgn riwayat masuk lama yang juga dihapus di sini. komponen_stok_masuk = tabel lama.
    const{error:mErr}=await supabase.from("komponen_stok_masuk").delete().eq("komponen_id",delId);
    if(mErr){alert("Gagal menghapus riwayat masuk lama: "+mErr.message);return;}
    const{error}=await supabase.from("komponen_stok").delete().eq("id",delId);
    if(error){alert("Gagal menghapus komponen: "+error.message);return;}
    setStokList(prev=>prev.filter(s=>s.id!==delId));
    setTransaksi(prev=>prev.filter(t=>t.komponen_id!==delId));
    setDelId(null);
    const uname=getUname();
    await activityLogService.insert({user_name:uname,action:"HAPUS KOMPONEN STOK",
      description:"Hapus komponen: "+(item?.nama||"-")+" ("+item?.kode+")",module:"stok",halaman:"System"});
  };

  // Hitung total masuk & keluar per komponen
  const getMasukTotal=(id:number)=>masuklist.filter(m=>m.komponen_id===id).reduce((a:number,m:any)=>a+m.jumlah,0);
  // Keluar dari tabel transaksi (2 Okt 2026) - dulu regex teks activity_log, gak pernah kebaca.
  const getKeluarTotal=(id:number)=>keluarList.filter(k=>k.komponen_id===id).reduce((a:number,k:any)=>a+k.jumlah,0);
  const getMasukTerakhir=(id:number)=>{
    const m=masuklist.filter(x=>x.komponen_id===id)[0];
    return m?{tanggal:m.tanggal,jumlah:m.jumlah}:null;
  };
  const getKeluarTerakhir=(id:number)=>{
    const k=keluarList.find(x=>x.komponen_id===id); // transaksi sudah urut tanggal terbaru dulu
    return k?{tanggal:k.tanggal,jumlah:k.jumlah}:null;
  };

  const kodeList=["ALL",...Array.from(new Set(stokList.map((s:any)=>s.kode).filter(Boolean)))];
  const filtered=stokList.filter(s=>
    (filterKode==="ALL"||s.kode===filterKode)&&
    s.nama.toLowerCase().includes(search.toLowerCase())
  );
  // Sort QTY Total (3 Sep 2026) - klik header toggle none->asc->desc->none, "none" balik ke
  // urutan asli (alfabetis nama, dari .order("nama") pas fetch).
  const sortedFiltered=qtySort==="none"?filtered
    :[...filtered].sort((a,b)=>qtySort==="asc"?a.stok-b.stok:b.stok-a.stok);

  // Riwayat gabungan masuk + keluar dari activity log
  const riwayatMasuk=masuklist.map((m:any)=>({
    tanggal:m.tanggal,kode:stokList.find(s=>s.id===m.komponen_id)?.kode||"-",
    nama:m.nama,tipe:"masuk",jumlah:m.jumlah,
    keterangan:m.keterangan||"-",panel:"-",oleh:m.created_by||"-"
  }));
  // Keluar dari tabel transaksi (2 Okt 2026) - dulu diparse regex dari teks activity_log.
  // keterangan dirangkai mirip teks log lama biar kolom Keterangan tetap informatif.
  const riwayatKeluar=keluarList.map((k:any)=>({
    tanggal:k.tanggal,kode:k.kode,nama:k.nama,tipe:"keluar",jumlah:k.jumlah,
    keterangan:`Proyek: ${k.proyek||"-"}${k.keterangan?" — "+k.keterangan:""}`,panel:k.panel||"-",oleh:k.created_by||"-"
  }));
  const riwayat=[...riwayatMasuk,...riwayatKeluar]
    .filter(r=>{
      const matchTipe=filterTipe==="ALL"||(filterTipe==="masuk"&&r.tipe==="masuk")||(filterTipe==="keluar"&&r.tipe==="keluar");
      const matchKode=filterKode==="ALL"||r.kode===filterKode;
      const matchSearch=!search||r.nama?.toLowerCase().includes(search.toLowerCase());
      return matchTipe&&matchKode&&matchSearch;
    })
    .sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));

  const totalMasuk=masuklist.reduce((a:number,m:any)=>a+m.jumlah,0);
  const totalKeluar=stokList.reduce((a:number,s:any)=>a+getKeluarTotal(s.id),0);
  const totalStok=stokList.reduce((a:number,s:any)=>a+s.stok,0);

  const thS:any={background:"#1e3a8a",color:"#fff",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff18",
    textTransform:"uppercase",letterSpacing:.4};

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
        {[
          {l:"Total Komponen",v:stokList.length,c:"#2563eb"},
          {l:"Stok Tersedia",v:totalStok+" pcs",c:"#16a34a"},
          {l:"Total Masuk",v:"+"+totalMasuk,c:"#16a34a"},
          {l:"Total Keluar",v:"-"+totalKeluar,c:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"10px 14px"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:s.c,marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Form tambah/edit */}
      <Card style={{marginBottom:14,display:invTab==="data"?"block":"none"}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>
          {editId?"✏️ Edit Komponen":"➕ Tambah Komponen"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{minWidth:120}}>
            <Lbl>Kode</Lbl>
            <Inp value={form.kode} onChange={(e:any)=>setForm({...form,kode:e.target.value})}
              placeholder="FR-001..." style={{width:120}}/>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <Lbl>Nama Komponen</Lbl>
            <Inp value={form.nama} onChange={(e:any)=>setForm({...form,nama:e.target.value})}
              placeholder="Nama komponen..." onKeyDown={(e:any)=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:100}}>
            <Lbl>Stok Awal (pcs)</Lbl>
            <Inp type="number" min="0" value={form.stok}
              onChange={(e:any)=>setForm({...form,stok:e.target.value})}/>
          </div>
          <div style={{minWidth:200}}>
            <Lbl>Acuan BOM (Produksi Stok)</Lbl>
            <select value={form.bomRef} onChange={(e:any)=>setForm({...form,bomRef:e.target.value})}
              title="Komponen BOM yang prosesnya jadi acuan tahap Produksi Stok item ini"
              style={{width:200,padding:"9px 12px",borderRadius:8,border:"1.5px solid var(--border-color,#e2e8f0)",background:"var(--input-bg,#f8fafc)",color:"var(--text-primary,#1e293b)",fontSize:13}}>
              <option value="">— Tidak ada —</option>
              {["FS",...Array.from(new Set(bomList.map((b:any)=>b.tipe_panel))).filter(t=>t!=="FS")].map(tipe=>(
                <optgroup key={tipe} label={tipe}>
                  {bomList.filter((b:any)=>b.tipe_panel===tipe).map((b:any)=>(
                    <option key={tipe+b.kode_komponen} value={tipe+"|"+b.kode_komponen}>{b.kode_komponen} — {b.nama_komponen}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={cancelEdit}>Batal</Btn>}
          </div>
        </div>
      </Card>

      {/* Filter + Search */}
      <div style={{display:invTab==="data"?"flex":"none",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center"}}>
        <select value={filterKode} onChange={e=>setFilterKode(e.target.value)}
          style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:150}}>
          {kodeList.map(k=><option key={k} value={k}>{k==="ALL"?"Semua Kode":k}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama komponen..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",flex:1,minWidth:180}}/>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} komponen</span>
      </div>

      {/* Tabel Komponen */}
      <div style={{display:invTab==="data"?"block":"none"}}>
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{...thS,width:36,textAlign:"center" as const}}>No</th>
              <th style={thS}>Kode</th>
              <th style={thS}>Nama Komponen</th>
              <th style={{...thS,textAlign:"center" as const,cursor:"pointer",userSelect:"none" as const}}
                onClick={toggleQtySort} title="Klik untuk urutkan">
                QTY Total{" "}
                <i className={`ti ti-${qtySort==="asc"?"arrow-up":qtySort==="desc"?"arrow-down":"arrows-sort"}`}
                  style={{fontSize:11,verticalAlign:"middle" as const,opacity:qtySort==="none"?.6:1}}/>
              </th>
              <th style={{...thS,textAlign:"center" as const}}>Tgl Masuk</th>
              <th style={{...thS,textAlign:"center" as const}}>Jml Masuk</th>
              <th style={{...thS,textAlign:"center" as const}}>Tgl Keluar</th>
              <th style={{...thS,textAlign:"center" as const}}>Jml Keluar</th>
              <th style={{...thS,textAlign:"center" as const}}>Progress</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>
                  Belum ada komponen
                </td></tr>
              ):sortedFiltered.map((s:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const isEdit=editId===s.id;
                const masukTerakhir=getMasukTerakhir(s.id);
                const keluarTerakhir=getKeluarTerakhir(s.id);
                const stokColor=s.stok===0?"#dc2626":s.stok<=5?"#f59e0b":"#16a34a";
                const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",
                  borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
                return(
                  <tr key={s.id}>
                    <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                    <td style={td}>
                      {s.kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                        borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{s.kode}</span>
                        :<span style={{color:"#cbd5e1",fontSize:10}}>—</span>}
                    </td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{s.nama}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:stokColor+"18",color:stokColor,border:`1px solid ${stokColor}33`,
                        borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>
                        {s.stok} pcs
                      </span>
                    </td>
                    <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>
                      {masukTerakhir?fmtDate(masukTerakhir.tanggal):"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,color:"#16a34a",fontWeight:700}}>
                      {masukTerakhir?"+"+masukTerakhir.jumlah:"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>
                      {keluarTerakhir?fmtDate(keluarTerakhir.tanggal):"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,color:"#dc2626",fontWeight:700}}>
                      {keluarTerakhir?"-"+keluarTerakhir.jumlah:"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        <button onClick={()=>{setShowMasuk(s);setMasukForm({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""}); }}
                          style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:5,
                            padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#16a34a",fontWeight:600}}>
                          +Masuk
                        </button>
                        <button onClick={()=>{setShowKeluar(s);setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""}); }}
                          style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,
                            padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#dc2626",fontWeight:600}}>
                          Keluar
                        </button>
                        <button onClick={()=>startEdit(s)}
                          style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5,
                            padding:"3px 6px",cursor:"pointer",fontSize:10,color:"#475569"}}>✏️</button>
                        <button onClick={()=>setDelId(s.id)}
                          style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,
                            padding:"3px 6px",cursor:"pointer",fontSize:10,color:"#dc2626"}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Riwayat Transaksi */}
      <div style={{background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden",display:invTab==="riwayat"?"block":"none"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>📋 Riwayat Transaksi</span>
          <select value={filterTipe} onChange={e=>setFilterTipe(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,
              fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
            <option value="ALL">Semua Tipe</option>
            <option value="masuk">Masuk</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>
        <div style={{overflowX:"auto" as const}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              {["Tanggal","Kode","Komponen","Tipe","Jumlah","Proyek","Panel","Keterangan","Oleh"].map(h=>(
                <th key={h} style={{...thS,fontSize:9.5}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {riwayat.length===0?(
                <tr><td colSpan={9} style={{textAlign:"center",padding:"24px",color:"#94a3b8"}}>Belum ada riwayat</td></tr>
              ):riwayat.slice(0,50).map((r:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const td2:any={padding:"7px 10px",borderBottom:"1px solid #f5f7fa",
                  borderRight:"1px solid #f5f7fa",background:rBg,verticalAlign:"middle"};
                const isMasuk=r.tipe==="masuk";
                return(
                  <tr key={i}>
                    <td style={{...td2,color:"#94a3b8"}}>{fmtDate(r.tanggal)}</td>
                    <td style={td2}>
                      {r.kode&&r.kode!=="-"?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                        borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>{r.kode}</span>
                        :<span style={{color:"#cbd5e1"}}>—</span>}
                    </td>
                    <td style={{...td2,fontWeight:600,color:"#1e293b"}}>{r.nama}</td>
                    <td style={td2}>
                      <span style={{background:isMasuk?"#f0fdf4":"#fef2f2",
                        color:isMasuk?"#16a34a":"#dc2626",
                        border:`1px solid ${isMasuk?"#bbf7d0":"#fecaca"}`,
                        borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:700}}>
                        {isMasuk?"Masuk":"Keluar"}
                      </span>
                    </td>
                    <td style={{...td2,textAlign:"center" as const,fontWeight:700,color:isMasuk?"#16a34a":"#dc2626"}}>
                      {isMasuk?"+":"-"}{r.jumlah}
                    </td>
                    <td style={{...td2,color:"#475569"}}>{r.proyek||"—"}</td>
                    <td style={{...td2,color:"#475569"}}>{r.panel||"—"}</td>
                    <td style={{...td2,color:"#94a3b8",maxWidth:160,overflow:"hidden" as const,textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{r.keterangan||"—"}</td>
                    <td style={{...td2,color:"#64748b"}}>{r.oleh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Masuk */}
      {showMasuk&&(
        <Modal title={"+ Stok Masuk: "+showMasuk.nama} onClose={()=>setShowMasuk(null)} width={400}>
          <div style={{marginBottom:8,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:12}}>
            Stok saat ini: <strong style={{color:"#1d4ed8"}}>{showMasuk.stok} pcs</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
            <div>
              <Lbl>Jumlah Masuk (pcs)</Lbl>
              <Inp type="number" min="1" value={masukForm.jumlah}
                onChange={(e:any)=>setMasukForm({...masukForm,jumlah:e.target.value})}/>
            </div>
            <div>
              <Lbl>Tanggal Masuk</Lbl>
              <Inp type="date" value={masukForm.tanggal}
                onChange={(e:any)=>setMasukForm({...masukForm,tanggal:e.target.value})}/>
            </div>
            <div>
              <Lbl>Keterangan</Lbl>
              <Inp value={masukForm.keterangan}
                onChange={(e:any)=>setMasukForm({...masukForm,keterangan:e.target.value})}
                placeholder="Contoh: Terima dari supplier..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowMasuk(null)}>Batal</Btn>
            <Btn color="#16a34a" onClick={tambahMasuk}>+ Simpan Masuk</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Keluar */}
      {showKeluar&&(
        <Modal title={"📤 Keluarkan: "+showKeluar.nama} onClose={()=>setShowKeluar(null)} width={420}>
          <div style={{marginBottom:8,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:12}}>
            Stok tersedia: <strong style={{color:"#1d4ed8"}}>{showKeluar.stok} pcs</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
            <div>
              <Lbl>Jumlah Keluar (pcs)</Lbl>
              <Inp type="number" min="1" max={showKeluar.stok} value={keluarForm.jumlah}
                onChange={(e:any)=>setKeluarForm({...keluarForm,jumlah:e.target.value})}/>
            </div>
            <div>
              <Lbl>Proyek *</Lbl>
              <Inp value={keluarForm.proyek} onChange={(e:any)=>setKeluarForm({...keluarForm,proyek:e.target.value})}
                placeholder="Nama proyek..."/>
            </div>
            <div>
              <Lbl>Panel</Lbl>
              <Inp value={keluarForm.panel} onChange={(e:any)=>setKeluarForm({...keluarForm,panel:e.target.value})}
                placeholder="Nama panel (opsional)..."/>
            </div>
            <div>
              <Lbl>Keterangan</Lbl>
              <Inp value={keluarForm.keterangan} onChange={(e:any)=>setKeluarForm({...keluarForm,keterangan:e.target.value})}
                placeholder="Keterangan tambahan..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowKeluar(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={keluarkan}>📤 Keluarkan</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Hapus */}
      {delId&&(
        <Modal title="Hapus Komponen?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Komponen <strong>{stokList.find(s=>s.id===delId)?.nama}</strong> dan semua riwayat masuknya akan dihapus permanen.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={hapus}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
