# 研究の木 整理ボード用：Lvのある研究を「名前Ⅰ → Ⅱ → …」のブロックに分ける
# Lvの上限が城のランクの研究：Lv k は城ランク k から → ランク max(元のランク, k) の列に置く
import json,re,sys
src,dst=sys.argv[1],sys.argv[2]
d=json.load(open(src));RN=['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ']
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
            u['eff']=SPECIAL[t['id']][k-1] if t['id'] in SPECIAL else (eff if k==1 else f'Lv{k}：'+eff)
            u['lvFrom']=t['id'];out.append(u);prev=u['id']
    else: out.append(t)
d['tech']=out;d['split']=True
json.dump(d,open(dst,'w'),ensure_ascii=False)
print(len(out))
