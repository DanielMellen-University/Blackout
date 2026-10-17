const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import { writeFile } from 'node:fs/promises'
const directory=process.argv[2]??'docs/reviews/roads-10.919',label=process.argv[3]??'after'
const results=[], errors=[]
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try {
 for(const [seed,destination,progress] of [[73,'coastalvillage',900],[1,'village',650]]) {
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/dev/terrain.html?seed=${seed}&destination=${destination}`)
  await page.selectOption('#weather','clear')
  await page.waitForFunction(()=>/[1-9]\d* regional roads/.test(document.querySelector('#stats')?.textContent??''))
  await page.click('#road-tour');await page.locator('#road-height').fill('30');await page.locator('#road-height').dispatchEvent('input')
  for (const position of [progress,500]) {
   await page.locator('#road-progress').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))},position)
   for(const mode of ['chase','first']) {
    await page.selectOption('#review-view',mode);await page.waitForTimeout(8000)
    const pose=await page.locator('#road-status').textContent()
    if(!pose?.includes('km')) throw new Error('Road pose was lost during capture')
    const filename=`${label}-${destination}-${position}-${mode}.png`;await page.screenshot({path:`${directory}/${filename}`})
    results.push({seed,destination,position,mode,filename,pose:await page.locator('#road-status').textContent(),stats:await page.locator('#stats').textContent()});console.log(filename,results.at(-1).pose)
   }
  }
  await page.close()
 }
}finally {await browser.close();await writeFile(`${directory}/${label}-visual.json`,JSON.stringify({results,errors},null,2)+'\n')}
