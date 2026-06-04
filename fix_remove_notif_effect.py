from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus click outside useEffect
old = """  // Tutup notif saat klik di luar
  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      const target=e.target as HTMLElement;
      if(!target.closest('.erp-bell')&&!target.closest('[data-notif-panel]')){
        setShowNotif(false);
      }
    };
    if(showNotif) document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[showNotif]);

  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""

new = """  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Click outside handler removed!")
else:
    print("❌ Not found!")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[5120:5140], 5121):
        print(f"{i}: {l}")
