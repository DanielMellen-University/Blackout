import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/onboarding-10.945/before-keyboard'
const device=process.env.ONBOARD_DEVICE||'keyboard'
await mkdir(dir,{recursive:true})
const adapter=await readFile('scripts/browser-mapped-input.js','utf8')
const hook=(await readFile('scripts/browser-training-review.js','utf8')).replace('c=aircraft.controls','c={...aircraft.controls}').replace('if(gear&&!c.gearDown)aircraft.toggleGear()','').replace('c.gearDown=gear;c.stabilityAssist=true','c.gearDown=gear;c.stabilityAssist=true;driveMapped(c,dt)')+'\n'+adapter
await writeFile(dir+'/hook.js',hook)
const sourceHashes=Object.fromEntries(await Promise.all(['src/systems/Mission.ts','src/systems/GhostReplay.ts','src/main.ts','src/core/FlightBriefing.ts','src/core/InputManager.ts','index.html','src/style.css'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const samples=[],errors=[],pictures=[]
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hookSha256=createHash('sha256').update(hook).digest('hex')
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
 page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
 await page.addInitScript(device=>{window.__mappedDevice=device;window.__virtualPad={id:'Standard review gamepad',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,touched:false,value:0}))};if(device==='gamepad')Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__virtualPad]});localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}},device)
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();let source=await response.text()
  source=source.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;').replace('const tick = (nowMs) => {',hook+'\nconst tick = (nowMs) => {').replace('aircraft.controls = input.sampleWithDt(dt);','window.__training.before(dt);\naircraft.controls = input.sampleWithDt(dt);')
  await route.fulfill({response,body:source})
 })
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+'/')
 await page.waitForFunction(()=>window.__training)
 await page.locator('#startup-screen').waitFor({state:'hidden'})
 const layout=await page.evaluate(()=>{const hero=document.querySelector('.deck-hero').getBoundingClientRect(),brief=document.querySelector('.title-takeoff').getBoundingClientRect(),launch=document.querySelector('#btn-play').getBoundingClientRect();return {hero:{top:hero.top,bottom:hero.bottom},brief:{top:brief.top,bottom:brief.bottom},launch:{top:launch.top,bottom:launch.bottom}}});await writeFile(dir+'/layout.json',JSON.stringify(layout,null,2)+'\n');if(layout.brief.bottom>layout.hero.bottom||layout.launch.bottom>layout.hero.bottom)throw Error('First-flight instructions or Launch are clipped');await page.screenshot({path:dir+'/launch.png'});pictures.push('launch.png')
 await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await page.evaluate(()=>window.__training.start())
 await page.waitForFunction(()=>{const s=({...window.__training.state(),mapped:window.__mappedState()});return s.onGround&&s.briefing.hint?.includes('ROTATE')&&s.mapped.inputSource===window.__mappedDevice})
 samples.push(await page.evaluate(()=>({...window.__training.state(),mapped:window.__mappedState()})));await page.screenshot({path:dir+'/takeoff-runway.png'});pictures.push('takeoff-runway.png')
 let lastStage='',lastGate=-1,switched=false,approachShot=false
 for(let i=0;i<240;i++){
  await page.waitForTimeout(2000)
  const state=await page.evaluate(()=>({...window.__training.state(),mapped:window.__mappedState()}));samples.push(state)
  if(i%5===0)console.log(state.seconds.toFixed(1),state.stage,state.next,state.phase,state.status,state.position.map(Math.round),Math.round(state.speed))
  if(state.stage!==lastStage||state.next!==lastGate||state.resultsOpen||state.status==='crashed'){
   const file=`${i}-${state.stage}-gate-${state.next}.png`;await page.screenshot({path:dir+'/'+file});pictures.push(file)
   lastStage=state.stage;lastGate=state.next
  }
  if(!switched&&state.next>=1){await page.evaluate(()=>window.__training.camera('cockpit'));await page.waitForTimeout(1000);await page.screenshot({path:dir+'/cockpit.png'});pictures.push('cockpit.png');await page.evaluate(()=>window.__training.camera('chase'));switched=true}
  if(!approachShot&&state.stage==='approach'&&state.agl>20&&state.agl<80){await page.evaluate(()=>window.__training.camera('cockpit'));await page.waitForTimeout(500);await page.screenshot({path:dir+'/approach-cockpit.png'});pictures.push('approach-cockpit.png');await page.evaluate(()=>window.__training.camera('chase'));await page.screenshot({path:dir+'/approach-chase.png'});pictures.push('approach-chase.png');approachShot=true}
  await writeFile(dir+'/run.json',JSON.stringify({sourceCommit,sourceHashes,hookSha256,method:'Fresh storage, default Training, DOM launch. Pilot drives keyboard events or virtual standard Gamepad API through the production InputManager. Real physics and gate evaluator. No direct control, pose or gate writes.',errors,pictures,samples,final:state},null,2)+'\n')
  if(state.resultsOpen||state.status==='crashed')break
 }
 await writeFile(dir+'/input-events.json',JSON.stringify(await page.evaluate(()=>window.__mappedEvents()),null,2)+'\n')
 const final=samples.at(-1)
 if(errors.length||final?.phase!=='complete'||final.next!==5||!final.resultsOpen||final.status!=='landed')throw Error('Training incomplete; see saved run.json')
 await page.locator('#btn-new-world').click()
 await page.waitForFunction(()=>!document.querySelector('#title-screen').classList.contains('is-hidden'))
 const next=await page.evaluate(()=>({selected:document.querySelector('#title-course-picker [aria-checked=true]')?.dataset.courseId,goal:document.querySelector('#title-course-picker .course-picker-goal')?.innerText,history:localStorage.getItem('blackout.history.seed:1:orbit'),focused:document.activeElement?.id}))
 if(next.selected!=='training-orbit'||next.focused!=='btn-play'||JSON.parse(next.history).completionCount!==1)throw Error('Next mission flow lost progress or focus')
 await page.screenshot({path:dir+'/choose-next-mission.png'})
 await writeFile(dir+'/next.json',JSON.stringify(next,null,2)+'\n')
}finally{await browser.close()}
