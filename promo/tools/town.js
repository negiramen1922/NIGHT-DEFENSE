// 宣伝用：育った街をつくる（ページの中で実行）
window.buildTown=function(opt){opt=opt||{};
  CUR_MAP=opt.map||'f';BLOOD_MODE=false;closeOverlay();newState('campaign');S.backdrop=false;
  if(S.guide){S.guide.hide=true;S.guide.coach=-1;}
  // 研究はぜんぶ済み・城は高め
  for(const t of TECH)S.tech[t.id]=t.max||1;
  S.baseLv=opt.lv||5;
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
    for(const rr of [RING-3,RING-4,RING-5]){const x=Math.round(cx+Math.cos(a)*rr-1),y=Math.round(cy+Math.sin(a)*rr-1);if(placeOKraw(t,x,y)){const b=placeB(t,x,y,true);if(b){b.bt=0;di++;}break;}}}
  // 篝火：壁の外を照らす
  for(const [rr,st] of [[RING+2,0.4],[RING+7,0.3],[RING+12,0.26]])for(let a=0.1;a<Math.PI*2;a+=st){const x=Math.round(cx+Math.cos(a)*rr),y=Math.round(cy+Math.sin(a)*rr);if(placeOKraw('brazier',x,y)){const b=placeB('brazier',x,y,true);if(b)b.bt=0;}}
  // 街：住居・工房・市場・研究室・教会・兵舎（城のまわり）
  put('barracks',14,3,12);put('ammo',2,3,12);put('market',1,3,12);put('lab',1,3,12);put('church',1,3,12);put('tavern',1,3,12);put('train',2,3,12);put('magic',1,3,12);
  // 生産：森・岩場・平地（壁の内と外）
  put('miner',8,4,28);put('quarry',5,4,28);put('ironmine',3,4,28);put('farm',8,4,24);put('fishery',2,4,28);
  // 部隊：壁の内側に
  const MODELS=opt.models||['heavy','archer','heavy','archer','wizard','silver','heavy','archer','silver','sniper','heavy','archer','wizard','silver','sniper','archer'];
  const hb=S.blds.find(b=>b.type==='train')||h;
  MODELS.forEach((m,i)=>{try{const ut=MTC[m].ut;const s=spawnUnit(hb,ut,m);const a=i/MODELS.length*Math.PI*2+0.2;s.x=(cx+Math.cos(a)*(RING-3))*T;s.y=(cy+Math.sin(a)*(RING-3))*T;s.ax=s.x;s.ay=s.y;s.mode='hold';}catch(e){console.warn('unit',m,e.message);}});
  try{rescaleHp();}catch(e){}
  renderAll();resizeView();
  return {blds:S.blds.length,squads:S.squads.length,center:[cx,cy]};
};
