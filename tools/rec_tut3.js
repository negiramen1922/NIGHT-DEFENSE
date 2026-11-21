// チュートリアルの動画と画像を、新しい操作（UIリメイク）の画面で録り直すスクリプト（2026-11-21）
// 使い方（リポジトリの一番上で。Playwright と ffmpeg が要る）：
//   node tools/rec_tut3.js fence|move|ench|camp   → raw_〇〇/ に録画（webm）。「cut start/end」に切り出す秒を出す
//   node tools/rec_tut3.js econ|hero              → proto/tut/econ.png・hero.png を撮る
//   動画は ffmpeg で proto/tut/〇〇.mp4 に（2026-11-21 に使った秒。録り直したら「cut start/end」の値に合わせる）：
//     ffmpeg -ss 7.2 -to 15.2 -i raw_fence/*.webm -vf "scale=720:-2:flags=lanczos,fps=15" -an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart proto/tut/fence.mp4
//     move 7.2〜17.8・ench 7.4〜17.5・camp 7.5〜23.0（同じ設定）
//   画像：econ.png は資源の表の下の線で切る。hero.png は raw_hero_page.png（2倍）の右の欄の英雄の札2枚を切り出す
//   本番へは mkprod.py が tut/ ごと写す
// マウスの矢印と押した輪はページに描き足している（録画には映らないため）
const {chromium}=require('playwright');const path=require('path');
const which=process.argv[2];
(async()=>{const b=await chromium.launch();const vid=['fence','move','ench','camp'].includes(which);
 const ctx=await b.newContext(Object.assign({viewport:{width:1100,height:640},deviceScaleFactor:vid?1:2},vid?{recordVideo:{dir:'raw_'+which,size:{width:1100,height:640}}}:{}));
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));const T0=Date.now();const mark=n=>console.log('cut',n,((Date.now()-T0)/1000).toFixed(1));
 await p.goto('file://'+path.resolve('proto/index.html'));await p.waitForSelector('#tNew',{timeout:20000});
 await p.evaluate(()=>{localStorage.setItem('nd_tasks','0');});
 await p.click('#tNew');await p.waitForTimeout(300);await p.click('[data-map="f"]');await p.waitForTimeout(300);await p.click('#twGo');await p.waitForTimeout(3500);
 await p.evaluate(()=>{while(S.overlay)closeOverlay();S.paused=false;S.tipsSeen={ench:1,mod:1,camp:1};S.tipQ=[];
   const c=document.createElement('div');c.id='fakeCur';c.style.cssText='position:fixed;z-index:99999;left:-50px;top:0;width:22px;height:22px;pointer-events:none;transform:translate(-2px,-2px)';c.innerHTML='<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L7 13 L10 20 L13 19 L10 12 L17 12 Z" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>';document.body.appendChild(c);
   addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';},true);
   addEventListener('mousedown',e=>{const r=document.createElement('div');r.style.cssText=`position:fixed;z-index:99998;left:${e.clientX-10}px;top:${e.clientY-10}px;width:20px;height:20px;border:2px solid #ffe14e;border-radius:50%;pointer-events:none;transition:all .4s;opacity:1`;document.body.appendChild(r);requestAnimationFrame(()=>{r.style.transform='scale(2)';r.style.opacity='0';});setTimeout(()=>{r.style.display='none';},500);},true);
   if(S.guide)S.guide.hide=true;try{renderGuide();}catch(e){}
   const st=document.createElement('style');st.textContent='.toast,#toasts,#newsTop,.newsTop,#guide{display:none!important}';document.head.appendChild(st);});
 const box=async sel=>{const e=await p.$(sel);const r=await e.boundingBox();return [r.x+r.width/2,r.y+r.height/2];};
 const clickAt=async([x,y],steps)=>{await p.mouse.move(x,y,{steps:steps||25});await p.waitForTimeout(250);await p.mouse.click(x,y);};
 const scr=(wx,wy)=>p.evaluate(([wx,wy])=>{const r=document.getElementById('cv').getBoundingClientRect();const k=r.width/VW;return [r.left+(wx-cam.x)*cam.z*k,r.top+(wy-cam.y)*cam.z*k];},[wx,wy]);
 const camOn=(wx,wy,z)=>p.evaluate(([wx,wy,z])=>{cam.z=z;cam.x=wx-VW/z/2;cam.y=wy-VH/z/2;clampCam();},[wx,wy,z]);
 const ringBtn=txt=>p.evaluate(t=>{const x=[...document.querySelectorAll('#u2Ring button')].find(b=>t.some(s=>b.textContent.includes(s))&&b.getClientRects().length);if(!x)return null;const r=x.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];},txt);
 const Tz=await p.evaluate(()=>T);
 if(which==='fence'){
   const I=await p.evaluate(()=>{const hq=hqOf();let row=null;for(let dy=-8;dy<=-3&&!row;dy++){const y=hq.y+dy;let ok=true;for(let x=hq.x-4;x<=hq.x+6;x++)if(!placeOKraw('fence',x,y)){ok=false;break;}if(ok)row=y;}return {hx:hq.x,row};});
   await camOn((I.hx+1.5)*Tz,(I.row+2)*Tz,1.6);await p.waitForTimeout(800);
   const a=await scr((I.hx-4+.5)*Tz,(I.row+.5)*Tz),z=await scr((I.hx+6+.5)*Tz,(I.row+.5)*Tz);
   await p.mouse.move(a[0]+150,a[1]+160);await p.waitForTimeout(500);mark('start');
   await clickAt(await box('#u2Build'),30);await p.waitForTimeout(800);
   const bt=await p.$('#build button[data-k="fence"]');await bt.scrollIntoViewIfNeeded();const bb=await bt.boundingBox();await clickAt([bb.x+bb.width/2,bb.y+bb.height/2],25);await p.waitForTimeout(600);
   await p.mouse.move(a[0],a[1],{steps:30});await p.waitForTimeout(400);await p.mouse.down();await p.waitForTimeout(200);
   await p.mouse.move(z[0],z[1],{steps:45});await p.waitForTimeout(500);await p.mouse.up();await p.waitForTimeout(1300);
   await p.keyboard.press('Escape');await p.waitForTimeout(900);mark('end');
   console.log(await p.evaluate(()=>'fences '+S.blds.filter(b=>b.type==='fence').length));
 } else if(which==='move'){
   const q0=await p.evaluate(()=>{const hq=hqOf();spawnUnit(hq,'mil','farmer');const q=S.squads[S.squads.length-1];q.x=(hq.x-6)*T;q.y=(hq.y-5)*T;q.ax=q.x;q.ay=q.y;q.tx=null;return [q.x,q.y];});
   await camOn(q0[0]+3*Tz,q0[1],1.2);await p.waitForTimeout(800);
   const s=await scr(q0[0],q0[1]);await p.mouse.move(s[0]+160,s[1]-80);await p.waitForTimeout(500);mark('start');
   await clickAt(s,25);await p.waitForTimeout(1300);   // 選ぶと寄って拡大し、まわりにボタン
   const g=await ringBtn(['迎撃','固守']);
   if(g){await clickAt(g,20);await p.waitForTimeout(900);const g2=await ringBtn(['迎撃','固守']);if(g2){await clickAt(g2,6);await p.waitForTimeout(900);}}   // 迎撃／固守の切り替え
   const d=await p.evaluate(()=>{const q=S.squads[S.squads.length-1];return [q.x+6*T,q.y+1.5*T];});const ds=await scr(d[0],d[1]);
   await clickAt(ds,30);await p.mouse.move(ds[0]+50,ds[1]+60,{steps:15});await p.waitForTimeout(4500);mark('end');
   console.log(await p.evaluate(()=>{const q=S.squads[S.squads.length-1];return 'squad '+Math.round(q.x)+','+Math.round(q.y)+' tx '+q.tx+' moved '+S.movedN+' mode '+q.mode;}),'ring',!!g);
 } else if(which==='ench'){
   const hq=await p.evaluate(()=>{const hq=hqOf();S.smat=60;S.steel=999;S.stone=999;S.iron=999;S.tech.p_ench=1;
     for(let i=0;i<4;i++){const o=placeB('mg',hq.x+5+i,hq.y-3,true,1);if(o)o.bt=0;}const t=placeB('tower',hq.x+5,hq.y-5,true,1);if(t)t.bt=0;const op=placeB('outpost',hq.x-5,hq.y-6,true,newSz('outpost'));if(op)op.bt=0;
     for(const b of S.blds)b.bt=0;S.turnsLeft=1;return [bcx(hq)+30,bcy(hq)-60];});
   await camOn(hq[0],hq[1],1.6);await p.waitForTimeout(1200);await p.mouse.move(500,300);await p.waitForTimeout(500);mark('start');
   await clickAt(await box('#bBulk'),30);await p.waitForTimeout(900);
   const eb=await p.evaluate(()=>{const x=[...document.querySelectorAll('#bulkMenu [data-bk]')].find(b=>b.textContent.includes('エンチャント'));const r=x.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
   await clickAt(eb,20);await p.waitForTimeout(1200);
   const cb=await p.evaluate(()=>{const L=[...document.querySelectorAll('[data-neg]')];const i=L.findIndex(x=>x.closest('label').textContent.includes('前哨砦'));const r=(L[i]||L[0]).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
   await clickAt(cb,25);await p.waitForTimeout(1200);await clickAt(await box('#neYes'),25);await p.mouse.move(700,420,{steps:15});await p.waitForTimeout(3500);mark('end');
   console.log(await p.evaluate(()=>S.blds.filter(b=>b.nEnch).map(b=>b.type).join(',')));
 } else if(which==='camp'){
   const c=await p.evaluate(()=>{S.tech.scout=1;S.tech.scout2=1;S.tech.scout3=1;S.siegeMode=true;const hq=hqOf();placeB('train',hq.x-6,hq.y+10,true);const tr=S.blds[S.blds.length-1];tr.bt=0;
     for(let i=0;i<4;i++)spawnUnit(tr,'inf','pawn');
     const c=S.camps.filter(c=>c.state==='idle').sort((a,b)=>Math.hypot(a.x-hq.x,a.y-hq.y)-Math.hypot(b.x-hq.x,b.y-hq.y))[0];c.found=true;c.asked=true;return [c.x,c.y];});
   await camOn(c[0],c[1],1.4);await p.waitForTimeout(1200);const cs=await scr(c[0],c[1]);await p.mouse.move(cs[0]+200,cs[1]+120);await p.waitForTimeout(500);mark('start');
   await clickAt(cs,30);await p.waitForTimeout(1800);
   if(await p.$('#saGo')){await clickAt(await box('#saGo'),25);await p.waitForTimeout(1500);}
   for(const x of (await p.$$('[data-pick]')).slice(0,4)){const r=await x.boundingBox();if(r){await clickAt([r.x+r.width/2,r.y+r.height/2],12);await p.waitForTimeout(300);}}
   if(await p.$('#sgGo')){await clickAt(await box('#sgGo'),25);await p.waitForTimeout(1500);}
   if(await p.$('#sgAll')){await clickAt(await box('#sgAll'),25);await p.waitForTimeout(900);}
   if(await p.$('#sgFight')){await clickAt(await box('#sgFight'),25);await p.mouse.move(550,320,{steps:10});await p.waitForTimeout(6000);}
   mark('end');console.log(await p.evaluate(()=>{const G=window.__siege&&window.__siege();return G?G.phase+' units '+(G.units||[]).length:'no siege';}));
 } else if(which==='econ'){
   await p.evaluate(()=>{const hq=hqOf();for(const [t,dx,dy] of [['miner',-6,-4],['quarry',6,-4],['farm',-6,4],['fishery',4,5]]){const o=placeB(t,hq.x+dx,hq.y+dy,true);if(o)o.bt=0;}for(const b of S.blds)b.bt=0;u2Tab('econ');});
   await p.waitForTimeout(1200);const el=await p.$('#econ');await el.screenshot({path:'proto/tut/econ.png'});console.log('econ',await el.boundingBox());
 } else if(which==='hero'){
   await p.evaluate(()=>{const hq=hqOf();const h=placeB('herohouse',hq.x+5,hq.y+3,true);if(h)h.bt=0;});
   const n=await p.evaluate(()=>{const out=[];for(const sp of ['歩兵','内政']){try{const c=makeCmd(sp,1);S.cmds.push(c);out.push(c.name);}catch(e){out.push('x '+e.message);}}return out;});
   await p.evaluate(()=>{u2Tab('army');openArmyTab('hero');});await p.waitForTimeout(1200);
   await p.screenshot({path:'raw_hero_page.png'});console.log('hero',n);
 }
 console.log(errs.slice(0,3));await ctx.close();await b.close();})();
