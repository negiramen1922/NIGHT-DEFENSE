// ===== 攻城戦（試作）：駐留地への夜襲を、別の戦場で戦う =====
// 試作版だけで読み込む（tools/mkproto.py が proto/index.html に <script src="siege.js"> を足す）。本番の index.html には入らない。
// 流れ：編成（何回目の襲撃の駐留地か・陣の形・部隊を自由に選ぶ）→ 配置（陣のまわりに置く）→ 戦闘（夜明けまで・リアルタイム）→ 結果
// 夜襲なので、陣の魔物は「その駐留地にいる数の3割」。ほかはテントで眠っている。見張りに見つかるまで陣は寝ている。
// 結果は「勝ち負け」ではなく、敵へのダメージ（倒した魔物と、焼いたテントの割合）で決まる。
// ゲーム本体の SPR（ドット絵）・E（魔物の数値）・genWave（襲撃の中身）・se（効果音）を借りて使う。
(function(){
'use strict';
const W=1240,H=720,CX=620,CY=360;                // 戦場の大きさ。敵の陣はまん中
const NIGHT_SEC=180;                             // 夜明けまでの時間（戦いの時間の上限）
const AWAKE_SHARE=0.3;                           // 陣で起きている（戦いに出てくる）のは、駐留している魔物の3割
// こちらの部隊（攻め）。m：人数、hp：1人の体力、dmg：1人の1回の攻撃、rate：攻撃の間隔（秒）、rng：射程、spd：速さ、bld：建物へのダメージ倍率
const SU={
  sword: {n:'兵士',  spr:'pawn',   m:5,hp:40, dmg:8, rate:0.8,rng:16, spd:42,bld:1,  role:'melee', d:'近くの魔物に向かい、いなければテントへ'},
  shield:{n:'盾兵',  spr:'guard',  m:4,hp:95, dmg:4, rate:1.0,rng:16, spd:32,bld:0.7,role:'shield',red:0.45,d:'体力が高く、魔物の攻撃を引きつける壁役（受けるダメージ−45%）'},
  archer:{n:'弓兵',  spr:'archer', m:5,hp:24, dmg:6, rate:1.1,rng:130,spd:38,bld:0.5,role:'ranged',d:'近接の味方の後ろから撃つ。柵の向こうにも届く'},
  cav:   {n:'騎兵',  spr:'rider',  m:3,hp:70, dmg:11,rate:0.9,rng:16, spd:72,bld:0.8,role:'cav',   d:'足が速い。見張りと弓の魔物・見張り台を先に狙う'},
  eng:   {n:'工兵',  spr:'farmer', m:4,hp:34, dmg:6, rate:0.9,rng:16, spd:38,bld:5,  role:'eng',   d:'門・柵・テントを壊すのが得意（建物へ×5）。近くの罠を外す'},
  ram:   {n:'破城槌',draw:'ram',   m:1,hp:900,dmg:70,rate:1.6,rng:20, spd:44,bld:3,  role:'ram',isBld:true,carry:2,d:'いちばん近い門へまっすぐ進んで打ち破り、次の門、大将のテントへ。壊れるか大将のテントに着くと兵士2部隊が出る。建物あつかい（建物に強い魔物に弱い）'},
  cat:   {n:'移動式投石機',draw:'cat',m:1,hp:320,dmg:55,rate:3.2,rng:270,minR:60,spd:16,bld:2.5,role:'cat',isBld:true,splash:34,d:'とても遅い。遠くから見張り台・テントを壊す（まわりにも当たる）'},
};
const ORDER=['sword','shield','archer','cav','eng','ram','cat'];
// 陣の形。b：柵（外側から）。circle は半径 r、rect は半幅 a・半高 b。gates：門の位置（circle は角度、rect は 'l','r','t','b'）
const LAYOUTS={
  ring:  {n:'丸い陣',   b:[{t:'circle',r:170,gates:[180,0]}],towers:[{r:128,n:4}],tents:{r:80,n:5}},
  square:{n:'四角い陣', b:[{t:'rect',a:200,b:150,gates:['l','r','b']}],towers:'corners',tents:{grid:true,n:6}},
  double:{n:'二重の陣', b:[{t:'circle',r:225,gates:[180,0,90,270]},{t:'circle',r:110,gates:[135,315]}],towers:[{r:178,n:6},{r:70,n:3}],tents:{r:160,n:7}},
  long:  {n:'横長の陣', b:[{t:'rect',a:270,b:115,gates:['l','r','t']}],towers:'corners',tents:{row:true,n:7}},
};
let G=null,cv=null,cx=null,raf=0,last=0,nid=1;
const $=id=>document.getElementById(id);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=o=>o&&o.hp>0;
function mem(u){const d=SU[u.t];return d.m>1?Math.max(0,Math.ceil(u.hp/d.hp-1e-6)):(u.hp>0?1:0);}
function sfx(n){try{if(typeof se==='function')se(n);}catch(e){}}
const ename=k=>(typeof E!=='undefined'&&E[k]?E[k].name:k);

// ---------- 駐留している魔物：第N襲撃のうち、いちばん多い方角のぶん ----------
function stationed(n){let q=[];
  try{if(typeof genWave==='function'&&typeof S!=='undefined'&&S&&S.sideOrder){const sv={open:S.open&&Object.assign({},S.open),wave:S.wave};const w=genWave(n);S.open=sv.open;q=w.q||[];}}catch(e){q=[];}
  const by={};for(const e of q){(by[e.side]=by[e.side]||[]).push(e);}const side=Object.keys(by).sort((a,b)=>by[b].length-by[a].length)[0];
  const c={};for(const e of (side?by[side]:[]))if(E[e.type]&&!E[e.type].fly&&!E[e.type].boss)c[e.type]=(c[e.type]||0)+1;
  if(!Object.keys(c).length)Object.assign(c,{swarm:10+n*8,gobarcher:2+n,grappler:Math.max(0,n-2)});
  return c;}
function awakeOf(c){const a={};for(const k in c){const v=Math.round(c[k]*AWAKE_SHARE);if(v>0)a[k]=v;}return a;}
const total=o=>Object.values(o).reduce((s,v)=>s+v,0);

// ---------- 画面（編成） ----------
function openSiege(){
  if(typeof S!=='undefined'&&S&&S.overlay&&typeof closeOverlay==='function')closeOverlay();
  G={phase:'setup',pool:{sword:4,shield:2,archer:3,cav:1,eng:1,ram:1,cat:1},raid:3,layout:'auto',speed:1,paused:false};
  try{const v=JSON.parse(localStorage.getItem('nd_siege')||'null');if(v){if(v.pool)for(const k of ORDER)if(v.pool[k]!=null)G.pool[k]=v.pool[k];if(v.raid)G.raid=v.raid;if(v.layout)G.layout=v.layout;}}catch(e){}   // 前の編成を覚えておく
  let root=$('siege');if(!root){root=document.createElement('div');root.id='siege';document.body.appendChild(root);}
  root.style.display='flex';document.body.classList.add('siegeOn');renderSetup();
}
function saveSetup(){try{localStorage.setItem('nd_siege',JSON.stringify({pool:G.start||G.pool,raid:G.raid,layout:G.layout}));}catch(e){}}
function renderSetup(){const root=$('siege');saveSetup();const st=stationed(G.raid),aw=awakeOf(st);G.st=st;G.aw=aw;
  root.innerHTML=`<div class="sgSetup"><h2>攻城戦（試作）<small>駐留地への夜襲</small></h2>
    <div class="sgRow"><b>どの駐留地</b><span class="sgRaid"><button data-raid="-1">−</button><b>第${G.raid}襲撃</b><button data-raid="1">＋</button></span>
      <small class="muted">駐留している魔物 ${total(st)}体（${Object.entries(st).map(([k,v])=>ename(k)+v).join('・')}）<br>夜襲なので、起きて出てくるのは3割の <b style="color:#ff8a6a">${total(aw)}体</b>。残りはテントで眠っている</small></div>
    <div class="sgRow"><b>陣の形</b>${['auto'].concat(Object.keys(LAYOUTS)).map(k=>`<button data-lay="${k}" class="${G.layout===k?'on':''}">${k==='auto'?'おまかせ':LAYOUTS[k].n}</button>`).join('')}</div>
    <div class="sgHelp">部隊を自由に選べます（試作なので費用なし）。陣のまわりのどこからでも攻められます。夜明け（${NIGHT_SEC/60}分）まで戦えます。<br>敵へのダメージ＝倒した魔物（起きていた3割）＋焼いたテント（眠っている7割）。</div>
    <div class="sgUnits">${ORDER.map(k=>{const d=SU[k];return `<div class="sgU"><span class="sgI">${unitIcon(k,32)}</span><span class="sgN"><b>${d.n}</b><small>${d.d}</small><small class="muted">${d.m>1?`${d.m}人・`:''}体力${d.hp*d.m}・攻撃${d.dmg*d.m}${d.rng>40?`・射程${d.rng}`:''}</small></span><span class="sgC"><button data-dec="${k}">−</button><b>${G.pool[k]}</b><button data-inc="${k}">＋</button></span></div>`;}).join('')}</div>
    <div class="sgFoot"><button id="sgBack">やめる（タイトルへ）</button><button id="sgGo" class="primary" ${ORDER.some(k=>G.pool[k]>0)?'':'disabled'}>出撃（配置へ）</button></div></div>`;
  root.querySelectorAll('[data-raid]').forEach(b=>b.onclick=()=>{G.raid=Math.max(1,Math.min(20,G.raid+(+b.dataset.raid)));sfx('click');renderSetup();});
  root.querySelectorAll('[data-lay]').forEach(b=>b.onclick=()=>{G.layout=b.dataset.lay;sfx('click');renderSetup();});
  root.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{G.pool[b.dataset.inc]=Math.min(30,G.pool[b.dataset.inc]+1);sfx('click');renderSetup();});
  root.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{G.pool[b.dataset.dec]=Math.max(0,G.pool[b.dataset.dec]-1);sfx('click');renderSetup();});
  $('sgBack').onclick=closeSiege;$('sgGo').onclick=startDeploy;
}
function closeSiege(){cancelAnimationFrame(raf);raf=0;const root=$('siege');if(root){root.style.display='none';root.innerHTML='';}document.body.classList.remove('siegeOn');G=null;if(typeof showTitle==='function')showTitle();}
function unitIcon(k,sz){const d=SU[k];if(d.draw){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.translate(16,18);(d.draw==='ram'?drawRam:drawCat)(g,0,0,1,0);return `<img src="${c.toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated">`;}
  const sp=typeof SPR!=='undefined'&&SPR.units&&SPR.units[d.spr];if(!sp)return '';return `<img src="${sp.img.walk[0].toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated">`;}

