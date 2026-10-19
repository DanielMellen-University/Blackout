import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/recovery-10.948/before-keyboard'
const device=process.env.RECOVERY_DEVICE||'keyboard',scenario=process.env.RECOVERY_SCENARIO||'crash',after=process.env.RECOVERY_AFTER==='1'
await mkdir(dir,{recursive:true})
const adapter=await readFile('scripts/browser-mapped-input.js','utf8')
let pilot=(await readFile('scripts/browser-training-review.js','utf8')).replace('c=aircraft.controls','c={...aircraft.controls}').replace('if(gear&&!c.gearDown)aircraft.toggleGear()','')
pilot=pilot.replace('aircraft.altitudeAgl<8','aircraft.altitudeAgl<3').replace('world.runway.position.y+1.4-p.y','world.runway.position.y+.9-p.y')
pilot=pilot.replace('const padY=world.runway.position.y', "if(!training.missed)training.waypoint=1; const padY=world.runway.position.y")
pilot=pilot.replace('const look=220', 'const look=220').replace(')),-.2,.38)', ')),-.4,.38)').replace('speed=62','speed=45').replace('(-aimAlong-450)', '(-aimAlong-80)')
pilot=pilot.replace('  training.target=target',`  const along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz;
  if(window.__scenario==='go-around'&&training.stage==='approach'&&!training.missed&&aircraft.altitudeAgl>85&&along>-780&&along<-400){training.missed=true;training.climbUntil=training.seconds+15;training.waypoint=0;training.events.push({kind:'go-around',seconds:training.seconds,position:p.toArray()})}
  if(training.seconds<training.climbUntil){training.stage='go-around';gear=false;speed=135;target={x:p.x+fx*1000,y:spawn.y+300,z:p.z+fz*1000}}
  if(window.__scenario==='engine-out'&&training.stage==='approach'&&!training.cut&&along>-1800&&along<-400){aircraft.fuel.remaining=0;training.cut=true;training.events.push({kind:'fuel-out-fixture',seconds:training.seconds,position:p.toArray()})}
  if(training.stage==='return'){
   const dx=target.x-p.x,dz=target.z-p.z,length=Math.max(1,Math.hypot(dx,dz));
   target.y=Math.max(target.y,spawn.y+350);
   for(const d of [0,300,600,1000])target.y=Math.max(target.y,recoverySurface(p.x+dx/length*d,p.z+dz/length*d)+160)
  }
  training.target=target`)
pilot=pilot.replace('c.gearDown=gear;c.stabilityAssist=true',`c.gearDown=gear;c.stabilityAssist=true;
  if(window.__scenario==='crash'&&training.seconds>12){c.pitch=-1;c.throttle=0;c.gearDown=false;c.airbrake=false}
  if(training.cut){c.throttle=0;c.airbrake=false}
  driveMapped(c,dt)`)
