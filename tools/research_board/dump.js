const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+require('path').resolve(__dirname,'../../proto/index.html')+'');await p.waitForTimeout(2500);
const d=await p.evaluate(()=>{newState('campaign');const out=[],icons={};
 // ゲームの研究画面と同じ並び（タブ・ランクごと）
 for(const cat of RES_TABS){const L=TECH.filter(t=>t.cat===cat);const maxR=Math.max(...L.map(techRank));
  for(let rk=1;rk<=maxR;rk++){const inR=L.filter(t=>techRank(t)===rk);let ord=0;
   const isPr=x=>!!RES_PRIO[x.id],isKc=x=>!isPr(x)&&(x.gate||/改築/.test(x.name));
   for(const [t] of inR.filter(isPr).map(x=>[x,0]).concat(inR.filter(isKc).map(x=>[x,0]),resOrder(inR.filter(x=>!isKc(x)&&!isPr(x))))){
    let line='';try{const l=techLine(t);line=l?POLICY[l].n:'';}catch(e){}
    if(t.icon&&!icons[t.icon])icons[t.icon]=icSvg(t.icon,24);
    out.push({id:t.id,name:t.name,cat,rank:rk,ord:ord++,pre:(t.pre||[]).slice(),eff:(t.eff||'').replace(/<[^>]+>/g,''),max:t.lvRank?'城ランクまで':String(t.max||1),line,icon:t.icon||''});}}}
 return {tabs:RES_TABS,colors:CAT_COLOR,tech:out,icons,ver:GAME_VER};});
fs.writeFileSync(process.argv[2]||'tech.json',JSON.stringify(d));console.log(d.tech.length,Object.keys(d.icons).length,Math.round(JSON.stringify(d).length/1024)+'KB');await b.close();})();