// ---------- 柵の形（内か外か・門） ----------
function inside(bd,x,y){const dx=x-CX,dy=y-CY;return bd.t==='circle'?Math.hypot(dx,dy)<bd.r:Math.abs(dx)<bd.a&&Math.abs(dy)<bd.b;}
function layerOf(x,y){let n=0;for(const bd of G.bounds)if(inside(bd,x,y))n++;return n;}
// 柵の大きさの目安（いちばん外の柵から中心まで）
function outerR(){const bd=G.bounds[0];return bd.t==='circle'?bd.r:Math.max(bd.a,bd.b);}
// その点が、いちばん外の柵から外へ m 以上離れているか（部隊を置ける所）
function farFromCamp(x,y,m){const bd=G.bounds[0],dx=Math.abs(x-CX),dy=Math.abs(y-CY);if(bd.t==='circle')return Math.hypot(dx,dy)>bd.r+m;const ox=Math.max(0,dx-bd.a),oy=Math.max(0,dy-bd.b);return Math.hypot(ox,oy)>m;}

// ---------- 戦場をつくる ----------
function buildField(){
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
  // 見張り台
  const towers=[];if(L.towers==='corners'){const bd=G.bounds[0];for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]])towers.push([CX+sx*(bd.a-30),CY+sy*(bd.b-30),0]);}
  else L.towers.forEach((t,li)=>{for(let i=0;i<t.n;i++){const a=(i+0.5)/t.n*Math.PI*2;towers.push([CX+Math.cos(a)*t.r,CY+Math.sin(a)*t.r,li]);}});
  for(const [x,y,li] of towers)B('tower',x,y,15,li?520:420,{rng:150,dmg:li?10:8,rate:li?1.0:1.1});
  // テント（眠っている魔物）と大将のテント
  B('chief',CX,CY,26,1600);
  const T=L.tents,tp=[];
  if(T.grid){const bd=G.bounds[0];for(let i=0;i<T.n;i++){tp.push([CX+((i%3)-1)*(bd.a*0.55),CY+(i<3?-1:1)*bd.b*0.45]);}}
  else if(T.row){const bd=G.bounds[0];for(let i=0;i<T.n;i++){const k=i<4?i:i-4;const xs=i<4?[-0.75,-0.4,0.4,0.75][k]:[-0.55,0,0.55][k];tp.push([CX+xs*bd.a,CY+(i<4?-0.45:0.5)*bd.b]);}}
  else for(let i=0;i<T.n;i++){const a=i/T.n*Math.PI*2+0.3;tp.push([CX+Math.cos(a)*T.r,CY+Math.sin(a)*T.r]);}
  for(const [x,y] of tp)B('tent',x,y,16,280);
  // 罠：いちばん外の柵の外側、門の前を中心に
  for(const gb of G.bounds[0].gateB)for(let i=0;i<3;i++){const px=-gb.ny,py=gb.nx;G.traps.push({x:gb.x+gb.nx*(30+i*14)+px*((i%2)?14:-14),y:gb.y+gb.ny*(30+i*14)+py*((i%2)?14:-14),hp:1});}
  // 魔物：起きている3割。1割ほどは柵の外の見張り（巡回）、ほかは陣の中（夜襲なので寝ぼけている＝見つかるまで動かない）
  const aw=Object.entries(G.aw).flatMap(([k,n])=>Array(n).fill(k));const nSent=Math.max(2,Math.round(aw.length*0.12));
  const sentK=aw.filter(k=>k==='swarm'||k==='gobarcher'||k==='charger');
  for(let i=0;i<nSent&&sentK.length;i++){const k=sentK.splice(Math.floor(Math.random()*sentK.length),1)[0];aw.splice(aw.indexOf(k),1);
    const a=i/nSent*Math.PI*2+Math.random()*0.4,r=outerR()+45;G.foes.push(mkFoe(k,CX+Math.cos(a)*r*(G.bounds[0].t==='rect'?1.25:1),CY+Math.sin(a)*r*(G.bounds[0].t==='rect'?0.85:1),{sentry:true,ang:a,pr:r,dir:Math.random()<0.5?1:-1}));}
  const inner=G.bounds[G.bounds.length-1];
  for(const k of aw){let x,y,tries=0;do{const a=Math.random()*Math.PI*2,r=30+Math.random()*(outerR()-50);x=CX+Math.cos(a)*r*(G.bounds[0].t==='rect'?G.bounds[0].a/outerR():1);y=CY+Math.sin(a)*r*(G.bounds[0].t==='rect'?G.bounds[0].b/outerR():1);tries++;}while(!inside(G.bounds[0],x,y)&&tries<20);G.foes.push(mkFoe(k,x,y));}
  G.tentTotal=G.blds.filter(b=>b.kind==='tent'||b.kind==='chief').reduce((a,b)=>a+(b.kind==='chief'?2:1),0);
  G.sleeping=total(G.st)-total(G.aw);
  G.ground=null;
}
function mkFoe(k,x,y,ex){const d=E[k];return Object.assign({id:nid++,k,x,y,px:x,py:y,hp:d.hp,maxhp:d.hp,cd:Math.random(),face:-1,tg:null,walk:Math.random()*4},ex||{});}
function startDeploy(){if(!ORDER.some(k=>G.pool[k]>0))return;if(!G.start)G.start=Object.assign({},G.pool);G.phase='deploy';buildField();renderField();loopStart();
  msg('夜襲です。陣は寝静まっている。柵の外の見張りや見張り台に見つかると、陣の魔物が起きてくる');}
