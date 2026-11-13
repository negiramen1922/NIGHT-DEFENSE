# 宣伝用の静止画（16:9・正方形・縦長・特徴カード）
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/'
FONT=P+'fonts/DotGothic16.ttf'
OUT=P+'out/';import os;os.makedirs(OUT,exist_ok=True)
AMBER=(242,179,61);WHITE=(240,240,232);DARK=(10,8,6);RED=(255,110,90);GREEN=(130,230,150)
LOGO=Image.open(P+'logo.png').convert('RGBA')
def f(sz):return ImageFont.truetype(FONT,sz)
def T(d,xy,s,sz,fill=WHITE,anchor='mm',st=None):d.text(xy,s,font=f(sz),fill=fill,anchor=anchor,stroke_width=st if st is not None else max(3,sz//14),stroke_fill=DARK)
def logo(w):h=int(LOGO.height*w/LOGO.width);return LOGO.resize((w,h),Image.NEAREST)
def crop_to(im,w,h,cx=0.5,cy=0.5,zoom=1.0):
    r=max(w/im.width,h/im.height)*zoom;im=im.resize((int(im.width*r),int(im.height*r)),Image.LANCZOS)
    x=int((im.width-w)*cx);y=int((im.height-h)*cy);return im.crop((x,y,x+w,y+h))
def grad(w,h,top,bot):
    g=Image.new('RGBA',(w,h));d=ImageDraw.Draw(g)
    for y in range(h):t=y/(h-1);d.line([(0,y),(w,y)],fill=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(4)))
    return g
day=Image.open(P+'shots/day_close.png').convert('RGB')
dayw=Image.open(P+'shots/day_town.png').convert('RGB')
horde=Image.open(P+'shots/night_horde.png').convert('RGB')
clash=Image.open(P+'shots/clash_close.png').convert('RGB')
wide=Image.open(P+'shots/battle_wide.png').convert('RGB')
east=Image.open(P+'shots/east_wall.png').convert('RGB')

# ===== 1) 16:9 メイン
W,H=1920,1080
im=crop_to(clash,W,H,0.5,0.5).convert('RGBA')
im.alpha_composite(grad(W,H,(0,0,0,170),(0,0,0,0)).crop((0,0,W,H//2)),(0,0))
im.alpha_composite(grad(W,420,(0,0,0,0),(0,0,0,220)),(0,H-420))
lg=logo(760);im.alpha_composite(lg,(70,50))
d=ImageDraw.Draw(im)
T(d,(80,H-215),'昼に築き、夜に凌げ。',104,AMBER,'lm',7)
T(d,(84,H-105),'資材を集めて街を育てながら、夜ごと押し寄せる大群を守り抜く',46,WHITE,'lm',5)
T(d,(W-60,60),'ブラウザで無料プレイ',44,WHITE,'rm',5)
im.convert('RGB').save(OUT+'promo_16x9.png')

# ===== 2) 正方形：昼と夜をななめに分ける
S=1080
a=crop_to(day,S,S,0.5,0.5,1.05);b=crop_to(clash,S,S,0.5,0.45,1.15)
mask=Image.new('L',(S,S),0);ImageDraw.Draw(mask).polygon([(S*0.62,0),(S,0),(S,S),(S*0.38,S)],fill=255)
im=a.copy();im.paste(b,(0,0),mask);im=im.convert('RGBA')
d=ImageDraw.Draw(im);d.line([(S*0.62,0),(S*0.38,S)],fill=AMBER,width=8)
im.alpha_composite(grad(S,300,(0,0,0,200),(0,0,0,0)),(0,0))
im.alpha_composite(grad(S,300,(0,0,0,0),(0,0,0,215)),(0,S-300))
lg=logo(560);im.alpha_composite(lg,((S-lg.width)//2,40))
d=ImageDraw.Draw(im)
T(d,(S*0.22,S-205),'昼：築く',76,AMBER);T(d,(S*0.22,S-130),'資材を集め',38);T(d,(S*0.22,S-85),'街を育てる',38)
T(d,(S*0.78,S-205),'夜：凌ぐ',76,RED);T(d,(S*0.78,S-130),'押し寄せる',38);T(d,(S*0.78,S-85),'大群を守り抜く',38)
im.convert('RGB').save(OUT+'promo_square.png')

# ===== 3) 縦長（ストーリー・ショート動画のサムネ）
W,H=1080,1920
im=Image.new('RGBA',(W,H),(8,10,12,255))
top=crop_to(dayw,W,760,0.5,0.5,1.25);bot=crop_to(horde,W,900,0.5,0.35,1.2)
im.paste(top,(0,300));im.paste(bot,(0,1020))
im.alpha_composite(grad(W,140,(8,10,12,255),(8,10,12,0)),(0,300))
im.alpha_composite(grad(W,140,(8,10,12,0),(8,10,12,255)),(0,920))
im.alpha_composite(grad(W,200,(8,10,12,0),(8,10,12,255)),(0,H-200))
lg=logo(820);im.alpha_composite(lg,((W-lg.width)//2,50))
d=ImageDraw.Draw(im)
T(d,(70,420),'昼',110,AMBER,'lm',8);T(d,(200,425),'資材を集め、街を築く',52,WHITE,'lm',6)
T(d,(70,1110),'夜',110,RED,'lm',8);T(d,(200,1115),'押し寄せる大群を凌ぐ',52,WHITE,'lm',6)
T(d,(W//2,H-170),'昼に築き、夜に凌げ。',84,AMBER,st=7)
T(d,(W//2,H-80),'ブラウザで無料プレイ ／ PC・スマホ対応',40,WHITE,st=5)
im.convert('RGB').save(OUT+'promo_vertical.png')

# ===== 4) 特徴カード（16:9）：3つの売り
W,H=1920,1080
im=crop_to(wide,W,H).filter(ImageFilter.GaussianBlur(3));im=ImageEnhance.Brightness(im).enhance(0.45).convert('RGBA')
d=ImageDraw.Draw(im);lg=logo(560);im.alpha_composite(lg,((W-lg.width)//2,40))
T(d,(W//2,330),'生産と防衛を、同時に回せ。',78,AMBER,st=7)
cards=[(day,'① 築く','森・岩場・平地に施設を建て','資材を集めて街を育てる',(0.5,0.5,1.3)),
       (horde,'② 迫る','夜ごとアビスから','魔物の大群が押し寄せる',(0.5,0.35,1.5)),
       (east,'③ 凌ぐ','城壁・防衛施設・部隊で','どう守り抜くかを考える',(0.5,0.5,1.3))]
cw,ch=540,330;gap=60;x0=(W-3*cw-2*gap)//2;y0=420
for i,(src,t1,t2,t3,(cx,cy,z)) in enumerate(cards):
    x=x0+i*(cw+gap);ph=crop_to(src,cw,ch,cx,cy,z)
    im.paste(ph,(x,y0));d.rectangle([x-4,y0-4,x+cw+3,y0+ch+3],outline=AMBER,width=4)
    T(d,(x+cw//2,y0+ch+60),t1,64,AMBER);T(d,(x+cw//2,y0+ch+130),t2,36);T(d,(x+cw//2,y0+ch+180),t3,36)
im.convert('RGB').save(OUT+'promo_features.png')
print('ok')
