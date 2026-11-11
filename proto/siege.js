// ===== 攻城戦（試作）：駐留地への夜襲を、別の戦場で戦う =====
// 試作版だけで読み込む（tools/mkproto.py が proto/index.html に <script src="siege.js"> を足す）。本番の index.html には入らない。
// 流れ：編成（何回目の襲撃の駐留地か・陣の形・部隊を自由に選ぶ）→ 配置（陣のまわりに置く）→ 戦闘（夜明けまで・リアルタイム）→ 結果
// 夜襲なので、陣の魔物は「その駐留地にいる数の3割」。ほかはテントで眠っている。見張りに見つかるまで陣は寝ている。
// 結果は「勝ち負け」ではなく、敵へのダメージ（倒した魔物と、焼いたテントの割合）で決まる。
// ゲーム本体の SPR（ドット絵）・E（魔物の数値）・genWave（襲撃の中身）・se（効果音）を借りて使う。
(function(){
'use strict';
const W=1680,H=980,CX=840,CY=490;                // 戦場の大きさ。敵の陣はまん中
const NIGHT_SEC=180;
const MOVE_SC=0.7;                               // 動きの速さ（敵も味方も同じだけ掛ける）。陣の大きさに対して速すぎたので
const FOE_SPD=1;                                 // 魔物の足の速さ（本編と同じ。攻めと守りで魔物の強さは変えない）                             // 夜明けまでの時間（戦いの時間の上限）
const AWAKE_SHARE=0.3;                           // 陣で起きている（戦いに出てくる）のは、駐留している魔物の3割
// こちらの部隊（攻め）。m：人数、hp：1人の体力、dmg：1人の1回の攻撃、rate：攻撃の間隔（秒）、rng：射程、spd：速さ、bld：建物へのダメージ倍率
const SU={
  sword: {n:'兵士',  spr:'pawn',   m:5,hp:40, dmg:8, rate:0.8,rng:16, spd:42,bld:1,  role:'melee', d:'いちばん近い魔物・建物を狙う'},
  heavy: {n:'重装歩兵',spr:'heavy',m:4,hp:150,dmg:7, rate:1.0,rng:16, spd:30,bld:0.8,role:'shield',d:'重い鎧の歩兵。体力が高く、近くの魔物を引きつける。まわり48の味方をかばう（矢・物見櫓・岩のダメージ−35%）＝本編の研究「盾陣」'},
  archer:{n:'弓兵',  spr:'archer', m:5,hp:24, dmg:6, rate:1.1,rng:130,spd:38,bld:0.5,role:'ranged',d:'いちばん近い相手を撃つ。柵の向こうにも届く。空の魔物を撃てる'},
  mage:  {n:'魔術師',spr:'wizard', m:3,hp:30, dmg:20,rate:1.6,rng:140,spd:30,bld:0.6,role:'ranged',magic:true,splash:30,d:'いちばん近い相手に魔法の弾（まわりにも当たる）。空の魔物も撃てる。打たれ弱い'},
  cav:   {n:'騎兵',  spr:'rider',  m:3,hp:70, dmg:11,rate:0.9,rng:16, spd:72,bld:0.8,role:'cav',   d:'足が速い。いちばん近い相手を狙う'},
  eng:   {n:'工兵',  spr:'farmer', m:4,hp:34, dmg:6, rate:0.9,rng:16, spd:38,bld:5,  role:'eng',   d:'物見櫓・岩投げオーガを狙うのが得意。物見櫓や道をふさぐ柵・門は爆薬で吹き飛ばす（14秒ごと）。破城槌・投石機を修理する。近くの罠を外す'},
  drake: {n:'竜騎兵',spr:'dragon', m:2,hp:120,dmg:14,rate:1.3,rng:70, spd:62,bld:1.5,role:'drake',fly:true,splash:22,tentMul:2.5,d:'空を飛んで柵を越える。テント・小屋・巣を狙うのが得意（×2.5）。火で範囲攻撃。空の魔物とも戦える'},
  gun:   {n:'砲兵',  spr:'cannoneer',m:3,hp:30,dmg:20,rate:2.4,rng:200,minR:40,spd:30,bld:2,role:'gun',splash:26,d:'大砲で遠くから撃つ（範囲）。物見櫓・岩投げオーガを狙うのが得意。近づかれると弱い'},
  ram:   {n:'破城槌',draw:'ram',   m:1,hp:900,dmg:70,rate:1.6,rng:20, spd:44,bld:3,  role:'ram',isBld:true,carry:2,d:'大将のテントへまっすぐ進む。途中の柵・門・建物は打ち破る。壊れるか大将のテントに着くと兵士2部隊が出る（建物に強い魔物に弱い）'},
  cat:   {n:'移動式投石機',draw:'cat',m:1,hp:320,dmg:55,rate:3.2,rng:270,minR:60,spd:16,bld:2.5,role:'cat',isBld:true,splash:34,d:'とても遅い。遠くから撃つ（まわりにも当たる）。物見櫓・岩投げオーガを狙うのが得意'},
};
const UNIT_SPD=1.25;   // こちらの部隊の足の速さ（上の数字に掛ける）。魔物（ゴブリン40）より少し速く
for(const k in SU)SU[k].spd=Math.round(SU[k].spd*UNIT_SPD);
// ランク＝本編の研究のランクⅠ〜Ⅲ（城Lv2でⅡ・Lv3でⅢ）。育成の目安として表示するだけ。魔物が出てくるのは襲撃の回数で決まる（genWave）
const RN=['','Ⅰ','Ⅱ','Ⅲ'];
const FOE_RANK={swarm:1,charger:1,harpy:1,troll:2,grappler:2,spitter:2,redcap:2,gobarcher:2,wolf:2,heavy:3,wyvern:3,king:3,tiger:3,mammoth:3};
const UNIT_RANK={sword:1,archer:1,eng:1,heavy:2,cav:2,mage:2,gun:2,cat:2,ram:3,drake:3};
const DEF_FROM={wolf:1,tower:1,drum:2,rock:7};   // 陣の守りの魔物が出てくる襲撃
const ORDER=['sword','heavy','archer','mage','cav','drake','gun','eng','ram','cat'];
// 陣の形。b：柵（外側から）。circle は半径 r、rect は半幅 a・半高 b。gates：門の位置（circle は角度、rect は 'l','r','t','b'）
const CAMP_SC=1.2;   // 陣の大きさ（下の数字に掛ける）
const LAYOUTS={
  ring:  {n:'丸い陣',   b:[{t:'circle',r:170,gates:[180,0]}],towers:[{r:128,n:4}],tents:{r:80,n:5}},
  square:{n:'四角い陣', b:[{t:'rect',a:200,b:150,gates:['l','r','b']}],towers:'corners',tents:{grid:true,n:6}},
  double:{n:'二重の陣', b:[{t:'circle',r:225,gates:[180,0,90,270]},{t:'circle',r:110,gates:[135,315]}],towers:[{r:178,n:6},{r:70,n:3}],tents:{r:160,n:7}},
  long:  {n:'横長の陣', b:[{t:'rect',a:270,b:115,gates:['l','r','t']}],towers:'corners',tents:{row:true,n:7}},
};
for(const L of Object.values(LAYOUTS)){for(const bd of L.b)for(const k of ['r','a','b'])if(bd[k])bd[k]=Math.round(bd[k]*CAMP_SC);if(Array.isArray(L.towers))for(const t of L.towers)t.r=Math.round(t.r*CAMP_SC);if(L.tents.r)L.tents.r=Math.round(L.tents.r*CAMP_SC);}
let G=null,cv=null,cx=null,raf=0,last=0,nid=1;
const $=id=>document.getElementById(id);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=o=>o&&o.hp>0;
const isTent=b=>b.kind==='tent'||b.kind==='chief'||b.kind==='hut'||b.kind==='nest';   // 魔物が眠っている建物（テント・小屋・竜の巣・大将のテント）
const FLY=['harpy','wyvern'];   // 空を飛ぶ魔物は竜の巣で眠る。地上の近接の部隊（兵士・重装歩兵・騎兵・工兵・破城槌）は手が出せない
const flyF=f=>!!(E[f.k]&&E[f.k].fly);
const hitsAir=d=>d.role==='ranged'||d.role==='drake';   // 空の魔物を攻撃できる部隊：弓兵・魔術師・竜騎兵
function nearF(u,max,filt){const d=SU[u.t];return nearest(u,G.foes,max,f=>(hitsAir(d)||!flyF(f))&&(!filt||filt(f)));}
const BIG=['grappler','troll','heavy','mammoth','tiger','wolf'];   // 大きな魔物・獣は小屋で眠る（ほかはテント）
function mem(u){const d=SU[u.t];return d.m>1?Math.max(0,Math.ceil(u.hp/(d.hp*(u.hpMul||1))-1e-6)):(u.hp>0?1:0);}
function sfx(n){try{if(typeof se==='function')se(n);}catch(e){}}
const ename=k=>(typeof E!=='undefined'&&E[k]?E[k].name:k);

// ---------- 駐留している魔物：第N襲撃のうち、いちばん多い方角のぶん ----------
function stationed(n){let q=[];
  try{if(typeof genWave==='function'&&typeof S!=='undefined'&&S&&S.sideOrder){const sv={open:S.open&&Object.assign({},S.open),wave:S.wave};const w=genWave(n);S.open=sv.open;q=w.q||[];}}catch(e){q=[];}
  const by={};for(const e of q){(by[e.side]=by[e.side]||[]).push(e);}const side=Object.keys(by).sort((a,b)=>by[b].length-by[a].length)[0];
  const c={};for(const e of (side?by[side]:[]))if(E[e.type]&&!E[e.type].boss)c[e.type]=(c[e.type]||0)+1;
  if(!Object.keys(c).length)Object.assign(c,{swarm:10+n*8,gobarcher:2+n,grappler:Math.max(0,n-2)});
  return c;}
function awakeOf(c){const a={};for(const k in c){const v=Math.round(c[k]*AWAKE_SHARE);if(v>0)a[k]=v;}return a;}
const total=o=>Object.values(o).reduce((s,v)=>s+v,0);

// ---------- 英雄：ゲーム本体の英雄（S.cmds）を部隊に入れる。能力で部隊が強くなり、スキルが発動する ----------
const HFIT={'歩兵':['sword','heavy'],'弓兵':['archer'],'騎兵':['cav'],'竜騎':['drake'],'魔導':['mage'],'守備':['gun','cat','ram'],'内政':['eng']};   // 適任の部隊（ほかの部隊に入れると効果は3割）
const HSPR={'歩兵':'h_inf','弓兵':'h_arch','工兵':'h_eng','騎兵':'h_cav','魔導':'h_mage','内政':'h_admin','守備':'h_guard','竜騎':'h_drake'};
const TU=28;   // 1マス
let DEMO_H=null;   // 試作用の英雄（ページを開いている間は同じ）
function heroList(){if(G.heroL)return G.heroL;let L=[];const ok=c=>c&&c.alive&&c.spec!=='内政';
  try{if(typeof S!=='undefined'&&S&&S.cmds&&S.turn>1)L=S.cmds.filter(ok);}catch(e){}   // 遊んでいる途中なら今のゲームの英雄
  if(L.filter(c=>c.spec!=='守備').length===0){try{const sv=JSON.parse(localStorage.getItem(typeof SAVE_KEY!=='undefined'?SAVE_KEY:'')||'null');const L2=sv&&sv.S&&sv.S.cmds?sv.S.cmds.filter(ok):[];if(L2.length>L.length)L=L2;}catch(e){}}   // タイトルからなら、セーブの英雄
  if(L.filter(c=>c.spec!=='守備').length)return G.heroL=L;
  if(!DEMO_H&&typeof makeCmd==='function'){try{DEMO_H=['歩兵','弓兵','騎兵','竜騎','魔導','守備'].map(sp=>Object.assign(makeCmd(sp,3),{demo:true}));}catch(e){DEMO_H=[];}}
  return DEMO_H||[];}
function hSkill(c){try{return typeof heroSkills==='function'?heroSkills(c)[0]:null;}catch(e){return null;}}
function hColor(c){return typeof SPECS!=='undefined'&&SPECS[c.spec]?SPECS[c.spec].color:'#f2b33d';}
function heroIcon(c,sz){const sp=typeof SPR!=='undefined'&&SPR.units&&SPR.units[HSPR[c.spec]];if(!sp||!sp.img||!sp.img.walk)return '';const cv0=document.createElement('canvas');cv0.width=cv0.height=sz;const g=cv0.getContext('2d');g.imageSmoothingEnabled=false;const im=sp.img.walk[0]||sp.img.walk;try{g.drawImage(im,0,0,sz,sz);}catch(e){}return `<img src="${cv0.toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated;vertical-align:middle">`;}
function attachHero(u){const c=heroList().find(h=>G.hsel&&G.hsel[h.id]===u.t&&!(G.hUsed||(G.hUsed=new Set())).has(h.id));if(!c)return;G.hUsed.add(c.id);
  const m=(HFIT[c.spec]||[]).includes(u.t)?1:0.3,L=(typeof HERO_CORE!=='undefined'?HERO_CORE[Math.min(typeof HERO_MAX!=='undefined'?HERO_MAX:5,c.lv||1)-1]:0.5);
  u.hero=c;u.hm=m;u.dmul=1+m*(L*0.8+(c.atk||0)*0.01);u.hpMul=1+m*(L*0.5+(c.def||0)*0.01);u.red=Math.min(0.4,m*(0.1+(c.def||0)*0.01));u.hp*=u.hpMul;u.maxhp*=u.hpMul;
  u.sk=hSkill(c);u.skT=u.sk&&u.sk.cd?u.sk.cd*0.4:0;u.skN=0;}

// ---------- 画面（編成） ----------
function openSiege(){
  if(typeof S!=='undefined'&&S&&S.overlay&&typeof closeOverlay==='function')closeOverlay();
  G={phase:'setup',pool:{sword:4,heavy:2,archer:3,mage:1,cav:1,drake:1,gun:1,eng:1,ram:1,cat:1},raid:3,layout:'auto',speed:1,paused:false};
  try{const v=JSON.parse(localStorage.getItem('nd_siege')||'null');if(v){if(v.pool){if(v.pool.shield!=null&&v.pool.heavy==null)v.pool.heavy=v.pool.shield;for(const k of ORDER)if(v.pool[k]!=null)G.pool[k]=v.pool[k];}   /* 前の「盾兵」は重装歩兵として引き継ぐ */if(v.raid)G.raid=v.raid;if(v.layout)G.layout=v.layout;if(v.hsel)G.hsel=v.hsel;}}catch(e){}   // 前の編成を覚えておく
  let root=$('siege');if(!root){root=document.createElement('div');root.id='siege';document.body.appendChild(root);}
  root.style.display='flex';document.body.classList.add('siegeOn');renderSetup();
}
function saveSetup(){try{localStorage.setItem('nd_siege',JSON.stringify({pool:G.start||G.pool,raid:G.raid,layout:G.layout,hsel:G.hsel||{}}));}catch(e){}}
function renderSetup(){const root=$('siege');saveSetup();const st=stationed(G.raid),aw=awakeOf(st);G.st=st;G.aw=aw;
  root.innerHTML=`<div class="sgSetup"><h2>攻城戦（試作）<small>駐留地への夜襲</small></h2>
    <div class="sgRow"><b>どの駐留地</b><span class="sgRaid"><button data-raid="-1">−</button><b>第${G.raid}襲撃</b><button data-raid="1">＋</button></span>
      <small class="muted">駐留している魔物 ${total(st)}体（${Object.entries(st).map(([k,v])=>ename(k)+v).join('・')}）<br>陣の守り：${['物見櫓','見張りオオカミ'].concat(G.raid>=DEF_FROM.drum?['戦太鼓のゴブリン']:[]).concat(G.raid>=DEF_FROM.rock?['岩投げオーガ']:[]).join('・')}<br>夜襲なので、起きて出てくるのは3割の <b style="color:#ff8a6a">${total(aw)}体</b>。残りはテントで眠っている</small></div>
    <div class="sgRow"><b>陣の形</b>${['auto'].concat(Object.keys(LAYOUTS)).map(k=>`<button data-lay="${k}" class="${G.layout===k?'on':''}">${k==='auto'?'おまかせ':LAYOUTS[k].n}</button>`).join('')}</div>
    <div class="sgHelp">部隊を自由に選べます（試作なので費用なし）。陣のまわりのどこからでも攻められます。部隊はいちばん近い相手を狙います（得意な相手は優先）。夜明け（${NIGHT_SEC/60}分）まで戦えます。<br>敵へのダメージ＝倒した魔物（起きていた3割）＋焼いたテント（眠っている7割）。</div>
    <div class="sgUnits">${ORDER.map(k=>{const d=SU[k];return `<div class="sgU"><span class="sgI">${unitIcon(k,32)}</span><span class="sgN"><b>${d.n} <span class="sgRk" title="本編の研究ランク（城Lv${UNIT_RANK[k]}で解放）。育成の目安">研究ランク${RN[UNIT_RANK[k]]}</span></b><small>${d.d}</small><small class="muted">${d.m>1?`${d.m}人・`:''}体力${d.hp*d.m}・攻撃${d.dmg*d.m}${d.rng>40?`・射程${d.rng}`:''}</small></span><span class="sgC"><button data-dec="${k}">−</button><b>${G.pool[k]}</b><button data-inc="${k}">＋</button></span></div>`;}).join('')}</div>
    ${(()=>{const HL=heroList();if(!HL.length)return '';G.hsel=G.hsel||{};const opts=k=>`<option value="">連れて行かない</option>`+ORDER.filter(t=>G.pool[t]>0||G.hsel[k]===t).map(t=>`<option value="${t}" ${G.hsel[k]===t?'selected':''}>${SU[t].n}${''}</option>`).join('');
      return `<div class="sgHero"><b>英雄</b><small class="muted">${HL[0].demo?'（セーブに英雄がいないので、試作用の英雄です）':'（本編の英雄。ここでの戦いは本編には影響しません）'}　部隊に入れると、その部隊が強くなりスキルが発動します。適任の部隊に入れると効果が大きい</small>
        ${HL.map(c=>{const k=hSkill(c);const fit=(HFIT[c.spec]||[]).map(t=>SU[t].n).join('・')||'なし（スキルだけ）';return `<div class="sgHR"><span>${heroIcon(c,28)}</span><span class="sgHN"><b style="color:${hColor(c)}">${c.name}</b><small>${c.spec} Lv${c.lv||1}　適任：${fit}</small>${k?`<small title="${k.desc}">スキル「${k.name}」${k.desc}</small>`:''}</span><select data-hero="${c.id}">${opts(c.id)}</select></div>`;}).join('')}</div>`;})()}
    ${(()=>{let L=[];try{L=JSON.parse(localStorage.getItem('nd_siege_log')||'[]');}catch(e){}if(!L.length)return '';const W2={dawn:'夜明け',complete:'壊滅',lose:'全滅',retreat:'撤退'};
      return `<details class="sgLog"><summary>これまでの記録（${L.length}回）</summary><table class="sgLoss"><tr><th>日時</th><th>駐留地</th><th>結果</th><th>ダメージ</th><th>部隊ごとの損耗（兵の残り／出発）</th></tr>${L.map(o=>`<tr><td>${new Date(o.d).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td><td>第${o.raid}襲撃・${LAYOUTS[o.lay]?LAYOUTS[o.lay].n:''}</td><td>${W2[o.why]||o.why} ${Math.floor(o.t/60)}:${String(o.t%60).padStart(2,'0')}</td><td>${o.dmg}%</td><td style="text-align:left">${ORDER.filter(k=>o.loss&&o.loss[k]).map(k=>{const q=o.loss[k];return `${SU[k].n} ${q.m1}/${q.m0}`;}).join('・')}${o.heroes&&o.heroes.length?'<br><small>英雄：'+o.heroes.map(h=>`${h.n}（${SU[h.t]?SU[h.t].n:''}・${h.sk}${h.c}回・残り${h.men}/${h.m0}）`).join('、')+'</small>':''}</td></tr>`).join('')}</table><button id="sgLogClr" class="ghost">記録を消す</button></details>`;})()}
    <div class="sgFoot"><button id="sgBack">やめる（タイトルへ）</button><button id="sgGo" class="primary" ${ORDER.some(k=>G.pool[k]>0)?'':'disabled'}>出撃（配置へ）</button></div></div>`;
  root.querySelectorAll('[data-raid]').forEach(b=>b.onclick=()=>{G.raid=Math.max(1,Math.min(20,G.raid+(+b.dataset.raid)));sfx('click');renderSetup();});
  root.querySelectorAll('[data-lay]').forEach(b=>b.onclick=()=>{G.layout=b.dataset.lay;sfx('click');renderSetup();});
  root.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{G.pool[b.dataset.inc]=Math.min(30,(G.pool[b.dataset.inc]||0)+1);sfx('click');renderSetup();});
  root.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{G.pool[b.dataset.dec]=Math.max(0,(G.pool[b.dataset.dec]||0)-1);sfx('click');renderSetup();});
  root.querySelectorAll('[data-hero]').forEach(el=>el.onchange=()=>{G.hsel[el.dataset.hero]=el.value||undefined;if(!el.value)delete G.hsel[el.dataset.hero];saveSetup();});
  {const c=$('sgLogClr');if(c)c.onclick=()=>{try{localStorage.removeItem('nd_siege_log');}catch(e){}renderSetup();};}
  $('sgBack').onclick=closeSiege;$('sgGo').onclick=startDeploy;
}
function closeSiege(){setTimeout(()=>{try{if(typeof AU!=='undefined'&&AU.ctx)auMusicFor();}catch(e){}},50);cancelAnimationFrame(raf);raf=0;const root=$('siege');if(root){root.style.display='none';root.innerHTML='';}document.body.classList.remove('siegeOn');G=null;if(typeof showTitle==='function')showTitle();}
function unitIcon(k,sz){const d=SU[k];if(d.draw){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.translate(16,18);(d.draw==='ram'?drawRam:drawCat)(g,0,0,1,0);return `<img src="${c.toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated">`;}
  const sp=typeof SPR!=='undefined'&&SPR.units&&SPR.units[d.spr];if(!sp)return '';return `<img src="${sp.img.walk[0].toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated">`;}

