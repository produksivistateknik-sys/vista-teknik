file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_swap_step4", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD_MARKER = '''              setCellModal(null);
            }}>Selesai</Btn>
          </div>
        </Modal>
      )}

      {assignModal&&(()=>{'''

count_marker = content.count(OLD_MARKER)
print(f"  MARKER occurrences: {count_marker}")

NEW_MARKER = '''              setCellModal(null);
            }}>Selesai</Btn>
          </div>
        </Modal>
      )}

      {swapModal&&(
        <Modal title={"Kapasitas Penuh \u2014 "+swapModal.tanggal} onClose={()=>{setSwapModal(null);setSwapSelected([]);}} width={540}>
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
            <span>\u26a0\ufe0f</span>
            <span>Kapasitas {swapModal.proses} tanggal {fmtDate(swapModal.tanggal)} sudah penuh ({Math.round(swapModal.terpakaiSaatIni)}/{Math.round(swapModal.kapasitasHari)} menit). Komponen baru butuh {Math.round(swapModal.menitDibutuhkan)} menit. Pilih komponen di bawah untuk dipindah ke hari berikutnya.</span>
          </div>

          <Lbl>Komponen Terjadwal di {fmtDate(swapModal.tanggal)} (pilih untuk dipindah)</Lbl>
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
                    <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} \u00b7 {o.panel_nama} \u00b7 progress {o.progress}% \u00b7 {Math.round(o.total_menit)} menit</div>
                  </div>
                  {hasProgress&&(
                    <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                  )}
                </label>
              );
            })}
          </div>

          {(()=>{
            const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.fcs_id)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);
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
            }}
              style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapLoading||swapSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapLoading||swapSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {swapLoading?"\u23f3 Memindahkan...":"Pindahkan & Tambah Komponen"}
            </button>
          </div>
        </Modal>
      )}

      {assignModal&&(()=>{'''

if count_marker==1:
    content = content.replace(OLD_MARKER, NEW_MARKER, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Modal swap berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] MARKER occurrences = {count_marker}, bukan 1. TIDAK menyimpan apapun")
