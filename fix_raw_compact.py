from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # Table font size 11 -> 9
    (
        '<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>',
        '<table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>'
    ),
    # td padding 4px 6px -> 2px 4px (lebih compact)
    (
        'const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"4px 6px",verticalAlign:"middle",borderTop:panelTopBorder};',
        'const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"2px 4px",verticalAlign:"middle",borderTop:panelTopBorder};'
    ),
    # td PROYEK fontSize 11 -> 9
    (
        'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",background:rBg,minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"',
        'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:9,color:"#475569",background:rBg,minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"'
    ),
    # td PANEL fontSize 11 -> 9
    (
        'position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",background:rBg,minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.4',
        'position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:9,color:"#1e293b",background:rBg,minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.3'
    ),
    # span PROSES font 10 -> 9
    (
        'background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:6,padding:"2px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap"',
        'background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap"'
    ),
    # select PRIORITAS font 10 -> 9
    (
        'padding:"2px 6px",borderRadius:6,border:`1.5px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:10,fontWeight:700,cursor:"pointer"',
        'padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"'
    ),
    # thS padding
    (
        'const thS={background:"#1e2330",color:"#c8d0e8",padding:"5px 8px",fontWeight:600,fontSize:9,whiteSpace:"nowrap",letterSpacing:.4,textAlign:"center" as "center",borderRight:"1px solid #2d3348",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};',
        'const thS={background:"#1e2330",color:"#c8d0e8",padding:"3px 6px",fontWeight:600,fontSize:9,whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center" as "center",borderRight:"1px solid #2d3348",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};'
    ),
    # WP badge di cell tanggal - font & padding
    (
        'color:"#fff",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",gap:3',
        'color:"#fff",borderRadius:3,padding:"1px 4px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",gap:2'
    ),
    # Cell tanggal padding
    (
        '{...td,textAlign:"center",padding:"4px",background:isOver?"#eff6ff":isSelDate&&entries.length?"#f0f9ff":rBg',
        '{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":isSelDate&&entries.length?"#f0f9ff":rBg'
    ),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ {old[:60]}...")
    else:
        print(f"⚠️  Not found: {old[:60]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count}/{len(fixes)} fix diterapkan.")
