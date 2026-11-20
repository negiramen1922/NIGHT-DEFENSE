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
      continue   # 試作でなくなった施設（武器工房など）は出さない
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
RRANK={'steel':0,'stone':0,'fuel':0,'iron':0,'coal':2,'goldore':3,'alloy':3,'elec':4,'powder':3,'apowder':4,'mmetal':5,'mithril':6,'dcrys':7,'smat':1,'mat':1,'bigmat':3,'scale':4,'wing':3}
RLN={'elec':'魔','apowder':'魔','mmetal':'魔'}
RDESC={'steel':'伐採所','stone':'石切り場','fuel':'農場・漁場（食料）','iron':'鉱山','coal':'炭鉱','goldore':'金鉱','alloy':'精錬所（鉄＋金）','elec':'エーテル採掘所','powder':'火薬工房','apowder':'火薬工房Ⅱ（エーテル火薬）','mmetal':'魔金属','mithril':'聖銀鉱','dcrys':'竜晶精錬所','smat':'小型の魔物','mat':'大型の魔物','bigmat':'ボス','scale':'竜型の魔物','wing':'飛ぶ魔物'}
for k,r in RRANK.items():
  icn='r.'+k if 'r.'+k in IC else None
  if not icn and k in D.get('ricons',{}):IC['r.'+k]=D['ricons'][k];icn='r.'+k
  N('res_'+k,'N素材',r,D.get('rnames',{}).get(k,k),'はじめから' if r==0 else 'ランクで開く','取れるところ：'+RDESC.get(k,''),[],icn,RLN.get(k,''))
