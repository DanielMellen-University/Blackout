import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/recovery-10.948/handling',device=process.env.RECOVERY_DEVICE||'keyboard',seed=Number(process.env.RECOVERY_SEED||45671)
await mkdir(dir,{recursive:true})
const adapter=await readFile('scripts/browser-mapped-input.js','utf8')
let pilot=(await readFile('scripts/browser-training-review.js','utf8')).replace('c=aircraft.controls','c={...aircraft.controls}').replace('if(gear&&!c.gearDown)aircraft.toggleGear()','').replace('(-aimAlong-450)','(-aimAlong-80)').replace('const look=220','const look=220').replace('speed=62','speed=42').replace('aircraft.altitudeAgl<8','aircraft.altitudeAgl<3').replace('world.runway.position.y+1.4-p.y','world.runway.position.y+.9-p.y')
pilot=pilot.replace('c.gearDown=gear;c.stabilityAssist=true',`c.gearDown=gear;c.stabilityAssist=true;
 training.touched ||= aircraft.status==='landed'||aircraft.onGround; if(training.touched){training.stage='rollout';c.pitch=0;c.roll=0;c.yaw=trainClamp(Math.atan2(Math.sin(spawn.yaw-pose.heading),Math.cos(spawn.yaw-pose.heading))*2,-1,1);c.throttle=0;c.boost=false;c.airbrake=true;c.gearDown=true}
 driveMapped(c,dt)`)
pilot=pilot.replace(' driveMapped(c,dt)', ` driveMapped(c,dt);
 if(training.seconds>=(training.traceAt||0)){training.traceAt=training.seconds+.05;(training.trace||=[]).push({seconds:training.seconds,position:aircraft.position.toArray(),onGround:aircraft.onGround,speed:aircraft.speed,agl:aircraft.altitudeAgl,status:aircraft.status,controls:{...aircraft.controls}})}`)
const setup=`window.__handlingTrace=()=>training.trace||[];window.__setupHandling=()=>{const spawn=world.spawn,fx=Math.sin(spawn.yaw),fz=Math.cos(spawn.yaw),along=-250,x=spawn.x+fx*along,z=spawn.z+fz*along;const y=Math.max(world.runway.position.y+28,handlingSurface(x,z)+12);aircraft.reset({x,y,z,yaw:spawn.yaw});aircraft.velocity.set(fx*40,-2,fz*40);aircraft.snapDisplay();aircraft.capturePrevious();wasAirborne=true;training.active=true;training.stage='approach';training.waypoint=1;training.seconds=0};window.__handling=()=>({seed:world.worldSeed,...window.__training.state(),engine:{...aircraft.engineState},fuel:{...aircraft.fuel},source:input.inputSource,impact:aircraft.impact?{position:aircraft.impact.position.toArray(),verticalVelocity:aircraft.impact.verticalVelocity,tangentialSpeed:aircraft.impact.tangentialSpeed,gearDown:aircraft.impact.gearDown}:null,storage:{...localStorage}});`
const hook=pilot+'\n'+adapter+'\n'+setup
await writeFile(dir+'/hook.js',hook)
const sourceHashes=Object.fromEntries(await Promise.all(['src/aircraft/FlightModel.ts','src/aircraft/flightConfig.ts','src/systems/Collision.ts','src/world/terrainSample.ts','src/core/InputManager.ts','src/main.ts'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const samples=[],errors=[],pictures=[]
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(120000)
 page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(device=>{window.__mappedDevice=device;window.__virtualPad={id:'Standard handling review',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,touched:false,value:0}))};if(device==='gamepad')Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__virtualPad]});localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}},device)
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;').replace('const tick = (nowMs) => {',hook+'\nconst tick = (nowMs) => {').replace('aircraft.controls = input.sampleWithDt(dt);','window.__training.before(dt);\naircraft.controls = input.sampleWithDt(dt);');await route.fulfill({response,body:'import { sampleTerrainSurfaceHeightFast as handlingSurface } from "/src/world/terrainSample.ts";\n'+body})})
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+`/?course=free-flight&seed=${seed}`);await page.waitForFunction(()=>window.__setupHandling);await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await page.evaluate(()=>window.__setupHandling())
 let last='',done=false
 for(let i=0;i<160;i++){
  await page.waitForTimeout(700);const state=await page.evaluate(()=>window.__handling());samples.push(state)
  const stage=state.onGround?state.speed<.05?'stopped':'rollout':state.agl<8?'flare':'approach'
  if(stage!==last){await page.screenshot({path:`${dir}/${stage}-chase.png`});pictures.push(`${stage}-chase.png`);if(!state.onGround){await page.evaluate(()=>window.__training.camera('cockpit'));await page.waitForTimeout(250);await page.screenshot({path:`${dir}/${stage}-cockpit.png`});pictures.push(`${stage}-cockpit.png`);await page.evaluate(()=>window.__training.camera('chase'))}last=stage}
  if(i%10===0)console.log(device,state.seconds.toFixed(1),stage,state.status,Math.round(state.agl),state.speed.toFixed(1))
  await writeFile(dir+'/run.json',JSON.stringify({method:'One airborne setup at the generated airfield, then keyboard events or virtual standard gamepad through production InputManager. Unchanged physics, collision, contact and wheel braking. No pose or velocity writes after setup. Free flight permits actual rollout after touchdown.',seed,device,sourceHashes,errors,pictures,samples,final:state},null,2)+'\n')
  if(state.status==='crashed')throw Error('Handling review crashed')
  if(stage==='stopped'){done=true;break}
 }
 assert.ok(done,'Rollout did not stop');assert.deepEqual(errors,[]);assert.ok(samples.some(s=>s.agl<8&&!s.onGround));const trace=await page.evaluate(()=>window.__handlingTrace());await writeFile(dir+'/trace.json',JSON.stringify(trace,null,2)+'\n');assert.ok(trace.some(s=>s.onGround&&s.speed>10));assert.ok(samples.at(-1).onGround)
 await writeFile(dir+'/input-events.json',JSON.stringify(await page.evaluate(()=>window.__mappedEvents()),null,2)+'\n')
}finally{await browser.close()}
