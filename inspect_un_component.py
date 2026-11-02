with open('src/gbstudy.js', 'r', encoding='utf-8') as f:
    js = f.read()

pos = js.find('uN=({batches:t')
print("Position of uN:", pos)
print(js[pos:pos+2500])
