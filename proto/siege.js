// ===== 攻城戦（試作）：駐留地を別の戦場で攻める =====
// 試作版だけで読み込む（tools/mkproto.py が proto/index.html に <script src="siege.js"> を足す）。本番の index.html には入らない。
// 流れ：編成（部隊を自由に選ぶ）→ 配置（左の帯に置く）→ 戦闘（リアルタイム）→ 結果
// ゲーム本体の SPR（ドット絵）・E（魔物の数値）・ui/ic（アイコン）・se（効果音）を借りて使う。
(function(){
'use strict';
const W=1120,H=560,DEPLOY_X=220;               // 戦場の大きさ。左の DEPLOY_X までが配置できる帯
const CX=760,CY=280,RING=165;                    // 敵の陣の中心と、柵の輪の半径
// こちらの部隊（攻め）。m：人数、hp：1人の体力、dmg：1人の1回の攻撃、rate：攻撃の間隔（秒）、rng：射程、spd：速さ、bld：建物へのダメージ倍率
const SU={
  sword: {n:'兵士',  spr:'pawn',   m:5,hp:40, dmg:8, rate:0.8,rng:16, spd:42,bld:1,  role:'melee', d:'近くの魔物に向かい、いなければ中心へ進む'},
  shield:{n:'盾兵',  spr:'guard',  m:4,hp:95, dmg:4, rate:1.0,rng:16, spd:32,bld:0.7,role:'shield',red:0.45,d:'体力が高く、魔物の攻撃を引きつける壁役（受けるダメージ−45%）'},
  archer:{n:'弓兵',  spr:'archer', m:5,hp:24, dmg:6, rate:1.1,rng:130,spd:38,bld:0.5,role:'ranged',d:'近接の味方の後ろから撃つ。柵の向こうにも届く'},
  cav:   {n:'騎兵',  spr:'rider',  m:3,hp:70, dmg:11,rate:0.9,rng:16, spd:72,bld:0.8,role:'cav',   d:'足が速い。弓の魔物と見張り台を先に狙う'},
  eng:   {n:'工兵',  spr:'farmer', m:4,hp:34, dmg:6, rate:0.9,rng:16, spd:38,bld:5,  role:'eng',   d:'柵・建物を壊すのが得意（建物へ×5）。近くの罠を外す'},
  ram:   {n:'破城槌',draw:'ram',   m:1,hp:900,dmg:70,rate:1.6,rng:20, spd:20,bld:1,  role:'ram',isBld:true,carry:2,d:'中心へまっすぐ進む（柵は壊して進む）。壊れるか中心に着くと兵士2部隊が出る。建物あつかい（建物に強い魔物に弱い）'},
  cat:   {n:'移動式投石機',draw:'cat',m:1,hp:320,dmg:55,rate:3.2,rng:270,minR:60,spd:11,bld:2.5,role:'cat',isBld:true,splash:34,d:'とても遅い。遠くから見張り台・建物を壊す（まわりにも当たる）'},
};
const ORDER=['sword','shield','archer','cav','eng','ram','cat'];
// 敵の陣（小・大）。魔物の数と、見張り台・小屋の数
const CAMPS={
  s:{n:'小さな駐留地',foes:{swarm:24,gobarcher:6,grappler:3,troll:1},towers:4,huts:4,traps:6},
  l:{n:'大きな駐留地',foes:{swarm:40,charger:6,gobarcher:10,grappler:6,troll:3,spitter:3},towers:6,huts:6,traps:12},
};
let G=null,cv=null,cx=null,raf=0,last=0,nid=1;
const $=id=>document.getElementById(id);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=o=>o&&o.hp>0;
function mem(u){const d=SU[u.t];return d.m>1?Math.max(0,Math.ceil(u.hp/d.hp-1e-6)):(u.hp>0?1:0);}
function sfx(n){try{if(typeof se==='function')se(n);}catch(e){}}

// ---------- 画面（編成） ----------
function openSiege(){
  if(typeof S!=='undefined'&&S&&S.overlay&&typeof closeOverlay==='function')closeOverlay();
  G={phase:'setup',pool:Object.fromEntries(ORDER.map(k=>[k,{sword:4,shield:2,archer:3,cav:1,eng:1,ram:1,cat:1}[k]||0])),camp:'s',speed:1,paused:false};
  let root=$('siege');if(!root){root=document.createElement('div');root.id='siege';document.body.appendChild(root);}
  root.style.display='flex';document.body.classList.add('siegeOn');renderSetup();
}
function renderSetup(){const root=$('siege');
  root.innerHTML=`<div class="sgSetup"><h2>攻城戦（試作）<small>駐留地を別の戦場で攻める</small></h2>
    <div class="sgRow"><b>攻める陣</b>${Object.entries(CAMPS).map(([k,c])=>`<button data-camp="${k}" class="${G.camp===k?'on':''}">${c.n}<small>${Object.entries(c.foes).map(([e,n])=>`${(typeof E!=='undefined'&&E[e]?E[e].name:e)}${n}`).join('・')}・見張り台${c.towers}</small></button>`).join('')}</div>
    <div class="sgHelp">連れていく部隊を自由に選べます（試作なので費用なし）。左の帯に置いてから「戦闘開始」。陣の中心を壊せば勝ちです。</div>
    <div class="sgUnits">${ORDER.map(k=>{const d=SU[k];return `<div class="sgU"><span class="sgI">${unitIcon(k,32)}</span><span class="sgN"><b>${d.n}</b><small>${d.d}</small><small class="muted">${d.m>1?`${d.m}人・`:''}体力${d.hp*d.m}・攻撃${d.dmg*d.m}${d.rng>40?`・射程${d.rng}`:''}</small></span><span class="sgC"><button data-dec="${k}">−</button><b>${G.pool[k]}</b><button data-inc="${k}">＋</button></span></div>`;}).join('')}</div>
    <div class="sgFoot"><button id="sgBack">やめる（タイトルへ）</button><button id="sgGo" class="primary" ${ORDER.some(k=>G.pool[k]>0)?'':'disabled'}>出撃（配置へ）</button></div></div>`;
  root.querySelectorAll('[data-camp]').forEach(b=>b.onclick=()=>{G.camp=b.dataset.camp;sfx('click');renderSetup();});
  root.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{G.pool[b.dataset.inc]=Math.min(30,G.pool[b.dataset.inc]+1);sfx('click');renderSetup();});
  root.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{G.pool[b.dataset.dec]=Math.max(0,G.pool[b.dataset.dec]-1);sfx('click');renderSetup();});
  $('sgBack').onclick=closeSiege;$('sgGo').onclick=startDeploy;
}
function closeSiege(){cancelAnimationFrame(raf);raf=0;const root=$('siege');if(root){root.style.display='none';root.innerHTML='';}document.body.classList.remove('siegeOn');G=null;if(typeof showTitle==='function')showTitle();}
// 部隊の絵（ドット絵の歩く1コマ目）。破城槌・投石機は自前の絵
function unitIcon(k,sz){const d=SU[k];if(d.draw){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.translate(16,18);(d.draw==='ram'?drawRam:drawCat)(g,0,0,1,0);return `<img src="${c.toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated">`;}
  const sp=typeof SPR!=='undefined'&&SPR.units&&SPR.units[d.spr];if(!sp)return '';return `<img src="${sp.img.walk[0].toDataURL()}" width="${sz}" height="${sz}" style="image-rendering:pixelated">`;}

