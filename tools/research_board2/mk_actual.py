import json,re
d=json.load(open('data.json'));D=json.load(open('proto_dump.json'));I=json.load(open('icons.json'))
IC=I['out']
d['T']=[t for t in d['T'] if not t['cat'].startswith('N')]
cards=[];ids=set()
def N(id,cat,r,n,tg,e,pre=[],ic=None,ln=''):
  if id in ids:return
  ids.add(id);cards.append(dict(id=id,cat=cat,r=r,n=n,mx=1,pre=pre,c='',tt=0,e=e,kc=False,ln=ln,un=[],mv='',lv=False,prop='新',tg=tg,ic=ic if ic in IC else None))
TAB={'領地':'N領地','防衛':'N防衛','部隊':'N部隊'}
UNIT_B={'train','stable','aerie','magic'}
def btab(k,grp):return 'N防衛' if grp=='def' else 'N領地'
techOfB={}
for t in D['T']:
  for k in t['bld']:techOfB[k]=t
# research cards
for t in D['T']:
  ic=None
  if t['bld']:ic=t['bld'][0]+'.1'
  elif t['unit']:ic='u.'+t['unit'][0]
  tg='研究' if (t['bld'] or t['unit']) else ('改造' if t['e'].startswith('改造') or t['id'] in ('tower','stakes','thorn','yariana','resetpit','poison','shieldwall','charge','bigquiver','highmagic','gunnery','dragonscale','chariott') else 'そのほか')
  e=t['e']+(f"（{t['cost']}・{t['tt']}ターン）" if t['cost'] else '')
  N('g_'+t['id'],TAB[t['cat']],t['r'],t['n'],tg,e,['g_'+p for p in t['pre']],ic,{'工':'工','魔':'魔'}.get(t['ln'],''))
# buildings: base / rank-open
for x in D['rb']:
  k=x['k'];cat=btab(k,x.get('grp'))
  if x['req'] and x['rank'] is None:continue   # research building (card is the research)
  r=x['rank'] if x['rank'] else 0
  N('b_'+k,cat,r,x['n'],'ランクで開く' if r>0 else 'はじめから','新しい施設。城のランクが上がるとすぐ建てられる' if r>0 else 'はじめから建てられる',[],k+'.1')
# KC stage chains
TT=D['TOOL_T']
for k,v in D['kc'].items():
  if k.startswith('big'):continue   # 大きな施設の道具の段は小さい施設と同じなので、カードは出さない（線が遠くへ伸びて見づらいため）
  st=v['st'];base='b_'+k
  if base not in ids:
    t=techOfB.get(k)
    if t:base='g_'+t['id']
    else:
      N(base,btab(k,v.get('grp')),0,k,'はじめから','',[],k+'.1')
  cat=next(c['cat'] for c in cards if c['id']==base)
  prev=base
  s0=0   # あとから建てる施設は、建てられるランクの道具を持って建つ（その段より下のカードは出さない・2026-11-18）
  if v['tool']:
    R0=next((x['rank'] for x in D['rb'] if x['k']==k and x.get('rank')),1) or 1
    if R0>1:s0=max(j for j in range(len(TT)) if TT[j][0]<=R0)
    if k=='mithmine':s0=min(s0,4)
    if k=='goldmine':s0=min(s0,2)
    if s0:
      bc=next(c for c in cards if c['id']==base);bc['e']=(bc['e']+'。' if bc['e'] else '')+f'{TT[s0][1]}の{v["tool"]}で建つ'
  for i in range(1,len(st)):
    if i<=s0:continue
    r,n=st[i]
    nm=(TT[i][1]+'の'+v['tool']) if v['tool'] else n
    e=(f"道具を替える（すぐ・資材）。{n}") if v['tool'] else ('アップグレード（'+('ターンと資材' if v.get('grp')=='def' and k!='gate' else 'すぐ・資材')+'）')
    icn=f'{k}.{i+1}' if f'{k}.{i+1}' in IC else f'{k}.1'
    N(f'k_{k}_{i}',cat,r,nm,'ランクで開く',e,[prev],icn);prev=f'k_{k}_{i}'