// ---------- 地形：大マップの、駐留地がありそうな所を切り出して戦場にする ----------
// 水・山は通れない（地上の部隊は回り込む）。森は足が遅くなり、見張りに見つかりにくい。陣のまわりは切り開いてある
function pickTerrain(){G.mo=null;try{if(typeof terCv==='undefined'||!terCv||typeof S==='undefined'||!S||!S.ter)return;
  let cx0=null,cy0=null;
  if(S.camps&&S.camps.length){const c=S.camps[Math.floor(Math.random()*S.camps.length)];cx0=c.x;cy0=c.y;}
  else if(S.hives&&S.sideOrder){const sd=S.sideOrder[Math.floor(Math.random()*S.sideOrder.length)],h=S.hives[sd],hq=S.blds.find(b=>b.type==='hq');if(h&&hq&&typeof bcx==='function'){const k=0.45;cx0=bcx(h)+(bcx(hq)-bcx(h))*k;cy0=bcy(h)+(bcy(hq)-bcy(h))*k;}}
  if(cx0==null){cx0=terCv.width/2;cy0=terCv.height/2;}
  const ox=Math.max(0,Math.min(terCv.width-W,Math.round(cx0-CX))),oy=Math.max(0,Math.min(terCv.height-H,Math.round(cy0-CY)));
  if(terCv.width<W||terCv.height<H)return;G.mo={x:ox,y:oy};}catch(e){G.mo=null;}}
function tAt(x,y){if(!G.mo||!G.bounds)return 0;if(!farFromCamp(x,y,45))return 0;try{return terAt(x+G.mo.x,y+G.mo.y)||0;}catch(e){return 0;}}
function tBlock(x,y){const t=tAt(x,y);return t===3||t===6||t===9;}
function tForest(x,y){return tAt(x,y)===2;}
// ---------- 柵の形（内か外か・門） ----------
function inside(bd,x,y){const dx=x-CX,dy=y-CY;return bd.t==='circle'?Math.hypot(dx,dy)<bd.r:Math.abs(dx)<bd.a&&Math.abs(dy)<bd.b;}
function layerOf(x,y){let n=0;for(const bd of G.bounds)if(inside(bd,x,y))n++;return n;}
// 柵の大きさの目安（いちばん外の柵から中心まで）
function outerR(){const bd=G.bounds[0];return bd.t==='circle'?bd.r:Math.max(bd.a,bd.b);}
// その点が、いちばん外の柵から外へ m 以上離れているか（部隊を置ける所）
function farFromCamp(x,y,m){const bd=G.bounds[0],dx=Math.abs(x-CX),dy=Math.abs(y-CY);if(bd.t==='circle')return Math.hypot(dx,dy)>bd.r+m;const ox=Math.max(0,dx-bd.a),oy=Math.max(0,dy-bd.b);return Math.hypot(ox,oy)>m;}

// ---------- 戦場をつくる ----------
function buildField(){
  pickTerrain();G.blk=null;G.blkM=null;
  let lk=G.layout;if(lk==='auto'){const n=total(G.aw);lk=n>70?'double':['ring','square','long'][Math.floor(Math.random()*3)];}G.lay=lk;const L=LAYOUTS[lk];
  G.units=[];G.foes=[];G.blds=[];G.shots=[];G.fx=[];G.traps=[];G.sel=new Set();G.t=0;G.alarm=false;G.card=ORDER.find(k=>G.pool[k]>0)||null;G.bounds=[];
  const B=(kind,x,y,r,hp,ex)=>{const b=Object.assign({id:nid++,kind,x,y,r,hp,maxhp:hp,cd:Math.random()},ex||{});G.blds.push(b);return b;};
  // 柵と門
  L.b.forEach((bd0,li)=>{const bd=Object.assign({},bd0,{gateB:[]});G.bounds.push(bd);const php=li?220:170,ghp=li?900:700;
    if(bd.t==='circle'){const ga=bd.gates.map(a=>a*Math.PI/180);const N=Math.round(2*Math.PI*bd.r/14);
      for(let i=0;i<N;i++){const a=i/N*Math.PI*2;if(ga.some(g=>Math.abs(((a-g+Math.PI*3)%(Math.PI*2))-Math.PI)<16/bd.r))continue;B('post',CX+Math.cos(a)*bd.r,CY+Math.sin(a)*bd.r,8,php,{layer:li});}
      for(const g of ga){const gb=B('gate',CX+Math.cos(g)*bd.r,CY+Math.sin(g)*bd.r,13,ghp,{nx:Math.cos(g),ny:Math.sin(g),layer:li});bd.gateB.push(gb);}}
    else{const sides=[['t',0,-1],['b',0,1],['l',-1,0],['r',1,0]];
      for(const [s,sx,sy] of sides){const len=sx?bd.b:bd.a,n=Math.round(len*2/14),hasG=bd.gates.includes(s);
        for(let i=0;i<=n;i++){const tt=-len+i*(len*2/n),x=CX+(sx?sx*bd.a:tt),y=CY+(sy?sy*bd.b:tt);if(hasG&&Math.abs(tt)<16)continue;if(!sx&&(i===0||i===n))continue;B('post',x,y,8,php,{layer:li});}
        if(hasG){const gb=B('gate',CX+sx*bd.a,CY+sy*bd.b,13,ghp,{nx:sx,ny:sy,layer:li});bd.gateB.push(gb);}}}});
  // 物見櫓
  const towers=[];if(L.towers==='corners'){const bd=G.bounds[0];for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]])towers.push([CX+sx*(bd.a-30),CY+sy*(bd.b-30),0]);}
  else L.towers.forEach((t,li)=>{for(let i=0;i<t.n;i++){const a=(i+0.5)/t.n*Math.PI*2;towers.push([CX+Math.cos(a)*t.r,CY+Math.sin(a)*t.r,li]);}});
  // 襲撃が進むほど物見櫓を足す（外側の柵の内側に）
  {const extra=Math.floor(G.raid/3),bd=G.bounds[0];for(let i=0;i<extra;i++){const a=(i+0.25)/Math.max(1,extra)*Math.PI*2+0.6;const r=(bd.t==='circle'?bd.r:Math.min(bd.a,bd.b))-34;towers.push([CX+Math.cos(a)*r*(bd.t==='rect'?bd.a/Math.min(bd.a,bd.b):1)*0.95,CY+Math.sin(a)*r,0]);}}
  for(const [x,y,li] of towers)B('tower',x,y,15,li?520:420,{rng:150,dmg:li?10:8,rate:li?1.0:1.1});
  // 守りの魔物（駐留している魔物とは別。ダメージの計算には入れない）
  // 岩投げオーガ：門の内側に陣取って大きな岩を投げる。破城槌・投石機に強い（襲撃が進むほど増える）
  if(G.raid>=DEF_FROM.rock){const gs=G.bounds[0].gateB,n=Math.min(gs.length,1+Math.floor((G.raid-DEF_FROM.rock)/3));for(let i=0;i<n;i++){const g=gs[i];G.foes.push(mkFoe('grappler',g.x-g.nx*48+g.ny*26,g.y-g.ny*48-g.nx*26,{def:'rock',hp:700,maxhp:700,rng:190,rdmg:34,rrate:2.6}));}}
  // 見張りオオカミ：門の外に鎖でつながれている。近づくと吠えて騒ぎになる（見つける範囲は広いが弱い）
  {const per=G.raid>=6?2:1;for(const g of G.bounds[0].gateB)for(let i=0;i<per;i++){const sd=per>1?(i?16:-16):0;G.foes.push(mkFoe('wolf',g.x+g.nx*34-g.ny*sd,g.y+g.ny*34+g.nx*sd,{def:'wolf'}));}}
  // 戦太鼓のゴブリン：大将のテントのそば。生きている間は、陣の魔物が早く起きて足も速くなる
  if(G.raid>=DEF_FROM.drum)G.foes.push(mkFoe('swarm',CX+46,CY+34,{def:'drum',hp:260,maxhp:260}));
  // 逆茂木：門の外の守り（通れない・壊すまでふさぐ）
  {const n=G.raid>=3?2:0;for(const g of G.bounds[0].gateB)for(let i=0;i<n;i++){const s2=i?1:-1;B('abatis',g.x+g.nx*54+g.ny*22*s2,g.y+g.ny*54-g.nx*22*s2,11,260);}}
  // テント（眠っている魔物）と大将のテント
  B('chief',CX,CY,26,1600);
  const T=L.tents,tp=[];
  if(T.grid){const bd=G.bounds[0];for(let i=0;i<T.n;i++){tp.push([CX+((i%3)-1)*(bd.a*0.55),CY+(i<3?-1:1)*bd.b*0.45]);}}
  else if(T.row){const bd=G.bounds[0];for(let i=0;i<T.n;i++){const k=i<4?i:i-4;const xs=i<4?[-0.75,-0.4,0.4,0.75][k]:[-0.55,0,0.55][k];tp.push([CX+xs*bd.a,CY+(i<4?-0.45:0.5)*bd.b]);}}
  else for(let i=0;i<T.n;i++){const a=i/T.n*Math.PI*2+0.3;tp.push([CX+Math.cos(a)*T.r,CY+Math.sin(a)*T.r]);}
  // 眠っている魔物（7割）を建物に分ける：ゴブリンたちはテント、大きな魔物・獣は小屋、空を飛ぶ魔物は竜の巣。大将のテントは2つ分
  {const sl={};for(const k in G.st){const v=G.st[k]-(G.aw[k]||0);if(v>0)sl[k]=v;}
    const ks=Object.keys(sl),cnt=keys=>keys.reduce((a,k)=>a+sl[k],0);
    let grp=[['tent',ks.filter(k=>!BIG.includes(k)&&!FLY.includes(k)),1,280,16],['hut',ks.filter(k=>BIG.includes(k)),4,460,19],['nest',ks.filter(k=>FLY.includes(k)),3,400,18]]
      .map(([kind,keys,w,hp,r])=>({kind,keys,w,hp,r,cnt:cnt(keys),list:[],slots:1})).filter(g=>g.cnt>0);
    if(!grp.length)grp=[{kind:'tent',keys:[],w:1,hp:280,r:16,cnt:0,list:[],slots:1}];
    const n=tp.length,sw=grp.reduce((a,g)=>a+g.cnt*g.w,0)||1,want=grp.map(g=>g.cnt*g.w/sw*n);   // 建物の数は、数×大きさの割合で（どの種類も1つは）
    for(let left=n-grp.length;left>0;left--){let bi=0,bv=-1e9;grp.forEach((g,j)=>{if(want[j]-g.slots>bv){bv=want[j]-g.slots;bi=j;}});grp[bi].slots++;}
    const rem=grp.map(g=>g.slots);tp.forEach(([x,y])=>{let bi=0,bv=-1;grp.forEach((g,j)=>{const v=rem[j]/g.slots;if(rem[j]>0&&v>bv){bv=v;bi=j;}});rem[bi]--;const g=grp[bi];g.list.push(B(g.kind,x,y,g.r,g.hp,{sl:{}}));});   // 種類が混ざるように並べる
    const ch=chief();ch.sl={};const hasT=grp.some(g=>g.kind==='tent');
    for(const g of grp){const list=g.kind==='tent'||(!hasT&&g===grp[0])?[ch,ch,...g.list]:g.list;let i=0;for(const k of g.keys)for(let m=0;m<sl[k];m++){const b=list[i++%list.length];b.sl[k]=(b.sl[k]||0)+1;}}
    for(const b of G.blds)if(b.sl)b.sl0=total(b.sl);}
  // 罠：いちばん外の柵の外側、門の前を中心に
  const tpg=3+Math.floor(G.raid/3);for(const gb of G.bounds[0].gateB)for(let i=0;i<tpg;i++){const px=-gb.ny,py=gb.nx;G.traps.push({x:gb.x+gb.nx*(30+(i%4)*14)+px*((i%2)?14:-14)*(1+Math.floor(i/4)),y:gb.y+gb.ny*(30+(i%4)*14)+py*((i%2)?14:-14)*(1+Math.floor(i/4)),hp:1});}
  // 魔物：起きている3割。1割ほどは柵の外の見張り（巡回）、ほかは陣の中（夜襲なので寝ぼけている＝見つかるまで動かない）
  const aw=Object.entries(G.aw).flatMap(([k,n])=>Array(n).fill(k));const nSent=Math.max(2,Math.round(aw.length*0.12));
  const sentK=aw.filter(k=>k==='swarm'||k==='gobarcher'||k==='charger');
  for(let i=0;i<nSent&&sentK.length;i++){const k=sentK.splice(Math.floor(Math.random()*sentK.length),1)[0];aw.splice(aw.indexOf(k),1);
    let a=i/nSent*Math.PI*2+Math.random()*0.4;const r=outerR()+45;for(let t=0;t<24&&tBlock(CX+Math.cos(a)*r*(G.bounds[0].t==='rect'?1.25:1),CY+Math.sin(a)*r*(G.bounds[0].t==='rect'?0.85:1));t++)a+=0.13;   // 山の上には置かない
    G.foes.push(mkFoe(k,CX+Math.cos(a)*r*(G.bounds[0].t==='rect'?1.25:1),CY+Math.sin(a)*r*(G.bounds[0].t==='rect'?0.85:1),{sentry:true,ang:a,pr:r,dir:Math.random()<0.5?1:-1}));}
  const inner=G.bounds[G.bounds.length-1];
  for(const k of aw){let x,y,tries=0;do{const a=Math.random()*Math.PI*2,r=30+Math.random()*(outerR()-50);x=CX+Math.cos(a)*r*(G.bounds[0].t==='rect'?G.bounds[0].a/outerR():1);y=CY+Math.sin(a)*r*(G.bounds[0].t==='rect'?G.bounds[0].b/outerR():1);tries++;}while(!inside(G.bounds[0],x,y)&&tries<20);G.foes.push(mkFoe(k,x,y));}
  G.tentTotal=G.blds.filter(b=>isTent(b)).reduce((a,b)=>a+(b.kind==='chief'?2:1),0);
  G.sleeping=total(G.st)-total(G.aw);
  G.ground=null;
}
function mkFoe(k,x,y,ex){const d=E[k];return Object.assign({id:nid++,k,x,y,px:x,py:y,hp:d.hp,maxhp:d.hp,cd:Math.random(),face:-1,tg:null,walk:Math.random()*4},ex||{});}
function startDeploy(){if(!ORDER.some(k=>G.pool[k]>0))return;G.hUsed=new Set();if(!G.start)G.start=Object.assign({},G.pool);G.phase='deploy';buildField();renderField();loopStart();
  msg('夜襲です。陣は寝静まっている。見張りや物見櫓に見つかると、陣の魔物が起きてくる（ホイール・ピンチ・＋－で拡大、右ドラッグ・2本指で移動）');}
function spawnSquad(k,x,y,noHero){const d=SU[k];const u={id:nid++,t:k,x,y,hp:d.hp*d.m,maxhp:d.hp*d.m,cd:Math.random()*d.rate,face:x<CX?1:-1,tg:null,tx:null,ty:null,hold:false,walk:Math.random()*4,spawned:false};G.units.push(u);if(!noHero)attachHero(u);return u;}

// ---------- 戦場の画面 ----------
function renderField(){const root=$('siege');
  root.innerHTML=`<div class="sgTop"><b>夜襲（試作）</b><span class="sgProg" title="敵へのダメージ（倒した魔物＋焼いたテント）"><small>敵へのダメージ</small><i><b id="sgPB"></b></i><em id="sgPT">0%</em></span><span id="sgStat"></span><span class="grow"></span>
      <button id="sgZo" title="縮小">－</button><button id="sgZi" title="拡大（ホイール・ピンチでも）">＋</button><button id="sgSpd">速度 ×${G.speed}</button><button id="sgPause">${G.paused?'再開':'一時停止'}</button><button id="sgQuit">撤退</button></div>
    <canvas id="sgCv"></canvas>
    <div class="sgMsg" id="sgMsg"></div>
    <div class="sgBot"><div class="sgCards" id="sgCards"></div><div class="sgCmd" id="sgCmd"></div></div>`;
  cv=$('sgCv');cx=cv.getContext('2d');fit();addEventListener('resize',fit);
  $('sgZi').onclick=()=>{zoomAt(cv.width/2,cv.height/2,1.4);};$('sgZo').onclick=()=>{zoomAt(cv.width/2,cv.height/2,1/1.4);};
  $('sgSpd').onclick=()=>{G.speed=G.speed>=3?1:G.speed+1;$('sgSpd').textContent='速度 ×'+G.speed;sfx('click');};
  $('sgPause').onclick=()=>{G.paused=!G.paused;$('sgPause').textContent=G.paused?'再開':'一時停止';sfx('click');};
  $('sgQuit').onclick=()=>{if(G.phase==='end')return;if(G.phase==='deploy'||G.retreat){endBattle('retreat');return;}startRetreat();};   // 1回目：撤退を始める。2回目：逃げ切れていない部隊を置いて終える
  bindInput();renderCards();renderCmd();
}
function fit(){if(!cv)return;const r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);cam();G.dark=null;}
// カメラ：拡大（1〜4倍）と見ている場所。ホイール・ピンチで拡大、右／中ボタンのドラッグ・2本指・矢印キーで動かす
function cam(){if(!cv)return;const kb=Math.min(cv.width/W,cv.height/H);G.zoom=Math.max(1,Math.min(4,G.zoom||1));G.k=kb*G.zoom;const vw=cv.width/G.k,vh=cv.height/G.k;
  if(G.camX==null){G.camX=CX;G.camY=CY;}G.camX=vw>=W?W/2:Math.max(vw/2,Math.min(W-vw/2,G.camX));G.camY=vh>=H?H/2:Math.max(vh/2,Math.min(H-vh/2,G.camY));
  G.ox=cv.width/2-G.camX*G.k;G.oy=cv.height/2-G.camY*G.k;}