// ---------- 戦場をつくる ----------
function buildField(){const c=CAMPS[G.camp];G.units=[];G.foes=[];G.blds=[];G.shots=[];G.fx=[];G.traps=[];G.sel=new Set();G.t=0;G.card=ORDER.find(k=>G.pool[k]>0)||null;
  const B=(kind,x,y,r,hp,ex)=>G.blds.push(Object.assign({id:nid++,kind,x,y,r,hp,maxhp:hp,cd:Math.random()},ex||{}));
  B('center',CX,CY,28,1800);
  // 柵の輪（杭を並べる）。左の手前に1か所・右に1か所すき間
  const N=Math.round(2*Math.PI*RING/14);for(let i=0;i<N;i++){const a=i/N*Math.PI*2;const deg=a*180/Math.PI;if(Math.abs(deg-180)<9||Math.abs(deg-0)<7||deg>353)continue;B('post',CX+Math.cos(a)*RING,CY+Math.sin(a)*RING,8,170);}
  for(let i=0;i<c.towers;i++){const a=(i+0.5)/c.towers*Math.PI*2;B('tower',CX+Math.cos(a)*118,CY+Math.sin(a)*118,15,420,{rng:150,dmg:8,rate:1.1});}
  for(let i=0;i<c.huts;i++){const a=i/c.huts*Math.PI*2+0.4;B('hut',CX+Math.cos(a)*68,CY+Math.sin(a)*68,16,260);}
  for(let i=0;i<c.traps;i++){const a=Math.PI+(i/(c.traps-1||1)-0.5)*1.6;G.traps.push({x:CX+Math.cos(a)*(RING+28+(i%2)*16),y:CY+Math.sin(a)*(RING+28+(i%2)*16),hp:1});}
  for(const [k,n] of Object.entries(c.foes))for(let i=0;i<n;i++){const d=E[k];const a=Math.random()*Math.PI*2,r=40+Math.random()*(RING-60);const x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r;
    G.foes.push({id:nid++,k,x,y,px:x,py:y,hp:d.hp,maxhp:d.hp,cd:Math.random(),face:-1,tg:null});}
  G.bldTotal=G.blds.filter(b=>b.kind!=='post').reduce((a,b)=>a+b.maxhp,0);
}
function startDeploy(){if(!ORDER.some(k=>G.pool[k]>0))return;G.phase='deploy';buildField();renderField();loopStart();}
function spawnSquad(k,x,y,carry){const d=SU[k];const u={id:nid++,t:k,x,y,hp:d.hp*d.m,maxhp:d.hp*d.m,cd:Math.random()*d.rate,face:1,tg:null,tx:null,ty:null,hold:false,walk:Math.random()*4,spawned:false};G.units.push(u);return u;}

