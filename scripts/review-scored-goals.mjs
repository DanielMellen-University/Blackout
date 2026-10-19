import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/missions-10.943/goals'
await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const states=[],errors=[]
try{
 for(const suite of ['after','daily-final']){
  const data=JSON.parse(await readFile(`docs/reviews/missions-10.943/${suite}/runs.json`,'utf8')),last=data.runs.filter(r=>r.final).at(-1).final
  const context=await browser.newContext({viewport:{width:1280,height:720}})
  const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript(storage=>{for(const [k,v]of Object.entries(storage))localStorage.setItem(k,v);HTMLElement.prototype.requestFullscreen=async()=>{}},last.score.storage)
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5174');await page.locator('#startup-screen').waitFor({state:'hidden'})
  const course=last.course
  await page.locator(`#title-course-picker [role=radio][data-course-id="${course}"]`).click()
  const goal=await page.locator('#title-course-picker .course-picker-goal').innerText()
  assert.match(goal,/Beat your .* best time/)
  const expected=last.score.result.bestTimeSec
  const time=await page.evaluate(id=>JSON.parse(localStorage.getItem('blackout.history.'+id)).bestTimeSec,last.score.active.recordId)
  assert.equal(time,expected)
  await page.screenshot({path:`${dir}/${course}-time-goal.png`})
  await page.locator('#title-course-picker details summary').first().click()
  await page.screenshot({path:`${dir}/${course}-records.png`})
  states.push({course,goal,expectedTime:expected,actualTime:time,recordId:last.score.active.recordId})
  await context.close()
 }
 assert.deepEqual(errors,[])
 await writeFile(dir+'/goals.json',JSON.stringify({method:'Reopen actual completed-flight localStorage snapshots in fresh browser contexts, inspect the ordinary picker and expand its record disclosure.',states,errors},null,2)+'\n')
}finally{await browser.close()}
