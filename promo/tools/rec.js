// 宣伝動画の素材を1コマずつ撮る（30fps・1920x1080）
// 使い方: node rec.js  → frames/f00000.jpg ... と shots/*.png（静止画用）
const {chromium}=require('playwright');const fs=require('fs');
const P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/';
const FPS=30;const LAY=process.env.LAYOUT||'mixed';const FR='frames_'+LAY+'/',SH='shots_'+LAY+'/';
fs.mkdirSync(P+FR,{recursive:true});fs.mkdirSync(P+SH,{recursive:true});
for(const f of fs.readdirSync(P+FR))fs.unlinkSync(P+FR+f);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
// 仮想の時計（1コマごとに1/30秒だけ進める）
await p.addInitScript(()=>{let vt=0,real=false;const rn=performance.now.bind(performance);window.__vt={adv:d=>{vt+=d;},on:()=>{real=true;}};performance.now=()=>real?vt:rn();});
await p.goto('file:///home/user/NIGHT-DEFENSE/index.html');await p.waitForTimeout(2500);
for(const f of ['town.js','raid.js'])await p.addScriptTag({content:fs.readFileSync(P+f,'utf8')});
await p.evaluate(()=>{Math.random=(()=>{let s=12345;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})();});
await p.evaluate(l=>buildTown({layout:l}),LAY);
await p.addStyleTag({content:'#topbar,#intel,#controls,#right,#modeBar,#viewSeg,#guide,#toasts,#reviewBar,.logbox,#pauseMsg,#bpad,#overlay{display:none!important}canvas#cv{cursor:none}'});
await p.evaluate(()=>{toggleFull(true);});await p.waitForTimeout(600);
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;__vt.on();resizeView();});await p.waitForTimeout(300);
// 街の施設を一度しまって、あとで順に建てる（タイムラプス）
const nB=await p.evaluate(()=>{const h=hqOf();const cx=bcx(h),cy=bcy(h);
  window.__all=S.blds.filter(b=>b!==h).sort((a,b)=>{const pr=t=>['swall','gate','wall'].includes(t)?2:(B[t].grp==='def'||t==='brazier')?3:(['barracks','ammo','market','lab','church','tavern','train','magic'].includes(t)?0:1);return pr(a.type)-pr(b.type)||(Math.hypot(bcx(a)-cx,bcy(a)-cy)-Math.hypot(bcx(b)-cx,bcy(b)-cy));});
  for(const b of __all)gridSet(b,false);S.blds=[h];window.__sq=S.squads;S.squads=[];return __all.length;});
let fi=0;
const shot=async()=>{await p.screenshot({path:P+FR+'f'+String(fi).padStart(5,'0')+'.jpg',type:'jpeg',quality:90});fi++;};
const cam=(x,y,z)=>p.evaluate(([x,y,z])=>{cam.z=z;cam.x=x-VW/z/2;cam.y=y-VH/z/2;},[x,y,z]);
const center=await p.evaluate(()=>{const h=hqOf();return [bcx(h),bcy(h)];});
const ease=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const lerp=(a,b,t)=>a+(b-a)*t;
// ── 1) 昼：街が育つ（7秒）。寄りから引きへ
{const N=7*FPS;let added=0;
 for(let i=0;i<N;i++){const t=i/(N-1);const want=Math.round(nB*Math.min(1,t*1.15));
  await p.evaluate(([a,w])=>{for(let k=a;k<w;k++){const b=__all[k];S.blds.push(b);gridSet(b,true);b.fxT=1;S.fx.push({x:bcx(b),y:bcy(b),r:T*1.4,t:0,dur:0.35,c:'#6fe08a'});}},[added,want]);added=want;
  if(i===Math.round(N*0.75))await p.evaluate(()=>{S.squads=__sq;});
  const e=ease(t);await cam(center[0],center[1]+lerp(20,0,e),lerp(1.7,0.95,e));
  await p.evaluate(()=>{__vt.adv(1/30);for(const f of S.fx)f.t+=1/30;S.fx=S.fx.filter(f=>f.t<f.dur);try{draw();}catch(e){}});await shot();}
 await p.screenshot({path:P+SH+'day_town.png'});}
// 昼の寄り（静止画用）
await cam(center[0],center[1],1.6);await p.evaluate(()=>{try{draw();}catch(e){}});await p.screenshot({path:P+SH+'day_close.png'});
await cam(center[0],center[1]-40,1.25);await p.evaluate(()=>{try{draw();}catch(e){}});await p.screenshot({path:P+SH+'open_day.png'});
// ── 2) 夜になる：敵を出して、闇から迫るのを見せる（4秒）。北へ寄せる
const nE=await p.evaluate(()=>startRaid({wave:12,depth:30,near:10,scale:0.5}));
const north=[center[0],center[1]-17*28*0.5];
{const N=4*FPS;for(let i=0;i<N;i++){const e=ease(i/(N-1));
  await cam(center[0],lerp(center[1],center[1]-300,e),lerp(0.95,1.3,e));
  await p.evaluate(()=>{__vt.adv(1/30);stepGame(1/30,1);});await shot();}
 await p.screenshot({path:P+SH+'night_horde.png'});}
// ── 3) 激突：北の壁に寄る（6秒・×2）
{const N=6*FPS;for(let i=0;i<N;i++){const e=ease(i/(N-1));
  await cam(center[0],center[1]-lerp(300,215,e),lerp(1.3,1.9,e));
  await p.evaluate(k=>{const n=k%2?2:1;__vt.adv(n/30);stepGame(1/30,n);},i);await shot();
  if(i===Math.round(N*0.6))await p.screenshot({path:P+SH+'clash_close.png'});}}
// ── 4) 引いて全体：四方から押し寄せるのを凌ぐ（6秒・×2）
{const N=6*FPS;for(let i=0;i<N;i++){const e=ease(i/(N-1));
  await cam(center[0],lerp(center[1]-215,center[1],e),lerp(1.9,0.95,e));
  await p.evaluate(k=>{const n=k%2?2:1;__vt.adv(n/30);stepGame(1/30,n);},i);await shot();
  if(i===N-1)await p.screenshot({path:P+SH+'battle_wide.png'});}}
// ── 5) 続き：少しずつ寄りながら戦いを見せる（4秒・×3）
{const N=4*FPS;for(let i=0;i<N;i++){const e=ease(i/(N-1));
  await cam(center[0]+lerp(0,200,e),center[1]+lerp(0,20,e),lerp(0.95,1.5,e));
  await p.evaluate(()=>{__vt.adv(2/30);stepGame(1/30,2);});await shot();
  if(i===N-1)await p.screenshot({path:P+SH+'east_wall.png'});}}
await cam(center[0],center[1]-40,1.25);await p.evaluate(()=>{try{draw();}catch(e){}});await p.screenshot({path:P+SH+'open_night.png'});
const st=await p.evaluate(()=>{const h=hqOf();const c=window.__c||[0,0];let inside=0;if(h){for(const e of S.enemies)if(Math.hypot(e.x-bcx(h),e.y-bcy(h))<15*T)inside++;}return {en:S.enemies.length,kills:S.waveKills,hq:h?Math.round(h.hp)+'/'+Math.round(h.maxhp):'LOST',inside,blds:S.blds.length};});
fs.writeFileSync(P+'rec_info_'+LAY+'.json',JSON.stringify({frames:fi,nB,nE,...st}));
console.log('frames',fi,'buildings',nB,'enemies',nE,st,errs.slice(0,5));await b.close();})();