function spawnSquad(k,x,y){const d=SU[k];const u={id:nid++,t:k,x,y,hp:d.hp*d.m,maxhp:d.hp*d.m,cd:Math.random()*d.rate,face:x<CX?1:-1,tg:null,tx:null,ty:null,hold:false,walk:Math.random()*4,spawned:false};G.units.push(u);return u;}

// ---------- 戦場の画面 ----------
function renderField(){const root=$('siege');
  root.innerHTML=`<div class="sgTop"><b>夜襲（試作）</b><span class="sgProg" title="敵へのダメージ（倒した魔物＋焼いたテント）"><small>敵へのダメージ</small><i><b id="sgPB"></b></i><em id="sgPT">0%</em></span><span id="sgStat"></span><span class="grow"></span>
      <button id="sgSpd">速度 ×${G.speed}</button><button id="sgPause">${G.paused?'再開':'一時停止'}</button><button id="sgQuit">撤退</button></div>
    <canvas id="sgCv"></canvas>
    <div class="sgMsg" id="sgMsg"></div>
    <div class="sgBot"><div class="sgCards" id="sgCards"></div><div class="sgCmd" id="sgCmd"></div></div>`;
  cv=$('sgCv');cx=cv.getContext('2d');fit();addEventListener('resize',fit);
  $('sgSpd').onclick=()=>{G.speed=G.speed>=3?1:G.speed+1;$('sgSpd').textContent='速度 ×'+G.speed;sfx('click');};
  $('sgPause').onclick=()=>{G.paused=!G.paused;$('sgPause').textContent=G.paused?'再開':'一時停止';sfx('click');};
  $('sgQuit').onclick=()=>{if(G.phase==='end')return;endBattle('retreat');};
  bindInput();renderCards();renderCmd();
}
function fit(){if(!cv)return;const r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);G.k=Math.min(cv.width/W,cv.height/H);G.ox=(cv.width-W*G.k)/2;G.oy=(cv.height-H*G.k)/2;G.dark=null;}
function renderCards(){const el=$('sgCards');if(!el)return;
  el.innerHTML=ORDER.filter(k=>G.pool[k]>0||G.units.some(u=>u.t===k)).map(k=>`<button data-card="${k}" class="${G.card===k?'on':''}" ${G.pool[k]?'':'disabled'}>${unitIcon(k,22)}<span>${SU[k].n}</span><b>${G.pool[k]}</b></button>`).join('')+
    (G.phase==='deploy'?`<button id="sgAll" class="ghost">残りを全部置く</button><button id="sgFight" class="primary" ${G.units.length?'':'disabled'}>夜襲開始</button>`:'');
  el.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{G.card=G.card===b.dataset.card?null:b.dataset.card;sfx('click');renderCards();msg(G.card?`${SU[G.card].n}：陣のまわりの明るい所をタップして置く`:'');});
  const a=$('sgAll');if(a)a.onclick=()=>{const rest=[];for(const k of ORDER)for(let j=0;j<G.pool[k];j++)rest.push(k);
    rest.forEach((k,i)=>{const side=i%4,a0=[Math.PI,-Math.PI/2,0,Math.PI/2][side]+((Math.floor(i/4)%5)-2)*0.12;let r=outerR()+110+Math.floor(i/20)*26;let x=CX+Math.cos(a0)*r*1.3,y=CY+Math.sin(a0)*r;
      x=Math.max(20,Math.min(W-20,x));y=Math.max(20,Math.min(H-20,y));let t=0;while(!canDeploy({x,y})&&t<30){x+=Math.cos(a0)*10;y+=Math.sin(a0)*10;x=Math.max(20,Math.min(W-20,x));y=Math.max(20,Math.min(H-20,y));t++;}
      spawnSquad(k,x,y);G.pool[k]--;});sfx('build');renderCards();};
  const f=$('sgFight');if(f)f.onclick=()=>{G.phase='battle';sfx('turn');msg('夜襲開始！ 見つからないうちに近づこう。部隊を選んで地図を押すと移動、敵を押すとそこを攻撃');renderCards();};}
function renderCmd(){const el=$('sgCmd');if(!el)return;const n=G.sel.size;
  el.innerHTML=n?`<span>${n}部隊を選択中</span><button data-cmd="auto">自動で戦う</button><button data-cmd="hold">固守</button><button data-cmd="none">選択を解除</button>`:`<button data-cmd="all">全部隊を選ぶ</button><span class="muted">ドラッグで範囲選択</span>`;
  el.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;const us=G.units.filter(u=>G.sel.has(u.id)&&alive(u));
    if(c==='all'){G.units.filter(alive).forEach(u=>G.sel.add(u.id));}else if(c==='none')G.sel.clear();
    else for(const u of us){u.tx=u.ty=null;u.tg=null;u.focus=false;u.hold=c==='hold';}
    sfx('click');renderCmd();});}
function msg(t){const m=$('sgMsg');if(!m)return;m.textContent=t;m.classList.toggle('on',!!t);clearTimeout(m._t);if(t)m._t=setTimeout(()=>m.classList.remove('on'),4500);}

