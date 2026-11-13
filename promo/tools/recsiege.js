// 駐屯地攻撃（夜襲）を1コマずつ撮る
const {chromium}=require('playwright');const fs=require('fs');
const P='/tmp/claude-0/-home-user-NIGHT-DEFENSE/7aaddc20-a0b4-5b3f-9294-290684e984c4/scratchpad/promo/';
const FR=P+'frames_siege/';fs.mkdirSync(FR,{recursive:true});for(const f of fs.readdirSync(FR))fs.unlinkSync(FR+f);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let vt=0,man=false;const rn=performance.now.bind(performance);const rr=window.requestAnimationFrame.bind(window),cr=window.cancelAnimationFrame.bind(window);let q=new Map(),id=1;
  window.__vt={on:()=>{man=true;vt=rn();},step:(ms)=>{vt+=ms;const cbs=[...q.values()];q.clear();for(const cb of cbs){try{cb(vt);}catch(e){console.error(e);}}}};
  performance.now=()=>man?vt:rn();
  window.requestAnimationFrame=cb=>{if(!man)return rr(cb);const k=id++;q.set(k,cb);return k;};
  window.cancelAnimationFrame=k=>{q.delete(k);try{cr(k);}catch(e){}};});
await p.goto('file:///home/user/NIGHT-DEFENSE/index.html');await p.waitForTimeout(2500);
await p.evaluate(()=>{Math.random=(()=>{let s=4242;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})();});
await p.evaluate(()=>{localStorage.setItem('nd_siege',JSON.stringify({pool:{sword:8,heavy:4,archer:6,mage:3,cav:3,drake:2,gun:1,eng:1,ram:2,cat:2},raid:24,layout:'auto'}));openSiege();});
await p.waitForTimeout(500);await p.click('#sgGo');await p.waitForTimeout(500);
// 全軍を西にまとめて置く
const dep=await p.evaluate(()=>{const G=__siege();const bd=G.bounds[0];const R=bd.t==='circle'?bd.r:bd.a;const x0=840-R-70;let n=0;const ks=Object.keys(G.pool);let row=0;
  for(const k of ['ram','sword','heavy','cav','drake','archer','mage','gun','eng','cat']){while((G.pool[k]||0)>0){const x=x0-(row%4)*22-(['archer','mage','gun','cat'].includes(k)?40:0),y=575+((Math.floor(row/4))%9-4)*18;try{__sgSpawn(k,x,y);n++;}catch(e){G.pool[k]=0;}row++;}}return {n,R};});
console.log('deployed',dep);
await p.addStyleTag({content:'#siege .sgTop,#siege .sgBot,#siege .sgCmd,#siege .sgMsg,#siege .sgCards,#siege .sgFoot{display:none!important}'});
await p.evaluate(()=>{const G=__siege();G.phase='battle';});
await p.evaluate(()=>{__vt.on();const G=__siege();G.speed=2;G.sel=new Set(G.units.map(u=>u.id));});
await p.evaluate(()=>{try{renderField();}catch(e){}const b=[...document.querySelectorAll('#siege [data-cmd=auto]')][0];if(b)b.click();});
// 画面の大きさを合わせる（上下の帯を隠したぶん）
await p.evaluate(()=>window.dispatchEvent(new Event('resize')));
let fi=0;const shot=async()=>{await p.screenshot({path:FR+'f'+String(fi).padStart(5,'0')+'.jpg',type:'jpeg',quality:90});fi++;};
const N=9*30;let cx=840,cy=490,z=1.0;
for(let i=0;i<N;i++){
  const t=i/(N-1);
  // 生きている部隊のまん中へゆっくり寄る
  const c=await p.evaluate(()=>{const G=__siege();const us=G.units.filter(u=>u.hp>0);if(!us.length)return null;let x=0,y=0;for(const u of us){x+=u.x;y+=u.y;}return [x/us.length,y/us.length];});
  const tz=t<0.15?1.0:1.0+1.3*Math.min(1,(t-0.15)*2.2);
  if(c&&t>=0.12){cx+=(c[0]*0.85+840*0.15-cx)*0.06;cy+=(c[1]*0.85+490*0.15-cy)*0.06;}
  z+=(tz-z)*0.08;
  await p.evaluate(([x,y,z])=>{const G=__siege();G.card=null;G.sel=new Set();G.zoom=z;G.camX=x;G.camY=y;__vt.step(1000/30);},[cx,cy,z]);
  await shot();
  if(i===Math.round(N*0.55))await p.screenshot({path:P+'shots_siege_attack.png'});
}
const st=await p.evaluate(()=>{const G=__siege();return {phase:G.phase,u:G.units.filter(u=>u.hp>0).length,f:G.foes.filter(f=>f.hp>0).length,burnt:G.blds.filter(b=>b.burn||b.burnBy).length};});
console.log('frames',fi,st,errs.slice(0,5));await b.close();})();
