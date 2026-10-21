import { afterEach, expect, it } from 'vitest'
import { Group } from 'three'
import { COURSE_LIBRARY, resolveCourseDefinition } from '../src/systems/CourseLibrary'
import { generateLegacyMission, LEGACY_MIGRATION_EXCEPTIONS } from '../src/systems/LegacyMissionGenerator'
import { SortieContractTracker, MAX_CONTRACT_SCORE } from '../src/systems/SortieContract'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { setOpsPad, clearOpsPad, getOpsPad } from '../src/world/terrainSample'
import { sampleGeography } from '../src/world/Geography'
import { nearestThermalPocket, thermalLiftIntensity } from '../src/systems/ThermalLift'
import { settlementAnchorCells, settlementForCell } from '../src/world/SettlementPlan'
import { AirTrafficSystem } from '../src/world/AirTrafficSystem'

afterEach(()=>{setTerrainProfile(null);clearOpsPad()})
it('activates exactly the 42 supported contracts and preserves both original-world exceptions',()=>{
 const catalog=COURSE_LIBRARY.filter(c=>c.contractCatalog&&c.seed!==null)
 expect(catalog).toHaveLength(44)
 expect(catalog.filter(c=>resolveCourseDefinition(c).terrainTheme)).toHaveLength(42)
 for(const c of catalog){
  const resolved=resolveCourseDefinition(c)
  if(LEGACY_MIGRATION_EXCEPTIONS[c.id])expect(resolved).toEqual(c)
  else {expect(resolved.seed).toBeNull();expect(resolved.contractSeed).toBe(c.seed)}
 }
})

