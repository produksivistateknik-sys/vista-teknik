file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_stok_nav", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD_NAV = """    {group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"ti ti-layout-dashboard"},
      {id:"summary",label:"Summary Progress",icon:"ti ti-chart-bar"},
      {id:"detail",label:"Detail Progress",icon:"ti ti-zoom-in"},"""

NEW_NAV = """    {group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"ti ti-layout-dashboard"},
      {id:"summary",label:"Summary Progress",icon:"ti ti-chart-bar"},
      {id:"detail",label:"Detail Progress",icon:"ti ti-zoom-in"},
      {id:"stok",label:"Stok Komponen",icon:"ti ti-package"},"""

OLD_RENDER = """              {tab==="dashboard"&&<Dashboard woData={woData}/>}"""

NEW_RENDER = """              {tab==="dashboard"&&<Dashboard woData={woData}/>}
              {tab==="stok"&&<KomponenStokTab user={user} activityLog={activityLog}/>}"""

ok1 = OLD_NAV in content
ok2 = OLD_RENDER in content

print(f"  NAV:    {'FOUND' if ok1 else 'MISSING'}")
print(f"  RENDER: {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_NAV, NEW_NAV)
    content = content.replace(OLD_RENDER, NEW_RENDER)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Tab Stok Komponen berhasil ditambah di sidebar Monitoring")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    if not ok1:
        for i, line in enumerate(lines):
            if "MONITORING" in line and "items" in line:
                for j in range(i, min(i+6, len(lines))):
                    print(repr(lines[j]))
                break
    if not ok2:
        for i, line in enumerate(lines):
            if 'tab==="dashboard"' in line:
                print(repr(lines[i]))
                break
