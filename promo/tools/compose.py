# 撮ったコマに字幕・タイトル・エンドカードを重ねて、動画用のコマを作る
import os,glob,math,subprocess,sys
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/'
FONT=P+'fonts/DotGothic16.ttf'
W,H=1920,1080;FPS=30
OUT=P+'vframes_'+(sys.argv[1] if len(sys.argv)>1 else 'mixed')+'/';os.makedirs(OUT,exist_ok=True)
for f in glob.glob(OUT+'*.jpg'):os.remove(f)
LAY=sys.argv[1] if len(sys.argv)>1 else 'mixed'
src=sorted(glob.glob(P+'frames_'+LAY+'/*.jpg'))[:690]+sorted(glob.glob(P+'frames_siege/*.jpg'))[30:255]
KV=Image.open('/home/user/NIGHT-DEFENSE/keyvisual.jpg').convert('RGB').resize((W,H))
LOGO=Image.open(P+'logo.png').convert('RGBA')
def font(sz):return ImageFont.truetype(FONT,sz)
AMBER=(242,179,61);WHITE=(240,240,232)

def text_c(d,xy,s,sz,fill,anchor='mm',stroke=6):
    d.text(xy,s,font=font(sz),fill=fill,anchor=anchor,stroke_width=stroke,stroke_fill=(10,8,6))

