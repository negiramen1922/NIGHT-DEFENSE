// 効果音・BGM ラボ（試作版だけ。2026-11-14）
// ・効果音を全部鳴らせる。攻撃などは本物の施設・敵・部隊を出して演出つきで確かめられる
// ・8bit 風の BGM を場面ごとに何パターンか聴き比べて「これにする」を選ぶと、試作版のゲームでその曲が流れる
// ・効果音や曲ごとにメモを書ける（この端末に保存）。「メモ一覧」でまとめてコピー
// 本番では読み込まない（siege.js が試作版のタイトルにだけボタンを出し、押したときにこのファイルを読み込む）
(function(){
'use strict';
const MEMO_KEY='nd_lab_memo',PICK_KEY='nd_bgm_pick';
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
let MEMO=ld(MEMO_KEY,{}),PICK=ld(PICK_KEY,{});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ===================== 効果音の一覧 =====================
// demo：演出つきで見られるもの（本物の施設・敵・部隊を試験場に出す）
const SE_LIST=[
 ['操作',[
  ['click','ボタン・選ぶ','ボタンを押したとき、建物や部隊を選んだとき'],
  ['error','できない','資源が足りない・置けない・取り消せないとき'],
  ['turn','ターンを進める','「次のターン」を押したとき'],
  ['hire','英雄を雇う','酒場で英雄を雇ったとき'],
 ]],
 ['建設・研究',[
  ['build','建設（ほか）','下の素材別の音がない施設を置いたとき',{demo:'build_other'}],
  ['b_wood','建設：木','柵・門・物見櫓・伐採所・兵舎・前哨砦・酒場・市場・トゲ床など',{demo:'b_wood'}],
  ['b_stone','建設：石','教会・石の壁・城壁・石切り場・鉱山・落とし穴など',{demo:'b_stone'}],
  ['b_metal','建設：金属','バリスタ・大砲・投石機・迫撃砲・工房など',{demo:'b_metal'}],
  ['b_fire','建設：火','篝火・火薬工房・精製炉',{demo:'b_fire'}],
  ['b_farm','建設：畑','農場',{demo:'b_farm'}],
  ['b_water','建設：水','漁場',{demo:'b_water'}],
  ['b_magic','建設：魔法／英雄の技','研究室・魔法施設・メイジの塔を置いたとき。英雄が技を使ったときも',{demo:'b_magic'}],
  ['upgrade','強化・修理・補給','改築・修理・補給・一括補給など、よくなったとき（いちばん多く鳴る）',{demo:'upgrade'}],
  ['resStart','研究を始める','研究を始めたとき'],
  ['research','研究完了','研究が終わったとき・初心者タスク達成'],
 ]],
 ['戦闘',[
  ['mg','直射の発射（バリスタなど）','バリスタ・物見櫓・大砲などが撃ったとき',{demo:'mg'}],
  ['rail','貫通の発射','電磁投射砲・魔弾砲など、敵を貫く攻撃',{demo:'rail'}],
  ['how','曲射の発射（投石機など）','投石機・迫撃砲・風船爆弾など、範囲攻撃を撃ったとき',{demo:'how'}],
  ['boom','爆発','地雷・爆弾罠を踏んだ、英雄の技（メテオなど）',{demo:'boom'}],
  ['squad','部隊の攻撃','弓兵・兵士などの部隊が攻撃したとき',{demo:'squad'}],
  ['hit','騎兵の突撃','騎兵が突撃して敵にぶつかったとき',{demo:'hit'}],
  ['kill','敵を倒す（小）','ゴブリンなど小さな敵を倒したとき',{demo:'kill'}],
  ['bigkill','敵を倒す（大）','オーガ・トロールなど大きな敵を倒したとき',{demo:'bigkill'}],
  ['destroy','施設がこわれる・部隊全滅','施設が壊されたとき、部隊が全滅したとき',{demo:'destroy'}],
  ['launch','部隊の出撃','部隊が兵舎などから出てきたとき',{demo:'launch'}],
  ['kia','英雄の戦死','英雄が倒れたとき'],
 ]],
 ['知らせ・結果',[
  ['alarm','襲撃が来た','夜の襲撃が始まったとき・第二波／第三波の接近'],
  ['clear','襲撃をしのいだ','襲撃の敵を全部倒したとき・駐留地を片付けたとき'],
  ['bell','夜の訪問者','静かな夜に旅人・行商人などが来たとき'],
  ['pop','花火','祭りの花火'],
  ['win','勝利','ステージをクリアしたとき'],
  ['lose','敗北','城館が落ちたとき'],
 ]],
];

// ===================== 試験場（演出つき） =====================
let LAB=null;   // 開いている間の状態
const P0=()=>{const h=hqOf();return {x:h.x+2,y:h.y+12};};   // 試験場の場所（城館の南）
// 置ける場所：まずふつうの判定、だめなら（研究が要る施設など）空いているマスならどこでも（試験場だけ）
function freeCells(type,x,y){const n=newSz(type);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const cx=x+i,cy=y+j;if(!S.grid[cy]||cx<0||cx>=S.grid[cy].length||S.grid[cy][cx])return false;if(S.ter&&S.ter[cy]&&[1,2,5].includes(S.ter[cy][cx]))return false;}return true;}
function findSpot(type,gx,gy){for(const strict of [true,false])for(let r=0;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=gx+dx,y=gy+dy;try{if(strict?placeOKraw(type,x,y):freeCells(type,x,y))return [x,y];}catch(e){}}return null;}
function putB(type,gx,gy,free){const p=findSpot(type,gx,gy);if(!p)return null;const n0=S.blds.length;placeB(type,p[0],p[1],free!==false);const b=S.blds[S.blds.length-1];if(S.blds.length>n0||b){if(free!==false){b.bt=0;b.hp=b.maxhp;}LAB.objs.push(b);}return b;}
function foes(type,gx,gy,n,spread){const n0=S.enemies.length;spawnAt(type,(gx+.5)*T,(gy+.5)*T,n,(spread||1.5)*TU);for(const e of S.enemies.slice(n0))e.labDemo=1;return S.enemies.slice(n0);}
function squad(model,gx,gy){let h=LAB.home;if(!h||!S.blds.includes(h)){h=LAB.home=putB('train',LAB.p.x-6,LAB.p.y-3);}const ut=MTC[model].ut;spawnUnit(h,ut,model);const s=S.squads[S.squads.length-1];s.x=(gx+.5)*T;s.y=(gy+.5)*T;s.ax=s.x;s.ay=s.y;s.tx=null;s.mode='guard';return s;}
function clearDemo(){const keepH=hqOf();S.blds=S.blds.filter(b=>{if(b===keepH)return true;gridSet(b,false);return false;});S.enemies=[];S.squads=[];S.shots=[];S.fx=[];S.vfx=[];S.mines=[];S.eshots=[];S.beams=[];LAB.objs=[];LAB.home=null;}
function camTo(x,y,z){if(LAB&&LAB.camSet)return;if(LAB)LAB.camSet=true;   /* 表示位置を合わせるのは最初の1回だけ（押すたびに戻されないように。2026-11-15） */
  cam.z=z||2.2;const vw=VW*(innerWidth>900?0.55:0.5);cam.x=(x+.5)*T-vw/2/cam.z;cam.y=(y+.5)*T-VH/2/cam.z;try{clampCam();}catch(e){}}
function typeBySnd(n){return Object.keys(BSND).find(k=>BSND[k]===n&&B[k]&&!B[k].isMine&&!['wall','swall','gate','fence'].includes(k))||Object.keys(BSND).find(k=>BSND[k]===n);}
const DEMO={   // 敵は施設の南に出す（北の城館へ向かう途中で施設の前を通る）
  mg(){const p=LAB.p;putB('mg',p.x,p.y);foes('swarm',p.x,p.y+7,6,1.2);camTo(p.x,p.y+3);return 'バリスタが撃つ（発射音・倒したときの音）';},
  rail(){const p=LAB.p;const t=B.mabou?'mabou':'rail';putB(t,p.x,p.y);for(let i=0;i<5;i++)foes('swarm',p.x,p.y+5+i,1,0.2);camTo(p.x,p.y+4);return `${B[t].name}が敵を貫く`;},
  how(){const p=LAB.p;putB('how',p.x,p.y);foes('swarm',p.x,p.y+8,12,1.6);camTo(p.x,p.y+4);return '投石機が群れに撃ち込む（爆心から離れるほど弱い）';},
  boom(){const p=LAB.p;for(let i=-3;i<=3;i++)placeB('landmine',p.x+i,p.y+2,true);foes('swarm',p.x,p.y+8,6,1.2);camTo(p.x,p.y+4);return '地雷を踏む（爆発）';},
  squad(){const p=LAB.p;squad('archer',p.x,p.y);foes('swarm',p.x,p.y+7,5,1);camTo(p.x,p.y+3);return '弓兵隊が撃つ（出撃の音も）';},
  hit(){const p=LAB.p;const s=squad('rider',p.x,p.y);s.chgT=99;s.idleT=99;foes('grappler',p.x,p.y+9,4,1);camTo(p.x,p.y+4,1.8);return '騎兵が突撃する（勢いがたまっていれば）';},
  kill(){const p=LAB.p;putB('mg',p.x,p.y);for(const e of foes('swarm',p.x,p.y+5,6,1.2))e.hp=1;camTo(p.x,p.y+3);return '小さな敵を倒す';},
  bigkill(){const p=LAB.p;putB('cannon',p.x,p.y);for(const e of foes('grappler',p.x,p.y+6,3,1))e.hp=5;camTo(p.x,p.y+3);return 'オーガを倒す';},
  destroy(){const p=LAB.p;for(let i=-6;i<=6;i++){const f=putB('fence',p.x+i,p.y+2);if(f)f.hp=Math.abs(i)<=1?1:f.maxhp;}foes('grappler',p.x,p.y+6,2,0.4);camTo(p.x,p.y+3);return '柵が壊される';},
  launch(){const p=LAB.p;squad('pawn',p.x,p.y);camTo(p.x-4,p.y-2);return '兵舎から部隊が出る';},
  upgrade(){const p=LAB.p;const b=putB('mg',p.x,p.y);if(b){b.upg=true;b.bt=b.btTotal=2*TURN_SEC;se('upgrade');S.fx.push({x:bcx(b),y:bcy(b),r:TU*1.2,t:0,dur:0.6,c:'#6fe08a'});}camTo(p.x+1,p.y);return '改築を始めた（改築中の表示つき）';},
  build_other(){return buildDemo(['coalmine','goldmine','smelter'].find(k=>B[k]&&!BSND[k])||'coalmine');},
  b_wood(){return buildDemo('tower');},b_stone(){return buildDemo('church');},b_metal(){return buildDemo('cannon');},b_fire(){return buildDemo('brazier');},
  b_farm(){return buildDemo('farm');},b_water(){return buildDemo('fishery');},b_magic(){return buildDemo('magetower');},
};
function buildDemo(t){const p=LAB.p;const keep={};for(const k in costOf(t)){S[k]=Math.max(S[k]||0,9999);}S.pop=Math.max(S.pop,99);const b=putB(t,p.x,p.y,false);camTo(p.x+1,p.y,2.4);return b?`${B[t].name}を置く（建設中の見た目）`:`${B[t].name}を置ける場所がありませんでした`;}
function runDemo(id){if(!LAB)return;clearDemo();LAB.p=P0();let msg='';try{msg=DEMO[id]();}catch(e){msg='演出の準備に失敗しました：'+e.message;console.error(e);}
  S.paused=false;S.speed=1;LAB.msg=msg;renderLab();}

// 試験場を作る：本物のゲームを1つ立ち上げ、保存・夜の闇・夜の視界を止める
function sandbox(){
  LAB.saved={saveGame:window.saveGame,drawNight:window.drawNight,litAt:window.litAt,se:window.se,guideTick:window.guideTick};
  window.saveGame=function(){};if(typeof window.autoSave==='function'){LAB.saved.autoSave=window.autoSave;window.autoSave=function(){};}
  window.se=function(){};
  newState('campaign');try{closeOverlay();}catch(e){}
  S.gold=S.steel=S.stone=S.iron=S.ammo=S.fuel=S.elec=S.mat=S.powder=9999;S.pop=99;
  try{S.next=genWave(1);S.next.q=[{type:'swarm',side:S.sideOrder[0],t:1e9,lane:0.5,sub:0}];startWave();}catch(e){console.error(e);}   // 襲撃中にしておく（出る予定の敵はずっと先＝終わらない）
  S.enemies=[];S.paused=false;S.speed=1;
  window.se=LAB.saved.se;window.drawNight=function(){};window.litAt=function(){return true;};if(typeof window.guideTick==='function')window.guideTick=function(){};
  try{revealAll();}catch(e){}
  LAB.p=P0();camTo(LAB.p.x,LAB.p.y,2);
  LAB.keep=setInterval(()=>{if(!LAB||!S||!S.cur)return;const d=S.cur.q[0]||{type:'swarm',side:S.sideOrder[0],lane:0.5,sub:0};d.t=(S.waveT||0)+1e6;S.cur.q=[d];S.qi=0;S.subShown=99;S.waveActive=true;S.over=false;S.paused=false;const h=hqOf();if(h)h.hp=h.maxhp;},100);
  try{auInit();}catch(e){}
}

// ===================== 8bit 風の BGM =====================
// 矩形波（デューティ 12.5%・25%・50%）・三角波のベース・ノイズの太鼓だけで鳴らす
const PWAVE={};
function pwave(d){if(PWAVE[d])return PWAVE[d];const n=40,re=new Float32Array(n),im=new Float32Array(n);for(let k=1;k<n;k++){re[k]=0;im[k]=(2/(k*Math.PI))*Math.sin(k*Math.PI*d);}return PWAVE[d]=AU.ctx.createPeriodicWave(re,im,{disableNormalization:false});}
const mf=m=>440*Math.pow(2,(m-69)/12);
function cn(m,t,dur,o){if(!m)return;o=o||{};const c=AU.ctx,osc=c.createOscillator();if(o.w==='tri')osc.type='triangle';else osc.setPeriodicWave(pwave(o.w||0.25));
  osc.frequency.setValueAtTime(mf(m),t);if(o.slide)osc.frequency.exponentialRampToValueAtTime(mf(m+o.slide),t+dur);
  if(o.vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=5.5;lg.gain.value=mf(m)*0.012;l.connect(lg);lg.connect(osc.frequency);l.start(t+0.12);l.stop(t+dur+0.05);}
  const g=c.createGain(),v=o.v||0.05,rel=Math.min(o.r||0.04,dur*0.5);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.004);
  if(o.decay)g.gain.exponentialRampToValueAtTime(v*o.decay,t+dur*0.8);g.gain.setValueAtTime(o.decay?v*o.decay:v,t+Math.max(0.005,dur-rel));g.gain.linearRampToValueAtTime(0.0001,t+dur);
  osc.connect(g);g.connect(AU.music);if(o.echo)g.connect(AU.dsend);osc.start(t);osc.stop(t+dur+0.05);}
