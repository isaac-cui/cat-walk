// Run the real game logic with a minimal DOM, without replacing its physics.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const pen=new Proxy({}, {get:()=>()=>{}});
const elements=new Map();
let elementSequence=0;
function element(id){if(!elements.has(id))elements.set(id,{hidden:id==='selectPanel',textContent:'',children:[],appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]},classList:{add(){},remove(){}},setAttribute(){},focus(){},getContext:()=>pen,addEventListener(){}});return elements.get(id);}
const context=vm.createContext({document:{getElementById:element,createElement:type=>element(type+(++elementSequence)),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math,console});
vm.runInContext(fs.readFileSync('game.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
// Find an actual continuous route using walking and held jumps, no teleporting.
run(`
function snapshot(){return JSON.stringify({cat,boards,fish,checkpoint,time,state,deathDelay,deaths,elapsed,collectedTotal});}
let testTargets={};
function restore(text){const s=JSON.parse(text);Object.assign(cat,s.cat);boards=s.boards;fish=s.fish;checkpoint=s.checkpoint;time=s.time;state=s.state;deathDelay=s.deathDelay;deaths=s.deaths;elapsed=s.elapsed;collectedTotal=s.collectedTotal;keys.clear();buffer=0;coyote=.1;jumpHeld=false;}
function solve(index,route=[]){
  const saved=snapshot();
  for(const wait of [0,30,60,90,120,180,240]){
    restore(saved);
    if(wait&&boards[index].fragile)break;
    for(let n=0;n<wait&&!deathDelay;n++)update(STEP);
    if(deathDelay)continue;
    const result=solveAttempt(index,route);if(result)return result;
  }
  restore(saved);return null;
}
function solveAttempt(index,route=[]){
  if(index===exitIndex()){
    keys.add('ArrowRight');
    for(let n=0;n<90&&state==='play';n++)update(STEP);
    return state==='clear'||state==='complete'?route:null;
  }
  const nextIndex=testTargets[index]??(index===level.rescue?4:index+1);
  const saved=snapshot(),b=boards[index],target=boards[nextIndex];
  // Launch positions cover early jumps over thorns and late jumps across gaps.
  for(let launch=Math.max(b.x+5,cat.x);launch<=b.x+b.w-12;launch+=8){
    restore(saved);let failed=false;
    keys.add('ArrowRight');
    for(let n=0;cat.x<launch&&n<150;n++){update(STEP);if(deathDelay>0||!cat.ground){failed=true;break;}}
    if(failed)continue;
    buffer=.12;jumpHeld=true;let airborne=false;
    for(let n=0;n<160;n++){
      if(cat.x>target.x+target.w-48)keys.delete('ArrowRight');
      update(STEP);if(deathDelay>0)break;
      if(!cat.ground)airborne=true;
      if(state==='clear'||state==='complete')return [...route,Math.round(launch)];
      if(airborne&&cat.ground){
        if(Math.abs(cat.y+cat.h-target.y)<.1&&cat.x>=target.x-15){
          const result=solve(nextIndex,[...route,Math.round(launch)]);if(result)return result;
        }break;
      }
    }
  }
  restore(saved);return null;
}
`);
for(let i=0;i<run('LEVELS.length');i++){
  run(`start(${i})`);
  const route=run('solve(0)');
  assert.ok(route,'No playable route through level '+(i+1));
  assert.ok(['clear','complete'].includes(run('state')),'Exit must trigger completion');
  assert.equal(run('state'),i===run('LEVELS.length-1')?'complete':'clear','Only final level completes campaign');
  console.log('Level '+(i+1)+' continuous route: '+route.join(' → '));
  run(`start(${i});checkpoint=level.check;spawn()`);
  assert.ok(run('solve(level.check)'),'Checkpoint must still have a route in level '+(i+1));
}
run('start(4);checkpoint=level.check;spawn();testTargets={2:6,6:3}');
assert.ok(run('solve(level.check)'),'Optional high route must return to exit');
assert.equal(run('fish[1].got'),true,'High route must make bonus fish reachable');
run('testTargets={};cleared={};unlocked=1;start(0);showLevels()');
assert.equal(run('state'),'pause');
assert.equal(run("$('levelGrid').children.length"),8);
assert.equal(run("$('levelGrid').children[2].disabled"),true);
run("$('levelGrid').children[2].onclick()");
assert.equal(run('levelIndex'),0,'Locked level cannot be started');
run("$('levelGrid').children[1].onclick()");
assert.equal(run('levelIndex'),1);assert.equal(run('state'),'play');
assert.equal(run("$('selectPanel').hidden"),true);
assert.equal(run('clampLevel(2)'),2,'Old unlock is preserved');
assert.equal(run('clampLevel(999)'),23);assert.equal(run("clampLevel('broken')"),0);
assert.equal(run('isLevelUnlocked(8)'),true,'Harbor intro open');
assert.equal(run('isLevelUnlocked(16)'),true,'Rooftop intro open');
assert.equal(run('isLevelUnlocked(9)'),false,'Harbor progresses independently');
run('showLevels(1)');
assert.equal(run("$('worldTabs').children.length"),3);
assert.equal(run("$('levelGrid').children.length"),8);
run("$('levelGrid').children[0].onclick()");
assert.equal(run('levelIndex'),8);
run('finish()');assert.equal(run('isLevelUnlocked(9)'),true);
assert.equal(run('isLevelUnlocked(17)'),false,'Harbor completion does not unlock rooftop stage 2');
run('start(7);elapsed=40;finish();next()');
assert.equal(run('levelIndex'),8,'Forest ending enters harbor');
assert.equal(run('elapsed'),40,'Chapter transition preserves run timer');
run('start(15);finish();next()');
assert.equal(run('levelIndex'),16,'Harbor ending enters rooftops');
assert.equal(run('state'),'play');
run('start(12);checkpoint=2;spawn();buffer=.12;jumpHeld=true;update(STEP)');
assert.ok(run('cat.vy')<-680,'Spring boosts the normal jump');
run('start(12);checkpoint=2;spawn();buffer=.12;jumpHeld=true;for(let n=0;n<45;n++)update(STEP)');
assert.ok(run('cat.y+cat.h')<250,'Spring reaches the mandatory high ledge');
run('start(16);cat.x=250;cat.y=390;cat.support=1;cat.ground=true;cat.vx=200;update(STEP)');
assert.ok(run('cat.vx')>195,'Ice retains momentum');
run("keys.add('ArrowLeft');for(let n=0;n<40;n++)update(STEP)");
assert.ok(run('cat.vx')<0,'Opposite direction brakes on ice');
run('start(19);cat.x=250;cat.y=390;cat.support=1;cat.ground=true;cat.vx=0;update(STEP)');
assert.ok(run('cat.x')>250,'Conveyor carries a stationary grounded cat');
run('start(19);cat.x=250;cat.y=300;cat.support=1;cat.ground=false;cat.vx=0;update(STEP)');
assert.equal(run('cat.x'),250,'Conveyor cannot move an airborne cat');
run('start(8);cat.x=400;cat.y=300;cat.ground=false;cat.vx=0;update(STEP)');
assert.ok(run('cat.x')>400,'Wind affects airborne motion');
run('start(8);cat.x=400;cat.y=355;cat.support=2;cat.ground=true;cat.vx=0;update(STEP)');
assert.equal(run('cat.x'),400,'Safe grounded platform is not blown by wind');
run('start(0); checkpoint=level.check; spawn(); die();');
assert.equal(run('deaths'),1);
run('for(let i=0;i<60;i++)update(STEP)');
assert.equal(run('cat.x'),400);
assert.equal(run('cat.y'),375);
assert.equal(run('deathDelay'),0);
run('pause();');
const x=run('cat.x');run("keys.add('ArrowRight'); update(1)");
assert.equal(run('cat.x'),x);assert.equal(run('state'),'pause');
run('pause()');assert.equal(run('state'),'play');
run('start(0); buffer=.12; jumpHeld=true; update(STEP)');
assert.ok(run('cat.vy')<0,'Jump should respond immediately');
run('jumpHeld=false; update(STEP)');assert.ok(run('cat.vy')>-211,'Short jump cut');
run(`
start(0);
const rightButton={dataset:{key:'ArrowRight'},setAttribute(){}};
const jumpButton={dataset:{key:'Space'},setAttribute(){}};
touchDown(rightButton,1);touchDown(jumpButton,2);update(STEP);
`);
assert.ok(run('cat.vx')>0&&run('cat.vy')<0,'Two-finger movement and jump');
run('touchUp(2)');
assert.equal(run("keys.has('ArrowRight')"),true,'Releasing jump must not release movement');
assert.equal(run('jumpHeld'),false);
run('touchDown(rightButton,3);touchUp(1)');
assert.equal(run("keys.has('ArrowRight')"),true,'Second finger still holds direction');
run('touchUp(3);touchUp(3)');
assert.equal(run("keys.has('ArrowRight')"),false,'Cancellation is idempotent');
run('touchDown(jumpButton,4);pause()');
assert.equal(run('touchPointers.size'),0);assert.equal(run('jumpHeld'),false);
// First encounter: let the bridge collapse. The lower path must catch the cat.
run('start(0); checkpoint=level.check; cat.x=620;cat.y=355;cat.vx=0;cat.vy=0;cat.ground=true; for(let i=0;i<210;i++)update(STEP);');
assert.equal(run('deaths'),0,'The first bridge mistake should be recoverable');
assert.equal(run('cat.y+cat.h'),475,'Lower path catches the cat');
assert.equal(run("lessonSeen.has('rescue')"),true);
assert.ok(run('solve(level.rescue)'),'Recovery path must reach the exit');
run('start(0)');
assert.equal(run('level.thorns.length'),0);
assert.equal(run('level.fragile.length'),1);
assert.equal(run('fish.length'),1);
assert.ok(run('level.check < level.fragile[0]'),'Save before teaching bridge');
assert.equal(run('level.saw'),null);
for(const [width,height] of [[1140,641],[844,300],[350,263]]){
  run(`canvas.getBoundingClientRect=()=>({width:${width},height:${height}});resizeView();start(0);`);
  assert.ok(run('camera.w')<960,'Camera must show a closer view');
  for(const [x,y] of [[25,420],[415,375],[620,355],[640,445],[900,335]]){
    run(`cat.x=${x};cat.y=${y};cat.ground=true;cat.vx=0;for(let i=0;i<90;i++)updateCamera(STEP)`);
    assert.ok(run('camera.x>=0 && camera.x+camera.w<=W+.01'),'Horizontal world bounds');
    assert.ok(run('cat.x>=camera.x && cat.x+cat.w<=camera.x+camera.w'),'Cat stays in view');
    assert.ok(run('cat.y>=camera.y && cat.y+cat.h<=camera.y+camera.h'),'Feet stay in view');
    run('cat.ground=false;cat.y-=116;updateCamera(STEP)');
    assert.ok(run('cat.y>=camera.y'),'Jump apex stays visible');
  }
  run('checkpoint=level.check;spawn()');
  assert.ok(run('cat.x>=camera.x && cat.x+cat.w<=camera.x+camera.w'),'Respawn resets camera');
}
for(let i=0;i<24;i++)run(`start(${i});draw()`);
console.log('PASS: 24 routes + checkpoints, chapter unlock/transition, wind, spring, ice, belts, touch, camera, rendering');
