import {mkdir,writeFile,readFile} from 'node:fs/promises'
const {chromium}=await import('/tmp/blackout-b19-tools/node_modules/playwright/index.mjs')
const course=process.env.REVIEW_COURSE||'canyon-run',seed=process.env.REVIEW_SEEDS||'1337'
const dir=`docs/reviews/generator/migration-d-coverage/live-fenced-${course}-${seed}`;await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/snap/bin/chromium',args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try {
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page)
 await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
 await page.goto(`http://127.0.0.1:5176/?course=${course}&seed=${seed}`);await page.waitForFunction(()=>window.__training)
 const code=await page.evaluate(()=>window.__training.capture.toString()),worldName=code.match(/([\w$]+)\.scene/)[1],cameraName=code.match(/([\w$]+)\.camera/)[1]
 const renderName=code.match(new RegExp('([\\w$]+)\\('+worldName.replace(/\$/g,'\\$')+'\\.scene'))[1]
 const {result:fn}=await cdp.send('Runtime.evaluate',{expression:'window.__training.capture'})
 const details=await cdp.send('Runtime.getProperties',{objectId:fn.objectId})
 const scopeId=details.internalProperties.find(p=>p.name==='[[Scopes]]').value.objectId
 const scopes=await cdp.send('Runtime.getProperties',{objectId:scopeId,ownProperties:true})
 let worldId,cameraId,renderId
 for(const s of scopes.result){if(!s.value?.objectId||s.name==='length')continue
  const scope=await cdp.send('Runtime.getProperties',{objectId:s.value.objectId,ownProperties:true})
  worldId ||=scope.result.find(p=>p.name===worldName)?.value?.objectId
  cameraId ||=scope.result.find(p=>p.name===cameraName)?.value?.objectId
  renderId ||=scope.result.find(p=>p.name===renderName)?.value?.objectId
  if(worldId&&cameraId&&renderId)break
 }
 const bound=await cdp.send('Runtime.getProperties',{objectId:renderId});const rendererId=bound.internalProperties.find(p=>p.name==='[[BoundThis]]').value.objectId
 if(!worldId||!cameraId)throw Error('Could not resolve read-only observer closure')
 const observe=function(cameras){
  const p=this.aircraft?.position,camera=cameras.camera,terrain=this.terrain,all=[...terrain.chunks.values(),...terrain.retiring]
  const tile=c=>({key:c.key,cx:c.cx,cz:c.cz,size:c.size,alpha:c.alpha,fadeAge:c.fadeAge,visible:c.terrainMesh.visible,rootVisible:c.root.visible,attached:!!c.root.parent,opacity:c.terrainMesh.material.opacity,depthWrite:c.terrainMesh.material.depthWrite,retiring:terrain.retiring.includes(c)})
  const tilesAt=(x,z)=>all.filter(c=>x>=c.cx*420&&x<(c.cx+c.size)*420&&z>=c.cz*420&&z<(c.cz+c.size)*420).map(tile)
  const points=[]
  for(let y=350;y<=470;y+=30)for(let x=80;x<=1200;x+=80){
   const origin=camera.position.clone(),direction=origin.clone().set(x/640-1,1-y/360,.5).unproject(camera).sub(origin).normalize()
   if(direction.y>=0){points.push({x,y,sky:true});continue}
   let t=(this.runway.position.y-origin.y)/direction.y,point
   for(let i=0;i<4;i++){point=origin.clone().addScaledVector(direction,t);const h=terrain.sampleMeshHeight(point.x,point.z);if(h===null)break;t=(h-origin.y)/direction.y}
   points.push({x,y,point:point.toArray(),tiles:tilesAt(point.x,point.z)})
  }
  return {points,retiring:terrain.retiring.map(tile)}
 }
 const inspect=async()=>{const r=await cdp.send('Runtime.callFunctionOn',{objectId:worldId,functionDeclaration:observe.toString(),arguments:[{objectId:cameraId}],returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 await page.locator('#startup-screen').waitFor({state:'hidden'});await page.locator('#btn-play').click();await page.waitForFunction(()=>window.__training.state().playing)
 await page.evaluate(()=>window.__training.start())
 const samples=[];let state
 for(let n=0;n<500;n++){
  await page.waitForTimeout(100);state=await page.evaluate(()=>window.__training.state());samples.push({seconds:state.seconds,position:state.position,coverage:state.coverage,stream:state.stream})
  if(state.seconds>10&&!state.coverage)samples.at(-1).detail=await inspect()
  if(state.next>=1)break
 }
 const captures=[]
 for(const camera of ['chase','cockpit']){
  await page.evaluate(mode=>window.__training.camera(mode),camera);await page.waitForTimeout(250);await page.evaluate(()=>window.__training.capture())
  await page.screenshot({path:`${dir}/${camera}.jpg`,type:'jpeg',quality:90})
  await page.evaluate(()=>{window.__training.setRenderInterval(1000000);window.__training.capture()})
  const fence=await cdp.send('Runtime.callFunctionOn',{objectId:rendererId,functionDeclaration:'function(){const gl=this.getContext();const start=performance.now();gl.finish();return {ms:performance.now()-start,attributes:gl.getContextAttributes()}}',returnByValue:true})
  await page.screenshot({path:`${dir}/${camera}-completed.jpg`,type:'jpeg',quality:90})
  captures.push({camera,fence:fence.result.value,detail:await inspect(),state:await page.evaluate(()=>window.__training.state())})
  await page.evaluate(()=>window.__training.setRenderInterval(0))
 }
 const build=JSON.parse(await readFile('docs/reviews/generator/hooks-build/browser-build.json','utf8'))
 await writeFile(`${dir}/audit.json`,JSON.stringify({method:'Original production review bundle. Read-only CDP closure inspection, native clock, ordinary controls-only pilot. Excluded from timing.',course,seed,build,samples,captures},null,2)+'\n')
 console.log(course,seed,'coverage misses',samples.filter(s=>s.seconds>10&&!s.coverage).length)
}finally{await browser.close()}
