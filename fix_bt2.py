with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Fix semua template literal yang rusak di RecycleBinTab
fixes = [
    ('border:1.5px solid ,background:filterCat==="ALL"?"#1d4ed8":"#fff",color:filterCat==="ALL"?"#fff":"#64748b"',
     'border:1.5px solid ,background:filterCat==="ALL"?"#1d4ed8":"#fff",color:filterCat==="ALL"?"#fff":"#64748b"'),
    ('border:1.5px solid ,background:filterCat===k?"#1d4ed8":"#fff",color:filterCat===k?"#fff":"#64748b"',
     'border:1.5px solid ,background:filterCat===k?"#1d4ed8":"#fff",color:filterCat===k?"#fff":"#64748b"'),
    ('background:sc+"18",color:sc,border:"1px solid "+sc+"33"',
     'background:sc+"18",color:sc,border:"1px solid "+sc+"33"'),
]

for old, new in fixes:
    if old in c:
        c = c.replace(old, new)
        print('Fixed:', old[:40])

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done!')