# 方針の案（2026-11-20）：工業と魔法で分かれる生産の改良・改造・新しい施設。カードは「案」
QA=[
 ('q_i_miner','N領地',4,'製材機','伐採所','蒸気で動くのこぎり。木材 +30%。毎日 石炭を少し使う','工',['q_i_steam','b_miner']),
 ('q_i_quarry','N領地',4,'蒸気のドリル','石切り場','石材 +30%。毎日 石炭を少し使う','工',['q_i_steam','b_quarry']),
 ('q_i_iron','N領地',4,'蒸気ポンプ','鉱山','坑道の水をくみ出して深く掘る。鉄 +30%。毎日 石炭を少し使う','工',['q_i_steam','b_ironmine']),
 ('q_i_farm','N領地',4,'蒸気の鋤','農場','食料 +30%。毎日 石炭を少し使う','工',['q_i_steam','b_farm']),
 ('q_i_fish','N領地',4,'蒸気船','漁場','食料 +30%。毎日 石炭を少し使う','工',['q_i_steam','b_fishery']),
 ('q_i_smelt','N領地',5,'高炉','新しい施設（ランクで開く）','新しい施設。高い精錬の塔で、煙をもくもく上げて合金・石炭・鉄から黒鉄を作る（工業の金属。新しい絵）','工',['q_i_steam','b_smelter']),
 ('q_m_alch','N領地',5,'錬金工房','新しい施設（ランクで開く）','新しい施設。錬金術師が魔法も使って、合金（または金）とエーテルからエーテル金属を作る（黒鉄と同じくらいの費用。新しい絵）','魔',['b_well','b_smelter']),
 ('q_i_house','N領地',5,'高層住宅','住居','重金属の骨組みで高く建てる。住める人数 +50%','工',['q_i_smelt','b_barracks']),
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
 ('q_i_can','N防衛',5,'連射砲','大砲の改造','2発続けて撃つ（今の改造を工業へ）','工','g_bigbore'),
 ('q_m_can','N防衛',5,'エーテル弾','大砲の改造','着弾した所でエーテルが弾けて、魔物の硬さを無視して傷を与える','魔','g_bigbore'),
 ('q_i_mor','N防衛',4,'クラスター','迫撃砲の改造','着弾した所に破片が飛び散る（今の改造を工業へ）','工','g_incend'),
 ('q_m_mor','N防衛',4,'凍結弾','迫撃砲の改造','着弾した所の魔物が遅くなる','魔','g_incend'),
 ('q_i_wire','N防衛',4,'鉄条網','柵・石の壁','触れた魔物が傷を受け続け、足が遅くなる','工',['q_i_steam','b_fence']),
 ('q_i_fort','N防衛',5,'重金属の壁','新しい壁（ランクで開く）','耐久は魔金属の壁と同じ。上に置いた防衛施設の耐久 +30%（魔金属の壁は、攻撃した魔物を押し返す）','工',['q_i_smelt','b_wall']),
 ('q_i_hgun','N防衛',5,'重砲','大砲のアップグレード','重金属の砲身。射程・火力が大きい（魔導砲の工業版。新しい絵）','工',['q_i_smelt','g_cannontech']),
 ('q_i_flare','N防衛',6,'照明弾の発射台','新しい施設','夜の広い範囲を照らす（新しい絵）','工',['q_i_gas','b_brazier']),
 ('q_i_bigc','N防衛',7,'大要塞砲','新しい施設','城に据える切り札の大砲。一晩に数回、遠くの群れを吹き飛ばす（新しい絵）','工','q_i_hgun'),
 ('q_i_spg','N部隊',6,'蒸気戦車','新しい兵','蒸気で動く装甲の大砲車。砲兵より硬く、動きながら撃てる（新しい絵）','工',['q_i_steam','g_artillery']),
 ('q_r_heavy','N素材',5,'黒鉄','素材','工業の金属。高炉で、合金・石炭・鉄から作る。工業の壁・門・武器・鎧・道具の上の段に使う','工',None),
]
QT=[
 ('q_policy','N領地',4,'方針を決める（工業か魔法）','ランクⅣ','城がランクⅣになると選ぶ。選ばなかった方針のランクⅣ以上の研究は費用2倍（前の研究も要る）。あとから変えられない','',None),
 ('q_i_steam','N領地',4,'蒸気機関','研究','石炭で動く機械を作れるようになる。工業の入口（製材機・蒸気ポンプ・蒸気船・蒸気砲などが開く）','工',['q_policy','b_coalmine']),
 ('q_i_powder','N防衛',4,'火薬の工場','火薬工房のアップグレード','蒸気で火薬をたくさん作る。火薬を2倍作る（エーテル火薬工房の工業版）','工',['q_i_steam','g_gunpowder']),
 ('q_i_tool4','N領地',5,'重金属の道具','そのほか','生産施設の道具を「重金属」に替えられる（つるはし・斧・農具・銛。魔金属の道具と同じ強さ）','工',['q_i_smelt','g_tool_3']),
 ('q_i_lab','N領地',6,'技術研究所','研究所のアップグレード','魔導研究所の工業版','工',['q_i_smelt','k_lab_2']),
 ('q_i_steamgun','N防衛',4,'銃士の塔','新しい施設','銃兵隊を配置する石の塔。高いところから長い射程で撃ち、空の魔物も撃てる。火薬を使う（新しい絵）','工',['q_policy','g_musket']),
 ('q_i_battery','N防衛',5,'砲台','新しい施設','砲兵隊を配置する石の砲台。地上の群れに遠くから範囲攻撃（空には撃てない）。今の櫓台の代わり（新しい絵）','工',['q_i_steamgun','g_artillery']),
 ('q_i_mine','N防衛',4,'地雷','新しい罠','爆弾罠の上位。埋めるので魔物に見えない。踏んだ魔物の周り5マスを吹き飛ばし、一晩に2回まで爆発する（エーテル爆弾の工業版）','工',['g_bombtrap']),
 ('q_i_gas','N防衛',4,'ガス灯','篝火のアップグレード','石炭を蒸し焼きにして出るガスで灯す。照らす範囲 +8マス。石炭を少し使う（蒼い炎の工業版）','工',['q_i_steam','b_brazier']),
 ('q_i_trap','N防衛',5,'トラバサミ','新しい罠','踏んだ魔物を5秒つかんで動けなくする。大きな魔物にも効く（重金属。重力の罠の工業版）','工',['q_i_mine','q_i_smelt']),
 ('q_i_gate','N防衛',5,'重金属の門','門のアップグレード','魔金属の門の工業版','工',['q_i_smelt','k_gate_2']),
 ('q_i_mg3','N防衛',5,'重金属の大弩','バリスタのアップグレード','魔金属の大弩の工業版','工',['q_i_smelt','k_mg_2']),
 ('q_i_bas','N防衛',5,'重金属の櫓台','櫓台のアップグレード','魔金属の櫓台の工業版','工',['q_i_smelt','b_bastion']),
 ('q_i_out','N防衛',5,'重金属の前哨砦','前哨砦のアップグレード','魔金属の前哨砦の工業版','工',['q_i_smelt','k_outpost_1']),
 ('q_i_mor3','N防衛',5,'重金属の迫撃砲','迫撃砲のアップグレード','魔金属の迫撃砲の工業版','工',['q_i_smelt','g_mortar']),
 ('q_i_hisou','N防衛',5,'重金属の風船爆弾','風船爆弾のアップグレード','爆発の範囲 +50%（エーテル風船の工業版）','工',['q_i_smelt','g_hisousha']),
 ('q_i_coat','N部隊',4,'鉄板入りの外套','ローブを替える','弓兵・砲兵・魔術師の守りを上げる（エーテルローブの工業版）','工',['q_i_steam','e_r_1']),
 ('q_i_arm','N部隊',5,'重金属の鎧','鎧を替える','魔金属の鎧の工業版','工',['q_i_smelt','e_a_2']),
 ('q_i_wpn','N部隊',5,'重金属の武器','武器を替える','魔金属の武器の工業版','工',['q_i_smelt','e_w_1']),
]
QT+=[
 ('q_i_mech','N部隊',5,'蒸気機兵','新しい兵','人が乗って動かす蒸気の鎧。とても硬く力が強い壁役。石炭を使う（新しい絵）','工',['q_i_steam','g_heavyinf']),
 ('q_i_airship','N部隊',7,'爆撃飛行船','新しい兵','空を飛んで、群れの上から爆弾を落とす。火薬を使う（新しい絵）','工',['q_i_spg','g_hisousha']),
 ('q_i_core1','N領地',4,'魔核のボイラー','研究','蒸気の機械の燃料に魔核も使える。魔核1で石炭5の代わり（石炭が足りないとき）','工',['q_i_steam','b_hq']),
 ('q_i_core2','N防衛',5,'魔核の砲弾','研究','大砲・迫撃砲・砲台の弾に小さな魔核を込める。火力 +30%。1発ごとに小さな魔核を少し使う','工',['g_cannontech']),
 ('q_i_core3','N領地',6,'魔核の動力炉','新しい施設','魔核を燃やして、周りの機械を動かす。まわり8マスの施設は石炭を使わない。毎日 魔核を使う（新しい絵）','工',['q_i_core1']),
 ('q_m_core1','N部隊',4,'魔核の宝珠','研究','魔術師の杖に小さな魔核をはめる。エーテルが足りないとき、小さな魔核でも魔法を撃てる','魔',['g_magic']),
 ('q_m_core2','N防衛',5,'魔核の守り石','研究','防衛施設に魔核をはめる。その夜に壊されても、一度だけ耐久の半分で立ち直る（魔核1）','魔',['b_well']),
 ('q_m_core3','N部隊',7,'影の召喚','研究','巨大魔核1を使って、倒したボスの影を一晩だけ味方として呼ぶ','魔',['g_magic']),
]
QA+=QT
ids2={c['id'] for c in cards}|{q[0] for q in QA}
for (id,cat,r,n,tg,e,ln,pre) in QA:
  P=pre if isinstance(pre,list) else ([pre] if pre else [])
  cards.append(dict(id=id,cat=cat,r=r,n=n,mx=1,pre=[p for p in P if p in ids2],c='',tt=0,e=e,kc=False,ln=ln,un=[],mv='',lv=False,prop='案',tg=tg,art=1 if '新しい絵' in e else 0))
