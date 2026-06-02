with open('src/allcomps.txt', encoding='utf-8') as f:
    comps = f.read()

with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Inject before RecycleBinTab
insert_before = 'function RecycleBinTab({user}:any){'
if insert_before in c:
    idx = c.index(insert_before)
    c = c[:idx] + comps.strip() + '\n\n' + c[idx:]
    print('Injected before RecycleBinTab!')
else:
    print('ERROR: RecycleBinTab not found')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

# Verify
print('MaintenancePageTab:', 'function MaintenancePageTab' in c)
print('KerusakanTab:', 'function KerusakanTab' in c)
print('MaintenanceRutinTab:', 'function MaintenanceRutinTab' in c)
print('Lines:', c.count('\n'))
