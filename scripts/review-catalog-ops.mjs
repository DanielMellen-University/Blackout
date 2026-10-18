import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/catalog-10.934'
await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const records=[],errors=[]
const observer=`window.__catalog={state:()=>({wallClock:Date.now(),selected:selectedCourseId,definition:selectedCourse(),active:activeSortie,seed:world.worldSeed,profile:world.mission.routeProfile,replay:courseSession.replayRecordId,protectedRecords:[...protectedRecords],paused:menu.paused,playing,position:aircraft.position.toArray(),phase:challenge.phase,selectedTitle:document.querySelector('#title-course-picker [role=radio][aria-checked=true]')?.dataset.courseId,selectedPause:document.querySelector('#menu-course-picker [role=radio][aria-checked=true]')?.dataset.courseId,detail:document.querySelector('#title-course-picker .course-picker-detail')?.textContent,menuDetail:document.querySelector('#menu-course-picker .course-picker-detail')?.textContent})};`
await writeFile(dir+'/observer.js',observer+'\n')
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const sourceHashes=Object.fromEntries(await Promise.all(['src/main.ts','src/core/CourseSession.ts','src/ui/CoursePicker.ts'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
const save=async()=>writeFile(dir+'/browser.json',JSON.stringify({sourceCommit,sourceHashes,method:'Read-only observer, normal DOM clicks and keys. Controlled initial wall clock then natural elapsed time; no catalog/session mutations.',errors,records},null,2)+'\n')
async function open(query,base){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(120000)
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
 await page.addInitScript(base=>{
  const NativeDate=Date,origin=NativeDate.now()
  window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[base+NativeDate.now()-origin]))}static now(){return base+NativeDate.now()-origin}}
  localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}
 },base)
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();let source=await response.text();assert.ok(source.includes('const tick = (nowMs) => {'));source=source.replace('const tick = (nowMs) => {',observer+'\nconst tick = (nowMs) => {').replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;');await route.fulfill({response,body:source})})
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5174')+'/'+query);await page.waitForFunction(()=>window.__catalog);await page.locator('#startup-screen').waitFor({state:'hidden'});return page
}
async function snap(page,label){const state=await page.evaluate(()=>window.__catalog.state());await page.screenshot({path:`${dir}/${label}.png`});records.push({label,state});await save();console.log(label,state.selected,state.active.recordId,state.replay,state.paused);return state}
const select=async(page,root,id)=>page.locator(`${root} [role=radio][data-course-id="${id}"]`).click()
async function pause(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__catalog.state().paused)}
async function launch(page){await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await page.waitForFunction(()=>window.__catalog.state().playing&&!window.__catalog.state().paused)}
try{
 const page=await open('',Date.UTC(2026,9,18,23,59,30))
 await select(page,'#title-course-picker','daily-ops');const old=await snap(page,'rollover-before');assert.ok(old.definition.detail.includes('2026-10-18'))
 for(let i=0;i<7;i++){await page.waitForTimeout(10000);console.log('long-open',i+1)}
 const rolled=await snap(page,'rollover-after');assert.ok(rolled.definition.detail.includes('2026-10-19'));assert.ok(rolled.detail.includes('2026-10-19'));assert.notEqual(old.definition.seed,rolled.definition.seed);assert.equal(old.seed,rolled.seed);assert.deepEqual(old.position,rolled.position);assert.equal(rolled.selected,'daily-ops')
 await launch(page);const live=await snap(page,'daily-launch');assert.equal(live.active.periodKey,'2026-10-19');assert.equal(live.seed,rolled.definition.seed)
 await pause(page);await page.locator('[data-settings-tab=course]').click();await select(page,'#menu-course-picker','training-orbit');const pending=await snap(page,'paused-selection');assert.equal(pending.selected,'training-orbit');assert.equal(pending.active.recordId,live.active.recordId);assert.equal(pending.seed,live.seed)
 await page.locator('#menu-resume').click();await page.waitForFunction(()=>!window.__catalog.state().paused);const resumed=await snap(page,'resumed');assert.equal(resumed.active.recordId,live.active.recordId);assert.equal(resumed.seed,live.seed)
 await pause(page);await page.locator('#menu-retry').click();await page.locator('#startup-screen').waitFor({state:'hidden'});const retry=await snap(page,'retry');assert.equal(retry.active.recordId,live.active.recordId);assert.equal(retry.seed,live.seed);assert.equal(retry.selected,'training-orbit')
 await pause(page);await page.locator('#menu-new-world').click();const next=await snap(page,'new-selection-launch');assert.equal(next.active.course.id,'training-orbit');assert.equal(next.seed,1);await page.close()
 for(const [kind,key,value] of [['daily-ops','day','2026-09-01'],['weekly-ops','week','2026-W36'],['monthly-ops','month','2026-09']]){
  const p=await open(`?course=${kind}&${key}=${value}`,Date.UTC(2026,9,19,12))
  const pinned=await snap(p,`${key}-historical`);assert.ok(pinned.replay?.includes(value));assert.ok(pinned.definition.detail.includes(value));await launch(p)
  const historical=await snap(p,`${key}-launched`);assert.equal(historical.active.periodKey,value)
  await pause(p);await p.locator('[data-settings-tab=course]').click();await select(p,'#menu-course-picker','training-orbit');const released=await snap(p,`${key}-released`);assert.equal(released.replay,null);assert.equal(released.active.recordId,historical.active.recordId);assert.ok(released.protectedRecords.includes(historical.active.recordId))
  await p.locator('#menu-retry').click();await p.locator('#startup-screen').waitFor({state:'hidden'});const retried=await snap(p,`${key}-historical-retry`);assert.equal(retried.active.recordId,historical.active.recordId)
  await pause(p);await p.locator('#menu-new-world').click();const changed=await snap(p,`${key}-new-training`);assert.equal(changed.active.course.id,'training-orbit');assert.ok(!changed.protectedRecords.includes(historical.active.recordId));await p.close()
 }
 const p=await open('?course=daily-ops&day=2026-09-01',Date.UTC(2026,9,19,12))
 await p.locator('#title-seed-input').fill('73');await p.locator('#title-seed-load').click();const custom=await snap(p,'custom-seed-releases-replay');assert.equal(custom.selected,'random');assert.equal(custom.replay,null);await launch(p);const seeded=await snap(p,'custom-seed-launched');assert.equal(seeded.seed,73);assert.equal(seeded.active.course.id,'random');await p.close()
 assert.deepEqual(errors,[])
}finally{await save();await browser.close()}
console.log('PASS',records.length,'browser states')
