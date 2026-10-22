import { afterEach, expect, it } from 'vitest'
import { Scene } from 'three'
import { generateMission } from '../src/systems/MissionGenerator'
import { MissionSystem, buildMissionRoute, missionLegClearance } from '../src/systems/Mission'
import { ChallengeRun } from '../src/systems/ChallengeRun'
import { setTerrainProfile, type MissionTheme } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { setOpsPad, clearOpsPad, sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'

afterEach(()=>{setTerrainProfile(null);clearOpsPad()})
const themes: MissionTheme[]=['desert-run','mountain-valley-run','coastal-island-run','volcanic-run']
const tuningSeeds=[73,808,2026]
const local=(spec:ReturnType<typeof generateMission>,point:{x:number;z:number})=>{
 const t=spec.terrain,dx=point.x-t.originX,dz=point.z-t.originZ
 return {right:dx*Math.cos(t.yaw)-dz*Math.sin(t.yaw),forward:dx*Math.sin(t.yaw)+dz*Math.cos(t.yaw)}
}
for(const theme of themes){
 it(`varies ${theme} flight lines, turn handedness, length and height across seeds`,()=>{
  const specs=Array.from({length:24},(_,i)=>generateMission(i+11,theme))
  const shapes=specs.map(s=>s.course.map(p=>({...local(s,p),height:p.y-s.terrain.baseHeight})))
  expect(Math.max(...specs.map(s=>s.start.yaw))-Math.min(...specs.map(s=>s.start.yaw))).toBeGreaterThan(4)
  const widths=shapes.map(s=>Math.max(...s.map(p=>Math.abs(p.right))))
  expect(Math.max(...widths)-Math.min(...widths)).toBeGreaterThan(theme === 'mountain-valley-run' ? 450 : theme === 'volcanic-run' ? 400 : 650)
  if(theme === 'desert-run' || theme === 'mountain-valley-run')expect(new Set(shapes.map(s=>Math.sign(s[Math.floor(s.length/2)]!.right))).size).toBe(2)
  expect(new Set(shapes.map(s=>s.map(p=>Math.round(p.height)).join(','))).size).toBeGreaterThan(15)
  for(const shape of shapes){expect(Math.abs(shape.at(-2)!.right)).toBeLessThan(.001);expect(Math.abs(shape.at(-1)!.right)).toBeLessThan(.001);expect(shape.at(-1)!.forward).toBeGreaterThanOrEqual(shape.at(-2)!.forward+599.99)}
 })
 it.each(tuningSeeds)(`keeps ${theme} runway flat, approach clear, and gold earned on seed %s`,seed=>{
  const spec=generateMission(seed,theme),pad=spec.landingRunway,t=spec.terrain
  setWorldSeed(seed);setTerrainProfile(t);setOpsPad(pad.x,pad.z,pad.y,pad.yaw)
  const sample=(r:number,f:number)=>sampleTerrainSurfaceHeightFast(pad.x+Math.cos(pad.yaw)*r+Math.sin(pad.yaw)*f,pad.z-Math.sin(pad.yaw)*r+Math.cos(pad.yaw)*f)
  for(const r of [-8,0,8])for(const f of [-55,0,55])expect(sample(r,f)).toBeCloseTo(pad.y,4)
  for(let f=-1300;f<=-80;f+=40)expect(sample(0,f)-pad.y).toBeLessThan(1.4-f*.052-2)
  const mission=new MissionSystem(new Scene())
  try{
   mission.start(spec.start.x,spec.start.y,spec.start.z,spec.start.yaw,spec.profile)
   expect(mission.routeFallbackUsed).toBe(false)
   let previous = spec.start
   for(const [leg,point] of buildMissionRoute(spec.start.x,spec.start.y,spec.start.z,spec.start.yaw,spec.profile).entries()){
    const dx=point.x-previous.x,dz=point.z-previous.z,length=Math.hypot(dx,dz)
    for(let i=1;i<=60;i++)for(const side of [-52,0,52]){
     const fraction=i/60,x=previous.x+dx*fraction+dz/length*side,z=previous.z+dz*fraction-dx/length*side
     const y=previous.y+(point.y-previous.y)*fraction
     expect(y-sampleTerrainSurfaceHeightFast(x,z)).toBeGreaterThanOrEqual(missionLegClearance(leg,length*fraction,length)-.5)
    }
    previous={...point,yaw:spec.start.yaw}
   }
   const finish=(quality:number,delay:number)=>{
    const run=new ChallengeRun(null)
    run.reset(`polish:${theme}`,mission.totalGates,'balanced',undefined,false,mission.timeAllowanceSec)
    for(let i=0;i<mission.totalGates;i++){run.update(60/mission.totalGates,150);run.recordGate(quality)}
    for(let second=0;second<45+delay;second++)run.update(1,60)
    return run.finishLanding({verticalSpeed:-1,groundSpeed:30,pitchRad:0,rollRad:0})!
   }
   expect(finish(1,0).medal).toBe('gold')
   expect(finish(.35,120).medal).not.toBe('gold')
  }finally{mission.dispose()}
 })
}