function zoomAt(sx,sy,f){const wx=(sx-G.ox)/G.k,wy=(sy-G.oy)/G.k;G.zoom=Math.max(1,Math.min(4,(G.zoom||1)*f));const k=Math.min(cv.width/W,cv.height/H)*G.zoom;G.camX=wx-(sx-cv.width/2)/k;G.camY=wy-(sy-cv.height/2)/k;cam();}
function cvPt(ev){const r=cv.getBoundingClientRect(),dpr=cv.width/r.width;return [(ev.clientX-r.left)*dpr,(ev.clientY-r.top)*dpr];}
function renderCards(){const el=$('sgCards');if(!el)return;
  el.innerHTML=ORDER.filter(k=>G.pool[k]>0||G.units.some(u=>u.t===k)).map((k,i)=>`<button data-card="${k}" class="${G.card===k?'on':''}" ${G.pool[k]?'':'disabled'} title="数字キー ${(i+1)%10}"><i class="sgKey">${i<10?(i+1)%10:''}</i>${unitIcon(k,22)}<span>${SU[k].n}</span><b>${G.pool[k]}</b></button>`).join('')+
    (G.phase==='deploy'?`<button id="sgAll" class="ghost">残りを全部置く</button><button id="sgFight" class="primary" ${G.units.length?'':'disabled'}>夜襲開始</button>`:'');
  el.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{G.card=G.card===b.dataset.card?null:b.dataset.card;sfx('click');renderCards();msg(G.card?`${SU[G.card].n}：陣のまわりの明るい所をタップして置く`:'');});
  const a=$('sgAll');if(a)a.onclick=()=>{const rest=[];for(const k of ORDER)for(let j=0;j<G.pool[k];j++)rest.push(k);
    rest.forEach((k,i)=>{const side=i%4,a0=[Math.PI,-Math.PI/2,0,Math.PI/2][side]+((Math.floor(i/4)%5)-2)*0.12;let r=outerR()+110+Math.floor(i/20)*26;let x=CX+Math.cos(a0)*r*1.3,y=CY+Math.sin(a0)*r;
      x=Math.max(20,Math.min(W-20,x));y=Math.max(20,Math.min(H-20,y));
      if(!canDeploy({x,y})){let best=null,bd=1e9;for(let yy=20;yy<H-10;yy+=12)for(let xx=20;xx<W-10;xx+=12){if(!canDeploy({x:xx,y:yy})||G.units.some(o=>Math.hypot(o.x-xx,o.y-yy)<16))continue;const dd=Math.hypot(xx-x,yy-y);if(dd<bd){bd=dd;best=[xx,yy];}}if(best){x=best[0];y=best[1];}}   // 置けない所なら、いちばん近い置ける所へ
      spawnSquad(k,x,y);G.pool[k]--;});G.card=null;sfx('build');renderCards();};
  const f=$('sgFight');if(f)f.onclick=()=>{G.phase='battle';sfx('turn');msg('夜襲開始！ 見つからないうちに近づこう。部隊を選んで地図を押すと移動、敵を押すとそこを攻撃');renderCards();};}
function renderCmd(){const el=$('sgCmd');if(!el)return;const n=G.sel.size;
  el.innerHTML=n?`<span>${n}部隊を選択中</span>${G.phase==='deploy'?'<button data-cmd="back">置いた部隊を戻す</button>':''}<button data-cmd="auto">自動で戦う</button><button data-cmd="hold">固守</button>${G.retreat?'<button data-cmd="flee">撤退させる</button>':''}<button data-cmd="none">選択を解除</button>`:`<button data-cmd="all">全部隊を選ぶ</button><span class="muted">ドラッグで範囲選択</span>`;
  el.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;const us=G.units.filter(u=>G.sel.has(u.id)&&alive(u));
    if(c==='all'){G.units.filter(alive).forEach(u=>G.sel.add(u.id));}else if(c==='none')G.sel.clear();
    else if(c==='back'){for(const u of us){G.pool[u.t]=(G.pool[u.t]||0)+1;if(u.hero&&G.hUsed)G.hUsed.delete(u.hero.id);}G.units=G.units.filter(u=>!us.includes(u));G.sel.clear();renderCards();msg(`${us.length}部隊を戻しました`);}   // 配置中だけ：置いた部隊を札に戻す
    else for(const u of us){u.tx=u.ty=null;u.tg=null;u.focus=false;u.hold=c==='hold';u.flee=c==='flee';u.fl=null;}
    sfx('click');renderCmd();});}
function msg(t){const m=$('sgMsg');if(!m)return;m.textContent=t;m.classList.toggle('on',!!t);clearTimeout(m._t);if(t)m._t=setTimeout(()=>m.classList.remove('on'),4500);}

// ---------- 入力 ----------
function toW(ev){const r=cv.getBoundingClientRect(),dpr=cv.width/r.width;return {x:((ev.clientX-r.left)*dpr-G.ox)/G.k,y:((ev.clientY-r.top)*dpr-G.oy)/G.k};}
function bindInput(){let down=null,pinch=null;const pts=new Map();
  cv.oncontextmenu=e=>e.preventDefault();
  cv.onwheel=ev=>{ev.preventDefault();const [sx,sy]=cvPt(ev);zoomAt(sx,sy,Math.exp(-ev.deltaY*0.0015));};
  if(!window.__sgKeys){window.__sgKeys=1;addEventListener('keydown',e=>{if(!G||!cv||!document.getElementById('sgCv'))return;
    if(/^[0-9]$/.test(e.key)&&G.phase!=='end'){const L=ORDER.filter(k=>G.pool[k]>0||G.units.some(u=>u.t===k)),i=(+e.key+9)%10,k=L[i];if(k&&G.pool[k]>0){G.card=G.card===k?null:k;sfx('click');renderCards();msg(G.card?`${SU[k].n}：陣のまわりの明るい所をタップして置く`:'');}e.preventDefault();return;}   // 1〜9・0：札を選ぶ
    if(e.key==='Escape'){G.card=null;G.sel.clear();renderCards();renderCmd();return;}const m={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],a:[-1,0],d:[1,0],w:[0,-1],s:[0,1]}[e.key];if(!m)return;G.camX+=m[0]*80/G.zoom;G.camY+=m[1]*80/G.zoom;cam();});}
  const pinchInfo=()=>{const [a,b]=[...pts.values()];return {d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,mx:(a[0]+b[0])/2,my:(a[1]+b[1])/2};};
  cv.onpointerdown=ev=>{try{cv.setPointerCapture(ev.pointerId);}catch(e){}pts.set(ev.pointerId,cvPt(ev));
    if(pts.size===2){down=null;G.box=null;const q=pinchInfo();pinch={d:q.d,mx:q.mx,my:q.my};return;}
    if(ev.button===1||ev.button===2){down={pan:true,last:cvPt(ev)};return;}
    down={a:toW(ev),sx:ev.clientX,sy:ev.clientY,shift:ev.shiftKey};};
  cv.onpointercancel=ev=>{pts.delete(ev.pointerId);pinch=null;down=null;G.box=null;};
  cv.onpointermove=ev=>{if(pts.has(ev.pointerId))pts.set(ev.pointerId,cvPt(ev));
    if(pinch&&pts.size>=2){const q=pinchInfo();zoomAt(q.mx,q.my,q.d/pinch.d);G.camX-=(q.mx-pinch.mx)/G.k;G.camY-=(q.my-pinch.my)/G.k;cam();pinch={d:q.d,mx:q.mx,my:q.my};return;}
    if(!down)return;if(down.pan){const p=cvPt(ev);G.camX-=(p[0]-down.last[0])/G.k;G.camY-=(p[1]-down.last[1])/G.k;down.last=p;cam();return;}if(Math.hypot(ev.clientX-down.sx,ev.clientY-down.sy)>8&&!G.card){down.box=true;G.box={a:down.a,b:toW(ev)};}};
  cv.onpointerup=ev=>{pts.delete(ev.pointerId);if(pinch){if(pts.size<2)pinch=null;down=null;return;}if(!down||down.pan){down=null;return;}const p=toW(ev);
    if(down.box){const x0=Math.min(down.a.x,p.x),x1=Math.max(down.a.x,p.x),y0=Math.min(down.a.y,p.y),y1=Math.max(down.a.y,p.y);if(!down.shift)G.sel.clear();
      for(const u of G.units)if(alive(u)&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1)G.sel.add(u.id);G.box=null;sfx('click');renderCmd();}
    else tap(p,down.shift);down=null;};
}
// 陣まで歩いて行ける所か（山脈・川の向こうの、陣へ道がつながっていない所には置けない）
function reachMap(){if(G.reach&&G.reach.blk===gridT())return G.reach.a;const T=gridT(),N=GCOL*GROW,a=new Uint8Array(N),q=new Int32Array(N);let h=0,t=0;const s0=Math.floor(CY/GS)*GCOL+Math.floor(CX/GS);a[s0]=1;q[t++]=s0;
  while(h<t){const i=q[h++],c=i%GCOL,r=(i-c)/GCOL;for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const nc=c+dc,nr=r+dr;if(nc<0||nr<0||nc>=GCOL||nr>=GROW)continue;const j=nr*GCOL+nc;if(a[j]||T[j])continue;a[j]=1;q[t++]=j;}}
  G.reach={blk:T,a};return a;}
function reachable(x,y){const c=Math.floor(x/GS),r=Math.floor(y/GS);if(c<0||r<0||c>=GCOL||r>=GROW)return false;return !!reachMap()[r*GCOL+c];}
function canDeploy(p){return p.x>12&&p.y>12&&p.x<W-12&&p.y<H-12&&farFromCamp(p.x,p.y,90)&&!tBlock(p.x,p.y)&&reachable(p.x,p.y);}
function tap(p,shift){
  if(G.card&&!(G.pool[G.card]>0)){G.card=null;renderCards();}   // 置く部隊が残っていない札は外す（ほかの札に自動で切り替えない）
  {const near=G.units.filter(alive).sort((a,b)=>dist(a,p)-dist(b,p))[0];if(G.card&&near&&dist(near,p)<14){G.card=null;renderCards();}}   // 札を選んでいても、置いた部隊を押したら選ぶ（戻すため）
  if(G.card&&G.phase!=='end'&&!G.retreat){if(canDeploy(p)){if(G.pool[G.card]>0){spawnSquad(G.card,p.x,p.y);G.pool[G.card]--;sfx('build');if(!G.pool[G.card])G.card=null;renderCards();}return;}
    else{msg('部隊は陣のまわりの明るい所にだけ置けます（陣に近すぎる所・山や川の向こうで陣まで行けない所には置けない）');return;}}
  const u=G.units.filter(alive).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(u&&dist(u,p)<22){if(!shift&&!G.sel.has(u.id))G.sel.clear();if(shift&&G.sel.has(u.id))G.sel.delete(u.id);else G.sel.add(u.id);sfx('click');renderCmd();return;}
  if(!G.sel.size)return;
  const f=G.foes.filter(alive).find(o=>dist(o,p)<16)||G.blds.filter(alive).find(o=>dist(o,p)<o.r+6);
  for(const id of G.sel){const s=G.units.find(x=>x.id===id);if(!alive(s))continue;s.flee=false;s.fl=null;if(f){s.tg=f;s.tx=s.ty=null;s.focus=true;}else if(atEdge(p)){const e=edgeSpot(p);s.tx=e[0];s.ty=e[1];s.tg=null;s.focus=false;}   /* 赤い所（撤退ライン）を押したら、その部隊はそこから逃げる（ばらけさせない） */else{s.tx=p.x+(Math.random()-0.5)*24;s.ty=p.y+(Math.random()-0.5)*24;s.tg=null;s.focus=false;}s.hold=false;}
  G.fx.push({x:p.x,y:p.y,r:14,t:0,dur:0.4,c:f?'#ff5a4e':'#62c6d9'});sfx('click');
}

// ---------- 戦い ----------
function loopStart(){cancelAnimationFrame(raf);last=performance.now();const step=now=>{raf=requestAnimationFrame(step);const dt=Math.min(0.05,(now-last)/1000);last=now;
    if(G.phase==='battle'&&!G.paused)for(let i=0;i<G.speed&&G.phase==='battle';i++)update(dt);else{for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);}
    draw(now/1000);hud();};raf=requestAnimationFrame(step);}
function nearest(o,list,max,filt){let best=null,bd=max||1e9;for(const t of list){if(!alive(t)||(filt&&!filt(t)))continue;const d=dist(o,t);if(d<bd){bd=d;best=t;}}return best;}
function chief(){return G.blds.find(b=>b.kind==='chief');}
// こちらの部隊は柵の杭と門にぶつかる（壊して進む）。魔物は門を通る
// 当たり：部隊は半径5（杭が1本壊れたすき間＝杭の間14 を通れる）、破城槌は14
function blocker(x,y,r){for(const b of G.blds)if((b.kind==='post'||b.kind==='gate'||b.kind==='abatis')&&b.hp>0&&Math.hypot(b.x-x,b.y-y)<b.r+r)return b;return null;}
// 地形をよけて進む道（20pxの升目で幅優先探索）。まっすぐ行けないときだけ使う
const GS=20,GCOL=Math.ceil(W/GS),GROW=Math.ceil(H/GS);
// 道さがしの升目：'t' 地形だけ（破城槌）、'u' 地形＋立っている柵・門・逆茂木（こちら）、'f' 地形＋柵の杭（魔物は自分の門を通れる）。柵が壊れたら作り直す
function gridBlk(m){m=m||'t';G.blkM=G.blkM||{};if(G.blkM[m])return G.blkM[m];const a=new Uint8Array(gridT());if(m==='t')return G.blkM[m]=a;
  for(const b of G.blds){const fence=b.kind==='post'||(m==='u'&&(b.kind==='gate'||b.kind==='abatis'));if(!fence||b.hp<=0)continue;const rr=b.kind==='post'?9:b.r+3;
    for(let r=Math.floor((b.y-rr)/GS);r<=Math.floor((b.y+rr)/GS);r++)for(let c=Math.floor((b.x-rr)/GS);c<=Math.floor((b.x+rr)/GS);c++){if(r<0||c<0||r>=GROW||c>=GCOL)continue;if(Math.hypot(c*GS+GS/2-b.x,r*GS+GS/2-b.y)<rr+4)a[r*GCOL+c]=1;}}
  // 通り道（壊れた杭・門／魔物には自分の門）は開けておく
  for(const b of G.blds){const open=((b.kind==='post'||b.kind==='gate')&&b.hp<=0)||(m==='f'&&b.kind==='gate');if(!open)continue;const c=Math.floor(b.x/GS),r=Math.floor(b.y/GS);if(r>=0&&c>=0&&r<GROW&&c<GCOL&&!gridT()[r*GCOL+c])a[r*GCOL+c]=0;}
  return G.blkM[m]=a;}
function gridT(){if(G.blk)return G.blk;const a=new Uint8Array(GCOL*GROW);for(let r=0;r<GROW;r++)for(let c=0;c<GCOL;c++){const x=c*GS+GS/2,y=r*GS+GS/2;a[r*GCOL+c]=(tBlock(x,y)||tBlock(x-6,y-6)||tBlock(x+6,y+6))?1:0;}return G.blk=a;}
function findPath(sx,sy,tx,ty,m){const b=gridBlk(m),T=gridT(),cl=(v,m)=>Math.max(0,Math.min(m-1,v));const s0=cl(Math.floor(sy/GS),GROW)*GCOL+cl(Math.floor(sx/GS),GCOL);let t0=cl(Math.floor(ty/GS),GROW)*GCOL+cl(Math.floor(tx/GS),GCOL);
  const prev=new Int32Array(GCOL*GROW).fill(-1);const q=new Int32Array(GCOL*GROW);let qh=0,qt=0;q[qt++]=s0;prev[s0]=s0;let best=s0,bd=1e9;
  while(qh<qt){const i=q[qh++];const c=i%GCOL,r=(i-c)/GCOL;const d=Math.hypot(c-t0%GCOL,r-Math.floor(t0/GCOL));if(d<bd){bd=d;best=i;}if(i===t0)break;
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nc=c+dc,nr=r+dr;if(nc<0||nr<0||nc>=GCOL||nr>=GROW)continue;const j=nr*GCOL+nc;if(prev[j]>=0)continue;if(b[j]&&!(T[i]&&T[j]&&!tBlock(nc*GS+GS/2,nr*GS+GS/2)))continue;   /* 山の升目の中に立っているときは、通れる所づたいに抜け出してよい */
     if(dc&&dr&&(b[r*GCOL+nc]||b[nr*GCOL+c]))continue;prev[j]=i;q[qt++]=j;}}
  const pts=[];for(let i=best;i!==s0;i=prev[i]){const c=i%GCOL,r=(i-c)/GCOL;pts.unshift({x:c*GS+GS/2,y:r*GS+GS/2});if(pts.length>400)break;}
  if(best===t0&&pts.length)pts[pts.length-1]={x:tx,y:ty};return pts;}
// 道に沿って進むときの、次に向かう点
function pathAim(o,tx,ty){const key=Math.round(tx/GS)+','+Math.round(ty/GS);if(!o.path||o.path.key!==key)return null;const P=o.path.pts;while(P.length&&Math.hypot(P[0].x-o.x,P[0].y-o.y)<10)P.shift();if(!P.length||Math.hypot(P[0].x-o.x,P[0].y-o.y)>60){o.path=null;return null;}   /* 道から外れていたら（追いかけたあとなど）道を探しなおす */return P[0];}
/* 空を飛ぶ・いま通れない所に立っている（抜け出す）ときはそのまま進む */function freeDir(x,y,dx,dy,s,fly){if(fly)return [x+dx*s,y+dy*s];if(tBlock(x,y)){if(!tBlock(x+dx*s,y+dy*s))return [x+dx*s,y+dy*s];let best=null,bd=1e9;for(let r=8;r<=64&&!best;r+=8)for(let a=0;a<16;a++){const px=x+Math.cos(a/16*Math.PI*2)*r,py=y+Math.sin(a/16*Math.PI*2)*r;if(!tBlock(px,py)){const dd=r-((px-x)*dx+(py-y)*dy)*0.3;if(dd<bd){bd=dd;best=[px,py];}}}if(!best)return [x+dx*s,y+dy*s];const ex=best[0]-x,ey=best[1]-y,el=Math.hypot(ex,ey)||1;return [x+ex/el*s,y+ey/el*s];}for(const a of [0,0.6,-0.6,1.2,-1.2,1.7,-1.7]){const c=Math.cos(a),sn=Math.sin(a),ux=dx*c-dy*sn,uy=dx*sn+dy*c,nx=x+ux*s,ny=y+uy*s;if(!tBlock(nx,ny))return [nx,ny];}return null;}
function stepTo(u,tx,ty,spd,dt){const fly=!!SU[u.t].fly;const pa=fly?null:pathAim(u,tx,ty);const ax=pa?pa.x:tx,ay=pa?pa.y:ty;const dx=ax-u.x,dy=ay-u.y,d=Math.hypot(dx,dy);if(d<2)return null;if(!fly&&tForest(u.x,u.y))spd*=0.65;const s=Math.min(d,spd*dt);let fp=freeDir(u.x,u.y,dx/d,dy/d,s,fly);
  // 近づけていない（横に行ったり来たりしている）ときも、道をさがす
  if(!fly&&!pa){const dd=Math.hypot(tx-u.x,ty-u.y),key=Math.round(tx/GS)+','+Math.round(ty/GS);if(u._pk!==key||dd<(u._pb||1e9)-3){u._pk=key;u._pb=dd;u._pt=0;}else u._pt=(u._pt||0)+dt;if(u._pt>1.5){u._pt=0;u._pb=dd;fp=null;}}
  if(fp&&!fly&&!pa&&(u._lbT||0)<G.t&&lineBlocked(u.x,u.y,tx,ty)){u._lbT=G.t+0.5;fp=null;}   // 間に山・川があるなら、はじめから回り道を探す（向かい合って横に動き続けない）
  if(!fp&&!fly&&!pa){const pts=findPath(u.x,u.y,tx,ty,u.t==='ram'?'t':'u');if(pts.length){u.path={key:Math.round(tx/GS)+','+Math.round(ty/GS),pts};const q=pts[0],ex=q.x-u.x,ey=q.y-u.y,el=Math.hypot(ex,ey)||1;fp=freeDir(u.x,u.y,ex/el,ey/el,Math.min(el,spd*dt),false);}}
  if(!fp&&pa)fp=[u.x+dx/d*s,u.y+dy/d*s];   // 道の点は通れる升目なので、そこへはまっすぐ向かってよい
  if(!fp)return null;const nx=fp[0],ny=fp[1];
  if(Math.abs(dx)>0.5)u.face=dx>0?1:-1;const b=blocker(nx,ny,u.t==='ram'?14:5);if(b)return b;u.x=Math.max(6,Math.min(W-6,nx));u.y=Math.max(6,Math.min(H-6,ny));u.walk+=dt*8;return null;}
