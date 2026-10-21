import { expect, it } from 'vitest'
import { COURSE_LIBRARY, resolveCourseDefinition, courseRunId } from '../src/systems/CourseLibrary'
import { generateLegacyMission, legacyGeneratedRecordId, LEGACY_MISSION_MODIFIERS } from '../src/systems/LegacyMissionGenerator'
import { generateMission } from '../src/systems/MissionGenerator'
import { FLIGHT_REVISION_TAG } from '../src/core/FlightRevision'
import { sortieContractLabelForSeed } from '../src/systems/SortieContract'

const fixed = COURSE_LIBRARY.filter(c => c.seed !== null)
it('matches the approved catalog inventory', () => {
  expect(fixed).toHaveLength(72)
  expect(fixed.filter(c => 'contractCatalog' in c)).toHaveLength(44)
  expect(COURSE_LIBRARY.filter(c => 'daily' in c || 'weekly' in c || 'monthly' in c)).toHaveLength(3)
})
it.each(fixed.map(c => [c.id, c] as const))('adapts %s without changing mission identity or contract', (_id, course) => {
  const first = generateLegacyMission(course, 42)
  if (['waterway-tour','monsoon-run'].includes(course.id)) { expect(first).toBeNull(); return }
  expect(first!.mission).toEqual(course)
  expect(first!.modifier).toBe(LEGACY_MISSION_MODIFIERS[course.id])
  expect(first!.contractSeed).toBe(course.seed)
  expect(sortieContractLabelForSeed(first!.contractSeed, 5, 'contractCatalog' in course))
    .toBe(sortieContractLabelForSeed(course.seed!, 5, 'contractCatalog' in course))
  expect(generateLegacyMission(course, 42)).toEqual(first)
  expect(generateLegacyMission(course, 1337)!.spec).not.toEqual(first!.spec)
  const original = generateMission(42, first!.spec.theme)
  expect(first!.spec.terrain.landscapeRevision).toBe(original.terrain.landscapeRevision + 100)
  expect(first!.spec.terrain.routeRevision).toBe(original.terrain.routeRevision + 100)
  expect(legacyGeneratedRecordId(course, 42)).not.toBe(courseRunId(course))
  expect(legacyGeneratedRecordId(course, 42)).toContain(`:${FLIGHT_REVISION_TAG}:`)
  expect(legacyGeneratedRecordId(course, 42)).not.toBe(legacyGeneratedRecordId(course, 1337))
})
it('separates missions which reuse the same profile and flight seed', () => {
  const ids = fixed.filter(c => !['waterway-tour','monsoon-run'].includes(c.id)).map(c => legacyGeneratedRecordId(c, 42))
  expect(new Set(ids).size).toBe(ids.length)
})
it('keeps period seeds shared and leaves the six excluded entries outside the adapter', () => {
  for (const course of COURSE_LIBRARY) {
    if ('daily' in course || 'weekly' in course || 'monthly' in course) {
      const resolved = resolveCourseDefinition(course, Date.UTC(2026, 9, 20, 12))
      const adapted = generateLegacyMission(resolved, resolved.seed!)!
      expect(adapted.spec.seed).toBe(resolved.seed)
      expect(adapted.mission).toEqual(resolved)
    } else if (course.seed === null) expect(generateLegacyMission(course, 42)).toBeNull()
  }
})

it('maps rotating objective terrain requirements without changing shared period settings', async()=>{
  const lib=await import('../src/systems/CourseLibrary')
  const {legacyTerrainTheme}=await import('../src/systems/LegacyMissionGenerator')
  const observed=new Set<string>()
  for(let day=0;day<1500;day++){
    const date=Date.UTC(2025,0,1+day)
    const c=resolveCourseDefinition(lib.courseDefinitionForId('daily-ops'),date)
    const label=sortieContractLabelForSeed(c.contractSeed ?? c.seed!,5,true)
    const theme=legacyTerrainTheme(c)
    if(label==='WATERWAY TOUR'){expect(c.terrainTheme).toBeUndefined();expect(theme).toBeNull();observed.add(label)}
    if(label==='WATER RUN'||label==='WATER SKIM'){expect(theme).toBe('coastal-island-run');observed.add(label)}
    if(['BIOME TOUR','SETTLEMENT TOUR','SCOUT'].includes(label)){expect(theme).toBe('mountain-valley-run');observed.add(label)}
    expect(c.contractSeed ?? c.seed).toBe(lib.dailyOpsSeed(date))
    expect(c.weather).toBe(resolveCourseDefinition(lib.courseDefinitionForId('daily-ops'),date).weather)
  }
  for(const label of ['WATERWAY TOUR','WATER RUN','WATER SKIM','BIOME TOUR','SETTLEMENT TOUR','SCOUT'])expect(observed.has(label)).toBe(true)
})

it('retains objective identity when adapting a resolved sortie or a replayed flight seed',()=>{
  for(const definition of COURSE_LIBRARY.filter(c=>c.seed!==null&&!['waterway-tour','monsoon-run'].includes(c.id))){
    const resolved=resolveCourseDefinition(definition)
    const replay={...resolved,seed:9001,contractSeed:definition.seed!}
    const a=generateLegacyMission(replay,42)!
    expect(a.contractSeed).toBe(definition.seed)
    expect(a.spec.theme).toBe(generateLegacyMission(definition,42)!.spec.theme)
    expect(a.mission).toEqual(replay)
  }
})
