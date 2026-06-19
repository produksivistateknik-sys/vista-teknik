file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_switch_swap_v2_full", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Update import
OLD_IMPORT = "import { generateFCSSchedule, syncFCSToRawSchedule, checkKapasitasDanKomponenSwap, executeSwapKomponen } from './services/fcsService'"
NEW_IMPORT = "import { generateFCSSchedule, syncFCSToRawSchedule, checkKapasitasDanKomponenSwapV2, executeSwapKomponenV2 } from './services/fcsService'"
results['IMPORT'] = OLD_IMPORT in content

# Fix 2: Update pemanggilan check di addEntry
OLD_CHECK = '''        const panelChecklistMap:Record<number,any>={};
        woData.flatMap((w:any)=>w.panels||[]).forEach((p:any)=>{panelChecklistMap[p.id]=p.checklist||{};});
        const cek=await checkKapasitasDanKomponenSwap({
          tanggal:cellModal.date,
          jenisPekerjaan:prosesCek,
          menitDibutuhkan,
          panelChecklistMap,
        });'''
NEW_CHECK = '''        const cek=await checkKapasitasDanKomponenSwapV2({
          tanggal:cellModal.date,
          jenisPekerjaan:prosesCek,
          menitDibutuhkan,
          excludeRawId:cellModal.rawId,
        });'''
results['CHECK_CALL'] = OLD_CHECK in content

# Fix 3: Update state swapSelected jadi string[] (composite key)
OLD_STATE = "  const [swapSelected,setSwapSelected]=useState<number[]>([]);"
NEW_STATE = "  const [swapSelected,setSwapSelected]=useState<string[]>([]);"
results['STATE'] = OLD_STATE in content

# Fix 4: Render modal swap - update checkbox key dan logic
OLD_RENDER_LIST = '''          <Lbl>Komponen Terjadwal di {fmtDate(swapModal.tanggal)} (pilih untuk dipindah)</Lbl>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14,maxHeight:280,overflowY:"auto" as const}}>
            {swapModal.opsiSwap.map((o:any)=>{
              const checked=swapSelected.includes(o.fcs_id);
              const hasProgress=o.progress>0;
              return(
                <label key={o.fcs_id} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                  <input type="checkbox" checked={checked} style={{marginTop:2}}
                    onChange={()=>setSwapSelected(prev=>checked?prev.filter(id=>id!==o.fcs_id):[...prev,o.fcs_id])}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#1e293b"}}>{o.nama_komponen}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} \u00b7 {o.panel_nama} \u00b7 {o.qty_hari} pcs \u00b7 progress {o.progress}% \u00b7 {Math.round(o.total_menit)} menit</div>
                  </div>
                  {hasProgress&&(
                    <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                  )}
                </label>
              );
            })}
          </div>'''

NEW_RENDER_LIST = '''          <Lbl>Komponen Terjadwal di {fmtDate(swapModal.tanggal)} (pilih untuk dipindah)</Lbl>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14,maxHeight:280,overflowY:"auto" as const}}>
            {swapModal.opsiSwap.map((o:any)=>{
              const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
              const checked=swapSelected.includes(swapKey);
              const hasProgress=o.progress>0;
              return(
                <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                  <input type="checkbox" checked={checked} style={{marginTop:2}}
                    onChange={()=>setSwapSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#1e293b"}}>{o.nama_komponen}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} \u00b7 {o.panel_nama} \u00b7 {o.qty} pcs \u00b7 progress {o.progress}% \u00b7 {Math.round(o.total_menit)} menit</div>
                  </div>
                  {hasProgress&&(
                    <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                  )}
                </label>
              );
            })}
          </div>'''

results['RENDER_LIST'] = OLD_RENDER_LIST in content

# Fix 5: Live preview kapasitas - update logic filter pakai swapKey
OLD_PREVIEW = '''          {(()=>{
            const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.fcs_id)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);'''
NEW_PREVIEW = '''          {(()=>{
            const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);'''
results['PREVIEW'] = OLD_PREVIEW in content

# Fix 6: Update tombol konfirmasi - eksekusi swap v2
OLD_EXEC = '''            <button disabled={swapLoading||swapSelected.length===0} onClick={async()=>{
              const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.fcs_id)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);
              const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
              if(sisaSetelahSwap<swapModal.menitDibutuhkan){alert("Kapasitas masih belum cukup, pilih komponen tambahan");return;}
              setSwapLoading(true);
              const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
              const uname=user?.name||user?.nama||sess?.nama||"Admin";
              const res=await executeSwapKomponen({
                fcsIdsToMove:swapSelected,
                jenisPekerjaan:swapModal.proses,
                tanggalAsal:swapModal.tanggal,
                generatedBy:uname,
              });
              setSwapLoading(false);
              if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
              const woNumbersAffected=[...new Set(swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.fcs_id)).map((o:any)=>o.wo_number))];
              for(const wn of woNumbersAffected){
                await syncFCSToRawSchedule(wn,swapModal.proses,uname);
              }
              await activityLogService.insert({
                user_name:uname,action:"SWAP KOMPONEN KAPASITAS",
                description:"Pindahkan "+swapSelected.length+" komponen dari "+fmtDate(swapModal.tanggal)+" ("+swapModal.proses+") ke hari berikutnya untuk beri ruang komponen baru",
                module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
              });
              setSwapModal(null);setSwapSelected([]);
              await addEntry();
            }}'''

NEW_EXEC = '''            <button disabled={swapLoading||swapSelected.length===0} onClick={async()=>{
              const itemsToMove=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,total_menit:o.total_menit}));
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
            }}'''

results['EXEC_BUTTON'] = OLD_EXEC in content

for k, v in results.items():
    print(f"  {k}: {'FOUND' if v else 'MISSING'}")

if all(results.values()):
    content = content.replace(OLD_IMPORT, NEW_IMPORT)
    content = content.replace(OLD_CHECK, NEW_CHECK)
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_RENDER_LIST, NEW_RENDER_LIST)
    content = content.replace(OLD_PREVIEW, NEW_PREVIEW)
    content = content.replace(OLD_EXEC, NEW_EXEC)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Semua bagian berhasil diupdate ke v2 (composite key raw_id+wp+kode_komponen)")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada pattern yang MISSING, TIDAK menyimpan apapun. Perlu cek manual.")
