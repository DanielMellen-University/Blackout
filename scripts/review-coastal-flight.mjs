import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/coastal-flight-10.936',label=process.argv[3]||'before'
await mkdir(`${dir}/${label}`,{recursive:true})
const routes=JSON.parse(await readFile(`${dir}/routes.json`,'utf8')).routes.filter(r=>!process.env.COAST_FLIGHT_SEEDS||process.env.COAST_FLIGHT_SEEDS.split(',').includes(String(r.seed)))
const hook=await readFile('scripts/browser-coastal-flight.js','utf8')
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 for(const route of routes){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(180000)
  const errors=[],samples=[],stills=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
  await page.route('**/dev/terrain.html*',async r=>{const response=await r.fetch(),s=await response.text();await r.fulfill({response,body:r.request().url().includes('html-proxy')?'import {terrainEdgeJoin as coastalJoin} from "/src/world/TerrainSeams.ts";\nimport {coastField as coastalField} from "/src/world/Coastline.ts";\n'+s.replace('  world.atmosphere.timeOfDay=reviewDay','  window.__coastal.before(dt);\n  world.atmosphere.timeOfDay=reviewDay')+'\n'+hook:s})})
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/dev/terrain.html`);await page.waitForFunction(()=>window.__coastal)
  await page.evaluate(r=>window.__coastal.prepare(r),route);await page.selectOption('#weather','clear');await page.waitForTimeout(25000)
  await page.locator('nav').evaluate(e=>e.style.visibility='hidden');const start=Date.now();let nextStill=0,nextScan=0
  await page.evaluate(()=>window.__coastal.start())
  while(true){
   const state=await page.evaluate(()=>window.__coastal.state())
   if(state.seed!==route.seed||state.activeCamera!==state.camera||state.ratio!==1)throw Error('Incorrect runtime camera/seed')
   if(state.elapsed>=nextScan){const scan=await page.evaluate(()=>window.__coastal.scan());samples.push(scan);nextScan=state.elapsed+3}
   if(state.elapsed>=nextStill||!state.running){
    const file=`${route.seed}-${String(Math.round(state.elapsed)).padStart(3,'0')}-${state.camera}.png`;await page.screenshot({path:`${dir}/${label}/${file}`});stills.push({file,...state});console.log(label,route.seed,state.elapsed.toFixed(1),state.camera,'failures',samples.at(-1)?.failures);nextStill+=30
   }
   if(!state.running)break
   await page.waitForTimeout(300)
  }
  const record={seed:route.seed,routeHash:createHash('sha256').update(JSON.stringify(route)).digest('hex'),hookHash:createHash('sha256').update(hook).digest('hex'),runtime:await page.evaluate(()=>Object.fromEntries(['queueEdgeJoins','publishEdgeJoins','drainBuildQueue'].map(k=>[k,String(window.__coastal.runtime()[k])]))),wallSeconds:(Date.now()-start)/1000,seconds:route.seconds,viewport:[1280,720],samples,stills,errors}
  await writeFile(`${dir}/${label}/${route.seed}.json`,JSON.stringify(record,null,2)+'\n');await page.close()
  if(errors.length)throw Error(errors.join('\n'))
 }
}finally{await browser.close()}
