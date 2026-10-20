import {mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {gzipSync} from 'node:zlib'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const directory=process.argv[2],stage=process.argv[3]||'audit',long=stage==='endurance'
await mkdir(`${directory}/${stage}`,{recursive:true})
const sourceHashes=Object.fromEntries(await Promise.all(execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n').map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const diagnosticSeconds=Number(process.env.CLOSEOUT_DIAGNOSTIC_SECONDS||0)
if(process.env.CLOSEOUT_DIAGNOSTIC_SECONDS&&(!long||!Number.isFinite(diagnosticSeconds)||diagnosticSeconds<180||diagnosticSeconds>=600))throw Error('Diagnostic duration must be 180 to 599 seconds in endurance mode')
const profile=process.env.CLOSEOUT_PROFILE==='1'
if(profile&&!diagnosticSeconds)throw Error('Profiles require a separate short diagnostic flight')
const hook=await readFile('scripts/browser-terrain-closeout.js','utf8')+(profile?'\n'+await readFile('scripts/browser-terrain-closeout-diagnostic.js','utf8'):'')
await mkdir(`${directory}/hooks`,{recursive:true});await writeFile(`${directory}/hooks/${createHash('sha256').update(hook).digest('hex')}.js`,hook)
const routes=JSON.parse(await readFile(`${directory}/routes.json`,'utf8')).routes.filter(r=>!process.env.CLOSEOUT_SEEDS||process.env.CLOSEOUT_SEEDS.split(',').includes(String(r.seed)))
for(const route of routes){
 if(long&&!process.env.CLOSEOUT_SEEDS&&![73,42,1337].includes(route.seed))continue
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface','--enable-precise-memory-info']})
 const errors=[],samples=[],pictures=[];let final,wallSeconds,metrics,runtime
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,permissions:['local-network-access'],...(process.env.CLOSEOUT_VIDEO?{recordVideo:{dir:`${directory}/${stage}`,size:{width:1280,height:720}}}:{})});page.setDefaultTimeout(180000)
  page.on('pageerror',e=>(errors.push(String(e)),console.error(String(e))));page.on('crash',()=>errors.push('Browser page crashed'));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.route('**/src/main.ts*',async r=>{
   const response=await r.fetch();let s=await response.text()
   for(const anchor of ['const tick = (nowMs) => {','aircraft.step(dt, nowMs);'])if(!s.includes(anchor))throw Error('Missing hook anchor '+anchor)
   s=s.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;').replace('const tick = (nowMs) => {',hook+'\nconst tick = (nowMs) => {\nwindow.__closeout.frame(nowMs);').replace('aircraft.step(dt, nowMs);','window.__closeout.before(dt);\naircraft.step(dt, nowMs);')
   await r.fulfill({response,body:'import {sampleTerrainSurfaceHeightFast as closeSurface,sampleClimate as closeClimate} from "/src/world/terrainSample.ts";\n'+s})
  })
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/?course=free-flight&seed=${route.seed}`)
  await page.waitForFunction(()=>window.__closeout);await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await page.waitForTimeout(5000)
  let flight={...route,long}
  if(stage==='lod'){flight.clearance=650;flight.seconds=25}
  if(long){flight.clearance=650;flight.seconds=650
   if([42,73,1337].includes(route.seed)){
    const legacy=JSON.parse(await readFile(`docs/reviews/stability-10.941/${route.seed}.json`,'utf8'));flight.x=legacy.samples[0].start[0];flight.z=legacy.samples[0].start[2];flight.yaw=legacy.samples[0].heading
   }else if(![2026,9001,1].includes(route.seed))throw Error('Unsupported close-out endurance seed')
   if(diagnosticSeconds)flight.seconds=diagnosticSeconds
  }
  runtime=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}})
  await page.evaluate(r=>window.__closeout.start(r),flight)
  const cdp=profile?await page.context().newCDPSession(page):null
  let profiling=false,profileDone=false,trace=[]
  if(cdp){await cdp.send('Profiler.enable');cdp.on('Tracing.dataCollected',event=>trace.push(...event.value))}
  const started=Date.now();let nextShot=long?5:5,nextLog=0,previous=-1,stalled=0
  while(Date.now()-started<(flight.seconds*2+180)*1000){
   if(stage==='lod')await page.evaluate(()=>window.__closeout.camera(window.__closeout.state().seconds>=12.5?'cockpit':'chase'));
   await page.waitForTimeout(1000);final=await page.evaluate(()=>window.__closeout.state());samples.push(final)
   if(cdp&&!profileDone&&final.seconds>=165){
    if(!profiling){await cdp.send('Profiler.start');await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,gpu,blink.user_timing,disabled-by-default-devtools.timeline',options:'record-as-much-as-possible'});profiling=true}
    else if(final.seconds>=178){
     const cpu=await cdp.send('Profiler.stop');const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await completed
     await writeFile(`${directory}/${stage}/${route.seed}.cpuprofile.gz`,gzipSync(JSON.stringify(cpu.profile)))
     await writeFile(`${directory}/${stage}/${route.seed}.trace.json.gz`,gzipSync(JSON.stringify({traceEvents:trace})));trace=[];profileDone=true
    }
   }
   if(final.seconds>=nextLog){console.log(stage,route.seed,final.seconds.toFixed(1),final.status,'AGL',final.agl.toFixed(0),final.climate);nextLog+=15}
   if(final.seconds>=nextShot){
    for(const mode of ['chase','cockpit']){await page.evaluate(mode=>{window.__closeout.capture();window.__closeout.camera(mode)},mode);await page.waitForTimeout(300);const file=`${route.seed}-${Math.round(nextShot)}s-${mode}.jpg`;await page.screenshot({path:`${directory}/${stage}/${file}`,type:'jpeg',quality:88});pictures.push({file,state:await page.evaluate(()=>window.__closeout.state())})}
    await page.evaluate(mode=>window.__closeout.camera(mode),stage==='lod'?(final.seconds>=12.5?'cockpit':'chase'):(long&&Math.floor(final.seconds/60)%2?'cockpit':'chase'));nextShot+=long?60:15
   }
   metrics=await page.evaluate(()=>window.__closeout.metrics());wallSeconds=(Date.now()-started)/1000
   await writeFile(`${directory}/${stage}/${route.seed}.json`,JSON.stringify({sourceCommit,sourceHashes,runtime,...(diagnosticSeconds?{diagnosticOnly:true}:{}),hookSha256:createHash('sha256').update(hook).digest('hex'),route:flight,method:'One airborne reset before measurement, then control axes only. Production physics, collision, weather, streaming and cameras. Frame histogram excludes capture windows (1.5 seconds per screenshot); all terrain update costs retained.',errors,samples,pictures,final,wallSeconds,metrics},null,2)+'\n')
   if(final.status!=='ok'||final.onGround){await page.screenshot({path:`${directory}/${stage}/${route.seed}-failure.jpg`,type:'jpeg',quality:90});throw Error('Flight contact '+route.seed+' '+JSON.stringify(final.impact))}
   if(final.seconds>=flight.seconds)break
   stalled=final.seconds===previous?stalled+1:0;previous=final.seconds;if(stalled>20)throw Error('Flight stalled')
  }
  if(profile)await writeFile(`${directory}/${stage}/${route.seed}.diagnostic.json`,JSON.stringify(await page.evaluate(()=>window.__closeoutDiagnostic),null,2)+'\n')
  if(final.seconds<flight.seconds||errors.length)throw Error('Incomplete or errored flight '+route.seed+': '+errors.join('; '))
  if(process.env.CLOSEOUT_VIDEO){await page.close();await page.video().saveAs(`${directory}/${stage}/${route.seed}-flight.webm`);await page.video().delete()}
  console.log('SAVED',stage,route.seed,final.seconds,wallSeconds,pictures.length,'hitches',metrics.hitches.length,'terrain max',metrics.terrainMaxMs)
 }finally{await browser.close()}
}