// こちらの部隊の歩き方：柵の内と外を行き来するときは、壊れた門・柵のすき間（なければ門）を通る。柵にぶつかったら回り込む
function normalAt(bd,x,y){if(bd.t==='circle'){const dx=x-CX,dy=y-CY,l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];}const dx=(x-CX)/bd.a,dy=(y-CY)/bd.b;return Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];}
function navPoint(u,tx,ty){if(u.nav&&u.nav.p2&&u.nav.stage===1){if(Math.hypot(u.x-u.nav.p2[0],u.y-u.nav.p2[1])>8)return [u.nav.p2[0],u.nav.p2[1],u.nav.o];u.nav=null;}   // くぐり始めたら向こう側に着くまでくぐり切る（柵の線の上で行ったり来たりしない）
  const la=layerOf(u.x,u.y),lt=layerOf(tx,ty);if(la===lt){u.nav=null;return [tx,ty,null];}
  const inward=la<lt,bi=inward?la:la-1,bd=G.bounds[bi];
  const ops=G.blds.filter(b=>(b.kind==='gate'||b.kind==='post')&&b.layer===bi&&b.hp<=0);
  const score=o=>dist(u,o)+Math.hypot(o.x-tx,o.y-ty);
  let o=u.nav&&u.nav.bi===bi&&u.nav.inward===inward?u.nav.o:null;
  if(!o||(o.hp>0&&ops.length)){o=ops.sort((a,b)=>score(a)-score(b))[0]||bd.gateB.slice().sort((a,b)=>score(a)-score(b))[0];u.nav={bi,inward,o,stage:0};}
  const [nx,ny]=normalAt(bd,o.x,o.y),sg=inward?1:-1,p1=[o.x+nx*20*sg,o.y+ny*20*sg],p2=[o.x-nx*20*sg,o.y-ny*20*sg];
  if(u.nav.stage===0&&Math.hypot(u.x-p1[0],u.y-p1[1])<12){u.nav.stage=1;u.nav.p2=p2;}
  return u.nav.stage===0?[p1[0],p1[1],o]:[p2[0],p2[1],o];}
function moveNav(u,tx,ty,spd,dt){if(SU[u.t].fly){const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);if(d>1){const st=Math.min(d,spd*dt);u.x+=dx/d*st;u.y+=dy/d*st;if(Math.abs(dx)>0.5)u.face=dx>0?1:-1;u.walk+=dt*8;}return null;}
  const [gx,gy,op]=navPoint(u,tx,ty);const b=stepTo(u,gx,gy,spd,dt);if(!b)return null;
  if(op&&b===op)return b;                              // 通り道の門がまだ立っている → 壊す
  // 柵の杭にぶつかった → 杭に沿って回り込む（行き先に近づく向きへ）
  const ax=u.x-b.x,ay=u.y-b.y,l=Math.hypot(ax,ay)||1,dx=gx-u.x,dy=gy-u.y;let tx1=-ay/l,ty1=ax/l;if(tx1*dx+ty1*dy<0){tx1=-tx1;ty1=-ty1;}
  for(const k of [1,0.6]){const sx=u.x+(tx1*k+ax/l*(1-k))*spd*dt,sy=u.y+(ty1*k+ay/l*(1-k))*spd*dt;if(!blocker(sx,sy,5)){u.x=sx;u.y=sy;u.walk+=dt*8;if(Math.abs(tx1)>0.3)u.face=tx1>0?1:-1;return null;}}
  return b;}
// 魔物の歩き方：まっすぐ行くと柵を越えてしまうときは、門を通る道（杭だけをふさいだ升目の道さがし）をたどる
// まっすぐ行くと山・川を越えてしまうか（両端の升目は除く）
function lineBlocked(x0,y0,x1,y1){const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/10);for(let i=2;i<n-1;i++)if(tBlock(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n))return true;return false;}
function crossFence(x0,y0,x1,y1){const L0=layerOf(x0,y0),n=Math.ceil(Math.hypot(x1-x0,y1-y0)/10);for(let i=1;i<=n;i++)if(layerOf(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n)!==L0)return true;return false;}
function foeStep(f,tx,ty,spd,dt){if(flyF(f)){const dx=tx-f.x,dy=ty-f.y,d=Math.hypot(dx,dy);if(d<1)return;const st=Math.min(d,spd*dt);f.x+=dx/d*st;f.y+=dy/d*st;if(Math.abs(dx)>0.5)f.face=dx>0?1:-1;f.walk=(f.walk||0)+dt*8;return;}   // 空を飛ぶ魔物は柵を越えてまっすぐ
  let gx=tx,gy=ty;const key=Math.round(tx/GS)+','+Math.round(ty/GS);
  const need=f.path?(f.path.pts.length>0):(crossFence(f.x,f.y,tx,ty)||lineBlocked(f.x,f.y,tx,ty));
  if(need){if(!f.path||(f.path.key!==key&&G.t-f.path.t>0.6)){const pts=findPath(f.x,f.y,tx,ty,'f');f.path={key,pts,t:G.t};}
    const P=f.path.pts;while(P.length&&Math.hypot(P[0].x-f.x,P[0].y-f.y)<8)P.shift();if(P.length){gx=P[0].x;gy=P[0].y;}else f.path=null;
    if(f.path&&f.path.key!==key&&!crossFence(f.x,f.y,tx,ty))f.path=null;}
  const dx=gx-f.x,dy=gy-f.y,d=Math.hypot(dx,dy);if(d<1)return;if(tForest(f.x,f.y))spd*=0.7;const s=Math.min(d,spd*dt);let fp=f.path?[f.x+dx/d*s,f.y+dy/d*s]:freeDir(f.x,f.y,dx/d,dy/d,s,false);
  if(!fp){const pts=findPath(f.x,f.y,tx,ty,'f');if(pts.length)f.path={key,pts,t:G.t};return;}   // 山などにぶつかった → 次から道をたどる
  f.x=fp[0];f.y=fp[1];if(Math.abs(dx)>0.5)f.face=dx>0?1:-1;f.walk=(f.walk||0)+dt*8;}
function raiseAlarm(why,p){if(G.alarm)return;G.alarm=true;sfx('alarm');msg(`${why}！ 陣の魔物が起きてきた`);
  const dr=drumOn(true);for(const f of G.foes)if(!f.awake)f.wakeAt=G.t+((p?Math.hypot(f.x-p.x,f.y-p.y)/90:0)+Math.random()*1.5)*(dr&&f.def!=='drum'?0.5:1);
  if(dr){const df=G.foes.find(f=>f.def==='drum');df.awake=true;setTimeout(()=>{if(G&&drumOn())msg('戦太鼓が鳴り響く！ 魔物がすぐ起きて、足も速くなった');},1600);}}
function drumOn(any){return G.foes.some(f=>f.def==='drum'&&alive(f)&&(any||f.awake));}   // 騒ぎの近くから順に起きてくる（一斉には来ない）
function hitBld(b,dmg){if(b.hp<=0)return;b.hp-=dmg;if(b.hp<=0&&(b.kind==='post'||b.kind==='gate'||b.kind==='abatis'))G.blkM=null;raiseAlarm('物音で気づかれた',b);
  if(b.kind==='chief'&&!G.chiefAtk){G.chiefAtk=true;msg('大将のテントが襲われた！ 魔物が大将を守りに集まってくる');}
  if(isTent(b)&&b.sl)emerge(b);if(b.hp<=0){b.hp=0;G.fx.push({x:b.x,y:b.y,r:b.r*1.6,t:0,dur:0.5,c:isTent(b)?'#ff8a3a':'#ffb14e'});if(b.kind!=='post')sfx('destroy');
    if(b.kind==='tower'){G.foes.push(mkFoe('gobarcher',b.x,b.y+8,{awake:true,def:'tower'}));msg('物見櫓が崩れて、ゴブリンアーチャーが落ちてきた！');}
    if(isTent(b)){G.fires=(G.fires||[]);G.fires.push({x:b.x,y:b.y});vfx('fire',b.x,b.y-6,2.2);}else if(b.kind!=='post')vfx('explosion',b.x,b.y,1.8);}}
function hitUnit(u,dmg,ranged,src){if(src){u.hitBy=src;u.hitT=G.t;}   // 撃ってきた物見櫓・大弓台を覚えておく（やり返す）
  if(ranged&&SU[u.t].role!=='shield'&&G.units.some(o=>o!==u&&alive(o)&&SU[o.t].role==='shield'&&dist(o,u)<48)){dmg*=0.65;u.guardT=0.3;}   // 重装歩兵がそばにいれば、矢などを防いでくれる
  dmg*=(1-(u.red||0))*(u.fukT>0?0.5:1)*(u.yugT>0?0.7:1);u.hp-=dmg;if(u.hp<=0){u.hp=0;G.sel.delete(u.id);if(SU[u.t].carry&&!u.spawned)releaseRam(u);}}
function hitFoe(f,dmg){const d=E[f.k];f.hp-=dmg*(1-(d.armor||0));f.awake=true;if(!G.alarm)raiseAlarm('戦いに気づかれた',f);if(f.hp<=0){f.hp=0;if(f.def==='drum')msg('戦太鼓が止んだ！');}}
// 襲われたテント・小屋から、眠っていた魔物が飛び出してくる（最初に叩かれたとき・体力6割・3割で）。焼け落ちたら残りは焼け死ぬ
function emerge(b){const lv=b.hp<=0?Math.max(1,b.em||0):b.hp<b.maxhp*0.3?3:b.hp<b.maxhp*0.6?2:1;
  while((b.em||0)<lv){b.em=(b.em||0)+1;const rem=total(b.sl);if(!rem)break;let n=Math.min(6,Math.ceil(rem*0.15));
    while(n-->0){const ks=Object.keys(b.sl);if(!ks.length)break;const k=ks[Math.floor(Math.random()*ks.length)];if(!--b.sl[k])delete b.sl[k];
      const a=Math.random()*Math.PI*2;G.foes.push(mkFoe(k,b.x+Math.cos(a)*b.r,b.y+Math.sin(a)*b.r*0.6+8,{awake:true,fromTent:true}));}
    vfx('dust',b.x,b.y,2.2);if(b.em===1)msg(b.kind==='hut'?'小屋から魔物が飛び出してきた！':b.kind==='nest'?'竜の巣から飛ぶ魔物が飛び立った！':'テントから魔物が飛び出してきた！');}
  if(b.hp<=0){b.burnK=total(b.sl);b.burnBy=Object.assign({},b.sl);b.sl={};}}
// ---------- 撤退：戦場の端（赤い所）まで逃げ切った部隊は助かる ----------
const EDGE=34;
function atEdge(u){return u.x<EDGE||u.y<EDGE||u.x>W-EDGE||u.y>H-EDGE;}
function edgeSpot(u){const c=[[u.x,8],[u.x,H-8],[8,u.y],[W-8,u.y]].map(([x,y])=>[Math.max(8,Math.min(W-8,x)),Math.max(8,Math.min(H-8,y))]);
  c.sort((a,b)=>Math.hypot(a[0]-u.x,a[1]-u.y)-Math.hypot(b[0]-u.x,b[1]-u.y));return c.find(p=>!tBlock(p[0],p[1]))||c[0];}
// 逃げ道：戦場の端から山・柵をよけて広げた「端までの歩数」の地図。部隊は歩数が減る方へ進む（山脈にはさまれても回り込める）
const DIRS8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function escField(){const blk=gridBlk('u');if(G.esc&&G.esc.blk===blk)return G.esc.d;const N=GCOL*GROW,D=new Int32Array(N).fill(-1),q=new Int32Array(N);let h=0,t=0;
  for(let r=0;r<GROW;r++)for(let c=0;c<GCOL;c++){if(r>1&&c>1&&r<GROW-2&&c<GCOL-2)continue;const i=r*GCOL+c;if(blk[i])continue;D[i]=0;q[t++]=i;}
  while(h<t){const i=q[h++],c=i%GCOL,r=(i-c)/GCOL;for(const [dc,dr] of DIRS8){const nc=c+dc,nr=r+dr;if(nc<0||nr<0||nc>=GCOL||nr>=GROW)continue;const j=nr*GCOL+nc;if(D[j]>=0||blk[j])continue;if(dc&&dr&&(blk[r*GCOL+nc]||blk[nr*GCOL+c]))continue;D[j]=D[i]+1;q[t++]=j;}}
  G.esc={blk,d:D};return D;}
function escStep(u){const D=escField(),c=Math.max(0,Math.min(GCOL-1,Math.floor(u.x/GS))),r=Math.max(0,Math.min(GROW-1,Math.floor(u.y/GS))),cur=D[r*GCOL+c];
  if(cur===0)return edgeSpot(u);let best=null,bv=cur>=0?cur:1e9,R=cur>=0?1:2;
  for(let dr=-R;dr<=R;dr++)for(let dc=-R;dc<=R;dc++){if(!dr&&!dc)continue;const nc=c+dc,nr=r+dr;if(nc<0||nr<0||nc>=GCOL||nr>=GROW)continue;const v=D[nr*GCOL+nc];if(v<0)continue;const sc=v+(cur>=0?0:Math.hypot(dc,dr));if(sc<bv){bv=sc;best=[nc*GS+GS/2,nr*GS+GS/2];}}
  return best;}
function startRetreat(){if(G.retreat)return;G.retreat=true;G.card=null;
  for(const u of G.units)if(alive(u)){u.flee=true;u.fl=null;u.tg=null;u.tx=u.ty=null;u.hold=false;u.focus=false;}
  renderCards();renderCmd();sfx('alarm');msg('撤退！ 赤い端まで逃げ切れば助かる。部隊を選んで指示すると殿（しんがり）として残せる');
  const q=$('sgQuit');if(q)q.textContent='残りを置いて終える';}
function releaseRam(u){u.spawned=true;for(let i=0;i<SU[u.t].carry;i++){const s=spawnSquad('sword',u.x+(i?14:-14),u.y+(i?10:-10),true);s.face=u.face;}G.fx.push({x:u.x,y:u.y,r:30,t:0,dur:0.5,c:'#f2b33d'});msg('破城槌から兵士2部隊が出てきた！');sfx('upgrade');}
// 弾：kind はゲーム本体の SPR.projectiles の名前。fx は着いたときの演出（SPR.effects）
function shoot(a,b,col,kind,fx,arc){const d=Math.hypot(b.x-a.x,b.y-a.y);G.shots.push({x:a.x,y:a.y-6,tx:b.x,ty:b.y-6,t:0,dur:Math.max(0.15,Math.min(0.7,d/(kind==='stone_big'||kind==='cannonball'?320:420))),c:col||'#e8d8a0',kind:kind||null,fx:fx||null,arc:arc!=null?arc:(kind==='stone_big'?40:kind==='cannonball'?14:10)});}
function vfx(k,x,y,z){(G.vfx=G.vfx||[]).push({k,x,y,z:z||1.5,t:0});}
// 破城槌のねらい：いま居る場所から内へ向かう、いちばん近い（壊れていない）門。門を全部抜けたら大将のテント
// 狙う相手：基本は「いちばん近いもの」（魔物でも建物でも）。得意な相手は半分の距離に見える。柵・門は道をふさいだときだけ叩く（工兵は得意）
const FAV={drake:['sleep'],gun:['def'],cat:['def'],eng:['def']};   // 工兵：防衛（物見櫓・岩投げオーガ）が得意。柵・門はほかの部隊と同じく、道をふさいだときだけ
function bldCat(b){return b.kind==='tower'||b.kind==='bow'?'def':b.kind==='chief'?'chief':isTent(b)?'sleep':'wall';}
function pickTarget(u){const d=SU[u.t],fav=FAV[d.role]||[],air=hitsAir(d);let best=null,bs=1e9;
  for(const f of G.foes){if(!alive(f)||(flyF(f)&&!air)||(u.bads&&u.bads.get(f)>G.t))continue;const c=f.def==='rock'?'def':'foe';const sc=dist(u,f)*(fav.includes(c)?0.5:1);if(sc<bs){bs=sc;best=f;}}
  for(const b of G.blds){if(!alive(b)||(u.bads&&u.bads.get(b)>G.t))continue;const c=bldCat(b);if(c==='wall'&&!fav.includes('wall'))continue;const sc=Math.max(0,dist(u,b)-b.r)*(fav.includes(c)?0.5:1);if(sc<bs){bs=sc;best=b;}}
  return best;}
// 英雄のスキル（本編の SKILLS と同じ名前・だいたい同じ効果。1マス＝28）
function txt(x,y,t,c,big){(G.ftx=G.ftx||[]).push({x,y,t,c,big,a:0});}
function ringFx(x,y,r,c){G.fx.push({x,y,r,t:0,dur:0.7,c});}
function heroTick(u,dt){const k=u.sk;if(!k||!k.cd)return;u.skT-=dt;if(u.skT>0)return;
  const d=SU[u.t],atk=d.dmg*mem(u)*(u.dmul||1),air=hitsAir(d),col=hColor(u.hero);
  const foesIn=(x,y,r,a)=>G.foes.filter(f=>alive(f)&&(a||!flyF(f))&&Math.hypot(f.x-x,f.y-y)<r);
  const dense=(reach,rad)=>{let best=null,bn=0;const cs=foesIn(u.x,u.y,reach,air);for(const e of cs){const m=cs.filter(o=>dist(o,e)<rad).length;if(m>bn){bn=m;best=e;}}return best;};
  const allies=r=>G.units.filter(o=>alive(o)&&dist(o,u)<r);let ok=true;
  switch(k.id){
    case 'nagi':{const fs=foesIn(u.x,u.y,3.2*TU);if(!fs.length){ok=false;break;}for(const f of fs)hitFoe(f,atk*3);ringFx(u.x,u.y,3.2*TU,col);vfx('dust',u.x,u.y,2.5);break;}
    case 'kobu':{if(!G.alarm){ok=false;break;}for(const o of allies(6*TU)){o.buffT=6;o.hp=Math.min(o.maxhp,o.hp+o.maxhp*0.1);}ringFx(u.x,u.y,6*TU,col);break;}
    case 'fukutsu':{const fs=foesIn(u.x,u.y,6*TU);if(!fs.length){ok=false;break;}u.fukT=6;for(const f of fs){f.taunt=u;f.tauntT=G.t+6;}ringFx(u.x,u.y,6*TU,col);break;}
    case 'ame':{const e=dense(d.rng+2*TU,70);if(!e){ok=false;break;}for(let i=0;i<8;i++)shoot(u,{x:e.x+(Math.random()-0.5)*80,y:e.y+(Math.random()-0.5)*60},null,'arrow',null,true);setTimeout(()=>{if(!G||!G.foes)return;for(const f of foesIn(e.x,e.y,70,true))hitFoe(f,40);ringFx(e.x,e.y,70,col);},300/(G.speed||1));break;}
    case 'sokusha':{if(!foesIn(u.x,u.y,d.rng+20,air).length){ok=false;break;}u.rapidT=4;break;}
    case 'shoumei':{const e=dense(d.rng+2*TU,100);if(!e){ok=false;break;}(G.flares=G.flares||[]).push({x:e.x,y:e.y,r:8*TU,t:8});shoot(u,e,null,'arrow',null,true);break;}
    case 'yuugeki':{if(!u.tg&&u.tx==null){ok=false;break;}u.yugT=5;break;}
    case 'kaen':{const e=dense(Math.max(d.rng,90)+TU,67);if(!e){ok=false;break;}shoot(u,e,null,'fireball','explosion');for(const f of foesIn(e.x,e.y,67,true))hitFoe(f,80);ringFx(e.x,e.y,67,'#ff7a2a');break;}
    case 'rai':{let cur=nearest(u,G.foes,Math.max(d.rng,120)+TU,f=>air||!flyF(f));if(!cur){ok=false;break;}const hit=new Set();let from=u;
      for(let i=0;i<5&&cur;i++){hit.add(cur);hitFoe(cur,60);(G.bolts=G.bolts||[]).push({a:{x:from.x,y:from.y-8},b:{x:cur.x,y:cur.y-8},t:0.3});from=cur;cur=nearest(cur,G.foes,110,f=>!hit.has(f));}break;}
    case 'inseki':{const e=dense(16*TU,100);if(!e){ok=false;break;}vfx('explosion',e.x,e.y,4);sfx('boom');for(const f of foesIn(e.x,e.y,100,true)){hitFoe(f,300);f.stunT=2;}ringFx(e.x,e.y,100,'#ff5a1e');break;}
    case 'ibuki':{const fs=foesIn(u.x,u.y,5*TU,true);if(!fs.length){ok=false;break;}for(const f of fs)hitFoe(f,60);vfx('fire',u.x,u.y,3);ringFx(u.x,u.y,5*TU,'#ff7a2a');break;}
    case 'houkou':{const fs=foesIn(u.x,u.y,8*TU,true);if(!fs.length){ok=false;break;}for(const f of fs)f.stunT=3;ringFx(u.x,u.y,8*TU,col);break;}
    case 'rensha':{if(!u.tg){ok=false;break;}u.rapidT=3;break;}
    case 'gourei':{if(!G.alarm){ok=false;break;}for(const o of allies(6*TU))o.gourT=4;ringFx(u.x,u.y,6*TU,col);break;}
    case 'oukyu':{const ws=allies(6*TU).filter(o=>SU[o.t].isBld&&o.hp<o.maxhp);if(!ws.length){ok=false;break;}for(const o of ws)o.hp=Math.min(o.maxhp,o.hp+o.maxhp*0.2);ringFx(u.x,u.y,6*TU,'#6fe08a');break;}
    default:ok=false;}
  if(!ok){u.skT=1;return;}u.skT=k.cd;u.skN=(u.skN||0)+1;txt(u.x,u.y-30,k.name,col,true);sfx('upgrade');}
