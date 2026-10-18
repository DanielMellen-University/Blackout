import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory=process.argv[2]||'docs/reviews/landing-10.925', label=process.argv[3]||'before'
await mkdir(directory,{recursive:true})
const sources=Object.fromEntries(execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n').map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
const hook=readFileSync('scripts/browser-landing-review.js','utf8')
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const runs=[], captureSeconds=Number(process.env.LANDING_CAPTURE_SECONDS||18)
try{
 for(const seed of (process.env.LANDING_SEEDS||'42,73,1337').split(',').map(Number))for(const course of (process.env.LANDING_COURSES||'free-flight,training-orbit').split(',')){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[],consoleErrors=[]
  page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE',String(e))})
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().replace(/([?&]token=)[^&\s'\"]+/g,'$1[redacted]'))})
  await page.addInitScript(()=>{localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();let source=await response.text()
   for(const anchor of ['const tick = (nowMs) => {','aircraft.step(dt, nowMs);','const touch = collision.check(aircraft);','renderer.render(world.scene, cameras.camera);'])if(!source.includes(anchor))throw Error('Missing injection anchor: '+anchor)
   source=source.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;')
    .replace('const tick = (nowMs) => {',hook+'\nconst tick = (nowMs) => {')
    .replace('aircraft.step(dt, nowMs);','window.__landing.before(dt);\n aircraft.step(dt, nowMs);')
    .replace('const touch = collision.check(aircraft);','const touch = collision.check(aircraft);\n window.__landing.touch(touch);')
    .replace('renderer.render(world.scene, cameras.camera);','renderer.render(world.scene, cameras.camera);\n window.__landing.frame();')
   source = 'import {sampleTerrainSurfaceHeightFast as landingReviewSurface} from "/src/world/terrainSample.ts";\n' + source
   await route.fulfill({response,body:source})
  })
  console.log('START',label,seed,course)
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/?course=${course}&seed=${seed}`)
  await page.waitForFunction(()=>window.__landing)
  console.log('HOOK',seed,course)
  await page.locator('#btn-play').click()
  await page.waitForTimeout(5000)
  await page.evaluate(()=>window.__landing.start());console.log('FLY',seed,course)
  for(let i=0;i<18;i++){
   await page.waitForTimeout(5000);const state=await page.evaluate(()=>window.__landing.state());console.log('PROGRESS',seed,course,state.seconds.toFixed(1),state.status,state.contact?.touch)
   if(state.seconds>=captureSeconds||state.contact)break
  }
  if((await page.evaluate(()=>window.__landing.state())).seconds<captureSeconds && !(await page.evaluate(()=>window.__landing.state())).contact){await page.screenshot({path:`${directory}/${label}-${seed}-${course}-stalled.png`});await writeFile(`${directory}/${label}-${seed}-${course}-stalled.json`,JSON.stringify({state:await page.evaluate(()=>window.__landing.state()),errors},null,2));throw Error('Approach simulation stalled')}
  if((await page.evaluate(()=>window.__landing.state())).contact){
   await writeFile(`${directory}/${label}-${seed}-${course}-early.json`,JSON.stringify({state:await page.evaluate(()=>window.__landing.state()),samples:await page.evaluate(()=>window.__landing.samples()),errors},null,2))
   await page.screenshot({path:`${directory}/${label}-${seed}-${course}-early.png`});throw Error('Approach contacted terrain before capture point')
  }
  await page.evaluate(()=>window.__landing.hold(true));await page.waitForTimeout(500)
  const boundaries=await page.evaluate(()=>window.__landing.boundaries()),views=[],fieldProbes=[]
  for(const [nose,track] of [[35,0],[-35,0],[0,35],[0,-35],[20,0],[0,20]]){
   await page.evaluate(([n,t])=>window.__landing.probe(n,t),[nose,track]);await page.waitForTimeout(600)
   fieldProbes.push({nose,track,state:await page.evaluate(()=>window.__landing.state())})
  }
  await page.evaluate(()=>window.__landing.probe(0,0));await page.waitForTimeout(700)
  for(const mode of ['chase','cockpit']){
   await page.evaluate(m=>window.__landing.view(m),mode);await page.waitForTimeout(700)
   const filename=`${label}-${seed}-${course}-${mode}.png`;await page.screenshot({path:`${directory}/${filename}`})
   views.push({filename,state:await page.evaluate(()=>window.__landing.state())})
  }
  await page.evaluate(()=>window.__landing.hold(false))
  await page.waitForFunction(()=>window.__landing.state().contact!==null,{},{timeout:90000})
  await page.waitForTimeout(2000)
  const final=await page.evaluate(()=>window.__landing.state()),samples=await page.evaluate(()=>window.__landing.samples())
  let debrief=null
  if(course==='training-orbit'){
   await writeFile(`${directory}/${label}-${seed}-${course}-pre-debrief.json`,JSON.stringify({final,samples,route:await page.evaluate(()=>window.__landing.route()),errors},null,2))
   await page.locator('#run-results').waitFor({state:'visible',timeout:30000})
   debrief=`${label}-${seed}-${course}-debrief.png`;await page.screenshot({path:`${directory}/${debrief}`})
  }
  await writeFile(`${directory}/${label}-${seed}-${course}-result.json`,JSON.stringify({seed,course,views,boundaries,fieldProbes,final,samples,route:await page.evaluate(()=>window.__landing.route()),errors},null,2))
  if(views.some(v=>v.state.hudGlide!==v.state.guidance || v.state.hudTarget!=='base' || v.state.ratio!==1))throw Error('HUD does not match final guidance')
  if(fieldProbes.some(p=>Math.max(Math.abs(p.nose),Math.abs(p.track))>30 ? p.state.hudGlide!==null : p.state.hudGlide!==p.state.guidance))throw Error('HUD cone mismatch')
  if(boundaries.some(b=>Math.abs(b.degrees)<=30 ? b.guidance===null : b.guidance!==null))throw Error('Inclusive final cone mismatch')
  if(!['landed','roll'].includes(final.contact?.touch) || !final.onGround || final.status==='crashed')throw Error('Approach did not land safely')
  runs.push({seed,course,errors,consoleErrors,views,boundaries,fieldProbes,final,samples,route:await page.evaluate(()=>window.__landing.route()),debrief})
  await writeFile(`${directory}/${label}.json`,JSON.stringify({sources,hookSha256:createHash('sha256').update(hook).digest('hex'),viewport:[1280,720],pixelRatio:1,runs},null,2)+'\n')
  console.log('SAVED',seed,course,final.contact?.touch,final.contact?.failureReason,final.phase)
  await page.close()
 }
}finally{await browser.close()}
if(runs.some(r=>r.errors.length||r.final.status==='crashed'))throw Error('Landing review has application errors or a crash')