const observer=`window.__recovery=()=>({active:activeSortie,seed:world.worldSeed,selected:selectedCourseId,seconds:training.seconds,phase:challenge.phase,result:challenge.result,crash:crashCinematic.active,resultsOpen:results.open,report:document.querySelector('#run-results').innerText,playing,paused:menu.paused,fuel:{...aircraft.fuel},engine:{...aircraft.engineState},onGround:aircraft.onGround,speed:aircraft.speed,position:aircraft.position.toArray(),spawn:{...world.spawn},next:world.mission.next,controls:{...aircraft.controls},source:input.inputSource,briefing:hudFrame.controlHint,navTarget:hudFrame.navTarget,navGlide:hudFrame.navGlide,events:training.events,storage:{...localStorage}});window.__stopPilot=()=>{training.active=false;for(const code of [...mapped.held])mappedKey(code,false);for(const b of window.__virtualPad.buttons){b.pressed=false;b.value=0}window.__virtualPad.axes.fill(0)};`
const hook=pilot+'\n'+adapter+'\n'+observer
await writeFile(dir+'/hook.js',hook)
const sources=['src/main.ts','src/core/InputManager.ts','src/core/FlightBriefing.ts','src/ui/RunResults.ts','src/aircraft/FlightModel.ts','src/world/terrainSample.ts']
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const samples=[],pictures=[],errors=[]
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(120000)
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
 await page.addInitScript(({device,scenario})=>{window.__mappedDevice=device;window.__scenario=scenario;window.__virtualPad={id:'Standard recovery review',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,touched:false,value:0}))};if(device==='gamepad')Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__virtualPad]});localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}},{device,scenario})
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();let body=await response.text();assert.ok(body.includes('aircraft.controls = input.sampleWithDt(dt);'));body=body.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;').replace('const tick = (nowMs) => {',hook+'\nconst tick = (nowMs) => {').replace('aircraft.controls = input.sampleWithDt(dt);','window.__training.before(dt);\naircraft.controls = input.sampleWithDt(dt);');await route.fulfill({response,body:'import { sampleTerrainSurfaceHeightFast as recoverySurface } from \"/src/world/terrainSample.ts\";\n'+body})})
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+`/?course=contour-circuit&seed=${process.env.RECOVERY_SEED||982451}`);await page.waitForFunction(()=>window.__recovery);await page.locator('#startup-screen').waitFor({state:'hidden'});await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await page.evaluate(()=>window.__training.start())
 let stage='',gate=-1,hadCrash=false,done=false
 for(let i=0;i<260;i++){
  await page.waitForTimeout(2000);const state=await page.evaluate(()=>({...window.__training.state(),recovery:window.__recovery()}));samples.push(state)
  if(i%10===0)console.log(scenario,device,state.seconds.toFixed(1),state.stage,state.next,state.status,Math.round(state.agl))
  if(state.stage!==stage||state.next!==gate||state.status==='crashed'&&!hadCrash||state.resultsOpen){const file=`${i}-${state.stage}-${state.next}-${state.status}.png`;await page.screenshot({path:dir+'/'+file});pictures.push(file);stage=state.stage;gate=state.next}
  if(state.status==='crashed'&&!hadCrash){hadCrash=true;await page.evaluate(()=>window.__stopPilot())}
  if(state.stage==='approach'&&state.agl<80&&state.agl>15&&!pictures.includes('approach-cockpit.png')){await page.evaluate(()=>window.__training.camera('cockpit'));await page.waitForTimeout(400);await page.screenshot({path:dir+'/approach-cockpit.png'});pictures.push('approach-cockpit.png');await page.evaluate(()=>window.__training.camera('chase'))}
  await writeFile(dir+'/run.json',JSON.stringify({device,scenario,sourceHashes,method:'DOM launch. Keyboard events or virtual standard gamepad through production InputManager. Real physics, gates, collision and landing. Crash deliberately flown by pitch input. Engine-out scenario uses one fuel remaining=0 fault injection on final, then mapped controls only. No pose, velocity, score or gate writes.',errors,pictures,samples,final:state},null,2)+'\n')
  if(state.resultsOpen){done=true;break}
 }
 assert.ok(done,'No debrief before timeout');assert.deepEqual(errors,[])
 const final=samples.at(-1);await page.evaluate(()=>window.__stopPilot());await page.waitForTimeout(500)
 if(scenario==='crash'&&process.env.RECOVERY_CHOOSE==='1'){
  if(device==='keyboard'){await page.locator('#btn-new-world').focus();await page.keyboard.press('Enter')}
  else {await page.evaluate(()=>{window.__virtualPad.buttons[1].pressed=true;window.__virtualPad.buttons[1].value=1});await page.waitForTimeout(200);await page.evaluate(()=>{window.__virtualPad.buttons[1].pressed=false;window.__virtualPad.buttons[1].value=0})}
  await page.waitForTimeout(2200);const choice=await page.evaluate(()=>({...window.__recovery(),focused:document.activeElement?.id,titleVisible:!document.querySelector('#title-screen').classList.contains('is-hidden')}));await page.screenshot({path:dir+'/choose-mission.png'});await writeFile(dir+'/choice.json',JSON.stringify(choice,null,2)+'\n');if(after){assert.equal(choice.playing,false);assert.equal(choice.titleVisible,true);assert.equal(choice.focused,'btn-play')}
 }else if(scenario==='crash'){
  assert.equal(final.status,'crashed');assert.equal(final.phase,'failed')
  if(device==='keyboard')await page.keyboard.press('Enter')
  else{await page.evaluate(()=>{window.__virtualPad.buttons[0].pressed=true;window.__virtualPad.buttons[0].value=1});await page.waitForTimeout(200);await page.evaluate(()=>{window.__virtualPad.buttons[0].pressed=false;window.__virtualPad.buttons[0].value=0})}
  await page.waitForTimeout(2200);const retry=await page.evaluate(()=>window.__recovery());await page.screenshot({path:dir+'/retry.png'})
  await writeFile(dir+'/retry.json',JSON.stringify(retry,null,2)+'\n')
  if(device==='keyboard'||after){assert.equal(retry.resultsOpen,false);assert.equal(retry.crash,false);assert.equal(retry.next,0);assert.equal(retry.phase,'ready');assert.equal(retry.seed,final.recovery.seed);assert.equal(retry.active.recordId,final.recovery.active.recordId);assert.ok(retry.fuel.fraction>.999);assert.ok(retry.onGround)}
 }else{assert.equal(final.status,'landed');assert.equal(final.phase,'complete');assert.equal(final.next,5);if(scenario==='go-around')assert.ok(final.recovery.events.some(e=>e.kind==='go-around'));if(scenario==='engine-out'){assert.ok(final.recovery.events.some(e=>e.kind==='fuel-out-fixture'));assert.equal(final.recovery.engine.fuelAvailable,false)}}
 await writeFile(dir+'/input-events.json',JSON.stringify(await page.evaluate(()=>window.__mappedEvents()),null,2)+'\n')
}finally{await browser.close()}