# ── 工業と魔法のツリー（2026-11-20）──────────────────────────────
# 方針はランクⅣで選ぶので、ランクⅠ〜Ⅲは共通。ランクⅣ以上を工業・魔法に分ける。
# 工業の柱：蒸気機関（Ⅳ）→ 高炉で重金属（Ⅴ）。生産の改良は「石炭で動く機械」で大きく増やす。
# 魔法の柱：エーテル採掘（Ⅳ。ランクⅡから移す）→ 魔金属を作れる精錬所（Ⅴ）。生産の改良は少し増やして、別のよいことが付く。
# 聖銀・竜晶は共通の素材。使い方（どの施設の段か）で分ける。
byid={c['id']:c for c in cards}
for k in ['q_m_smelt','k_smelter_1','b_bastion','k_bastion_1','q_i_bas']:   # 櫓台はやめる（砲台に）          # 「魔金属も作れる精錬所」と同じなので消す
  if k in byid:cards.remove(byid.pop(k))
LN={}
for k in ['b_well','k_smelter_1','g_tool_4','k_powder_1','k_lab_3','k_brazier_2',
          'b_wall3','k_gate_3','k_mg_3','k_bastion_1','k_outpost_2','k_mortar_1','k_cannon_1','k_hisou_1',
          'k_barrier_1','k_magetower_1','k_magetower_2','k_mray_1','k_tesla_1',
          'e_r_2','e_a_3','e_w_2','k_magic_1']:LN[k]='魔'
for c in cards:
  if c['cat']=='N領地' and c['id'].startswith('k_') and c['id'].endswith('_4') and '魔金属' in c['n']:LN[c['id']]='魔'   # 魔金属の道具の段
  if c['id'].startswith('k_well_'):LN[c['id']]='魔'
for k in ['k_harpoon_1']:LN[k]='工'
for k,v in LN.items():
  if k in byid:byid[k]['ln']=v
