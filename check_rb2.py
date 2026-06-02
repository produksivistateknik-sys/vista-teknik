with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Find RecycleBinTab content
start = c.index('function RecycleBinTab')
end = c.index('function SystemTab(', start)
rb = c[start:end]

# Check queries
for line in rb.split('\n'):
    if 'supabase' in line or 'deleted_at' in line or 'cats=' in line:
        print(line.strip())
