lines = open('src/App.tsx', encoding='utf-8').readlines()
for i, l in enumerate(lines[2815:2840], 2816):
    print(f'{i}: {l}', end='')
