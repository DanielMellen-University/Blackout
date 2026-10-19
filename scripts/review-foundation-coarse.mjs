// Reproduce the exact 10.930 production Free-flight city pose and startup path.
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const dir=process.argv[2]||'docs/reviews/foundations-10.935',label=process.argv[3]||'coarse-after'
await mkdir(dir,{recursive:true})
const hook=await readFile('scripts/browser-flight-issues.js','utf8')
const sample=JSON.parse(await readFile('docs/reviews/flights-10.930/issues-after.json','utf8')).results.find(r=>r.seed===1337).sample
const scan=`
window.__issues.floors=()=>{
 const cases=[];
 for(const {plan,root}of world.settlements.loaded.values())for(const b of plan.buildings){
  let floor=b.y;
  for(const mesh of root.children.filter(o=>o.isInstancedMesh&&o.material===world.settlements.walls)){
   const a=mesh.instanceMatrix.array;
   for(let i=0;i<mesh.count;i++){const j=i*16;if(Math.abs(a[j+12]+plan.x-b.x)<.1&&Math.abs(a[j+14]+plan.z-b.z)<.1)floor=Math.min(floor,a[j+13]+plan.y-a[j+5]*.5)}
  }
  const h=world.terrain.sampleMeshHeight(b.x,b.z);
  cases.push({id:plan.id,x:b.x,z:b.z,base:b.y,floor,rendered:h,gap:h===null?null:floor-h,baseGap:h===null?null:b.y-h,visible:root.visible});
 }
 cases.sort((a,b)=>(b.gap??Infinity)-(a.gap??Infinity));
 return {cases,position:aircraft.position.toArray(),camera:cameras.mode,ratio:renderer.getPixelRatio(),stats:world.terrain.streamingStats};
};window.__issues.mode=m=>cameras.setMode(m,aircraft);`
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const results=[],errors=[]
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});page.setDefaultTimeout(180000)
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text())})
 await page.addInitScript(()=>{localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();let s=await response.text()
  s=s.replace(/const fixedReviewRatio = [^;]+;/,'const fixedReviewRatio = 1;').replace('const tick = (nowMs) => {',hook+'\n'+scan+'\nconst tick = (nowMs) => {').replace('aircraft.step(dt, nowMs);','window.__issues.before();\naircraft.step(dt, nowMs);')
  await route.fulfill({response,body:'import {timeOfDayForSeed as issueSeedTime} from "/src/world/WeatherDirector.ts";\nimport {sampleTerrainHeight as issueTerrain} from "/src/world/terrainSample.ts";\n'+s})
 })
 await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:5173'}/?course=free-flight&seed=1337`)
 await page.waitForFunction(()=>window.__issues);await page.locator('#btn-play').click();await page.waitForTimeout(5000)
 await page.evaluate(s=>window.__issues.place(s),sample);await page.waitForTimeout(25000)
 for(const mode of ['chase','cockpit']){
  await page.evaluate(m=>window.__issues.mode(m),mode);await page.waitForTimeout(3000)
  const file=`${label}-${mode}.png`;await page.screenshot({path:`${dir}/${file}`})
  const scan=await page.evaluate(()=>window.__issues.floors());results.push({seed:1337,sample,mode,file,scan});console.log(file,Math.max(...scan.cases.filter(c=>c.visible).map(c=>c.gap??0)))
 }
}finally{await browser.close();await writeFile(`${dir}/${label}.json`,JSON.stringify({results,errors},null,2)+'\n')}
if(errors.length)throw Error(errors.join('\n'))
