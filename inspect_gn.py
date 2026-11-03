with open('src/gbstudy.js', 'r', encoding='utf-8') as f:
    js = f.read()

pos = js.find('gN=({currentTab:t')
if pos != -1:
    print("Found gN at", pos)
    print(js[pos:pos+1800])
else:
    print("Not found gN")
