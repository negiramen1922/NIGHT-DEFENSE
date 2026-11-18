const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const load=c=>{const d=path.join('dball',c);if(!fs.existsSync(d))return [];return fs.readdirSync(d).map(f=>({id:f.replace(/\.json$/,''),data:JSON.parse(fs.readFileSync(path.join(d,f)))}));};
const DB={pos:load('pos'),links:load('links'),custom:load('custom'),notes:load('notes')};
(async()=>{const tab=process.argv[2]||'N部隊',out=process.argv[3]||'uv.png';const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:1000}});
 const stub=`<script>window.claude={use:async()=>({collection:(n)=>({onSnapshot:(cb)=>{setTimeout(()=>cb({docs:(window.__DB[n]||[]).map(d=>({id:d.id,data:()=>d.data})),metadata:{fromCache:false}}),50);return ()=>{};},doc:()=>({set:async()=>{},delete:async()=>{}})})})};window.__DB=${JSON.stringify(DB)};</script>`;
 fs.writeFileSync('uv.html','<!doctype html><html><head><meta charset=utf8></head><body>'+stub+fs.readFileSync('rb/research_board.html','utf8')+'</body></html>');
 await p.goto('file://'+process.cwd()+'/uv.html');await p.waitForTimeout(800);const RP={};
 for(const [tab,cat] of [['N領地','領地'],['N防衛','防衛'],['N部隊','部隊']]){await p.click(`[data-tab="${tab}"]`);await p.waitForTimeout(300);
   const P=await p.evaluate(()=>{const o={};for(const el of document.querySelectorAll('.card[data-id]')){o[el.dataset.id]={col:Math.round((parseFloat(el.style.left)-12)/258),row:Math.round((parseFloat(el.style.top)-12)/80)};}return o;});
   const g=Object.entries(P).filter(([k])=>k.startsWith('g_')).map(([k,v])=>[k.slice(2),v.row,v.col]);
   const rows=[...new Set(g.map(x=>x[1]))].sort((a,b)=>a-b);const rm={};rows.forEach((r,i)=>rm[r]=i);
   for(const [id,r,c] of g)RP[id]=[rm[r],c];}
 fs.writeFileSync('respos.json',JSON.stringify(RP));console.log(Object.keys(RP).length);await b.close();})();
