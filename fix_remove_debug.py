from pathlib import Path

SVC_PATH = Path(r"C:\Users\User\vista-teknik\src\services\rawScheduleService.ts")
content = SVC_PATH.read_text(encoding="utf-8")

old = "    console.log('Creating raw_schedule with payload:', safe)\n    const { data, error } = await supabase.from('raw_schedule').insert(safe).select().single()\n    if (error) { console.error('Raw schedule error:', error); throw new Error(error.message) }"
new = "    const { data, error } = await supabase.from('raw_schedule').insert(safe).select().single()\n    if (error) throw new Error(error.message)"

if old in content:
    content = content.replace(old, new)
    SVC_PATH.write_text(content, encoding="utf-8")
    print("✅ Debug removed!")
else:
    print("❌ Not found!")
