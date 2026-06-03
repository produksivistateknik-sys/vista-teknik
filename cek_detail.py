lines = open('src/App.tsx', encoding='utf-8').readlines()
for i, l in enumerate(lines[2700:2820], 2701):
    print(f'{i}: {l}', end='')
