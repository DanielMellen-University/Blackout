// Headless physics proof, distinct from browser timing or appearance acceptance.
// The existing controls pilot is extracted verbatim; only its environment is
// supplied here. No pose, velocity, orientation or gate state writes after reset.
import { createServer } from 'vite'
import { Scene, Vector3, Quaternion } from 'three'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const server = await createServer({ server: { middlewareMode: true } })
const part = process.env.POLISH_PART || 'mission-polish-a'
const rows = []
const sourceFiles = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard','-z','--','src'], {encoding:'utf8'}).split('\0').filter(Boolean)
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
try {
 const load = path => server.ssrLoadModule(`/src/${path}.ts`)
 const { COURSE_LIBRARY } = await load('systems/CourseLibrary')
 const { generateLegacyMission } = await load('systems/LegacyMissionGenerator')
 const { MissionSystem } = await load('systems/Mission')
 const { Aircraft } = await load('aircraft/Aircraft')
 const { CollisionSystem } = await load('systems/Collision')
 const { setTerrainProfile } = await load('world/TerrainProfile')
 const { setWorldSeed } = await load('world/noise')
 const { setOpsPad, clearOpsPad, sampleTerrainSurfaceHeightFast } = await load('world/terrainSample')
 const { AIRFIELD_COLLIDERS, AIRFIELD_COLLISION_PADDING: padding } = await load('world/Airfield')
 const { refillNitroAtGate } = await load('aircraft/NitroSystem')
 const hook = await readFile('scripts/browser-generator.js', 'utf8')
 const pilot = hook.slice(0, hook.indexOf('window.__training.catalog='))
 const makePilot = new Function('window','aircraft','world','attitudeFromOrientation','challenge','activeSortie','b21Ground','wasAirborne', pilot + '\nreturn window.__training')
 const fwd = new Vector3(), inv = new Quaternion(), up = new Vector3()
 const attitude = orientation => {
  fwd.set(0,0,1).applyQuaternion(orientation)
  inv.copy(orientation).invert(); up.set(0,1,0).applyQuaternion(inv)
  return { pitch: Math.asin(Math.max(-1,Math.min(1,fwd.y))), heading: Math.atan2(fwd.x,fwd.z), roll: Math.atan2(-up.x,up.y) }
 }
 const fixed = COURSE_LIBRARY.filter(c => c.seed !== null && (!process.env.POLISH_COURSES || process.env.POLISH_COURSES.split(',').includes(c.id)))
 for (const course of fixed) for (const seed of (process.env.POLISH_SEEDS || '42,1337,9001').split(',').map(Number)) {
  const adapted = generateLegacyMission(course, seed), {spec} = adapted, pad = spec.landingRunway
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x,pad.z,pad.y,pad.yaw)
  const aircraft = new Aircraft(), mission = new MissionSystem(new Scene())
  try {
   aircraft.reset(spec.start)
   mission.start(spec.start.x,spec.start.y,spec.start.z,spec.start.yaw,course.profile,adapted.modifier)
   const world = {spawn:spec.start,mission,runway:{position:new Vector3(pad.x,pad.y+.05,pad.z)}}
   const controls = makePilot({},aircraft,world,attitude,{phase:'running'},{course:{...course,terrainTheme:spec.theme}},sampleTerrainSurfaceHeightFast,false)
   const collision = new CollisionSystem(() => {
    const dx=aircraft.position.x-pad.x,dz=aircraft.position.z-pad.z,dy=aircraft.position.y-pad.y
    const x=dx*Math.cos(pad.yaw)-dz*Math.sin(pad.yaw),z=dx*Math.sin(pad.yaw)+dz*Math.cos(pad.yaw)
    return AIRFIELD_COLLIDERS.some(b=>Math.abs(x-b.cx)<=b.hx+padding.x&&Math.abs(dy-b.cy)<=b.hy+padding.y&&Math.abs(z-b.cz)<=b.hz+padding.z)
   })
   controls.start()
   let airborne=false,seconds=0,touch='roll',misses=0,spawnSafe=true
   for(let step=0;step<60*360;step++) {
    controls.before(1/60); aircraft.step(1/60,step*1000/60); seconds=(step+1)/60
    const event=mission.update(aircraft.position.x,aircraft.position.y,aircraft.position.z)
    if(event==='pass'||event==='complete')refillNitroAtGate(aircraft.nitro)
    if(event==='miss')misses++
    touch=collision.check(aircraft)
    if(seconds<=2 && ['crash','ditch'].includes(touch))spawnSafe=false
    if(!aircraft.onGround)airborne=true
    if(['crash','ditch'].includes(touch)||airborne&&mission.next===5&&aircraft.onGround)break
   }
   const dx=aircraft.position.x-pad.x,dz=aircraft.position.z-pad.z
   const localX=dx*Math.cos(pad.yaw)-dz*Math.sin(pad.yaw),localZ=dx*Math.sin(pad.yaw)+dz*Math.cos(pad.yaw)
   const pass=spawnSafe&&airborne&&mission.next===5&&aircraft.onGround&&!['crash','ditch'].includes(touch)&&Math.abs(localX)<9&&Math.abs(localZ)<60
   const row={mission:course.id,seed,theme:spec.theme,pass,spawnSafe,seconds,gates:mission.next,misses,touch,localX,localZ,position:aircraft.position.toArray(),speed:aircraft.speed}
   rows.push(row); console.log(JSON.stringify(row))
  } finally {aircraft.dispose();mission.dispose();setTerrainProfile(null);clearOpsPad()}
 }
 const dir=`docs/reviews/generator/${part}`;await mkdir(dir,{recursive:true})
 await writeFile(`${dir}/simulation.json`,JSON.stringify({pass:rows.every(r=>r.pass),method:'Verbatim existing gate/landing pilot with ordinary controls and 60 Hz production physics. Analytic terrain, no wind or streamed mesh. Airfield collision active; separate dense geometry proof checks settlement obstacles. Not browser timing, medals, weather or visual acceptance.',sourceHashes,pilotSha256:createHash('sha256').update(pilot).digest('hex'),rows},null,2)+'\n')
 if(rows.some(r=>!r.pass))process.exitCode=1
}finally{await server.close()}
