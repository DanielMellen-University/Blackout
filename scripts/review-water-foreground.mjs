// Sequential full-game foreground workload with identical development-only instrumentation.
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.env.REVIEW_DIRECTORY || 'docs/reviews/water-11.045'
const baseline = process.env.REVIEW_BASELINE || 'b9e1ac86'
const candidate = process.env.REVIEW_CANDIDATE || 'HEAD'
const port = Number(process.env.REVIEW_PORT || 5188)
const duration = Number(process.env.REVIEW_SECONDS || 120)
const wallLimitMs = Number(process.env.REVIEW_WALL_LIMIT_MS || 600000)
const route = { x:-12000,z:-16000,y:5000,dx:1,dz:0,loopM:14000,label:'Seed-1 regional sea, repeated 14 km east-west corridor' }
const gpuMode = process.env.REVIEW_GPU || 'vulkan'
if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 5173) throw Error('Choose a free review port other than 5173')
if (!Number.isInteger(duration) || duration < 120 || duration > 900) throw Error('REVIEW_SECONDS must be 120 to 900')
if (!Number.isFinite(wallLimitMs) || wallLimitMs <= 0) throw Error('Invalid wall-time limit')
if (!['vulkan','gl','swiftshader'].includes(gpuMode)) throw Error('Use vulkan, gl or swiftshader')
const args = ['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle',`--use-angle=${gpuMode}`,
  '--enable-precise-memory-info', ...(gpuMode === 'vulkan' ? ['--enable-features=Vulkan','--disable-vulkan-surface'] : []),
  ...(gpuMode === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])]
