from pathlib import Path

HOOK_PATH = Path(r"C:\Users\User\vista-teknik\src\hooks\useWorkOrders.ts")
content = HOOK_PATH.read_text(encoding="utf-8")

old = """      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'work_orders' },
        (payload) => { setData(prev => prev.filter(r => r.id !== payload.old.id)) }
      )
      .subscribe()"""

new = """      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'work_orders' },
        (payload) => { setData(prev => prev.filter(r => r.id !== payload.old.id)) }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'panels' },
        (payload) => {
          setData(prev => prev.map(wo => ({
            ...wo,
            panels: (wo.panels || []).map((p: any) =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
          })))
        }
      )
      .subscribe()"""

if old in content:
    content = content.replace(old, new)
    HOOK_PATH.write_text(content, encoding="utf-8")
    print("✅ Panels realtime UPDATE listener added!")
else:
    print("❌ Not found!")
