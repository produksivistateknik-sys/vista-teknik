from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Ganti emoji di SIDEBAR_MENUS dengan Tabler Icons
# Format: <i className="ti ti-nama-icon" style={{fontSize:16}}/>

old_menus = """{group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"summary",label:"Summary Progress",icon:"📋"},
      {id:"detail",label:"Detail Progress",icon:"🔍"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"📅"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"📋"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"📝"}]:[]),
    ]},
    {group:"SYSTEM",items:[
      ...(["admin"].includes(user?.divisi)?[
        {id:"pekerja",label:"Master Pekerja",icon:"👥"},
        {id:"tracking",label:"Tracking Pekerja",icon:"📈"},
        {id:"activity",label:"Activity Log",icon:"📊"},
        {id:"kendala",label:"Kendala",icon:"📝",badge:kendalaLog.length>0?kendalaLog.length:null},
        {id:"maintenance",label:"Maintenance",icon:"🔧"},
        {id:"masteruser",label:"System",icon:"⚙️"},
      ]:[]),
    ]},
  ];"""

new_menus = """{group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"ti ti-layout-dashboard"},
      {id:"summary",label:"Summary Progress",icon:"ti ti-chart-bar"},
      {id:"detail",label:"Detail Progress",icon:"ti ti-zoom-in"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti ti-file-description"}]:[]),
    ]},
    {group:"SYSTEM",items:[
      ...(["admin"].includes(user?.divisi)?[
        {id:"pekerja",label:"Master Pekerja",icon:"ti ti-users"},
        {id:"tracking",label:"Tracking Pekerja",icon:"ti ti-chart-line"},
        {id:"activity",label:"Activity Log",icon:"ti ti-list-details"},
        {id:"kendala",label:"Kendala",icon:"ti ti-alert-triangle",badge:kendalaLog.length>0?kendalaLog.length:null},
        {id:"maintenance",label:"Maintenance",icon:"ti ti-tool"},
        {id:"masteruser",label:"System",icon:"ti ti-settings"},
      ]:[]),
    ]},
  ];"""

if old_menus in content:
    content = content.replace(old_menus, new_menus)
    print("✅ Menu icons replaced")
else:
    print("❌ Menu icons not found")

# Ganti render icon di nav item - dari emoji span ke <i> tag
old_icon_render = """<span style={{fontSize:14,flexShrink:0,width:18,textAlign:"center" as const}}>{item.icon}</span>"""
new_icon_render = """<i className={item.icon} style={{fontSize:16,flexShrink:0,width:20,textAlign:"center",lineHeight:1}}/>"""

if old_icon_render in content:
    content = content.replace(old_icon_render, new_icon_render)
    print("✅ Icon render replaced")
else:
    print("❌ Icon render not found")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[4760:4775], 4761):
        if 'icon' in l.lower():
            print(f"{i}: {l}")

# Fix sidebar collapsed - icon center dengan width 52px
old_col = '.erp-sb.col .erp-nav-item{padding:9px 0;margin:0;border-radius:0;justify-content:center;align-items:center;width:52px;gap:0;display:flex}'
new_col = '.erp-sb.col .erp-nav-item{padding:0;margin:0;height:38px;border-radius:0;justify-content:center;align-items:center;width:52px;gap:0;display:flex}'

if old_col in content:
    content = content.replace(old_col, new_col)
    print("✅ Collapsed nav item fixed")
else:
    print("⚠️  Collapsed nav not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
