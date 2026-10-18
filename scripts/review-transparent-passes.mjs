// Compare actual production exhaust/traffic geometry with fixed cameras and time.
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.argv[2]
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,
  args:['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface']})
const results=[]
try {
  for(const [stage,url] of [['before',process.env.BEFORE_URL||'http://127.0.0.1:5174'],['after',process.env.REVIEW_URL||'http://127.0.0.1:5173']]) {
    const modelSource=await (await fetch(url+'/src/aircraft/createF35Model.ts')).text()
    const threePath=modelSource.match(/from \"([^\"]*three\.js[^\"]*)\"/)[1]
    const page=await browser.newPage({viewport:{width:768,height:432},deviceScaleFactor:1}),errors=[]
    page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE',String(e))})
    await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}))
    await page.route('**/dev/aircraft.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><body style="margin:0"><script type="module">
import * as T from '${threePath}';
import {createF35Model} from '/src/aircraft/createF35Model.ts';
import {AirTrafficSystem} from '/src/world/AirTrafficSystem.ts';
import {TerrainSystem} from '/src/world/TerrainSystem.ts';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(768,432);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#18222c');scene.add(new T.HemisphereLight(0xe9f4ff,0x526170,2.2));
const light=new T.DirectionalLight(0xffffff,3);light.position.set(-10,16,14);scene.add(light);
const model=createF35Model();scene.add(model);model.getObjectByName('afterburner').visible=true;
const traffic=new AirTrafficSystem(scene),glyph=traffic.root.getObjectByName('AirTrafficSilhouettes');
const terrain=new TerrainSystem(scene,1),ground=new T.PlaneGeometry(20,20,2,2);ground.rotateX(-Math.PI/2);
const gp=ground.getAttribute('position');gp.setY(4,12);ground.computeVertexNormals();ground.computeBoundingSphere();
const gc=new Float32Array(gp.count*3);for(let i=0;i<gp.count;i++){gc[i*3]=.2+i*.035;gc[i*3+1]=.6-i*.035;gc[i*3+2]=.3;}
ground.setAttribute('color',new T.BufferAttribute(gc,3));
const attrs=Object.fromEntries(Object.entries(ground.attributes).map(([k,v])=>[k,{array:v.array,itemSize:v.itemSize}]));
const chunk=terrain.buildChunk({cx:0,cz:0,size:1,lod:0},{ground:{attributes:attrs,index:ground.index.array,bounds:{x:0,y:5,z:0,radius:25}},water:null,heights:Float32Array.from({length:gp.count},(_,i)=>gp.getY(i)),waterLevels:new Float32Array(gp.count),segs:2});
chunk.alpha=.5;terrain.applyChunkAlpha(chunk);
const camera=new T.PerspectiveCamera(40,768/432,.1,1000);
const materials=['abOuter','abMid','abCore'].map(n=>model.getObjectByName(n).material);
window.capture=(kind,position)=>{
 if(kind==='fallback')terrain.offsetFallback(chunk);
 model.visible=kind==='exhaust';traffic.root.visible=kind==='traffic';terrain.root.visible=(kind==='ground'||kind==='fallback');
 for(const child of traffic.root.children)child.visible=child===glyph;
 if(kind==='traffic'){
  for(let i=0;i<glyph.count;i++)glyph.setMatrixAt(i,new T.Matrix4().makeTranslation(i===0?0:10000,0,0));
  glyph.instanceMatrix.needsUpdate=true;
 }
 camera.position.set(...position);if((kind==='ground'||kind==='fallback'))camera.position.add(new T.Vector3(210,0,210));camera.lookAt((kind==='ground'||kind==='fallback')?210:0,(kind==='ground'||kind==='fallback')?5:0,(kind==='ground'||kind==='fallback')?210:kind==='exhaust'?-3:0);camera.updateMatrixWorld();
 renderer.render(scene,camera);
 const tracked=(kind==='ground'||kind==='fallback')?chunk.materials:kind==='exhaust'?materials:[glyph.material],before=tracked.map(m=>m.version);
 for(let i=0;i<10;i++)renderer.render(scene,camera);
 const versions=tracked.map((m,i)=>m.version-before[i]);
 const gl=renderer.getContext(),pixels=new Uint8Array(768*432*4);gl.readPixels(0,0,768,432,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let data='';for(let i=0;i<pixels.length;i+=8192)data+=String.fromCharCode(...pixels.subarray(i,i+8192));
 return {versions,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixels:btoa(data),geometry:(kind==='ground'||kind==='fallback')?[gp.count]:kind==='exhaust'?materials.map((m,i)=>model.getObjectByName(['abOuter','abMid','abCore'][i]).geometry.getAttribute('position').count):[glyph.geometry.getAttribute('position').count,glyph.count]};
};
</script>`}))
    await page.goto(url+'/dev/aircraft.html');await page.waitForFunction(()=>typeof window.capture==='function')
    for(const [kind,pose] of [['exhaust',[15,7,-20]],['exhaust',[-15,7,-20]],['exhaust',[25,3,0]],['traffic',[0,80,20]],['traffic',[0,-80,20]],['ground',[30,4,10]],['ground',[-30,10,20]],['ground',[0,20,-30]],['fallback',[30,4,10]],['fallback',[-30,10,20]],['fallback',[0,20,-30]]]) {
      const data=await page.evaluate(({kind,pose})=>window.capture(kind,pose),{kind,pose})
      const pixels=Buffer.from(data.pixels,'base64');delete data.pixels
      const filename=stage+'-'+kind+'-'+results.filter(r=>r.stage===stage&&r.kind===kind).length+'.png'
      await page.screenshot({path:directory+'/'+filename})
      results.push({stage,kind,pose,filename,pixelHash:createHash('sha256').update(pixels).digest('hex'),...data,errors:[...errors]})
    }
    await page.close()
  }
}finally{await browser.close();await writeFile(directory+'/passes.json',JSON.stringify(results,null,2)+'\n')}
for(let i=0;i<results.length/2;i++)console.log(results[i].kind,JSON.stringify(results[i].versions),'->',JSON.stringify(results[i+results.length/2].versions),'pixels equal:',results[i].pixelHash===results[i+results.length/2].pixelHash)
