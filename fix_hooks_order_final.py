from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Pindahkan useState user/tab/sidebarCollapsed/showNotif ke SEBELUM useEffect restore session
old = """  const [page,setPage]=useState("landing");
  // Restore admin session
  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");
    if(saved){
      try{
        const parsed=JSON.parse(saved);
        setUser({...parsed,name:parsed.name||parsed.nama});
        setPage("app");
        setTab("dashboard");
      }catch{}
    }
  },[]);
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [showNotif,setShowNotif]=useState(false);"""

new = """  const [page,setPage]=useState("landing");
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [showNotif,setShowNotif]=useState(false);
  // Restore admin session
  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");
    if(saved){
      try{
        const parsed=JSON.parse(saved);
        setUser({...parsed,name:parsed.name||parsed.nama});
        setPage("app");
        setTab("dashboard");
      }catch{}
    }
  },[]);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Hooks order fixed!")
else:
    print("❌ Pattern not found!")
