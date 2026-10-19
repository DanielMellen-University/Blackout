import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/contour-10.944',states=[],errors=[]
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 for(const seed of [42,73,808]){
  const data=JSON.parse(await readFile(`${dir}/seed-${seed}/runs.json`,'utf8')),f=data.runs.find(r=>r.final).final
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript(storage=>{if(!localStorage.getItem('__reviewLoaded')){for(const [k,v]of Object.entries(storage))localStorage.setItem(k,v);localStorage.setItem('__reviewLoaded','1')}HTMLElement.prototype.requestFullscreen=async()=>{}},f.score.storage)
  const observer=`window.__contourUI=()=>({seed:world.worldSeed,active:activeSortie,pin:replaySeed,goal:document.querySelector('#title-course-picker .course-picker-goal')?.innerText,storage:{...localStorage}});`
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('const tick = (nowMs) => {',observer+'\nconst tick = (nowMs) => {');await route.fulfill({response,body})})
  await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+`/?course=contour-circuit&seed=${seed}`);await page.waitForFunction(()=>window.__contourUI);await page.locator('#startup-screen').waitFor({state:'hidden'})
  const state=await page.evaluate(()=>window.__contourUI());assert.equal(state.seed,seed);assert.equal(state.active.course.seed,seed);assert.match(state.goal,/Beat your .* best time/)
  assert.equal(state.storage[`blackout.history.seed:${seed}:contour`],f.score.storage[`blackout.history.seed:${seed}:contour`])
  await page.screenshot({path:`${dir}/seed-${seed}-replay-goal.png`});states.push({label:'replay-goal',...state})
  await page.reload();await page.waitForFunction(()=>window.__contourUI);await page.locator('#startup-screen').waitFor({state:'hidden'});assert.match((await page.evaluate(()=>window.__contourUI())).goal,/Beat your .* best time/)
  if(seed===73){
   await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});const launched=await page.evaluate(()=>window.__contourUI());assert.equal(launched.pin,73);assert.equal(launched.active.recordId,'seed:73:contour');assert.match(launched.goal,/Beat your .* best time/)
   await page.keyboard.press('Escape');await page.locator('#menu-retry').click();await page.locator('#startup-screen').waitFor({state:'hidden'});assert.equal((await page.evaluate(()=>window.__contourUI())).active.recordId,'seed:73:contour')
   await page.keyboard.press('Escape');await page.locator('[data-settings-tab=course]').click();await page.locator('#menu-course-picker [role=radio][data-course-id="training-orbit"]').click();const pending=await page.evaluate(()=>window.__contourUI());assert.equal(pending.pin,null);assert.equal(pending.active.recordId,'seed:73:contour');states.push({label:'pin-released-active-retained',...pending})
   await page.locator('#menu-new-world').click();await page.locator('#startup-screen').waitFor({state:'hidden'});const changed=await page.evaluate(()=>window.__contourUI());assert.equal(changed.seed,1);assert.equal(changed.active.course.id,'training-orbit');states.push({label:'new-selection-launched',...changed});await page.screenshot({path:`${dir}/released-training.png`})
  }
  await context.close()
 }
 assert.deepEqual(errors,[])
 await writeFile(dir+'/replay-ui.json',JSON.stringify({method:'Load actual completed-flight storage once per context, verify ordinary replay catalog, reload without reinjection, then use DOM launch, retry, selection and new world to verify pin lifetime. No flight-state writes.',states,errors},null,2)+'\n')
}finally{await browser.close()}
