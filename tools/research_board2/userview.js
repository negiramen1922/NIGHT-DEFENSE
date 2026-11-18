const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const load=c=>{const d=path.join('dball',c);if(!fs.existsSync(d))return [];return fs.readdirSync(d).map(f=>({id:f.replace(/\.json$/,''),data:JSON.parse(fs.readFileSync(path.join(d,f)))}));};
const DB={pos:load('pos'),links:load('links'),custom:load('custom'),notes:load('notes')};
(async()=>{const tab=process.argv[2]||'N部隊',out=process.argv[3]||'uv.png';const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:1000}});
 const stub=`<script>window.claude={use:async()=>({collection:(n)=>({onSnapshot:(cb)=>{setTimeout(()=>cb({docs:(window.__DB[n]||[]).map(d=>({id:d.id,data:()=>d.data})),metadata:{fromCache:false}}),50);return ()=>{};},doc:()=>({set:async()=>{},delete:async()=>{}})})})};window.__DB=${JSON.stringify(DB)};</script>`;
 fs.writeFileSync('uv.html','<!doctype html><html><head><meta charset=utf8></head><body>'+stub+fs.readFileSync('rb/research_board.html','utf8')+'</body></html>');
 await p.goto('file://'+process.cwd()+'/uv.html');await p.waitForTimeout(800);await p.click(`[data-tab="${tab}"]`);await p.waitForTimeout(300);
 await p.evaluate(()=>{document.getElementById('det').style.display='none';const bd=document.querySelector('.board');bd.style.maxHeight='none';bd.style.height='auto';bd.style.overflow='visible'});
 await p.screenshot({path:out,fullPage:true});await b.close();})();
