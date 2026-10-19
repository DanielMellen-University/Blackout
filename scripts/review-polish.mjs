import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dir = process.argv[2] || 'docs/reviews/polish-10.946'
const label = process.argv[3] || 'before'
await mkdir(`${dir}/matched-${label}`, { recursive: true })
const hook = (await readFile('scripts/browser-flight-issues.js', 'utf8')) + `
window.__polish = { camera: mode => cameras.setMode(mode, aircraft), state: () => ({camera:cameras.mode, altitude:document.querySelector('#alt-meter')?.outerHTML, lights:['navLightLeft','navLightRight'].map(name=>{const node=aircraft.mesh?.getObjectByName(name);return node?{name,x:node.position.x,color:node.material.color.getHex()}:null}),weather:{...world.atmosphere.weatherSnapshot}}) };`
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface'] })
const errors=[],views=[]
try {
 for (const seed of (process.env.POLISH_SEEDS || '31415,27182').split(',').map(Number)) {
  const flight=JSON.parse(await readFile(`${dir}/before/${seed}.json`,'utf8'))
  for (const target of (process.env.POLISH_TARGETS || '5,60,300,600').split(',').map(Number)) {
   const sample=flight.samples.reduce((a,b)=>Math.abs(a.seconds-target)<Math.abs(b.seconds-target)?a:b)
   const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(120000)
   page.on('pageerror',e=>errors.push(String(e)))
   page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
   await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
   await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();let source=await response.text();source=source.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;').replace('const tick = (nowMs) => {',hook+'\nconst tick = (nowMs) => {').replace('aircraft.step(dt, nowMs);','window.__issues.before();\naircraft.step(dt, nowMs);');await route.fulfill({response,body:'import {timeOfDayForSeed as issueSeedTime} from "/src/world/WeatherDirector.ts";\nimport {sampleTerrainHeight as issueTerrain} from "/src/world/terrainSample.ts";\n'+source})})
   await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+`/?course=free-flight&seed=${seed}`)
   await page.waitForFunction(()=>window.__polish);await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'})
   await page.evaluate(s=>window.__issues.place(s),sample);await page.waitForTimeout(5000)
   for (const mode of ['chase','cockpit']) {
    await page.evaluate(mode=>window.__polish.camera(mode),mode);await page.waitForTimeout(500)
    const file=`${seed}-${target}-${mode}.png`;await page.screenshot({path:`${dir}/matched-${label}/${file}`});const state=await page.evaluate(()=>window.__polish.state());if(label.endsWith('after')){assert.match(state.altitude,/AGL/);assert.match(state.altitude,/above ground/);assert.ok(state.lights[0].x>0&&state.lights[1].x<0);assert.equal(state.lights[0].color,0xff3333);assert.equal(state.lights[1].color,0x55ffad)}views.push({seed,target,sample,file,...state})
   }
   await page.close()
  }
 }
 const sourceHashes=Object.fromEntries(await Promise.all(['src/aircraft/createF35Model.ts','src/world/CloudMaterial.ts','src/ui/HUD.ts','index.html'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
 await writeFile(`${dir}/matched-${label}/views.json`,JSON.stringify({method:'Static reproductions of recorded flight poses. Identical seeded regional clock and held aircraft, real production camera and renderer. Separate from controls-only endurance evidence.',sourceHashes,errors,views},null,2)+'\n')
 if(errors.length)throw Error(errors.join('\n'))
} finally {await browser.close()}
