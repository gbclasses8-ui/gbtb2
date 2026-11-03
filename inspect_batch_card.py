with open('src/gbstudy.js', 'r', encoding='utf-8') as f:
    js = f.read()

pos = 249837
print(js[pos-2500:pos])
