with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

rb_start = c.index('function RecycleBinTab')
rb_end = c.index('function SystemTab(', rb_start)
rb = c[rb_start:rb_end]

for line in rb.split('\n'):
    if 'raw_schedule' in line or 'cats=' in line:
        print(line.strip())
