'use strict';
// World units are independent of CSS pixels. Physics runs at a fixed 120 Hz.
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = 960, H = 540, STEP = 1 / 120;
const LEVELS = [
  { name:'林间来信', hint:'裂纹木板撑不住太久。路灯会记住你的脚步。', palette:['#eee6c9','#bacbb0','#7a9d85'],
    boards:[[0,450,180],[238,417,122],[414,375,118],[582,420,135],[766,354,90],[880,310,80]],
    fragile:[1], check:3, fish:[[292,365],[466,320],[807,300]], thorns:[[122,436,30]], saw:null },
  { name:'桥也会打盹', hint:'木桥开始摇晃时就起跳。荆棘上方永远有路。', palette:['#e6dfcf','#b0c3bd','#739b96'],
    boards:[[0,450,170],[220,390,110],[380,330,110],[540,390,125],[712,340,100],[855,285,105]],
    fragile:[1,2,4], check:3, fish:[[265,333],[424,275],[753,285]], thorns:[[610,376,28]], saw:null },
  { name:'门口的小把戏', hint:'红色飞果来回摆动，观察一拍再跳。真正的家在最右边。', palette:['#ead8c9','#c3b7ac','#8d9c8c'],
    boards:[[0,450,170],[222,400,110],[382,352,110],[540,410,125],[714,355,105],[860,300,100]],
    fragile:[2,4], check:3, fish:[[270,340],[431,295],[764,298]], thorns:[[115,436,28]],
    saw:{x:690,y:294,r:12,range:48}, fake:true }
];
let keys = new Set(), levelIndex=0, level, boards, fish, checkpoint=-1, deaths=0, elapsed=0;
let state='menu', time=0, deathDelay=0, buffer=0, coyote=0, jumpHeld=false, accumulator=0, last=0;
let particles=[], shake=0, landing=0, muted=false, audio=null, fakeTriggered=false, collectedTotal=0;
const cat={x:45,y:420,w:23,h:30,vx:0,vy:0,ground:true,face:1};
let unlocked=0;
const touchPointers=new Map();
function clearInput(){
  keys.clear();jumpHeld=false;buffer=0;touchPointers.clear();
  for(const b of document.querySelectorAll('[data-key]'))b.setAttribute('aria-pressed','false');
}
try { unlocked=Math.max(0,Math.min(2,Number(localStorage.getItem('tiny-trouble-level'))||0)); muted=localStorage.getItem('tiny-trouble-muted')==='true'; } catch {}
function save(){try{localStorage.setItem('tiny-trouble-level',String(unlocked));localStorage.setItem('tiny-trouble-muted',String(muted));}catch{}}
function sound(freq=440,duration=.1,type='sine'){
  if(muted||!audio)return;
  const o=audio.createOscillator(),g=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration);
  g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
  o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);
}
function unlockAudio(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
let noticeTimer;
function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),2600);}
function panel(title,description,button,overline='猫的第九次散步'){
  $('overlay').hidden=false;$('heading').textContent=title;$('description').textContent=description;
  $('primary').textContent=button;$('overline').textContent=overline;
  $('secondary').hidden=state==='clear'||state==='complete';
}
function hud(){
  $('chapter').textContent='CHAPTER 0'+(levelIndex+1)+' / 03';
  $('levelTitle').textContent=level.name;
  $('fish').textContent=fish.filter(f=>f.got).length+' / 3';
  $('deaths').textContent=deaths;
  $('checkpoint').textContent=checkpoint<0?'◇ 尚未到达路灯':'◆ 路灯已点亮';
  $('hint').textContent=level.hint;
}
function spawn(){
  const p=boards[checkpoint<0?0:checkpoint];
  Object.assign(cat,{x:p.x+25,y:p.y-cat.h,vx:0,vy:0,ground:true,face:1});
  for(const b of boards)b.crack=-1;
  clearInput();coyote=.1;deathDelay=0;landing=0;
}
function loadLevel(i){
  levelIndex=i;level=LEVELS[i];checkpoint=-1;time=0;fakeTriggered=false;
  boards=level.boards.map(([x,y,w],index)=>({x,y,w,h:18,fragile:level.fragile.includes(index),crack:-1}));
  fish=level.fish.map(([x,y])=>({x,y,got:false}));particles=[];spawn();hud();rebuildBackground();
}
function start(i=0){elapsed=0;deaths=0;collectedTotal=0;loadLevel(i);state='play';$('overlay').hidden=true;canvas.focus({preventScroll:true});unlockAudio();}
function burst(x,y,color,count=12){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*150,vy:-Math.random()*120,life:.4+Math.random()*.3,color});}
function die(reason='失足也没关系，马上再来。'){
  if(state!=='play'||deathDelay>0)return;
  deaths++;deathDelay=.42;shake=5;burst(cat.x+12,cat.y+15,'#ca7957',20);sound(130,.18,'triangle');hud();notice(reason);
}
function finish(){
  state=levelIndex===2?'complete':'clear';collectedTotal+=fish.filter(f=>f.got).length;
  unlocked=Math.max(unlocked,Math.min(2,levelIndex+1));save();keys.clear();sound(880,.3);
  panel(state==='complete'?'到家了，猫猫。':'这一页，走过了。',
    '用时 '+Math.floor(elapsed)+' 秒 · 跌倒 '+deaths+' 次 · 本次收集 '+collectedTotal+' 条鱼干',
    state==='complete'?'再走一遍 →':'翻到下一页 →',state==='complete'?'散步结束 / 感谢你的耐心':'CHAPTER 0'+(levelIndex+1)+' COMPLETE');
}
function pause(){if(state==='play'){state='pause';clearInput();panel('歇一会儿。','森林会等你回来。','继续散步 →');}else if(state==='pause'){state='play';$('overlay').hidden=true;canvas.focus({preventScroll:true});}}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function update(dt){
  if(state!=='play')return;
  elapsed+=dt;time+=dt;shake=Math.max(0,shake-dt*22);landing=Math.max(0,landing-dt*4);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
  if(deathDelay>0){deathDelay-=dt;if(deathDelay<=0)spawn();return;}
  buffer=Math.max(0,buffer-dt);coyote=cat.ground?.10:Math.max(0,coyote-dt);
  const axis=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  const target=axis*240, acceleration=cat.ground?2400:1800;
  cat.vx+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-cat.vx));if(axis)cat.face=axis;
  if(buffer>0&&coyote>0){cat.vy=-530;cat.ground=false;coyote=0;buffer=0;burst(cat.x+12,cat.y+30,'#ddd2b1',7);sound(540,.09);}
  if(!jumpHeld&&cat.vy<-210)cat.vy=-210;
  cat.vy+=1200*dt;
  cat.x=Math.max(0,Math.min(W-cat.w,cat.x+cat.vx*dt));
  const previousBottom=cat.y+cat.h,fallSpeed=cat.vy;cat.y+=cat.vy*dt;cat.ground=false;
  for(let i=0;i<boards.length;i++){
    const b=boards[i];if(b.crack>=0)b.crack+=dt;if(b.crack>.65)continue;
    if(cat.x+cat.w>b.x+2&&cat.x<b.x+b.w-2&&previousBottom<=b.y+.5&&cat.y+cat.h>=b.y&&cat.vy>=0){
      cat.y=b.y-cat.h;cat.vy=0;cat.ground=true;
      if(fallSpeed>150){landing=.16;burst(cat.x+12,b.y,'#e4d5b6',8);sound(180,.045,'triangle');}
      if(b.fragile&&b.crack<0){b.crack=0;notice('咔嚓……这块木板要塌了！');}
      if(i===level.check&&cat.x<b.x+65&&checkpoint!==i){checkpoint=i;sound(740,.2);burst(b.x+35,b.y-35,'#efc97a',20);notice('路灯点亮，跌倒后从这里继续。');hud();}
      if(i===boards.length-1&&cat.x>b.x+24){finish();return;}
    }
  }
  const hurt={x:cat.x+4,y:cat.y+4,w:cat.w-8,h:cat.h-5};
  for(const [x,y,w] of level.thorns)if(overlap(hurt,{x:x+3,y:y+3,w:w-6,h:11})){die('荆棘扎脚，跳过去就好。');return;}
  if(level.saw){const s=level.saw,sx=s.x+Math.sin(time*1.8)*s.range;const nx=Math.max(hurt.x,Math.min(sx,hurt.x+hurt.w)),ny=Math.max(hurt.y,Math.min(s.y,hurt.y+hurt.h));if(Math.hypot(sx-nx,s.y-ny)<s.r){die('等飞果离开，再起跳。');return;}}
  for(const f of fish)if(!f.got&&Math.hypot(cat.x+12-f.x,cat.y+15-f.y)<25){f.got=true;sound(1050,.12);burst(f.x,f.y,'#c49243',10);hud();}
  if(level.fake&&!fakeTriggered&&cat.x>540){fakeTriggered=true;notice('「终点」牌子开了个玩笑。家还在右边 →');}
  if(cat.y>H+40)die();
}
// Cached illustration: deterministic ink lines, layered foliage and paper flecks.
const background=document.createElement('canvas');background.width=W;background.height=H;
let bg=background.getContext('2d'), seed=19;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function rebuildBackground(){
  seed=19+levelIndex;const c=bg;c.fillStyle=level.palette[0];c.fillRect(0,0,W,H);
  oval(c,734,105,51,51,'#f9efcf');
  // Broad curved hills instead of sharp polygon mountains.
  for(let layer=0;layer<3;layer++){
    c.fillStyle=[level.palette[1],level.palette[2],'#708a70'][layer];c.globalAlpha=layer===2?.34:.58;
    c.beginPath();c.moveTo(0,H);c.lineTo(0,280+layer*75);
    for(let x=0;x<W;x+=160)c.quadraticCurveTo(x+70,190+layer*90+rand()*65,x+160,280+layer*75);
    c.lineTo(W,H);c.closePath();c.fill();
  }c.globalAlpha=1;
  for(let j=0;j<14;j++){
    const x=j*78-25,y=325+rand()*100,h=95+rand()*140;
    c.globalAlpha=.23;line(c,[[x,y+60],[x+6,y-h]],'#5c7363',4);
    for(let k=0;k<6;k++){const yy=y-h+k*28;oval(c,x+(k%2?17:-17),yy,26+k*3,25,'#6a8973');}
  }c.globalAlpha=1;
  // Foreground framing branches keep the central jump path clear.
  for(const x of [14,942]){
    line(c,[[x,540],[x+7,275],[x-9,90],[x+6,-20]],'#6d7054',17);
    line(c,[[x+1,420],[x-2,200],[x+4,0]],'#9c9b71',5);
    for(let j=0;j<8;j++){const y=30+j*24,d=x<100?1:-1;
      line(c,[[x,y+50],[x+d*60,y]],'#6d7054',4);
      oval(c,x+d*(25+j%3*18),y,29,13,['#94a574','#a4af7c','#7e966e'][j%3]);
    }
  }
  for(let i=0;i<12500;i++){c.fillStyle=i%2?'#fff7dc':'#625539';c.globalAlpha=.025+rand()*.05;c.fillRect(rand()*W,rand()*H,rand()*2+.3,.7);}c.globalAlpha=1;
  // Floating seeds and distant ink birds.
  for(let i=0;i<7;i++){const x=170+i*93,y=72+rand()*100;line(c,[[x-5,y],[x,y+3],[x+6,y-1]],'#828778',1);}
}
function drawBoard(b,i){
  if(b.crack>.65)return;
  const jitter=b.crack>0?Math.sin(time*65)*b.crack*2:0;
  ctx.save();ctx.translate(jitter,0);
  ctx.fillStyle=b.fragile?'#b79b75':'#b9b08a';ctx.strokeStyle='#68634d';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(b.x,b.y+1);ctx.lineTo(b.x+b.w,b.y);ctx.lineTo(b.x+b.w-4,b.y+19);ctx.lineTo(b.x+5,b.y+22);ctx.closePath();ctx.fill();ctx.stroke();
  line(ctx,[[b.x+4,b.y+6],[b.x+b.w-5,b.y+5]],'#eee3bb',3);
  for(let x=b.x+12;x<b.x+b.w-8;x+=22)line(ctx,[[x,b.y+12],[x+13,b.y+11]],'#83785b',.8);
  if(b.fragile)line(ctx,[[b.x+b.w*.55,b.y+1],[b.x+b.w*.47,b.y+9],[b.x+b.w*.6,b.y+14],[b.x+b.w*.52,b.y+21]],'#67503f',1.5);
  else for(let x=b.x+9;x<b.x+b.w-7;x+=14){line(ctx,[[x,b.y],[x-3,b.y-5],[x+1,b.y-2],[x+4,b.y-7]],'#607654',1);}
  if(i===level.check){
    line(ctx,[[b.x+40,b.y],[b.x+40,b.y-64]],'#6c6650',3);
    ctx.fillStyle=checkpoint===i?'#eed48c':'#b0b2a0';ctx.fillRect(b.x+32,b.y-66,16,22);
    ctx.strokeStyle='#71694d';ctx.strokeRect(b.x+32,b.y-66,16,22);
    if(checkpoint===i){ctx.globalAlpha=.16;oval(ctx,b.x+40,b.y-55,29,32,'#ffe0a0');ctx.globalAlpha=1;}
  }
  ctx.restore();
}
function drawCat(){
  if(deathDelay>0)return;
  const walking=cat.ground&&Math.abs(cat.vx)>20,cycle=Math.sin(time*23),squash=landing;
  ctx.save();ctx.translate(cat.x+12,cat.y+30);ctx.scale(cat.face*(1+squash),1-squash);
  ctx.strokeStyle='#69513e';ctx.lineWidth=2;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-8,-7);ctx.bezierCurveTo(-24,-6,-23,-21,-18,-20+Math.sin(time*4)*3);ctx.stroke();
  ctx.fillStyle='#cf9368';ctx.beginPath();ctx.moveTo(-10,-5);ctx.quadraticCurveTo(-13,-12,-10,-21);ctx.lineTo(-10,-31);ctx.lineTo(-3,-26);ctx.quadraticCurveTo(2,-28,6,-26);ctx.lineTo(12,-31);ctx.lineTo(11,-18);ctx.quadraticCurveTo(14,-5,8,-3);ctx.closePath();ctx.fill();ctx.stroke();
  oval(ctx,2,-12,7,8,'#f2dfb5');
  line(ctx,[[-8,-23],[-5,-22]],'#a76f50',2);line(ctx,[[-8,-18],[-5,-17]],'#a76f50',2);
  const blink=Math.sin(time*.9)>.996;ctx.fillStyle='#493e33';ctx.fillRect(-3,-22,2,blink?1:3);ctx.fillRect(6,-22,2,blink?1:3);
  line(ctx,[[1,-17],[3,-16],[4,-17]],'#70523d',1);
  line(ctx,[[-4,-15],[-13,-17]],'#70523d',.7);line(ctx,[[6,-15],[15,-17]],'#70523d',.7);
  oval(ctx,-6,-2+(walking?cycle*2:0),4,2.5,'#825c43');oval(ctx,7,-2-(walking?cycle*2:0),4,2.5,'#825c43');
  ctx.restore();
}
function draw(){
  ctx.drawImage(background,0,0);ctx.save();
  if(shake)ctx.translate(Math.sin(time*90)*shake,Math.cos(time*70)*shake*.5);
  // Tiny drifting pollen is decorative; collision surfaces stay perfectly stable.
  for(let i=0;i<18;i++)oval(ctx,(i*83+time*5)%W,90+(i*41)%340+Math.sin(time+i)*6,1.3,1.3,'#f7edcb');
  boards.forEach(drawBoard);
  for(const [x,y,w] of level.thorns){for(let j=0;j<w;j+=10){ctx.fillStyle='#a76050';ctx.beginPath();ctx.moveTo(x+j,y+14);ctx.quadraticCurveTo(x+j+3,y+3,x+j+7,y);ctx.lineTo(x+j+10,y+14);ctx.fill();line(ctx,[[x+j+3,y+12],[x+j+7,y+3]],'#6b493f');}}
  const end=boards[boards.length-1];
  ctx.fillStyle='#957b5a';ctx.fillRect(end.x+36,end.y-53,32,53);
  ctx.fillStyle='#674c3f';ctx.beginPath();ctx.moveTo(end.x+28,end.y-51);ctx.lineTo(end.x+52,end.y-76);ctx.lineTo(end.x+76,end.y-51);ctx.fill();
  ctx.fillStyle='#edcc84';ctx.fillRect(end.x+44,end.y-36,17,36);oval(ctx,end.x+57,end.y-17,1.4,1.4,'#69503e');
  if(level.fake){line(ctx,[[565,391],[565,352]],'#7f7356',3);ctx.fillStyle='#efe1bb';ctx.fillRect(544,346,48,19);ctx.fillStyle='#7f7356';ctx.font='11px serif';ctx.fillText('终点？',548,360);}
  if(level.saw){const s=level.saw,x=s.x+Math.sin(time*1.8)*s.range;line(ctx,[[690,0],[x,s.y]],'#8d8b72',1);oval(ctx,x,s.y,s.r,s.r,'#b85d4d');line(ctx,[[x-3,s.y-6],[x+1,s.y-13],[x+7,s.y-12]],'#718556',2);}
  for(const f of fish)if(!f.got){const y=f.y+Math.sin(time*3+f.x)*3;oval(ctx,f.x,y,9,4,'#c2954e');ctx.fillStyle='#c2954e';ctx.beginPath();ctx.moveTo(f.x-7,y);ctx.lineTo(f.x-13,y-5);ctx.lineTo(f.x-13,y+5);ctx.fill();oval(ctx,f.x+5,y-1,1,1,'#66533c');}
  drawCat();
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*1.5);oval(ctx,p.x,p.y,2,1.5,p.color);}ctx.globalAlpha=1;
  ctx.restore();
  $('timer').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
}
function next(){unlockAudio();if(state==='menu')start(unlocked);else if(state==='pause')pause();else if(state==='clear'){loadLevel(levelIndex+1);state='play';$('overlay').hidden=true;canvas.focus({preventScroll:true});}else if(state==='complete')start(0);}
function down(code,repeat=false){
  if(['Space','ArrowUp','KeyW'].includes(code)&&!repeat){
    if(state==='menu'){next();return;}if(state==='play'){buffer=.12;jumpHeld=true;unlockAudio();}
  }
  if(code==='Escape'&&!repeat)pause();
  if(code==='KeyR'&&!repeat&&state==='play')die('重新出发。');
  keys.add(code);
}
function up(code){keys.delete(code);if(['Space','ArrowUp','KeyW'].includes(code))jumpHeld=false;}
window.addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&(e.code==='Space'||e.code==='Enter'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();down(e.code,e.repeat);});
window.addEventListener('keyup',e=>up(e.code));
window.addEventListener('blur',()=>{clearInput();if(state==='play')pause();});
window.addEventListener('orientationchange',()=>{clearInput();if(state==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});
$('primary').onclick=next;$('secondary').onclick=()=>start(0);$('pause').onclick=pause;
$('sound').onclick=()=>{muted=!muted;unlockAudio();save();updateSound();};
function updateSound(){$('sound').textContent='声音：'+(muted?'关':'开');$('sound').setAttribute('aria-pressed',String(muted));}
$('retry').onclick=()=>{if(state==='play')die('重新出发。');};
function fullscreenLabel(){$('fullscreen').textContent=document.fullscreenElement||$('app').classList.contains('immersive')?'退出全屏 ↙':'全屏 ↗';}
$('fullscreen').onclick=async()=>{
  clearInput();
  if($('app').classList.contains('immersive'))$('app').classList.remove('immersive');
  else try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}
  catch{$('app').classList.add('immersive');notice('已展开游戏。横屏体验更好。');}
  fullscreenLabel();
};
document.addEventListener('fullscreenchange',fullscreenLabel);
function touchDown(b,id){
  if(state!=='play')return;
  touchPointers.set(id,b);b.setAttribute('aria-pressed','true');down(b.dataset.key);
}
function touchUp(id){
  const b=touchPointers.get(id);if(!b)return;touchPointers.delete(id);
  if(![...touchPointers.values()].some(other=>other.dataset.key===b.dataset.key)){
    up(b.dataset.key);b.setAttribute('aria-pressed','false');
  }
}
for(const b of document.querySelectorAll('[data-key]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touchDown(b,e.pointerId);});
  b.addEventListener('contextmenu',e=>e.preventDefault());
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>touchUp(e.pointerId));
}
function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;accumulator+=dt;while(accumulator>=STEP){update(STEP);accumulator-=STEP;}draw();requestAnimationFrame(loop);}
loadLevel(unlocked);updateSound();$('primary').textContent=unlocked?'继续第 '+(unlocked+1)+' 关 →':'出发吧 →';$('secondary').hidden=!unlocked;requestAnimationFrame(loop);
