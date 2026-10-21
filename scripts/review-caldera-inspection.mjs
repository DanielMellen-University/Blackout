import { mkdir, readFile, writeFile } from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/blackout-b19-tools/node_modules/playwright/index.mjs')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/snap/bin/chromium',args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 for(const seed of [73,808,2026]){
  const dir=`docs/reviews/generator/polish-c-calderas/${seed}`;await mkdir(dir,{recursive:true})
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),errors=[]
  page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)))
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
  await page.goto(`http://127.0.0.1:5176/?course=generated-volcanic-run&seed=${seed}`)
  await page.waitForFunction(()=>window.__training)
  await page.locator('#startup-screen').waitFor({state:'hidden'});await page.locator('#btn-play').click();await page.locator('#startup-screen').waitFor({state:'hidden'})
  await page.evaluate(()=>window.__training.start())
  await page.waitForFunction(()=>window.__training.state().seconds>=20&&window.__training.state().next>=1)
  const camera=await page.evaluate(()=>{document.getElementById('overlay').style.visibility='hidden';return window.__training.inspectCaldera()});await page.waitForTimeout(500)
  await page.screenshot({path:`${dir}/caldera.jpg`,type:'jpeg',quality:90})
  const final=await page.evaluate(()=>window.__training.state()),id=await page.evaluate(()=>window.__training.buildId)
  const build=JSON.parse(await readFile(`docs/reviews/generator/hooks-build/hooks/${id}.json`,'utf8'))
  await writeFile(`${dir}/view.json`,JSON.stringify({seed,diagnostic:true,timingEligible:false,completionEligible:false,camera,errors,build,final},null,2)+'\n')
  if(errors.length)throw Error(errors.join('\n'))
  await context.close();console.log('CALDERA',seed)
 }
}finally{await browser.close()}
