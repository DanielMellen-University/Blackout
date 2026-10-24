// Review-only instrumentation. Controls pilot and RAF observer, no flight-state
// writes after the real airborne launch. Visual capture is a separate run.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { build, preview } from 'vite'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/blackout-b32-tools/node_modules/playwright/index.mjs')
const capture = process.env.REVIEW_CAPTURE === '1'
const dir = 'docs/reviews/perfect-line-b32'
await mkdir(dir, { recursive: true })
const pilot = (await readFile('scripts/browser-generator.js', 'utf8')).split('window.__training.catalog=')[0]
const hook = `${pilot}\nwindow.__line = { state: () => ({...window.__training.state(),elapsed:perfectLineElapsed,finished:perfectLineFinished,active:perfectLineActive,nitro:{...aircraft.nitro}}),stop:()=>training.active=false,finished:()=>perfectLineFinished };`
const sourceHashes=Object.fromEntries(await Promise.all(['src/main.ts','src/world/PerfectLine.ts','src/world/Landforms.ts','src/world/World.ts','src/systems/Mission.ts','src/ui/HUD.ts','src/style.css','index.html'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))
const outDir = '/tmp/blackout-b32-production'
await build({build:{outDir,emptyOutDir:true},plugins:[{
  name:'perfect-line-review',enforce:'pre',transform(source,id) {
    if(!id.endsWith('/src/main.ts'))return
    if(!source.includes('const tick = (nowMs: number): void => {'))throw Error('Missing review anchor')
    return ('import { sampleTerrainSurfaceHeightFast as b21Ground } from "./world/terrainSample";\n'+source)
      .replace('const tick = (nowMs: number): void => {',hook+'\nconst tick = (nowMs: number): void => {')
      .replace('aircraft.step(dt, nowMs)','if (!perfectLineFinished) window.__training.before(dt); aircraft.step(dt, nowMs)')
  }
}]})
const server = await preview({build:{outDir},preview:{host:'127.0.0.1',port:5175,strictPort:true}})
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/snap/bin/chromium',args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try {
  const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
  const errors = [], samples = []
  page.setDefaultTimeout(120000)
  page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.goto('http://127.0.0.1:5175/')
  await page.waitForFunction(()=>window.__line)
  await page.locator('#startup-screen').waitFor({state:'hidden'})
  const storageBefore=await page.evaluate(()=>({...localStorage}))
  await page.locator('#btn-perfect-line').focus()
  await page.keyboard.press('Enter')
  await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.evaluate(()=>{window.__training.start();window.__frames=[];window.__heap=[];let last=performance.now();const observe=now=>{if(!window.__line.finished()){window.__frames.push(now-last);last=now;requestAnimationFrame(observe)}};requestAnimationFrame(observe)})
  for(let i=0;i<110;i++) {
    await page.waitForTimeout(1000)
    const state=await page.evaluate(()=>{if(performance.memory)window.__heap.push(performance.memory.usedJSHeapSize);return window.__line.state()})
    samples.push({elapsed:state.elapsed,next:state.next,speed:state.speed,agl:state.agl,status:state.status,position:state.position})
    if(i%10===0)console.log(JSON.stringify(samples.at(-1)))
    if(capture && [3,30,60].includes(i))await page.screenshot({path:`${dir}/flight-${i}.png`})
    if(state.finished || state.status==='crashed')break
  }
  const final=await page.evaluate(()=>window.__line.state())
  const metrics=await page.evaluate(()=>({peakFrameMs:Math.max(...window.__frames),frames:window.__frames.length,over50:window.__frames.filter(x=>x>50).length,over100:window.__frames.filter(x=>x>100).length,peakHeapMB:Math.max(...window.__heap)/1048576}))
  await page.evaluate(()=>window.__line.stop())
  if(capture)await page.screenshot({path:`${dir}/finish.png`})
  const storageAfter=await page.evaluate(()=>({...localStorage}))
  const changedKeys=[...new Set([...Object.keys(storageBefore),...Object.keys(storageAfter)])].filter(k=>storageBefore[k]!==storageAfter[k])
  await page.keyboard.press('r')
  const retry=await page.evaluate(()=>window.__line.state())
  // Return through the ordinary menu, then launch the selected scored mission.
  await page.keyboard.press('Escape');await page.locator('#menu-quit').click()
  await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'})
  const ordinary=await page.evaluate(()=>window.__line.state())
  const pass=final.finished&&final.next===15&&final.total===15&&final.nitro.gateRefills===15&&final.status==='ok'&&!final.onGround&&final.elapsed>=60&&final.elapsed<=90&&changedKeys.length===0&&retry.active&&retry.elapsed<.5&&retry.next===0&&retry.seed===32026&&!ordinary.active&&ordinary.total>=15&&!errors.length
  const result={pass,capture,method:'1280x720 balanced Chromium Vulkan, production Vite build with external review hooks, ordinary launch and controls-only existing pilot. Native RAF intervals after launch panel closes, sampled heap. Capture runs are not timing acceptance.',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes,hookSha256:createHash('sha256').update(hook).digest('hex'),metrics,frames:await page.evaluate(()=>window.__frames),changedKeys,errors,final,retry,ordinary,samples}
  await writeFile(`${dir}/${capture?'visual':'timing'}.json`,JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify({pass,metrics,changedKeys,errors,elapsed:final.elapsed,retry:retry.elapsed,ordinaryGates:ordinary.total}))
  if(!pass)process.exitCode=1
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
