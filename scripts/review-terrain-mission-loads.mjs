// Loading smoke only. Mission design and handling are outside b19.
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const records=[]
try{
 for(const course of ['free-flight','training-orbit','daily-ops','contour-circuit','weather-approach','random']){
  const context=await browser.newContext({viewport:{width:1280,height:720},permissions:['local-network-access']}),page=await context.newPage(),errors=[]
  page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.addInitScript(()=>{localStorage.clear();HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.route('**/src/main.ts*',async r=>{const response=await r.fetch(),s=await response.text();assert.ok(s.includes('const tick = (nowMs) => {'));await r.fulfill({response,body:s.replace('const tick = (nowMs) => {',`window.__loadCheck=()=>({course:activeSortie.course.id,profile:activeSortie.course.profile,seed:world.worldSeed,playing,status:aircraft.status});\nconst tick = (nowMs) => {`)})})
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/?course=${course}&seed=73`)
  await page.waitForFunction(()=>window.__loadCheck);await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.locator(`#title-course-picker [role=radio][data-course-id="${course}"]`).click()
  await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.waitForFunction(()=>window.__loadCheck().playing);await page.waitForTimeout(1500)
  const state=await page.evaluate(()=>window.__loadCheck());assert.equal(state.course,course);assert.equal(state.status,'ok');assert.deepEqual(errors,[])
  records.push({requested:course,...state,errors});console.log('LOADED',course,state.seed)
  await context.close()
 }
 await writeFile(`${process.argv[2]||'docs/reviews/terrain-closeout-b19'}/mission-loads.json`,JSON.stringify({method:'DOM select and launch, then observe production playing state. No flight pilot, gate writes, mission polish or completion checks.',records},null,2)+'\n')
}finally{await browser.close()}
