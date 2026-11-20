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
  W=['iron','alloy','magic','holy','dragon'];A=['leather','iron','alloy','magic','holy','dragon']   # 鋼はなくした（2026-11-18）
  for e in D['eq'][key]:
    if e['rank'] is None:continue
    icn=(icp+(W if key=='w' else A)[e['i']]) if icp and e['i']<len(W if key=='w' else A) else None
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

# 素材のタブ（2026-11-20）：どの方針の素材にするかを決める
RRANK={'steel':0,'stone':0,'fuel':0,'iron':0,'coal':2,'goldore':3,'alloy':3,'elec':2,'powder':3,'apowder':4,'mmetal':5,'mithril':6,'dcrys':7,'smat':1,'mat':1,'bigmat':3,'scale':4,'wing':3}
RLN={'elec':'魔','apowder':'魔','mmetal':'魔'}
RDESC={'steel':'伐採所','stone':'石切り場','fuel':'農場・漁場（食料）','iron':'鉱山','coal':'炭鉱','goldore':'金鉱','alloy':'精錬所（鉄＋金）','elec':'エーテル採掘所','powder':'火薬工房','apowder':'火薬工房Ⅱ（エーテル火薬）','mmetal':'魔金属','mithril':'聖銀鉱','dcrys':'竜晶精錬所','smat':'小型の魔物','mat':'大型の魔物','bigmat':'ボス','scale':'竜型の魔物','wing':'飛ぶ魔物'}
for k,r in RRANK.items():
  icn='r.'+k if 'r.'+k in IC else None
  if not icn and k in D.get('ricons',{}):IC['r.'+k]=D['ricons'][k];icn='r.'+k
  N('res_'+k,'N素材',r,D.get('rnames',{}).get(k,k),'はじめから' if r==0 else 'ランクで開く','取れるところ：'+RDESC.get(k,''),[],icn,RLN.get(k,''))
