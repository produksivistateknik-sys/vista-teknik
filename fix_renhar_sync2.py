from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix removeEntry untuk juga hapus dari Supabase renhar
old_remove = """  const syncRenharDel=(rawId,date,wp)=>{
    setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
  };"""

new_remove = """  const syncRenharDel=async(rawId,date,wp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
    // Hapus dari Supabase
    if(existing){
      await removeRenhar(existing.id);
    }
  };"""

if old_remove in content:
    content = content.replace(old_remove, new_remove)
    print("✅ syncRenharDel updated!")
else:
    print("❌ Not found!")

APP_PATH.write_text(content, encoding="utf-8")
