from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # TH PROSES - left 380 -> 230
    (
        '<th style={{...thS,minWidth:110,position:"sticky",left:380,zIndex:5}}>PROSES</th>',
        '<th style={{...thS,minWidth:110,position:"sticky",left:230,zIndex:5,background:"#1e2330"}}>PROSES</th>'
    ),
    # TH PRIORITAS - left 490 -> 340
    (
        '<th style={{...thS,minWidth:90,position:"sticky",left:490,zIndex:5}}>PRIORITAS</th>',
        '<th style={{...thS,minWidth:90,position:"sticky",left:340,zIndex:5,background:"#1e2330"}}>PRIORITAS</th>'
    ),
    # TD PROYEK - left:0, tambah background + width constraint
    (
        '<td style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>{row.proyek}</td>',
        '<td style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",background:rBg,minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.proyek}</td>'
    ),
    # TD PANEL - left:120 -> 80, minWidth:260 -> 150, wrap
    (
        '<td style={{...td,position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260}}>{row.panel}</td>',
        '<td style={{...td,position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",background:rBg,minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.4}}>{row.panel}</td>'
    ),
    # TD PROSES - left:380 -> 230 + background
    (
        '<td style={{...td,position:"sticky",left:380,zIndex:2,textAlign:"center"}}>',
        '<td style={{...td,position:"sticky",left:230,zIndex:2,textAlign:"center",background:rBg}}>'
    ),
    # TD PRIORITAS - left:370 -> 340 + background
    (
        '<td style={{...td,position:"sticky",left:370,zIndex:2,textAlign:"center"}}>',
        '<td style={{...td,position:"sticky",left:340,zIndex:2,textAlign:"center",background:rBg}}>'
    ),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ Fixed: {old[:65]}...")
    else:
        print(f"⚠️  Not found: {old[:65]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count}/{len(fixes)} fix diterapkan.")
