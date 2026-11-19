// リリアの説明の動画（proto/tut/ench.mp4・camp.mp4）を録るスクリプト（2026-11-19）
// 使い方（リポジトリの一番上で）：node tools/rec_tut2.js ench   → raw_ench/ に録画（webm）。camp も同じ
//   そのあと ffmpeg で切り出して proto/tut/〇〇.mp4 に（tools/rec_tut.js と同じやり方）
const {chromium}=require('playwright');
const which=process.argv[2];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:640},recordVideo:{dir:'raw_'+which,size:{width:1100,height:640}}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve('proto/index.html'));await p.waitForSelector('#tNew',{timeout:20000});
 await p.evaluate(()=>{localStorage.setItem('nd_tasks','0');});
 await p.click('#tNew');await p.waitForTimeout(300);await p.click('[data-map="f"]');await p.waitForTimeout(300);await p.click('#twGo');await p.waitForTimeout(3500);
 await p.evaluate(()=>{while(S.overlay)closeOverlay();const c=document.createElement('div');c.id='fakeCur';c.style.cssText='position:fixed;z-index:99999;left:0;top:0;width:22px;height:22px;pointer-events:none;transform:translate(-2px,-2px)';c.innerHTML='<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L7 13 L10 20 L13 19 L10 12 L17 12 Z" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>';document.body.appendChild(c);
   addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';},true);
   addEventListener('mousedown',e=>{const r=document.createElement('div');r.style.cssText=`position:fixed;z-index:99998;left:${e.clientX-10}px;top:${e.clientY-10}px;width:20px;height:20px;border:2px solid #ffe14e;border-radius:50%;pointer-events:none;transition:all .4s;opacity:1`;document.body.appendChild(r);requestAnimationFrame(()=>{r.style.transform='scale(2)';r.style.opacity='0';});setTimeout(()=>r.style.display='none',500);},true);
   if(S.guide)S.guide.hide=true;try{renderGuide();}catch(e){}document.querySelectorAll('.toast').forEach(t=>t.style.display='none');});
 const box=async sel=>{const e=await p.$(sel);const r=await e.boundingBox();return [r.x+r.width/2,r.y+r.height/2];};
 const clickAt=async([x,y],steps)=>{await p.mouse.move(x,y,{steps:steps||25});await p.waitForTimeout(250);await p.mouse.click(x,y);};
 if(which==='ench'){
   await p.evaluate(()=>{const hq=hqOf();S.smat=60;S.steel=999;S.stone=999;S.iron=999;S.tech.p_ench=1;S.tipsSeen={ench:1,mod:1,camp:1};
     for(let i=0;i<4;i++){const o=placeB('mg',hq.x+5+i,hq.y-3,true,1);if(o)o.bt=0;}const t=placeB('tower',hq.x+5,hq.y-5,true,1);if(t)t.bt=0;const op=placeB('outpost',hq.x-5,hq.y-6,true,newSz('outpost'));if(op)op.bt=0;
     S.turnsLeft=1;cam.z=1.7;cam.x=bcx(hq)-VW/cam.z/2+40;cam.y=bcy(hq)-VH/cam.z/2-30;clampCam();});
   await p.waitForTimeout(1200);await p.mouse.move(500,300);await p.waitForTimeout(600);
   await clickAt(await box('#bBulk'),30);await p.waitForTimeout(900);
   const eb=await p.evaluate(()=>{const x=[...document.querySelectorAll('#bulkMenu [data-bk]')].find(b=>b.textContent.includes('エンチャント'));const r=x.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
   await clickAt(eb,20);await p.waitForTimeout(1200);
   const cb=await p.evaluate(()=>{const L=[...document.querySelectorAll('[data-neg]')];const i=L.findIndex(x=>x.closest('label').textContent.includes('前哨砦'));const r=(L[i]||L[0]).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
   await clickAt(cb,25);await p.waitForTimeout(1200);await clickAt(await box('#neYes'),25);await p.mouse.move(700,420,{steps:15});await p.waitForTimeout(3500);
   console.log(await p.evaluate(()=>S.blds.filter(b=>b.nEnch).map(b=>b.type).join(',')));
 } else {
   const info=await p.evaluate(()=>{S.tech.scout=1;S.tech.scout2=1;S.tech.scout3=1;S.siegeMode=true;S.tipsSeen={ench:1,mod:1,camp:1};const hq=hqOf();const tr=S.blds.find(b=>b.type==='train')||(placeB('train',hq.x-6,hq.y+10,true),S.blds[S.blds.length-1]);tr.bt=0;
     for(let i=0;i<4;i++)spawnUnit(tr,'inf','pawn');
     const c=S.camps.filter(c=>c.state==='idle').sort((a,b)=>Math.hypot(a.x-hq.x,a.y-hq.y)-Math.hypot(b.x-hq.x,b.y-hq.y))[0];c.found=true;c.asked=true;
     cam.z=1.4;const cx=c.x,cy=c.y;cam.x=cx-VW/cam.z/2;cam.y=cy-VH/cam.z/2;clampCam();const r=document.getElementById('cv').getBoundingClientRect();const k=r.width/VW;return [r.left+(cx-cam.x)*cam.z*k,r.top+(cy-cam.y)*cam.z*k];});
   await p.waitForTimeout(1200);await p.mouse.move(info[0]+200,info[1]+120);await p.waitForTimeout(500);await clickAt(info,30);await p.waitForTimeout(1800);
   if(await p.$('#saGo')){await clickAt(await box('#saGo'),25);await p.waitForTimeout(1500);}
   const picks=await p.$$('[data-pick]');for(const x of picks.slice(0,4)){const r=await x.boundingBox();if(r){await clickAt([r.x+r.width/2,r.y+r.height/2],12);await p.waitForTimeout(300);}}
   if(await p.$('#sgGo')){await clickAt(await box('#sgGo'),25);await p.waitForTimeout(1500);}
   if(await p.$('#sgAll')){await clickAt(await box('#sgAll'),25);await p.waitForTimeout(900);}
   if(await p.$('#sgFight')){await clickAt(await box('#sgFight'),25);await p.mouse.move(550,320,{steps:10});await p.waitForTimeout(6000);}
   console.log(await p.evaluate(()=>{const G=window.__siege&&window.__siege();return G?G.phase+' units '+(G.units||[]).length:'no siege';}));
 }
 console.log(errs.slice(0,3));await ctx.close();await b.close();})();
