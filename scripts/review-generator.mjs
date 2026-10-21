import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { summarizeFlightFrames } from './lib/review-frame-metrics.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/blackout-b19-tools/node_modules/playwright/index.mjs')
const theme = process.env.REVIEW_COURSE || 'training-orbit'
const seeds = (process.env.REVIEW_SEEDS || '42').split(',')
const part = process.env.REVIEW_PART || 'a'
const capture = process.env.REVIEW_CAPTURE === '1'
const profile = process.env.REVIEW_PROFILE === '1'
const smoke = part === 'a' || process.env.REVIEW_SMOKE === '1'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium', args: ['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface'] })
try {
 const browserCdp=await browser.newBrowserCDPSession()
 const system=await browserCdp.send('SystemInfo.getInfo')
 const browserInfo={version:browser.version(),gpu:system.gpu}
 await browserCdp.detach()
 for (const seed of seeds) {
  const dir = `docs/reviews/generator/${part}/${theme}-${seed}`
  if (process.env.REVIEW_RESUME === '1') {
   try {
    const prior=JSON.parse(await readFile(`${dir}/run.json`,'utf8'))
    const current=JSON.parse(await readFile('docs/reviews/generator/hooks-build/browser-build.json','utf8'))
    if(prior.pass && prior.build.buildId===current.buildId && prior.smoke===smoke && prior.capture===capture) {
     console.log('RETAIN VERIFIED',theme,seed);continue
    }
   } catch {}
  }
  await mkdir(dir,{recursive:true})
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1})
  const page=await context.newPage(),errors=[],knownFallback=[],samples=[],pictures=[]
  page.setDefaultTimeout(120000)
  page.on('pageerror',e=>errors.push(String(e)))
  page.on('console',m=>{if(m.type()==='error'){if(m.location().url.endsWith('/models/f35.glb'))knownFallback.push(m.text());else errors.push(m.text())}})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.goto(`http://127.0.0.1:5176/?course=${theme}&seed=${seed}${process.env.REVIEW_QUERY || ''}`)
  await page.waitForFunction(()=>window.__training)
  const buildId=await page.evaluate(()=>window.__training.buildId)
  const build=JSON.parse(await readFile(`docs/reviews/generator/hooks-build/hooks/${buildId}.json`,'utf8'))
  await page.locator('#startup-screen').waitFor({state:'hidden'})
  const captureFences=[]
  let captureCdp, captureRendererId
  if(capture){
   // Inspect the existing observer closure instead of changing the runtime hook.
   captureCdp=await context.newCDPSession(page)
   const code=await page.evaluate(()=>window.__training.capture.toString())
   const renderName=code.match(/([\w$]+)\([\w$]+\.scene,/)[1]
   const {result:fn}=await captureCdp.send('Runtime.evaluate',{expression:'window.__training.capture'})
   const detail=await captureCdp.send('Runtime.getProperties',{objectId:fn.objectId})
   const scopes=await captureCdp.send('Runtime.getProperties',{objectId:detail.internalProperties.find(p=>p.name==='[[Scopes]]').value.objectId,ownProperties:true})
   let renderId
   for(const scope of scopes.result){
    if(!scope.value?.objectId)continue
    const properties=await captureCdp.send('Runtime.getProperties',{objectId:scope.value.objectId,ownProperties:true})
    renderId=properties.result.find(p=>p.name===renderName)?.value?.objectId
    if(renderId)break
   }
   if(!renderId)throw Error('Capture renderer binding missing')
   const bound=await captureCdp.send('Runtime.getProperties',{objectId:renderId})
   captureRendererId=bound.internalProperties.find(p=>p.name==='[[BoundThis]]')?.value?.objectId
   if(!captureRendererId)throw Error('Capture renderer instance missing')
  }
  const captureStill=async name=>{
   // A desynchronized canvas can be sampled while GPU commands are outstanding.
   // Hold only drawing, complete one normal render, then read the stable canvas.
   // Simulation and the controls pilot continue; capture sessions are never timing proof.
   await page.evaluate(()=>{window.__training.setRenderInterval(1000000);window.__training.capture()})
   try {
    const fence=await captureCdp.send('Runtime.callFunctionOn',{objectId:captureRendererId,
     functionDeclaration:'function(){const gl=this.getContext(),start=performance.now();gl.finish();return {ms:performance.now()-start,desynchronized:gl.getContextAttributes().desynchronized}}',returnByValue:true})
    if(fence.exceptionDetails)throw Error(JSON.stringify(fence.exceptionDetails))
    captureFences.push({picture:name,...fence.result.value})
    await page.screenshot({path:`${dir}/${name}`,type:'jpeg',quality:87})
   }finally{await page.evaluate(()=>window.__training.setRenderInterval(0))}
  }
  let cdp
  if(profile){
   cdp=await context.newCDPSession(page)
   await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,gpu,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'})
  }
  await page.locator('#btn-play').click()
  await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.waitForFunction(()=>window.__training.state().playing)
  const timingStart = await page.evaluate(()=>({at:performance.now(),boundary:'After the ordinary launch panel hides, immediately before starting the controls-only pilot and RAF observer.',state:window.__training.state()}))
  await page.evaluate(()=>{
   performance.mark('review-flight-start'); window.__training.start()
   window.__reviewFrames=[]; window.__reviewFrameTimes=[]; window.__reviewCaptures=[]; let prior=performance.now()
   const frame=now=>{const dt=now-prior;prior=now;if(window.__reviewFrames.length<100000)window.__reviewFrames.push(dt);window.__reviewFrameTimes.push({start:prior-dt,end:now,ms:dt});requestAnimationFrame(frame)}
   requestAnimationFrame(frame)
  })
  const captureWindow=async (label,action)=>{
   const start=await page.evaluate(label=>{performance.mark(`review-capture-${label}-start`);return performance.now()},label)
   await action()
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
   await page.evaluate(({label,start})=>{const end=performance.now();performance.mark(`review-capture-${label}-end`);window.__reviewCaptures.push({label,start,end})},{label,start})
  }
  if(capture && process.env.REVIEW_RUNWAY_VIEWS==='1'){
   await captureWindow('runway',async()=>{
    for(const camera of ['chase','cockpit']){
     await page.evaluate(mode=>window.__training.camera(mode),camera);await page.waitForTimeout(200)
     const name=`runway-${camera}.jpg`;await captureStill(name);pictures.push(name)
    }
    await page.evaluate(()=>window.__training.camera('chase'))
   })
  }
  let final,shot=false,approach=false
  const started=Date.now()
  while(Date.now()-started<600000){
   await page.waitForTimeout(1000)
   final=await page.evaluate(()=>window.__training.state())
   samples.push(Object.fromEntries(['seconds','stage','next','phase','position','velocity','speed','agl','status','onGround','loadFactor','controls','nitro','stream','coverage','lod','heapMB'].map(key=>[key,final[key]])))
   if(Math.floor(final.seconds)%15===0)console.log(theme,seed,final.seconds.toFixed(1),final.stage,final.next,final.status)
   if(capture && !shot && final.next>=1){
    await captureWindow('gates',async()=>{
    for(const camera of ['chase','cockpit']){
     await page.evaluate(mode=>window.__training.camera(mode),camera);await page.waitForTimeout(250)
     const name=`gates-${camera}.jpg`;await captureStill(name);pictures.push(name)
    }
    await page.evaluate(()=>window.__training.camera('chase'));});shot=true
   }
   if(capture && !approach && final.stage==='approach' && final.agl<30 && final.agl>8){
    await captureWindow('approach',async()=>{await page.evaluate(()=>window.__training.camera('cockpit'));await page.waitForTimeout(200);await captureStill('approach-cockpit.jpg');pictures.push('approach-cockpit.jpg');await page.evaluate(()=>window.__training.camera('chase'));});approach=true
   }
   if(smoke && (shot || (!capture && final.next>=1))) break
   if(final.resultsOpen || final.status==='crashed')break
  }
  const {frameTimes,captureWindows,heapMB}=await page.evaluate(()=>({frameTimes:window.__reviewFrameTimes,captureWindows:window.__reviewCaptures,heapMB:performance.memory?.usedJSHeapSize/1048576}))
  const metrics={...summarizeFlightFrames(frameTimes),heapMB}
  const timingEligible=!capture&&!profile&&!smoke
  if(capture){await captureStill('final.jpg');pictures.push('final.jpg')}
  if(cdp){
   const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve))
   await cdp.send('Tracing.end');const {stream}=await complete
   let trace='';for(;;){const r=await cdp.send('IO.read',{handle:stream});trace+=r.data;if(r.eof)break}
   await cdp.send('IO.close',{handle:stream})
   await writeFile(`${dir}/trace.json.gz`,gzipSync(trace))
  }
  const refillPass=final.nitroRefills.length >= (smoke ? 1 : 5) && final.nitroRefills.every(r=>Math.abs(r.after.fraction-Math.min(1,r.before.fraction+.25))<1e-6)
  const pass=refillPass&&errors.length===0&&final.course===theme&&(part==='a'||final.seed===Number(seed))&&(smoke?(shot||(!capture&&final.next>=1)):final.status==='landed'&&final.phase==='complete'&&final.next===5&&final.resultsOpen)
  await writeFile(`${dir}/run.json`,JSON.stringify({theme,seed,part,smoke,capture,profile,frameTimes,captureWindows,captureFences,timingEligible,timingStart,browserInfo,pass,errors,knownFallback,pictures,metrics,build,final,samples},null,2)+'\n')
  console.log('RESULT',JSON.stringify({theme,seed,part,smoke,timingEligible,pass,metrics}))
  await context.close()
  if(!pass)throw Error(`Failed ${theme} ${seed}`)
 }
}finally{await browser.close()}
