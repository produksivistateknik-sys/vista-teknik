with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Cari semua RecycleBinTab
count = c.count('function RecycleBinTab')
print('RecycleBinTab count:', count)

if count > 1:
    # Hapus yang kedua (versi lama)
    first = c.index('function RecycleBinTab')
    second = c.index('function RecycleBinTab', first + 1)
    # Cari end of second RecycleBinTab
    next_func = c.index('\nfunction ', second + 1)
    c = c[:second] + c[next_func+1:]
    print('Removed duplicate!')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done! Lines:', c.count('\n'))
print('RecycleBinTab count after:', c.count('function RecycleBinTab'))
