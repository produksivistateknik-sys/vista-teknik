from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = '{tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar}/>}'
new = '{tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar} setRenhar={setRenhar} removeRenhar={removeRenhar} woData={woData}/>}'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Props updated!")
else:
    print("❌ Not found!")
