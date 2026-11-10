from PIL import Image
import sys
# 立ち絵の下書きを描くスクリプト。使い方：リポジトリの一番上で python3 tools/draw_researcher.py
# 背景は index.html の NDART['advMage'] から取り、人物を消して使う。出力は drafts/researcher_*.png（100×40×4コマ）
import json,base64,io
_s=open('index.html',encoding='utf-8').read();_i=_s.index('const NDART=');_j=_s.index('};',_i)+1
_d=json.loads(_s[_i+len('const NDART='):_j])
src=Image.open(io.BytesIO(base64.b64decode(_d['advMage'][0].split(',')[1]))).convert('RGBA')
# 背景：キャラのいない列（左端）を4px周期でコピーして中央を埋める
def bg(f):
    im=src.crop((f*100,0,f*100+100,40)).copy()
    px=im.load()
    for x in range(28,74):
        sx=16+(x%8)
        for y in range(40):
            px[x,y]=px[sx,y]
    return im
P={'K':(26,18,16),'F':(245,207,160),'f':(214,166,118),'W':(232,236,226),'w':(170,178,170),
   'H':(120,72,40),'h':(84,48,26),'G':(226,176,64),'g':(150,104,34),'L':(140,240,170),'l':(60,170,100),'C':(200,240,250),
   'A':(150,96,52),'a':(104,64,34),'B':(60,110,80),'b':(36,72,52),'Y':(232,190,80),'P':(246,240,220),'p':(200,190,160),
   'R':(190,60,50),'r':(130,36,30),'U':(70,110,170),'u':(44,70,118),'S':(170,180,190),'s':(110,118,128),'E':(90,60,40),'e':(60,40,28),'M':(240,240,255),
   'V':(110,70,140),'v':(70,44,96),'T':(52,44,40)}
def put(im,grid,ox,oy):
    px=im.load()
    for y,row in enumerate(grid):
        for x,ch in enumerate(row):
            if ch=='.' : continue
            c=P[ch]
            for dx in (0,1):
                for dy in (0,1):
                    X,Y=(ox+x)*2+dx,(oy+y)*2+dy
                    if 0<=X<100 and 0<=Y<40: px[X,Y]=c+(255,)
# ---- A 錬金術師：ゴーグル・革のエプロン・光るフラスコ
alch=[
"....KKKKK......",
"...KHHHHHK.....",
"..KHHHHHHHK....",
"..KGCKGKCGK....",
"..KgGKKKGgK....",
"..KFFFFFFFK....",
"..KFKFFFKFK..K.",
"..KFFFFFFFK.KCK",
"...KFFfFFK..KCK",
"..KWWAAAWWK.KCK",
".KWKAAAAAKWKLLLK",
".KFKAAAAAKFLLLLK",
".KK.AAaAAKKLLLLK",
"...KAAaAAK.KKKK",
"...KAAAAAK.....",
"...KWKKKWK.....",
"...KeK.KeK.....",
]
# ---- B 学者：角帽・丸めがね・緑のローブ・本
scho=[
".KKKKKKKKK.....",
"KbbbbbbbbbK....",
".KKBBBBBKKYK...",
"..KHHHHHHK.Y...",
"..KHFFFFHHK....",
"..KFFFFSSSK....",
"..KFFFFSMSK....",
"..KFFFFSSSK....",
"...KFFfFYK.....",
"..KBBYYYYBK....",
".KBBBYBYBBBK...",
"KPPPPKBBBKFK...",
"KPpPpKBBBKKK...",
"KKKKKKBYBBK....",
"...KBBYBBBK....",
"...KBBBBBBK....",
"...KKK.KKKK....",
]
# ---- C 技師：赤い頭巾・ルーペ・青いつなぎ・設計図とレンチ
eng=[
"....KKKKK......",
"...KRRRRRK.....",
"..KRRRRRRRK....",
"..KrrrrrrrRK...",
"..KFFFFFFFKrK..",
"..KFKFFSSSK....",
"..KFFFFSMSK....",
"...KFFFSSK.....",
"...KFFfFFK..KSK",
"..KUUUUUUUK.KSK",
".KUKUGUGUKUKKSK",
".KFKUUUUUKFKSSK",
".KK.UUUUUKKK.K.",
"...KUUuUUK.....",
"...KUUuUUK.....",
"...KEKKKEK.....",
"...KeK.KeK.....",
]
def anim(name,grid,f):
    g=[list(r) for r in grid]
    W=max(len(r) for r in g)
    for r in g: r+=['.']*(W-len(r))
    if name=='alch':  # フラスコの泡
        bub=[(10,12),(11,13),(12,11),(13,12)][f]
        g[bub[1]][bub[0]+1]='C' if g[bub[1]][bub[0]+1]=='L' else g[bub[1]][bub[0]+1]
        if f%2: g[6][13]='.';g[5][13]='L'
    if name=='scho':  # 房がゆれる・本のページ
        g[3][11]='Y' if f%2==0 else '.'; g[3][10]='.' if f%2==0 else 'Y'
        if f in (1,2): g[11][2]='p';g[12][2]='P'
        if f==3: g[6][8]='S'
    if name=='eng':   # レンチがきらり
        if f==1: g[8][13]='M'
        if f==2: g[9][13]='M'
    return [''.join(r) for r in g]
out=[]
for name,grid in [('alch',alch),('scho',scho),('eng',eng)]:
    fr=[]
    for f in range(4):
        im=bg(f); bob=1 if f in (1,2) and name!='eng' else 0
        put(im,anim(name,grid,f),18,2)
        fr.append(im)
    strip=Image.new('RGBA',(400,40))
    for i,im in enumerate(fr): strip.paste(im,(i*100,0))
    strip.save('drafts/researcher_'+{'alch':'alchemist','scho':'scholar','eng':'engineer'}[name]+'.png'); out.append(strip)
