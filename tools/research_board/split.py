# 研究の木 整理ボード用：Lvのある研究を「名前Ⅰ → Ⅱ → …」のブロックに分ける
# Lvの上限が城のランクの研究：Lv k は城ランク k から → ランク max(元のランク, k) の列に置く
import json,re,sys
src,dst=sys.argv[1],sys.argv[2]
d=json.load(open(src));RN=['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ']
# 生産の研究（2026-11-17 決定）：Ⅰ +30%・Ⅱ 鉄の道具 +80%・Ⅲ 鋼の道具 +100%・Ⅳ〜Ⅶ +60%ずつ。その種類の施設が全部まとめてその見た目に
PROD={'mine':('伐採所の産出','斧'),'quarrying':('石切り場の産出','のみ'),'smelt':('鉱山の産出','つるはし'),'farming':('農場の産出','鋤'),'fishing':('漁場の産出','網'),'autoammo':('武器工房の生産','金床')}
PSTEP=[30,80,100,60,60,60,60]
def prod_eff(i,k):
    what,tool=PROD[i];add=PSTEP[k-1];tot=round(1+sum(PSTEP[:k])/100,1)
    tag='鉄の'+tool+'に' if k==2 else '鋼の'+tool+'に' if k==3 else '改良'
    return f"{what} +{add}%（{tag}。ここまでで{tot}倍）"
SPECIAL={'scout':['駐屯地のおおよその場所が分かる（地図の円）','次の襲撃の全体のおおよその数と、魔物の分類（小型・大型・竜型・ボス）が分かる','駐屯地の正確な場所が分かる（ここから駐屯地攻撃ができる）。魔物の具体的な種類も分かる','方向ごとの数が分かる']}
out=[]
for t in d['tech']:
    if t['max']=='城ランクまで' or t['id'] in SPECIAL:
        n=len(SPECIAL[t['id']]) if t['id'] in SPECIAL else 7
        eff=re.sub(r'（Lvごと[^）]*）','',t['eff']).strip()
        prev=None
        for k in range(1,n+1):
            u=dict(t);u['id']=t['id'] if k==1 else f"{t['id']}_L{k}";u['name']=t['name']+RN[k];u['max']='1'
            u['rank']=max(t['rank'],k);u['ord']=t['ord']+k*0.001;u['pre']=list(t['pre']) if k==1 else [prev]
            u['eff']=SPECIAL[t['id']][k-1] if t['id'] in SPECIAL else prod_eff(t['id'],k) if t['id'] in PROD else (eff if k==1 else f'Lv{k}：'+eff)
            u['lvFrom']=t['id'];out.append(u);prev=u['id']
    else: out.append(t)
d['tech']=out;d['split']=True
json.dump(d,open(dst,'w'),ensure_ascii=False)
print(len(out))
