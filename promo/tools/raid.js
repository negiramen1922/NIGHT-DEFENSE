// 宣伝用：夜の大群（ページの中で実行）。buildTown のあとに呼ぶ
window.startRaid=function(opt){opt=opt||{};
  S.wave=(opt.wave||26)-1;S.next=genWave(S.wave+1);S.next.q=[];startWave();
  S.paused=false;S.speed=1;closeOverlay();
  const h=hqOf();const cx=bcx(h),cy=bcy(h);const R=(opt.ring||17)*T;
  // 方角ごとの群れ（中心角, 数の配分）
  const mix=opt.mix||{swarm:90,charger:25,gobarcher:25,grappler:14,troll:8,shogre:8,treant:8,werewolf:10,maneater:6,spitter:10,harpy:8};
  const groups=opt.groups||[[-Math.PI/2,1],[0.15,0.8],[Math.PI*0.85,0.7]];
  for(const [ang,share] of groups){
    for(const k in mix){const n=Math.round(mix[k]*share*(opt.scale||1));
      for(let i=0;i<n;i++){const a=ang+(Math.random()-.5)*0.9,r=R+(opt.near||5)*T+Math.random()*(opt.depth||14)*T;
        spawnAt(k,cx+Math.cos(a)*r,cy+Math.sin(a)*r,1,T*0.5);}}}
  S.cur.maxRem=S.enemies.length;
  return S.enemies.length;
};
// ゲームの時間を手で進める（録画用）
window.stepGame=function(dt,n){for(let i=0;i<(n||1);i++){if(S.waveActive)update(dt);S.fogT=0;}try{draw();}catch(e){}};