// 狙いを続ける：いったん決めた相手は、倒すか近づけなくなるまで基本そのまま（2秒ごとに見直し、ずっと近い相手がいるときだけ替える）。柵の境目でぐるぐる回らない
function stickPick(u){const bad=o=>u.bads&&u.bads.get(o)>G.t;const cur=u.tg&&alive(u.tg)&&!bad(u.tg)&&!u.tg.out?u.tg:null;const threat=cur&&cur.kind&&nearF(u,SU[u.t].rng+40);   // 建物を狙っている最中に魔物が寄ってきたら、そちらを先に
  if(cur&&!threat&&G.t<(u.tgUntil||0))return cur;
  const nt=pickTarget(u);u.tgUntil=G.t+2;if(cur&&!threat&&nt&&nt!==cur&&dist(u,nt)>dist(u,cur)*0.6)return cur;return nt;}
// 通りがけの攻撃：移動の途中でも、射程に入った魔物・建物（柵・門は除く）は撃つ／叩く
function passTarget(u){const d=SU[u.t],air=hitsAir(d);let best=null,bd=1e9;
  for(const f of G.foes){if(!alive(f)||(flyF(f)&&!air))continue;const dd=dist(u,f),r=d.rng+(E[f.k].r||6)+4;if(dd<=r&&(!d.minR||dd>=d.minR)&&dd<bd){bd=dd;best=f;}}
  if(!best)for(const b of G.blds){if(!alive(b)||bldCat(b)==='wall')continue;const dd=dist(u,b),r=d.rng+b.r+4;if(dd<=r&&(!d.minR||dd>=d.minR)&&dd<bd){bd=dd;best=b;}}
  return best;}
function escapeU(u){u.out=true;u.keepHp=u.hp;u.hp=0;G.sel.delete(u.id);G.fx.push({x:u.x,y:u.y,r:16,t:0,dur:0.4,c:'#ff5a4e'});}
function ramTarget(u){const la=layerOf(u.x,u.y);for(let i=la;i<G.bounds.length;i++){const g=nearest(u,G.bounds[i].gateB,1e9);if(g)return g;}return chief();}

function update(dt){G.t+=dt;
  const ch=chief();
  // --- こちらの部隊 ---
  for(const u of G.units){if(!alive(u))continue;const d=SU[u.t];for(const k of ['buffT','rapidT','gourT','fukT','yugT'])if(u[k]>0)u[k]-=dt;
    u.cd-=dt*((u.rapidT>0?2:1)+(u.gourT>0?0.5:0));const n=mem(u),atk=d.dmg*n*(u.dmul||1)*(u.buffT>0?1.3:1),uspd=d.spd*MOVE_SC*(u.yugT>0?1.6:1);
    if(u.hero&&!u.flee)heroTick(u,dt);
    if(d.role==='eng')for(const tr of G.traps)if(tr.hp>0&&Math.hypot(tr.x-u.x,tr.y-u.y)<40){tr.hp=0;G.fx.push({x:tr.x,y:tr.y,r:10,t:0,dur:0.4,c:'#6fe08a'});}
    if(!d.isBld&&!d.fly)for(const tr of G.traps)if(tr.hp>0&&Math.hypot(tr.x-u.x,tr.y-u.y)<11)hitUnit(u,14*dt);
    if(u.flee){if(atEdge(u)){escapeU(u);continue;}   // 逃げ切った
      if(d.role==='ranged'&&u.cd<=0){const pt=passTarget(u);if(pt){u.cd=d.rate;attack(u,pt,atk);}}   // 弓兵・魔術師は逃げながら撃つ
      const gp=d.fly?null:escStep(u),fsp=uspd*1.25;   // 逃げるときは少し速い（荷物を捨てて走る）
      let b;if(gp)b=stepTo(u,gp[0],gp[1],fsp,dt);else{if(!u.fl)u.fl=edgeSpot(u);b=d.role==='ram'||d.fly?stepTo(u,u.fl[0],u.fl[1],fsp,dt):moveNav(u,u.fl[0],u.fl[1],fsp,dt);}   // 柵の中で出口がないときは門・柵を壊して出る
      if(b&&u.cd<=0&&d.role!=='ranged'&&d.role!=='gun'&&d.role!=='cat'){u.cd=d.rate;attack(u,b,atk);}continue;}
    let tg=u.tg&&alive(u.tg)?u.tg:null;if(!tg)u.focus=false;
    if(u.tx!=null){if(atEdge(u)&&(G.retreat||atEdge({x:u.tx,y:u.ty}))){escapeU(u);continue;}   // 赤い所（撤退ライン）に着いたら逃げ切り。撤退を押していなくても、赤い所へ動かした部隊はそこで戦場を離れる
      if(d.role!=='ram'&&u.cd<=0){const pt=passTarget(u);if(pt){u.cd=d.rate;attack(u,pt,atk);}}
      const b=d.role==='ram'?stepTo(u,u.tx,u.ty,uspd,dt):moveNav(u,u.tx,u.ty,uspd,dt);
      if(b){if(d.role==='ranged'||d.role==='cat'||d.role==='gun'){/* 門が開くまで待つ */}else if(u.cd<=0){u.cd=d.rate;attack(u,b,atk);}continue;}
      if(Math.hypot(u.tx-u.x,u.ty-u.y)<4){u.tx=u.ty=null;}continue;}
    if(!tg||!u.focus){
      const bldT=b=>b.kind!=='post';   // 柵の杭そのものは狙わない（道をふさいだら叩く）
      if(d.role==='ram'){tg=ch;const dx=ch.x-u.x,dy=ch.y-u.y,L=Math.hypot(dx,dy)||1;let bt=1e9;   // 大将のテントまでの道すじにある建物（テント・小屋・物見櫓・大弓台・門など）は壊して進む
        for(const b of G.blds){if(!alive(b)||b===ch||b.kind==='post')continue;const px=b.x-u.x,py=b.y-u.y,t=(px*dx+py*dy)/L;if(t<-10||t>L)continue;if(Math.abs(px*dy-py*dx)/L<b.r+16&&t<bt){bt=t;tg=b;}}}   // まっすぐ大将のテントへ（ぶつかった柵・門は下で叩く）
      else{const hurt=d.role==='eng'&&nearest(u,G.units,160,o=>SU[o.t].isBld&&o.hp<o.maxhp-1);tg=hurt&&!nearF(u,70)?hurt:stickPick(u);}   // 工兵は傷んだ破城槌・投石機を先に直す
      // 物見櫓・大弓台に撃たれたら、近くの魔物と戦っている最中でなければやり返す（破城槌はまっすぐ進む）
      if(['ranged','gun','cat','drake'].includes(d.role)&&u.hitBy&&alive(u.hitBy)&&G.t-u.hitT<4&&dist(u,u.hitBy)<d.rng+(u.hitBy.r||8)+30&&!(tg&&tg.k&&dist(u,tg)<d.rng+40))tg=u.hitBy;   // やり返すのは撃てる部隊だけ、届く所にいるときだけ（陣の奥まで深追いしない）
      if(!u.focus)u.tg=tg;}
    if(u.hold){if(tg&&dist(u,tg)<=d.rng+(tg.r||6)+6&&u.cd<=0){u.cd=d.rate;attack(u,tg,atk);}continue;}
    if((d.role==='ranged'||d.role==='gun')&&!tg){const fr=nearest(u,G.units,1e9,o=>o!==u&&!SU[o.t].isBld&&SU[o.t].role!=='ranged');let gx,gy;
      const nf=!fr&&nearF(u,1e9);   // 前に立つ味方がもういなければ、残りの魔物に近づいて撃つ
      if(nf){const bk=moveNav(u,nf.x,nf.y,uspd,dt);if(bk&&u.cd<=0){u.cd=d.rate;attack(u,bk,atk);}continue;}
      if(fr){const dx=fr.x-CX,dy=fr.y-CY,dl=Math.hypot(dx,dy)||1;gx=fr.x+dx/dl*30;gy=fr.y+dy/dl*30;}else{const dx=u.x-CX,dy=u.y-CY,dl=Math.hypot(dx,dy)||1,r=Math.max(outerR()+70,dl-40);gx=CX+dx/dl*r;gy=CY+dy/dl*r;}
      stepTo(u,gx,gy,uspd,dt);continue;}
    if(!tg)continue;
    const reach=d.rng+(tg.r||E[tg.k]&&E[tg.k].r||6)+2,dd=dist(u,tg);
    if(d.minR&&dd<d.minR){stepTo(u,u.x-(tg.x-u.x),u.y-(tg.y-u.y),uspd,dt);continue;}
    if(dd>reach){if(d.role!=='ram'&&u.cd<=0){const pt=passTarget(u);if(pt){u.cd=d.rate;attack(u,pt,atk);}}   // 向かう途中でも射程に入った相手は撃つ
      const b=d.role==='ram'?stepTo(u,tg.x,tg.y,uspd,dt):moveNav(u,tg.x,tg.y,uspd,dt);
      if(b&&d.role!=='ranged'){if(u.cd<=0){u.cd=d.rate;attack(u,b,atk);}}   // ふさいでいる柵・門は叩く（弓兵・魔術師は叩けない）
      // 近づけない相手はあきらめて、ほかを狙う（門の前で立ち止まったままにならない）
      if(u._gtg!==tg||dd<u._gd-3){u._gtg=tg;u._gd=dd;u._gt=G.t;}else if(G.t-u._gt>(b&&d.role!=='ranged'?12:3.5)&&!u.focus){(u.bads=u.bads||new Map()).set(tg,G.t+10);u.tg=null;u._gtg=null;}
      continue;}
    if(d.role==='ram'&&!u.spawned&&tg===ch)releaseRam(u);
    if(d.role==='eng'&&!tg.kind&&!tg.k&&SU[tg.t]&&SU[tg.t].isBld){tg.hp=Math.min(tg.maxhp,tg.hp+30*dt);u.fixT=0.3;continue;}   // 修理
    if(u.cd<=0){u.cd=d.rate;attack(u,tg,atk);}
  }
  // --- 魔物 ---
  const drum=drumOn();
  for(const f of G.foes){if(!alive(f))continue;const d0=E[f.k];f.cd-=dt;if(d0.regen)f.hp=Math.min(f.maxhp,f.hp+d0.regen*dt);
    if(f.stunT>0){f.stunT-=dt;continue;}   // 英雄のスキルで動けない
    const d=Object.assign({},d0,{spd:d0.spd*MOVE_SC*FOE_SPD*(drum&&f.def!=='drum'&&G.alarm?1.12:1)});   // 寝起きなので本来より遅い。戦太鼓が鳴っている間は少し速い   // 戦太鼓が鳴っている間は足が速い
    const rng=d.archers?d.archers.range*28:d.ranged?d.ranged*28:0;
    // 見張りオオカミ：つながれていて動かない。近くに来たら吠える
    if(f.def==='wolf'&&!G.alarm){const seen=nearest(f,G.units,170,u=>!tForest(u.x,u.y)||dist(u,f)<80);if(seen){f.barkT=1.2;raiseAlarm('見張りのオオカミが吠えた',f);}continue;}
    if(f.def&&!f.awake&&G.alarm)f.awake=true;
    // 岩投げオーガ：持ち場から岩を投げる。破城槌・投石機を先に狙う。すぐそばに来られたら殴る
    if(f.def==='rock'){if(!G.alarm)continue;const t=nearest(f,G.units,f.rng,u=>!!SU[u.t].isBld)||nearest(f,G.units,f.rng,u=>!SU[u.t].fly);
      if(!t){if(Math.hypot(f.px-f.x,f.py-f.y)>6)foeStep(f,f.px,f.py,d.spd,dt);continue;}
      if(dist(f,t)>44){f.face=t.x>f.x?1:-1;if(f.cd<=0){f.cd=f.rrate;f.atkT=G.t;shoot(f,t,'#a09080','stone_big','explosion',true);hitUnit(t,f.rdmg*(SU[t.t].isBld?2:1),true,f);sfx('how');}continue;}}
    // 見張り：柵の外を巡回。部隊を見つけたら知らせる
    if(f.sentry&&!G.alarm){const seen=nearest(f,G.units,120,u=>!tForest(u.x,u.y)||dist(u,f)<60);if(seen)raiseAlarm('見張りに見つかった',f);
      else{f.ang+=f.dir*dt*0.12;const pt=a=>[CX+Math.cos(a)*f.pr*(G.bounds[0].t==='rect'?1.25:1),CY+Math.sin(a)*f.pr*(G.bounds[0].t==='rect'?0.85:1)];if(tBlock(...pt(f.ang+f.dir*0.25)))f.dir=-f.dir;   /* 山にぶつかったら引き返す */const tx=CX+Math.cos(f.ang)*f.pr*(G.bounds[0].t==='rect'?1.25:1),ty=CY+Math.sin(f.ang)*f.pr*(G.bounds[0].t==='rect'?0.85:1);foeStep(f,tx,ty,d.spd*0.5,dt);continue;}}
    if(!f.awake&&!f.sentry){// 寝ている：すぐそばに来られたら起きる
      if(f.wakeAt!=null&&G.t>=f.wakeAt)f.awake=true;else if(nearest(f,G.units,45)){f.awake=true;raiseAlarm('陣に踏み込まれた',f);}else if(!f.awake)continue;}
    let tg=f.tg&&alive(f.tg)&&dist(f,f.tg)<(rng?rng+90:320)&&(d.fly||rng||!SU[f.tg.t].fly)?f.tg:null;   // 追い始めた相手は少し離れても追い続ける（門の前で行ったり来たりしない）
    if(f.taunt&&alive(f.taunt)&&G.t<f.tauntT)tg=f.taunt;   // 英雄の「不屈」で引きつけられている
    if(!tg&&(d.bldMul||1)>1)tg=nearest(f,G.units,170,u=>!!SU[u.t].isBld);
    if(tg&&!rng&&!d.fly&&SU[tg.t].fly)tg=null;
    if(!tg)tg=nearest(f,G.units,70,u=>SU[u.t].role==='shield');
    if(!tg)tg=nearest(f,G.units,rng?rng+40:200,u=>rng||d.fly||!SU[u.t].fly);
    if(tg&&Math.hypot(tg.x-CX,tg.y-CY)>outerR()+(G.retreat?480:200))tg=null;   // 陣から離れすぎた相手は追わない（撤退のときは遠くまで追ってくる＝殿が要る）
    // 持ち場：自分の場所（大将のテントが襲われたら大将のテント）から離れすぎた相手は追わない。魔物がひとかたまりにならないように
    {const home=G.chiefAtk&&alive(ch)&&!f.def?ch:{x:f.px,y:f.py},lim=f.def==='wolf'?80:f.def==='drum'?90:f.def==='rock'?60:(G.retreat?480:G.chiefAtk?200:230)+rng;if(tg&&Math.hypot(tg.x-home.x,tg.y-home.y)>lim)tg=null;}
    f.tg=tg;
    if(!tg){const c=G.chiefAtk&&alive(ch)?ch:null;   // 大将のテントが襲われたら、戦っていない魔物（外の見張りも）は大将のもとへ
      if(c){if(dist(f,c)>c.r+30)foeStep(f,c.x,c.y,d.spd,dt);}else if(Math.hypot(f.px-f.x,f.py-f.y)>6)foeStep(f,f.px,f.py,d.spd,dt);continue;}
    const reach=(rng||d.r+8)+(SU[tg.t].isBld?14:6),dd=dist(f,tg);
    if(dd>reach){foeStep(f,tg.x,tg.y,d.spd,dt);continue;}
    if(f.cd<=0){f.atkT=G.t;const ar=d.archers;f.cd=ar?ar.rate:d.rate;let dm=ar?ar.dmg:d.dmg*(d.vsS||1);
      if(SU[tg.t].isBld)dm=d.dmg*(d.bldMul||1)*1.5;if(SU[tg.t].red)dm*=1-SU[tg.t].red;
      if(d.ranged&&!d.archers){shoot(f,tg,'#c070ff','curse','curse');G.fx.push({x:tg.x,y:tg.y,r:28,t:0,dur:0.45,c:'#b070e0'});for(const o of G.units)if(alive(o)&&dist(o,tg)<28)hitUnit(o,dm*(o===tg?1:0.7),true);}   // シャーマン：呪いの弾が弾けて、まわりの部隊にも当たる
      else if(d.breath){shoot(f,tg,'#ff7a2a','fireball','fire');for(const o of G.units)if(alive(o)&&dist(o,tg)<26)hitUnit(o,dm*(o===tg?1:0.6),true);}   // ドラゴン：炎で範囲攻撃
      else{if(rng)shoot(f,tg,'#b0e070','arrow_goblin');else if(Math.random()<0.5)vfx('dust',tg.x,tg.y-4,1.2);hitUnit(tg,dm,!!rng);}}
  }
  // --- 物見櫓：見つけたら知らせ、撃つ ---
  for(const b of G.blds){if(b.kind!=='tower'||!alive(b))continue;b.cd-=dt;const t=nearest(b,G.units,b.rng);if(!t)continue;if(!G.alarm)raiseAlarm('物見櫓に見つかった',b);if(b.cd>0)continue;b.cd=b.rate;let dm=b.dmg*(SU[t.t].isBld?0.3:1);if(SU[t.t].red)dm*=1-SU[t.t].red;b.atkT=G.t;b.face=t.x>b.x?1:-1;shoot(b,t,null,'arrow_goblin');hitUnit(t,dm,true,b);}
  // 大弓台：遠くまで届く太い矢。破城槌・投石機を先に狙う
  for(const b of G.blds){if(b.kind!=='bow'||!alive(b))continue;b.cd-=dt;if(!G.alarm||b.cd>0)continue;const t=nearest(b,G.units,b.rng,u=>!!SU[u.t].isBld)||nearest(b,G.units,b.rng);if(!t)continue;b.cd=b.rate;let dm=b.dmg*(SU[t.t].isBld?2:1);if(SU[t.t].red)dm*=1-SU[t.t].red;shoot(b,t,'#e0c080','bolt');hitUnit(t,dm,true,b);}
  for(const bm of (G.bombs||[])){bm.t-=dt;if(bm.t<=0&&!bm.done){bm.done=true;sfx('boom');vfx('explosion',bm.x,bm.y,2.6);G.fx.push({x:bm.x,y:bm.y,r:46,t:0,dur:0.6,c:'#ffb040'});G.fx.push({x:bm.x,y:bm.y,r:24,t:0,dur:0.4,c:'#fff0a0'});
    for(const b of G.blds)if(alive(b)&&b.kind!=='chief'&&Math.hypot(b.x-bm.x,b.y-bm.y)<40+b.r)hitBld(b,b.kind==='post'||b.kind==='abatis'?999:550);for(const f of G.foes)if(alive(f)&&!flyF(f)&&Math.hypot(f.x-bm.x,f.y-bm.y)<40)hitFoe(f,80);}}
  if(G.bombs)G.bombs=G.bombs.filter(b=>!b.done);
  for(const s of G.shots){s.t+=dt;if(s.t>=s.dur&&s.fx&&!s.done){s.done=true;vfx(s.fx,s.tx,s.ty,s.fx==='explosion'?2:1.5);}}G.shots=G.shots.filter(s=>s.t<s.dur);
  for(const t of (G.ftx||[]))t.a+=dt;if(G.ftx)G.ftx=G.ftx.filter(t=>t.a<1.6);for(const f of (G.flares||[]))f.t-=dt;if(G.flares)G.flares=G.flares.filter(f=>f.t>0);for(const b of (G.bolts||[]))b.t-=dt;if(G.bolts)G.bolts=G.bolts.filter(b=>b.t>0);
  for(const v of (G.vfx||[]))v.t+=dt;if(G.vfx)G.vfx=G.vfx.filter(v=>v.t<0.5);for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);
  // 終わり：夜明け・テントを全部焼いた・全滅
  if(G.t>=NIGHT_SEC)return endBattle('dawn');
  const tentsLeft=G.blds.some(b=>isTent(b)&&b.hp>0),foesLeft=G.foes.some(alive);
  if(!tentsLeft&&!foesLeft)return endBattle('complete');
  if(!tentsLeft&&!G.burnedAll){G.burnedAll=true;msg('テントを全部焼いた！ 残りの魔物も倒すか、「引き上げる」で戻ろう');sfx('upgrade');const q=$('sgQuit');if(q&&!G.retreat)q.textContent='引き上げる';}
  if(!G.units.some(alive)&&G.units.some(u=>u.out)&&(G.retreat||!ORDER.some(k=>G.pool[k]>0)))return endBattle('retreat');
  if(G.retreat&&!G.units.some(alive))return endBattle('lose');
  if(!G.units.some(alive)&&!ORDER.some(k=>G.pool[k]>0))return endBattle('lose');
}
function attack(u,tg,atk){const d=SU[u.t];if(tg.k&&flyF(tg)&&!hitsAir(d))return;   // 空の魔物には届かない
  if(d.role==='eng'&&tg.kind&&['gate','post','abatis','tower'].includes(tg.kind)&&(u.bombCd||0)<=G.t){   // 柵・門・逆茂木・物見櫓は爆薬で吹き飛ばす
   u.bombCd=G.t+14;(G.bombs=G.bombs||[]).push({x:tg.x,y:tg.y,t:2.2});msg('工兵が爆薬をしかけた！');sfx('click');return;}
  u.atkT=G.t;
  if(d.role==='cat'){shoot(u,tg,'#c8a070','stone_big','explosion');setTimeout(()=>{if(!G||!G.blds)return;const sp=d.splash;G.fx.push({x:tg.x,y:tg.y,r:sp,t:0,dur:0.4,c:'#c8a070'});
      for(const b of G.blds)if(alive(b)&&Math.hypot(b.x-tg.x,b.y-tg.y)<sp+b.r)hitBld(b,atk*d.bld);for(const f of G.foes)if(alive(f)&&!flyF(f)&&Math.hypot(f.x-tg.x,f.y-tg.y)<sp)hitFoe(f,atk*0.6);},250/G.speed);sfx('how');return;}
  if(d.role==='drake'||d.role==='gun'){shoot(u,tg,d.role==='drake'?'#ff7a2a':'#c8c8c8',d.role==='drake'?'fireball':'cannonball',d.role==='drake'?'fire':'explosion');if(d.role==='gun')vfx('muzzle',u.x+u.face*10,u.y-8,1.2);const sp=d.splash,x=tg.x,y=tg.y;G.fx.push({x,y,r:sp,t:0,dur:0.35,c:d.role==='drake'?'#ff5a1e':'#d0d0d0'});
    for(const b of G.blds)if(alive(b)&&Math.hypot(b.x-x,b.y-y)<sp+b.r)hitBld(b,atk*d.bld*(isTent(b)&&d.tentMul?d.tentMul:1));for(const f of G.foes)if(alive(f)&&(d.role==='drake'||!flyF(f))&&Math.hypot(f.x-x,f.y-y)<sp)hitFoe(f,atk*0.8);sfx(d.role==='gun'?'boom':'hit');return;}
  if(d.magic){shoot(u,tg,null,'arcane');const sp=d.splash;G.fx.push({x:tg.x,y:tg.y,r:sp,t:0,dur:0.35,c:'#9a7aff'});   // 魔術師：魔法の弾が弾けて、まわりにも当たる
    if(tg.kind)hitBld(tg,atk*d.bld);for(const f of G.foes)if(alive(f)&&Math.hypot(f.x-tg.x,f.y-tg.y)<sp)hitFoe(f,atk*(f===tg?1:0.6));return;}
  if(d.role==='ranged')shoot(u,tg,null,'arrow');
  else if(Math.random()<0.5)vfx('dust',tg.x+(Math.random()-0.5)*8,tg.y-4,d.role==='ram'?2:1.2);   // 近接：当たったところに土ぼこり
  if(tg.kind)hitBld(tg,atk*d.bld);else{let a=atk;if(u.sk&&u.sk.id==='moutotsu'&&G.t-(u.chgT||-9)>2){a*=2;tg.stunT=1;u.chgT=G.t;txt(tg.x,tg.y-20,'猛突！',hColor(u.hero));}hitFoe(tg,a);}
  if(d.role==='ram')sfx('hit');
}
// 敵へのダメージ：起きていた魔物（3割）のうち倒した割合 ＋ テントの焼けた割合 × 眠っていた魔物（7割）
function result(){const FF=G.foes.filter(f=>!f.def),dF=G.foes.filter(f=>f.def),awF=FF.filter(f=>!f.fromTent),awN=awF.length,kill=FF.filter(f=>!alive(f)).length,defN=dF.length,defK=dF.filter(f=>!alive(f)).length,kAw=awF.filter(f=>!alive(f)).length,emN=FF.length-awN,emK=kill-kAw,sN=G.foes.filter(f=>f.sentry).length,sK=G.foes.filter(f=>f.sentry&&!alive(f)).length;
  const tN=G.blds.filter(isTent).length,tB=G.blds.filter(b=>isTent(b)&&b.hp<=0).length,chiefDown=G.blds.some(b=>b.kind==='chief'&&b.hp<=0);
  const burned=G.blds.filter(b=>isTent(b)&&b.hp<=0).reduce((a,b)=>a+(b.kind==='chief'?2:1),0);
  const tentPct=burned/G.tentTotal,killPct=awN?kill/awN:0;const all=total(G.st),sleepKill=G.blds.reduce((a,b)=>a+(b.burnK||0),0),dmgN=kill+sleepKill;
  return {kill,awN,sN,sK,tN,tB,chiefDown,sleepKill,kAw,emN,emK,defN,defK,huts:G.blds.filter(b=>b.kind==='hut'||b.kind==='nest').length,sleeping:G.sleeping,tentPct:Math.round(tentPct*100),killPct:Math.round(killPct*100),dmgN,all,dmgPct:Math.round(dmgN/Math.max(1,all)*100)};}
