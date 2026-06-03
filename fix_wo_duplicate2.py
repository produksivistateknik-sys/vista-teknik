from pathlib import Path

HOOK_PATH = Path(r"C:\Users\User\vista-teknik\src\hooks\useWorkOrders.ts")
content = HOOK_PATH.read_text(encoding="utf-8")

# Fix 1: Disable realtime INSERT handler (biarkan App.tsx handle via setWoData)
old1 = "schema: 'public', table: 'work_orders' },\n        (payload) => { setData(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]) }\n      )"
new1 = "schema: 'public', table: 'work_orders' },\n        () => { /* INSERT handled by App.tsx setWoData to include panels */ }\n      )"

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Fix 1: Realtime INSERT disabled")
else:
    print("❌ Fix 1: not found")

# Fix 2: Remove setData dari create function
old2 = "      const result = await workOrderService.create({ ...payload, updated_by: uname }, uname)     \n      setData(prev => prev.some(r => r.id === result.id) ? prev : [...prev, result])\n      return { success: true, data: result }"
new2 = "      const result = await workOrderService.create({ ...payload, updated_by: uname }, uname)\n      // setData tidak dipanggil di sini - App.tsx handle via setWoData dengan panels\n      return { success: true, data: result }"

if old2 in content:
    content = content.replace(old2, new2)
    print("✅ Fix 2: setData removed from create")
else:
    # coba tanpa trailing spaces
    old2b = "      const result = await workOrderService.create({ ...payload, updated_by: uname }, uname)\n      setData(prev => prev.some(r => r.id === result.id) ? prev : [...prev, result])\n      return { success: true, data: result }"
    if old2b in content:
        content = content.replace(old2b, new2)
        print("✅ Fix 2: setData removed (variant b)")
    else:
        print("⚠️  Fix 2: not found, cek manual")
        # debug
        idx = content.find("workOrderService.create")
        if idx != -1:
            print(repr(content[idx:idx+200]))

HOOK_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
