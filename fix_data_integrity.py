from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah helper getProgressFromHistory setelah getLatestProgress
old = """function calcPanelProgress(panel): Record<string, number> {"""

new = """// Ambil progress dari history (sumber paling akurat dari Vista Pekerja)
function getProgressFromHistory(cl:any, proses:string):number{
  const hist=cl?.history?.[proses];
  if(hist&&hist.length>0){
    // ambil entry terbaru berdasarkan tanggal + ts
    const sorted=[...hist].sort((a:any,b:any)=>{
      const tA=a.ts||a.tanggal||"";
      const tB=b.ts||b.tanggal||"";
      return tB.localeCompare(tA);
    });
    return sorted[0].pct||0;
  }
  return -1; // -1 berarti tidak ada data history
}

// Ambil progress terbaik: history > progressByDate > progress
function getBestProgress(cl:any, proses:string):number{
  // Coba dari history dulu (paling akurat)
  const fromHist=getProgressFromHistory(cl,proses);
  if(fromHist>=0) return fromHist;
  // Fallback ke progressByDate
  const fromDate=getLatestProgress(cl,proses);
  if(fromDate>0) return fromDate;
  // Fallback terakhir ke progress
  return cl?.progress?.[proses]||0;
}

function calcPanelProgress(panel): Record<string, number> {"""

if old in content:
    content = content.replace(old, new)
    print("✅ Helper functions added")
else:
    print("❌ Not found!")

# Update calcPanelProgress untuk pakai getBestProgress
old2 = "    const vals=active.map(it=>getLatestProgress(panel.checklist[it.kode],pr));"
new2 = "    const vals=active.map(it=>getBestProgress(panel.checklist[it.kode],pr));"

if old2 in content:
    content = content.replace(old2, new2)
    print("✅ calcPanelProgress updated to use getBestProgress")
else:
    print("❌ calcPanelProgress not found")

# Update ProsesPctCell tooltip - gunakan getBestProgress juga
old3 = "    const history=cl?.history?.[proses]||[];"
new3 = """    const history=cl?.history?.[proses]||[];
    const pctFinal=pct!==undefined&&pct!==null?pct:getBestProgress(cl,proses);"""

if old3 in content:
    content = content.replace(old3, new3)
    print("✅ ProsesPctCell updated")
else:
    print("⚠️  ProsesPctCell history line not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
