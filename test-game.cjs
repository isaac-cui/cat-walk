// Run the real game logic with a minimal DOM, without replacing its physics.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const pen=new Proxy({}, {get:()=>()=>{}});
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',classList:{add(){},remove(){}},setAttribute(){},focus(){},getContext:()=>pen,addEventListener(){}});return elements.get(id);}
const context=vm.createContext({document:{getElementById:element,createElement:()=>element('background'),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math,console});
vm.runInContext(fs.readFileSync('game.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
// Find an actual continuous route using walking and held jumps, no teleporting.
run(`
function snapshot(){return JSON.stringify({cat,boards,fish,checkpoint,time,state,deathDelay,deaths,elapsed,collectedTotal});}
function restore(text){const s=JSON.parse(text);Object.assign(cat,s.cat);boards=s.boards;fish=s.fish;checkpoint=s.checkpoint;time=s.time;state=s.state;deathDelay=s.deathDelay;deaths=s.deaths;elapsed=s.elapsed;collectedTotal=s.collectedTotal;keys.clear();buffer=0;coyote=.1;jumpHeld=false;}
function solve(index,route=[]){
  if(index===exitIndex()){
    keys.add('ArrowRight');
    for(let n=0;n<90&&state==='play';n++)update(STEP);
    return state==='clear'||state==='complete'?route:null;
  }
  const nextIndex=index===level.rescue?4:index+1;
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
for(let i=0;i<3;i++){
  run(`start(${i})`);
  const route=run('solve(0)');
  assert.ok(route,'No playable route through level '+(i+1));
  assert.ok(['clear','complete'].includes(run('state')),'Exit must trigger completion');
  console.log('Level '+(i+1)+' continuous route: '+route.join(' → '));
}
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
run('draw()');console.log('PASS: routes, checkpoint, pause, variable jump, multitouch, bridge rescue and lesson budget');
