lines = open('src/App.tsx', encoding='utf-8').readlines()
for i, l in enumerate(lines):
    if 'Master Pekerja' in l or 'masterpekerja' in l.lower() or ('"pekerja"' in l and ('sidebar' in l.lower() or 'nav' in l.lower() or 'tab' in l.lower() or 'subTab' in l)):
        print(f'{i+1}: {l.strip()}')