// 部隊ごとの損耗：出した兵（破城槌・投石機は1台）と、戦いのあと残った数。撤退中に取り残された部隊は失った扱い
function menLeft(u){if(u.out)return mem(Object.assign({},u,{hp:u.keepHp}));if(alive(u)&&!G.retreat)return mem(u);return 0;}
function lossTable(){const T={};for(const u of G.units){const k=u.t,d=SU[k];const o=T[k]=T[k]||{sq:0,m0:0,m1:0,wiped:0,out:0};o.sq++;o.m0+=d.m;const m=menLeft(u);o.m1+=m;if(!m)o.wiped++;if(u.out)o.out++;}return T;}
function saveLog(r,why){try{const L=JSON.parse(localStorage.getItem('nd_siege_log')||'[]');L.unshift({d:Date.now(),raid:G.raid,lay:G.lay,dmg:r.dmgPct,why,t:Math.round(G.t),loss:lossTable(),heroes:G.units.filter(u=>u.hero).map(u=>({n:u.hero.name,t:u.t,sk:u.sk?u.sk.name:'',c:u.skN||0,men:menLeft(u),m0:SU[u.t].m}))});localStorage.setItem('nd_siege_log',JSON.stringify(L.slice(0,20)));}catch(e){}}
function lossHtml(T){return `<table class="sgLoss"><tr><th>部隊</th><th>出した部隊</th><th>兵（出発→残り）</th><th>損耗率</th><th>全滅した部隊</th>${G&&G.retreat?'<th>逃げ切った部隊</th>':''}</tr>${ORDER.filter(k=>T[k]).map(k=>{const o=T[k],lp=o.m0?Math.round((1-o.m1/o.m0)*100):0;return `<tr><td>${SU[k].n}</td><td>${o.sq}部隊</td><td>${o.m0}人 → ${o.m1}人</td><td style="color:${lp>=70?'#ff5a4e':lp>=40?'#f2b33d':'#6fe08a'}">${lp}%</td><td>${o.wiped}</td>${G&&G.retreat?`<td>${o.out}</td>`:''}</tr>`;}).join('')}</table>`;}
function endBattle(why){if(!G||G.phase==='end')return;G.phase='end';const r=result(),lostSq=G.units.filter(u=>!u.out&&(!alive(u)||G.retreat)).length,outSq=G.units.filter(u=>u.out).length;
  const men0=G.units.reduce((a,u)=>a+(SU[u.t].m>1?SU[u.t].m:0),0),men=G.units.filter(u=>u.out||(alive(u)&&!G.retreat)).reduce((a,u)=>a+(SU[u.t].m>1?mem(u.out?Object.assign({},u,{hp:u.keepHp}):u):0),0);
  sfx(r.dmgPct>=50?'clear':'turn');
  const t={dawn:'夜が明けた',complete:'陣を壊滅させた！',lose:'夜襲の部隊が全滅した',retreat:G.burnedAll?'テントを焼き払って引き上げた':'撤退した'}[why];
  const killW=r.all?r.kill/r.all*100:0,burnW=r.all?r.sleepKill/r.all*100:0,grade=r.dmgPct>=90?['大戦果','#ffd060']:r.dmgPct>=60?['戦果あり','#ffb040']:r.dmgPct>=30?['小さな戦果','#c8c8a0']:['戦果わずか','#8aa48d'];
  const bar=(v,m,c)=>`<i class="sgMini"><b style="width:${m?Math.round(v/m*100):0}%;background:${c}"></b></i>`;
  const box=document.createElement('div');box.className='sgEnd';box.innerHTML=`<div class="sgEH"><span>${t}</span><em style="color:${grade[1]}">${grade[0]}</em></div>
    <div class="sgBig"><div><small>敵へのダメージ</small><b>${r.dmgPct}%</b></div><div class="sgSum">駐留していた魔物 <b>${r.all}</b> 体のうち、<b style="color:#ffb040">${r.dmgN}</b> 体ぶんを減らした<br><small>本番なら（案）：この駐留地から来る次の襲撃が ${r.dmgPct}% 減る</small></div></div>
    ${(()=>{const BN={tent:'テント',hut:'小屋',nest:'竜の巣',chief:'大将のテント',tower:'物見櫓',gate:'門',abatis:'逆茂木',post:'柵の杭'};
      const BK=['chief','tent','hut','nest','tower','gate','abatis'],bt=k=>G.blds.filter(b=>b.kind===k);let bA=0,bD=0;
      const bRows=BK.filter(k=>bt(k).length).map(k=>{const a=bt(k).length,dd=bt(k).filter(b=>b.hp<=0).length;bA+=a;bD+=dd;return `<div class="sgL"><span>${BN[k]}</span><b>${dd} / ${a}</b>${bar(dd,a,'#ff9a2a')}</div>`;}).join('');
      const pst=bt('post'),pD=pst.filter(b=>b.hp<=0).length;
      const kd={};for(const f of G.foes)if(!f.def&&!alive(f))kd[f.k]=(kd[f.k]||0)+1;for(const b of G.blds)if(b.burnBy)for(const k in b.burnBy)kd[k]=(kd[k]||0)+b.burnBy[k];
      const all=total(G.st),kAll=Object.values(kd).reduce((a,v)=>a+v,0);
      const mRows=Object.keys(G.st).sort((a,b)=>G.st[b]-G.st[a]).map(k=>`<div class="sgL"><span>${ename(k)}</span><b>${kd[k]||0} / ${G.st[k]}</b>${bar(kd[k]||0,G.st[k],'#ff5a4e')}</div>`).join('');
      const T=lossTable(),sm=Object.values(T).reduce((a,o)=>[a[0]+o.m0,a[1]+o.m1],[0,0]),sp=sm[0]?Math.round(sm[1]/sm[0]*100):0;
      return `<div class="sgCards2">
      <div class="sgCard"><h4>壊した建物 <b style="color:#ff9a2a">${bA?Math.round(bD/bA*100):0}%</b></h4>${bRows}<div class="sgL tot"><span>合計</span><b>${bD} / ${bA}</b></div><div class="sgL"><span>柵の杭</span><b>${pD} / ${pst.length}</b><small>（合計に入れない）</small></div></div>
      <div class="sgCard"><h4>倒した魔物 <b style="color:#ff5a4e">${all?Math.round(kAll/all*100):0}%</b></h4>${mRows}<div class="sgL tot"><span>合計</span><b>${kAll} / ${all}</b></div>${r.defN?`<div class="sgL"><span>守りの魔物</span><b>${r.defK} / ${r.defN}</b><small>（数に入れない）</small></div>`:''}<small class="muted">建物ごと焼けた魔物も入る</small></div>
      <div class="sgCard"><h4>生き残った兵 <b style="color:#6fe08a">${sp}%</b></h4><div class="sgL"><span>出した兵</span><b>${sm[0]}人</b></div><div class="sgL"><span>生き残った兵</span><b>${sm[1]}人</b>${bar(sm[1],sm[0],'#6fe08a')}</div><div class="sgL"><span>失った兵</span><b style="color:#ff8a6a">${sm[0]-sm[1]}人</b></div>${G.retreat?`<div class="sgL"><span>逃げ切った兵</span><b>${G.units.filter(u=>u.out).reduce((a,u)=>a+menLeft(u),0)}人</b></div>`:''}<div class="sgL tot"><span>かかった時間</span><b>${Math.floor(G.t/60)}:${String(Math.round(G.t)%60).padStart(2,'0')}</b></div><small class="muted">破城槌・投石機は1台＝1人として数える</small></div>
    </div>`;})()}
    ${G.units.some(u=>u.hero)?`<div class="sgHeroes">${G.units.filter(u=>u.hero).map(u=>`<span style="color:${hColor(u.hero)}">${u.hero.name}（${SU[u.t].n}）スキル「${u.sk?u.sk.name:'-'}」${u.skN||0}回${alive(u)||u.out?'':'・部隊は倒れた'}</span>`).join('')}</div>`:''}
    <div class="sgFoot"><button id="sgAgain">同じ編成でもう一度</button><button id="sgEdit">編成を変える</button><button id="sgClose">タイトルへ</button></div>`;
  {const T=lossTable();const sm=Object.values(T).reduce((a,o)=>[a[0]+o.m0,a[1]+o.m1],[0,0]);const el=document.createElement('details');el.className='sgLossBox';el.open=true;el.innerHTML=`<summary>部隊ごとの損耗（兵 ${sm[0]}人 → ${sm[1]}人、損耗 ${sm[0]?Math.round((1-sm[1]/sm[0])*100):0}%）</summary>${lossHtml(T)}`;box.querySelector('.sgFoot').before(el);saveLog(r,why);}
  $('siege').appendChild(box);
  const keep=G.start,raid=G.raid,lay=G.layout;
  $('sgAgain').onclick=()=>{G={phase:'setup',pool:Object.assign({},keep),raid,layout:lay,speed:G.speed,paused:false,start:keep};G.st=stationed(raid);G.aw=awakeOf(G.st);startDeploy();};
  $('sgEdit').onclick=()=>{cancelAnimationFrame(raf);G={phase:'setup',pool:Object.assign({},keep),raid,layout:lay,speed:1,paused:false};renderSetup();};
  $('sgClose').onclick=closeSiege;}

// ---------- 描く ----------
function drawRam(g,x,y,s,face){g.save();g.translate(x,y);g.scale(s*(face<0?-1:1),s);
  g.fillStyle='#3a2a1a';g.fillRect(-14,-9,28,14);g.fillStyle='#6a4a2a';g.fillRect(-13,-8,26,6);g.fillStyle='#8a6a3a';for(let i=-12;i<12;i+=6)g.fillRect(i,-8,3,6);
  g.fillStyle='#5a5a62';g.fillRect(12,-4,6,6);g.fillStyle='#9aa0a8';g.fillRect(16,-3,3,4);g.fillStyle='#1c1210';for(const wx of [-9,0,9]){g.beginPath();g.arc(wx,6,3.5,0,7);g.fill();}g.restore();}
function drawCat(g,x,y,s,face){g.save();g.translate(x,y);g.scale(s*(face<0?-1:1),s);
  g.fillStyle='#4a3420';g.fillRect(-12,0,24,6);g.fillStyle='#1c1210';for(const wx of [-8,8]){g.beginPath();g.arc(wx,7,4,0,7);g.fill();}
  g.strokeStyle='#8a6a3a';g.lineWidth=3;g.beginPath();g.moveTo(-6,1);g.lineTo(8,-13);g.stroke();g.fillStyle='#6a6a6a';g.beginPath();g.arc(9,-14,3.5,0,7);g.fill();g.fillStyle='#6a4a2a';g.fillRect(-2,-6,4,7);g.restore();}
// シーカー：駐留地では乗り手のゴブリン（背中の箱と耳）はいない
let HEAVY=null;function heavyFrame(w){if(HEAVY===null){HEAVY=[];try{const sp=NDSPR.enemies.e_heavy;for(const fr of sp.anims.walk){const rows=fr.map((r,i)=>i<5&&/[bcdef]/.test(fr.slice(0,5).join(''))?r:r);
    let last=-1;fr.forEach((r,i)=>{if(/[bcdef]/.test(r.slice(0,10)))last=i;});const c=document.createElement('canvas');c.width=c.height=sp.size;const g=c.getContext('2d');
    fr.forEach((r,y)=>{for(let x=0;x<r.length;x++){const ch=r[x];if(ch==='.'||(y<=last&&x<10))continue;g.fillStyle=sp.pal[ch];g.fillRect(x,y,1,1);}});HEAVY.push(c);}}catch(e){HEAVY=[];}}
  return HEAVY.length?HEAVY[Math.floor(w)%HEAVY.length]:sprFrame('enemies','e_heavy',w,null);}