// ---------- 入力 ----------
function toW(ev){const r=cv.getBoundingClientRect(),dpr=cv.width/r.width;return {x:((ev.clientX-r.left)*dpr-G.ox)/G.k,y:((ev.clientY-r.top)*dpr-G.oy)/G.k};}
function bindInput(){let down=null;
  cv.onpointerdown=ev=>{try{cv.setPointerCapture(ev.pointerId);}catch(e){}down={a:toW(ev),sx:ev.clientX,sy:ev.clientY,shift:ev.shiftKey};};
  cv.onpointermove=ev=>{if(!down)return;if(Math.hypot(ev.clientX-down.sx,ev.clientY-down.sy)>8&&!G.card){down.box=true;G.box={a:down.a,b:toW(ev)};}};
  cv.onpointerup=ev=>{if(!down)return;const p=toW(ev);
    if(down.box){const x0=Math.min(down.a.x,p.x),x1=Math.max(down.a.x,p.x),y0=Math.min(down.a.y,p.y),y1=Math.max(down.a.y,p.y);if(!down.shift)G.sel.clear();
      for(const u of G.units)if(alive(u)&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1)G.sel.add(u.id);G.box=null;sfx('click');renderCmd();}
    else tap(p,down.shift);down=null;};
}
function canDeploy(p){return p.x>12&&p.y>12&&p.x<W-12&&p.y<H-12&&farFromCamp(p.x,p.y,90);}
function tap(p,shift){
  if(G.card&&G.phase!=='end'){if(canDeploy(p)){if(G.pool[G.card]>0){spawnSquad(G.card,p.x,p.y);G.pool[G.card]--;sfx('build');if(!G.pool[G.card])G.card=ORDER.find(k=>G.pool[k]>0)||null;renderCards();}return;}
    else{msg('部隊は陣のまわりの明るい所にだけ置けます（陣に近すぎる所には置けない）');return;}}
  const u=G.units.filter(alive).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(u&&dist(u,p)<22){if(!shift&&!G.sel.has(u.id))G.sel.clear();if(shift&&G.sel.has(u.id))G.sel.delete(u.id);else G.sel.add(u.id);sfx('click');renderCmd();return;}
  if(!G.sel.size)return;
  const f=G.foes.filter(alive).find(o=>dist(o,p)<16)||G.blds.filter(alive).find(o=>dist(o,p)<o.r+6);
  for(const id of G.sel){const s=G.units.find(x=>x.id===id);if(!alive(s))continue;if(f){s.tg=f;s.tx=s.ty=null;s.focus=true;}else{s.tx=p.x+(Math.random()-0.5)*24;s.ty=p.y+(Math.random()-0.5)*24;s.tg=null;s.focus=false;}s.hold=false;}
  G.fx.push({x:p.x,y:p.y,r:14,t:0,dur:0.4,c:f?'#ff5a4e':'#62c6d9'});sfx('click');
}

// ---------- 戦い ----------
function loopStart(){cancelAnimationFrame(raf);last=performance.now();const step=now=>{raf=requestAnimationFrame(step);const dt=Math.min(0.05,(now-last)/1000);last=now;
    if(G.phase==='battle'&&!G.paused)for(let i=0;i<G.speed&&G.phase==='battle';i++)update(dt);else{for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);}
    draw(now/1000);hud();};raf=requestAnimationFrame(step);}
function nearest(o,list,max,filt){let best=null,bd=max||1e9;for(const t of list){if(!alive(t)||(filt&&!filt(t)))continue;const d=dist(o,t);if(d<bd){bd=d;best=t;}}return best;}
function chief(){return G.blds.find(b=>b.kind==='chief');}
// こちらの部隊は柵の杭と門にぶつかる（壊して進む）。魔物は門を通る
function blocker(x,y,r){for(const b of G.blds)if((b.kind==='post'||b.kind==='gate')&&b.hp>0&&Math.hypot(b.x-x,b.y-y)<b.r+r)return b;return null;}
function stepTo(u,tx,ty,spd,dt){const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);if(d<2)return null;const s=Math.min(d,spd*dt),nx=u.x+dx/d*s,ny=u.y+dy/d*s;
  if(Math.abs(dx)>0.5)u.face=dx>0?1:-1;const b=blocker(nx,ny,u.t==='ram'?14:7);if(b)return b;u.x=Math.max(6,Math.min(W-6,nx));u.y=Math.max(6,Math.min(H-6,ny));u.walk+=dt*8;return null;}
// こちらの部隊の歩き方：柵の内と外を行き来するときは、壊れた門・柵のすき間（なければ門）を通る。柵にぶつかったら回り込む
function normalAt(bd,x,y){if(bd.t==='circle'){const dx=x-CX,dy=y-CY,l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];}const dx=(x-CX)/bd.a,dy=(y-CY)/bd.b;return Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];}
function navPoint(u,tx,ty){const la=layerOf(u.x,u.y),lt=layerOf(tx,ty);if(la===lt){u.nav=null;return [tx,ty,null];}
  const inward=la<lt,bi=inward?la:la-1,bd=G.bounds[bi];
  const ops=G.blds.filter(b=>(b.kind==='gate'||b.kind==='post')&&b.layer===bi&&b.hp<=0);
  const score=o=>dist(u,o)+Math.hypot(o.x-tx,o.y-ty);
  let o=u.nav&&u.nav.bi===bi&&u.nav.inward===inward?u.nav.o:null;
  if(!o||(o.hp>0&&ops.length)){o=ops.sort((a,b)=>score(a)-score(b))[0]||bd.gateB.slice().sort((a,b)=>score(a)-score(b))[0];u.nav={bi,inward,o,stage:0};}
  const [nx,ny]=normalAt(bd,o.x,o.y),sg=inward?1:-1,p1=[o.x+nx*20*sg,o.y+ny*20*sg],p2=[o.x-nx*20*sg,o.y-ny*20*sg];
  if(u.nav.stage===0&&Math.hypot(u.x-p1[0],u.y-p1[1])<12)u.nav.stage=1;
  return u.nav.stage===0?[p1[0],p1[1],o]:[p2[0],p2[1],o];}
function moveNav(u,tx,ty,spd,dt){const [gx,gy,op]=navPoint(u,tx,ty);const b=stepTo(u,gx,gy,spd,dt);if(!b)return null;
  if(op&&b===op)return b;                              // 通り道の門がまだ立っている → 壊す
  // 柵の杭にぶつかった → 杭に沿って回り込む（行き先に近づく向きへ）
  const ax=u.x-b.x,ay=u.y-b.y,l=Math.hypot(ax,ay)||1,dx=gx-u.x,dy=gy-u.y;let tx1=-ay/l,ty1=ax/l;if(tx1*dx+ty1*dy<0){tx1=-tx1;ty1=-ty1;}
  for(const k of [1,0.6]){const sx=u.x+(tx1*k+ax/l*(1-k))*spd*dt,sy=u.y+(ty1*k+ay/l*(1-k))*spd*dt;if(!blocker(sx,sy,7)){u.x=sx;u.y=sy;u.walk+=dt*8;if(Math.abs(tx1)>0.3)u.face=tx1>0?1:-1;return null;}}
  return b;}
