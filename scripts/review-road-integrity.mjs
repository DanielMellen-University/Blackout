// Actual resident coastal road views, separate from timing and offline surveys.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory=process.argv[2] || 'docs/reviews/roads-10.927',label=process.argv[3] || 'after'
const integrity = process.env.ROAD_INTEGRITY ? JSON.parse(await readFile(process.env.ROAD_INTEGRITY,'utf8')) : null
if(process.env.ROAD_SIDE_VIEW&&!integrity)throw Error('Side views require ROAD_INTEGRITY crossing stations')
const survey=JSON.parse(await readFile(process.argv[4] || `${directory}/${label}.json`,'utf8'))
const fixed=JSON.parse(await readFile(process.env.COAST_VIEW_FIXTURES || process.argv[4] || `${directory}/${label}.json`,'utf8'))
await mkdir(directory,{recursive:true});const results=[],errors=[]
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 const targets=integrity ? integrity.seeds.map(seed=>{const r=integrity.rows.filter(r=>r.seed===seed&&r.kind==='regional').sort((a,b)=>b.worst.score-a.worst.score)[0];return {...fixed.sites.find(s=>s.seed===seed&&s.id===r.site),audit:r}}) : process.env.COAST_VIEW_SITES ? process.env.COAST_VIEW_SITES.split(';').map(key=>{const [seed,id]=key.split('/');const site=fixed.sites.find(s=>s.seed===Number(seed)&&s.id===id);if(!site)throw Error('Missing coastal fixture '+key);return site}) : survey.seeds.map(seed=>fixed.sites.find(s=>s.seed===seed&&!s.links.length)||fixed.sites.find(s=>s.seed===seed))
 for(const target of targets){
  const seed=target.seed
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
 pose:(id,mode,key,fraction,station)=>{
  const connection=key?world.settlements.connections.get(key):[...world.settlements.connections.values()].find(c=>c.from.id===id||c.to.id===id);
  const plan=world.settlements.loadedCollisionPlans.find(p=>p.id===id);
  const road=connection?.road||plan?.roads.filter(r=>r.points.length>1).sort((a,b)=>b.points.length-a.points.length)[0];
  if(!road)throw Error('No resident road at '+id);
  clearRoadTrace(); roadTrace=new RoadReviewPath(road);roadTraceKey=connection?(connection.from.id+'|'+connection.to.id):'local/'+id;
  if(${!!process.env.ROAD_SIDE_VIEW}){const sample=roadTrace.sampleInto.bind(roadTrace);roadTrace.sampleInto=(out,...args)=>{sample(out,...args);const x=out.x,z=out.z,yaw=out.yaw;out.x-=Math.cos(yaw)*120+Math.sin(yaw)*180;out.z+=Math.sin(yaw)*120-Math.cos(yaw)*180;out.y=Math.max(out.y+10,args[2](out.x,out.z)+40);out.yaw=Math.atan2(x-out.x,z-out.z)}}
  roadDistance=roadTrace.length*(fraction??(connection?(connection.from.id === id ? .05 : .95):.5));if(station!==undefined){roadDistance=0;for(let i=1;i<=station;i++)roadDistance+=Math.hypot(road.points[i].x-road.points[i-1].x,road.points[i].z-road.points[i-1].z)}tracingRoad=false;roadTraceDirty=true;tracingRiver=false;weatherTraceDirty=false;flying=false;
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
  for(const spot of (process.env.ROAD_SPOTS||'worst,join').split(','))for(const mode of ['chase','cockpit']){
   const road=await page.evaluate(({id,mode,key,fraction,station})=>window.__coast.pose(id,mode,key,fraction,station),{id:site.id,mode,key:target.audit?.key||site.links[0]||null,fraction:spot==='worst'?null:.998,station:spot==='worst'?target.audit.worst.index:undefined});await page.waitForTimeout(15000)
   const filename=`${label}-${seed}-${spot}-${target.id.replaceAll(',','_')}-${mode}.png`;await page.locator('nav').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:`${directory}/${filename}`});await page.locator('nav').evaluate(e=>e.style.visibility='')
   const state=await page.evaluate(()=>window.__coast.state());if(process.env.ROAD_SIDE_VIEW&&!state.connections.includes(target.audit.key))throw Error('Crossing mesh departed');if(state.seed!==seed||state.ratio!==1||state.camera!==mode||(site.links.length&&state.road!==(target.audit?.key||site.links[0])))throw Error('Wrong review pose')
   views.push({filename,state,road})
  }
  results.push({seed,site,views});await page.close();console.log('CAPTURED',seed,site.id,views.map(v=>v.road.key))
  await writeFile(`${directory}/${label}-views.json`,JSON.stringify({viewport:[1280,720],pixelRatio:1,clearance:30,sideView:!!process.env.ROAD_SIDE_VIEW,results,errors},null,2)+'\n')
 }
 if(errors.length)throw Error(errors.join('\n'))
}finally{await browser.close()}
