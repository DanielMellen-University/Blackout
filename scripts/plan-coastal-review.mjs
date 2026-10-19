// Deterministic sea-contour trajectories for prescribed, low-altitude reviews.
import {createServer} from 'vite'
import {mkdirSync,writeFileSync} from 'node:fs'
const output=process.argv[2]||'docs/reviews/coastal-flight-10.936/routes.json'
const loader=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
try{
 const {setWorldSeed}=await loader.ssrLoadModule('/src/world/noise.ts'),{coastField}=await loader.ssrLoadModule('/src/world/Coastline.ts')
 const routes=[]
 for(const seed of (process.env.COAST_FLIGHT_SEEDS||'73,1337,7,31415,2026,808').split(',').map(Number)){
  setWorldSeed(seed);let p
  outer:for(let r=1;r<=60;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.max(Math.abs(x),Math.abs(z))===r&&coastField(x*5000,z*5000)<0){p={x:x*5000,z:z*5000};break outer}
  if(!p)throw Error('No sea for '+seed)
  const gradient=p=>({x:(coastField(p.x+50,p.z)-coastField(p.x-50,p.z))/100,z:(coastField(p.x,p.z+50)-coastField(p.x,p.z-50))/100})
  const project=p=>{
   for(let k=0;k<50;k++){
    const f=coastField(p.x,p.z)-.001,g=gradient(p),d=g.x*g.x+g.z*g.z
    if(d<1e-15)throw Error('Degenerate coast gradient')
    const s=Math.min(1,1000/Math.max(1e-12,Math.abs(f)/Math.sqrt(d)))
    p.x-=s*f*g.x/d;p.z-=s*f*g.z/d;if(Math.abs(f)<1e-9)return p
   }
   throw Error('Coast projection failed')
  }
  p=project(p);const points=[{...p,distance:0,field:coastField(p.x,p.z)}];let distance=0,maxStep=0
  while(distance<45000){
   const g=gradient(p),len=Math.hypot(g.x,g.z),next=project({x:p.x-g.z/len*100,z:p.z+g.x/len*100}),step=Math.hypot(next.x-p.x,next.z-p.z)
   if(step>200||step<1)throw Error('Invalid contour step '+step)
   distance+=step;maxStep=Math.max(maxStep,step);p=next;points.push({...p,distance,field:coastField(p.x,p.z)})
  }
  routes.push({seed,seconds:180,speed:250,clearance:90,length:distance,maxStep,points});console.log(seed,points.length,distance.toFixed(1),maxStep.toFixed(2))
 }
 mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});writeFileSync(output,JSON.stringify({kind:'prescribed sea-contour review; no flight physics acceptance',routes},null,2)+'\n')
}finally{await loader.close()}
