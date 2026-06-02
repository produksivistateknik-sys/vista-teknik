import re

with open('src/App.tsx', encoding='utf-8') as f:
    content = f.read()

# Fix 1: SystemTab subTabs
content = content.replace(
    '{id:"maintenance",label:"🔧 Maintenance"},',
    '{id:"pekerja",label:"👥 Master Pekerja"},\n    {id:"recycle",label:"🗑 Recycle Bin"},'
)

# Fix 2: SystemTab render - hapus maintenance tab
content = content.replace(
    '{subTab==="maintenance"&&<MaintenanceTab mesinList={mesinList} maintenanceList={maintenanceList} setMaintenanceList={setMaintenanceList} user={user}/>}',
    '{subTab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} user={user}/>}\n          {subTab==="recycle"&&<RecycleBinTab user={user}/>}'
)

# Fix 3: tab render
content = content.replace(
    '{tab==="maintenance"&&<MaintenanceTab user={user} logActivity={logActivity}/>}',
    '{tab==="maintenance"&&<MaintenancePageTab user={user}/>}'
)
content = content.replace(
    '{tab==="masteruser"&&<SystemTab user={user} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja}/>}',
    '{tab==="masteruser"&&<SystemTab user={user} activityLog={activityLog} pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja}/>}'
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Lines:", content.count('\n'))
