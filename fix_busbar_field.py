from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Ganti semua busbarSchedule dengan busbar_schedule agar sesuai nama kolom Supabase
count = content.count('busbarSchedule')
print(f"Found {count} occurrences of busbarSchedule")

content = content.replace('busbarSchedule', 'busbar_schedule')

APP_PATH.write_text(content, encoding="utf-8")
print("✅ All busbarSchedule replaced with busbar_schedule!")