// 魔物の歩き方：柵の内と外を行き来するときは、いちばん近い門を通る
function foeStep(f,tx,ty,spd,dt){const la=layerOf(f.x,f.y),lt=layerOf(tx,ty);let gx=tx,gy=ty;
  if(la!==lt){const bi=la>lt?la-1:la,bd=G.bounds[bi];const g=bd.gateB.slice().sort((a,b)=>dist(a,f)-dist(b,f))[0];
    if(g){const inPt={x:g.x-g.nx*20,y:g.y-g.ny*20},outPt={x:g.x+g.nx*20,y:g.y+g.ny*20};const from=la>lt?inPt:outPt,to=la>lt?outPt:inPt;
      if(f.gw===g.id||dist(f,from)<10){f.gw=g.id;gx=to.x;gy=to.y;}else{gx=from.x;gy=from.y;}}}
  else f.gw=null;
  const dx=gx-f.x,dy=gy-f.y,d=Math.hypot(dx,dy);if(d<1)return;const s=Math.min(d,spd*dt);f.x+=dx/d*s;f.y+=dy/d*s;if(Math.abs(dx)>0.5)f.face=dx>0?1:-1;f.walk=(f.walk||0)+dt*8;}
function raiseAlarm(why){if(G.alarm)return;G.alarm=true;sfx('alarm');msg(`${why}！ 陣の魔物が起きてきた`);for(const f of G.foes)f.awake=true;}
function hitBld(b,dmg){if(b.hp<=0)return;b.hp-=dmg;raiseAlarm('物音で気づかれた');if(b.hp<=0){b.hp=0;G.fx.push({x:b.x,y:b.y,r:b.r*1.6,t:0,dur:0.5,c:b.kind==='tent'||b.kind==='chief'?'#ff8a3a':'#ffb14e'});if(b.kind!=='post')sfx('destroy');
    if(b.kind==='tent'||b.kind==='chief'){G.fires=(G.fires||[]);G.fires.push({x:b.x,y:b.y});}}}
function hitUnit(u,dmg){u.hp-=dmg;if(u.hp<=0){u.hp=0;G.sel.delete(u.id);if(SU[u.t].carry&&!u.spawned)releaseRam(u);}}
function hitFoe(f,dmg){const d=E[f.k];f.hp-=dmg*(1-(d.armor||0));f.awake=true;if(!G.alarm)raiseAlarm('戦いに気づかれた');if(f.hp<=0)f.hp=0;}
function releaseRam(u){u.spawned=true;for(let i=0;i<SU[u.t].carry;i++){const s=spawnSquad('sword',u.x+(i?14:-14),u.y+(i?10:-10));s.face=u.face;}G.fx.push({x:u.x,y:u.y,r:30,t:0,dur:0.5,c:'#f2b33d'});msg('破城槌から兵士2部隊が出てきた！');sfx('upgrade');}
function shoot(a,b,col){G.shots.push({x:a.x,y:a.y,tx:b.x,ty:b.y,t:0,c:col||'#e8d8a0'});}
// 破城槌のねらい：いま居る場所から内へ向かう、いちばん近い（壊れていない）門。門を全部抜けたら大将のテント
function ramTarget(u){const la=layerOf(u.x,u.y);for(let i=la;i<G.bounds.length;i++){const g=nearest(u,G.bounds[i].gateB,1e9);if(g)return g;}return chief();}

