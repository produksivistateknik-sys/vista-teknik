from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """          <div key={pi} style={{background:"#fff",border:"1px solid #eaecf0",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* Panel header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid #eaecf0",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"#fafbfc"}}>"""

new = """          <div key={pi} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* Panel header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid var(--border-color,#eaecf0)",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"var(--bg-secondary,#fafbfc)"}}>"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Panel card fixed!")
else:
    print("❌ Not found!")
