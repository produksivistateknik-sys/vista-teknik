from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix: di SummaryProgress, 'it' tidak ada - hapus cl3, pakai tanpa cl
old = """{prosesAda.map(pr=>{
          const cl3=p.checklist?.[it?.kode];
          return <ProsesPctCell key={pr} pct={pd[pr]} proses={pr} cl={cl3}/>;
        })}"""
new = "{prosesAda.map(pr=><ProsesPctCell key={pr} pct={pd[pr]} proses={pr}/>)}"

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Fixed! SummaryProgress restored.")
else:
    print("❌ Not found!")
