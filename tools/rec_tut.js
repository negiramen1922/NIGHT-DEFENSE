// チュートリアルの操作の動画（proto/tut/*.mp4）を作り直すスクリプト（2026-11-16）
// 使い方（リポジトリの一番上で。Playwright と ffmpeg が要る）：
//   node tools/rec_tut.js fence   → raw_fence/ に録画（webm）
//   node tools/rec_tut.js move    → raw_move/ に録画
//   ffmpeg -ss 5.6 -to 13.0 -i raw_fence/*.webm -vf "crop=920:378:10:134,scale=640:-2:flags=lanczos,fps=15" -an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart proto/tut/fence.mp4
//   ffmpeg -ss 6.4 -to 15.4 -i raw_move/*.webm  -vf "crop=728:378:10:134,scale=560:-2:flags=lanczos,fps=15" -an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart proto/tut/move.mp4
// 画面のつくりが変わったら、切り出す位置（crop）と始まり・終わり（-ss・-to）を見直す。マウスの矢印はページに描き足している（録画には映らないため）
const {chromium}=require('playwright');
const which=process.argv[2];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:640},recordVideo:{dir:'raw_'+which,size:{width:1100,height:640}}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve('proto/index.html')+'');await p.waitForSelector('#tNew',{timeout:20000});
 await p.evaluate(()=>{localStorage.setItem('nd_tasks','0');});
 await p.click('#tNew');await p.waitForTimeout(300);await p.click('[data-map="t"]');await p.waitForTimeout(300);await p.click('#twGo');await p.waitForTimeout(3500);
 // fake cursor
 await p.evaluate(()=>{const c=document.createElement('div');c.id='fakeCur';c.style.cssText='position:fixed;z-index:99999;left:0;top:0;width:22px;height:22px;pointer-events:none;transform:translate(-2px,-2px)';c.innerHTML='<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L7 13 L10 20 L13 19 L10 12 L17 12 Z" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>';document.body.appendChild(c);
   addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';},true);
   addEventListener('mousedown',e=>{const r=document.createElement('div');r.style.cssText=`position:fixed;z-index:99998;left:${e.clientX-10}px;top:${e.clientY-10}px;width:20px;height:20px;border:2px solid #ffe14e;border-radius:50%;pointer-events:none;transition:all .4s;opacity:1`;document.body.appendChild(r);requestAnimationFrame(()=>{r.style.transform='scale(2)';r.style.opacity='0';});setTimeout(()=>r.remove(),500);},true);
   if(S.guide)S.guide.hide=true;renderGuide&&renderGuide();document.querySelectorAll('.toast').forEach(t=>t.remove());});
 const info=await p.evaluate(()=>{const hq=S.blds.find(b=>b.type==='hq');zoomAt(1.6,VW/2,VH/2);const r=document.getElementById('cv').getBoundingClientRect();const k=r.width/VW;
   cam.x=(hq.x+1)*T-VW/cam.z/2;cam.y=(hq.y-3)*T-VH/cam.z/2;clampCam();window.__k=k;
   const scr=(tx,ty)=>[r.left+((tx+.5)*T-cam.x)*cam.z*k,r.top+((ty+.5)*T-cam.y)*cam.z*k];
   let row=null;for(let dy=-8;dy<=-3&&!row;dy++){const y=hq.y+dy;let ok=true;for(let x=hq.x-5;x<=hq.x+7;x++)if(!placeOKraw('fence',x,y)){ok=false;break;}if(ok)row=y;}
   const sq=null;return {a:scr(hq.x-5,row),b:scr(hq.x+7,row),hq:scr(hq.x+1,hq.y+1),row,r:[r.left,r.top,r.width,r.height]};});
 console.log(JSON.stringify(info));
 if(which==='fence'){
   await p.mouse.move(info.a[0]+120,info.a[1]+140,{steps:1});await p.waitForTimeout(600);
   await p.evaluate(()=>{gRt('build');});await p.waitForTimeout(300);
   const bt=await p.$('#build button[data-k="fence"]');const bb=await bt.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:20});await p.waitForTimeout(300);await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(500);
   await p.mouse.move(info.a[0],info.a[1],{steps:25});await p.waitForTimeout(400);await p.mouse.down();await p.waitForTimeout(200);
   await p.mouse.move(info.b[0],info.b[1],{steps:40});await p.waitForTimeout(500);await p.mouse.up();await p.waitForTimeout(1200);
   await p.keyboard.press('Escape');await p.waitForTimeout(800);
   console.log(await p.evaluate(()=>'fences '+S.blds.filter(b=>b.type==='fence').length));
 } else {
   const s0=await p.evaluate(()=>{const hq=S.blds.find(b=>b.type==='hq');spawnUnit(hq,'mil','farmer');const q=S.squads[S.squads.length-1];q.x=(hq.x-9)*T;q.y=(hq.y-7)*T;q.ax=q.x;q.ay=q.y;q.tx=null;const r=document.getElementById('cv').getBoundingClientRect();const k=r.width/VW;return [r.left+(q.x-cam.x)*cam.z*k,r.top+(q.y-cam.y)*cam.z*k];});
   await p.mouse.move(s0[0]+150,s0[1]-60);await p.waitForTimeout(500);
   await p.mouse.move(s0[0],s0[1],{steps:25});await p.waitForTimeout(300);await p.mouse.click(s0[0],s0[1]);await p.waitForTimeout(700);
   const dst=[s0[0]+260,s0[1]+10];await p.mouse.move(dst[0],dst[1],{steps:30});await p.waitForTimeout(300);await p.mouse.click(dst[0],dst[1]);await p.mouse.move(dst[0]+60,dst[1]+40,{steps:15});await p.waitForTimeout(6000);
   console.log(await p.evaluate(()=>{const q=S.squads[S.squads.length-1];return 'squad at '+Math.round(q.x)+','+Math.round(q.y)+' tx '+q.tx+' moved '+S.movedN;}));
 }
 console.log(errs.slice(0,3));await ctx.close();await b.close();})();
