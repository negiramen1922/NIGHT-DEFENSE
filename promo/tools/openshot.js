// オープニング用：同じ構図で、昼（施設が建っていく）と夜（大群を守る）を1コマずつ撮る＋太陽・月のアイコン
const {chromium}=require('playwright');const fs=require('fs');
const P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/';
const LAY=process.env.LAYOUT||'mixed';const SH=P+'shots_'+LAY+'/';
const FD=P+'frames_open_day/',FN=P+'frames_open_night/';for(const d of [FD,FN]){fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(d))fs.unlinkSync(d+f);}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let vt=0,real=false;const rn=performance.now.bind(performance);window.__vt={adv:d=>{vt+=d;},on:()=>{real=true;}};performance.now=()=>real?vt:rn();});
await p.goto('file:///home/user/NIGHT-DEFENSE/index.html');await p.waitForTimeout(2500);
// ゲームの太陽・月アイコン
await p.evaluate(()=>{const d=document.createElement('div');d.id='icx';d.style.cssText='position:fixed;left:0;top:0;z-index:99999;display:flex;gap:20px;background:transparent';
  d.innerHTML=`<span id="icSun" style="display:inline-block;line-height:0">${ui('sun','amber',192)}</span><span id="icMoon" style="display:inline-block;line-height:0">${ui('moon','amber',192)}</span>`;document.body.appendChild(d);});
await p.waitForTimeout(300);
await (await p.$('#icSun')).screenshot({path:P+'icon_sun.png',omitBackground:true});
await (await p.$('#icMoon')).screenshot({path:P+'icon_moon.png',omitBackground:true});
await p.evaluate(()=>document.getElementById('icx').remove());
for(const f of ['town.js','raid.js'])await p.addScriptTag({content:fs.readFileSync(P+f,'utf8')});
await p.evaluate(()=>{Math.random=(()=>{let s=12345;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})();});
await p.evaluate(l=>buildTown({layout:l}),LAY);
await p.addStyleTag({content:'#topbar,#intel,#controls,#right,#modeBar,#viewSeg,#guide,#toasts,#reviewBar,.logbox,#pauseMsg,#bpad,#overlay{display:none!important}'});
await p.evaluate(()=>{toggleFull(true);});await p.waitForTimeout(600);
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;__vt.on();resizeView();window.mmPos=()=>[-9999,-9999];});
const Z=+(process.env.Z||1.9),DY=+(process.env.DY||-20),N=105;
const setCam=()=>p.evaluate(([z,dy])=>{const h=hqOf();cam.z=z;cam.x=bcx(h)-VW/z/2;cam.y=bcy(h)+dy-VH/z/2;},[Z,DY]);
let fi=0;
// ── 昼：街の施設を中から順に建てていく（最後に全部そろう）
const nB=await p.evaluate(()=>{const h=hqOf();const cx=bcx(h),cy=bcy(h);
  window.__all=S.blds.filter(b=>b!==h).sort((a,b)=>{const pr=t=>['swall','gate','wall'].includes(t)?0:(B[t].grp==='def'||t==='brazier')?1:2;return pr(a.type)-pr(b.type)||(Math.hypot(bcx(a)-cx,bcy(a)-cy)-Math.hypot(bcx(b)-cx,bcy(b)-cy));});
  for(const b of __all)gridSet(b,false);S.blds=[h];return __all.length;});
const start=Math.round(nB*0.35);
await p.evaluate(n=>{for(let k=0;k<n;k++){const b=__all[k];S.blds.push(b);gridSet(b,true);}},start);
let added=start;await setCam();
for(let i=0;i<N;i++){const want=Math.round(start+(nB-start)*Math.min(1,i/(N*0.85)));
  await p.evaluate(([a,w])=>{for(let k=a;k<w;k++){const b=__all[k];S.blds.push(b);gridSet(b,true);S.fx.push({x:bcx(b),y:bcy(b),r:T*1.4,t:0,dur:0.35,c:'#6fe08a'});}
    __vt.adv(1/30);for(const f of S.fx)f.t+=1/30;S.fx=S.fx.filter(f=>f.t<f.dur);try{draw();}catch(e){}},[added,want]);added=want;
  await p.screenshot({path:FD+'f'+String(fi++).padStart(5,'0')+'.jpg',type:'jpeg',quality:90});}
await p.screenshot({path:SH+'open_day.png'});
// ── 夜：大群が城壁に届くまで進めてから、守っているところを撮る（城壁の外の明かりは消して夜らしく）
await p.evaluate(()=>startRaid({wave:12,depth:30,near:10,scale:0.5}));
for(let i=0;i<150;i++)await p.evaluate(()=>{__vt.adv(2/30);stepGame(1/30,2);});
const dark=()=>{const h=hqOf(),cx=bcx(h),cy=bcy(h);S.lights=(S.lights||[]).filter(l=>Math.hypot(l[0]-cx,l[1]-cy)<15*T).map(l=>[l[0],l[1],l[2]*0.85]);};
await p.evaluate(`window.__dark=${dark.toString()}`);
fi=0;await setCam();
for(let i=0;i<N;i++){await p.evaluate(()=>{for(let k=0;k<2;k++){__vt.adv(1/30);if(S.waveActive)update(1/30);}__dark();S.fogT=0;try{draw();}catch(e){}});
  await p.screenshot({path:FN+'f'+String(fi++).padStart(5,'0')+'.jpg',type:'jpeg',quality:90});}
await p.screenshot({path:SH+'open_night.png'});
console.log('ok',nB,errs.slice(0,3));await b.close();})();