function update(dt){G.t+=dt;
  const ch=chief();
  // --- こちらの部隊 ---
  for(const u of G.units){if(!alive(u))continue;const d=SU[u.t];u.cd-=dt;const n=mem(u),atk=d.dmg*n;
    if(d.role==='eng')for(const tr of G.traps)if(tr.hp>0&&Math.hypot(tr.x-u.x,tr.y-u.y)<40){tr.hp=0;G.fx.push({x:tr.x,y:tr.y,r:10,t:0,dur:0.4,c:'#6fe08a'});}
    if(!d.isBld)for(const tr of G.traps)if(tr.hp>0&&Math.hypot(tr.x-u.x,tr.y-u.y)<11)hitUnit(u,14*dt);
    let tg=u.tg&&alive(u.tg)?u.tg:null;if(!tg)u.focus=false;
    if(u.tx!=null){const b=d.role==='ram'?stepTo(u,u.tx,u.ty,d.spd,dt):moveNav(u,u.tx,u.ty,d.spd,dt);
      if(b){if(d.role==='ranged'||d.role==='cat'){/* 門が開くまで待つ */}else if(u.cd<=0){u.cd=d.rate;attack(u,b,atk);}continue;}
      if(Math.hypot(u.tx-u.x,u.ty-u.y)<4){u.tx=u.ty=null;}continue;}
    if(!tg||!u.focus){
      const bldT=b=>b.kind!=='post';   // 柵の杭そのものは狙わない（道をふさいだら叩く）
      if(d.role==='ram')tg=ramTarget(u);
      else if(d.role==='cat')tg=nearest(u,G.blds,d.rng*1.6,b=>b.kind==='tower')||nearest(u,G.blds,d.rng*1.6,b=>b.kind==='tent'||b.kind==='chief')||nearest(u,G.blds,1e9,b=>b.kind!=='post');
      else if(d.role==='eng')tg=nearest(u,G.foes,60)||nearest(u,G.blds,1e9,b=>b.kind==='gate'||b.kind==='tent'||b.kind==='chief');
      else if(d.role==='cav')tg=nearest(u,G.foes,320,f=>f.sentry||!!(E[f.k].archers||E[f.k].ranged))||nearest(u,G.blds,320,b=>b.kind==='tower')||nearest(u,G.foes,240)||nearest(u,G.blds,1e9,b=>b.kind==='tent'||b.kind==='chief');
      else if(d.role==='ranged')tg=nearest(u,G.foes,d.rng+40)||nearest(u,G.blds,d.rng+10,b=>b.kind==='tower'||b.kind==='tent'||b.kind==='chief')||null;
      else tg=nearest(u,G.foes,240,f=>f.awake||f.sentry)||nearest(u,G.blds,1e9,b=>b.kind==='tent'||b.kind==='chief')||nearest(u,G.blds,1e9,bldT);
      if(!u.focus)u.tg=tg;}
    if(u.hold){if(tg&&dist(u,tg)<=d.rng+(tg.r||6)+6&&u.cd<=0){u.cd=d.rate;attack(u,tg,atk);}continue;}
    if(d.role==='ranged'&&!tg){const fr=nearest(u,G.units,1e9,o=>o!==u&&!SU[o.t].isBld&&SU[o.t].role!=='ranged');let gx,gy;
      if(fr){const dx=fr.x-CX,dy=fr.y-CY,dl=Math.hypot(dx,dy)||1;gx=fr.x+dx/dl*30;gy=fr.y+dy/dl*30;}else{const dx=u.x-CX,dy=u.y-CY,dl=Math.hypot(dx,dy)||1,r=Math.max(outerR()+70,dl-40);gx=CX+dx/dl*r;gy=CY+dy/dl*r;}
      stepTo(u,gx,gy,d.spd,dt);continue;}
    if(!tg)continue;
    const reach=d.rng+(tg.r||E[tg.k]&&E[tg.k].r||6)+2,dd=dist(u,tg);
    if(d.minR&&dd<d.minR){stepTo(u,u.x-(tg.x-u.x),u.y-(tg.y-u.y),d.spd,dt);continue;}
    if(dd>reach){const b=d.role==='ram'?stepTo(u,tg.x,tg.y,d.spd,dt):moveNav(u,tg.x,tg.y,d.spd,dt);if(b&&d.role!=='ranged'&&d.role!=='cat'){if(u.cd<=0){u.cd=d.rate;attack(u,b,atk);}}continue;}
    if(d.role==='ram'&&!u.spawned&&tg===ch)releaseRam(u);
    if(u.cd<=0){u.cd=d.rate;attack(u,tg,atk);}
  }
  // --- 魔物 ---
  for(const f of G.foes){if(!alive(f))continue;const d=E[f.k];f.cd-=dt;if(d.regen)f.hp=Math.min(f.maxhp,f.hp+d.regen*dt);
    const rng=d.archers?d.archers.range*28:d.ranged?d.ranged*28:0;
    // 見張り：柵の外を巡回。部隊を見つけたら知らせる
    if(f.sentry&&!G.alarm){const seen=nearest(f,G.units,120);if(seen)raiseAlarm('見張りに見つかった');
      else{f.ang+=f.dir*dt*0.12;const tx=CX+Math.cos(f.ang)*f.pr*(G.bounds[0].t==='rect'?1.25:1),ty=CY+Math.sin(f.ang)*f.pr*(G.bounds[0].t==='rect'?0.85:1);foeStep(f,tx,ty,d.spd*0.5,dt);continue;}}
    if(!f.awake&&!f.sentry){// 寝ている：すぐそばに来られたら起きる
      if(nearest(f,G.units,45)){f.awake=true;raiseAlarm('陣に踏み込まれた');}else continue;}
    let tg=null;if((d.bldMul||1)>1)tg=nearest(f,G.units,170,u=>!!SU[u.t].isBld);
    if(!tg)tg=nearest(f,G.units,70,u=>SU[u.t].role==='shield');
    if(!tg)tg=nearest(f,G.units,rng?rng+40:200);
    if(tg&&Math.hypot(tg.x-CX,tg.y-CY)>outerR()+200)tg=null;   // 陣から離れすぎた相手は追わない
    if(!tg){if(Math.hypot(f.px-f.x,f.py-f.y)>6)foeStep(f,f.px,f.py,d.spd,dt);continue;}
    const reach=(rng||d.r+8)+(SU[tg.t].isBld?14:6),dd=dist(f,tg);
    if(dd>reach){foeStep(f,tg.x,tg.y,d.spd,dt);continue;}
    if(f.cd<=0){const ar=d.archers;f.cd=ar?ar.rate:d.rate;let dm=ar?ar.dmg:d.dmg*(d.vsS||1);
      if(SU[tg.t].isBld)dm=d.dmg*(d.bldMul||1)*1.5;if(SU[tg.t].red)dm*=1-SU[tg.t].red;
      if(rng)shoot(f,tg,'#b0e070');hitUnit(tg,dm);}
  }
  // --- 見張り台：見つけたら知らせ、撃つ ---
  for(const b of G.blds){if(b.kind!=='tower'||!alive(b))continue;b.cd-=dt;const t=nearest(b,G.units,b.rng);if(!t)continue;if(!G.alarm)raiseAlarm('見張り台に見つかった');if(b.cd>0)continue;b.cd=b.rate;let dm=b.dmg*(SU[t.t].isBld?0.3:1);if(SU[t.t].red)dm*=1-SU[t.t].red;shoot(b,t);hitUnit(t,dm);}
  for(const s of G.shots)s.t+=dt*4;G.shots=G.shots.filter(s=>s.t<1);for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);
  // 終わり：夜明け・テントを全部焼いた・全滅
  if(G.t>=NIGHT_SEC)return endBattle('dawn');
  if(!G.blds.some(b=>(b.kind==='tent'||b.kind==='chief')&&b.hp>0))return endBattle('burned');
  if(!G.units.some(alive)&&!ORDER.some(k=>G.pool[k]>0))return endBattle('lose');
}
function attack(u,tg,atk){const d=SU[u.t];
  if(d.role==='cat'){shoot(u,tg,'#c8a070');setTimeout(()=>{if(!G||!G.blds)return;const sp=d.splash;G.fx.push({x:tg.x,y:tg.y,r:sp,t:0,dur:0.4,c:'#c8a070'});
      for(const b of G.blds)if(alive(b)&&Math.hypot(b.x-tg.x,b.y-tg.y)<sp+b.r)hitBld(b,atk*d.bld);for(const f of G.foes)if(alive(f)&&Math.hypot(f.x-tg.x,f.y-tg.y)<sp)hitFoe(f,atk*0.6);},250/G.speed);sfx('how');return;}
  if(d.role==='ranged')shoot(u,tg);
  if(tg.kind)hitBld(tg,atk*d.bld);else hitFoe(tg,atk);
  if(d.role==='ram')sfx('hit');
}
// 敵へのダメージ：起きていた魔物（3割）のうち倒した割合 ＋ テントの焼けた割合 × 眠っていた魔物（7割）
function result(){const awN=G.foes.length,kill=G.foes.filter(f=>!alive(f)).length;
  const burned=G.blds.filter(b=>(b.kind==='tent'||b.kind==='chief')&&b.hp<=0).reduce((a,b)=>a+(b.kind==='chief'?2:1),0);
  const tentPct=burned/G.tentTotal,killPct=awN?kill/awN:0;const all=total(G.st),dmgN=Math.round(kill+G.sleeping*tentPct);
  return {kill,awN,tentPct:Math.round(tentPct*100),killPct:Math.round(killPct*100),dmgN,all,dmgPct:Math.round(dmgN/Math.max(1,all)*100)};}
