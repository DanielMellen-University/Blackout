// Diagnostic observer only. Keeps all controls, rendering and coverage queries unchanged.
const coverageAudit = { misses: [], captures: [] }
const auditTile = c => ({ key:c.key,cx:c.cx,cz:c.cz,size:c.size,alpha:c.alpha,fadeAge:c.fadeAge,
  visible:c.terrainMesh.visible,rootVisible:c.root.visible,rootAttached:!!c.root.parent,
  opacity:c.terrainMesh.material.opacity,retiring:world.terrain.retiring.includes(c) })
const auditRectangle = (minX,minZ,maxX,maxZ) => {
 const residents=[...world.terrain.chunks.values(),...world.terrain.retiring]
 const cover=(cx,cz,size)=>{
  if((cx+size)*420<=minX||cx*420>=maxX||(cz+size)*420<=minZ||cz*420>=maxZ)return true
  if(residents.some(c=>c.cx===cx&&c.cz===cz&&c.size===size&&c.alpha>.01&&c.terrainMesh.visible&&c.root.visible&&c.root.parent))return true
  if(size===1)return false
  const half=size/2
  return cover(cx,cz,half)&&cover(cx+half,cz,half)&&cover(cx,cz+half,half)&&cover(cx+half,cz+half,half)
 }
 let covered=true
 for(let z=Math.floor(minZ/(420*32))*32;z*420<maxZ;z+=32)
  for(let x=Math.floor(minX/(420*32))*32;x*420<maxX;x+=32)covered=cover(x,z,32)&&covered
 return {covered,residents:residents.filter(c=>c.cx*420<maxX&&(c.cx+c.size)*420>minX&&c.cz*420<maxZ&&(c.cz+c.size)*420>minZ).map(auditTile)}
}
const auditBefore=window.__training.before
window.__training.before=dt=>{
 auditBefore(dt)
 if(!training.active||training.seconds<10||coverageAudit.misses.length>=1000)return
 const p=aircraft.position
 if(world.terrain.hasMeshCoverage(p.x-100,p.z-100,p.x+100,p.z+100))return
 coverageAudit.misses.push({seconds:training.seconds,position:p.toArray(),...auditRectangle(p.x-100,p.z-100,p.x+100,p.z+100)})
}
let auditRaycaster
import('three').then(module=>{auditRaycaster=new module.Raycaster()})
const auditCapture=window.__training.capture
window.__training.capture=()=>{
 auditCapture()
 if(!auditRaycaster)return
 const hits=[]
 for(let y=350;y<=470;y+=30)for(let x=80;x<=1200;x+=80){
  auditRaycaster.setFromCamera({x:x/640-1,y:1-y/360},cameras.camera)
  const results=auditRaycaster.intersectObject(world.terrain.root,true)
  const h=results.find(h=>h.object.visible&&h.object.parent?.visible&&h.object.material.opacity>.01)
  hits.push({x,y,hit:h?{distance:h.distance,point:h.point.toArray(),name:h.object.name,parent:h.object.parent.name,opacity:h.object.material.opacity}:null})
 }
 coverageAudit.captures.push({seconds:training.seconds,camera:cameras.mode,hits})
}
const auditState=window.__training.state
window.__training.state=()=>({...auditState(),coverageAudit})