function sprFrame(cat,k,an,atk){const sp=typeof SPR!=='undefined'&&SPR[cat]&&SPR[cat][k];if(!sp)return null;if(atk!=null&&sp.img.attack){const L=sp.img.attack;return L[Math.min(L.length-1,Math.floor(atk/0.1))];}const L=sp.img.walk||sp.img[Object.keys(sp.img)[0]];return L[Math.floor(an)%L.length];}
function campPath(g,bd,pad){if(bd.t==='circle'){g.arc(CX,CY,bd.r+pad,0,Math.PI*2);}else{g.rect(CX-bd.a-pad,CY-bd.b-pad,(bd.a+pad)*2,(bd.b+pad)*2);}}
function draw(tt){const g=cx;if(!g||!G||!G.blds)return;g.setTransform(1,0,0,1,0,0);g.fillStyle='#070a08';g.fillRect(0,0,cv.width,cv.height);(cam(),g.setTransform(G.k,0,0,G.k,G.ox,G.oy));g.imageSmoothingEnabled=false;
  if(!G.ground){const c=document.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');q.fillStyle='#2f4a26';q.fillRect(0,0,W,H);
    if(G.mo&&typeof terCv!=='undefined'&&terCv){q.imageSmoothingEnabled=false;q.drawImage(terCv,G.mo.x,G.mo.y,W,H,0,0,W,H);
      // 陣のまわりは切り開いた土地
      q.save();q.beginPath();campPath(q,G.bounds[0],45);q.clip();q.fillStyle='#3a4a2a';q.fillRect(0,0,W,H);for(let i=0;i<3000;i++){q.fillStyle=['#425430','#36462a','#4a5a34'][i%3];q.fillRect((i*137)%W,(i*311+(i*i)%97)%H,2,2);}q.restore();}
    else for(let i=0;i<5000;i++){q.fillStyle=['#36552c','#2a4222','#3b5a30','#283e20'][i%4];q.fillRect((i*137)%W,(i*311+(i*i)%97)%H,2,2);}
    G.bounds.forEach((bd,i)=>{q.fillStyle=i?'rgba(50,36,20,.5)':'rgba(70,52,30,.55)';q.beginPath();campPath(q,bd,6);q.fill();});G.ground=c;}
  g.drawImage(G.ground,0,0);
  // 置ける所・置けない所：配置中（または部隊の札を選んでいる間）は、置ける所を水色、置けない所を赤っぽく。境目に線
  if(G.phase==='deploy'||(G.card&&!G.retreat)){if(!G.depCv||G.depCv.blk!==gridT()){const c=document.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');const ok=[];
      for(let r=0;r<GROW;r++)for(let cc=0;cc<GCOL;cc++)ok[r*GCOL+cc]=canDeploy({x:cc*GS+GS/2,y:r*GS+GS/2});
      for(let r=0;r<GROW;r++)for(let cc=0;cc<GCOL;cc++){const v=ok[r*GCOL+cc];q.fillStyle=v?'rgba(98,198,217,.24)':'rgba(110,10,10,.40)';q.fillRect(cc*GS,r*GS,GS,GS);}
      q.strokeStyle='rgba(140,230,255,.9)';q.lineWidth=2;q.beginPath();for(let r=0;r<GROW;r++)for(let cc=0;cc<GCOL;cc++){const v=ok[r*GCOL+cc];if(cc+1<GCOL&&ok[r*GCOL+cc+1]!==v){q.moveTo((cc+1)*GS,r*GS);q.lineTo((cc+1)*GS,(r+1)*GS);}if(r+1<GROW&&ok[(r+1)*GCOL+cc]!==v){q.moveTo(cc*GS,(r+1)*GS);q.lineTo((cc+1)*GS,(r+1)*GS);}}q.stroke();
      c.blk=gridT();G.depCv=c;}
    g.drawImage(G.depCv,0,0);}
  for(const t of G.traps){if(t.hp<=0)continue;g.fillStyle='#3a3228';g.fillRect(t.x-6,t.y-6,12,12);g.fillStyle='#c8c8c0';for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.beginPath();g.moveTo(t.x-4+i*6,t.y-1+j*5);g.lineTo(t.x-3+i*6,t.y-5+j*5);g.lineTo(t.x-2+i*6,t.y-1+j*5);g.fill();}}
  // 建物
  for(const b of G.blds){if(b.hp<=0){if(b.kind!=='post'){g.fillStyle='rgba(30,22,16,.85)';g.beginPath();g.ellipse(b.x,b.y+4,b.r,b.r*0.5,0,0,7);g.fill();}continue;}
    if(b.kind==='post'){g.fillStyle='#4a3018';g.fillRect(b.x-4,b.y-11,8,15);g.fillStyle='#7a5430';g.fillRect(b.x-3,b.y-11,3,14);g.fillStyle='#a07848';g.beginPath();g.moveTo(b.x-4,b.y-11);g.lineTo(b.x,b.y-16);g.lineTo(b.x+4,b.y-11);g.fill();}
    else if(b.kind==='gate'){const hz=Math.abs(b.nx)>0.7;g.fillStyle='#3a2410';if(hz)g.fillRect(b.x-6,b.y-18,12,32);else g.fillRect(b.x-18,b.y-12,36,18);g.fillStyle='#6a4422';if(hz)for(let i=-14;i<12;i+=6)g.fillRect(b.x-5,b.y+i,10,3);else for(let i=-16;i<16;i+=6)g.fillRect(b.x+i,b.y-11,3,16);
      g.fillStyle='#5a5a62';if(hz){g.fillRect(b.x-7,b.y-19,14,3);g.fillRect(b.x-7,b.y+12,14,3);}else{g.fillRect(b.x-19,b.y-13,3,20);g.fillRect(b.x+16,b.y-13,3,20);}}
    else if(b.kind==='tower'){g.fillStyle='#3a2410';g.fillRect(b.x-11,b.y-22,3,30);g.fillRect(b.x+8,b.y-22,3,30);g.strokeStyle='#5a3a1c';g.lineWidth=2;g.beginPath();g.moveTo(b.x-9,b.y+4);g.lineTo(b.x+9,b.y-18);g.moveTo(b.x+9,b.y+4);g.lineTo(b.x-9,b.y-18);g.stroke();g.lineWidth=1;   // 物見櫓：丸太を組んだ台の上にゴブリンアーチャー
      g.fillStyle='#6a4a2a';g.fillRect(b.x-15,b.y-26,30,6);g.fillStyle='#4a3018';for(let i=-14;i<=12;i+=5)g.fillRect(b.x+i,b.y-32,2,7);
      {const im=sprFrame('enemies','e_gobarcher',tt*3+b.id,b.atkT!=null&&G.t-b.atkT<0.4?G.t-b.atkT:null);if(im){g.save();g.translate(b.x,b.y-25);if(b.face>0)g.scale(-1,1);g.drawImage(im,-10,-18,20,20);g.restore();}}}
    else if(b.kind==='bow'){g.fillStyle='#3a2a1a';g.fillRect(b.x-12,b.y-6,24,14);g.strokeStyle='#8a6a3a';g.lineWidth=3;g.beginPath();g.arc(b.x,b.y-4,13,Math.PI*1.15,Math.PI*1.85);g.stroke();g.strokeStyle='#c8c0a8';g.lineWidth=1;g.beginPath();g.moveTo(b.x-11,b.y-9);g.lineTo(b.x+11,b.y-9);g.stroke();g.fillStyle='#d0d0d0';g.fillRect(b.x-1,b.y-20,2,14);}
    else if(b.kind==='abatis'){g.strokeStyle='#6a4422';g.lineWidth=3;for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(b.x-10,b.y+6+i*2);g.lineTo(b.x+10,b.y-8+i*2);g.stroke();g.beginPath();g.moveTo(b.x-10,b.y-8+i*2);g.lineTo(b.x+10,b.y+6+i*2);g.stroke();}g.lineWidth=1;}
    else if(b.kind==='nest'){g.fillStyle='#4a4038';g.beginPath();g.ellipse(b.x,b.y+4,22,9,0,0,7);g.fill();g.fillStyle='#5a4a3a';g.beginPath();g.ellipse(b.x,b.y-2,19,9,0,0,7);g.fill();   // 竜の巣：岩の上に枝を組んだ巣と卵
      g.strokeStyle='#8a6a40';g.lineWidth=2;for(let i=0;i<7;i++){const a=i/7*Math.PI;g.beginPath();g.moveTo(b.x-18+i*6,b.y-6);g.lineTo(b.x-14+i*5,b.y+2+Math.sin(a)*2);g.stroke();}g.lineWidth=1;
      g.fillStyle='#3a2a1a';g.beginPath();g.ellipse(b.x,b.y-5,12,4,0,0,7);g.fill();for(const [ex,ec] of [[-5,'#d8c8a0'],[2,'#c8b890'],[8,'#e0d0b0']]){g.fillStyle=ec;g.beginPath();g.ellipse(b.x+ex-1,b.y-8,3.5,5,0,0,7);g.fill();}
      if(!G.alarm){g.fillStyle='rgba(220,230,255,.7)';g.font='9px sans-serif';g.fillText('z',b.x+14,b.y-14-((tt*8+b.id)%10));}}
    else if(b.kind==='hut'){g.fillStyle='#4a3420';g.fillRect(b.x-17,b.y-7,34,17);g.fillStyle='#5e4228';for(let i=0;i<4;i++)g.fillRect(b.x-17,b.y-5+i*4,34,1);g.fillStyle='#7a6a3a';g.beginPath();g.moveTo(b.x-23,b.y-5);g.lineTo(b.x,b.y-25);g.lineTo(b.x+23,b.y-5);g.fill();g.fillStyle='#9a8448';g.beginPath();g.moveTo(b.x,b.y-25);g.lineTo(b.x+23,b.y-5);g.lineTo(b.x+8,b.y-5);g.fill();g.fillStyle='#1a1008';g.fillRect(b.x-6,b.y,12,10);
      if(!G.alarm){g.fillStyle='rgba(220,230,255,.7)';g.font='9px sans-serif';g.fillText('z',b.x+12,b.y-18-((tt*8+b.id)%10));}}
    else if(b.kind==='tent'){g.fillStyle='#6a5030';g.beginPath();g.moveTo(b.x-18,b.y+8);g.lineTo(b.x,b.y-18);g.lineTo(b.x+18,b.y+8);g.fill();g.fillStyle='#8a6a40';g.beginPath();g.moveTo(b.x,b.y-18);g.lineTo(b.x+18,b.y+8);g.lineTo(b.x+6,b.y+8);g.fill();g.fillStyle='#2a1c10';g.beginPath();g.moveTo(b.x-5,b.y+8);g.lineTo(b.x,b.y-4);g.lineTo(b.x+5,b.y+8);g.fill();
      if(!G.alarm){g.fillStyle='rgba(220,230,255,.7)';g.font='9px sans-serif';g.fillText('z',b.x+10,b.y-16-((tt*8+b.id)%10));}}
    else if(b.kind==='chief'){g.fillStyle='#5a1a20';g.beginPath();g.moveTo(b.x-28,b.y+12);g.lineTo(b.x,b.y-30);g.lineTo(b.x+28,b.y+12);g.fill();g.fillStyle='#8a2a30';g.beginPath();g.moveTo(b.x,b.y-30);g.lineTo(b.x+28,b.y+12);g.lineTo(b.x+10,b.y+12);g.fill();g.fillStyle='#1c0c0c';g.fillRect(b.x-6,b.y-2,12,14);
      g.fillStyle='#8a1a1a';g.fillRect(b.x-1,b.y-56,3,28);g.fillStyle='#c03030';g.beginPath();g.moveTo(b.x+2,b.y-56);g.lineTo(b.x+22,b.y-50+Math.sin(tt*4)*2);g.lineTo(b.x+2,b.y-44);g.fill();}
    if(b.hp<b.maxhp&&b.kind!=='post'){const w=b.r*2;g.fillStyle='#000';g.fillRect(b.x-w/2,b.y+b.r*0.6+4,w,4);g.fillStyle=isTent(b)?'#ff8a3a':'#f2b33d';g.fillRect(b.x-w/2,b.y+b.r*0.6+4,w*b.hp/b.maxhp,4);}
    }
  for(const bm of (G.bombs||[])){g.fillStyle='#2a1a10';g.fillRect(bm.x-5,bm.y-5,10,8);g.fillStyle=Math.sin(tt*20)>0?'#ffe080':'#ff5a1e';g.fillRect(bm.x+3,bm.y-9,3,3);g.fillStyle='#fff';g.font='9px sans-serif';g.textAlign='center';g.fillText(Math.ceil(bm.t),bm.x,bm.y-12);}
  if(G.phase!=='setup')for(const u of G.units)if(alive(u)&&SU[u.t].role==='shield'){g.strokeStyle='rgba(120,180,255,.22)';g.setLineDash([3,4]);g.beginPath();g.arc(u.x,u.y,48,0,7);g.stroke();g.setLineDash([]);}
  // 焼けたテントの火
  for(const f of (G.fires||[])){for(let i=0;i<3;i++){const h=8+((tt*30+i*7)%10);g.fillStyle=['#ff5a1e','#ffb040','#ffe080'][i];g.fillRect(f.x-6+i*4,f.y-h,4,h);}}
  // 魔物
  for(const f of G.foes){if(!alive(f))continue;const ae=f.atkT!=null&&G.t-f.atkT<0.4?G.t-f.atkT:null;const im=f.k==='heavy'?heavyFrame(f.walk||0):sprFrame('enemies','e_'+f.k,f.walk||0,ae);const sz=Math.max(24,Math.round((E[f.k].r||6)*3));   // 大きな魔物は大きく（シーカー51・マンモス48）
    const fl=flyF(f)&&(f.awake||G.alarm)?12+Math.sin(tt*4+f.id)*2:0;if(fl){g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(f.x,f.y+3,sz/4,sz/10,0,0,7);g.fill();}
    g.save();g.translate(f.x,f.y-fl);if(f.face>0)g.scale(-1,1);if(!f.awake&&!f.sentry)g.globalAlpha=0.75;if(im)g.drawImage(im,-sz/2,-sz+4,sz,sz);else{g.fillStyle=E[f.k].color||'#8ac060';g.fillRect(-5,-10,10,10);}g.restore();
    if(f.sentry&&!G.alarm){g.strokeStyle='rgba(255,220,120,.25)';g.beginPath();g.arc(f.x,f.y,120,0,7);g.stroke();}
    if(f.hp<f.maxhp){g.fillStyle='#000';g.fillRect(f.x-8,f.y+5,16,2);g.fillStyle='#ff5a4e';g.fillRect(f.x-8,f.y+5,16*f.hp/f.maxhp,2);}}
  // こちらの部隊
  for(const u of G.units){if(!alive(u))continue;const d=SU[u.t],n=mem(u),sel=G.sel.has(u.id);
    if(sel){g.strokeStyle='#62c6d9';g.lineWidth=1.5;g.beginPath();g.ellipse(u.x,u.y+4,d.isBld?20:16,d.isBld?9:7,0,0,7);g.stroke();}
    if(d.draw){(d.draw==='ram'?drawRam:drawCat)(g,u.x,u.y,1.4,u.face);}
    else{const au=u.atkT!=null&&G.t-u.atkT<0.4?G.t-u.atkT:null;const im=sprFrame('units',d.spr,u.walk,au);const off=[[0,0],[-9,4],[9,4],[-5,-6],[6,-6],[0,8]];const z=d.fly?30:20;for(let i=n-1;i>=0;i--){const [ox,oy]=off[i%off.length];g.save();g.translate(u.x+ox*(d.fly?1.6:1),u.y+oy-(d.fly?10+Math.sin(tt*4+u.id)*2:0));if(u.face<0)g.scale(-1,1);if(im)g.drawImage(im,-z/2,-z+2,z,z);g.restore();}
      if(d.fly){g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(u.x,u.y+6,14,4,0,0,7);g.fill();}}
    const r=u.hp/u.maxhp;g.fillStyle='#000';g.fillRect(u.x-12,u.y+(d.isBld?14:9),24,3);g.fillStyle=r<0.3?'#ff5a4e':r<0.6?'#f2b33d':'#6fe08a';g.fillRect(u.x-12,u.y+(d.isBld?14:9),24*r,3);
    if(u.guardT>0){u.guardT-=1/60;g.fillStyle='rgba(120,180,255,.9)';g.fillRect(u.x-2,u.y-24,4,5);}
    if(u.fixT>0){u.fixT-=1/60;g.fillStyle='#6fe08a';g.fillRect(u.x-1,u.y-26,2,6);g.fillRect(u.x-3,u.y-24,6,2);}
    if(u.hero){const c=u.hero,col=hColor(c),sp=sprFrame('units',HSPR[c.spec],u.walk,u.atkT!=null&&G.t-u.atkT<0.4?G.t-u.atkT:null);const hy=u.y-(d.fly?14:0)-(d.isBld?10:0);   // 英雄：部隊の先頭に立ち、兵科の色の旗
      if(sp){g.save();g.translate(u.x+u.face*10,hy+2);if(u.face<0)g.scale(-1,1);g.drawImage(sp,-12,-22,24,24);g.restore();}
      g.fillStyle='#2a2018';g.fillRect(u.x-1,hy-34,2,16);g.fillStyle=col;g.fillRect(u.x+1,hy-34,9,6);
      if(u.sk&&u.sk.cd){const r=1-Math.max(0,u.skT)/u.sk.cd;g.fillStyle='rgba(0,0,0,.6)';g.fillRect(u.x-12,u.y+(d.isBld?18:13),24,2);g.fillStyle=col;g.fillRect(u.x-12,u.y+(d.isBld?18:13),24*r,2);}}
    if(u.hold){g.fillStyle='#f2b33d';g.font='8px sans-serif';g.textAlign='center';g.fillText('固守',u.x,u.y-22);}}
  {const P=typeof SPR!=='undefined'&&SPR.projectiles;
   for(const s of G.shots){const k=Math.min(1,s.t/s.dur),x=s.x+(s.tx-s.x)*k,y=s.y+(s.ty-s.y)*k-Math.sin(k*Math.PI)*s.arc;const sp=P&&s.kind&&P[s.kind];
     if(sp){const vy=(s.ty-s.y)-Math.cos(k*Math.PI)*Math.PI*s.arc;const dir=typeof sprDir==='function'?sprDir(Math.atan2(vy,s.tx-s.x)):0;const L=sp.img.dirs||sp.img.anim;const im=sp.img.dirs?(sp.img.anim&&sp.img.anim.length?sp.img.dirs[dir]:L[dir]):L[Math.floor(tt/0.12)%L.length];
       if(s.arc>20&&P.shadow){const sh=P.shadow.img.anim[0];g.globalAlpha=0.5;g.drawImage(sh,Math.round(s.x+(s.tx-s.x)*k-sh.width/2),Math.round(s.y+(s.ty-s.y)*k-sh.height/2));g.globalAlpha=1;}
       const z=s.kind==='bolt'||s.kind==='stone_big'||s.kind==='fireball'?1.5:1.3;if(im)g.drawImage(im,Math.round(x-im.width*z/2),Math.round(y-im.height*z/2),im.width*z,im.height*z);}
     else{g.fillStyle=s.c;g.fillRect(x-1.5,y-1.5,3,3);}}}
  {const EF=typeof SPR!=='undefined'&&SPR.effects;if(EF)for(const v of (G.vfx||[])){const sp=EF[v.k];if(!sp)continue;const L=sp.img.play,i=Math.floor(v.t/0.08);if(i>=L.length)continue;const im=L[i];g.drawImage(im,Math.round(v.x-im.width*v.z/2),Math.round(v.y-im.height*v.z/2),im.width*v.z,im.height*v.z);}}
  for(const f of G.fx){const k=f.t/f.dur;g.globalAlpha=1-k;g.strokeStyle=f.c;g.lineWidth=2;g.beginPath();g.arc(f.x,f.y,f.r*(0.5+k*0.7),0,7);g.stroke();}g.globalAlpha=1;
  // 夜の暗さ（明かりのある所だけ見える）。夜明けが近づくと明るくなる
  {const k=G.phase==='battle'||G.phase==='end'?Math.min(1,G.t/NIGHT_SEC):0,a=0.62-0.4*Math.max(0,k-0.75)/0.25;
    if(!G.dark){G.dark=document.createElement('canvas');G.dark.width=W;G.dark.height=H;}const q=G.dark.getContext('2d');q.globalCompositeOperation='source-over';q.clearRect(0,0,W,H);q.fillStyle=`rgba(6,10,26,${a})`;q.fillRect(0,0,W,H);q.globalCompositeOperation='destination-out';
    const light=(x,y,r)=>{const gr=q.createRadialGradient(x,y,2,x,y,r);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=gr;q.beginPath();q.arc(x,y,r,0,7);q.fill();};
    for(const b of G.blds)if(b.hp>0&&(b.kind==='tower'||b.kind==='gate'||b.kind==='bow'))light(b.x,b.y,70);for(const bm of (G.bombs||[]))light(bm.x,bm.y,40);for(const f of (G.fires||[]))light(f.x,f.y,90);for(const f of (G.flares||[]))light(f.x,f.y,f.r);for(const u of G.units)if(alive(u))light(u.x,u.y,55);for(const f of G.foes)if(alive(f)&&f.sentry)light(f.x,f.y,40);
    g.drawImage(G.dark,0,0);}
  // 雷・スキル名の大きな文字
  for(const b of (G.bolts||[])){g.strokeStyle=`rgba(200,220,255,${Math.min(1,b.t*4)})`;g.lineWidth=2;g.beginPath();g.moveTo(b.a.x,b.a.y);const n=5;for(let i=1;i<n;i++){g.lineTo(b.a.x+(b.b.x-b.a.x)*i/n+(Math.random()-0.5)*10,b.a.y+(b.b.y-b.a.y)*i/n+(Math.random()-0.5)*10);}g.lineTo(b.b.x,b.b.y);g.stroke();g.lineWidth=1;}
  for(const t of (G.ftx||[])){g.globalAlpha=Math.max(0,1-t.a/1.6);g.font=`bold ${t.big?16:11}px sans-serif`;g.textAlign='center';g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.8)';g.strokeText(t.t,t.x,t.y-t.a*14);g.fillStyle=t.c||'#fff';g.fillText(t.t,t.x,t.y-t.a*14);g.globalAlpha=1;g.lineWidth=1;}
  // 撤退する所（戦場の端）。撤退中は赤く光る
  if(G.phase!=='deploy'){const on=G.retreat,a=on?0.3+0.1*Math.sin(tt*5):0.08;g.fillStyle=`rgba(220,40,40,${a})`;g.fillRect(0,0,W,EDGE);g.fillRect(0,H-EDGE,W,EDGE);g.fillRect(0,EDGE,EDGE,H-EDGE*2);g.fillRect(W-EDGE,EDGE,EDGE,H-EDGE*2);
    if(on){g.strokeStyle='rgba(255,90,78,.85)';g.setLineDash([6,4]);g.strokeRect(EDGE,EDGE,W-EDGE*2,H-EDGE*2);g.setLineDash([]);g.fillStyle='#ffd8d0';g.font='bold 13px sans-serif';g.textAlign='center';g.fillText('ここまで逃げれば撤退成功',W/2,22);g.fillText('ここまで逃げれば撤退成功',W/2,H-12);}}
  if(G.box){const {a,b}=G.box;g.strokeStyle='#62c6d9';g.setLineDash([5,3]);g.fillStyle='rgba(98,198,217,.12)';g.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));g.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));g.setLineDash([]);}
}
let hudT=0;function hud(){const now=performance.now();if(now-hudT<200)return;hudT=now;const el=$('sgStat');if(!el||!G||!G.blds)return;const r=result(),left=Math.max(0,Math.ceil(NIGHT_SEC-G.t));
  {const pb=$('sgPB');if(pb)pb.style.width=r.dmgPct+'%';const pt=$('sgPT');if(pt)pt.textContent=r.dmgPct+'%';}
  el.innerHTML=`第${G.raid}襲撃の駐留地（${LAYOUTS[G.lay].n}）　夜明けまで <b>${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</b>　焼いた建物 ${r.tentPct}%　魔物 ${G.foes.filter(alive).length}/${G.foes.length}　味方 ${G.units.filter(alive).length}部隊　${G.retreat?`<b style="color:#ff5a4e">撤退中</b> 逃げ切った ${G.units.filter(u=>u.out).length}部隊`:G.phase==='deploy'?'<b style="color:#62c6d9">配置中</b>':G.alarm?'<b style="color:#ff5a4e">見つかった！</b>':G.phase==='battle'?'<b style="color:#9ab0ff">寝静まっている</b>':''}`;
  if(G.phase==='battle'&&G.units.some(u=>!alive(u)&&G.sel.has(u.id)))renderCmd();}

