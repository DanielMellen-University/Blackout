// Actual resident coastal road views, separate from timing and offline surveys.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory=process.argv[2] || 'docs/reviews/roads-10.927',label=process.argv[3] || 'after'
const survey=JSON.parse(await readFile(process.argv[4] || `${directory}/${label}.json`,'utf8'))
const fixed=JSON.parse(await readFile(process.env.COAST_VIEW_FIXTURES || process.argv[4] || `${directory}/${label}.json`,'utf8'))
await mkdir(directory,{recursive:true});const results=[],errors=[]
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 for(const seed of survey.seeds){
  const target=fixed.sites.find(s=>s.seed===seed&&!s.links.length)||fixed.sites.find(s=>s.seed===seed)
  const site=survey.sites.find(s=>s.seed===seed&&s.id===target.id),[cx,cz]=site.id.split(',').map(Number)
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,permissions:['local-network-access']});page.setDefaultTimeout(180000)
  page.on('pageerror',e=>errors.push(String(e)))
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().replace(/([?&]token=)[^&\s'"]+/g,'$1[redacted]'))})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.route('**/dev/terrain.html*',async route=>{
   const response=await route.fetch(),source=await response.text()
   if(!route.request().url().includes('html-proxy')){await route.fulfill({response});return}
   const pattern=/coastalvillage:\s*\[73,\s*-5,\s*-3\]/
   if(!pattern.test(source))throw Error('Coastal destination anchor changed')
   const hook=`
window.__coast = {
 state:()=>({seed:getWorldSeed(),camera:chase.mode,ratio:renderer.getPixelRatio(),jet:reviewJet.position.toArray(),road:roadTraceKey,stats:world.terrain.streamingStats,connections:[...world.settlements.connections.keys()]}),
 pose:(id,mode,key)=>{
  const connection=key?world.settlements.connections.get(key):[...world.settlements.connections.values()].find(c=>c.from.id===id||c.to.id===id);
  const plan=world.settlements.loadedCollisionPlans.find(p=>p.id===id);
  const road=connection?.road||plan?.roads.filter(r=>r.points.length>1).sort((a,b)=>b.points.length-a.points.length)[0];
  if(!road)throw Error('No resident road at '+id);
  clearRoadTrace(); roadTrace=new RoadReviewPath(road);roadTraceKey=connection?(connection.from.id+'|'+connection.to.id):'local/'+id;
  roadDistance=roadTrace.length*(connection?(connection.from.id === id ? .05 : .95):.5);tracingRoad=false;roadTraceDirty=true;tracingRiver=false;weatherTraceDirty=false;flying=false;
  document.querySelector('#road-height').value='30';document.querySelector('#review-view').value=mode==='cockpit'?'first':'chase';flightView=true;controls.enabled=false;
  return {key:roadTraceKey,length:roadTrace.length,progress:roadDistance/roadTrace.length};
 }
};`
   await route.fulfill({response,body:source.replace(pattern,`coastalvillage:[${seed},${cx},${cz}]`)+hook})
  })
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/dev/terrain.html?seed=${seed}&destination=coastalvillage`)
  await page.waitForFunction(()=>window.__coast)
  await page.selectOption('#weather','clear');await page.waitForTimeout(25000)
  if(site.links.length)await page.waitForFunction(keys=>window.__coast.state().connections.some(key=>keys.includes(key)),site.links,{timeout:120000})
  const views=[]
  for(const mode of ['chase','cockpit']){
   const road=await page.evaluate(({id,mode,key})=>window.__coast.pose(id,mode,key),{id:site.id,mode,key:site.links[0]||null});await page.waitForTimeout(7000)
   const filename=`${label}-${seed}-${mode}.png`;await page.locator('nav').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:`${directory}/${filename}`});await page.locator('nav').evaluate(e=>e.style.visibility='')
   const state=await page.evaluate(()=>window.__coast.state());if(state.seed!==seed||state.ratio!==1||state.camera!==mode||(site.links.length&&!site.links.includes(state.road)))throw Error('Wrong review pose')
   views.push({filename,state,road})
  }
  results.push({seed,site,views});await page.close();console.log('CAPTURED',seed,site.id,views.map(v=>v.road.key))
  await writeFile(`${directory}/${label}-views.json`,JSON.stringify({viewport:[1280,720],pixelRatio:1,clearance:30,results,errors},null,2)+'\n')
 }
 if(errors.length)throw Error(errors.join('\n'))
}finally{await browser.close()}
