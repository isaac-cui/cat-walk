'use strict';
// World units are independent of CSS pixels. Physics runs at a fixed 120 Hz.
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = 960, H = 540, STEP = 1 / 120;
const camera={x:0,y:0,w:640,h:360,groundY:450,snap:true,pixelWidth:960,pixelHeight:540};
function resizeView(){
  const rect=canvas.getBoundingClientRect?.();
  if(!rect?.width||!rect?.height)return;
  const aspect=rect.width/rect.height;
  camera.w=rect.width<600?370:rect.width<1000?560:640;
  camera.h=Math.min(H,camera.w/aspect);
  // Preserve the visible field in very tall layouts.
  camera.w=camera.h*aspect;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
  camera.pixelWidth=canvas.width;camera.pixelHeight=canvas.height;camera.snap=true;
}
function updateCamera(dt){
  if(cat.ground)camera.groundY=cat.y+cat.h;
  const targetX=Math.max(0,Math.min(W-camera.w,cat.x+cat.w/2-camera.w*.4+cat.vx*.1));
  const targetY=Math.max(0,Math.min(H-camera.h,camera.groundY-camera.h*.74));
  const ease=camera.snap?1:1-Math.exp(-dt*8);
  camera.x+=(targetX-camera.x)*ease;camera.y+=(targetY-camera.y)*ease;camera.snap=false;
  // Keep the cat visible during a drop or an unusually narrow viewport.
  camera.y=Math.max(0,Math.min(H-camera.h,Math.max(cat.y+cat.h-camera.h*.92,Math.min(camera.y,cat.y-16))));
}
const LEVELS = [
  { name:'慢慢学会出发', hint:'先试着跳过前面的小缺口。轻按小跳，按住大跳。', palette:['#eee6c9','#bacbb0','#7a9d85'],
    boards:[[0,450,180],[215,430,125],[375,405,170],[585,385,115],[735,420,85],[860,365,100],[555,475,165]],
    fragile:[3], crumbleDelay:1.15, check:2, exit:5, rescue:6,
    fish:[[905,323]], thorns:[], saw:null },
  { name:'桥也会打盹', hint:'木桥开始摇晃时就起跳。荆棘上方永远有路。', palette:['#e6dfcf','#b0c3bd','#739b96'],
    boards:[[0,450,170],[220,390,110],[380,330,110],[540,390,125],[712,340,100],[855,285,105]],
    fragile:[1,2,4], check:3, fish:[[265,333],[424,275],[753,285]], thorns:[[610,376,28]], saw:null },
  { name:'果园门口', hint:'红色飞果来回摆动，观察一拍再跳。路还在右边。', palette:['#ead8c9','#c3b7ac','#8d9c8c'],
    boards:[[0,450,170],[222,400,110],[382,352,110],[540,410,125],[714,355,105],[860,300,100]],
    fragile:[2,4], check:3, fish:[[270,340],[431,295],[764,298]], thorns:[[115,436,28]],
    saw:{x:690,y:294,r:12,range:48}, fake:true },
  { name:'石阶午后', hint:'这一段不赶时间。稳稳站好，再跳到下一级。', palette:['#efe6c9','#c9ccb0','#9ba482'],
    boards:[[0,455,170],[205,415,120],[365,355,120],[525,305,145],[710,355,105],[850,300,110]],
    fragile:[],check:3,fish:[[260,373],[582,265]],thorns:[],saw:null },
  { name:'鱼干的诱惑', hint:'鱼干不是通行证。想拿高处那条，可以先到路灯边歇脚。', palette:['#efdec6','#c9bc99','#a3aa80'],
    boards:[[0,450,180],[220,425,130],[390,385,145],[575,425,125],[740,365,100],[880,325,80],[425,285,82]],
    fragile:[],check:2,exit:5,fish:[[258,385],[468,246],[788,325]],thorns:[],saw:null },
  { name:'雨后断桥', hint:'两座旧桥之间有稳固的落脚点。可以在那里重新调整节奏。', palette:['#dce3df','#a9c0b9','#7d9e98'],
    boards:[[0,450,175],[215,405,125],[380,365,150],[575,405,125],[740,355,100],[875,310,85]],
    fragile:[1,3],crumbleDelay:.85,check:2,fish:[[267,365],[624,365]],thorns:[],saw:null },
  { name:'等一颗红果', hint:'路灯旁是安全的。先看红果摆过去，再向右起跳。', palette:['#e5d9ce','#c8b5ac','#9e9f8c'],
    boards:[[0,450,170],[210,405,130],[380,350,145],[570,395,140],[750,340,100],[885,290,75]],
    fragile:[],check:3,fish:[[268,365],[433,310],[795,300]],thorns:[],
    saw:{x:730,y:318,r:13,range:48} },
  { name:'最后一盏灯', hint:'走过旧桥，在路灯边歇一歇。最后一段，用熟悉的节奏回家。', palette:['#e6d5c6','#b3b6a6','#88998c'],
    boards:[[0,450,170],[215,400,125],[380,350,150],[575,395,140],[755,345,100],[885,300,75]],
    fragile:[1,4],crumbleDelay:.9,check:3,fish:[[270,360],[435,310],[807,305]],
    thorns:[[463,336,24]],saw:null }
];
const WORLDS=[
  {name:'林间散步',scene:'forest',color:'#526e55'},
  {name:'潮汐码头',scene:'harbor',color:'#477d94'},
  {name:'月下屋顶',scene:'rooftop',color:'#7775a8'}
];
const NEW_CHAPTERS=[
  {scene:'harbor',palette:['#d6e5e5','#96b5bc','#688e9b'],stages:[
    ['海风初来',[[0,450,180],[220,420,130],[390,385,145],[575,410,130],[745,365,105],[885,320,75]],{wind:35},'蓝色风区只影响空中的你。先从宽平台试一跳。'],
    ['顺风栈道',[[0,450,170],[225,415,125],[400,375,130],[585,405,130],[760,350,100],[890,305,70]],{wind:45},'顺风会多送你一小段。快到平台时松开方向键。'],
    ['逆风灯塔',[[0,450,175],[210,420,135],[385,385,145],[570,415,135],[745,365,105],[880,320,80]],{wind:-35},'逆风中按住跳跃，落脚点会更近一些。'],
    ['停船的午后',[[0,450,180],[215,420,135],[385,380,145],[565,345,140],[745,390,105],[885,345,75]],{},'风暂时停了。这一段不赶时间。'],
    ['软垫试跳',[[0,450,180],[215,425,130],[385,400,155],[580,245,130],[745,305,105],[880,350,80]],{spring:[2]},'蓝色鼓垫站稳后再跳，能跳上更高的栈桥。仍然只用跳跃键。'],
    ['一跳一歇',[[0,450,180],[220,420,130],[390,395,150],[580,235,135],[755,290,100],[885,335,75]],{spring:[2]},'弹性垫需要长按跳跃。高处的桥是稳固的。'],
    ['风中的软垫',[[0,450,175],[215,425,135],[390,400,150],[585,250,130],[750,310,100],[885,355,75]],{spring:[2],wind:28},'先在无风处踏上软垫，再顺风跳往高桥。'],
    ['渡口晚灯',[[0,450,180],[220,420,130],[395,390,145],[580,240,135],[750,300,105],[885,345,75]],{spring:[2],wind:-25},'站稳、按住、起跳。码头的最后一盏灯在右边。']
  ]},
  {scene:'rooftop',palette:['#353e60','#636b88','#9093a7'],stages:[
    ['第一片薄霜',[[0,450,180],[215,420,140],[395,380,145],[580,405,135],[755,355,100],[885,310,75]],{ice:[1]},'浅蓝屋瓦有点滑。松手后仍会前进，试着轻按反方向刹车。'],
    ['滑过天窗',[[0,450,180],[220,415,140],[400,375,140],[580,410,135],[755,360,100],[885,315,75]],{ice:[1,3]},'冰面之间有普通屋瓦，可以在那里停稳。'],
    ['月亮歇脚处',[[0,450,180],[215,415,140],[395,375,145],[580,335,135],[755,385,100],[885,340,75]],{},'月光下没有机关。慢慢走，看看远处的灯。'],
    ['会走路的屋瓦',[[0,450,180],[215,420,140],[395,380,145],[580,410,135],[755,355,100],[885,310,75]],{belts:{1:50}},'箭头屋瓦会带你走。停下来观察，再向前跳。'],
    ['迎着箭头',[[0,450,180],[215,420,140],[395,380,145],[580,410,135],[755,355,100],[885,310,75]],{belts:{1:-45,3:45}},'逆向屋瓦走得慢些，起跳后就不再被它推着走。'],
    ['霜与齿轮',[[0,450,180],[220,415,140],[400,375,140],[580,410,135],[755,360,100],[885,315,75]],{ice:[1],belts:{3:50}},'先在冰面刹稳，再去试箭头屋瓦。两种地面分开走。'],
    ['屋脊小夜曲',[[0,450,175],[215,410,140],[395,365,145],[580,400,135],[755,350,100],[885,305,75]],{ice:[1],fragile:[4],crumbleDelay:1},'路灯之后只剩一块旧瓦。用森林里学过的节奏跳过去。'],
    ['窗里的暖光',[[0,450,180],[215,415,140],[395,375,145],[580,410,135],[755,355,100],[885,310,75]],{ice:[1],belts:{3:-40}},'经过薄霜，歇在路灯边。再越过最后的屋瓦，就到家了。']
  ]}
];
for(const chapter of NEW_CHAPTERS)for(const [name,layout,traits,hint] of chapter.stages){
  LEVELS.push({name,hint,scene:chapter.scene,palette:chapter.palette,boards:layout,fragile:[],check:2,
    fish:[[layout[1][0]+55,layout[1][1]-42],[layout[4][0]+45,layout[4][1]-42]],thorns:[],saw:null,...traits});
}
function worldIndex(i=levelIndex){return Math.floor(i/8);}
function world(){return WORLDS[worldIndex()];}
let keys = new Set(), levelIndex=0, level, boards, fish, checkpoint=-1, deaths=0, elapsed=0;
let state='menu', time=0, deathDelay=0, buffer=0, coyote=0, jumpHeld=false, accumulator=0, last=0;
let particles=[], shake=0, landing=0, muted=false, audio=null, fakeTriggered=false, collectedTotal=0;
const cat={x:45,y:420,w:23,h:30,vx:0,vy:0,ground:true,face:1};
let unlocked=0;
let cleared={};
let continueLevel=0,selectedWorld=0;
function isLevelUnlocked(i){return i%8===0||!!cleared[i-1]||(i<8&&i<=unlocked);}
let lessonSeen=new Set(), lastFallWasBridge=false;
function teach(id,message){
  if(lessonSeen.has(id))return;
  lessonSeen.add(id);$('hint').textContent=message;notice(message);
}
function exitIndex(){return level.exit??boards.length-1;}
function crumbleDelay(){return level.crumbleDelay??.65;}
const touchPointers=new Map();
function clearInput(){
  keys.clear();jumpHeld=false;buffer=0;touchPointers.clear();
  for(const b of document.querySelectorAll('[data-key]'))b.setAttribute('aria-pressed','false');
}
function clampLevel(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(n))):0;}
try { unlocked=Math.min(7,clampLevel(localStorage.getItem('tiny-trouble-level'))); muted=localStorage.getItem('tiny-trouble-muted')==='true'; const saved=JSON.parse(localStorage.getItem('tiny-trouble-cleared')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))cleared=saved;continueLevel=clampLevel(localStorage.getItem('tiny-trouble-continue')??unlocked);if(!isLevelUnlocked(continueLevel))continueLevel=unlocked; } catch {}
function save(){try{localStorage.setItem('tiny-trouble-level',String(unlocked));localStorage.setItem('tiny-trouble-muted',String(muted));localStorage.setItem('tiny-trouble-cleared',JSON.stringify(cleared));}catch{}}
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
  $('chapter').textContent=(worldIndex()+1)+'-'+(levelIndex%8+1)+' / '+world().name;
  $('levelTitle').textContent=level.name;
  $('fish').textContent=fish.filter(f=>f.got).length+' / '+fish.length;
  $('deaths').textContent=deaths;
  $('checkpoint').textContent=checkpoint<0?'◇ 尚未到达路灯':'◆ 路灯已点亮';
  if(!lessonSeen.size)$('hint').textContent=level.hint;
}
function spawn(){
  const p=boards[checkpoint<0?0:checkpoint];
  Object.assign(cat,{x:p.x+25,y:p.y-cat.h,vx:0,vy:0,ground:true,face:1});
  cat.support=checkpoint<0?0:checkpoint;
  for(const b of boards)b.crack=-1;
  clearInput();coyote=.1;deathDelay=0;landing=0;lastFallWasBridge=false;
  camera.groundY=p.y;camera.snap=true;updateCamera(0);
}
function loadLevel(i){
  levelIndex=i;level=LEVELS[i];checkpoint=-1;time=0;fakeTriggered=false;lessonSeen=new Set();
  $('app').setAttribute('data-world',world().scene);
  boards=level.boards.map(([x,y,w],index)=>({x,y,w,h:18,fragile:level.fragile.includes(index),spring:level.spring?.includes(index),ice:level.ice?.includes(index),belt:level.belts?.[index]||0,crack:-1}));
  fish=level.fish.map(([x,y])=>({x,y,got:false}));particles=[];spawn();hud();rebuildBackground();
}
function start(i=0){elapsed=0;deaths=0;collectedTotal=0;loadLevel(clampLevel(i));continueLevel=levelIndex;try{localStorage.setItem('tiny-trouble-continue',String(continueLevel));}catch{}state='play';$('overlay').hidden=true;$('selectPanel').hidden=true;canvas.focus({preventScroll:true});unlockAudio();}
function burst(x,y,color,count=12){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*150,vy:-Math.random()*120,life:.4+Math.random()*.3,color});}
function die(reason='失足也没关系，马上再来。'){
  if(state!=='play'||deathDelay>0)return;
  deaths++;deathDelay=.42;shake=5;burst(cat.x+12,cat.y+15,'#ca7957',20);sound(130,.18,'triangle');hud();notice(reason);
}
function finish(){
  state=levelIndex===LEVELS.length-1?'complete':'clear';collectedTotal+=fish.filter(f=>f.got).length;
  cleared[levelIndex]=true;
  if(levelIndex<8)unlocked=Math.max(unlocked,Math.min(7,levelIndex+1));
  continueLevel=Math.min(LEVELS.length-1,levelIndex+1);try{localStorage.setItem('tiny-trouble-continue',String(continueLevel));}catch{}
  save();clearInput();sound(880,.3);
  panel(state==='complete'?'到家了，猫猫。':levelIndex%8===7?world().name+'，走过了。':'这一页，走过了。',
    '用时 '+Math.floor(elapsed)+' 秒 · 跌倒 '+deaths+' 次 · 本次收集 '+collectedTotal+' 条鱼干',
    state==='complete'?'再走一遍 →':'下一关：'+LEVELS[levelIndex+1].name+' →',state==='complete'?'散步结束 / 三章回家路':(worldIndex()+1)+'-'+(levelIndex%8+1)+' COMPLETE');
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
  const surface=cat.ground?boards[cat.support]:null;
  const target=axis*240, acceleration=cat.ground?(surface?.ice?(axis?650:180):2400):1800;
  cat.vx+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-cat.vx));if(axis)cat.face=axis;
  if(buffer>0&&coyote>0){cat.vy=surface?.spring?-700:-530;cat.ground=false;coyote=0;buffer=0;burst(cat.x+12,cat.y+30,surface?.spring?'#83c7d1':'#ddd2b1',7);sound(surface?.spring?720:540,.09);}
  if(!jumpHeld&&cat.vy<-210)cat.vy=-210;
  cat.vy+=1200*dt;
  const drift=cat.ground?(surface?.belt||0):(level.wind&&cat.x>320&&cat.x<730?level.wind:0);
  cat.x=Math.max(0,Math.min(W-cat.w,cat.x+(cat.vx+drift)*dt));
  const previousBottom=cat.y+cat.h,fallSpeed=cat.vy;cat.y+=cat.vy*dt;cat.ground=false;
  for(let i=0;i<boards.length;i++){
    const b=boards[i];if(b.crack>=0)b.crack+=dt;if(b.crack>crumbleDelay())continue;
    if(cat.x+cat.w>b.x+2&&cat.x<b.x+b.w-2&&previousBottom<=b.y+.5&&cat.y+cat.h>=b.y&&cat.vy>=0){
      cat.y=b.y-cat.h;cat.vy=0;cat.ground=true;cat.support=i;
      if(b.spring)teach('spring','在蓝色软垫上按住跳跃，可以跳得更高。');
      if(b.ice)teach('ice','薄霜会滑。轻按反方向，可以更快停下。');
      if(b.belt)teach('belt','箭头屋瓦会推着你走，起跳就能离开它。');
      if(fallSpeed>150){landing=.16;burst(cat.x+12,b.y,'#e4d5b6',8);sound(180,.045,'triangle');}
      if(levelIndex===0&&i===1)teach('jump','跳得不错。前面的路灯可以歇脚。');
      if(b.fragile&&b.crack<0){
        b.crack=0;lastFallWasBridge=true;sound(95,.12,'triangle');
        if(levelIndex===0)teach('bridge','咔嚓……木板在摇晃，往右跳！');
        else notice('咔嚓……这块木板要塌了！');
      }
      if(i===level.check&&checkpoint!==i){checkpoint=i;sound(740,.2);burst(b.x+35,b.y-35,'#efc97a',20);
        if(levelIndex===0)teach('lamp','路灯已点亮。前面的裂纹板，别停太久。');
        else notice('路灯点亮，跌倒后从这里继续。');hud();}
      if(levelIndex===0&&i===level.rescue)teach('rescue','接住你了。从右边的小台阶回去就好。');
      if(i===exitIndex()&&cat.x>b.x+24){finish();return;}
    }
  }
  const hurt={x:cat.x+4,y:cat.y+4,w:cat.w-8,h:cat.h-5};
  for(const [x,y,w] of level.thorns)if(overlap(hurt,{x:x+3,y:y+3,w:w-6,h:11})){die('荆棘扎脚，跳过去就好。');return;}
  if(level.saw){const s=level.saw,sx=s.x+Math.sin(time*1.8)*s.range;const nx=Math.max(hurt.x,Math.min(sx,hurt.x+hurt.w)),ny=Math.max(hurt.y,Math.min(s.y,hurt.y+hurt.h));if(Math.hypot(sx-nx,s.y-ny)<s.r){die('等飞果离开，再起跳。');return;}}
  for(const f of fish)if(!f.got&&Math.hypot(cat.x+12-f.x,cat.y+15-f.y)<25){f.got=true;sound(1050,.12);burst(f.x,f.y,'#c49243',10);hud();}
  if(level.fake&&!fakeTriggered&&cat.x>540){fakeTriggered=true;notice('「终点」牌子开了个玩笑。家还在右边 →');}
  if(cat.y>H+40)die(lastFallWasBridge?'裂纹板会塌。路灯已记住你，下次及时起跳。':'失足也没关系，马上再来。');
}
// Cached illustration: deterministic ink lines, layered foliage and paper flecks.
const background=document.createElement('canvas');background.width=W;background.height=H;
let bg=background.getContext('2d'), seed=19;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function rebuildBackground(){
  seed=19+levelIndex;const c=bg;c.fillStyle=level.palette[0];c.fillRect(0,0,W,H);
  if(level.scene){drawChapterBackground(c);return;}
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
function paperGrain(c){
  for(let i=0;i<10000;i++){c.fillStyle=i%2?'#fff5d7':'#1d2a40';c.globalAlpha=.025+rand()*.035;c.fillRect(rand()*W,rand()*H,1.5,.7);}c.globalAlpha=1;
}
function drawChapterBackground(c){
  if(level.scene==='harbor'){
    // Open water, cargo sheds, masts and mooring ropes replace all forest silhouettes.
    c.fillStyle='#b5d0d5';c.fillRect(0,280,W,260);
    oval(c,720,100,42,42,'#f8edcc');
    for(let i=0;i<7;i++){
      const x=i*156-25,y=260+rand()*25;
      c.fillStyle='#799caa';c.fillRect(x,y-70,100,70);
      c.fillStyle='#6d8b99';c.beginPath();c.moveTo(x-8,y-70);c.lineTo(x+50,y-103);c.lineTo(x+108,y-70);c.fill();
      line(c,[[x+120,y],[x+120,y-170],[x+190,y-150],[x+120,y-130]],'#7f9ba4',3);
      for(let j=0;j<3;j++)c.fillRect(x+12+j*25,y-50,12,23);
    }
    for(let i=0;i<55;i++){const x=rand()*W,y=300+rand()*240;line(c,[[x,y],[x+12+rand()*36,y-1]],i%2?'#e3eded':'#91b4bf',1);}
    for(const x of [80,410,790]){
      line(c,[[x,335],[x,190],[x+42,272]],'#6e8792',2);
      c.fillStyle='#e8dfc2';c.beginPath();c.moveTo(x+4,204);c.lineTo(x+38,271);c.lineTo(x+4,271);c.fill();
      c.fillStyle='#688e9b';c.beginPath();c.moveTo(x-24,337);c.lineTo(x+42,337);c.lineTo(x+30,351);c.lineTo(x-10,351);c.fill();
    }
    for(const x of [10,946]){line(c,[[x,540],[x,180]],'#7e8172',13);line(c,[[x,280],[x+15,300],[x-10,318],[x+14,336]],'#d0c3a0',3);}
  }else{
    // Night skyline, tiled roofs, lit windows and chimneys; no recolored trees.
    oval(c,742,85,38,38,'#eee3bd');
    for(let i=0;i<60;i++)oval(c,rand()*W,rand()*260,.7+rand(),.7+rand(),'#d8d9df');
    for(let layer=0;layer<2;layer++)for(let i=0;i<12;i++){
      const x=i*90-20,y=230+layer*100+rand()*55,w=65+rand()*40;
      c.fillStyle=layer?'#515c7a':'#67728e';c.fillRect(x,y,w,H-y);
      c.fillStyle=layer?'#404e6d':'#576780';c.beginPath();c.moveTo(x-7,y);c.lineTo(x+w*.5,y-36);c.lineTo(x+w+8,y);c.fill();
      for(let k=0;k<3;k++)for(let j=0;j<2;j++){
        c.fillStyle=(i+j+k)%3?'#a4a1a3':'#d8ba7f';c.fillRect(x+12+j*27,y+20+k*35,11,16);
      }
      c.fillStyle='#424d68';c.fillRect(x+10,y-35,12,24);
    }
    line(c,[[0,170],[210,200],[440,178],[690,202],[960,161]],'#717991',1.3);
    for(let i=0;i<8;i++)line(c,[[i*135,0],[i*135,40+(i%3)*15]],'#68728e',2);
  }
  paperGrain(c);
}
function drawBoard(b,i){
  if(b.crack>crumbleDelay())return;
  const urgency=b.crack<0?0:b.crack/crumbleDelay();
  const jitter=urgency>0?Math.sin(time*65)*urgency*2:0;
  ctx.save();ctx.translate(jitter,0);
  ctx.fillStyle=b.ice?'#a6d6e7':worldIndex()===2?'#6e789b':worldIndex()===1?'#a4b8b6':b.fragile?'#b79b75':'#b9b08a';ctx.strokeStyle=worldIndex()===2?'#3c4866':'#68634d';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(b.x,b.y+1);ctx.lineTo(b.x+b.w,b.y);ctx.lineTo(b.x+b.w-4,b.y+19);ctx.lineTo(b.x+5,b.y+22);ctx.closePath();ctx.fill();ctx.stroke();
  line(ctx,[[b.x+4,b.y+6],[b.x+b.w-5,b.y+5]],'#eee3bb',3);
  for(let x=b.x+12;x<b.x+b.w-8;x+=22)line(ctx,[[x,b.y+12],[x+13,b.y+11]],'#83785b',.8);
  if(b.fragile)line(ctx,[[b.x+b.w*.55,b.y+1],[b.x+b.w*.47,b.y+9],[b.x+b.w*.6,b.y+14],[b.x+b.w*.52,b.y+21]],'#67503f',1.5);
  else if(worldIndex()===0)for(let x=b.x+9;x<b.x+b.w-7;x+=14){line(ctx,[[x,b.y],[x-3,b.y-5],[x+1,b.y-2],[x+4,b.y-7]],'#607654',1);}
  if(b.spring){
    ctx.fillStyle='#83c7d1';ctx.beginPath();ctx.moveTo(b.x+4,b.y);ctx.quadraticCurveTo(b.x+b.w*.5,b.y-13,b.x+b.w-4,b.y);ctx.fill();
    line(ctx,[[b.x+12,b.y+15],[b.x+23,b.y+8],[b.x+34,b.y+15],[b.x+45,b.y+8]],'#527c8c',1.6);
  }
  if(b.ice)for(let x=b.x+10;x<b.x+b.w-15;x+=25)line(ctx,[[x,b.y+5],[x+12,b.y+2]],'#e6f5fc',2);
  if(b.belt){const direction=Math.sign(b.belt);for(let x=b.x+14;x<b.x+b.w-12;x+=22)line(ctx,[[x-direction*4,b.y+6],[x+direction*4,b.y+10],[x-direction*4,b.y+14]],'#f2dca9',1.8);}
  if(i===level.check){
    line(ctx,[[b.x+40,b.y],[b.x+40,b.y-64]],'#6c6650',3);
    ctx.fillStyle=checkpoint===i?'#eed48c':'#b0b2a0';ctx.fillRect(b.x+32,b.y-66,16,22);
    ctx.strokeStyle='#71694d';ctx.strokeRect(b.x+32,b.y-66,16,22);
    if(checkpoint===i){ctx.globalAlpha=.16;oval(ctx,b.x+40,b.y-55,29,32,'#ffe0a0');ctx.globalAlpha=1;}
  }
  ctx.restore();
}
function drawLessonSigns(){
  if(levelIndex!==0)return;
  // Small world-space prompts stay near the relevant action; no tutorial modal.
  ctx.fillStyle='#5b6650';ctx.font='13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
  ctx.fillText('跳一下 →',157,400);
  ctx.fillText('歇歇脚',453,318);
  ctx.fillStyle='#936a4c';ctx.fillText('有裂纹…',641,340);
  ctx.fillStyle='#65745b';ctx.font='11px "Microsoft YaHei",sans-serif';
  ctx.fillText('小路也能回家 →',635,510);ctx.textAlign='start';
}
function drawCat(){
  if(deathDelay>0)return;
  // Rounded kitten silhouette. Artwork is independent of the 23 x 30 hitbox.
  const walking=cat.ground&&Math.abs(cat.vx)>20,cycle=Math.sin(time*20);
  const bounce=walking?Math.abs(cycle)*.65:cat.ground?Math.sin(time*2.5)*.22:0;
  const stretch=!cat.ground&&cat.vy<0?.035:0;
  ctx.save();ctx.translate(cat.x+11.5,cat.y+30);
  ctx.scale(cat.face*(1+landing-stretch),1-landing+stretch);
  ctx.translate(0,-bounce);ctx.lineCap='round';ctx.lineJoin='round';
  // A soft, curling tail with a cream tip.
  const tail=Math.sin(time*(walking?8:3))*(walking?2:1.2);
  ctx.beginPath();ctx.moveTo(-6,-7);ctx.bezierCurveTo(-17,-5,-19,-15+tail,-14,-17+tail);
  ctx.strokeStyle='#8e6248';ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle='#dfa36e';ctx.lineWidth=3.4;ctx.stroke();
  line(ctx,[[-15.7,-15.5+tail],[-14,-17+tail]],'#fff0d1',3);
  // Pear-shaped body and tucked, alternating paws.
  oval(ctx,0,-7.5,7.8,8,'#dba071');ctx.strokeStyle='#967151';ctx.lineWidth=.8;ctx.stroke();
  oval(ctx,1,-6,4.7,5.7,'#fff0d7');
  const step=walking?cycle*1.1:0;
  oval(ctx,-4.6,-1.6+step,3.5,2.2,'#f8e6c7');
  oval(ctx,4.6,-1.6-step,3.5,2.2,'#f8e6c7');
  // Broad cheeks and short rounded ears replace the upright box silhouette.
  ctx.fillStyle='#e6ae78';ctx.beginPath();
  ctx.moveTo(-10,-21);ctx.quadraticCurveTo(-11,-32,-7.5,-30);
  ctx.lineTo(-3.7,-26);ctx.quadraticCurveTo(0,-27.3,4,-26);
  ctx.quadraticCurveTo(10,-33,10.3,-28);ctx.lineTo(10,-21);
  ctx.bezierCurveTo(15,-12,7,-10,0,-10);ctx.bezierCurveTo(-9,-10,-14,-13,-10,-21);
  ctx.closePath();ctx.fill();ctx.strokeStyle='#967151';ctx.lineWidth=.85;ctx.stroke();
  ctx.fillStyle='#d78e83';ctx.beginPath();ctx.moveTo(-8.2,-27.9);ctx.lineTo(-7.9,-23.8);ctx.lineTo(-5.1,-25);ctx.fill();
  ctx.beginPath();ctx.moveTo(8.5,-28);ctx.lineTo(5.7,-25);ctx.lineTo(8.5,-23.9);ctx.fill();
  // Cream muzzle, subtle tabby forehead and rosy cheeks.
  oval(ctx,0,-14.7,8.5,4.5,'#fff0d7');
  line(ctx,[[-2,-25],[-1.4,-22.8]],'#bf8259',1.1);
  line(ctx,[[1.8,-25],[1.2,-22.8]],'#bf8259',1.1);
  oval(ctx,-8,-17,2,1,'#e6a294');oval(ctx,8,-17,2,1,'#e6a294');
  const blink=time%4.6>4.44,look=walking?.6:.2;
  for(const ex of [-4.6,4.6]){
    if(blink)line(ctx,[[ex-1.3,-19],[ex,-18.5],[ex+1.3,-19]],'#574b3e',.9);
    else{
      oval(ctx,ex+look,-19,1.75,2.15,'#51483b');
      oval(ctx,ex+look-.55,-19.8,.6,.7,'#fffae9');
    }
  }
  ctx.fillStyle='#bd827c';ctx.beginPath();ctx.moveTo(-1.4,-16);ctx.quadraticCurveTo(0,-16.8,1.4,-16);ctx.lineTo(0,-14.8);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#977057';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,-14.8);ctx.quadraticCurveTo(-1,-13.2,-2.2,-14);ctx.moveTo(0,-14.8);ctx.quadraticCurveTo(1,-13.2,2.2,-14);ctx.stroke();
  line(ctx,[[-8.4,-14.8],[-12.3,-15.4]],'#b18b68',.55);
  line(ctx,[[8.4,-14.8],[12.3,-15.4]],'#b18b68',.55);
  ctx.restore();
}
function draw(){
  ctx.setTransform(camera.pixelWidth/camera.w,0,0,camera.pixelHeight/camera.h,0,0);
  ctx.clearRect(0,0,camera.w,camera.h);
  ctx.save();ctx.translate(-camera.x,-camera.y);
  ctx.drawImage(background,0,0);
  if(shake)ctx.translate(Math.sin(time*90)*shake,Math.cos(time*70)*shake*.5);
  // Tiny drifting pollen is decorative; collision surfaces stay perfectly stable.
  for(let i=0;i<18;i++)oval(ctx,(i*83+time*5)%W,90+(i*41)%340+Math.sin(time+i)*6,1.3,1.3,'#f7edcb');
  if(level.wind){
    ctx.globalAlpha=.5;const direction=Math.sign(level.wind);
    for(let i=0;i<18;i++){
      const x=330+((i*71+direction*time*32)%380+380)%380,y=215+(i%5)*50;
      line(ctx,[[x,y],[x+direction*20,y],[x+direction*15,y-3]],'#e5f3f3',1.4);
    }ctx.globalAlpha=1;
    ctx.fillStyle='#47718a';ctx.font='12px sans-serif';ctx.fillText(level.wind>0?'顺风区 →':'← 逆风区',340,300);
  }
  boards.forEach(drawBoard);
  drawLessonSigns();
  for(const [x,y,w] of level.thorns){for(let j=0;j<w;j+=10){ctx.fillStyle='#a76050';ctx.beginPath();ctx.moveTo(x+j,y+14);ctx.quadraticCurveTo(x+j+3,y+3,x+j+7,y);ctx.lineTo(x+j+10,y+14);ctx.fill();line(ctx,[[x+j+3,y+12],[x+j+7,y+3]],'#6b493f');}}
  const end=boards[exitIndex()];
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
function next(){unlockAudio();if(state==='menu')start(continueLevel);else if(state==='pause')pause();else if(state==='clear'){
  loadLevel(levelIndex+1);continueLevel=levelIndex;
  try{localStorage.setItem('tiny-trouble-continue',String(continueLevel));}catch{}
  state='play';$('overlay').hidden=true;canvas.focus({preventScroll:true});
}else if(state==='complete')start(0);}
function showLevels(chapter=worldIndex()){
  if(state==='play')pause();
  selectedWorld=chapter;
  clearInput();
  $('worldTabs').replaceChildren();
  WORLDS.forEach((item,i)=>{
    const tab=document.createElement('button');tab.textContent=(i+1)+' '+item.name;
    tab.setAttribute('aria-pressed',String(i===selectedWorld));tab.onclick=()=>showLevels(i);$('worldTabs').appendChild(tab);
  });
  $('levelGrid').replaceChildren();
  LEVELS.forEach((item,i)=>{
    if(worldIndex(i)!==selectedWorld)return;
    const button=document.createElement('button');
    button.className='level-choice'+(cleared[i]?' done':'');
    button.disabled=!isLevelUnlocked(i);
    const title=document.createElement('span'),status=document.createElement('small');
    title.textContent=(selectedWorld+1)+'-'+(i%8+1)+' '+item.name;
    status.textContent=!isLevelUnlocked(i)?'未解锁':cleared[i]?'✓ 已走过':'可以出发';
    button.appendChild(title);button.appendChild(status);
    button.onclick=()=>{if(isLevelUnlocked(i))start(i);};
    $('levelGrid').appendChild(button);
  });
  $('selectPanel').hidden=false;$('closeLevels').focus({preventScroll:true});
}
function down(code,repeat=false){
  if(!$('selectPanel').hidden){if(code==='Escape'&&!repeat)$('selectPanel').hidden=true;return;}
  if(['Space','ArrowUp','KeyW'].includes(code)&&!repeat){
    if(state==='menu'){next();return;}if(state==='play'){buffer=.12;jumpHeld=true;unlockAudio();}
  }
  if(code==='Escape'&&!repeat){if(!$('selectPanel').hidden)$('selectPanel').hidden=true;else pause();}
  if(code==='KeyR'&&!repeat&&state==='play')die('重新出发。');
  keys.add(code);
}
function up(code){keys.delete(code);if(['Space','ArrowUp','KeyW'].includes(code))jumpHeld=false;}
window.addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&(e.code==='Space'||e.code==='Enter'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();down(e.code,e.repeat);});
window.addEventListener('keyup',e=>up(e.code));
window.addEventListener('blur',()=>{clearInput();if(state==='play')pause();});
window.addEventListener('orientationchange',()=>{clearInput();if(state==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});
$('primary').onclick=next;$('secondary').onclick=()=>start(0);$('pause').onclick=()=>{if(!$('selectPanel').hidden)$('selectPanel').hidden=true;else pause();};
$('levels').onclick=()=>showLevels();
$('closeLevels').onclick=()=>{$('selectPanel').hidden=true;$('levels').focus({preventScroll:true});};
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
window.addEventListener('resize',resizeView);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeView).observe(canvas);
function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;accumulator+=dt;while(accumulator>=STEP){update(STEP);accumulator-=STEP;}if(state==='play'||camera.snap)updateCamera(dt);draw();requestAnimationFrame(loop);}
resizeView();
loadLevel(continueLevel);updateSound();$('primary').textContent=continueLevel?'继续 '+(worldIndex()+1)+'-'+(levelIndex%8+1)+' →':'出发吧 →';$('secondary').hidden=!continueLevel;requestAnimationFrame(loop);