function dr(k,t,v){const M=AU.music;v=v||1;
  if(k==='k'){const c=AU.ctx,o=c.createOscillator();o.type='triangle';o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+0.12);const g=c.createGain();g.gain.setValueAtTime(0.32*v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);o.connect(g);g.connect(M);o.start(t);o.stop(t+0.2);}
  else if(k==='s')noise(t,0.11,{ft:'bandpass',f:1700,q:0.6,vol:0.16*v,dest:M});
  else if(k==='h')noise(t,0.025,{ft:'highpass',f:7500,vol:0.05*v,dest:M});
  else if(k==='o')noise(t,0.12,{ft:'highpass',f:6500,vol:0.045*v,dest:M});
  else if(k==='t'){const c=AU.ctx,o=c.createOscillator();o.type='triangle';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(90,t+0.15);const g=c.createGain();g.gain.setValueAtTime(0.18*v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);o.connect(g);g.connect(M);o.start(t);o.stop(t+0.2);}
  else if(k==='c')noise(t,0.5,{ft:'highpass',f:5000,vol:0.06*v,dest:M});}
// 音名 → MIDI（"A4","C#5","Bb3"。"-" は伸ばす、"." は休み）
const NN={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function nm(s){if(!s||s==='.'||s==='-')return null;const m=/^([A-G])([#b]?)(-?\d)$/.exec(s);if(!m)return null;return 12*(+m[3]+1)+NN[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);}
// メロディ文字列（空白区切り、1つ＝1拍の何分の1か は step で決める）→ [{m,len}] を各ステップに
function seq(str){const tk=str.trim().split(/\s+/);const out=new Array(tk.length).fill(null);for(let i=0;i<tk.length;i++){if(tk[i]==='-'||tk[i]==='.')continue;let L=1;while(tk[i+L]==='-')L++;out[i]={m:nm(tk[i]),len:L};}return out;}
// コード（"Dm","F","C","Bb","A7"…）→ 構成音（MIDI。根音はオクターブ3）
function chord(s){const m=/^([A-G])([#b]?)(m?)(7?)(sus4)?$/.exec(s);let r=48+NN[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);if(r>=55)r-=12;const third=m[3]?3:4,iv=m[5]?[0,5,7]:[0,third,7];if(m[4])iv.push(m[3]?10:10);return iv.map(x=>r+x);}
// 曲の型：bpm・コード進行（1小節ずつ）・旋律（8分または16分）・ベースの型・太鼓の型・分散和音の型
function mkTrack(d){const lead=seq(d.lead),lead2=d.lead2?seq(d.lead2):null,ch=d.prog.map(chord),lstep=d.lstep||2,dpat=d.drums||[];
  return {bpm:d.bpm,f:(st,t)=>{const sp=60/d.bpm/4,s=st%16,bar=Math.floor(st/16)%ch.length,c=ch[bar];
    // 旋律
    if(st%lstep===0){const i=(st/lstep)%lead.length,n=lead[i];if(n&&n.m)cn(n.m+(d.tr||0),t,n.len*lstep*sp*0.95,{w:d.lw||0.25,v:d.lv||0.055,vib:n.len>=3&&d.vib!==false,echo:d.echo,decay:d.ldecay});}
    if(lead2&&st%lstep===0){const i=(st/lstep)%lead2.length,n=lead2[i];if(n&&n.m)cn(n.m+(d.tr||0),t,n.len*lstep*sp*0.95,{w:d.l2w||0.125,v:d.l2v||0.03,echo:d.echo});}
    // ベース（三角波）
    const r=c[0]-12,B=d.bass||'8';
    if(B==='8'&&s%2===0)cn(r,t,sp*1.8,{w:'tri',v:0.13});
    else if(B==='oct'&&s%2===0)cn(r+(s%4===2?12:0),t,sp*1.8,{w:'tri',v:0.13});
    else if(B==='walk'&&s%4===0)cn(r+[0,7,12,7][s/4],t,sp*3.6,{w:'tri',v:0.13});
    else if(B==='pedal'&&s===0)cn(r,t,sp*15.5,{w:'tri',v:0.11});
    else if(B==='half'&&s%8===0)cn(r+(s===8?7:0),t,sp*7.5,{w:'tri',v:0.12});
    else if(B==='gallop'&&[0,3,4,8,11,12].includes(s))cn(r+(s>=8?(d.prog.length>1?0:7):0),t,sp*0.9,{w:'tri',v:0.13});
    else if(B==='16'&&true)cn(r+(s%8===7?12:0),t,sp*0.9,{w:'tri',v:0.12});
    // 分散和音（12.5% の細い音）
    const A=d.arp;if(A==='16'){cn(c[s%3]+12,t,sp*0.9,{w:0.125,v:d.av||0.022});}
    else if(A==='8'&&s%2===0){cn(c[(s/2)%3]+12,t,sp*1.8,{w:0.125,v:d.av||0.025});}
    else if(A==='updown'&&s%2===0){cn(c[[0,1,2,1][(s/2)%4]]+24,t,sp*1.6,{w:0.125,v:d.av||0.02,echo:true});}
    else if(A==='stab'&&(s===2||s===6||s===10||s===14)){for(const n of c)cn(n+12,t,sp*0.8,{w:0.5,v:d.av||0.016});}
    else if(A==='pad'&&s===0){for(const n of c)cn(n+12,t,sp*15,{w:0.125,v:d.av||0.014,echo:true});}
    // 太鼓
    if(dpat.length){const P=dpat[bar%dpat.length];for(const k of (P[s]||'').replace('.',''))dr(k,t);}
  }};}
// 太鼓の型（1小節＝16ステップ。1文字ずつ。"kh"のように重ねられる）
const D=s=>s.split(' ');
const DR={
 march:[D('k . h . s . h . k . k . s . h h')],
 rock:[D('kh . h . sh . h k kh . h . sh . h .'),D('kh . h . sh . h k kh . kh . sh s s s')],
 fast:[D('kh h sh h kh h sh h kh h sh h kh h sh s')],
 halftime:[D('k . h . h . h . s . h . h . h .')],
 polka:[D('k . h . s . h . k . h . s . h .')],
 boss:[D('k . . k s . . . k . k . s . t t')],
 sneak:[D('k . . . h . . . . . k . h . . .')],
 soft:[D('k . . . . . h . . . . . s . . .')],
 none:[],
};
// 場面ごとの候補（scene：ゲームの場面の名前。orig＝今の曲）
const BGM=[
 {scene:'home',n:'ホーム（タイトル）',orig:'今の曲（ゆっくり・寂しげ）',list:[
  {id:'c_home_a',n:'8bit A：夜明け前',d:'Dマイナー・ゆったり。矩形波の旋律と分散和音',t:mkTrack({bpm:84,prog:['Dm','Bb','F','C','Dm','Bb','Gm','A'],bass:'half',arp:'updown',drums:DR.none,lstep:2,echo:true,lw:0.25,lv:0.05,
    lead:'A4 - - - D5 - E5 - F5 - - - E5 - D5 - C5 - - - A4 - - - G4 - A4 - C5 - - - A4 - - - D5 - E5 - F5 - - - G5 - F5 - E5 - - - C5 - D5 - E5 - - - - - - -'})},
  {id:'c_home_b',n:'8bit B：勇ましい序曲',d:'Aマイナー・行進。旋律2本の掛け合い',t:mkTrack({bpm:104,prog:['Am','F','G','E','Am','F','G','Am'],bass:'oct',arp:'none',drums:DR.march,lstep:2,lw:0.5,lv:0.045,l2w:0.25,l2v:0.028,
    lead:'A4 - - C5 E5 - - D5 C5 - B4 - A4 - - - F4 - A4 - C5 - - - B4 - G4 - E4 - - - A4 - - C5 E5 - - G5 F5 - E5 - D5 - - - C5 - B4 - G4 - B4 - A4 - - - - - - -',
    lead2:'. . . . C5 - - - A4 - - - . . . . A4 - - - . . . . G4 - - - G#4 - - - . . . . C5 - - - A4 - - - . . . . A4 - - - D5 - - - B4 - - - C5 - - -'})},
  {id:'c_home_c',n:'8bit C：小さな街の灯',d:'Fメジャー・あたたかい。三連の分散和音',t:mkTrack({bpm:92,prog:['F','C','Dm','Bb','F','C','Bb','C'],bass:'walk',arp:'8',drums:DR.soft,lstep:2,lw:0.25,lv:0.05,av:0.02,
    lead:'C5 - A4 - F4 - A4 - G4 - - - - - C5 - D5 - C5 - A4 - F4 - G4 - - - - - - - F4 - G4 - A4 - Bb4 - C5 - - - D5 - C5 - A4 - - - G4 - - - F4 - - - - - - -'})},
 ]},
 {scene:'prep',n:'昼（街づくり）',orig:'今の曲（静かな緊張感）',list:[
  {id:'c_prep_a',n:'8bit A：のどかな村',d:'Cメジャー・軽快。はずむベース',t:mkTrack({bpm:116,prog:['C','Am','F','G'],bass:'oct',arp:'8',drums:DR.polka,lstep:2,lw:0.5,lv:0.04,av:0.018,
    lead:'E5 - G5 - C6 - B5 A5 G5 - E5 - D5 - - - C5 - E5 - A5 - G5 E5 F5 - - - . . . . E5 - F5 - G5 - C6 - B5 - A5 - G5 - - - F5 - E5 - D5 - - - C5 - - - - - - -'})},
  {id:'c_prep_b',n:'8bit B：職人の朝',d:'Gメジャー・せわしい。16分の刻み',t:mkTrack({bpm:132,prog:['G','Em','C','D'],bass:'8',arp:'16',drums:DR.rock,lstep:2,lw:0.25,lv:0.045,av:0.014,
    lead:'D5 - G5 - - - D5 - B4 - G4 - A4 B4 C5 - B4 - G4 - E4 - G4 - C5 - B4 - A4 - G4 - A4 - - - D5 - - - B4 - G4 - B4 - D5 - E5 - D5 - C5 - B4 - A4 - G4 - - - - - - -'})},
  {id:'c_prep_c',n:'8bit C：備える昼',d:'Dマイナー・少し緊張。ゆっくりした行進',t:mkTrack({bpm:100,prog:['Dm','C','Bb','A'],bass:'walk',arp:'stab',drums:DR.halftime,lstep:2,lw:0.25,lv:0.05,
    lead:'D5 - - - F5 - E5 - D5 - C5 - A4 - - - Bb4 - - - C5 - D5 - C#5 - - - - - - - D5 - - - F5 - G5 - A5 - G5 - F5 - E5 - D5 - E5 - F5 - E5 - C#5 - - - - - - -'})},
 ]},
 {scene:'night',n:'静かな夜',orig:'今の曲（鈴と虫の声）',list:[
  {id:'c_night_a',n:'8bit A：月明かり',d:'Aマイナー・ゆっくり。こだまする細い音',t:mkTrack({bpm:72,prog:['Am','F','C','G'],bass:'pedal',arp:'updown',drums:DR.none,lstep:4,lw:0.125,lv:0.04,echo:true,av:0.018,
    lead:'E5 - - - C5 - - - D5 - B4 - - - - - A4 - - - C5 - - - G4 - - - - - - -'})},
  {id:'c_night_b',n:'8bit B：子守歌',d:'Fメジャー・やさしい3拍子ふう',t:mkTrack({bpm:78,prog:['F','Dm','Bb','C'],bass:'half',arp:'pad',drums:DR.none,lstep:2,lw:0.5,lv:0.035,echo:true,
    lead:'A4 - - - - - C5 - Bb4 - A4 - G4 - - - F4 - - - - - A4 - G4 - - - - - - - A4 - - - - - D5 - C5 - Bb4 - A4 - - - G4 - - - - - E4 - F4 - - - - - - -'})},
 ]},
 {scene:'fest',n:'祭りの夜',orig:'今の曲（太鼓・手拍子・笛）',list:[
  {id:'c_fest_a',n:'8bit A：広場のポルカ',d:'Dメジャー・跳ねる',t:mkTrack({bpm:144,prog:['D','A','D','G','D','A','G','D'],bass:'oct',arp:'stab',drums:DR.polka,lstep:2,lw:0.5,lv:0.045,
    lead:'F#5 - A5 - F#5 - D5 - E5 - F#5 - E5 - C#5 - D5 - F#5 - A5 - - - B5 - A5 - G5 - - - F#5 - A5 - F#5 - D5 - E5 - G5 - F#5 - E5 - D5 - E5 - F#5 - D5 - D5 - - - - - - -'})},
  {id:'c_fest_b',n:'8bit B：酒場の踊り',d:'Gメジャー・16分で速い',t:mkTrack({bpm:136,prog:['G','C','G','D'],bass:'gallop',arp:'none',drums:DR.fast,lstep:1,lw:0.25,lv:0.04,
    lead:'G5 A5 B5 G5 D5 G5 B5 D6 C6 B5 A5 G5 E5 G5 C6 E6 D6 C6 B5 A5 G5 A5 B5 G5 A5 G5 F#5 E5 D5 - - - G5 A5 B5 G5 D5 G5 B5 D6 C6 B5 A5 G5 E5 G5 C6 E6 D6 C6 B5 A5 B5 G5 A5 F#5 G5 - - - - - - -'})},
 ]},
 {scene:'battle',n:'敵の襲撃',orig:'今の曲（太鼓とベースの行進。襲撃が進むと旋律が入る）',list:[
  {id:'c_bat_a',n:'8bit A：王道バトル',d:'Dマイナー・速い。16分のベースと矩形波の旋律',t:mkTrack({bpm:160,prog:['Dm','Dm','Bb','C','Dm','Dm','Gm','A'],bass:'16',arp:'none',drums:DR.rock,lstep:2,lw:0.5,lv:0.045,l2w:0.25,l2v:0.025,
    lead:'D5 - - - A4 - D5 - F5 - E5 - D5 - C5 - D5 - - - - - - - . . . . . . . . Bb4 - - - D5 - F5 - C5 - - - E5 - G5 - D5 - - - A4 - D5 - F5 - A5 - G5 - F5 - E5 - G5 - - - F5 - E5 - D5 - - - C#5 - - - E5 - - - A5 - - -',
    lead2:'. . . . . . . . . . . . . . . . . . . . F4 - A4 - D5 - A4 - F4 - A4 - . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .'})},
  {id:'c_bat_b',n:'8bit B：疾走',d:'Eマイナー・とても速い。ずっと走り続ける感じ',t:mkTrack({bpm:176,prog:['Em','C','D','B'],bass:'oct',arp:'16',drums:DR.fast,lstep:2,lw:0.25,lv:0.045,av:0.012,
    lead:'E5 - G5 - B5 - - - A5 - G5 - F#5 - E5 - D5 - E5 - - - - - - - . . . . E5 - G5 - B5 - - - D6 - C6 - B5 - A5 - B5 - F#5 - D#5 - - - - - - -'})},
  {id:'c_bat_c',n:'8bit C：重い行軍',d:'Cマイナー・どっしり。刻む和音と太鼓',t:mkTrack({bpm:140,prog:['Cm','Cm','Ab','Bb','Cm','Cm','Fm','G'],bass:'gallop',arp:'stab',drums:DR.march,lstep:2,lw:0.5,lv:0.045,av:0.02,
    lead:'C5 - - - G4 - - - C5 - Eb5 - D5 - C5 - Bb4 - - - - - - - . . . . . . . . Ab4 - - - C5 - Eb5 - Bb4 - - - D5 - F5 - C5 - - - G4 - - - C5 - Eb5 - G5 - F5 - Eb5 - D5 - Ab5 - - - G5 - - - - - - - B4 - - - D5 - - -'})},
 ]},
 {scene:'boss',n:'ボス襲来',orig:'今の曲（重い金管とティンパニ）',list:[
  {id:'c_boss_a',n:'8bit A：魔王の影',d:'Cマイナー・重い。半音で下がる不気味な進行',t:mkTrack({bpm:124,prog:['Cm','B','Bb','A','Ab','G','Ab','G'],bass:'8',arp:'stab',drums:DR.boss,lstep:2,lw:0.5,lv:0.05,av:0.02,
    lead:'C5 - - - - - Eb5 - D5 - - - - - B4 - Bb4 - - - - - D5 - C#5 - - - A4 - - - Ab4 - - - C5 - Eb5 - G5 - - - F#5 - - - Eb5 - - - F5 - Ab5 - G5 - - - - - - -'})},
  {id:'c_boss_b',n:'8bit B：決戦',d:'Bbマイナー・速く激しい',t:mkTrack({bpm:156,prog:['Bbm','Bbm','Gb','Ab','Bbm','Bbm','Ebm','F'],bass:'16',arp:'16',drums:DR.fast,lstep:2,lw:0.25,lv:0.045,av:0.012,
    lead:'Bb4 - Db5 - F5 - - - E5 - F5 - Ab5 - Gb5 - F5 - - - Db5 - - - Eb5 - F5 - Gb5 - - - F5 - Eb5 - Db5 - - - Ab4 - - - Bb4 - Db5 - F5 - Bb5 - Ab5 - Gb5 - F5 - Eb5 - F5 - - - A4 - - - C5 - - - F5 - - -'})},
 ]},
 {scene:'siege',n:'駐留地への夜襲',orig:'今の曲（忍び寄る→戦太鼓）',list:[
  {id:'c_siege_a',n:'8bit A：忍び足',d:'Eマイナー・低く静か。ぽつぽつ鳴る旋律',t:mkTrack({bpm:112,prog:['Em','Em','C','B'],bass:'walk',arp:'none',drums:DR.sneak,lstep:2,lw:0.125,lv:0.04,echo:true,
    lead:'E4 - . . G4 - . . F#4 - . . E4 - - - . . . . B4 - . . A4 - G4 - F#4 - - - . . . . . . . . . . . . . . . .'})},
  {id:'c_siege_b',n:'8bit B：突入',d:'Aマイナー・速い。見つかったあと向け',t:mkTrack({bpm:152,prog:['Am','Am','F','E'],bass:'gallop',arp:'stab',drums:DR.rock,lstep:2,lw:0.5,lv:0.045,av:0.018,
    lead:'A4 - C5 - E5 - A5 - G5 - E5 - C5 - D5 - E5 - - - - - - - . . . . F5 - E5 - D5 - C5 - B4 - G#4 - B4 - E5 - - - - - - -'})},
 ]},
];
for(const g of BGM)for(const x of g.list)TRACK[x.id]=x.t;   // ゲームの曲表に足す（auSched が鳴らす）
const CHIP_SCENE={};for(const g of BGM)for(const x of g.list)CHIP_SCENE[x.id]=g.scene;
// 場面の曲を、選んだ 8bit の曲に差し替える（試作版のゲームでも効く）。ラボで聴いている間はその曲を固定
let LAB_PLAY=null;   // null＝ふつう／'stop'＝止める／曲の名前＝その曲
function hookMusic(){if(window.__labMusicHooked||typeof auMusicFor!=='function')return;window.__labMusicHooked=true;const orig=auMusicFor;
  window.auMusicFor=auMusicFor=function(){if(typeof AU==='undefined'||!AU.ctx)return orig.apply(this,arguments);
    if(LAB_PLAY){const want=LAB_PLAY==='stop'?null:LAB_PLAY.track;AU.intensity=LAB_PLAY.it||0;if(AU.track!==want){AU.track=want;AU.step=0;AU.nextT=AU.ctx.currentTime+0.15;}return;}
    const cur=AU.track;if(cur&&CHIP_SCENE[cur])AU.track=CHIP_SCENE[cur];   // いったん場面の名前に戻してから元の処理
    const r=orig.apply(this,arguments);const sc=AU.track,pk=PICK[sc];
    if(pk&&TRACK[pk]&&CHIP_SCENE[pk]===sc){AU.track=pk;if(cur!==pk&&CHIP_SCENE[cur]!==sc){AU.step=0;}}
    return r;};}
hookMusic();
function playBgm(track,it){try{auInit();}catch(e){}LAB_PLAY={track,it:it||0};try{auMusicFor();}catch(e){}renderLab();}
function stopBgm(){LAB_PLAY={track:null};LAB_PLAY='stop';try{auMusicFor();}catch(e){}renderLab();}

// ===================== 画面 =====================
const CSS=`#ndLab{position:fixed;top:0;right:0;bottom:0;width:min(560px,52vw);z-index:9000;background:rgba(14,18,16,.97);color:#e8e4d8;border-left:2px solid #f2b33d;display:flex;flex-direction:column;font-size:13px;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
#ndLab h2{margin:0;font-size:16px;color:#f2b33d}#ndLab .lh{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #33402f;flex-wrap:wrap}
#ndLab .lt{display:flex;gap:4px;margin-left:auto}#ndLab button{background:#1f2a22;color:#e8e4d8;border:1px solid #445a40;border-radius:4px;padding:5px 9px;font:inherit;cursor:pointer}
#ndLab button:hover{border-color:#f2b33d}#ndLab button.on{background:#f2b33d;color:#141a14;border-color:#f2b33d;font-weight:bold}#ndLab button.pick{border-color:#6fe08a;color:#6fe08a}#ndLab button.pick.on{background:#6fe08a;color:#102010}
#ndLab .lb{flex:1;overflow:auto;padding:8px 12px 30px}#ndLab .grp{margin:12px 0 4px;color:#f2b33d;font-weight:bold;border-bottom:1px solid #33402f;padding-bottom:2px}
#ndLab .it{padding:7px 0;border-bottom:1px dashed #2a3428}#ndLab .ir{display:flex;align-items:center;gap:6px;flex-wrap:wrap}#ndLab .ir b{min-width:0}#ndLab .ir code{color:#8a9a86;font-size:11px}
#ndLab .ir .sp{flex:1}#ndLab .ds{color:#9aa79a;font-size:11.5px;margin:2px 0 4px}#ndLab textarea{width:100%;box-sizing:border-box;min-height:30px;background:#0b0f0c;color:#e8e4d8;border:1px solid #33402f;border-radius:4px;font:inherit;font-size:12px;padding:4px 6px;resize:vertical}
#ndLab textarea.has{border-color:#f2b33d}#ndLab .msg{background:#26301f;border:1px solid #6fe08a;color:#cfeccf;padding:6px 8px;border-radius:4px;margin:6px 0}
#ndLab .vol{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px}#ndLab .vol input{width:90px}
#ndLab .now{color:#6fe08a}#ndLab .scene{margin-top:10px}body.labOn #guide,body.labOn #toasts,body.labOn #overlay{display:none!important}
@media (max-width:700px){#ndLab{width:62vw}}`;
let TAB='se';
function openLab(){if(LAB)return;LAB={objs:[],p:null,msg:''};if(!document.getElementById('ndLabCss')){const st=document.createElement('style');st.id='ndLabCss';st.textContent=CSS;document.head.appendChild(st);}
  sandbox();document.body.classList.add('labOn');const r=document.createElement('div');r.id='ndLab';document.body.appendChild(r);renderLab();}
function closeLab(){LAB_PLAY=null;try{if(AU.ctx){AU.track=null;}}catch(e){}location.reload();}   // 試験場のゲームは捨てて、タイトルからやり直す（セーブは触っていない）
function memoBox(key){const v=MEMO[key]||'';return `<textarea data-memo="${esc(key)}" class="${v?'has':''}" placeholder="メモ（直したいこと・感想など）">${esc(v)}</textarea>`;}
function seName(id){for(const [g,L] of SE_LIST)for(const x of L)if(x[0]===id)return x[1];return id;}
function bgmName(id){for(const g of BGM){if(g.scene===id)return g.n+'（今の曲）';for(const x of g.list)if(x.id===id)return g.n+'：'+x.n;}return id;}
function allMemoText(){const L=[];const se=Object.keys(MEMO).filter(k=>k.startsWith('se:')&&MEMO[k].trim()),bg=Object.keys(MEMO).filter(k=>k.startsWith('bgm:')&&MEMO[k].trim()),ot=(MEMO.other||'').trim();
  if(se.length){L.push('【効果音】');for(const k of se)L.push(`・${seName(k.slice(3))}（${k.slice(3)}）：${MEMO[k].trim().replace(/\n/g,' / ')}`);}
  if(bg.length){L.push('【BGM】');for(const k of bg)L.push(`・${bgmName(k.slice(4))}：${MEMO[k].trim().replace(/\n/g,' / ')}`);}
  const pk=Object.keys(PICK).filter(k=>PICK[k]);if(pk.length){L.push('【選んだBGM】');for(const k of pk){const g=BGM.find(x=>x.scene===k);const it=g&&g.list.find(x=>x.id===PICK[k]);L.push(`・${g?g.n:k}：${it?it.n:'今の曲'}`);}}
  if(ot)L.push('【そのほか】\n'+ot);
  return L.join('\n')||'（まだメモはありません）';}
function renderLab(){const r=document.getElementById('ndLab');if(!r)return;const on=typeof AU!=='undefined'&&AU.on;const bv=AU.bgmVol,svv=AU.seVol;
  let h=`<div class="lh"><h2>効果音・BGM ラボ</h2><small style="color:#9aa79a">試作版だけ</small><div class="lt">${[['se','効果音'],['bgm','BGM'],['memo','メモ一覧']].map(([k,n])=>`<button data-tab="${k}" class="${TAB===k?'on':''}">${n}</button>`).join('')}<button id="labX">閉じる</button></div>
    <div class="vol" style="width:100%">${on?'':'<b style="color:#ff8a7e">消音中</b>'}<label>BGM <input id="labVB" type="range" min="0" max="1" step="0.05" value="${bv}"></label><label>効果音 <input id="labVS" type="range" min="0" max="1" step="0.05" value="${svv}"></label><button id="labMute">${on?'消音にする':'音を出す'}</button>${TAB==='bgm'?'<button id="labStop">曲を止める</button>':''}</div></div><div class="lb">`;
  if(TAB==='se'){
    h+=`<div class="ds">「▶ 音」は音だけ、「▶ 演出つき」は左のマップに本物の施設・敵・部隊を出して、実際の演出と一緒に鳴らします（何度押してもやり直せます）。メモは書いたらすぐこの端末に保存されます。</div>`;
    if(LAB.msg)h+=`<div class="msg">${esc(LAB.msg)}</div>`;
    for(const [g,L] of SE_LIST){h+=`<div class="grp">${g}</div>`;
      for(const [id,n,where,o] of L)h+=`<div class="it"><div class="ir"><b>${n}</b><code>${id}</code><span class="sp"></span><button data-se="${id}">▶ 音</button>${o&&o.demo?`<button data-demo="${o.demo}">▶ 演出つき</button>`:''}</div><div class="ds">${where}</div>${memoBox('se:'+id)}</div>`;}
  }else if(TAB==='bgm'){
    h+=`<div class="ds">場面ごとに「今の曲」と 8bit 風の曲を聴き比べられます。<b>「★これにする」</b>を押すと、試作版のゲームのその場面でその曲が流れます（もう一度押すと今の曲に戻ります）。</div>`;
    const cur=LAB_PLAY&&LAB_PLAY.track;
    for(const g of BGM){h+=`<div class="grp scene">${g.n}</div>`;
      const origPick=!PICK[g.scene];
      h+=`<div class="it"><div class="ir"><b class="${cur===g.scene?'now':''}">${cur===g.scene?'♪ ':''}今の曲</b><span class="sp"></span><button data-play="${g.scene}" data-it="${g.scene==='battle'?1:0}">▶ 聴く</button><button class="pick ${origPick?'on':''}" data-pick="${g.scene}" data-id="">${origPick?'★ 使用中':'★ これにする'}</button></div><div class="ds">${g.orig}</div>${memoBox('bgm:'+g.scene)}</div>`;
      for(const x of g.list){const pk=PICK[g.scene]===x.id;h+=`<div class="it"><div class="ir"><b class="${cur===x.id?'now':''}">${cur===x.id?'♪ ':''}${x.n}</b><span class="sp"></span><button data-play="${x.id}">▶ 聴く</button><button class="pick ${pk?'on':''}" data-pick="${g.scene}" data-id="${x.id}">${pk?'★ 使用中':'★ これにする'}</button></div><div class="ds">${x.d}（${x.t.bpm} BPM）</div>${memoBox('bgm:'+x.id)}</div>`;}}
  }else{
    h+=`<div class="ds">効果音・BGM に書いたメモと、選んだ BGM をまとめたものです。「コピー」してチャットに貼り付けてください。</div><textarea id="labAll" style="min-height:260px" readonly>${esc(allMemoText())}</textarea>
      <div class="ir" style="margin:6px 0"><button id="labCopy">コピー</button><span id="labCopied" class="ds"></span></div><div class="grp">そのほかのメモ</div>${memoBox('other')}
      <div class="ir" style="margin-top:12px"><button id="labClear" style="border-color:#a04040;color:#ff8a7e">メモを全部消す</button></div>`;}
  h+='</div>';r.innerHTML=h;
  r.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{TAB=b.dataset.tab;renderLab();});
  r.querySelector('#labX').onclick=closeLab;
  r.querySelector('#labVB').oninput=e=>{try{auSetBgm(+e.target.value);}catch(x){}};r.querySelector('#labVS').oninput=e=>{try{auSetSe(+e.target.value);}catch(x){}};
  r.querySelector('#labMute').onclick=()=>{try{auInit();auToggle();}catch(e){}renderLab();};
  const ls=r.querySelector('#labStop');if(ls)ls.onclick=stopBgm;
  r.querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>{try{auInit();}catch(e){}if(AU.last)AU.last[b.dataset.se]=-9;se(b.dataset.se);});
  r.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{try{auInit();}catch(e){}runDemo(b.dataset.demo);});
  r.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playBgm(b.dataset.play,+(b.dataset.it||0)));
  r.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const sc=b.dataset.pick,id=b.dataset.id;if(id&&PICK[sc]!==id)PICK[sc]=id;else delete PICK[sc];sv(PICK_KEY,PICK);try{se('click');}catch(e){}renderLab();});
  r.querySelectorAll('[data-memo]').forEach(t=>t.oninput=()=>{const k=t.dataset.memo;if(t.value.trim())MEMO[k]=t.value;else delete MEMO[k];t.classList.toggle('has',!!t.value.trim());sv(MEMO_KEY,MEMO);const a=document.getElementById('labAll');if(a)a.value=allMemoText();});
  const cp=r.querySelector('#labCopy');if(cp)cp.onclick=()=>{const a=document.getElementById('labAll');const done=()=>{document.getElementById('labCopied').textContent='コピーしました';};
    try{navigator.clipboard.writeText(a.value).then(done,()=>{a.select();document.execCommand('copy');done();});}catch(e){a.select();try{document.execCommand('copy');}catch(x){}done();}};
  const cl=r.querySelector('#labClear');if(cl)cl.onclick=()=>{if(!cl.dataset.ok){cl.dataset.ok=1;cl.textContent='本当に消す？もう一度押す';return;}MEMO={};sv(MEMO_KEY,MEMO);renderLab();};
}
window.openSoundLab=openLab;
window.__lab={DEMO,runDemo,BGM,SE_LIST,allMemoText,get LAB(){return LAB;},playBgm,stopBgm};
})();