# 方針の案（2026-11-20）：工業と魔法で分かれる生産の改良・改造・新しい施設。カードは「案」
QA=[
 ('q_i_miner','N領地',4,'製材機','伐採所','木材 +30%。毎日 石炭を少し使う','工','b_miner'),
 ('q_i_quarry','N領地',4,'発破装置','石切り場','石材 +30%。毎日 火薬を少し使う','工','b_quarry'),
 ('q_i_iron','N領地',4,'蒸気ポンプ','鉱山','夜も掘り続ける。毎日 石炭を少し使う','工','b_ironmine'),
 ('q_i_farm','N領地',4,'水車の水路','農場','食料 +30%','工','b_farm'),
 ('q_i_fish','N領地',4,'蒸気船','漁場','食料 +30%。毎日 石炭を少し使う','工','b_fishery'),
 ('q_i_smelt','N領地',5,'高炉','精錬所','合金を2倍作る。石炭を多く使う','工','b_smelter'),
 ('q_i_house','N領地',5,'高層住宅','住居','住める人数 +50%','工','b_barracks'),
 ('q_m_miner','N領地',4,'精霊の森','伐採所','木材 +20%。埋蔵の減り −30%','魔','b_miner'),
 ('q_m_quarry','N領地',4,'ノームの導き','石切り場','石材 +20%。ときどき魔金属が少し出る','魔','b_quarry'),
 ('q_m_iron','N領地',4,'鉱脈探知','鉱山','埋蔵 +50%','魔','b_ironmine'),
 ('q_m_farm','N領地',4,'実りの魔法陣','農場','食料 +20%。幸福度 +3','魔','b_farm'),
 ('q_m_fish','N領地',4,'水妖の網','漁場','食料 +20%。埋蔵の減り −30%','魔','b_fishery'),
 ('q_m_smelt','N領地',5,'錬金炉','精錬所','合金の一部が魔金属になる','魔','b_smelter'),
 ('q_m_well','N領地',5,'魔力の泉','エーテル採掘所','エーテル +50%。小さな魔核も少し取れる','魔','b_well'),
 ('q_m_house','N領地',5,'浮遊の館','住居','住める人数 +20%。幸福度 +5','魔','b_barracks'),
 ('q_i_mg','N防衛',4,'連弩','バリスタの改造','矢をとても速く撃つ。10発ごとに装填（今の改造を工業へ）','工','g_heavymg'),
 ('q_m_mg','N防衛',4,'光の矢','バリスタの改造','3本を同時に撃ち、魔物を追いかける','魔','g_heavymg'),
 ('q_i_tw','N防衛',4,'2連物見櫓','物見櫓の改造','一度に2本撃つ（今の改造を工業へ）','工','g_m_tower'),
 ('q_m_tw','N防衛',4,'魔眼','物見櫓の改造','暗闇の魔物も見えて撃てる','魔','g_m_tower'),
 ('q_i_how','N防衛',4,'大岩','投石機の改造','爆発の範囲 140%・小型を吹き飛ばす（今の改造を工業へ）','工','g_bighow'),
 ('q_m_how','N防衛',4,'重力の岩','投石機の改造','着弾した所に魔物を引き寄せる','魔','g_bighow'),
 ('q_i_can','N防衛',4,'連射砲','大砲の改造','2発続けて撃つ（今の改造を工業へ）','工','g_bigbore'),
 ('q_m_can','N防衛',4,'雷の砲弾','大砲の改造','当たると近くの3体に雷が跳ねる','魔','g_bigbore'),
 ('q_i_mor','N防衛',4,'クラスター','迫撃砲の改造','着弾した所に破片が飛び散る（今の改造を工業へ）','工','g_incend'),
 ('q_m_mor','N防衛',4,'凍結弾','迫撃砲の改造','着弾した所の魔物が遅くなる','魔','g_incend'),
 ('q_i_wire','N防衛',4,'鉄条網','柵・石の壁','触れた魔物が傷を受け続け、足が遅くなる','工','b_fence'),
 ('q_i_fort','N防衛',5,'鋼鉄の要塞','城壁・門','耐久 +50%、上の防衛施設の射程 +2','工','b_wall'),
 ('q_i_hgun','N防衛',6,'重砲','新しい施設','大砲の上位。射程・火力が大きい（新しい絵）','工','g_cannontech'),
 ('q_i_flare','N防衛',6,'照明弾の発射台','新しい施設','夜の広い範囲を照らす（新しい絵）','工','b_brazier'),
 ('q_i_bigc','N防衛',7,'大要塞砲','新しい施設','城に据える切り札の大砲。一晩に数回、遠くの群れを吹き飛ばす（新しい絵）','工','b_hq'),
 ('q_i_spg','N部隊',6,'自走砲車','新しい兵','動く大砲の部隊（新しい絵）','工','g_artillery'),
 ('q_r_heavy','N素材',5,'（工業の金属）','素材','魔金属の代わりになる工業の金属。名前と作り方を決める','工',None),
]
ids2={c['id'] for c in cards}
for (id,cat,r,n,tg,e,ln,pre) in QA:
  cards.append(dict(id=id,cat=cat,r=r,n=n,mx=1,pre=[pre] if pre and pre in ids2 else [],c='',tt=0,e=e,kc=False,ln=ln,un=[],mv='',lv=False,prop='案',tg=tg,art=1 if '新しい絵' in e else 0))
d['T']+=cards
d['tabs']=['N領地','N防衛','N部隊','N素材','生産','内政','防衛','部隊','魔核']
d['TABL']={'N領地':'領地','N防衛':'防衛','N部隊':'部隊','N素材':'素材','生産':'前：生産','内政':'前：内政','防衛':'前：防衛','部隊':'前：部隊','魔核':'前：魔核'}
used={t['ic'] for t in d['T'] if t.get('ic')}|{k for k in IC if k.startswith('r.')}
d['IC']={k:IC[k] for k in used if k in IC}
import os
if os.path.exists('fix.json'):d['FIX']=json.load(open('fix.json'))   # 前の並び（作り直してもずれないように）
json.dump(d,open('data.json','w'),ensure_ascii=False)
from collections import Counter
for c in ['N領地','N防衛','N部隊']:
  L=[t for t in cards if t['cat']==c]
  print(c,len(L),'研究',Counter(t['r'] for t in L if t['tg'] in('研究','改造','そのほか')))
