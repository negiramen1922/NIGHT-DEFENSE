const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 await p.goto('file:///home/user/NIGHT-DEFENSE/proto/index.html');await p.waitForSelector('#tNew',{timeout:20000});
 await p.evaluate(()=>localStorage.setItem('nd_tasks','0'));
 await p.click('#tNew');await p.waitForTimeout(300);await p.click('[data-map="f"]');await p.waitForTimeout(300);await p.click('#twGo');await p.waitForTimeout(2500);
 const r=await p.evaluate(()=>{const T=[];const bReq={},mReq={};for(const k in B)if(B[k].req)(bReq[B[k].req]=bReq[B[k].req]||[]).push(k);for(const k in MODEL)if(MODEL[k].req)(mReq[MODEL[k].req]=mReq[MODEL[k].req]||[]).push(k);
  for(const t of TECH){if(!RES_TABS.includes(t.cat))continue;const ln=typeof techLine==='function'?techLine(t):'';T.push({id:t.id,cat:t.cat,r:techRank(t),n:t.name,e:t.eff||'',pre:t.pre||[],cost:costText?costText(techCost(t)).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim():'',tt:techTurns(t),ln:ln||'',bld:bReq[t.id]||[],unit:mReq[t.id]||[],max:t.max||1});}
  const RO=Object.assign({},RANK_OPEN);const rb=[];for(const k of [...new Set(BUILD_GROUPS.flatMap(g=>g.list))]){const q=B[k].req;rb.push({k,n:B[k].name,grp:(BUILD_GROUPS.find(g=>g.list.includes(k))||{}).id==='def'?'def':'prod',req:q||'',rank:q?(RO[q]!=null?RO[q]:null):0});}
  const kc={};for(const k in KC){if(!B[k])continue;kc[k]={g:KC[k].g,grp:(BUILD_GROUPS.find(g=>g.list.includes(k))||{}).id==='def'?'def':'prod',tool:TOOL[k]||'',st:KC[k].st};}
  const eq={w:W_REQ.map((id,i)=>({i,n:W_MAT[i]+'の武器',rank:id?RO[id]:0})),a:A_REQ.map((id,i)=>({i,n:AR.a.n[i],rank:id?RO[id]:0})),r:AR.r.req.map((id,i)=>({i,n:AR.r.n[i],rank:id?RO[id]:0}))};
  const base=Object.keys(MODEL).filter(k=>!MODEL[k].req&&!MODEL[k].buy&&!MODEL[k].off&&UT[MODEL[k].ut]&&['inf','arch','mil','cav','art','mage','drake'].includes(MODEL[k].ut)).map(k=>k+':'+MODEL[k].name);
  return {T,rb,kc,eq,base,TOOL_T};});
 fs.writeFileSync('rb/proto_dump.json',JSON.stringify(r));console.log(r.T.length,'techs',r.rb.filter(x=>x.req).map(x=>x.n+':'+x.rank).join(' '));console.log('base units',r.base.join(' '));await b.close();})();
