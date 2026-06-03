from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus tombol Hapus pertama (hanya local state), sisakan yang kedua (dengan supabase)
old = '<Btn color="#dc2626" onClick={()=>{setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn><Btn color="#dc2626" onClick={async()=>{const sess=JSON.parse(localStorage.getItem(\'vista_admin_session\')||\'{}});const uname=sess?.nama||sess?.name||\'Admin\';await supabase.from(\'work_orders\').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq(\'id\',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>'

# Cari dan hapus tombol pertama saja
old_first = '<Btn color="#dc2626" onClick={()=>{setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>'
new_first = ''

if old_first in content:
    content = content.replace(old_first, new_first, 1)  # hanya replace 1x kemunculan pertama
    APP_PATH.write_text(content, encoding="utf-8")
    print("Done! Tombol Hapus dobel dihapus.")
else:
    print("Not found! Coba cek manual.")
