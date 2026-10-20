import { mkdir, writeFile, readFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/blackout-b19-tools/node_modules/playwright/index.mjs')
const theme = process.env.REVIEW_COURSE || 'training-orbit'
const seeds = (process.env.REVIEW_SEEDS || '42').split(',')
const part = process.env.REVIEW_PART || 'a'
const smoke = part === 'a' || process.env.REVIEW_SMOKE === '1'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium', args: ['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface'] })
try {
 for (const seed of seeds) {
  const dir = `docs/reviews/generator/${part}/${theme}-${seed}`
  await mkdir(dir,{recursive:true})
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1})
  const page=await context.newPage(),errors=[],knownFallback=[],samples=[],pictures=[]
  page.setDefaultTimeout(120000)
  page.on('pageerror',e=>errors.push(String(e)))
  page.on('console',m=>{if(m.type()==='error'){if(m.location().url.endsWith('/models/f35.glb'))knownFallback.push(m.text());else errors.push(m.text())}})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.goto(`http://127.0.0.1:5176/?course=${theme}&seed=${seed}`)
  await page.waitForFunction(()=>window.__training)
  const buildId=await page.evaluate(()=>window.__training.buildId)
  const build=JSON.parse(await readFile(`docs/reviews/generator/hooks-build/hooks/${buildId}.json`,'utf8'))
  await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.locator('#btn-play').click()
  await page.evaluate(()=>{
   window.__training.start()
   window.__reviewFrames=[]; let prior=performance.now()
   const frame=now=>{const dt=now-prior;prior=now;if(window.__reviewFrames.length<100000)window.__reviewFrames.push(dt);requestAnimationFrame(frame)}
   requestAnimationFrame(frame)
  })
  let final,shot=false,approach=false
  const started=Date.now()
  while(Date.now()-started<600000){
   await page.waitForTimeout(1000)
   final=await page.evaluate(()=>window.__training.state())
   samples.push(Object.fromEntries(['seconds','stage','next','phase','position','velocity','speed','agl','status','onGround','loadFactor','controls','nitro','stream','coverage','lod','heapMB'].map(key=>[key,final[key]])))
   if(Math.floor(final.seconds)%15===0)console.log(theme,seed,final.seconds.toFixed(1),final.stage,final.next,final.status)
   if(!shot && final.next>=1){
    for(const camera of ['chase','cockpit']){
     await page.evaluate(mode=>window.__training.camera(mode),camera);await page.waitForTimeout(250)
     await page.evaluate(()=>window.__training.capture());const name=`gates-${camera}.jpg`;await page.screenshot({path:`${dir}/${name}`,type:'jpeg',quality:87});pictures.push(name)
    }
    await page.evaluate(()=>window.__training.camera('chase'));shot=true
   }
   if(!approach && final.stage==='approach' && final.agl<80 && final.agl>8){
    await page.evaluate(()=>window.__training.camera('cockpit'));await page.waitForTimeout(200);await page.evaluate(()=>window.__training.capture());await page.screenshot({path:`${dir}/approach-cockpit.jpg`,type:'jpeg',quality:87});pictures.push('approach-cockpit.jpg');await page.evaluate(()=>window.__training.camera('chase'));approach=true
   }
   if(smoke && shot) break
   if(final.resultsOpen || final.status==='crashed')break
  }
  const metrics=await page.evaluate(()=>{
   const values=window.__reviewFrames.slice(10).sort((a,b)=>a-b),sum=values.reduce((a,b)=>a+b,0)
   return {frames:values.length,fps:values.length*1000/sum,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1),over50:values.filter(x=>x>50).length,over100:values.filter(x=>x>100).length,heapMB:performance.memory?.usedJSHeapSize/1048576}
  })
  await page.evaluate(()=>window.__training.capture());await page.screenshot({path:`${dir}/final.jpg`,type:'jpeg',quality:87});pictures.push('final.jpg')
  const pass=errors.length===0&&final.course===theme&&(part==='a'||final.seed===Number(seed))&&(smoke?shot:final.status==='landed'&&final.phase==='complete'&&final.next===5&&final.resultsOpen)
  await writeFile(`${dir}/run.json`,JSON.stringify({theme,seed,part,smoke,pass,errors,knownFallback,pictures,metrics,build,final,samples},null,2)+'\n')
  console.log('RESULT',JSON.stringify({theme,seed,part,smoke,pass,metrics}))
  await context.close()
  if(!pass)throw Error(`Failed ${theme} ${seed}`)
 }
}finally{await browser.close()}
