# 宣伝用の静止画（16:9・正方形・縦長・特徴カード）
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/'
FONT=P+'fonts/DotGothic16.ttf'
import os,sys
LAY=sys.argv[1] if len(sys.argv)>1 else 'mixed'
OUT=P+'out_'+LAY+'/';os.makedirs(OUT,exist_ok=True)
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
day=Image.open(P+'shots_'+LAY+'/day_close.png').convert('RGB')
dayw=Image.open(P+'shots_'+LAY+'/day_town.png').convert('RGB')
horde=Image.open(P+'shots_'+LAY+'/night_horde.png').convert('RGB')
clash=Image.open(P+'shots_'+LAY+'/clash_close.png').convert('RGB')
wide=Image.open(P+'shots_'+LAY+'/battle_wide.png').convert('RGB')
east=Image.open(P+'shots_'+LAY+'/east_wall.png').convert('RGB')
siege=Image.open(P+'shots_siege_attack.png').convert('RGB')

# ===== 1) 16:9 メイン
W,H=1920,1080
od=crop_to(Image.open(P+'shots_'+LAY+'/open_day.png').convert('RGB'),W,H);on=crop_to(Image.open(P+'shots_'+LAY+'/open_night.png').convert('RGB'),W,H)
m=Image.new('L',(W,H),0);ImageDraw.Draw(m).polygon([(W*0.66,0),(W,0),(W,H),(W*0.50,H)],fill=255);od.paste(on,(0,0),m);im=od.convert('RGBA')
ImageDraw.Draw(im).line([(W*0.66,0),(W*0.50,H)],fill=AMBER,width=7)
im.alpha_composite(grad(W,H,(0,0,0,170),(0,0,0,0)).crop((0,0,W,H//2)),(0,0))
im.alpha_composite(grad(W,420,(0,0,0,0),(0,0,0,220)),(0,H-420))
lg=logo(760);im.alpha_composite(lg,(70,50))
d=ImageDraw.Draw(im)
T(d,(80,H-215),'昼に築き、夜に守り抜け。',104,AMBER,'lm',7)
T(d,(84,H-105),'資材を集めて街を育てながら、夜ごと押し寄せる大群を守り抜く',46,WHITE,'lm',5)
T(d,(W-60,60),'ただいま開発中',44,WHITE,'rm',5)
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
T(d,(S*0.78,S-205),'夜：守る',76,RED);T(d,(S*0.78,S-130),'押し寄せる',38);T(d,(S*0.78,S-85),'大群を守り抜く',38)
im.convert('RGB').save(OUT+'promo_square.png')

# ===== 3) 縦長（3段：築く・守る・攻める）
W,H=1080,1920
im=Image.new('RGBA',(W,H),(8,10,12,255))
panels=[(day,'築く','資材を集め、街を育てる',AMBER,(0.5,0.5,1.25)),(clash,'守る','押し寄せる大群を守り抜く',RED,(0.5,0.5,1.2)),(siege,'攻める','駐留地へ夜襲をかける',(150,200,255),(0.42,0.6,1.4))]
y0=420;ph=440
for i,(src,t1,t2,col,(cx,cy,z)) in enumerate(panels):
    y=y0+i*(ph+20);im.paste(crop_to(src,W,ph,cx,cy,z),(0,y))
    im.alpha_composite(grad(W,150,(8,10,12,230),(8,10,12,0)),(0,y))
    d=ImageDraw.Draw(im);T(d,(50,y+62),t1,96,col,'lm',8);T(d,(60+len(t1)*96,y+68),t2,46,WHITE,'lm',5)
lg=logo(820);im.alpha_composite(lg,((W-lg.width)//2,40))
d=ImageDraw.Draw(im)
T(d,(W//2,H-150),'昼に築き、夜に守り抜け。',84,AMBER,st=7)
T(d,(W//2,H-62),'ただいま開発中 ／ PC・スマホ対応',40,WHITE,st=5)
im.convert('RGB').save(OUT+'promo_vertical.png')

# ===== 4) 特徴カード（16:9）：3つの売り
W,H=1920,1080
im=crop_to(wide,W,H).filter(ImageFilter.GaussianBlur(3));im=ImageEnhance.Brightness(im).enhance(0.45).convert('RGBA')
d=ImageDraw.Draw(im);lg=logo(560);im.alpha_composite(lg,((W-lg.width)//2,40))
T(d,(W//2,330),'築いて、守って、攻め込め。',78,AMBER,st=7)
cards=[(day,'① 築く','森・岩場・平地に施設を建て','資材を集めて街を育てる',(0.5,0.5,1.3)),
       (clash,'② 守る','夜ごと押し寄せる大群を','城壁・防衛施設・部隊で守る',(0.5,0.5,1.3)),
       (siege,'③ 攻める','見つけた駐留地へ夜襲','次の襲撃を減らす',(0.42,0.6,1.5))]
cw,ch=540,330;gap=60;x0=(W-3*cw-2*gap)//2;y0=420
for i,(src,t1,t2,t3,(cx,cy,z)) in enumerate(cards):
    x=x0+i*(cw+gap);ph=crop_to(src,cw,ch,cx,cy,z)
    im.paste(ph,(x,y0));d.rectangle([x-4,y0-4,x+cw+3,y0+ch+3],outline=AMBER,width=4)
    T(d,(x+cw//2,y0+ch+60),t1,64,AMBER);T(d,(x+cw//2,y0+ch+130),t2,36);T(d,(x+cw//2,y0+ch+180),t3,36)
im.convert('RGB').save(OUT+'promo_features.png')
print('ok')
