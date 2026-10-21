import { afterEach, expect, it } from 'vitest'
import { Scene } from 'three'
import { COURSE_LIBRARY, resolveCourseDefinition, resolveCourseReplaySeed, courseSessionId } from '../src/systems/CourseLibrary'
import { generateLegacyMission, LEGACY_MIGRATION_EXCEPTIONS } from '../src/systems/LegacyMissionGenerator'
import { MissionSystem, buildMissionRoute, missionLegClearance, scoringFocusForModifier } from '../src/systems/Mission'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { setOpsPad, clearOpsPad, sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'
import { ChallengeRun } from '../src/systems/ChallengeRun'
import { touchSeededRandomCourseRecord, SEEDED_RANDOM_RECORDS_STORAGE_KEY } from '../src/core/CourseRecordRetention'

afterEach(() => {setTerrainProfile(null);clearOpsPad()})
for (const course of COURSE_LIBRARY.filter(c => c.seed !== null && !LEGACY_MIGRATION_EXCEPTIONS[c.id])) {
  it.each([42,1337,9001])(`${course.id} seed %s has reachable gates, flat runway, valid approach and earned gold`, seed => {
    const adapted=generateLegacyMission(course,seed)!,{spec}=adapted,pad=spec.landingRunway
    setWorldSeed(seed);setTerrainProfile(spec.terrain);setOpsPad(pad.x,pad.z,pad.y,pad.yaw)
    const mission=new MissionSystem(new Scene())
    try {
      mission.start(spec.start.x,spec.start.y,spec.start.z,spec.start.yaw,course.profile!,adapted.modifier)
      expect(mission.routeProfile).toBe(course.profile)
      expect(mission.scoringFocus).toBe(scoringFocusForModifier(adapted.modifier!))
      expect(mission.routeFallbackUsed).toBe(false)
      expect(mission.totalGates).toBe(5)
      const route=buildMissionRoute(spec.start.x,spec.start.y,spec.start.z,spec.start.yaw,course.profile!,adapted.modifier)
      let previous=spec.start
      for(const [leg,point] of route.entries()) {
        const dx=point.x-previous.x,dz=point.z-previous.z,length=Math.hypot(dx,dz)
        const slope=Math.atan2(Math.abs(point.y-previous.y),length)*180/Math.PI
        expect(slope).toBeLessThan(25)
        for(let i=1;i<=60;i++)for(const side of [-34,0,34]) {
          const t=i/60,x=previous.x+dx*t+dz/length*side,z=previous.z+dz*t-dx/length*side
          expect(previous.y+(point.y-previous.y)*t-sampleTerrainSurfaceHeightFast(x,z))
            .toBeGreaterThanOrEqual(missionLegClearance(leg,length*t,length)-.5)
        }
        previous={...point,yaw:pad.yaw}
      }
      const sample=(r:number,f:number)=>sampleTerrainSurfaceHeightFast(pad.x+Math.cos(pad.yaw)*r+Math.sin(pad.yaw)*f,pad.z-Math.sin(pad.yaw)*r+Math.cos(pad.yaw)*f)
      for(const r of [-8,0,8])for(const f of [-55,0,55])expect(sample(r,f)).toBeCloseTo(pad.y,4)
      for(let f=-1300;f<=-80;f+=40)expect(sample(0,f)-pad.y).toBeLessThan(1.4-f*.052-2)
      for(const point of route.slice(-2))expect((point.x-pad.x)*Math.cos(pad.yaw)-(point.z-pad.z)*Math.sin(pad.yaw)).toBeCloseTo(0,5)
      const finish=(quality:number,delay:number)=>{
        const run=new ChallengeRun(null)
        run.reset('migration-proof',5,mission.scoringFocus,adapted.contractSeed,course.contractCatalog,mission.timeAllowanceSec)
        for(let gate=0;gate<5;gate++){for(let t=0;t<12;t++)run.update(1,150);run.recordGate(quality)}
        for(let t=0;t<45+delay;t++)run.update(1,60)
        return run.finishLanding({verticalSpeed:-1,groundSpeed:30,pitchRad:0,rollRad:0})!
      }
      expect(finish(1,0).medal).toBe('gold')
      expect(finish(.35,120).medal).not.toBe('gold')
    } finally {mission.dispose()}
  })
}
it('captures new flight seeds without changing fixed weather, identity, contract or scoring focus',()=>{
  for(const definition of COURSE_LIBRARY.filter(c=>c.seed!==null&&!c.contractCatalog)) {
    const first=resolveCourseReplaySeed(resolveCourseDefinition(definition),42)
    const second=resolveCourseReplaySeed(resolveCourseDefinition(definition),1337)
    expect(first.seed).toBe(42);expect(second.seed).toBe(1337)
    for(const key of ['id','label','detail','profile','weather','weatherShift','timeOfDay','windSide','contractSeed','missionModifier'] as const)
      expect(first[key]).toEqual(second[key])
    expect(courseSessionId(definition.id,42,definition.profile!)).not.toBe(courseSessionId(definition.id,1337,definition.profile!))
  }
})
it('uses the existing bounded manifest for migrated mission score and ghost siblings',()=>{
  const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}
  data.set('blackout.ghost.seed:1:orbit:r32','historical')
  for(let seed=1;seed<=14;seed++) {
    const id=courseSessionId('training-orbit',seed,'orbit')
    data.set(`blackout.ghost.${id}`,'ghost');data.set(`blackout.history.${id}`,'history')
    touchSeededRandomCourseRecord(storage,id,seed)
  }
  expect(JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY)!)).toHaveLength(12)
  expect(data.has(`blackout.ghost.${courseSessionId('training-orbit',1,'orbit')}`)).toBe(false)
  expect(data.get('blackout.ghost.seed:1:orbit:r32')).toBe('historical')
})

