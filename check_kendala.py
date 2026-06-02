with open('src/hooks/useKendala.ts', encoding='utf-8') as f:
    c = f.read()
print('Current remove in useKendala:')
for i, line in enumerate(c.split('\n')):
    if 'remove' in line.lower() or 'delete' in line.lower():
        print(f'  {i+1}: {line}')
