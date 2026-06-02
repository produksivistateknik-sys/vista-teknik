with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'style={{padding:"12px 16px",borderLeft:3px solid }}>',
    'style={{padding:"12px 16px",borderLeft:3px solid }}>',
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed!')
