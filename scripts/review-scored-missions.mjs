import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dir = process.argv[2] || 'docs/reviews/missions-10.943'
const courses = (process.env.SCORED_COURSES || 'training-orbit,daily-ops').split(',')
const speeds = (process.env.SCORED_SPEEDS || '75,105,150,165').split(',').map(Number)
await mkdir(dir, { recursive: true })
const pilot = (await readFile('scripts/browser-training-review.js', 'utf8'))
  .replace('let target,speed=150,gear=false', 'let target,speed=window.__reviewSpeed,gear=false')
  .replace("speed=150;gear=", 'speed=window.__reviewSpeed;gear=')
  .replace('spawn.x-fx*2200', "spawn.x-fx*(activeSortie.course.daily?1000:2200)").replace('spawn.z-fz*2200', "spawn.z-fz*(activeSortie.course.daily?1000:2200)")
  .replace('y:gate.y,z:gate.z', 'y:gate.y+(window.__gateOffset||0),z:gate.z')
  .replace('const look=220',"const look=world.mission.routeProfile==='contour'?185+Math.max(0,200-(world.mission.gates.at(-1).pos.y-padY))*.85:220")
  .replace(')),-.2,.38)', ")),training.stage==='approach'&&world.mission.routeProfile==='contour'?-.45:-.2,.38)")
  .replace("training.stage==='approach'&&aircraft.altitudeAgl<8", "training.stage==='approach'&&aircraft.altitudeAgl<(world.mission.routeProfile==='contour'?6:8)")
  .replace('(-aimAlong-450)', "(-aimAlong+(world.mission.routeProfile==='contour'?-180:-450))")
  .replace('  training.target=target', `  if(!gate&&training.holdRemaining>0){
   training.holdRemaining-=dt;training.stage='hold';speed=100;gear=false;
   if(!training.holdCenter)training.holdCenter={x:p.x+Math.cos(pose.heading)*280,z:p.z-Math.sin(pose.heading)*280,y:Math.max(p.y+300,spawn.y+600)};
   const center=training.holdCenter,angle=Math.atan2(p.x-center.x,p.z-center.z)+.65;
   target={x:center.x+Math.sin(angle)*280,y:center.y,z:center.z+Math.cos(angle)*280};
  }
  training.target=target`)
  .replace("const padY=world.runway.position.y", "if(world.mission.routeProfile==='contour')training.waypoint=1; const padY=world.runway.position.y")
const observer = `window.__resetPilot=()=>Object.assign(training,{active:false,seconds:0,stage:'takeoff',gate:-1,events:[],waypoint:0,lastPhase:'',target:null,holdCenter:null,holdRemaining:activeSortie.course.daily?(window.__holdSeconds||0):0});window.__score=()=>({result:challenge.result,elapsed:challenge.elapsedSec,active:activeSortie,summary:world.mission.routeSummary,allowance:world.mission.timeAllowanceSec,storage:{...localStorage},report:document.querySelector('#run-results').innerText,goal:document.querySelector('#title-course-picker .course-picker-goal')?.textContent});`
await writeFile(dir + '/hook.js', pilot + '\n' + observer)
const sourceHashes = Object.fromEntries(await Promise.all(['src/main.ts','src/systems/Mission.ts','src/systems/ChallengeRun.ts','src/ui/RunResults.ts'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex') ])))
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const runs=[],errors=[]
const save=()=>writeFile(dir+'/runs.json',JSON.stringify({sourceHashes,method:'DOM launch and retry. External controls-only pilot, unchanged physics, gate evaluator, clock, scoring and storage. No pose or completion writes.',errors,runs},null,2)+'\n')
try {
 for(const course of courses){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1})
  const page=await context.newPage();page.setDefaultTimeout(120000)
  page.on('pageerror',e=>errors.push(String(e)))
  page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
  await page.addInitScript(options=>{window.__gateOffset=options.offset;window.__holdSeconds=options.hold;localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}},{offset:Number(process.env.SCORED_GATE_OFFSET||0),hold:Number(process.env.SCORED_HOLD_SECONDS||0)})
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();let source=await response.text()
   assert.ok(source.includes('const tick = (nowMs) => {'))
   source=source.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;')
    .replace('const tick = (nowMs) => {',pilot+'\n'+observer+'\nconst tick = (nowMs) => {')
    .replace('aircraft.step(dt, nowMs);','window.__training.before(dt);\naircraft.step(dt, nowMs);')
   await route.fulfill({response,body:source})
  })
  const seedQuery=process.env.SCORED_SEED ? '&seed='+process.env.SCORED_SEED : ''
  await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+'/?course='+course+seedQuery)
  await page.waitForFunction(()=>window.__training);await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.locator(`#title-course-picker [role=radio][data-course-id="${course}"]`).click()
  await page.screenshot({path:`${dir}/${course}-launch.png`})
  for(let index=0;index<speeds.length;index++){
   const speed=speeds[index],label=course+'-'+speed
   await page.evaluate(speed=>{window.__reviewSpeed=speed},speed)
   if(index===0)await page.locator('#btn-play').click()
   else await page.locator('#btn-retry').click()
   await page.locator('#startup-screen').waitFor({state:'hidden'})
   // Reset only the external pilot's counters between normal game retries.
   await page.evaluate(()=>window.__resetPilot?.())
   assert.equal((await page.evaluate(()=>window.__score())).active.course.id,course,'Actual launched mission identity')
   await page.evaluate(()=>window.__training.start())
   const samples=[];let gate=-1,stage='',done=false
   for(let i=0;i<400;i++){
    await page.waitForTimeout(2000)
    const state=await page.evaluate(()=>({...window.__training.state(),score:window.__score()}));samples.push(state)
    if(state.next!==gate||state.stage!==stage||state.resultsOpen||state.status==='crashed'){
     await page.screenshot({path:`${dir}/${label}-${i}-${state.stage}-${state.next}.png`});gate=state.next;stage=state.stage
    }
    if(i%10===0)console.log(label,state.seconds.toFixed(1),state.next,state.stage,state.status)
    if(state.resultsOpen||state.status==='crashed'){
     runs.push({label,speed,samples,final:state});await save();assert.equal(state.phase,'complete');assert.equal(state.next,5);assert.equal(state.status,'landed');assert.ok(state.score.result);if(course==='contour-circuit')assert.ok(Math.hypot(state.position[0]-state.runway[0],state.position[2]-state.runway[2])<60,'Touch down on the generated runway');done=true;console.log('RESULT',label,state.score.result.totalScore,state.score.result.medal,state.score.result.elapsedSec,state.score.result.paceLabel);break
    }
   }
   assert.ok(done,'Flight timed out: '+label)
  }
  await page.reload();await page.waitForFunction(()=>window.__score);await page.locator('#startup-screen').waitFor({state:'hidden'});runs.push({label:course+'-reload',state:await page.evaluate(()=>window.__score())});await page.screenshot({path:`${dir}/${course}-durable.png`});await save();await context.close()
 }
 assert.deepEqual(errors,[])
} finally {await save();await browser.close()}