const summary = values => {
  const a = values.toSorted((a,b)=>a-b), n=a.length
  return {count:n,totalMs:values.reduce((a,b)=>a+b,0),median:n ? (n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2):null,
    p95:n?a[Math.ceil(n*.95)-1]:null,max:n?a.at(-1):null,over2:a.filter(x=>x>2).length,over8:a.filter(x=>x>8).length,over16:a.filter(x=>x>16).length}
}
await mkdir(directory,{recursive:true})
for (const [label, requestedRef] of [['main',baseline],['branch',candidate]]) {
  const ref=execFileSync('git',['rev-parse',requestedRef],{encoding:'utf8'}).trim()
  const sourcePaths=execFileSync('git',['ls-tree','-r','--name-only',ref,'src'],{encoding:'utf8'}).trim().split('\n')
  const sources=new Map(sourcePaths.filter(p=>p.endsWith('.ts')).map(p=>[p,execFileSync('git',['show',`${ref}:${p}`],{encoding:'utf8'})]))
  const instrumentation = { world:0,terrain:0,worker:0,route:0 }
  const server = await createServer({server:{host:'127.0.0.1',port,strictPort:true,hmr:false,ws:false},plugins:[{
    name:'water-foreground-reference',enforce:'pre',transform(code,id) {
      const path = id.split('?')[0].replace(process.cwd()+'/', '')
      if(sources.has(path)) code=sources.get(path)
      if(path==='src/debug/FlightReview.ts') {
        code=code.replace(/world: \{[^\n]+/,`world: ${JSON.stringify(route)},`);instrumentation.route++
      }
      if(path==='src/world/World.ts'||path==='src/world/TerrainSystem.ts') {
        const name=path.endsWith('/World.ts')?'World':'TerrainSystem', methods=name==='World'?['update']:['update','install','drainBuildQueue']
        code+=`\nif(typeof window!=='undefined') for(const key of ${JSON.stringify(methods)}) { const original=${name}.prototype[key]; if(typeof original==='function') ${name}.prototype[key]=function(...a) {const t=performance.now();try{return original.apply(this,a)}finally{window.__waterCpu?.record('${name}.'+key,performance.now()-t)}} }\n`
        instrumentation[name==='World'?'world':'terrain']++
      }
      if(path==='src/world/terrain.worker.ts') {
        code=code.replace('generateTerrainGeometry,','generateTerrainGeometrySteps,')
          .replace('const data = generateTerrainGeometry(', 'const iterator = generateTerrainGeometrySteps(')
          .replace('  self.postMessage(',`  const reviewCpu={totalMs:0,maxSliceMs:0,slices:0,over2:0,over8:0,over16:0,phases:{}}\n  let data\n  while(true){const t=performance.now(),r=iterator.next(),ms=performance.now()-t;reviewCpu.totalMs+=ms;reviewCpu.maxSliceMs=Math.max(reviewCpu.maxSliceMs,ms);reviewCpu.slices++;if(ms>2)reviewCpu.over2++;if(ms>8)reviewCpu.over8++;if(ms>16)reviewCpu.over16++;const p=r.done?'finalize':r.value;const v=reviewCpu.phases[p]??={totalMs:0,maxMs:0,slices:0};v.totalMs+=ms;v.maxMs=Math.max(v.maxMs,ms);v.slices++;if(r.done){data=r.value;break}}\n  self.postMessage(`)
          .replace('{ id: job.id, generation: job.generation, data }', '{ id: job.id, generation: job.generation, data, reviewCpu }')
        instrumentation.worker++
      }
      return code
    }
  }]})
  let browser,result,detail,gpu,metricsStart,metricsEnd
  const errors=[]
  try {
    await server.listen()
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args})
    const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
    page.setDefaultTimeout(120000)
    page.on('pageerror',e=>errors.push(String(e)))
    await page.addInitScript(() => {
      localStorage.setItem('blackout.renderQuality','balanced')
      const times={},workers=[],longTasks=[],visibility=[]
      window.__waterCpu={times,workers,longTasks,visibility,record(name,ms){const a=times[name]??=[];if(a.length<100000)a.push(ms)},reset(){for(const key in times)delete times[key];workers.length=longTasks.length=visibility.length=0}}
      const NativeWorker=window.Worker
      window.Worker=class extends NativeWorker {constructor(...a){super(...a);this.addEventListener('message',e=>{if(e.data?.reviewCpu)workers.push(e.data.reviewCpu)})}}
      new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({startMs:e.startTime,ms:e.duration})))).observe({type:'longtask'})
      document.addEventListener('visibilitychange',()=>visibility.push({atMs:performance.now(),state:document.visibilityState}))
    })
    const session=await page.context().newCDPSession(page)
    await session.send('Performance.enable')
    await page.goto(`http://127.0.0.1:${port}/?course=free-flight&seed=1&review=flight&reviewFixedRatio=1&reviewRoute=world&reviewSeconds=${duration}`)
    await page.locator('#flight-review button').waitFor()
    await page.bringToFront()
    gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),userAgent:navigator.userAgent,visible:document.visibilityState,focus:document.hasFocus()}})
    if(gpuMode!=='swiftshader'&&/SwiftShader|llvmpipe/i.test(gpu.renderer))throw Error(`Unexpected software renderer: ${gpu.renderer}`)
    await page.evaluate(()=>window.__waterCpu.reset())
    metricsStart=await session.send('Performance.getMetrics')
    await page.locator('#flight-review button').click()
    const start=Date.now()
    while(Date.now()-start<wallLimitMs) {
      await page.waitForTimeout(10000)
      const raw=await page.locator('#flight-review pre').innerText({timeout:30000})
      try {result=JSON.parse(raw)} catch {continue}
      console.log(label,result.phase,result.seconds,result.streaming)
      // Persist progress even if the next navigation or process fails.
      await writeFile(`${directory}/foreground-${label}-progress.json`,JSON.stringify({ref,gpu,errors,result},null,2)+'\n')
      if(result.phase==='finished')break
    }
    metricsEnd=await session.send('Performance.getMetrics')
    detail=await page.evaluate(()=>({times:window.__waterCpu.times,workers:window.__waterCpu.workers,longTasks:window.__waterCpu.longTasks,visibility:window.__waterCpu.visibility,state:document.visibilityState,focus:document.hasFocus(),heap:performance.memory?.usedJSHeapSize??null}))
    await page.screenshot({path:`${directory}/foreground-${label}-endpoint.png`})
    const workerPhases={}
    for(const w of detail.workers) for(const [phase,v]of Object.entries(w.phases)){
      const p=workerPhases[phase]??={totalMs:0,maxMs:0,slices:0};p.totalMs+=v.totalMs;p.maxMs=Math.max(p.maxMs,v.maxMs);p.slices+=v.slices
    }
    const metrics=Object.fromEntries(metricsEnd.metrics.map(m=>[m.name,m.value-(metricsStart.metrics.find(s=>s.name===m.name)?.value||0)]).filter(([n])=>/Duration$/.test(n)))
    const matched=result?.phase==='finished'&&Object.entries(route).every(([k,v])=>result.route?.[k]===v)&&result.speedMps===680&&result.camera==='external'&&gpu.visible==='visible'&&gpu.focus&&result.seed===1&&result.quality==='balanced'&&result.distanceM===duration*680&&result.ratioRange.every(x=>x===1)&&result.viewport[0]===1280&&result.viewport[1]===720&&detail.state==='visible'&&detail.focus&&detail.visibility.length===0&&errors.length===0&&Object.values(instrumentation).every(x=>x>0)&&detail.workers.length>0
    const output={label,ref,node:process.version,cpu:cpus()[0].model,browser:browser.version(),args,gpu,instrumentation,matched,errors,route,duration,wallLimitMs,
      method:'One foreground full-game tab, sequential main then branch, no tests or other profiler. Prescribed maximum-speed loop through regional sea; normal physics, rendering, streaming, weather and HUD run. Identical temporary function/worker timers add measurement overhead. Main-thread function totals nest and must not be summed. Worker CPU work is summed iterator next() wall time, not OS thread CPU. CPU counters and CDP Duration deltas cover launch through the final 10-second poll, including startup and up to one polling interval after route completion. Frame timestamps include hitches; hidden intervals are separately rejected.',
      result,cpu:{main:Object.fromEntries(Object.entries(detail.times).map(([k,v])=>[k,summary(v)])),workers:{jobs:detail.workers.length,totalWorkMs:detail.workers.reduce((a,w)=>a+w.totalMs,0),jobWorkMs:summary(detail.workers.map(w=>w.totalMs)),jobLargestSliceMs:summary(detail.workers.map(w=>w.maxSliceMs)),phases:workerPhases},longTasks:detail.longTasks,cdpDurationSeconds:metrics},visibility:detail.visibility,finalVisible:detail.state,finalFocus:detail.focus}
    await writeFile(`${directory}/foreground-${label}.json`,JSON.stringify(output,null,2)+'\n')
    if(matched)await writeFile(`${directory}/foreground-${label}-progress.json`,JSON.stringify({complete:true,ref},null,2)+'\n')
    console.log('SAVED',label,matched,result?.flightFrames)
  } catch(e) {
    errors.push(String(e));await writeFile(`${directory}/foreground-${label}-failed.json`,JSON.stringify({ref,gpu,errors,result,instrumentation},null,2)+'\n');console.error(label,String(e))
  } finally {await browser?.close();await server.close()}
}
