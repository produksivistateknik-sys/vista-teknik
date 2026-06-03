from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix td PROSES - tambah left:380
old1 = '<td style={{...td,position:"sticky",left:380,zIndex:2,textAlign:"center"}}>'
new1 = '<td style={{...td,position:"sticky",left:380,zIndex:2,textAlign:"center",background:"inherit"}}>'

# Fix td PRIORITAS - tidak ada sticky sama sekali, tambahkan
old2 = '<td style={{...td,position:"sticky",left:370,zIndex:2,textAlign:"center"}}>'
new2 = '<td style={{...td,position:"sticky",left:490,zIndex:2,textAlign:"center",background:"inherit"}}>'

# background pada th header agar tidak transparan saat scroll
old3 = 'position:"sticky",left:0,zIndex:5}}>PROYEK</th>'
new3 = 'position:"sticky",left:0,zIndex:5,background:"#1e2330"}}>PROYEK</th>'

old4 = 'position:"sticky",left:120,zIndex:5}}>PANEL</th>'
new4 = 'position:"sticky",left:120,zIndex:5,background:"#1e2330"}}>PANEL</th>'

old5 = 'position:"sticky",left:380,zIndex:5}}>PROSES</th>'
new5 = 'position:"sticky",left:380,zIndex:5,background:"#1e2330"}}>PROSES</th>'

old6 = 'position:"sticky",left:490,zIndex:5}}>PRIORITAS</th>'
new6 = 'position:"sticky",left:490,zIndex:5,background:"#1e2330"}}>PRIORITAS</th>'

# Fix td body background agar tidak transparan
old7 = 'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}'
new7 = 'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap",background:"inherit"}}'

old8 = 'position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260}}'
new8 = 'position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260,background:"inherit"}}'

replacements = [
    (old1, new1),
    (old2, new2),
    (old3, new3),
    (old4, new4),
    (old5, new5),
    (old6, new6),
    (old7, new7),
    (old8, new8),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ Fixed: {old[:60]}...")
    else:
        print(f"⚠️  Not found: {old[:60]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count} fix diterapkan.")
