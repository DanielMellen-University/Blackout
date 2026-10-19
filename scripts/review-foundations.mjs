// Prescribed low-altitude production-camera poses, plus actual instance floors.
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/foundations-10.935',label=process.argv[3]||'after'
await mkdir(dir,{recursive:true})
const prior=label.startsWith('before')?null:JSON.parse(await readFile(`${dir}/${label.replace(/^after/,'before')}.json`,'utf8'))
const historical=process.env.FOUNDATION_POSE==='historical'?JSON.parse(await readFile('docs/reviews/flights-10.930/issues-after.json','utf8')).results.find(r=>r.seed===1337).sample:null
const hook=`
window.__foundation={
 pose:(p,mode)=>{
  clearRoadTrace();flying=tracingRiver=weatherTraceDirty=false;reviewMode='foundation-review';
  if(!p){const t=controls.target,d=settlementKind==='city'?2200:500;p={x:t.x-d,z:t.z+150,y:sampleTerrainHeight(t.x-d,t.z+150)+90,yaw:Math.PI*.5}}
  flightView=true;controls.enabled=false;reviewJet.reset(p);reviewJet.snapDisplay();chase.setMode(mode,reviewJet);return p;
 },
 scan:()=>{
  const cases=[];
  for(const {plan,root}of world.settlements.loaded.values()){
   const meshes=root.children.filter(o=>o.isInstancedMesh&&o.material===world.settlements.walls);
   for(const b of plan.buildings){
    let floor=b.y,top=b.y+b.height;
    for(const mesh of meshes){const a=mesh.instanceMatrix.array;for(let i=0;i<mesh.count;i++){
     const j=i*16;if(Math.abs(a[j+12]+plan.x-b.x)>.1||Math.abs(a[j+14]+plan.z-b.z)>.1)continue;
     floor=Math.min(floor,a[j+13]+plan.y-a[j+5]*.5);
    }}
    let rendered=Infinity,points=0;const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
    for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++){
     const x=ix*b.width*.5,z=iz*b.depth*.5,h=world.terrain.sampleMeshHeight(b.x+c*x+s*z,b.z-s*x+c*z);
     if(h!==null){rendered=Math.min(rendered,h);points++}
    }
    let perimeterMin=Infinity,perimeterPoints=0;
    for(let side=0;side<4;side++)for(let k=0;k<=16;k++){
     const u=k/16-.5,x=(side%2?u:(side===0?-.5:.5))*b.width,z=(side%2?(side===1?-.5:.5):u)*b.depth;
     const h=world.terrain.sampleMeshHeight(b.x+c*x+s*z,b.z-s*x+c*z);
     if(h!==null){perimeterMin=Math.min(perimeterMin,h);perimeterPoints++}
    }
    const lod=world.terrain.chunkStats(Math.floor(b.x/420),Math.floor(b.z/420));
    cases.push({id:plan.id,x:b.x,z:b.z,base:b.y,floor,top,rendered:points===9?rendered:null,points,
      perimeterGap:perimeterPoints===68?floor-perimeterMin:null,perimeterPoints,gap:points===9?floor-rendered:null,baseGap:points===9?b.y-rendered:null,visible:root.visible,lod});
   }
  }
  cases.sort((a,b)=>(b.gap??Infinity)-(a.gap??Infinity));
  return {position:reviewJet.position.toArray(),camera:chase.mode,ratio:renderer.getPixelRatio(),stats:world.terrain.streamingStats,cases};
 }
};`
// sampleMeshDetail is named by the public on-demand terrain API.
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const results=[],errors=[]
try{
 for(const seed of (process.env.FOUNDATION_SEEDS||'1337,73,42').split(',').map(Number)){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(180000)
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
  await page.route('**/dev/terrain.html*',async route=>{const response=await route.fetch(),s=await response.text();await route.fulfill({response,body:route.request().url().includes('html-proxy')?s.replace(/coastalvillage:\s*\[73,\s*-5,\s*-3\]/, 'coastalvillage:['+seed+','+(seed===42?'4,-4':'-5,-3')+']')+'\n'+hook:s})})
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/dev/terrain.html?seed=${seed}&destination=${seed===1337?'city':'coastalvillage'}`)
  await page.waitForFunction(()=>window.__foundation);await page.selectOption('#weather','clear');await page.waitForTimeout(15000)
  const fixture=prior?.results.find(r=>r.seed===seed)?.pose??(historical?{x:historical.position[0],y:historical.position[1],z:historical.position[2],yaw:historical.attitude.heading}:null)
  const pose=await page.evaluate(p=>window.__foundation.pose(p,'chase'),fixture);await page.waitForTimeout(25000)
  for(const mode of ['chase','cockpit']){
   await page.evaluate(({pose,mode})=>window.__foundation.pose(pose,mode),{pose,mode});await page.waitForTimeout(5000)
   await page.locator('nav').evaluate(e=>e.style.visibility='hidden')
   const file=`${label}-${seed}-${mode}.png`;await page.screenshot({path:`${dir}/${file}`})
   const scan=await page.evaluate(()=>window.__foundation.scan());results.push({seed,pose,mode,file,scan});console.log(file,'visible',scan.cases.filter(c=>c.visible).length,'maxGap',Math.max(...scan.cases.filter(c=>c.visible).map(c=>c.gap??0)))
  }
  await page.close();await writeFile(`${dir}/${label}.json`,JSON.stringify({hookSha256:createHash('sha256').update(hook).digest('hex'),results,errors},null,2)+'\n')
 }
}finally{await browser.close()}
if(errors.length)throw Error(errors.join('\n'))