def addpre(k,*P):
  if k in byid:byid[k]['pre']=byid[k]['pre']+[p for p in P if p in byid and p not in byid[k]['pre']]
def sete(k,e):
  if k in byid:byid[k]['e']=e
# エーテル採掘所：ランクⅡ→Ⅳ（魔法の柱）
if 'b_well' in byid:
  w=byid['b_well'];w['r']=4;w['tg']='研究';w['e']='「エーテル採掘所」を建てられる（ランクⅡから移す。魔法を選ぶと開く）。エーテルを使う研究の入口';w['pre']=['q_policy']
for c in cards:
  if c['id'].startswith('k_well_') and c['r']<4:c['r']=4
addpre('g_tool_4','q_m_alch');addpre('k_powder_1','b_well')
for k in ['q_m_miner','q_m_quarry','q_m_iron','q_m_farm','q_m_fish','q_m_well']:addpre(k,'b_well')
addpre('q_m_house','q_m_alch')
# 共通の段（聖銀・竜晶）は、工業・魔法どちらの前の段からでも上がれる
addpre('g_tool_5','q_i_tool4');sete('g_tool_5',(byid.get('g_tool_5') or {}).get('e','')+'（前の段は魔金属か重金属の道具のどちらか）')
if 'b_mithmine' in byid:sete('b_mithmine','新しい施設。城のランクが上がるとすぐ建てられる。魔金属か重金属のつるはしで建つ')
addpre('k_mg_4','q_i_mg3');addpre('k_gate_4','q_i_gate');addpre('b_wall5','q_i_fort');addpre('k_cannon_2','q_i_hgun')
addpre('e_a_4','q_i_arm');addpre('e_w_3','q_i_wpn');addpre('e_r_3','q_i_coat')
for k in ['g_barrierst','g_teslat','g_gravityt','g_mrayt','g_dbreatht','g_meteort','g_magic','g_aebombt']:addpre(k,'b_well')   # 魔法の施設・兵はエーテル採掘から
addpre('g_harpoont','q_i_smelt');addpre('g_artillery','q_i_steam')   # 工業の施設・兵は蒸気機関・高炉から
# カードの種類（2026-11-20）：研究で取るもの／城のランクで開くもの を見分ける
def kd(c):
  tg=c.get('tg') or '';p=c.get('prop')
  if c['cat']=='N素材' or tg=='素材':return 'mat'
  if tg=='ランクⅣ':return 'pol'
  if p=='新':return {'ランクで開く':'rank','はじめから':'start','改造':'mod'}.get(tg,'res')
  if tg.endswith('改造'):return 'opt'
  if 'アップグレード' in tg or '替える' in tg or 'ランクで開く' in tg:return 'rank'
  return 'res'
for c in cards:c['kd']=kd(c)
if 'k_smelter_2' in byid:byid['k_smelter_2']['pre']=['b_smelter']
# ランクⅤの工業の道具の段（魔金属の道具の段の工業版。2026-11-20）
for c in list(cards):
  i=c['id']
  if c['cat']=='N領地' and i.startswith('k_') and i.endswith('_4') and '魔金属' in c['n'] and not i.startswith('k_well'):
    fac=i[2:-2];nid='q_i_t_'+fac
    cards.append(dict(c,id=nid,n=c['n'].replace('魔金属','重金属'),pre=[p for p in [c['pre'][0] if c['pre'] else None,'q_i_tool4'] if p],ln='工',prop='案',tg='道具を替える',e=c['e'].replace('魔金属','重金属').split('。',1)[-1]+'（すぐ・資材）'))
    byid[nid]=cards[-1]
    addpre('k_'+fac+'_5',nid)
# 魔金属 → エーテル金属、重金属 → 黒鉄（2026-11-20）
for c in cards:
  for k in ('n','e','tg'):
    if isinstance(c.get(k),str):c[k]=c[k].replace('魔金属','エーテル金属').replace('重金属','黒鉄')
NI=json.load(open('newicons.json'));IC.update(NI)
if 'res_mmetal' in byid:byid['res_mmetal']['e']='合金（または金）とエーテルから、錬金工房で作る（魔法の金属。黒鉄と同じくらいの費用）'
if 'q_r_heavy' in byid:byid['q_r_heavy']['ic']='r.heavy'
d.setdefault('RESN',{})['mmetal']='エーテル金属';d['RESN']['heavy']='黒鉄'
for c in cards:c['kd']=kd(c)
d['T']+=cards
RM=d.get('RANKMAT') or {}
if 'heavy' not in RM.get('5',[]):RM.setdefault('5',[]).append('heavy')
if 'elec' in RM.get('2',[]):RM['2']=[x for x in RM['2'] if x!='elec'];RM.setdefault('4',[]).append('elec')
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
