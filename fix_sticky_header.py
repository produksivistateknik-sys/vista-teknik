from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix thS - tambah top:0 agar header sticky vertikal juga
old_ths = 'const thS={background:"#1e2330",color:"#c8d0e8",padding:"3px 6px",fontWeight:600,fontSize:9,whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center" as "center",borderRight:"1px solid #2d3348",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};'

# Sudah ada top:0, berarti masalah di container
# Cek apakah div wrapper overflowX punya height constraint
old_wrap = '<div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>'
new_wrap = '<div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 320px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>'

if old_wrap in content:
    content = content.replace(old_wrap, new_wrap)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Container maxHeight added - header akan sticky vertikal!")
else:
    print("❌ Not found!")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[3110:3115], 3111):
        print(f"{i}: {l}")
