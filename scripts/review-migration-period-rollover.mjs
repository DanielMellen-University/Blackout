import {chromium} from '/tmp/blackout-b19-tools/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'
import {writeFile,mkdir,readFile}from'node:fs/promises'
const browser=await chromium.launch({headless:true,executablePath:'/snap/bin/chromium',args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000)
 await page.addInitScript(()=>{const NativeDate=Date,origin=NativeDate.now(),base=Date.UTC(2026,9,20,23,59,40);window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[base+NativeDate.now()-origin]))}static now(){return base+NativeDate.now()-origin}};localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
 await page.goto('http://127.0.0.1:5176/?course=daily-ops&seed=42');await page.waitForFunction(()=>window.__training)
 await page.locator('#startup-screen').waitFor({state:'hidden'});const before=await page.evaluate(()=>({date:new Date().toISOString(),state:window.__training.state()}))
 await page.waitForTimeout(22000);await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'})
 const after=await page.evaluate(()=>({date:new Date().toISOString(),state:window.__training.state()}))
 const build=JSON.parse(await readFile(`docs/reviews/generator/hooks-build/hooks/${await page.evaluate(()=>window.__training.buildId)}.json`,'utf8'))
 assert.notEqual(before.date.slice(0,10),after.date.slice(0,10));assert.equal(after.state.seed,after.state.missionSettings.seed)
 const dir='docs/reviews/generator/migration-period-rollover';await mkdir(dir,{recursive:true})
 await writeFile(`${dir}/after.json`,JSON.stringify({pass:true,method:'Controlled initial calendar near UTC midnight, then natural wall-clock advance and normal Play click. No flight clock, pose, gate or score writes. Separate from timing.',build,before,after},null,2)+'\n')
 console.log({beforeDate:before.date,afterDate:after.date,worldSeed:after.state.seed,periodSeed:after.state.missionSettings.seed,detail:after.state.missionSettings.detail,match:after.state.seed===after.state.missionSettings.seed})
}finally{await browser.close()}
