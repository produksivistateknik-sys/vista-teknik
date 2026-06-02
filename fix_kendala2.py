with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    '{tab==="kendala"&&<KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala}/>}',
    '{tab==="kendala"&&<KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala} user={user}/>}'
)

c = c.replace(
    'function KendalaInbox({kendalaLog,removeKendala})',
    'function KendalaInbox({kendalaLog,removeKendala,user}:any)'
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done!')