def caption(im,main,sub=None,alpha=1.0,pos='bottom'):
    """画面下に字幕の帯"""
    if alpha<=0:return im
    ov=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(ov)
    bh=200 if sub else 150
    y0=H-bh-40 if pos=='bottom' else 60
    # 帯（左右がうすくなる）
    band=Image.new('L',(W,bh),0);bd=ImageDraw.Draw(band)
    for x in range(W):
        a=int(170*min(1,(min(x,W-x))/500));bd.line([(x,0),(x,bh)],fill=a)
    ov.paste(Image.new('RGBA',(W,bh),(6,8,10,255)),(0,y0),band)
    d.line([(W//2-260,y0+8),(W//2+260,y0+8)],fill=AMBER+(200,),width=3)
    text_c(d,(W//2,y0+(70 if sub else bh//2+4)),main,78,AMBER)
    if sub:text_c(d,(W//2,y0+150),sub,40,WHITE,stroke=4)
    if alpha<1:
        a=ov.split()[3].point(lambda v:int(v*alpha));ov.putalpha(a)
    im=im.convert('RGBA');im.alpha_composite(ov);return im.convert('RGB')

def fade(im,k):
    """k=0で真っ黒、1でそのまま"""
    if k>=1:return im
    return Image.blend(Image.new('RGB',im.size,(0,0,0)),im,max(0,k))

def kenburns(img,t,z0=1.0,z1=1.08,cx=0.5,cy=0.5):
    z=z0+(z1-z0)*t;w,h=int(W/z),int(H/z);x=int((W-w)*cx);y=int((H-h)*cy)
    return img.crop((x,y,x+w,y+h)).resize((W,H),Image.LANCZOS)

def env(i,n,a=10,b=10):
    """字幕の出入り（a コマで出て b コマで消える）"""
    return max(0,min(1,i/a,(n-1-i)/b))

frames=[]
def put(im):frames.append(im)
def save_all():
    for k,im in enumerate(frames):im.save(OUT+'v%05d.jpg'%k,quality=92)

# ===== 0) オープニング（3.5秒）：キービジュアル
N=int(3.5*FPS)
for i in range(N):
    t=i/(N-1);im=kenburns(KV,t,1.0,1.06,0.5,0.4)
    im=ImageEnhance.Brightness(im).enhance(0.55+0.45*min(1,t*3))
    im=fade(im,min(1,i/12))
    ov=im.convert('RGBA');d=ImageDraw.Draw(ov)
    a=max(0,min(1,(i-25)/12))
    if a>0:
        band=Image.new('RGBA',(W,170),(6,8,10,int(190*a)));ov.alpha_composite(band,(0,H-230))
        text_c(d,(W//2,H-145),'昼に築き、夜に凌げ。',96,AMBER+(int(255*a),),stroke=7)
    im=ov.convert('RGB')
    if i>N-8:im=fade(im,(N-1-i)/7)
    put(im)

# ===== ゲームのコマ（撮った順）
seg=[('day',7*FPS),('approach',4*FPS),('clash',6*FPS),('wide',6*FPS),('siege',225)]
CAP={'day':('資材を集め、街を築く','伐採所・石切り場・農場・工房…生産が街を育て、守りを支える'),
     'approach':('日が暮れると――','アビスから魔物の大群が押し寄せる'),
     'clash':('城壁と防衛施設で迎え撃て','バリスタ・大砲・メイジの塔・部隊を配置'),
     'wide':('四方から来る大群を、どう凌ぐか','生産を止めれば守れない。守りを怠れば街が落ちる'),
     'siege':('こちらから攻め込む','駐留地に夜襲をかけ、次の襲撃を減らせ')}
TAG={'day':'① 築く','approach':'② 凌ぐ','clash':'② 凌ぐ','wide':'② 凌ぐ','siege':'③ 攻める'}
def tag(im,s,a):
    if a<=0:return im
    ov=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(ov)
    d.rectangle([0,50,470,160],fill=(6,8,10,int(200*a)));d.rectangle([0,50,10,160],fill=AMBER+(int(255*a),))
    d.text((40,105),s,font=font(78),fill=AMBER+(int(255*a),),anchor='lm',stroke_width=6,stroke_fill=(10,8,6,int(255*a)))
    im=im.convert('RGBA');im.alpha_composite(ov);return im.convert('RGB')
k=0
for name,n in seg:
    for i in range(n):
        if k>=len(src):break
        im=Image.open(src[k]).convert('RGB');k+=1
        m,s=CAP[name]
        if name=='approach':
            im=caption(im,m,s,env(i,n,8,8))
        else:
            im=caption(im,m,s,env(i,n,10,10))
        if name in ('day','approach','siege'):im=tag(im,TAG[name],env(i,n if name!='approach' else 99999,10,10))
        elif name in ('clash','wide'):im=tag(im,TAG[name],1.0 if name=='clash' else env(i,n,1,10))
        if name=='day' and i<10:im=fade(im,i/10)
        if name=='siege' and i<8:im=fade(im,i/8)
        if name=='wide' and i>n-8:im=fade(im,(n-1-i)/7)
        if name=='approach' and i<6:  # 夜になる瞬間の暗転
            im=fade(im,0.25+0.75*i/6)
        if name=='siege' and i>n-12:im=fade(im,(n-1-i)/11)
        put(im)
print('game frames used',k,'of',len(src))

# ===== エンドカード（4.5秒）
N=int(4.5*FPS)
base=ImageEnhance.Brightness(KV.crop((0,500,1920,1080)).resize((1920,1080)).filter(ImageFilter.GaussianBlur(14))).enhance(0.32)
lw=980;lh=int(LOGO.height*lw/LOGO.width);logo=LOGO.resize((lw,lh),Image.NEAREST)
for i in range(N):
    t=i/(N-1);im=kenburns(base,t,1.0,1.04).convert('RGBA')
    a=min(1,i/12)
    l=logo.copy();l.putalpha(l.split()[3].point(lambda v:int(v*a)))
    im.alpha_composite(l,((W-lw)//2,150))
    d=ImageDraw.Draw(im)
    b=max(0,min(1,(i-12)/12))
    if b>0:
        text_c(d,(W//2,150+lh+70),'シミュレーション型ディフェンスゲーム',52,WHITE+(int(255*b),),stroke=5)
        text_c(d,(W//2,150+lh+170),'ブラウザで無料プレイ ／ PC・スマホ対応',60,AMBER+(int(255*b),),stroke=6)
        text_c(d,(W//2,H-110),'negiramen1922.github.io/NIGHT-DEFENSE',46,WHITE+(int(255*b),),stroke=5)
    im=im.convert('RGB')
    if i>N-10:im=fade(im,(N-1-i)/9)
    put(im)

save_all()
print('total frames',len(frames),'=',round(len(frames)/FPS,1),'s')
