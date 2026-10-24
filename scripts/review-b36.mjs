// Review hooks are injected only into a separate /tmp production build.
// The pilot writes controls only; pose, reserve, gates and clocks stay native.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { build, preview } from 'vite'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/blackout-b32-tools/node_modules/playwright/index.mjs')
const gateOnly = process.argv.includes('--gate')
const dir = `${process.env.HOME}/codex-runs`
await mkdir(dir, { recursive: true })
const pilot = (await readFile('scripts/browser-generator.js', 'utf8')).split('window.__training.catalog=')[0]
const hook = `if(new URLSearchParams(location.search).get('dev')==='b36'){
${pilot}
let boostStarted=false;
window.__b36={
 start:()=>window.__training.start(),
 before:dt=>{
  if(!training.active)return;
  if(activeSortie.course.id!=='free-flight'){window.__training.before(dt);return}
  training.seconds+=dt;
  const c=aircraft.controls,pose=attitudeFromOrientation(aircraft.orientation);
  if(aircraft.altitudeAgl>1500)boostStarted=true;
  c.pitch=trainClamp((.55-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1);
  if(aircraft.onGround)c.pitch=aircraft.speed>38?.85:0;
  c.roll=trainClamp(-pose.roll*2+aircraft.angularVelocity.z*.4,-1,1);
  c.yaw=0;c.throttle=1;c.boost=boostStarted&&!aircraft.nitro.depleted;
  c.airbrake=false;c.gearDown=aircraft.altitudeAgl<12;c.stabilityAssist=false;
 },
 state:()=>({...window.__training.state(),nitro:{...aircraft.nitro},
  gateDistance:world.mission.activeGatePos()?.distanceTo(aircraft.position)??null})
};}`
const outDir='/tmp/blackout-b36-production'
await build({build:{outDir,emptyOutDir:true},plugins:[{
 name:'b36-external-review',enforce:'pre',transform(source,id){
  if(!id.endsWith('/src/main.ts'))return
  for(const anchor of ['const tick = (nowMs: number): void => {','aircraft.step(dt, nowMs)'])assert.ok(source.includes(anchor),anchor)
  return ('import { sampleTerrainSurfaceHeightFast as b21Ground } from "./world/terrainSample";\n'+source)
   .replace('const tick = (nowMs: number): void => {',hook+'\nconst tick = (nowMs: number): void => {')
   .replace('aircraft.step(dt, nowMs)','window.__b36?.before(dt); aircraft.step(dt, nowMs)')
 }
}]})
const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5190,strictPort:true}})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/snap/bin/chromium',args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1})
 const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 page.setDefaultTimeout(90000)
 await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('blackout.renderQuality','balanced');HTMLElement.prototype.requestFullscreen=async()=>{}})
 await page.goto(`http://127.0.0.1:5190/?dev=b36&course=${gateOnly?'training-orbit':'free-flight'}&seed=42`)
 await page.waitForFunction(()=>window.__b36)
 await page.locator('#startup-screen').waitFor({state:'hidden'})
 await page.locator('#btn-play').click()
 await page.locator('#startup-screen').waitFor({state:'hidden'})
 await page.evaluate(()=>{window.__b36.start();window.__training.camera('orbit')})
 await page.waitForFunction(gate=>{const s=window.__b36.state();if(s.status==='crashed')throw Error('Pilot crashed');return gate?s.gateDistance<400&&s.gateDistance>200&&s.agl>20:s.speed>720&&s.engine.afterburnerActive},gateOnly)
 const path=`${dir}/b36-${gateOnly?'gate':'high-speed-nitro'}.png`
 await page.screenshot({path})
 const state=await page.evaluate(()=>window.__b36.state())
 await writeFile(`${dir}/b36-${gateOnly?'gate':'high-speed-nitro'}.json`,JSON.stringify({errors,state},null,2)+'\n')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({path,speed:state.speed,nitro:state.nitro,boost:state.engine.afterburnerActive,status:state.status}))
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
