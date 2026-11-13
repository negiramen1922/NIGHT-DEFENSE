// 宣伝用：育った街をつくる（ページの中で実行）
window.buildTown=function(opt){opt=opt||{};
  CUR_MAP=opt.map||'f';BLOOD_MODE=false;closeOverlay();newState('campaign');S.backdrop=false;
  if(S.guide){S.guide.hide=true;S.guide.coach=-1;}
  // 研究はぜんぶ済み・城は高め
  for(const t of TECH)S.tech[t.id]=t.max||1;
  S.baseLv=opt.lv||5;
  window.facCap=()=>9999;   // 撮影用：施設の上限を外す
  for(const k of ['gold','steel','stone','iron','fuel','ammo','sword','elec','mat','powder','silver'])S[k]=99999;S.pop=9999;
  // 地図を全部見えるように
  if(S.seen)S.seen.fill(1);try{rebuildFog();}catch(e){}
  const h=hqOf();const cx=h.x+bsz(h)/2,cy=h.y+bsz(h)/2;
  const cells=[];const R=34;
  for(let y=Math.floor(cy-R);y<=cy+R;y++)for(let x=Math.floor(cx-R);x<=cx+R;x++){const d=Math.hypot(x-cx,y-cy);if(d<=R)cells.push([x,y,d,Math.atan2(y-cy,x-cx)]);}
  cells.sort((a,b)=>a[2]-b[2]);
  const put=(t,n,r0,r1,step)=>{let k=0;for(const [x,y,d] of cells){if(k>=n)break;if(d<r0||d>r1)continue;if(step&&((x+y)%step))continue;if(placeOKraw(t,x,y)){const b=placeB(t,x,y,true);if(b){b.bt=0;k++;}}}return k;};
  const RING=opt.ring||17;
  // 防衛線：石の壁の輪（4か所に門）
  const gates=[0,Math.PI/2,Math.PI,-Math.PI/2];
  for(let a=0;a<Math.PI*2;a+=0.012){const x=Math.round(cx+Math.cos(a)*RING),y=Math.round(cy+Math.sin(a)*RING);
    const nearGate=gates.some(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))<0.05);
    if(S.grid[y]&&S.grid[y][x])continue;
    if(nearGate){if(placeOKraw('gate',x,y)){const b=placeB('gate',x,y,true);if(b)b.bt=0;}}
    else if(placeOKraw('swall',x,y)){const b=placeB('swall',x,y,true);if(b)b.bt=0;}}
  // 防衛施設：壁のすぐ内側に並べる
  const DEF=opt.def||['mg','cannon','magetower','mg','tesla','how','mg','harpoon','cannon','magetower','mg','mray'];
  let di=0;
  for(let a=0.15;a<Math.PI*2;a+=0.2){const t=DEF[di%DEF.length];
    for(const rr of [RING-2,RING-3,RING-4]){const x=Math.round(cx+Math.cos(a)*rr-1),y=Math.round(cy+Math.sin(a)*rr-1);if(placeOKraw(t,x,y)){const b=placeB(t,x,y,true);if(b){b.bt=0;di++;}break;}}}
  // 篝火：壁の外を照らす
  for(const [rr,st] of [[RING+2,0.4],[RING+7,0.3],[RING+12,0.26]])for(let a=0.1;a<Math.PI*2;a+=st){const x=Math.round(cx+Math.cos(a)*rr),y=Math.round(cy+Math.sin(a)*rr);if(placeOKraw('brazier',x,y)){const b=placeB('brazier',x,y,true);if(b)b.bt=0;}}
  // 街：壁の内側をぎっしり埋める
  const IN=opt.inner||RING-3.2;   // 防衛施設の内側まで
  const inR=(x,y,r0,r1)=>{const d=Math.hypot(x+1-cx,y+1-cy);return d>=r0&&d<=r1;};
  const pl=(t,x,y)=>{if(!placeOKraw(t,x,y))return false;const b=placeB(t,x,y,true);if(b)b.bt=0;return !!b;};
  // 大事な施設はまず城のそばに1つずつ
  for(const t of ['market','church','lab','tavern','magic','train','train','ammo','ammo'])put(t,1,3,IN);
  const rowCells=[];for(let y=Math.floor(cy-IN);y<=cy+IN;y++)for(let x=Math.floor(cx-IN);x<=cx+IN;x++)rowCells.push([x,y]);
  if(opt.layout==='zoned'){
    // 地区ごと：北東＝住宅街、南＝畑、西＝工房・市場の通り
    const ang=(x,y)=>Math.atan2(y+1-cy,x+1-cx);
    const zone=(x,y)=>{const a=ang(x,y);return a>-Math.PI*0.9&&a<-Math.PI*0.05?'house':a>Math.PI*0.2&&a<Math.PI*0.85?'farm':(a>=Math.PI*0.85||a<=-Math.PI*0.9)?'work':'house2';};
    const WORK=['ammo','market','powder','smelter','tavern','ammo','furnace'];let wi=0;
    for(const [x,y] of rowCells){if(!inR(x,y,2.5,IN))continue;const z=zone(x,y);
      if(z==='house'||z==='house2'){pl(((x+y)%7===0)?'apart':'barracks',x,y)||pl('barracks',x,y);}
      else if(z==='farm'){pl('farm',x,y)||pl('barracks',x,y);}
      else {if(pl(WORK[wi%WORK.length],x,y))wi++;else pl('barracks',x,y);}}
  }else{
    // 混ぜて詰める：家・畑・工房を交ぜてすき間なく
    const MIX=['barracks','barracks','farm','barracks','farm','ammo','barracks','apart','farm','market','barracks','tavern','farm','powder'];let mi=0;
    const order=rowCells.filter(([x,y])=>inR(x,y,2.5,IN)).sort((a,b)=>Math.hypot(a[0]+1-cx,a[1]+1-cy)-Math.hypot(b[0]+1-cx,b[1]+1-cy));
    for(const [x,y] of order){const t=MIX[mi%MIX.length];if(pl(t,x,y)){mi++;continue;}if(pl('barracks',x,y))continue;pl('farm',x,y);}
  }
  // 残ったすき間に小さな物（篝火・柵の花壇がわり）は入れない。1x1 のすき間は畑の隣なら井戸代わりに篝火
  for(const [x,y] of rowCells){if(!inR(x,y,3,IN-0.5))continue;if((x*7+y*3)%11===0)pl('brazier',x,y);}
  // 生産：森・岩場・平地（壁の内と外）
  put('miner',14,RING-6,30);put('quarry',8,RING-6,30);put('ironmine',5,RING-6,30);put('farm',6,RING+2,26);put('fishery',3,RING-6,30);put('coalmine',2,RING-6,30);
  // 部隊：壁の内側に
  const MODELS=opt.models||['heavy','archer','heavy','archer','wizard','silver','heavy','archer','silver','sniper','heavy','archer','wizard','silver','sniper','archer'];
  const hb=S.blds.find(b=>b.type==='train')||h;
  MODELS.forEach((m,i)=>{try{const ut=MTC[m].ut;const s=spawnUnit(hb,ut,m);const a=i/MODELS.length*Math.PI*2+0.2;s.x=(cx+Math.cos(a)*(RING-2.5))*T;s.y=(cy+Math.sin(a)*(RING-2.5))*T;s.ax=s.x;s.ay=s.y;s.mode='hold';}catch(e){console.warn('unit',m,e.message);}});
  try{rescaleHp();}catch(e){}
  renderAll();resizeView();
  return {blds:S.blds.length,squads:S.squads.length,center:[cx,cy]};
};
