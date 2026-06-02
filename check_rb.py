with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Update CATS di RecycleBinTab - sudah ada semua
# Update query di RecycleBinTab untuk include renhar dan kendala
old = "      const cats=[\"work_orders\",\"mesin\",\"pekerja\",\"raw_schedule\",\"renhar\",\"kendala\"];"
new = "      const cats=[\"work_orders\",\"mesin\",\"pekerja\",\"raw_schedule\",\"renhar\",\"kendala\"];"

# Sudah benar, tidak perlu ganti. Cek apakah CATS sudah lengkap
print('CATS check:', 'renhar' in c and 'kendala' in c)
print('RecycleBin cats line:', [l.strip() for l in c.split('\n') if 'const cats=' in l and 'RecycleBin' not in l][:2])