function endBattle(why){if(!G||G.phase==='end')return;G.phase='end';const r=result(),lostSq=G.units.filter(u=>!alive(u)).length;
  const men0=G.units.reduce((a,u)=>a+(SU[u.t].m>1?SU[u.t].m:0),0),men=G.units.filter(alive).reduce((a,u)=>a+(SU[u.t].m>1?mem(u):0),0);
  sfx(r.dmgPct>=50?'clear':'turn');
  const t={dawn:'夜が明けた',burned:'陣のテントを焼き払った！',lose:'夜襲の部隊が全滅した',retreat:'撤退した'}[why];
  const box=document.createElement('div');box.className='sgEnd';box.innerHTML=`<h2>${t}</h2>
    <div class="sgBig">敵へのダメージ <b>${r.dmgPct}%</b><small>（駐留していた ${r.all}体のうち ${r.dmgN}体ぶん）</small></div>
    <div class="sgEG"><span>倒した魔物（起きていた3割）</span><b>${r.kill} / ${r.awN}（${r.killPct}%）</b><span>焼いたテント（眠っていた7割）</span><b>${r.tentPct}%</b><span>失った部隊</span><b>${lostSq} / ${G.units.length}</b><span>生き残った兵</span><b>${men} / ${men0}</b><span>かかった時間</span><b>${Math.round(G.t)}秒</b></div>
    <div class="muted" style="margin:6px 0 10px">本番なら（案）：この駐留地から来る次の襲撃が <b>${r.dmgPct}%</b> 減る</div><div class="sgFoot"><button id="sgAgain">同じ編成でもう一度</button><button id="sgEdit">編成を変える</button><button id="sgClose">タイトルへ</button></div>`;
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
function sprFrame(cat,k,an){const sp=typeof SPR!=='undefined'&&SPR[cat]&&SPR[cat][k];if(!sp)return null;const L=sp.img.walk||sp.img[Object.keys(sp.img)[0]];return L[Math.floor(an)%L.length];}
function campPath(g,bd,pad){if(bd.t==='circle'){g.arc(CX,CY,bd.r+pad,0,Math.PI*2);}else{g.rect(CX-bd.a-pad,CY-bd.b-pad,(bd.a+pad)*2,(bd.b+pad)*2);}}
function draw(tt){const g=cx;if(!g||!G||!G.blds)return;g.setTransform(1,0,0,1,0,0);g.fillStyle='#070a08';g.fillRect(0,0,cv.width,cv.height);g.setTransform(G.k,0,0,G.k,G.ox,G.oy);g.imageSmoothingEnabled=false;
  if(!G.ground){const c=document.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');q.fillStyle='#2f4a26';q.fillRect(0,0,W,H);for(let i=0;i<5000;i++){q.fillStyle=['#36552c','#2a4222','#3b5a30','#283e20'][i%4];q.fillRect((i*137)%W,(i*311+(i*i)%97)%H,2,2);}
    G.bounds.forEach((bd,i)=>{q.fillStyle=i?'rgba(50,36,20,.5)':'rgba(70,52,30,.55)';q.beginPath();campPath(q,bd,6);q.fill();});G.ground=c;}
  g.drawImage(G.ground,0,0);
  // 置ける所（陣のまわり）
  {const on=G.phase==='deploy'||G.card;if(on||G.phase==='deploy'){g.save();g.beginPath();g.rect(0,0,W,H);const bd=G.bounds[0];if(bd.t==='circle')g.arc(CX,CY,bd.r+90,0,Math.PI*2,true);else{const a=bd.a+90,b=bd.b+90;g.moveTo(CX-a,CY-b);g.lineTo(CX-a,CY+b);g.lineTo(CX+a,CY+b);g.lineTo(CX+a,CY-b);g.closePath();}
    g.fillStyle='rgba(98,198,217,.14)';g.fill('evenodd');g.restore();}}
  for(const t of G.traps){if(t.hp<=0)continue;g.fillStyle='#3a3228';g.fillRect(t.x-6,t.y-6,12,12);g.fillStyle='#c8c8c0';for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.beginPath();g.moveTo(t.x-4+i*6,t.y-1+j*5);g.lineTo(t.x-3+i*6,t.y-5+j*5);g.lineTo(t.x-2+i*6,t.y-1+j*5);g.fill();}}
  // 建物
  for(const b of G.blds){if(b.hp<=0){if(b.kind!=='post'){g.fillStyle='rgba(30,22,16,.85)';g.beginPath();g.ellipse(b.x,b.y+4,b.r,b.r*0.5,0,0,7);g.fill();}continue;}
    if(b.kind==='post'){g.fillStyle='#4a3018';g.fillRect(b.x-4,b.y-11,8,15);g.fillStyle='#7a5430';g.fillRect(b.x-3,b.y-11,3,14);g.fillStyle='#a07848';g.beginPath();g.moveTo(b.x-4,b.y-11);g.lineTo(b.x,b.y-16);g.lineTo(b.x+4,b.y-11);g.fill();}
    else if(b.kind==='gate'){const hz=Math.abs(b.nx)>0.7;g.fillStyle='#3a2410';if(hz)g.fillRect(b.x-6,b.y-18,12,32);else g.fillRect(b.x-18,b.y-12,36,18);g.fillStyle='#6a4422';if(hz)for(let i=-14;i<12;i+=6)g.fillRect(b.x-5,b.y+i,10,3);else for(let i=-16;i<16;i+=6)g.fillRect(b.x+i,b.y-11,3,16);
      g.fillStyle='#5a5a62';if(hz){g.fillRect(b.x-7,b.y-19,14,3);g.fillRect(b.x-7,b.y+12,14,3);}else{g.fillRect(b.x-19,b.y-13,3,20);g.fillRect(b.x+16,b.y-13,3,20);}}
    else if(b.kind==='tower'){g.fillStyle='#3a2a1a';g.fillRect(b.x-12,b.y-22,24,30);g.fillStyle='#6a4a2a';g.fillRect(b.x-14,b.y-28,28,8);g.fillStyle='#8a2a20';g.beginPath();g.moveTo(b.x-15,b.y-28);g.lineTo(b.x,b.y-40);g.lineTo(b.x+15,b.y-28);g.fill();g.fillStyle='#1c1210';g.fillRect(b.x-4,b.y-4,8,12);
      g.fillStyle='#ffb040';g.fillRect(b.x-2,b.y-34+Math.sin(tt*9+b.id)*1,3,4);}
    else if(b.kind==='tent'){g.fillStyle='#6a5030';g.beginPath();g.moveTo(b.x-18,b.y+8);g.lineTo(b.x,b.y-18);g.lineTo(b.x+18,b.y+8);g.fill();g.fillStyle='#8a6a40';g.beginPath();g.moveTo(b.x,b.y-18);g.lineTo(b.x+18,b.y+8);g.lineTo(b.x+6,b.y+8);g.fill();g.fillStyle='#2a1c10';g.beginPath();g.moveTo(b.x-5,b.y+8);g.lineTo(b.x,b.y-4);g.lineTo(b.x+5,b.y+8);g.fill();
      if(!G.alarm){g.fillStyle='rgba(220,230,255,.7)';g.font='9px sans-serif';g.fillText('z',b.x+10,b.y-16-((tt*8+b.id)%10));}}
    else if(b.kind==='chief'){g.fillStyle='#5a1a20';g.beginPath();g.moveTo(b.x-28,b.y+12);g.lineTo(b.x,b.y-30);g.lineTo(b.x+28,b.y+12);g.fill();g.fillStyle='#8a2a30';g.beginPath();g.moveTo(b.x,b.y-30);g.lineTo(b.x+28,b.y+12);g.lineTo(b.x+10,b.y+12);g.fill();g.fillStyle='#1c0c0c';g.fillRect(b.x-6,b.y-2,12,14);
      g.fillStyle='#8a1a1a';g.fillRect(b.x-1,b.y-56,3,28);g.fillStyle='#c03030';g.beginPath();g.moveTo(b.x+2,b.y-56);g.lineTo(b.x+22,b.y-50+Math.sin(tt*4)*2);g.lineTo(b.x+2,b.y-44);g.fill();}
    if(b.hp<b.maxhp&&b.kind!=='post'){const w=b.r*2;g.fillStyle='#000';g.fillRect(b.x-w/2,b.y+b.r*0.6+4,w,4);g.fillStyle=b.kind==='tent'||b.kind==='chief'?'#ff8a3a':'#f2b33d';g.fillRect(b.x-w/2,b.y+b.r*0.6+4,w*b.hp/b.maxhp,4);}}
  // 焼けたテントの火
  for(const f of (G.fires||[])){for(let i=0;i<3;i++){const h=8+((tt*30+i*7)%10);g.fillStyle=['#ff5a1e','#ffb040','#ffe080'][i];g.fillRect(f.x-6+i*4,f.y-h,4,h);}}
  // 魔物
  for(const f of G.foes){if(!alive(f))continue;const im=sprFrame('enemies','e_'+f.k,f.walk||0);const sz=(E[f.k].r||6)>=11?36:24;
    g.save();g.translate(f.x,f.y);if(f.face>0)g.scale(-1,1);if(!f.awake&&!f.sentry&&!G.alarm)g.globalAlpha=0.75;if(im)g.drawImage(im,-sz/2,-sz+4,sz,sz);else{g.fillStyle=E[f.k].color||'#8ac060';g.fillRect(-5,-10,10,10);}g.restore();
    if(f.sentry&&!G.alarm){g.strokeStyle='rgba(255,220,120,.25)';g.beginPath();g.arc(f.x,f.y,120,0,7);g.stroke();}
    if(f.hp<f.maxhp){g.fillStyle='#000';g.fillRect(f.x-8,f.y+5,16,2);g.fillStyle='#ff5a4e';g.fillRect(f.x-8,f.y+5,16*f.hp/f.maxhp,2);}}
  // こちらの部隊
  for(const u of G.units){if(!alive(u))continue;const d=SU[u.t],n=mem(u),sel=G.sel.has(u.id);
    if(sel){g.strokeStyle='#62c6d9';g.lineWidth=1.5;g.beginPath();g.ellipse(u.x,u.y+4,d.isBld?20:16,d.isBld?9:7,0,0,7);g.stroke();}
    if(d.draw){(d.draw==='ram'?drawRam:drawCat)(g,u.x,u.y,1.4,u.face);}
    else{const im=sprFrame('units',d.spr,u.walk);const off=[[0,0],[-9,4],[9,4],[-5,-6],[6,-6],[0,8]];for(let i=n-1;i>=0;i--){const [ox,oy]=off[i%off.length];g.save();g.translate(u.x+ox,u.y+oy);if(u.face<0)g.scale(-1,1);if(im)g.drawImage(im,-10,-18,20,20);g.restore();}}
    const r=u.hp/u.maxhp;g.fillStyle='#000';g.fillRect(u.x-12,u.y+(d.isBld?14:9),24,3);g.fillStyle=r<0.3?'#ff5a4e':r<0.6?'#f2b33d':'#6fe08a';g.fillRect(u.x-12,u.y+(d.isBld?14:9),24*r,3);
    if(u.hold){g.fillStyle='#f2b33d';g.font='8px sans-serif';g.textAlign='center';g.fillText('固守',u.x,u.y-22);}}
  for(const s of G.shots){const x=s.x+(s.tx-s.x)*s.t,y=s.y+(s.ty-s.y)*s.t-Math.sin(s.t*Math.PI)*12;g.fillStyle=s.c;g.fillRect(x-1.5,y-1.5,3,3);}
  for(const f of G.fx){const k=f.t/f.dur;g.globalAlpha=1-k;g.strokeStyle=f.c;g.lineWidth=2;g.beginPath();g.arc(f.x,f.y,f.r*(0.5+k*0.7),0,7);g.stroke();}g.globalAlpha=1;
  // 夜の暗さ（明かりのある所だけ見える）。夜明けが近づくと明るくなる
  {const k=G.phase==='battle'||G.phase==='end'?Math.min(1,G.t/NIGHT_SEC):0,a=0.62-0.4*Math.max(0,k-0.75)/0.25;
    if(!G.dark){G.dark=document.createElement('canvas');G.dark.width=W;G.dark.height=H;}const q=G.dark.getContext('2d');q.globalCompositeOperation='source-over';q.clearRect(0,0,W,H);q.fillStyle=`rgba(6,10,26,${a})`;q.fillRect(0,0,W,H);q.globalCompositeOperation='destination-out';
    const light=(x,y,r)=>{const gr=q.createRadialGradient(x,y,2,x,y,r);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=gr;q.beginPath();q.arc(x,y,r,0,7);q.fill();};
    for(const b of G.blds)if(b.hp>0&&(b.kind==='tower'||b.kind==='gate'))light(b.x,b.y,70);for(const f of (G.fires||[]))light(f.x,f.y,90);for(const u of G.units)if(alive(u))light(u.x,u.y,55);for(const f of G.foes)if(alive(f)&&f.sentry)light(f.x,f.y,40);
    g.drawImage(G.dark,0,0);}
  if(G.box){const {a,b}=G.box;g.strokeStyle='#62c6d9';g.setLineDash([5,3]);g.fillStyle='rgba(98,198,217,.12)';g.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));g.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));g.setLineDash([]);}
}
let hudT=0;function hud(){const now=performance.now();if(now-hudT<200)return;hudT=now;const el=$('sgStat');if(!el||!G||!G.blds)return;const r=result(),left=Math.max(0,Math.ceil(NIGHT_SEC-G.t));
  {const pb=$('sgPB');if(pb)pb.style.width=r.dmgPct+'%';const pt=$('sgPT');if(pt)pt.textContent=r.dmgPct+'%';}
  el.innerHTML=`第${G.raid}襲撃の駐留地（${LAYOUTS[G.lay].n}）　夜明けまで <b>${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</b>　テント ${r.tentPct}%　魔物 ${G.foes.filter(alive).length}/${G.foes.length}　味方 ${G.units.filter(alive).length}部隊　${G.phase==='deploy'?'<b style="color:#62c6d9">配置中</b>':G.alarm?'<b style="color:#ff5a4e">見つかった！</b>':G.phase==='battle'?'<b style="color:#9ab0ff">寝静まっている</b>':''}`;
  if(G.phase==='battle'&&G.units.some(u=>!alive(u)&&G.sel.has(u.id)))renderCmd();}

// ---------- 見た目 ----------
const css=document.createElement('style');css.textContent=`
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
#siege .sgBig{font-size:14px;margin:0 0 8px}#siege .sgBig b{font-family:var(--px-font,inherit);font-weight:400;font-size:28px;color:#ff8a6a;margin:0 6px}#siege .sgBig small{color:var(--dim,#7f9a82)}
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
function hook(){if(typeof showTitle!=='function'||typeof E==='undefined'||typeof SPR==='undefined'){setTimeout(hook,200);return;}
  const orig=showTitle;window.showTitle=showTitle=function(){const r=orig.apply(this,arguments);try{const nb=document.getElementById('tNew');if(nb&&!document.getElementById('tSiege')){const b=document.createElement('button');b.id='tSiege';b.textContent='攻城戦（試作）';b.style.padding='8px';b.onclick=openSiege;nb.insertAdjacentElement('afterend',b);}}catch(e){}return r;};
  if(typeof S!=='undefined'&&S&&S.overlay==='title')showTitle();
  window.openSiege=openSiege;window.__siege=()=>G;}
hook();
})();
