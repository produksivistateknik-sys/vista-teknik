file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_swap_step3", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Marker: persis baris pertama addEntry + baris kedua (let finalKomp) sebagai konteks unik
OLD_MARKER = '''    if(!modalWp||!modalKomponen.length)return;
    let finalKomp=modalKomponen;
    let updatedRow=null;
    let oldKomp:string[]=[];
    let isEdit=false;'''

count_marker = content.count(OLD_MARKER)
print(f"  MARKER occurrences: {count_marker}")

NEW_MARKER = '''    if(!modalWp||!modalKomponen.length)return;

    // Validasi kapasitas sebelum tambah (hanya jika data FCS process time tersedia)
    const tipePanelCek=livePanelForCell?.tipe;
    const prosesCek=rawRow?.proses;
    if(tipePanelCek&&prosesCek&&prosesCek!=="BUSBAR"){
      let menitDibutuhkan=0;
      let adaDataProcessTime=false;
      for(const kode of modalKomponen){
        const qty=livePanelForCell?.checklist?.[kode]?.qty||0;
        const menitPcs=getMenitPerPcs(tipePanelCek,prosesCek,kode);
        if(menitPcs>0)adaDataProcessTime=true;
        menitDibutuhkan+=qty*menitPcs;
      }
      if(adaDataProcessTime&&menitDibutuhkan>0){
        const panelChecklistMap:Record<number,any>={};
        woData.flatMap((w:any)=>w.panels||[]).forEach((p:any)=>{panelChecklistMap[p.id]=p.checklist||{};});
        const cek=await checkKapasitasDanKomponenSwap({
          tanggal:cellModal.date,
          jenisPekerjaan:prosesCek,
          menitDibutuhkan,
          panelChecklistMap,
        });
        if(!cek.cukup){
          if(cek.opsiSwap.length>0){
            setSwapModal({tanggal:cellModal.date,proses:prosesCek,menitDibutuhkan,...cek});
            setSwapSelected([]);
            return;
          } else {
            alert("Kapasitas "+prosesCek+" tanggal ini sudah penuh dan tidak ada komponen lain yang bisa dipindah.\\n"+(cek.error||""));
            return;
          }
        }
      }
    }

    let finalKomp=modalKomponen;
    let updatedRow=null;
    let oldKomp:string[]=[];
    let isEdit=false;'''

if count_marker==1:
    content = content.replace(OLD_MARKER, NEW_MARKER, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Validasi kapasitas berhasil disisipkan di awal addEntry, logic asli setelahnya TIDAK disentuh")
    print("[INFO] Jalankan: npm run build (akan ada error karena swapModal UI belum dibuat - lanjut step 4)")
else:
    print(f"[FAIL] MARKER occurrences = {count_marker}, bukan 1. TIDAK menyimpan apapun")
