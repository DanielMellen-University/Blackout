// Fixed production-camera terrain/road/coast inspection. Run separately from performance captures.
import {mkdir,writeFile,readFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory=process.argv[2],label=process.argv[3]||'before'
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
let results=[],errors=[],consoleErrors=[];try{const previous=JSON.parse(await readFile(`${directory}/${label}.json`,'utf8'));results=previous.results}catch{}
try{
 for(const [seed,destination] of [[42,'alpine'],[2026,'mesa'],[9001,'green'],[808,'volcano']].filter(([seed])=>!process.env.POLISH_SEEDS||process.env.POLISH_SEEDS.split(',').includes(String(seed)))){
  if(!process.env.POLISH_STAGE&&results.filter(r=>r.seed===seed).length>=8){console.log('SKIP',seed);continue}
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
  page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE',String(e))})
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().replace(/([?&]token=)[^&\s'\"]+/g,'$1[redacted]'))})
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
  await page.route('**/dev/terrain.html*',async r=>{
   const response=await r.fetch(),source=await response.text()
   if(!r.request().url().includes('html-proxy')){await r.fulfill({response});return}
   await r.fulfill({response,body:source+String.raw`
window.__polish={
 state:()=>({climate:sampleClimate(controls.target.x,controls.target.z),seed:getWorldSeed(),target:controls.target.toArray(),jet:reviewJet.position.toArray(),camera:chase.mode,biome:sampleClimate(controls.target.x,controls.target.z).biome,stats:world.terrain.streamingStats}),
 pose:(x,z,yaw,clearance=90,mode='chase')=>{clearRoadTrace();flying=false;tracingRiver=false;weatherTraceDirty=false;reviewMode='polish';flightView=true;controls.enabled=false;const h=world.terrain.sampleMeshHeight(x,z)??sampleTerrainHeight(x,z);reviewJet.reset({x,y:h+clearance,z,yaw});reviewJet.snapDisplay();chase.setMode(mode,reviewJet);controls.target.set(x,h,z)},
 landscape:(kind)=>{const allowed=kind==='alpine'?['mountain','snow']:kind==='mesa'?['mesa','desert']:kind==='volcano'?['volcanic']:['plains','hills','forest'];const p=findLandscapeTarget(controls.target.x,controls.target.z,c=>allowed.includes(c.biome),c=>1+(c.landform.ridge??0)+(c.landform.plateau??0)*.4);if(!Number.isFinite(p.value))throw new Error('Biome destination missing '+kind);frameWorld({x:p.x,z:p.z,y:sampleTerrainHeight(p.x,p.z)});return p},
 clearYaw:(p,preferred,agl)=>{const h=sampleTerrainHeight(p.x,p.z)+agl;const score=yaw=>Math.max(...[100,200,400,800,1600].map(d=>(sampleTerrainHeight(p.x+Math.sin(yaw)*d,p.z+Math.cos(yaw)*d)-h)/d));if(score(preferred)<.12)return preferred;return [preferred+Math.PI/2,preferred-Math.PI/2,preferred+Math.PI].sort((a,b)=>score(a)-score(b))[0]},
 road:()=>{let route=world.settlements.nearestRoadReview(controls.target.x,controls.target.z);if(!route){const plans=[...world.settlements.loadedCollisionPlans].sort((a,b)=>Math.hypot(a.x-controls.target.x,a.z-controls.target.z)-Math.hypot(b.x-controls.target.x,b.z-controls.target.z)||a.id.localeCompare(b.id));const plan=plans.find(p=>p.roads.some(r=>r.points.length>=2));const road=plan?.roads.filter(r=>r.points.length>=2).sort((a,b)=>b.points.length-a.points.length)[0];if(road)route={key:'local/'+plan.id,road}}if(!route)throw new Error('No resident road available');roadTrace=new RoadReviewPath(route.road);roadTraceKey=route.key;roadDistance=roadTrace.length*.5;tracingRoad=false;roadTraceDirty=true;tracingRiver=false;weatherTraceDirty=false;flying=false;return {key:route.key,length:roadTrace.length}},
 coastResolve:p=>{
  const wet=(x,z)=>{const c=sampleClimate(x,z);return c.biome==='ocean'&&c.height<(c.waterLevel??0)-1};
  for(const distance of [100,300,600,1000,1800,3000,6000,12000,24000,48000])for(let i=0;i<48;i++){
   const yaw=i/48*Math.PI*2,dx=Math.sin(yaw)*distance,dz=Math.cos(yaw)*distance;
   if(!wet(p.x+dx,p.z+dz))continue;
   let coast={...p};
   if(distance>800){let lo=0,hi=1;for(let j=0;j<16;j++){const t=(lo+hi)/2;if(wet(p.x+dx*t,p.z+dz*t))hi=t;else lo=t}const t=Math.max(0,lo-75/distance);coast={...p,x:p.x+dx*t,z:p.z+dz*t}}
   frameWorld({x:coast.x,z:coast.z,y:sampleTerrainHeight(coast.x,coast.z)});return {coast,yaw,waterSearchDistance:distance};
  }
  throw new Error('No actual sea shoreline found for review');
 },
 coastPlace:p=>{frameWorld({x:p.x,z:p.z,y:sampleTerrainHeight(p.x,p.z)});return p},
 coast:()=>{const p=findLandscapeTarget(controls.target.x,controls.target.z,c=>c.coastal>.2&&c.land>.1&&c.height>0&&c.height<100,c=>1-Math.abs(c.height-20)*.01);frameWorld({x:p.x,z:p.z,y:sampleTerrainHeight(p.x,p.z)});return p},
 seams:()=>{const vertices=new Map(),worst=[];let mixed=0,maxColor=0,maxNormal=0,maxHeight=0;for(const c of world.terrain.chunks.values()){if(c.fadingOut||c.alpha<.99)continue;const color=c.terrainMesh.geometry.getAttribute('color'),normal=c.terrainMesh.geometry.getAttribute('normal'),step=420*c.size/c.segs;for(let iz=0;iz<=c.segs;iz++)for(let ix=0;ix<=c.segs;ix++){if(ix&&iz&&ix<c.segs&&iz<c.segs)continue;const i=iz*(c.segs+1)+ix;if(c.heights[i]<=c.waterLevels[i]+2)continue;const x=c.originX+ix*step,z=c.originZ+iz*step;if(Math.hypot(x-controls.target.x,z-controls.target.z)>7000)continue;const key=x.toFixed(3)+','+z.toFixed(3);const b={x,z,job:[c.originX,c.originZ,c.lod,c.size],lod:c.lod,step,height:c.heights[i],color:[color.getX(i),color.getY(i),color.getZ(i)],normal:[normal.getX(i),normal.getY(i),normal.getZ(i)]},a=vertices.get(key);if(a&&a.step!==b.step){mixed++;const colorJump=Math.max(...a.color.map((v,i)=>Math.abs(v-b.color[i]))),normalJump=Math.hypot(...a.normal.map((v,i)=>v-b.normal[i])),heightJump=Math.abs(a.height-b.height);maxColor=Math.max(maxColor,colorJump);maxNormal=Math.max(maxNormal,normalJump);maxHeight=Math.max(maxHeight,heightJump);worst.push({x,z,colorJump,normalJump,heightJump,steps:[a.step,b.step],jobs:[a.job,b.job]})}else vertices.set(key,b)}}worst.sort((a,b)=>b.colorJump-a.colorJump);return {mixed,maxColor,maxNormal,maxHeight,worst:worst.slice(0,8)}}};
`})
  })
  console.log('NAVIGATE',seed,destination)
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/dev/terrain.html?seed=${seed}&destination=${destination}`)
  await page.waitForFunction(()=>window.__polish);console.log('READY',seed)
  await page.selectOption('#weather','clear')
  if(process.env.POLISH_STAGE==='coast'){
   const record=results.find(r=>r.seed===seed&&r.kind==='coast')
   const resolved=await page.evaluate(p=>window.__polish.coastResolve(p),record.coast)
   const coast=resolved.coast,yaw=resolved.yaw
   await page.evaluate(({coast,yaw})=>window.__polish.pose(coast.x,coast.z,yaw,90,'chase'),{coast,yaw});await page.waitForTimeout(18000)
   for(const mode of ['chase','cockpit']){
    await page.evaluate(({coast,yaw,mode})=>window.__polish.pose(coast.x,coast.z,yaw,90,mode),{coast,yaw,mode});await page.waitForTimeout(8000)
    const filename=`${label}-${seed}-coast-${mode}.png`;await page.locator('nav').evaluate(el=>el.style.visibility='hidden');await page.screenshot({path:`${directory}/${filename}`});await page.locator('nav').evaluate(el=>el.style.visibility='')
    results=results.filter(r=>r.filename!==filename);results.push({seed,kind:'coast',coast,yaw,mode,filename,state:await page.evaluate(()=>window.__polish.state())});console.log(filename)
   }
   await page.close();await writeFile(`${directory}/${label}.json`,JSON.stringify({results,errors,consoleErrors},null,2)+'\n');continue
  }
  await page.waitForTimeout(20000)
  const target=await page.evaluate(kind=>window.__polish.landscape(kind),destination);await page.waitForTimeout(18000)
  const initial=await page.evaluate(()=>window.__polish.state())
  const seams=await page.evaluate(()=>window.__polish.seams())
  for(const [kind,p,preferred,agl] of [['landscape',target,.7,160],['seam',target,Math.atan2((seams.worst[0]?.x??target.x+1)-target.x,(seams.worst[0]?.z??target.z)-target.z),160]]){
   if(process.env.POLISH_STAGE&&kind!==process.env.POLISH_STAGE)continue
   const frozen=label==='after'?JSON.parse(await readFile(`${directory}/before.json`,'utf8')).results.find(r=>r.seed===seed&&r.kind===kind&&r.mode==='cockpit'):null
   const yaw=frozen?.yaw??(seed===42&&kind==='seam'?await page.evaluate(({p,preferred,agl})=>window.__polish.clearYaw(p,preferred,agl),{p,preferred,agl}):preferred)
   for(const mode of ['chase','cockpit']){
    await page.evaluate(({p,yaw,agl,mode})=>window.__polish.pose(p.x,p.z,yaw,agl,mode),{p,yaw,agl,mode})
    await page.waitForTimeout(10000)
    const filename=`${label}-${seed}-${kind}-${mode}.png`
    await page.locator('nav').evaluate(el=>el.style.visibility='hidden');await page.screenshot({path:`${directory}/${filename}`});await page.locator('nav').evaluate(el=>el.style.visibility='')
    results=results.filter(r=>r.filename!==filename);results.push({seed,destination,kind,filename,mode,clearance:agl,position:p,yaw,state:await page.evaluate(()=>window.__polish.state()),seams:kind==='seam'?seams:undefined,initial});console.log(filename)
   }
  }
  if(process.env.POLISH_STAGE){await page.close();await writeFile(`${directory}/${label}.json`,JSON.stringify({results,errors,consoleErrors},null,2)+'\n');continue}
  await page.selectOption('#destination','village');await page.waitForTimeout(20000)
  const road=await page.evaluate(()=>window.__polish.road());await page.locator('#road-height').fill('30');await page.locator('#road-height').dispatchEvent('input')
  await page.locator('#road-progress').evaluate(el=>{el.value='500';el.dispatchEvent(new Event('input',{bubbles:true}))})
  for(const mode of ['chase','first']){
   await page.selectOption('#review-view',mode);await page.waitForTimeout(8000)
   const pose=await page.locator('#road-status').textContent();if(!pose?.includes('km'))throw new Error('Road pose missing '+seed)
   const filename=`${label}-${seed}-road-${mode}.png`;await page.locator('nav').evaluate(el=>el.style.visibility='hidden');await page.screenshot({path:`${directory}/${filename}`});await page.locator('nav').evaluate(el=>el.style.visibility='')
   results.push({seed,destination:'village',kind:'road',filename,mode,clearance:30,road,pose,state:await page.evaluate(()=>window.__polish.state())});console.log(filename)
  }
  let coast,coastYaw
  if(label==='after'){
   const frozen=JSON.parse(await readFile(`${directory}/before.json`,'utf8')).results.find(r=>r.seed===seed&&r.kind==='coast')
   coast=await page.evaluate(p=>window.__polish.coastPlace(p),frozen.coast);coastYaw=frozen.yaw
  }else{const search=await page.evaluate(()=>window.__polish.coast());const resolved=await page.evaluate(p=>window.__polish.coastResolve(p),search);coast=resolved.coast;coastYaw=resolved.yaw}
  await page.waitForTimeout(18000)
  for(const mode of ['chase','cockpit']){
   await page.evaluate(({coast,coastYaw,mode})=>window.__polish.pose(coast.x,coast.z,coastYaw,90,mode),{coast,coastYaw,mode});await page.waitForTimeout(8000)
   const filename=`${label}-${seed}-coast-${mode}.png`;await page.locator('nav').evaluate(el=>el.style.visibility='hidden');await page.screenshot({path:`${directory}/${filename}`});await page.locator('nav').evaluate(el=>el.style.visibility='')
   results.push({seed,kind:'coast',coast,yaw:coastYaw,mode,filename,state:await page.evaluate(()=>window.__polish.state())});console.log(filename)
  }
  await page.close();await writeFile(`${directory}/${label}.json`,JSON.stringify({results,errors,consoleErrors},null,2)+'\n')
 }
}finally{await browser.close();await writeFile(`${directory}/${label}.json`,JSON.stringify({results,errors,consoleErrors},null,2)+'\n')}
if(errors.length)throw new Error(errors.join('\n'))
