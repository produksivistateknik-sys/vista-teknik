from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # ── TH headers ──
    # PROYEK header
    (
        '<th style={{...thS,textAlign:"left",minWidth:120,position:"sticky",left:0,zIndex:5}}>PROYEK</th>',
        '<th style={{...thS,textAlign:"left",minWidth:80,position:"sticky",left:0,zIndex:5,background:"#1e2330"}}>PROYEK</th>'
    ),
    # PANEL header
    (
        '<th style={{...thS,textAlign:"left",minWidth:260,position:"sticky",left:120,zIndex:5}}>PANEL</th>',
        '<th style={{...thS,textAlign:"left",minWidth:150,position:"sticky",left:80,zIndex:5,background:"#1e2330"}}>PANEL</th>'
    ),
    # PROSES header
    (
        '<th style={{...thS,minWidth:110,position:"sticky",left:380,zIndex:5,background:"#1e2330"}}>PROSES</th>',
        '<th style={{...thS,minWidth:110,position:"sticky",left:230,zIndex:5,background:"#1e2330"}}>PROSES</th>'
    ),
    # PRIORITAS header
    (
        '<th style={{...thS,minWidth:90,position:"sticky",left:490,zIndex:5,background:"#1e2330"}}>PRIORITAS</th>',
        '<th style={{...thS,minWidth:90,position:"sticky",left:340,zIndex:5,background:"#1e2330"}}>PRIORITAS</th>'
    ),

    # ── TD body ──
    # PROYEK td
    (
        '<td style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap",background:rBg}}>{row.proyek}</td>',
        '<td style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",background:rBg,minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.proyek}</td>'
    ),
    # PANEL td
    (
        '<td style={{...td,position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260,background:rBg}}>{row.panel}</td>',
        '<td style={{...td,position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",background:rBg,minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.4}}>{row.panel}</td>'
    ),
    # PROSES td
    (
        '<td style={{...td,position:"sticky",left:380,zIndex:2,textAlign:"center",background:rBg}}>',
        '<td style={{...td,position:"sticky",left:230,zIndex:2,textAlign:"center",background:rBg}}>'
    ),
    # PRIORITAS td
    (
        'position:"sticky",left:490,zIndex:2,textAlign:"center",background:rBg',
        'position:"sticky",left:340,zIndex:2,textAlign:"center",background:rBg'
    ),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ Fixed: {old[:60]}...")
    else:
        print(f"⚠️  Not found: {old[:60]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count}/{len(fixes)} fix diterapkan.")
