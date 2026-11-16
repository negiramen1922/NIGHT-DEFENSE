// タイトルの背景の動画（proto/tut/title.mp4：夜の襲撃を城壁でしのぐ場面）を作り直すスクリプト（2026-11-16）
// 使い方（リポジトリの一番上で。Playwright と ffmpeg が要る）：
//   node tools/rec_title.js          → title_frames/ に 15コマ/秒 × 14秒の画像
//   ffmpeg -framerate 15 -i title_frames/f%04d.jpg -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart proto/tut/title.mp4
// ゲームを止めて1コマずつ進め、地図のまん中（960×540）を切り出す（大きな画面の録画はうまく撮れないため）。
// 録るあいだだけ、施設は壊れない・部隊は倒れない・敵は北から城壁へ来るようにしている（ゲームの中身は変えない）
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const stage=async(p)=>{
 await p.goto('file://'+path.resolve('proto/index.html')+'');await p.waitForSelector('#tNew',{timeout:20000});
 await p.evaluate(()=>{localStorage.setItem('nd_tasks','0');});
 await p.evaluate(()=>{closeOverlay();CUR_MAP='f';BLOOD_MODE=false;newState('campaign');S.townName='グレイヴェル';S.townNamed=true;if(S.guide)S.guide.hide=true;S.baseLv=4;
   Object.assign(S,{gold:9999,steel:9999,stone:9999,iron:9999,ammo:9999,sword:999,armor:999,fuel:9999,elec:999,coal:999});
   const hq=S.blds.find(b=>b.type==='hq');const P=(t,x,y)=>{try{if(placeOKraw(t,x,y)&&placeB(t,x,y,true)){const b=S.blds[S.blds.length-1];b.bt=0;return b;}}catch(e){}return null;};
   // 北側に柵の線と、内側にバリスタ・物見櫓・篝火
   const y0=hq.y-9;for(let x=hq.x-14;x<=hq.x+16;x++)P('fence',x,y0);
   for(let i=0;i<6;i++)P('mg',hq.x-12+i*5,y0+3);for(let i=0;i<3;i++)P('tower',hq.x-9+i*9,y0+6);
   for(let i=0;i<6;i++)P('brazier',hq.x-13+i*6,y0-3);for(let i=0;i<5;i++)P('brazier',hq.x-11+i*6,y0+2);
   for(let i=0;i<5;i++)P('barracks',hq.x-10+i*5,hq.y+5);for(let i=0;i<3;i++)P('farm',hq.x-8+i*6,hq.y+9);
   const tr=P('train',hq.x+8,hq.y-2);if(tr){for(let i=0;i<4;i++)spawnUnit(tr,i%2?'arch':'inf',i%2?'archer':'pawn');S.squads.forEach((q,i)=>{q.x=(hq.x-10+i*6)*T;q.y=(y0+2)*T;q.ax=q.x;q.ay=q.y;});}
   S.wave=7;S.next=genWave(8);startWave();S.paused=false;
   // 敵を北の柵の近くまで進めておく
   for(let i=0;i<900;i++)update(0.05);
   window.__hq=hq;window.__y0=y0;
 });
};
(async()=>{fs.mkdirSync('title_frames',{recursive:true});const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1200}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await stage(p);
 await p.evaluate(()=>{toggleFull(true);resizeView();zoomAt(1.8,VW/2,VH/2);cam.x=(__hq.x+1)*T-VW/cam.z/2;cam.y=(__y0+2)*T-VH/cam.z/2;clampCam();S.paused=true;window.damageB=function(){};for(const q of S.squads){q.hp=q.maxhp=1e6;}S.enemies=S.enemies.filter(e=>e.y<(__y0+2)*T);
   window.__oc=document.createElement('canvas');__oc.width=960;__oc.height=540;
   window.__step=(dt)=>{if(S.enemies.length<40){const Q=S.cur.q.filter(e=>e.side===S.cur.main&&!(E[e.type]&&E[e.type].fly));for(let i=0;i<6;i++){const e=Q[Math.floor(Math.random()*Q.length)];if(e){spawnEnemy(e);const n=S.enemies[S.enemies.length-1];n.x=(__hq.x-12+Math.random()*28)*T;n.y=(__y0-14-Math.random()*6)*T;}}}update(dt);draw();const cv=document.getElementById('cv');const g=__oc.getContext('2d');g.drawImage(cv,(cv.width-960)/2,(cv.height-540)/2-60,960,540,0,0,960,540);return __oc.toDataURL('image/jpeg',0.92);};});
 const N=15*14;for(let i=0;i<N;i++){const u=await p.evaluate(()=>__step(1/15));fs.writeFileSync('title_frames/f'+String(i).padStart(4,'0')+'.jpg',Buffer.from(u.split(',')[1],'base64'));}
 console.log(await p.evaluate(()=>'enemies '+S.enemies.length+' over '+S.over),errs.slice(0,3));await b.close();})();