for(const course of COURSE_LIBRARY.filter(c=>c.seed!==null&&c.contractCatalog&&!LEGACY_MIGRATION_EXCEPTIONS[c.id])) {
 it.each([42,1337,9001])(`${course.id} retains its objective and bounded score on generated seed %s`,seed=>{
  const adapted=generateLegacyMission(course,seed)!,{spec}=adapted,pad=spec.landingRunway,t=spec.terrain
  setWorldSeed(seed);setTerrainProfile(t);setOpsPad(pad.x,pad.z,pad.y,pad.yaw)
  const tracker=new SortieContractTracker();tracker.reset(adapted.contractSeed,5,true)
  const resolved=resolveCourseDefinition(course)
  expect(resolved.contractSeed ?? resolved.seed).toBe(course.seed)
  expect(resolved.weather).toBe(course.weather)
  expect(resolved.weatherShift).toBe(course.weatherShift)
  expect(resolved.timeOfDay).toBe(course.timeOfDay)
  expect(resolved.windSide).toBe(course.windSide)
  expect(tracker.complete).toBe(false)
  expect(tracker.progress).toBe(0)
  const again=(fn:()=>void)=>{for(let i=0;i<4;i++)fn()}
  const local=(r:number,f:number)=>({x:t.originX+Math.cos(t.yaw)*r+Math.sin(t.yaw)*f,z:t.originZ-Math.sin(t.yaw)*r+Math.cos(t.yaw)*f})
  const sample=(r:number,f:number)=>{const p=local(r,f);return sampleGeography(p.x,p.z)}
  const landmark=(kind:'city'|'village')=>{
   for(const [x,z] of settlementAnchorCells(kind,getOpsPad())){
    const plan=settlementForCell(x,z,kind)
    if(plan)return plan
   }
   throw Error(`No ${kind} for ${course.id} ${seed}`)
  }
  switch(tracker.kind){
   case 'pace': break
   case 'altitude':tracker.recordAltitude(3000);break
   case 'stunt':tracker.recordStunt(2);break
   case 'scout':{
    const city=landmark('city'),village=landmark('village')
    tracker.recordDestination(1,city.kind,city.id);tracker.recordDestination(2,village.kind,village.id);break
   }
   case 'fuel':tracker.recordFuel(.9);break
   case 'low-level':again(()=>tracker.recordLowLevel(140,5,true));break
   case 'biome':{
    const biomes=new Set<string>()
    for(let right=-14000;right<=14000;right+=500)for(let forward=-6000;forward<=6000;forward+=1000)biomes.add(sample(right,forward).biome)
    expect(biomes.size).toBeGreaterThanOrEqual(4);tracker.recordBiome(biomes.size);break
   }
   case 'speed-band':again(()=>tracker.recordSpeedBand(250,5,true));break
   case 'weather':again(()=>tracker.recordWeather(1,0,5,true));break
   case 'approach':break
   case 'water':case 'water-skim':{
    let water=false
    for(let right=500;right<=2600;right+=100)for(let forward=-500;forward<=2600;forward+=100){const g=sample(right,forward);water||=g.height<g.waterLevel}
    expect(water).toBe(true)
    again(()=>tracker.kind==='water'?tracker.recordWater(water,5,true):tracker.recordWaterSkim(water,80,5,true));break
   }
   case 'brake':again(()=>tracker.recordBrake(250,5,true,true));break
   case 'heat':again(()=>tracker.recordHeat(.5,220,5,true));break
   case 'crosswind':again(()=>tracker.recordCrosswind(20,5,true));break
   case 'g-control':again(()=>tracker.recordGControl(2,150,5,true));break
   case 'deadstick':tracker.recordDeadstick(0,true);break
   case 'front':again(()=>tracker.recordFront(true,5,true));break
   case 'boost':again(()=>tracker.recordBoost(true,250,5,true));break
   case 'mach':again(()=>tracker.recordMach(400,5,true));break
   case 'clean':for(let gate=1;gate<=5;gate++)tracker.recordCleanGate(false,gate,5);break
   case 'level':again(()=>tracker.recordLevelFlight(300,5,true));break
   case 'tour':for(const kind of ['city','village'] as const){const plan=landmark(kind);tracker.recordDestination(1,kind,plan.id)}break
   case 'combo':tracker.recordCombo(3);break
   case 'precision':again(()=>tracker.recordPrecisionGate(1));break
   case 'night':again(()=>tracker.recordNight(.2,5,true));break
   case 'butter':break
   case 'dry':again(()=>tracker.recordDry(false,300,5,true));break
   case 'target':{const plan=landmark('city');tracker.recordRadarLock(true,'city',plan.id);tracker.recordDestination(1,'city',plan.id);break}
   case 'gust':again(()=>tracker.recordGust(1,5,true));break
   case 'range':again(()=>tracker.recordDistance(4000,true));break
   case 'high-dive':tracker.recordHighDive(2000,true);tracker.recordHighDive(300,true);break
   case 'ridge-run':{
    let biome=''
    for(let right=3000;right<=6500;right+=100){const b=sample(right,0).biome;if(['mountain','hills','snow','tundra'].includes(b)){biome=b;break}}
    expect(biome).not.toBe('');again(()=>tracker.recordRidgeRun(biome,140,5,true));break
   }
   case 'traffic-watch':case 'traffic-dodge':{
    const traffic=new AirTrafficSystem(new Group());traffic.reset(seed,spec.start.x,spec.start.y,spec.start.z)
    expect(traffic.count).toBeGreaterThanOrEqual(3)
    for(let i=0;i<3;i++)tracker.recordTrafficPass(`traffic:${seed}:${i}`,150)
    traffic.dispose();break
   }
   case 'thermal-surf':{
    const pocket=nearestThermalPocket(seed,spec.course[1]!.x,spec.course[1]!.z)!
    const lift=thermalLiftIntensity(seed,pocket.x,420,pocket.z,1,0,0,true)
    expect(lift).toBeGreaterThanOrEqual(.38);again(()=>tracker.recordThermalSurf(lift,5,true));break
   }
   default:throw Error(`Unsupported contract: ${tracker.kind}`)
  }
  expect(tracker.finish(60,.9,500,1)).toBe(MAX_CONTRACT_SCORE)
  expect(tracker.complete).toBe(true)
  expect(tracker.finish(60,.9,500,1)).toBe(MAX_CONTRACT_SCORE)
 },30000)
}
