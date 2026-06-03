from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix pemanggilan di DetailProgress - ada 2 tempat
# 1. Di loop komponen per panel
old1 = """                          {prosesPanel.map(pr=>{
                const cl2=p.checklist?.[it.kode];
                return <ProsesPctCell key={pr} pct={pd[pr]} proses={pr} cl={cl2} nama={it.nama||it.komponen||it.name}/>;
              })}"""
# cek apakah sudah ada
if old1 in content:
    print("✅ Loop komponen sudah di-update")
else:
    # cari pattern yang ada
    old1b = "{prosesPanel.map(pr=><ProsesPctCell key={pr} pct={cl?.progress?.[pr]??cl?.qtyProses?.[pr]??0} proses={pr}/>)}"
    new1b = """{prosesPanel.map(pr=>{
                              const pctVal=cl?.progress?.[pr]??cl?.qtyProses?.[pr]??0;
                              return <ProsesPctCell key={pr} pct={pctVal} proses={pr} cl={cl} nama={it.nama||it.komponen||it.name}/>;
                            })}"""
    if old1b in content:
        content = content.replace(old1b, new1b)
        print("✅ Loop komponen updated (variant b)")
    else:
        print("⚠️  Loop komponen not found - cek baris 2560")

# 2. Fix di baris 2560 - prosesAda loop
old2 = "{prosesAda.map(pr=><ProsesPctCell key={pr} pct={pd[pr]} proses={pr}/>)}"
new2 = """{prosesAda.map(pr=>{
          const cl3=p.checklist?.[it?.kode];
          return <ProsesPctCell key={pr} pct={pd[pr]} proses={pr} cl={cl3}/>;
        })}"""
if old2 in content:
    content = content.replace(old2, new2)
    print("✅ prosesAda loop updated")
else:
    print("⚠️  prosesAda loop not found")

# Cari semua ProsesPctCell call yang masih tanpa cl
lines = content.splitlines()
for i, l in enumerate(lines):
    if 'ProsesPctCell' in l and 'pct={' in l and 'cl=' not in l:
        print(f"  Still missing cl at {i+1}: {l.strip()[:80]}")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
