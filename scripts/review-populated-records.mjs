import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dir=process.argv[2]||'docs/reviews/missions-10.943/retention'
await mkdir(dir,{recursive:true})
const completed=JSON.parse(await readFile('docs/reviews/missions-10.943/daily-final/runs.json','utf8')).runs.find(r=>r.final?.course==='daily-ops').final.score
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const states=[],errors=[]
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(()=>{HTMLElement.prototype.requestFullscreen=async()=>{}})
 const observer=`window.__records=()=>({active:activeSortie,protected:[...protectedRecords],replay:courseSession.replayRecordId,storage:{...localStorage},paused:menu.paused});`
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();const source=(await response.text()).replace('const tick = (nowMs) => {',observer+'\nconst tick = (nowMs) => {');await route.fulfill({response,body:source})})
 const url=process.env.REVIEW_URL||'http://127.0.0.1:5174'
 await page.goto(url+'/?course=training-orbit');await page.waitForFunction(()=>window.__records);await page.locator('#startup-screen').waitFor({state:'hidden'})
 const fixture=await page.evaluate(async completed=>{
  const lib=await import('/src/systems/CourseLibrary.ts'),prefixes=['best','history','streak','badges','trace','ghost']
  const sourceId=completed.active.recordId
  const payloads=Object.fromEntries(prefixes.map(p=>[p,completed.storage['blackout.'+p+'.'+sourceId]]).filter(([,v])=>v!==undefined))
  if(Object.keys(payloads).length<5)throw Error('Need populated flight records')
  localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced')
  const old=lib.courseRunId(lib.courseDefinitionForId('daily-ops'),Date.UTC(2026,8,1))
  const ids=[old,...Array.from({length:14},(_,i)=>lib.courseRunId(lib.courseDefinitionForId('daily-ops'),Date.UTC(2026,9,i+1)))]
  for(const id of ids)for(const [p,v]of Object.entries(payloads))localStorage.setItem('blackout.'+p+'.'+id,v)
  for(const [p,v]of Object.entries(payloads))localStorage.setItem('blackout.'+p+'.seed:77:orbit',v)
  for(const [p,v]of Object.entries(payloads))localStorage.setItem('blackout.'+p+'.seed:999:orbit:daily:2026-09-01',v)
  return {old,ids,payloads}
 },completed)
 async function snap(label){const state=await page.evaluate(()=>window.__records());states.push({label,state});await page.screenshot({path:dir+'/'+label+'.png'});return state}
 await page.goto(url+'/?course=daily-ops&day=2026-09-01');await page.waitForFunction(()=>window.__records);await page.locator('#startup-screen').waitFor({state:'hidden'})
 const pinned=await snap('protected-populated-replay')
 for(const [p,v]of Object.entries(fixture.payloads)){
  assert.equal(pinned.storage['blackout.'+p+'.'+fixture.old],v)
  assert.equal(pinned.storage['blackout.'+p+'.seed:999:orbit:daily:2026-09-01'],undefined)
 }
 await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await snap('active-historical')
 await page.keyboard.press('Escape');await page.locator('[data-settings-tab=course]').click();await page.locator('#menu-course-picker [data-course-id="training-orbit"][role=radio]').click()
 const selected=await snap('pin-released-active-protected');assert.equal(selected.replay,null);assert.ok(selected.protected.includes(fixture.old))
 await page.locator('#menu-new-world').click();await page.locator('#startup-screen').waitFor({state:'hidden'});const released=await snap('historical-family-pruned')
 for(const [p,v]of Object.entries(fixture.payloads)){
  assert.equal(released.storage['blackout.'+p+'.'+fixture.old],undefined)
  assert.equal(released.storage['blackout.'+p+'.seed:77:orbit'],v)
  for(const id of fixture.ids.slice(1))assert.equal(released.storage['blackout.'+p+'.'+id],v)
 }
 await page.reload();await page.waitForFunction(()=>window.__records);await page.locator('#startup-screen').waitFor({state:'hidden'});const durable=await snap('durable-after-reload')
 for(const p of Object.keys(fixture.payloads))assert.equal(durable.storage['blackout.'+p+'.'+fixture.old],undefined)
 assert.deepEqual(errors,[])
 await writeFile(dir+'/records.json',JSON.stringify({method:'Clone actual completed Daily payloads into historical and recent record families, then exercise normal replay, launch, pending selection and new-world DOM actions. Only fixture population writes storage.',fixture,states,errors},null,2)+'\n')
} finally {await browser.close()}
