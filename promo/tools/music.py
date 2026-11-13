# 宣伝動画の曲（約35秒）：昼は軽いアルペジオ、夜で暗転の一撃、戦闘は太鼓とベース、最後に締めの一撃
import numpy as np,wave
SR=44100;DUR=35.0;N=int(SR*DUR)
L=np.zeros(N);R=np.zeros(N)
rng=np.random.default_rng(7)
def add(sig,t0,pan=0.0,g=1.0):
    i=int(t0*SR);j=min(N,i+len(sig));s=sig[:j-i]*g
    L[i:j]+=s*(1-max(0,pan));R[i:j]+=s*(1+min(0,pan))
def env(n,a,d,s=0.0,r=None):
    t=np.arange(n)/SR;e=np.minimum(1,t/max(a,1e-4))*np.exp(-t/max(d,1e-4));return e*(1-s)+s*np.minimum(1,t/max(a,1e-4))
def tone(f,dur,kind='sine',a=0.005,d=0.3,s=0.0):
    n=int(dur*SR);t=np.arange(n)/SR
    if kind=='sine':w=np.sin(2*np.pi*f*t)
    elif kind=='tri':w=2*np.abs(2*((f*t)%1)-1)-1
    elif kind=='saw':w=2*((f*t)%1)-1
    elif kind=='sq':w=np.sign(np.sin(2*np.pi*f*t))*0.6
    return w*env(n,a,d,s)
def lowpass(x,a=0.08):
    y=np.zeros_like(x);acc=0.0
    for i in range(len(x)):acc+=a*(x[i]-acc);y[i]=acc
    return y
def drum(f0=60,dur=0.6,noise=0.3):
    n=int(dur*SR);t=np.arange(n)/SR
    f=f0*(1+2.5*np.exp(-t*30));ph=2*np.pi*np.cumsum(f)/SR
    body=np.sin(ph)*np.exp(-t*6);nz=rng.standard_normal(n)*np.exp(-t*35)*noise
    return body+nz
def snare(dur=0.25):
    n=int(dur*SR);t=np.arange(n)/SR
    return rng.standard_normal(n)*np.exp(-t*22)*0.5+np.sin(2*np.pi*190*t)*np.exp(-t*25)*0.4
def boom(dur=3.0):
    n=int(dur*SR);t=np.arange(n)/SR
    f=45*(1+1.5*np.exp(-t*8));ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t*1.4)+lowpass(rng.standard_normal(n),0.03)*np.exp(-t*2)*1.5
def note(m):return 440*2**((m-69)/12)
# ── 0〜3.5 秒：低い持続音とチャイム
add(tone(note(45),3.6,'tri',a=1.0,d=9)*0.25,0.0)
add(tone(note(52),3.6,'sine',a=1.2,d=9)*0.18,0.0)
for k,m in enumerate([76,79,81,84]):add(tone(note(m),1.6,'sine',a=0.002,d=0.6),0.9+k*0.18,pan=(-0.3+0.2*k),g=0.16)
# ── 3.5〜10.5 秒：昼（軽いアルペジオ 120bpm、Am ペンタ）
bpm=120;st=60/bpm/2
arp=[57,60,64,67,69,67,64,60, 55,59,62,67,71,67,62,59, 53,57,60,65,69,65,60,57, 55,59,62,67,71,74,71,67]
t=3.5;i=0
while t<10.4:
    m=arp[i%len(arp)];add(tone(note(m+12),0.35,'tri',a=0.003,d=0.22),t,pan=0.25*np.sin(i*0.7),g=0.2)
    if i%4==0:add(tone(note(arp[(i//8*8)%len(arp)]-12),0.9,'sine',a=0.01,d=0.5),t,g=0.22)
    if i%8==4:add(snare(0.08)*0.5,t,g=0.12)
    t+=st;i+=1
# ── 10.5 秒：日が暮れる一撃
add(boom(3.5),10.45,g=0.6)
add(tone(note(33),4.0,'saw',a=0.8,d=6)*0.08,10.5)
# ── 10.5〜14.5 秒：心臓の鼓動のような太鼓がだんだん速く
t=11.2;gap=0.75
while t<14.4:
    add(drum(55,0.5,0.2),t,g=0.55);add(drum(55,0.4,0.2),t+0.18,g=0.35);t+=gap;gap=max(0.42,gap*0.9)
# ── 14.5〜30.5 秒：戦い（140bpm の太鼓・ベース・弦のような和音）
bpm=140;b=60/bpm;t=14.5;beat=0
bassline=[45,45,48,45,43,43,47,43, 41,41,45,41,43,43,47,50]
chords=[[57,60,64],[55,59,62],[53,57,60],[55,59,64]]
while t<30.45:
    inten=min(1,0.55+(t-14.5)/16*0.6)
    if beat%2==0:add(drum(52,0.6,0.35),t,g=0.75*inten)
    if beat%4==2:add(snare(0.25),t,g=0.45*inten)
    if beat%4==3:add(drum(70,0.3,0.2),t+b/2,pan=0.3,g=0.35*inten)
    add(rng.standard_normal(int(0.04*SR))*np.exp(-np.arange(int(0.04*SR))/SR*120),t+b/2,pan=-0.4,g=0.08*inten)
    m=bassline[beat%len(bassline)];add(tone(note(m-12),b*0.95,'saw',a=0.005,d=0.25)*0.5,t,g=0.38*inten)
    if beat%8==0:
        ch=chords[(beat//8)%len(chords)]
        for k,mm in enumerate(ch):add(tone(note(mm),b*8,'saw',a=0.25,d=3.0,s=0.0)*0.5,t,pan=(k-1)*0.5,g=0.06*inten)
    if t>22.5 and beat%2==1:  # 後半は旋律
        mel=[69,72,76,74,72,71,69,67,69,72,79,76,74,72,71,72]
        add(tone(note(mel[(beat//2)%len(mel)]),b*0.9,'sq',a=0.003,d=0.3),t,pan=0.2,g=0.07*inten)
    t+=b;beat+=1
# ── 30.5 秒：締めの一撃と和音
add(boom(4.0),30.5,g=0.65)
for k,mm in enumerate([45,57,60,64,69]):add(tone(note(mm),4.4,'saw',a=0.02,d=1.6)*0.5,30.5,pan=(k-2)*0.25,g=0.09)
for k,m in enumerate([81,84,88]):add(tone(note(m),2.5,'sine',a=0.002,d=0.9),31.0+k*0.15,g=0.12)
# まとめ：軽い残響と音量
def reverb(x):
    y=x.copy()
    for dly,gn in [(0.031,0.32),(0.047,0.28),(0.071,0.22),(0.113,0.16),(0.157,0.11)]:
        d=int(dly*SR);y[d:]+=x[:-d]*gn
    return y
L=reverb(L);R=reverb(R)
fade=np.ones(N);fo=int(1.2*SR);fade[-fo:]=np.linspace(1,0,fo);fi=int(0.3*SR);fade[:fi]=np.linspace(0,1,fi)
L*=fade;R*=fade
pk=np.percentile(np.abs(np.concatenate([L,R])),99.8);L=np.tanh(L/pk*0.9)*0.9;R=np.tanh(R/pk*0.9)*0.9
data=(np.stack([L,R],1)*32767).astype(np.int16)
P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/'
with wave.open(P+'music.wav','wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(data.tobytes())
print('ok',DUR)
