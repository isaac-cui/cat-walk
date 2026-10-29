// Run the real game logic with a minimal DOM, without replacing its physics.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const pen=new Proxy({}, {get:()=>()=>{}});
const elements=new Map(),handlers=new Map(),windowHandlers=new Map();
let elementSequence=0;
function element(id){if(!elements.has(id))elements.set(id,{hidden:id==='selectPanel',textContent:'',style:{},children:[],appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]},classList:{add(){},remove(){}},setAttribute(){},focus(){},getContext:()=>pen,addEventListener(type,fn){handlers.set(id+':'+type,fn)}});return elements.get(id);}
const controls=['ArrowLeft','ArrowRight','Space'].map(key=>Object.assign(element('control-'+key),{dataset:{key},setPointerCapture(){throw new Error('Capture unavailable')}}));
let selectionCleared=false;
const context=vm.createContext({document:{getElementById:element,createElement:type=>element(type+(++elementSequence)),querySelectorAll:()=>controls,addEventListener(){}},window:{addEventListener(type,fn){windowHandlers.set(type,fn)},getSelection:()=>({rangeCount:1,removeAllRanges(){selectionCleared=true}})},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math,console});
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
  const nextIndex=testTargets[index]??level.routeNext[index];
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
  assert.ok(run('W')>1900,'Level must be physically longer, not just renamed');
  assert.ok(run('solve(0)'),'No continuous route in long level '+(i+1));
  assert.equal(run('state'),i===8?'complete':'clear');
  assert.ok(run('cat.x>W-120'),'Only the final end of the long map can finish');
  console.log('Long level '+(i+1)+': '+run('level.width')+' px, '+run('level.route.length')+' main platforms');
  const checks=JSON.parse(run('JSON.stringify(level.checks)'));
  for(const index of checks){
    run(`start(${i});checkpoint=${index};spawn()`);
    assert.ok(run('solve(checkpoint)'),'No checkpoint route: '+i+'/'+index);
  }
}
run('available=new Set([0,3,6]);cleared={};start(0);showLevels()');
assert.equal(run("$('levelGrid').children.length"),3);
assert.equal(run("$('levelGrid').children[1].disabled"),true);
run("$('levelGrid').children[1].onclick()");
assert.equal(run('levelIndex'),0);
run('finish()');assert.equal(run('isLevelUnlocked(1)'),true);
assert.equal(run('isLevelUnlocked(4)'),false);
run('start(2);elapsed=40;finish();next()');assert.equal(run('levelIndex'),3);assert.equal(run('elapsed'),40);
run('start(5);finish();next()');assert.equal(run('levelIndex'),6);
const migration=run('migrateProgress(7,{8:true,9:true,10:true,16:true},17)');
assert.ok(migration.available.includes(0)&&migration.available.includes(1)&&migration.available.includes(2));
assert.equal(migration.cleared[3],true);assert.equal(migration.continueLevel,6);
assert.ok(!migration.available.includes(7),'Partial first section does not unlock a later long level');
assert.ok(run('migrateProgress(0,{18:true},19).available.includes(7)'),'Old later-stage access is retained');
assert.equal(run('migrateProgress(0,{},0).cleared[0]'),undefined,'Do not invent completion');
assert.equal(run('clampLevel(999)'),8);
run('start(4);checkpoint=boards.findIndex(b=>b.spring);spawn();buffer=.12;jumpHeld=true;update(STEP)');
assert.ok(run('cat.vy')<-680,'Spring boost remains valid after offset');
run('start(6);checkpoint=boards.findIndex(b=>b.ice);spawn();cat.vx=200;update(STEP)');
assert.ok(run('cat.vx')>195);run("keys.add('ArrowLeft');for(let i=0;i<40;i++)update(STEP)");
assert.ok(run('cat.vx')<0,'Ice brakes');
run('start(7);checkpoint=boards.findIndex(b=>b.belt>0);spawn();const beltX=cat.x;update(STEP)');
assert.ok(run('cat.x>beltX'));
run('cat.ground=false;cat.vx=0;cat.y-=100;const airborneX=cat.x;update(STEP)');
assert.equal(run('cat.x===airborneX'),true);
run('start(3);cat.x=level.winds[1].from+20;cat.y=300;cat.ground=false;cat.vx=0;const windX=cat.x;update(STEP)');
assert.ok(run('cat.x>windX'),'Wind follows relocated zones');
run('start(0);cat.x=620;cat.y=355;cat.vx=0;cat.vy=0;cat.ground=true;for(let i=0;i<210;i++)update(STEP)');
assert.equal(run('deaths'),0);assert.equal(run('cat.y+cat.h'),475);
assert.ok(run('solve(level.rescue)'),'Rescue path must lead to the long-level exit');
run('start(0);checkpoint=level.checks[2];spawn();const checkpointX=cat.x;die();for(let i=0;i<60;i++)update(STEP)');
assert.equal(run('cat.x'),run('checkpointX'),'Death returns to latest internal lamp');
run('pause()');const frozen=run('cat.x');run("keys.add('ArrowRight');update(1)");
assert.equal(run('cat.x'),frozen);run('pause()');
run(`
start(0);
const rightButton={dataset:{key:'ArrowRight'},setAttribute(){}};
const jumpButton={dataset:{key:'Space'},setAttribute(){}};
touchDown(rightButton,1);touchDown(jumpButton,2);update(STEP);
`);
assert.ok(run('cat.vx>0&&cat.vy<0'));run('touchUp(2)');
assert.equal(run("keys.has('ArrowRight')"),true);run('touchUp(1)');
assert.equal(run("keys.has('ArrowRight')"),false);
for(const [width,height] of [[1140,641],[844,300],[350,263]]){
  run(`canvas.getBoundingClientRect=()=>({width:${width},height:${height}});resizeView();start(4)`);
  for(const index of JSON.parse(run('JSON.stringify(level.route)'))){
    run(`checkpoint=${index};spawn();for(let i=0;i<30;i++)updateCamera(STEP)`);
    assert.ok(run('camera.x>=0&&camera.x+camera.w<=W+.01'));
    assert.ok(run('cat.x>=camera.x&&cat.x+cat.w<=camera.x+camera.w'));
    run('cat.ground=false;cat.y-=200;updateCamera(STEP)');
    assert.ok(run('cat.y>=camera.y'),'High jump remains visible');
  }
}
for(let i=0;i<9;i++)run(`start(${i});draw()`);
run('start(0)');
let nativePrevented=false;
const finger={pointerId:55,pointerType:'touch',button:0,cancelable:true,preventDefault(){nativePrevented=true;}};
handlers.get('control-ArrowRight:pointerdown')(finger);
assert.equal(nativePrevented,true);assert.equal(selectionCleared,true);
assert.equal(run("keys.has('ArrowRight')"),true,'Capture failure must not break input');
windowHandlers.get('pointerup')(finger);
assert.equal(run("keys.has('ArrowRight')"),false,'Release outside button clears input');
for(const key of ['app:selectstart','app:dragstart','control-ArrowRight:touchstart','control-ArrowRight:touchmove','control-ArrowRight:contextmenu']){
  nativePrevented=false;handlers.get(key)(finger);assert.equal(nativePrevented,true,key+' cancels native gesture');
}
const stored={};context.localStorage.setItem=(key,value)=>{stored[key]=value;};
run('available=new Set([0,1,3,6]);cleared={0:true};continueLevel=1;save()');
assert.equal(JSON.parse(stored['tiny-trouble-long-v1']).continueLevel,1);
assert.ok(!('tiny-trouble-cleared' in stored),'Legacy progress must not be overwritten');
console.log('PASS: 9 long routes, every lamp, relocated mechanics, migration, chapters, touch, long camera');

