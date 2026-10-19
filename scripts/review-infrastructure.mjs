// Final fixed-pose visual review using the production chase/cockpit rig.
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const directory=process.argv[2]||'docs/reviews/infrastructure-10.942'
await mkdir(directory,{recursive:true})
const survey=JSON.parse(await readFile('docs/reviews/roads-10.939/coverage.json','utf8'))
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const results=process.env.REVIEW_RESUME?JSON.parse(await readFile(`${directory}/views.json`,'utf8')).results:[],errors=[]
try{
 for(const seed of (process.env.REVIEW_SEEDS||'42,73,808,1337').split(',').map(Number))for(const kind of (process.env.REVIEW_KINDS||'city,shore').split(',')){
  const site=survey.sites.find(s=>s.seed===seed),[cx,cz]=site.id.split(',').map(Number)
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,permissions:['local-network-access']});page.setDefaultTimeout(180000)
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.route('**/dev/terrain.html*',async route=>{
   const response=await route.fetch();let source=await response.text()
   if(route.request().url().includes('html-proxy')){
    const anchor=/coastalvillage:\s*\[73,\s*-5,\s*-3\]/;if(!anchor.test(source))throw Error('Coastal destination anchor changed')
    source=source.replace(anchor,`coastalvillage:[${seed},${cx},${cz}]`)
    source+=`
window.__infrastructure={
 pose:(kind,mode)=>{
  clearRoadTrace();flying=tracingRiver=weatherTraceDirty=false;reviewMode='infrastructure-review';
  const city=kind==='city'?findSettlementNear(5,-1,'city'):null;
  if(kind==='city'&&!city)throw Error('No generated review city');
  const focus=city?city.buildings.reduce((a,b)=>Math.hypot(b.x-city.x,b.z-city.z)<Math.hypot(a.x-city.x,a.z-city.z)?b:a):{x:${site.x},z:${site.z}};
  let x=focus.x,z=focus.z,yaw=Math.PI*.5;
  if(kind==='city'){x-=800;z+=300;yaw=Math.atan2(focus.x-x,focus.z-z)}
  else{
   let low=Infinity;
   for(let i=0;i<32;i++){const a=i/32*Math.PI*2,h=sampleTerrainHeight(x+Math.sin(a)*1800,z+Math.cos(a)*1800);if(h<low){low=h;yaw=a}}
   const offset=kind==='coast'?1400:-200;x+=Math.sin(yaw)*offset;z+=Math.cos(yaw)*offset;
  }
  if(city){world.settlements.clearAll();world.settlements.primeAnchors(x,z)}
  const y=city?Math.max(sampleTerrainHeight(x,z)+150,...city.buildings.filter(b=>Math.hypot(b.x-x,b.z-z)<1400).map(b=>b.y+b.height+100)):sampleTerrainHeight(x,z)+90;
  const pitch=city?Math.atan2(y-focus.y-50,Math.hypot(focus.x-x,focus.z-z)):0;
  const pose={x,z,y,yaw,pitch};flightView=true;controls.enabled=false;
  reviewJet.reset(pose);if(pitch)reviewJet.orientation.multiply(reviewJet.orientation.clone().set(Math.sin(pitch/2),0,0,Math.cos(pitch/2)));reviewJet.snapDisplay();chase.setMode(mode,reviewJet);return {...pose,planId:city?.id,focus};
 },
 mode:m=>chase.setMode(m,reviewJet),
 state:()=>({seed:getWorldSeed(),camera:chase.mode,ratio:renderer.getPixelRatio(),position:reviewJet.position.toArray(),settlements:[...world.settlements.loaded.values()].map(v=>({id:v.plan.id,kind:v.plan.kind,buildings:v.plan.buildings.length,roads:v.plan.roads.length,visible:v.root.visible})),stats:world.terrain.streamingStats})
};`
   }
   await route.fulfill({response,body:source})
  })
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5180'}/dev/terrain.html?seed=${seed}&destination=${kind==='city'?'city':'coastalvillage'}`)
  await page.waitForFunction(()=>window.__infrastructure);await page.selectOption('#weather','clear');await page.waitForTimeout(20000)
  const pose=await page.evaluate(k=>window.__infrastructure.pose(k,'chase'),kind);console.log('POSE',seed,kind,pose.planId||site.id);await page.waitForTimeout(20000)
  if(kind==='city')await page.waitForFunction(id=>window.__infrastructure.state().settlements.some(s=>s.id===id&&s.kind==='city'&&s.visible),pose.planId,{timeout:120000})
  for(const mode of ['chase','cockpit']){
   await page.evaluate(m=>window.__infrastructure.mode(m),mode);await page.waitForTimeout(8000)
   await page.locator('nav').evaluate(e=>e.style.visibility='hidden')
   const filename=`${seed}-${kind}-${mode}.png`;await page.screenshot({path:`${directory}/${filename}`})
   const state=await page.evaluate(()=>window.__infrastructure.state())
   if(state.seed!==seed||state.camera!==mode||state.ratio!==1)throw Error('Incorrect visual pose')
   const previous=results.findIndex(r=>r.seed===seed&&r.kind===kind&&r.mode===mode);if(previous>=0)results.splice(previous,1);results.push({seed,kind,mode,filename,pose,state})
  }
  await page.close();console.log('CAPTURED',seed,kind)
  await writeFile(`${directory}/views.json`,JSON.stringify({viewport:[1280,720],pixelRatio:1,results,errors},null,2)+'\n')
 }
 if(errors.length)throw Error(errors.join('\n'))
}finally{await browser.close()}