it('keeps three shared periods per rotating mission deterministic through the generated route pipeline',async()=>{
  const lib=await import('../src/systems/CourseLibrary')
  const {findPlayableSpawn}=await import('../src/world/terrainSample')
  const {routeModifierForSpawn}=await import('../src/systems/Mission')
  for(const [id,dates] of [
    ['daily-ops',[Date.UTC(2026,9,20),Date.UTC(2026,9,21),Date.UTC(2026,9,22)]],
    ['weekly-ops',[Date.UTC(2026,9,20),Date.UTC(2026,9,27),Date.UTC(2026,10,3)]],
    ['monthly-ops',[Date.UTC(2026,9,20),Date.UTC(2026,10,20),Date.UTC(2026,11,20)]],
  ] as const)for(const date of dates){
    const c=resolveCourseDefinition(lib.courseDefinitionForId(id),date)
    expect(resolveCourseReplaySeed(c,42).seed).toBe(c.seed)
    const a=generateLegacyMission(c,c.seed!)!,spec=a.spec,pad=spec.landingRunway
    setTerrainProfile(null);clearOpsPad();setWorldSeed(c.seed!)
    const original=findPlayableSpawn()!
    const modifier=routeModifierForSpawn(original.x-Math.sin(original.yaw)*45,original.z-Math.cos(original.yaw)*45,original.yaw,c.profile!)
    setTerrainProfile(spec.terrain);setOpsPad(pad.x,pad.z,pad.y,pad.yaw)
    const mission=new MissionSystem(new Scene())
    try{
      mission.start(spec.start.x,spec.start.y,spec.start.z,spec.start.yaw,c.profile!,modifier)
      expect(mission.totalGates).toBe(5);expect(mission.routeFallbackUsed).toBe(false)
      expect(mission.scoringFocus).toBe(scoringFocusForModifier(modifier))
      const key=c.daily?lib.dailyOpsDayKey(date):c.weekly?lib.weeklyOpsWeekKey(date):lib.monthlyOpsMonthKey(date)
      expect(courseSessionId(id,c.seed!,c.profile!,key)).toBe(lib.courseRunId(c,date))
      for(let f=-1300;f<=-80;f+=40)expect(sampleTerrainSurfaceHeightFast(pad.x+Math.sin(pad.yaw)*f,pad.z+Math.cos(pad.yaw)*f)-pad.y).toBeLessThan(1.4-f*.052-2)
    }finally{mission.dispose();setTerrainProfile(null);clearOpsPad()}
  }
},30000)