// ---------- 見た目 ----------
const css=document.createElement('style');css.textContent=`
#sgMusic{position:fixed;inset:0;z-index:960;background:rgba(5,8,6,.82);display:none;align-items:center;justify-content:center;color:#e8e0c8;font-family:inherit}
#sgMusic .sgMBox{width:min(520px,94vw);max-height:92vh;overflow:auto;background:#121a14;box-shadow:0 0 0 2px #f2b33d;padding:14px 18px}#sgMusic h2{margin:0 0 4px;color:#f2b33d;font-size:18px}
#sgMusic .sgML{display:flex;flex-direction:column;gap:6px;margin:10px 0}#sgMusic .sgML button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:8px 10px}#sgMusic .sgML button.on{box-shadow:inset 0 0 0 2px #f2b33d}#sgMusic .sgML small{font-size:11px;color:#9ab0a0}
#sgMusic .sgVol{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:8px 0;font-size:12px}#sgMusic .sgVol label{display:flex;align-items:center;gap:6px}#sgMusic .sgVol input{width:120px}#sgMusic .sgVol b{min-width:24px;color:#f2b33d}
#sgMusic .sgMS{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;font-size:11px;align-items:center}#sgMusic .sgMS b{width:100%;color:#9ab0a0}#sgMusic .sgMS button{display:flex;flex-direction:column;padding:4px 8px;font-size:11px}#sgMusic .sgMS button small{font-size:9px;color:#8aa48d}#sgMusic .sgMS button.on{box-shadow:inset 0 0 0 2px #f2b33d}
#sgMusic .sgMT{display:flex;flex-wrap:wrap;gap:4px 8px;font-size:11px;color:#7f9a82;margin:6px 0}#sgMusic .sgMT b{width:100%;color:#9ab0a0}#sgMusic .sgMT span{padding:1px 6px;box-shadow:inset 0 0 0 1px #2f3f33}
#sgMusic .sgFoot{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
#siege .sgHero{display:flex;flex-direction:column;gap:4px;margin:6px 0;padding:6px 8px;background:rgba(255,255,255,.04);border:1px solid #2f3f33}
#siege .sgHR{display:flex;align-items:center;gap:8px}#siege .sgHN{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;width:auto}#siege .sgHN small{font-size:10px;color:#9ab0a0}#siege .sgHR select{width:auto!important;flex:0 0 auto;max-width:42%;background:#141a16;color:#e8e0c8;border:1px solid #3a4a3e;padding:3px}
#siege .sgKey{font-style:normal;font-size:9px;color:#8aa48d;margin-right:2px;align-self:flex-start}
#siege .sgRk{font-size:10px;font-weight:normal;color:#9ab0a0;margin-left:4px;padding:0 4px;box-shadow:inset 0 0 0 1px #3a4a3e}#siege .sgRk.late{color:#ff9a6a;box-shadow:inset 0 0 0 1px #6a3a2a}
#siege .sgHeroes{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;margin:6px 0}
#siege .sgLossBox,#siege .sgLog{margin:6px 0;font-size:12px}#siege .sgLossBox summary,#siege .sgLog summary{cursor:pointer;color:#f2b33d}
#siege table.sgLoss{border-collapse:collapse;width:100%;margin-top:4px;font-size:11.5px}#siege table.sgLoss th,#siege table.sgLoss td{padding:2px 6px;border-bottom:1px solid #2a3a2d;text-align:center}#siege table.sgLoss th{color:#9ab0a0;font-weight:normal}
#siege{position:fixed;inset:0;z-index:95;background:#0b0f0c;display:none;flex-direction:column;color:var(--text,#cfe3cf);font-size:13px}
body.siegeOn #boot{display:none}
#siege .sgSetup{margin:auto;width:min(780px,96vw);max-height:96vh;overflow:auto;background:var(--panel,#121a14);box-shadow:0 0 0 2px #f2b33d;padding:14px 18px}
#siege h2{margin:0 0 8px;color:#f2b33d;font-family:var(--px-font,inherit);font-weight:400}#siege h2 small{font-size:12px;color:var(--dim,#7f9a82);margin-left:10px}
#siege .sgRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}#siege .sgRow>b{min-width:72px}#siege .sgRow>small{flex:1;min-width:220px;font-size:11px;line-height:1.5}
#siege .sgRow>button{padding:5px 12px}
#siege .sgRaid{display:inline-flex;align-items:center;gap:6px}#siege .sgRaid b{min-width:72px;text-align:center;font-size:15px}#siege .sgRaid button{width:30px;padding:2px 0}
#siege button.on{box-shadow:inset 0 0 0 2px #f2b33d;color:#f2b33d;background:#2a2210}
#siege .sgHelp{font-size:12px;color:var(--dim,#7f9a82);margin:4px 0 8px;line-height:1.6}
#siege .sgUnits{display:flex;flex-direction:column;gap:4px}
#siege .sgU{display:flex;align-items:center;gap:10px;padding:4px 8px;background:var(--inset,#0e1510);box-shadow:inset 0 0 0 1px var(--line,#2a3a2d)}
#siege .sgN{flex:1;display:flex;flex-direction:column}#siege .sgN small{font-size:10.5px;color:var(--dim,#7f9a82)}
#siege .sgC{display:flex;align-items:center;gap:6px}#siege .sgC b{min-width:24px;text-align:center;font-size:16px}#siege .sgC button{width:30px;padding:2px 0}
#siege .sgFoot{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap}
#siege .sgTop{display:flex;align-items:center;gap:10px;padding:4px 10px;background:var(--panel,#121a14);box-shadow:0 1px 0 var(--line,#2a3a2d);flex-shrink:0;flex-wrap:wrap}
#siege .sgTop .grow{flex:1}
#siege .sgProg{display:inline-flex;align-items:center;gap:6px}#siege .sgProg small{font-size:11px;color:var(--dim,#7f9a82)}#siege .sgProg i{display:block;width:180px;height:10px;background:#2a1410;box-shadow:inset 0 0 0 1px #5a2a20}#siege .sgProg i b{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff5a1e,#ffb040);transition:width .3s}#siege .sgProg em{font-style:normal;font-family:var(--px-font,inherit);color:#ffb040;min-width:40px}#siege .sgTop #sgStat{font-size:12px}
#siege canvas{flex:1;min-height:0;width:100%;display:block;touch-action:none}
#siege .sgBot{display:flex;gap:10px;align-items:center;padding:4px 8px;background:var(--panel,#121a14);flex-shrink:0;flex-wrap:wrap}
#siege .sgCards{display:flex;gap:4px;flex-wrap:wrap;flex:1}#siege .sgCards button{display:inline-flex;align-items:center;gap:4px;padding:3px 8px}#siege .sgCards button b{color:#f2b33d}
#siege .sgCmd{display:flex;gap:4px;align-items:center;flex-wrap:wrap}#siege .sgCmd button{padding:3px 8px}
#siege .sgMsg{position:absolute;left:50%;top:52px;transform:translateX(-50%);background:rgba(10,14,11,.92);box-shadow:inset 0 0 0 1px #f2b33d;padding:6px 14px;opacity:0;transition:opacity .3s;pointer-events:none;max-width:90vw;text-align:center;z-index:2}
#siege .sgMsg.on{opacity:1}
#siege .sgEnd{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--panel,#121a14);box-shadow:0 0 0 2px #f2b33d,0 10px 30px #000;padding:14px 20px;min-width:min(460px,92vw);z-index:3}
#siege .sgEnd{width:min(720px,94vw);max-height:94vh;overflow:auto}
#siege .sgEH{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}#siege .sgEH span{font-family:var(--px-font,inherit);font-size:20px;color:#f2b33d}#siege .sgEH em{font-style:normal;font-family:var(--px-font,inherit);font-size:18px}
#siege .sgBig{display:flex;align-items:center;gap:18px;margin:0 0 8px}#siege .sgBig>div:first-child{display:flex;flex-direction:column;align-items:center}#siege .sgBig>div small{font-size:11px;color:var(--dim,#7f9a82)}
#siege .sgBig>div:first-child b{font-family:var(--px-font,inherit);font-weight:400;font-size:44px;line-height:1;color:#ff8a6a}#siege .sgSum{font-size:13px;line-height:1.7}#siege .sgSum b{font-size:15px}
#siege .sgStack{display:flex;height:16px;background:#2a1410;box-shadow:inset 0 0 0 1px #5a2a20;margin:4px 0}#siege .sgStack b{display:block;height:100%}
#siege .sgLeg{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin-bottom:10px}#siege .sgLeg i{display:inline-block;width:10px;height:10px;margin-right:4px;vertical-align:-1px}
#siege .sgCards2{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#siege .sgCard{background:var(--inset,#0e1510);box-shadow:inset 0 0 0 1px var(--line,#2a3a2d);padding:8px 10px}#siege .sgCard h4{margin:0 0 6px;font-size:12px;color:var(--dim,#7f9a82);font-weight:400}
#siege .sgL{display:grid;grid-template-columns:1fr auto;align-items:center;gap:0 8px;font-size:12px;margin:3px 0}#siege .sgL b{font-family:var(--px-font,inherit);font-weight:400;font-size:15px}#siege .sgL small{grid-column:1/-1;font-size:10px;color:var(--dim,#7f9a82)}#siege .sgL .sgMini{grid-column:1/-1}
#siege .sgL.tot{border-top:1px solid var(--line,#2a3a2d);padding-top:4px;margin-top:6px}#siege .sgL.tot b{color:#f2b33d}
#siege .sgMini{display:block;height:5px;background:#1a221c}#siege .sgMini b{display:block;height:100%}
@media (max-width:900px){#siege .sgCards2{grid-template-columns:1fr 1fr 1fr;gap:4px}#siege .sgCard{padding:4px 6px}#siege .sgBig>div:first-child b{font-size:32px}#siege .sgEnd{padding:8px 12px}}
#siege .sgEG{display:grid;grid-template-columns:auto auto;gap:4px 18px}#siege .sgEG b{text-align:right;font-family:var(--px-font,inherit);font-weight:400;font-size:15px}
@media (max-width:900px){
  #siege .sgTop{flex-wrap:nowrap;gap:6px;padding:2px 6px;font-size:11px}#siege .sgTop>b{display:none}#siege .sgTop #sgStat{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
  #siege .sgTop .grow{display:none}#siege .sgProg small{display:none}#siege .sgProg i{width:80px}#siege .sgTop button{padding:2px 8px;font-size:11px;flex-shrink:0}
  #siege .sgBot{flex-wrap:nowrap;gap:4px;padding:2px 4px;overflow-x:auto}#siege .sgCards{flex-wrap:nowrap}#siege .sgCards button span{display:none}#siege .sgCards button{padding:2px 6px;flex-shrink:0}
  #siege .sgCmd .muted{display:none}#siege .sgCmd{flex-wrap:nowrap}#siege .sgCmd button{padding:2px 6px;font-size:11px;flex-shrink:0}#siege .sgCmd>span{font-size:10.5px;white-space:nowrap}
  #siege .sgSetup{padding:8px 10px}#siege .sgU{padding:2px 6px}#siege .sgN small:first-of-type{display:none}
}
`;document.head.appendChild(css);

// ---------- タイトルに「攻城戦（試作）」を足す ----------
// ---------- 音楽室（ホームから BGM を聴く）。曲はゲーム本体が音を合成して鳴らす（AU）。聴いている間だけ曲を固定する ----------
const TRACKS=[
  {n:'ホーム',d:'タイトル画面。ゆっくり・少し寂しげ',track:'home',it:0},
  {n:'昼（準備）',d:'昼の街づくり',track:'prep',it:0,stage:1},
  {n:'静かな夜',d:'襲撃のない夜。鈴と虫の声',track:'night',it:0,stage:1},
  {n:'祭りの夜',d:'太鼓と手拍子と笛',track:'fest',it:0,stage:1},
  {n:'敵の襲撃（序盤）',d:'第1〜3襲撃',track:'battle',it:0,stage:1},
  {n:'敵の襲撃（第4襲撃から）',d:'旋律が加わる',track:'battle',it:1,stage:1},
  {n:'敵の襲撃（最後の襲撃）',d:'いちばん激しい',track:'battle',it:2,stage:1},
  {n:'ボス襲来',d:'ゴブリンキングが来た夜。重い金管とティンパニ',track:'boss',it:0,stage:1},
  {n:'駐留地攻撃（忍び寄る）',d:'夜襲。見つかる前',track:'siege',it:0},
  {n:'駐留地攻撃（見つかった）',d:'夜襲。戦太鼓が入る',track:'siege',it:1},
];
const STAGES=[['t','廃村エルム','笛'],['f','辺境の街グレイヴェル','基本'],['m','山上の砦ハルデン','低く・角笛'],['s','雪原の関所ヴィンター','鐘']];
let musicHooked=false,MUS=null,MUS_MAP='f';
function musicHook(){if(musicHooked||typeof auMusicFor!=='function'||typeof AU==='undefined')return;musicHooked=true;const orig=auMusicFor;
  const setT=(tr,it)=>{AU.intensity=it;if(AU.track!==tr){AU.track=tr;AU.step=0;AU.nextT=AU.ctx.currentTime+0.2;}};
  window.auMusicFor=auMusicFor=function(){if(!AU.ctx)return orig.apply(this,arguments);
    if(MUS){AU.map=MUS_MAP;setT(MUS.track,MUS.it);return;}                                   // 音楽室で聴いている曲
    if(G&&G.phase&&G.phase!=='setup'&&G.phase!=='end'){setT('siege',G.alarm?1:0);return;}   // 攻城戦：見つかる前／見つかった
    return orig.apply(this,arguments);};}
function playTrack(i){musicHook();try{if(typeof auInit==='function')auInit();}catch(e){}if(typeof AU==='undefined')return;const t=TRACKS[i];MUS={track:t.track,it:t.it,i};AU.map=MUS_MAP;
  if(AU.ctx){AU.track=null;auMusicFor();}renderMusic();}
function openMusic(){musicHook();let root=document.getElementById('sgMusic');if(!root){root=document.createElement('div');root.id='sgMusic';document.body.appendChild(root);}root.style.display='flex';renderMusic();}
function closeMusic(){MUS=null;if(typeof AU!=='undefined'&&AU.ctx){AU.track=null;try{auMusicFor();}catch(e){}}const r=document.getElementById('sgMusic');if(r){r.style.display='none';r.innerHTML='';}}
function renderMusic(){const r=document.getElementById('sgMusic');if(!r)return;const on=typeof AU!=='undefined'&&AU.on;
  const bv=typeof AU!=='undefined'?AU.bgmVol:0.5,sv=typeof AU!=='undefined'?AU.seVol:0.6;
  r.innerHTML=`<div class="sgMBox"><h2>♪ 音楽室</h2><small class="muted">押すとその曲が流れます${on?'':'（今は消音中です）'}</small>
    <div class="sgVol"><label>BGM <input type="range" id="sgVB" min="0" max="1" step="0.05" value="${bv}"><b id="sgVBn">${Math.round(bv*100)}</b></label><label>効果音 <input type="range" id="sgVS" min="0" max="1" step="0.05" value="${sv}"><b id="sgVSn">${Math.round(sv*100)}</b></label><button id="sgMute">${on?'消音にする':'音を出す'}</button></div>
    <div class="sgML">${TRACKS.map((t,i)=>`<button data-tr="${i}" class="${MUS&&MUS.i===i?'on':''}"><b>${MUS&&MUS.i===i?'▶ ':''}${t.n}</b><small>${t.d}${t.stage?'（ステージで変わる）':''}</small></button>`).join('')}</div>
    <div class="sgMS"><b>ステージ</b>${STAGES.map(([k,n,d])=>`<button data-st="${k}" class="${MUS_MAP===k?'on':''}" title="${d}">${n}<small>${d}</small></button>`).join('')}<small class="muted">昼・夜・祭り・襲撃・ボスの曲は、ステージごとに音の高さや楽器が変わります</small></div>
    <div class="sgFoot"><button id="sgMStop">止める</button><button id="sgMClose" class="primary">閉じる</button></div></div>`;
  r.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>playTrack(+b.dataset.tr));
  {const vb=document.getElementById('sgVB'),vs=document.getElementById('sgVS');   // 音量（ゲームの設定と同じ値。保存もされる）
    vb.oninput=()=>{try{auSetBgm(+vb.value);}catch(e){}document.getElementById('sgVBn').textContent=Math.round(vb.value*100);};
    vs.oninput=()=>{try{auSetSe(+vs.value);}catch(e){}document.getElementById('sgVSn').textContent=Math.round(vs.value*100);};
    vs.onchange=()=>{try{se('click');}catch(e){}};
    document.getElementById('sgMute').onclick=()=>{try{auInit();auToggle();}catch(e){}renderMusic();};}
  r.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{MUS_MAP=b.dataset.st;if(typeof AU!=='undefined')AU.map=MUS_MAP;renderMusic();});
  document.getElementById('sgMStop').onclick=()=>{MUS=null;if(typeof AU!=='undefined'&&AU.ctx){AU.track=null;}renderMusic();};   // 止める（閉じると元の曲に戻る）
  document.getElementById('sgMClose').onclick=closeMusic;}
function hook(){if(typeof showTitle!=='function'||typeof E==='undefined'||typeof SPR==='undefined'){setTimeout(hook,200);return;}
  const orig=showTitle;window.showTitle=showTitle=function(){const r=orig.apply(this,arguments);try{const nb=document.getElementById('tNew');if(nb&&!document.getElementById('tSiege')){const b=document.createElement('button');b.id='tSiege';b.textContent='攻城戦（試作）';b.style.padding='8px';b.onclick=openSiege;nb.insertAdjacentElement('afterend',b);}if(nb&&!document.getElementById('tMusic')){const m=document.createElement('button');m.id='tMusic';m.textContent='♪ 音楽室・音量';m.style.padding='8px';m.onclick=openMusic;(document.getElementById('tSiege')||nb).insertAdjacentElement('afterend',m);}}catch(e){}return r;};
  if(typeof S!=='undefined'&&S&&S.overlay==='title')showTitle();
  musicHook();
  window.openSiege=openSiege;window.__siege=()=>G;window.__siegeUpd=dt=>update(dt);window.__tb=tBlock;window.__fp=findPath;window.__reach=reachable;}
hook();
})();