# equipment
for key,lab,icp in [('w','武器','w.'),('a','鎧','a.'),('r','ローブ',None)]:
  prev=[]
  W=['iron','steel','alloy','magic','holy','dragon'];A=['leather','iron','steel','alloy','magic','holy']
  for e in D['eq'][key]:
    if e['rank'] is None:continue
    icn=(icp+(W if key=='w' else A)[e['i']]) if icp and e['i']<6 else None
    N(f'e_{key}_{e["i"]}','N部隊',e['rank'],e['n'],'ランクで開く' if e['rank'] else 'はじめから','部隊を選んで替える（すぐ・資材）' if e['rank'] else 'はじめの装備',prev,icn);prev=[f'e_{key}_{e["i"]}']
for u in D['base']:
  k,n=u.split(':');N('u_'+k,'N部隊',0,n,'はじめから','はじめから編成できる',[],'u.'+('pawn' if k=='pawn' else k))
# 研究の流れが分かるように、関係のある施設・兵から研究へ線を引く（ゲームの前提ではない・ボードの見やすさ用）
REL={'stakes':'b_fence','yariana':'b_pit','resetpit':None,'heavymg':'b_mg','bighow':'b_how','tower':'b_tower','thorn':'b_swall',
 'p_plant':'b_miner','p_charcoal':'b_miner','p_road':'b_quarry','p_blast':'b_quarry','p_prop':'b_ironmine','p_sort':'b_ironmine','p_rot':'b_farm',
 'p_nightfish':'b_fishery','p_net':'b_fishery','p_marrow':'b_ammo','p_vent':'b_coalmine','brewing':'b_barracks','overtime':'b_barracks','prefab':'b_miner','refine':'b_hq',
 'heavyinf':'u_pawn','bigquiver':'u_archer','musket':'u_archer','p_ench':'b_tower','gunpowder':'b_ammo','magetower':'g_magic','furnace':'b_well','firerock':'k_how_1','tportt':'k_market_1'}
byid={c['id']:c for c in cards}
for tid,src in REL.items():
  c=byid.get('g_'+tid)
  if c and src and src in byid and src not in c['pre'] and byid[src]['cat']==c['cat']:c['pre']=[src]+c['pre']
for c in cards:
  if c['id'].startswith('g_tool_'):c['top']=1
for a2,b2 in [('k_mortar_1','g_incend')]:   # 焼夷砲弾のあとに魔金属の迫撃砲（ゲームの決まり）
  if a2 in byid and b2 in byid and b2 not in byid[a2]['pre']:byid[a2]['pre']=[b2]+byid[a2]['pre']
# 大きな生産施設は研究のカード（t_big*）で出るので案は消した
# 壁は木の柵から横に並べる（2026-11-18）
for a2,b2 in [('b_swall','b_fence'),('b_wall','b_swall'),('b_wall3','b_wall'),('b_wall5','b_wall3')]:
  if a2 in byid and b2 in byid and b2 not in byid[a2]['pre']:byid[a2]['pre']=[b2]+byid[a2]['pre']
# 罠は罠でまとめる（2026-11-18）：爆弾罠 → エーテル爆弾
for a2,b2 in [('g_aebombt','g_bombtrap')]:
  if a2 in byid and b2 in byid and b2 not in byid[a2]['pre']:byid[a2]['pre']=[b2]+byid[a2]['pre']
for c in cards:
  if c['id'].startswith('g_t_big'):c['e']+='（道具は小さい施設と同じ段を使う）'
for k,src in [('t_bigfarm','b_farm'),('t_bigminer','b_miner'),('t_bigquarry','b_quarry'),('t_bigfish','b_fishery')]:
  c=byid.get('g_'+k)
  if c and src in byid and src not in c['pre']:c['pre']=[src]+c['pre']

d['T']+=cards
d['tabs']=['N領地','N防衛','N部隊','生産','内政','防衛','部隊','魔核']
d['TABL']={'N領地':'領地','N防衛':'防衛','N部隊':'部隊','生産':'前：生産','内政':'前：内政','防衛':'前：防衛','部隊':'前：部隊','魔核':'前：魔核'}
used={t['ic'] for t in d['T'] if t.get('ic')}|{k for k in IC if k.startswith('r.')}
d['IC']={k:IC[k] for k in used if k in IC}
import os
if os.path.exists('fix.json'):d['FIX']=json.load(open('fix.json'))   # 前の並び（作り直してもずれないように）
json.dump(d,open('data.json','w'),ensure_ascii=False)
from collections import Counter
for c in ['N領地','N防衛','N部隊']:
  L=[t for t in cards if t['cat']==c]
  print(c,len(L),'研究',Counter(t['r'] for t in L if t['tg'] in('研究','改造','そのほか')))