// ---------- 戦場の画面 ----------
function renderField(){const root=$('siege');
  root.innerHTML=`<div class="sgTop"><b>攻城戦（試作）</b><span id="sgStat"></span><span class="grow"></span>
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
function fit(){if(!cv)return;const r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);G.k=Math.min(cv.width/W,cv.height/H);G.ox=(cv.width-W*G.k)/2;G.oy=(cv.height-H*G.k)/2;}
function renderCards(){const el=$('sgCards');if(!el)return;
  el.innerHTML=ORDER.filter(k=>G.pool[k]>0||G.units.some(u=>u.t===k)).map(k=>`<button data-card="${k}" class="${G.card===k?'on':''}" ${G.pool[k]?'':'disabled'}>${unitIcon(k,22)}<span>${SU[k].n}</span><b>${G.pool[k]}</b></button>`).join('')+
    (G.phase==='deploy'?`<button id="sgAll" class="ghost">残りを全部置く</button><button id="sgFight" class="primary" ${G.units.length?'':'disabled'}>戦闘開始</button>`:'');
  el.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{G.card=G.card===b.dataset.card?null:b.dataset.card;sfx('click');renderCards();msg(G.card?`${SU[G.card].n}：左の帯をタップして置く`:'');});
  const a=$('sgAll');if(a)a.onclick=()=>{let i=0;for(const k of ORDER)while(G.pool[k]>0){const n=G.units.length;spawnSquad(k,60+((n*37)%150),70+((n*83)%(H-140)));G.pool[k]--;i++;}sfx('build');renderCards();};
  const f=$('sgFight');if(f)f.onclick=()=>{G.phase='battle';sfx('alarm');msg('戦闘開始！ 部隊は自分で動きます。部隊を選んで地図をタップすると移動、敵を押すとそこを攻撃');renderCards();};}
function renderCmd(){const el=$('sgCmd');if(!el)return;const n=G.sel.size;
  el.innerHTML=n?`<span>${n}部隊を選択中</span><button data-cmd="auto">自動で戦う</button><button data-cmd="hold">固守</button><button data-cmd="none">選択を解除</button>`:`<button data-cmd="all">全部隊を選ぶ</button><span class="muted">ドラッグで範囲選択</span>`;
  el.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;const us=G.units.filter(u=>G.sel.has(u.id)&&alive(u));
    if(c==='all'){G.units.filter(alive).forEach(u=>G.sel.add(u.id));}
    else if(c==='none')G.sel.clear();
    else for(const u of us){u.tx=u.ty=null;u.tg=null;u.hold=c==='hold';}
    sfx('click');renderCmd();});}
function msg(t){const m=$('sgMsg');if(!m)return;m.textContent=t;m.classList.toggle('on',!!t);clearTimeout(m._t);if(t)m._t=setTimeout(()=>m.classList.remove('on'),4000);}

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
function tap(p,shift){
  // 置く
  if(G.card&&G.phase!=='end'){if(p.x<DEPLOY_X&&p.x>10&&p.y>10&&p.y<H-10){if(G.pool[G.card]>0){spawnSquad(G.card,p.x,p.y);G.pool[G.card]--;sfx('build');if(!G.pool[G.card])G.card=ORDER.find(k=>G.pool[k]>0)||null;renderCards();}return;}
    else{msg('部隊は左の帯（明るい所）にだけ置けます');return;}}
  // 自分の部隊を押す → 選ぶ
  const u=G.units.filter(alive).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(u&&dist(u,p)<22){if(!shift&&!G.sel.has(u.id))G.sel.clear();if(shift&&G.sel.has(u.id))G.sel.delete(u.id);else G.sel.add(u.id);sfx('click');renderCmd();return;}
  if(!G.sel.size)return;
  // 敵（魔物・建物）を押す → そこを攻撃。地面 → そこへ移動
  const f=G.foes.filter(alive).find(o=>dist(o,p)<16)||G.blds.filter(alive).find(o=>dist(o,p)<o.r+6);
  for(const id of G.sel){const s=G.units.find(x=>x.id===id);if(!alive(s))continue;if(f){s.tg=f;s.tx=s.ty=null;s.focus=true;}else{s.tx=p.x+(Math.random()-0.5)*24;s.ty=p.y+(Math.random()-0.5)*24;s.tg=null;s.focus=false;}s.hold=false;}
  G.fx.push({x:p.x,y:p.y,r:14,t:0,dur:0.4,c:f?'#ff5a4e':'#62c6d9'});sfx('click');
}

// ---------- 戦い ----------
function loopStart(){cancelAnimationFrame(raf);last=performance.now();const step=now=>{raf=requestAnimationFrame(step);const dt=Math.min(0.05,(now-last)/1000);last=now;
    if(G.phase==='battle'&&!G.paused)for(let i=0;i<G.speed;i++)update(dt);else{for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);}
    draw(now/1000);hud();};raf=requestAnimationFrame(step);}
// 一番近いもの
function nearest(o,list,max,filt){let best=null,bd=max||1e9;for(const t of list){if(!alive(t)||(filt&&!filt(t)))continue;const d=dist(o,t);if(d<bd){bd=d;best=t;}}return best;}
function center(){return G.blds.find(b=>b.kind==='center');}
// 杭にぶつかるか（攻め側だけ。魔物は自分の柵をすり抜ける）
function blocker(x,y,r){for(const b of G.blds)if(b.kind==='post'&&b.hp>0&&Math.hypot(b.x-x,b.y-y)<b.r+r)return b;return null;}
function stepTo(u,tx,ty,spd,dt){const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);if(d<2)return null;const s=Math.min(d,spd*dt),nx=u.x+dx/d*s,ny=u.y+dy/d*s;
  if(Math.abs(dx)>0.5)u.face=dx>0?1:-1;const b=blocker(nx,ny,u.t==='ram'?14:7);if(b)return b;u.x=Math.max(6,Math.min(W-6,nx));u.y=Math.max(6,Math.min(H-6,ny));u.walk+=dt*8;return null;}
function hitBld(b,dmg){b.hp-=dmg;if(b.hp<=0){b.hp=0;G.fx.push({x:b.x,y:b.y,r:b.r*1.6,t:0,dur:0.5,c:'#ffb14e'});if(b.kind!=='post')sfx('destroy');}}
function hitUnit(u,dmg){u.hp-=dmg;if(u.hp<=0){u.hp=0;G.sel.delete(u.id);if(SU[u.t].carry&&!u.spawned)releaseRam(u);}}
function hitFoe(f,dmg){const d=E[f.k];f.hp-=dmg*(1-(d.armor||0));if(f.hp<=0){f.hp=0;}}
// 破城槌：壊れるか中心に着いたら、仕込んだ兵士が出てくる
function releaseRam(u){u.spawned=true;for(let i=0;i<SU[u.t].carry;i++){const s=spawnSquad('sword',u.x+(i?14:-14),u.y+(i?10:-10));s.face=u.face;}G.fx.push({x:u.x,y:u.y,r:30,t:0,dur:0.5,c:'#f2b33d'});msg('破城槌から兵士2部隊が出てきた！');sfx('upgrade');}
function shoot(a,b,col){G.shots.push({x:a.x,y:a.y,tx:b.x,ty:b.y,t:0,c:col||'#e8d8a0'});}

function update(dt){G.t+=dt;
  const cen=center();
  // --- こちらの部隊 ---
  for(const u of G.units){if(!alive(u))continue;const d=SU[u.t];u.cd-=dt;const n=mem(u),atk=d.dmg*n;
    // 工兵は近くの罠を外す
    if(d.role==='eng')for(const tr of G.traps)if(tr.hp>0&&Math.hypot(tr.x-u.x,tr.y-u.y)<40){tr.hp=0;G.fx.push({x:tr.x,y:tr.y,r:10,t:0,dur:0.4,c:'#6fe08a'});}
    // 罠（トゲ）を踏む
    if(!d.isBld)for(const tr of G.traps)if(tr.hp>0&&Math.hypot(tr.x-u.x,tr.y-u.y)<11)hitUnit(u,14*dt);
    // ねらい
    let tg=u.tg&&alive(u.tg)?u.tg:null;if(!tg)u.focus=false;
    if(u.tx!=null){const b=stepTo(u,u.tx,u.ty,d.spd,dt);   // 移動の指示：柵にぶつかったら、近接は杭を壊して進む・遠くを撃つ部隊はそこで止まる
      if(b){if(d.role==='ranged'||d.role==='cat'){u.tx=u.ty=null;}else if(u.cd<=0){u.cd=d.rate;attack(u,b,atk);}continue;}
      if(Math.hypot(u.tx-u.x,u.ty-u.y)<4){u.tx=u.ty=null;}continue;}
    if(!tg||!u.focus){
      if(d.role==='ram')tg=cen;
      else if(d.role==='cat')tg=nearest(u,G.blds,d.rng*1.6,b=>b.kind==='tower')||nearest(u,G.blds,d.rng*1.6,b=>b.kind!=='post')||cen;
      else if(d.role==='eng')tg=nearest(u,G.foes,60)||nearest(u,G.blds,1e9,b=>b.kind!=='post'&&b.kind!=='center')||cen;
      else if(d.role==='cav')tg=nearest(u,G.foes,320,f=>!!(E[f.k].archers||E[f.k].ranged))||nearest(u,G.blds,320,b=>b.kind==='tower')||nearest(u,G.foes,240)||nearest(u,G.blds,1e9,b=>b.kind!=='post');
      else if(d.role==='ranged')tg=nearest(u,G.foes,d.rng+40)||nearest(u,G.blds,d.rng+10,b=>b.kind==='tower')||null;
      else tg=nearest(u,G.foes,240)||nearest(u,G.blds,1e9,b=>b.kind!=='post')||cen;
      if(!u.focus)u.tg=tg;}
    if(u.hold){if(tg&&dist(u,tg)<=d.rng+(tg.r||6)+6&&u.cd<=0){u.cd=d.rate;attack(u,tg,atk);}continue;}
    if(d.role==='ranged'&&!tg){// 近接の味方の後ろにつく（いなければ中心へ少し進む）
      const fr=nearest(u,G.units,1e9,o=>o!==u&&!SU[o.t].isBld&&SU[o.t].role!=='ranged');const gx=fr?fr.x-30:Math.min(cen?cen.x-RING-60:W/2,u.x+40),gy=fr?fr.y:u.y;stepTo(u,gx,gy,d.spd,dt);continue;}
    if(!tg)continue;
    const reach=d.rng+(tg.r||E[tg.k]&&E[tg.k].r||6)+2,dd=dist(u,tg);
    if(d.minR&&dd<d.minR){stepTo(u,u.x-(tg.x-u.x),u.y-(tg.y-u.y),d.spd,dt);continue;}
    if(dd>reach){const b=stepTo(u,tg.x,tg.y,d.spd,dt);if(b&&d.role!=='ranged'&&d.role!=='cat'){if(u.cd<=0){u.cd=d.rate;attack(u,b,atk);}}
      if(d.role==='ram'&&cen&&dist(u,cen)<cen.r+30&&!u.spawned)releaseRam(u);continue;}
    if(d.role==='ram'&&!u.spawned&&tg===cen)releaseRam(u);
    if(u.cd<=0){u.cd=d.rate;attack(u,tg,atk);}
  }
  // --- 魔物 ---
  for(const f of G.foes){if(!alive(f))continue;const d=E[f.k];f.cd-=dt;if(d.regen)f.hp=Math.min(f.maxhp,f.hp+d.regen*dt);
    const rng=d.archers?d.archers.range*28:d.ranged?d.ranged*28:0;
    // 建物を壊すのが得意な魔物は、破城槌・投石機を先に狙う
    let tg=null;if((d.bldMul||1)>1)tg=nearest(f,G.units,170,u=>!!SU[u.t].isBld);
    // 盾兵が近くにいれば引きつけられる
    if(!tg)tg=nearest(f,G.units,70,u=>SU[u.t].role==='shield');
    if(!tg)tg=nearest(f,G.units,rng?rng+40:180);
    const home=Math.hypot(f.px-f.x,f.py-f.y);
    if(tg&&Math.hypot(tg.x-f.px,tg.y-f.py)>RING+170)tg=null;   // 陣から離れすぎた相手は追わない
    if(!tg){if(home>6){const dx=f.px-f.x,dy=f.py-f.y,dd=Math.hypot(dx,dy);f.x+=dx/dd*Math.min(dd,d.spd*dt);f.y+=dy/dd*Math.min(dd,d.spd*dt);f.face=dx>0?1:-1;f.walk=(f.walk||0)+dt*8;}continue;}
    const reach=(rng||d.r+8)+(SU[tg.t].isBld?14:6),dd=dist(f,tg);
    if(dd>reach){const dx=tg.x-f.x,dy=tg.y-f.y;f.x+=dx/dd*d.spd*dt;f.y+=dy/dd*d.spd*dt;f.face=dx>0?1:-1;f.walk=(f.walk||0)+dt*8;continue;}
    if(f.cd<=0){const ar=d.archers;f.cd=ar?ar.rate:d.rate;let dm=ar?ar.dmg:d.dmg*(d.vsS||1);
      if(SU[tg.t].isBld)dm=d.dmg*(d.bldMul||1)*1.5;if(SU[tg.t].red)dm*=1-SU[tg.t].red;
      if(rng)shoot(f,tg,'#b0e070');hitUnit(tg,dm);}
  }
  // --- 見張り台 ---
  for(const b of G.blds){if(b.kind!=='tower'||!alive(b))continue;b.cd-=dt;if(b.cd>0)continue;const t=nearest(b,G.units,b.rng);if(!t)continue;b.cd=b.rate;let dm=b.dmg*(SU[t.t].isBld?0.3:1);if(SU[t.t].red)dm*=1-SU[t.t].red;shoot(b,t);hitUnit(t,dm);}
  // 弾・光
  for(const s of G.shots)s.t+=dt*4;G.shots=G.shots.filter(s=>s.t<1);for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);
  // 勝ち負け
  if(cen&&cen.hp<=0)return endBattle('win');
  if(!G.units.some(alive)&&!ORDER.some(k=>G.pool[k]>0))return endBattle('lose');
}
function attack(u,tg,atk){const d=SU[u.t];
  if(d.role==='cat'){shoot(u,tg,'#c8a070');setTimeout(()=>{if(!G)return;const sp=d.splash;G.fx.push({x:tg.x,y:tg.y,r:sp,t:0,dur:0.4,c:'#c8a070'});
      for(const b of G.blds)if(alive(b)&&Math.hypot(b.x-tg.x,b.y-tg.y)<sp+b.r)hitBld(b,atk*d.bld);for(const f of G.foes)if(alive(f)&&Math.hypot(f.x-tg.x,f.y-tg.y)<sp)hitFoe(f,atk*0.6);},250/G.speed);sfx('how');return;}
  if(d.role==='ranged')shoot(u,tg);
  if(tg.kind)hitBld(tg,atk*d.bld);else hitFoe(tg,atk);
  if(d.role==='ram')sfx('hit');
}
function destroyedPct(){const lost=G.blds.filter(b=>b.kind!=='post').reduce((a,b)=>a+(b.maxhp-Math.max(0,b.hp)),0);return Math.round(lost/G.bldTotal*100);}
function endBattle(why){if(!G||G.phase==='end')return;G.phase='end';const pct=destroyedPct(),kills=G.foes.filter(f=>!alive(f)).length,lostSq=G.units.filter(u=>!alive(u)).length;
  const men0=G.units.reduce((a,u)=>a+(SU[u.t].m>1?SU[u.t].m:0),0),men=G.units.filter(alive).reduce((a,u)=>a+(SU[u.t].m>1?mem(u):0),0);
  sfx(why==='win'?'clear':'error');
  const t=why==='win'?'陣の中心を壊した！ 勝ち':why==='lose'?'全滅… 負け':'撤退した';
  const eff=why==='win'?'本番なら：この方角の襲撃はなくなる':`本番なら（案）：この方角の次の襲撃が ${pct}% 減る`;
  const box=document.createElement('div');box.className='sgEnd';box.innerHTML=`<h2>${t}</h2><div class="sgEG"><span>壊した割合</span><b>${pct}%</b><span>倒した魔物</span><b>${kills} / ${G.foes.length}</b><span>失った部隊</span><b>${lostSq} / ${G.units.length}</b><span>生き残った兵</span><b>${men} / ${men0}</b><span>かかった時間</span><b>${Math.round(G.t)}秒</b></div><div class="muted" style="margin:6px 0 10px">${eff}</div><div class="sgFoot"><button id="sgAgain">同じ編成でもう一度</button><button id="sgEdit">編成を変える</button><button id="sgClose">タイトルへ</button></div>`;
  $('siege').appendChild(box);
  const keep=G.start;$('sgAgain').onclick=()=>{const p=Object.assign({},keep),c=G.camp;G={phase:'setup',pool:p,camp:c,speed:G.speed,paused:false,start:keep};startDeploy();};
  $('sgEdit').onclick=()=>{const p=Object.assign({},keep),c=G.camp;cancelAnimationFrame(raf);G={phase:'setup',pool:p,camp:c,speed:1,paused:false};renderSetup();};
  $('sgClose').onclick=closeSiege;}

// ---------- 描く ----------
function drawRam(g,x,y,s,face){g.save();g.translate(x,y);g.scale(s*(face<0?-1:1),s);
  g.fillStyle='#3a2a1a';g.fillRect(-14,-9,28,14);g.fillStyle='#6a4a2a';g.fillRect(-13,-8,26,6);g.fillStyle='#8a6a3a';for(let i=-12;i<12;i+=6)g.fillRect(i,-8,3,6);
  g.fillStyle='#5a5a62';g.fillRect(12,-4,6,6);g.fillStyle='#9aa0a8';g.fillRect(16,-3,3,4);g.fillStyle='#1c1210';for(const wx of [-9,0,9]){g.beginPath();g.arc(wx,6,3.5,0,7);g.fill();}g.restore();}
function drawCat(g,x,y,s,face){g.save();g.translate(x,y);g.scale(s*(face<0?-1:1),s);
  g.fillStyle='#4a3420';g.fillRect(-12,0,24,6);g.fillStyle='#1c1210';for(const wx of [-8,8]){g.beginPath();g.arc(wx,7,4,0,7);g.fill();}
  g.strokeStyle='#8a6a3a';g.lineWidth=3;g.beginPath();g.moveTo(-6,1);g.lineTo(8,-13);g.stroke();g.fillStyle='#6a6a6a';g.beginPath();g.arc(9,-14,3.5,0,7);g.fill();g.fillStyle='#6a4a2a';g.fillRect(-2,-6,4,7);g.restore();}
function sprFrame(cat,k,an){const sp=typeof SPR!=='undefined'&&SPR[cat]&&SPR[cat][k];if(!sp)return null;const L=sp.img.walk||sp.img[Object.keys(sp.img)[0]];return L[Math.floor(an)%L.length];}
function draw(tt){const g=cx;if(!g)return;g.setTransform(1,0,0,1,0,0);g.fillStyle='#070a08';g.fillRect(0,0,cv.width,cv.height);g.setTransform(G.k,0,0,G.k,G.ox,G.oy);g.imageSmoothingEnabled=false;
  // 地面
  g.fillStyle='#2f4a26';g.fillRect(0,0,W,H);
  if(!G.ground){const c=document.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');for(let i=0;i<5000;i++){q.fillStyle=['#36552c','#2a4222','#3b5a30','#283e20'][i%4];q.fillRect((i*137)%W,(i*311+(i*i)%97)%H,2,2);}
    q.fillStyle='rgba(70,52,30,.55)';q.beginPath();q.arc(CX,CY,RING+6,0,7);q.fill();G.ground=c;}
  g.drawImage(G.ground,0,0);
  // 配置の帯
  g.fillStyle=G.phase==='deploy'||G.card?'rgba(98,198,217,.14)':'rgba(98,198,217,.05)';g.fillRect(0,0,DEPLOY_X,H);g.strokeStyle='rgba(98,198,217,.5)';g.setLineDash([6,4]);g.beginPath();g.moveTo(DEPLOY_X,0);g.lineTo(DEPLOY_X,H);g.stroke();g.setLineDash([]);
  // 罠
  for(const t of G.traps){if(t.hp<=0)continue;g.fillStyle='#3a3228';g.fillRect(t.x-6,t.y-6,12,12);g.fillStyle='#c8c8c0';for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.beginPath();g.moveTo(t.x-4+i*6,t.y-1+j*5);g.lineTo(t.x-3+i*6,t.y-5+j*5);g.lineTo(t.x-2+i*6,t.y-1+j*5);g.fill();}}
  // 建物
  for(const b of G.blds){if(b.hp<=0){if(b.kind!=='post'){g.fillStyle='rgba(30,22,16,.8)';g.beginPath();g.ellipse(b.x,b.y+4,b.r,b.r*0.5,0,0,7);g.fill();}continue;}
    if(b.kind==='post'){g.fillStyle='#4a3018';g.fillRect(b.x-4,b.y-11,8,15);g.fillStyle='#7a5430';g.fillRect(b.x-3,b.y-11,3,14);g.fillStyle='#a07848';g.beginPath();g.moveTo(b.x-4,b.y-11);g.lineTo(b.x,b.y-16);g.lineTo(b.x+4,b.y-11);g.fill();}
    else if(b.kind==='tower'){g.fillStyle='#3a2a1a';g.fillRect(b.x-12,b.y-22,24,30);g.fillStyle='#6a4a2a';g.fillRect(b.x-14,b.y-28,28,8);g.fillStyle='#8a2a20';g.beginPath();g.moveTo(b.x-15,b.y-28);g.lineTo(b.x,b.y-40);g.lineTo(b.x+15,b.y-28);g.fill();g.fillStyle='#1c1210';g.fillRect(b.x-4,b.y-4,8,12);}
    else if(b.kind==='hut'){g.fillStyle='#5a4428';g.beginPath();g.moveTo(b.x-18,b.y+8);g.lineTo(b.x,b.y-18);g.lineTo(b.x+18,b.y+8);g.fill();g.fillStyle='#3a2a18';g.beginPath();g.moveTo(b.x-5,b.y+8);g.lineTo(b.x,b.y-4);g.lineTo(b.x+5,b.y+8);g.fill();}
    else if(b.kind==='center'){const sp=typeof SPR!=='undefined'&&SPR.buildings&&SPR.buildings.totem;if(sp){const im=sp.img.idle[Math.floor(tt*5)%sp.img.idle.length];g.drawImage(im,b.x-42,b.y-62,84,84);}else{g.fillStyle='#5a1a30';g.fillRect(b.x-20,b.y-40,40,50);}
      g.fillStyle='#8a1a1a';g.fillRect(b.x+16,b.y-70,3,48);g.fillStyle='#c03030';g.beginPath();g.moveTo(b.x+19,b.y-70);g.lineTo(b.x+40,b.y-63+Math.sin(tt*4)*2);g.lineTo(b.x+19,b.y-56);g.fill();}
    if(b.hp<b.maxhp&&b.kind!=='post'){const w=b.r*2;g.fillStyle='#000';g.fillRect(b.x-w/2,b.y+b.r*0.6+4,w,4);g.fillStyle=b.kind==='center'?'#ff5a4e':'#f2b33d';g.fillRect(b.x-w/2,b.y+b.r*0.6+4,w*b.hp/b.maxhp,4);}}
  // 魔物
  for(const f of G.foes){if(!alive(f))continue;const im=sprFrame('enemies','e_'+f.k,f.walk||0);const sz=(E[f.k].r||6)>=11?36:24;
    g.save();g.translate(f.x,f.y);if(f.face>0)g.scale(-1,1);if(im)g.drawImage(im,-sz/2,-sz+4,sz,sz);else{g.fillStyle=E[f.k].color||'#8ac060';g.fillRect(-5,-10,10,10);}g.restore();
    if(f.hp<f.maxhp){g.fillStyle='#000';g.fillRect(f.x-8,f.y+5,16,2);g.fillStyle='#ff5a4e';g.fillRect(f.x-8,f.y+5,16*f.hp/f.maxhp,2);}}
  // こちらの部隊
  for(const u of G.units){if(!alive(u))continue;const d=SU[u.t],n=mem(u),sel=G.sel.has(u.id);
    if(sel){g.strokeStyle='#62c6d9';g.lineWidth=1.5;g.beginPath();g.ellipse(u.x,u.y+4,d.isBld?20:16,d.isBld?9:7,0,0,7);g.stroke();}
    if(d.draw){(d.draw==='ram'?drawRam:drawCat)(g,u.x,u.y,1.4,u.face);}
    else{const im=sprFrame('units',d.spr,u.walk);const off=[[0,0],[-9,4],[9,4],[-5,-6],[6,-6],[0,8]];for(let i=n-1;i>=0;i--){const [ox,oy]=off[i%off.length];g.save();g.translate(u.x+ox,u.y+oy);if(u.face<0)g.scale(-1,1);if(im)g.drawImage(im,-10,-18,20,20);g.restore();}}
    const r=u.hp/u.maxhp;g.fillStyle='#000';g.fillRect(u.x-12,u.y+(d.isBld?14:9),24,3);g.fillStyle=r<0.3?'#ff5a4e':r<0.6?'#f2b33d':'#6fe08a';g.fillRect(u.x-12,u.y+(d.isBld?14:9),24*r,3);
    if(u.hold){g.fillStyle='#f2b33d';g.font='8px sans-serif';g.textAlign='center';g.fillText('固守',u.x,u.y-22);}}
  // 弾・光
  for(const s of G.shots){const x=s.x+(s.tx-s.x)*s.t,y=s.y+(s.ty-s.y)*s.t-Math.sin(s.t*Math.PI)*12;g.fillStyle=s.c;g.fillRect(x-1.5,y-1.5,3,3);}
  for(const f of G.fx){const k=f.t/f.dur;g.globalAlpha=1-k;g.strokeStyle=f.c;g.lineWidth=2;g.beginPath();g.arc(f.x,f.y,f.r*(0.5+k*0.7),0,7);g.stroke();}g.globalAlpha=1;
  if(G.box){const {a,b}=G.box;g.strokeStyle='#62c6d9';g.setLineDash([5,3]);g.fillStyle='rgba(98,198,217,.12)';g.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));g.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));g.setLineDash([]);}
}
let hudT=0;function hud(){const now=performance.now();if(now-hudT<200)return;hudT=now;const el=$('sgStat');if(!el||!G||!G.blds)return;const cen=center();
  el.innerHTML=`${CAMPS[G.camp].n}　陣の中心 <b style="color:#ff5a4e">${Math.ceil(cen.hp)}</b> / ${cen.maxhp}　壊した割合 <b>${destroyedPct()}%</b>　魔物 ${G.foes.filter(alive).length} / ${G.foes.length}　味方 ${G.units.filter(alive).length}部隊　${G.phase==='deploy'?'<b style="color:#62c6d9">配置中</b>':G.phase==='battle'?'<b style="color:#ff5a4e">戦闘中</b>':''}`;
  if(G.phase==='battle'&&G.units.some(u=>!alive(u)&&G.sel.has(u.id)))renderCmd();}

// ---------- 見た目 ----------
const css=document.createElement('style');css.textContent=`
#siege{position:fixed;inset:0;z-index:95;background:#0b0f0c;display:none;flex-direction:column;color:var(--text,#cfe3cf);font-size:13px}
body.siegeOn #boot{display:none}
#siege .sgSetup{margin:auto;width:min(760px,96vw);max-height:96vh;overflow:auto;background:var(--panel,#121a14);box-shadow:0 0 0 2px #f2b33d;padding:14px 18px}
#siege h2{margin:0 0 8px;color:#f2b33d;font-family:var(--px-font,inherit);font-weight:400}#siege h2 small{font-size:12px;color:var(--dim,#7f9a82);margin-left:10px}
#siege .sgRow{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;margin-bottom:8px}#siege .sgRow>b{align-self:center;min-width:64px}
#siege .sgRow button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:6px 10px;flex:1;min-width:200px}#siege .sgRow button small{font-size:10.5px;color:var(--dim,#7f9a82)}
#siege button.on{box-shadow:inset 0 0 0 2px #f2b33d;color:#f2b33d;background:#2a2210}
#siege .sgHelp{font-size:12px;color:var(--dim,#7f9a82);margin:4px 0 8px}
#siege .sgUnits{display:flex;flex-direction:column;gap:4px}
#siege .sgU{display:flex;align-items:center;gap:10px;padding:4px 8px;background:var(--inset,#0e1510);box-shadow:inset 0 0 0 1px var(--line,#2a3a2d)}
#siege .sgN{flex:1;display:flex;flex-direction:column}#siege .sgN small{font-size:10.5px;color:var(--dim,#7f9a82)}
#siege .sgC{display:flex;align-items:center;gap:6px}#siege .sgC b{min-width:24px;text-align:center;font-size:16px}#siege .sgC button{width:30px;padding:2px 0}
#siege .sgFoot{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
#siege .sgTop{display:flex;align-items:center;gap:10px;padding:4px 10px;background:var(--panel,#121a14);box-shadow:0 1px 0 var(--line,#2a3a2d);flex-shrink:0;flex-wrap:wrap}
#siege .sgTop .grow{flex:1}#siege .sgTop #sgStat{font-size:12px}
#siege canvas{flex:1;min-height:0;width:100%;display:block;touch-action:none}
#siege .sgBot{display:flex;gap:10px;align-items:center;padding:4px 8px;background:var(--panel,#121a14);flex-shrink:0;flex-wrap:wrap}
#siege .sgCards{display:flex;gap:4px;flex-wrap:wrap;flex:1}#siege .sgCards button{display:inline-flex;align-items:center;gap:4px;padding:3px 8px}#siege .sgCards button b{color:#f2b33d}
#siege .sgCmd{display:flex;gap:4px;align-items:center;flex-wrap:wrap}#siege .sgCmd button{padding:3px 8px}
#siege .sgMsg{position:absolute;left:50%;top:52px;transform:translateX(-50%);background:rgba(10,14,11,.92);box-shadow:inset 0 0 0 1px #f2b33d;padding:6px 14px;opacity:0;transition:opacity .3s;pointer-events:none;max-width:90vw;text-align:center}
#siege .sgMsg.on{opacity:1}
#siege .sgEnd{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--panel,#121a14);box-shadow:0 0 0 2px #f2b33d,0 10px 30px #000;padding:14px 20px;min-width:min(420px,92vw)}
@media (max-width:900px){
  #siege .sgTop{flex-wrap:nowrap;gap:6px;padding:2px 6px;font-size:11px}#siege .sgTop>b{display:none}#siege .sgTop #sgStat{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
  #siege .sgTop .grow{display:none}#siege .sgTop button{padding:2px 8px;font-size:11px;flex-shrink:0}
  #siege .sgBot{flex-wrap:nowrap;gap:4px;padding:2px 4px;overflow-x:auto}#siege .sgCards{flex-wrap:nowrap}#siege .sgCards button span{display:none}#siege .sgCards button{padding:2px 6px;flex-shrink:0}
  #siege .sgCmd .muted{display:none}#siege .sgCmd{flex-wrap:nowrap}#siege .sgCmd button{padding:2px 6px;font-size:11px;flex-shrink:0}#siege .sgCmd>span{font-size:10.5px;white-space:nowrap}
  #siege .sgSetup{padding:8px 10px}#siege .sgU{padding:2px 6px}#siege .sgN small:first-of-type{display:none}
}
#siege .sgEG{display:grid;grid-template-columns:auto auto;gap:4px 18px}#siege .sgEG b{text-align:right;font-family:var(--px-font,inherit);font-weight:400;font-size:16px}
`;document.head.appendChild(css);

// ---------- タイトルに「攻城戦（試作）」を足す ----------
function hook(){if(typeof showTitle!=='function'||typeof E==='undefined'||typeof SPR==='undefined'){setTimeout(hook,200);return;}
  const orig=showTitle;window.showTitle=showTitle=function(){const r=orig.apply(this,arguments);try{const nb=document.getElementById('tNew');if(nb&&!document.getElementById('tSiege')){const b=document.createElement('button');b.id='tSiege';b.textContent='攻城戦（試作）';b.style.padding='8px';b.onclick=openSiege;nb.insertAdjacentElement('afterend',b);}}catch(e){}return r;};
  if(typeof S!=='undefined'&&S&&S.overlay==='title')showTitle();
  window.openSiege=openSiege;window.__siege=()=>G;}
hook();
// 編成の「同じ編成でもう一度」のために、出撃時の編成を覚える
const _sd=startDeploy;startDeploy=function(){if(G&&!G.start)G.start=Object.assign({},G.pool);return _sd();};
})();
