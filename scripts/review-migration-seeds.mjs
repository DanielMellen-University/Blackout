// Normal UI controls and read-only observations. Separate from flight timing.
import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile}from'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/blackout-b19-tools/node_modules/playwright/index.mjs')
const browser=await chromium.launch({headless:true,executablePath:'/snap/bin/chromium',args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const course=process.env.MIGRATION_SEED_COURSE || 'training-orbit'
const explicit=process.env.MIGRATION_EXPLICIT_SEED==='1'
const states=[],errors=[]
let build
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(120000)
 page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(course=>{
  localStorage.setItem('blackout.course-selection',course);localStorage.setItem('blackout.renderQuality','balanced')
  HTMLElement.prototype.requestFullscreen=async()=>{}
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text}}})
 },course)
 const launch=async()=>{await page.locator('#startup-screen').waitFor({state:'hidden'});await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'});await page.waitForFunction(()=>window.__training.state().playing)}
 const state=async(label)=>{const s=await page.evaluate(()=>window.__training.state());states.push({label,state:s});return s}
 await page.goto('http://127.0.0.1:5176/'+(explicit?`?course=${course}&seed=42`:''));await page.waitForFunction(()=>window.__training);build=JSON.parse(await readFile(`docs/reviews/generator/hooks-build/hooks/${await page.evaluate(()=>window.__training.buildId)}.json`,'utf8'));await launch()
 const first=await state(explicit?'explicit-replay':'random-launch');assert.equal(first.course,course);assert.ok(Number.isFinite(first.missionSettings.contractSeed));if(explicit)assert.equal(first.seed,42)
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__training.state().paused);await page.locator('#menu-retry').click();await page.locator('#startup-screen').waitFor({state:'hidden'})
 const retry=await state('retry');assert.equal(retry.seed,first.seed);assert.equal(retry.recordId,first.recordId);assert.equal(retry.modifier,first.modifier);assert.deepEqual(retry.gates,first.gates)
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__training.state().paused);await page.locator('#menu-new-world').click()
 const next=await state('new-world');assert.notEqual(next.seed,first.seed);assert.notEqual(next.recordId,first.recordId);assert.equal(next.missionSettings.contractSeed,first.missionSettings.contractSeed)
 await page.keyboard.press('y');await page.waitForFunction(()=>window.__copied)
 const link=await page.evaluate(()=>window.__copied);const url=new URL(link);assert.equal(url.searchParams.get('course'),course);assert.equal(Number(url.searchParams.get('seed')),next.seed)
 await page.goto(link);await page.waitForFunction(()=>window.__training);await launch()
 const replay=await state('copied-link-replay');assert.equal(replay.seed,next.seed);assert.equal(replay.recordId,next.recordId);assert.equal(replay.modifier,next.modifier);assert.deepEqual(replay.gates,next.gates)
 assert.deepEqual(errors,[])
 const dir=`docs/reviews/generator/migration-seed-lifecycle/${course}-${explicit?'replay':'random'}`;await mkdir(dir,{recursive:true})
 await writeFile(`${dir}/run.json`,JSON.stringify({pass:true,build,method:'Normal UI launch, pause/retry, new-world and copied-link replay; read-only observer. No pilot or clock writes. Separate from all timing acceptance.',errors,states,link},null,2)+'\n')
 console.log('PASS',course,explicit?'explicit replay':'random launch','retry, new seed, copied-link replay')
}finally{await browser.close()}
