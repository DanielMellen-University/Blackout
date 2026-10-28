import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import { Scene } from 'three'
import { COURSE_LIBRARY, resolveCourseDefinition, resolveCourseReplaySeed } from '../src/systems/CourseLibrary'
import type { CourseDefinition } from '../src/systems/CourseLibrary'
import { generateLegacyMission, legacyGeneratedRecordId } from '../src/systems/LegacyMissionGenerator'
import { MissionSystem } from '../src/systems/Mission'
import { generateMission } from '../src/systems/MissionGenerator'
import { setWorldSeed } from '../src/world/noise'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setOpsPad, clearOpsPad, waterBodyFromClimate } from '../src/world/terrainSample'
import { sampleGeography } from '../src/world/Geography'
import { coursePickerCopy } from '../src/ui/CoursePicker'
import { sortieContractLabelForSeed, sortieContractDetailForSeed } from '../src/systems/SortieContract'

const before = JSON.parse(readFileSync(new URL('../docs/reviews/generator/mission-polish-a/geometry.json', import.meta.url), 'utf8'))
const labels = { 'desert-run': 'DESERT RUN', 'mountain-valley-run': 'MOUNTAIN VALLEY RUN', 'coastal-island-run': 'COASTAL ISLAND RUN', 'volcanic-run': 'VOLCANIC RUN', 'waterway-run': 'WATERWAY' }
afterEach(() => { setTerrainProfile(null); clearOpsPad() })

it('retains all existing identities and gameplay settings while correcting copy', () => {
  const fixed = COURSE_LIBRARY.filter(c => c.seed !== null)
  expect(fixed.map(c => c.id)).toEqual(before.catalog.map((c: { original: CourseDefinition }) => c.original.id))
  let details = 0, names = 0
  for (const course of fixed) {
    const old = before.catalog.find((c: { original: CourseDefinition }) => c.original.id === course.id).original
    for (const key of ['seed', 'profile', 'weather', 'weatherShift', 'timeOfDay', 'windSide', 'contractCatalog'] as const) expect(course[key]).toEqual(old[key])
    if (course.detail !== old.detail) details++
    if (course.label !== old.label) names++
    expect(`${course.label} ${course.detail}`).not.toMatch(/forest|jungle|acacia|grassland|frozen lake|wetland|reflective mineral|spiral|midnight|glacier|tundra|swamp|saltflat|savanna/i)
    const resolved = resolveCourseDefinition(course)
    const copy = coursePickerCopy({ course: resolved, history: null, bestScore: 0, badgeCount: 0, bestPrecisionStreak: 0,
      contractLabel: sortieContractLabelForSeed(course.seed!, 5, resolved.contractCatalog === true),
      contractDetail: sortieContractDetailForSeed(course.seed!, 5, resolved.contractCatalog === true) })
    expect(copy.detail).toContain(course.detail)
    expect(copy.detail).toContain(sortieContractLabelForSeed(course.seed!, 5, resolved.contractCatalog === true))
    expect(resolveCourseReplaySeed(resolved, 9001).detail).toBe(course.detail)
  }
  expect(details).toBe(45); expect(names).toBe(15)
})

it('retains the Free flight label even when clearing a migrated mission', () => {
  const spec = generateLegacyMission(COURSE_LIBRARY.find(c => c.id === 'training-orbit')!, 42)!.spec
  setTerrainProfile(spec.terrain)
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, 'free')
    expect(mission.routeSummary.label).toBe('FREE FLIGHT')
    expect(mission.totalGates).toBe(0)
  } finally { mission.dispose() }
})

for (const course of COURSE_LIBRARY.filter(c => c.seed !== null)) it.each([42, 1337, 9001])(`${course.id} seed %s shows its actual terrain recipe without changing objectives`, seed => {
  const resolved = resolveCourseReplaySeed(resolveCourseDefinition(course), seed)
  const adapted = generateLegacyMission(resolved, seed)!, { spec } = adapted, pad = spec.landingRunway
  const old = before.catalog.find((c: { original: CourseDefinition }) => c.original.id === course.id)
  expect(spec.theme).toBe(course.id === 'river-run' ? 'waterway-run' : old.resolved.terrainTheme)
  expect(resolved.terrainTheme).toBe(spec.theme)
  expect(adapted.contractSeed).toBe(course.seed)
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, course.profile!, adapted.modifier)
    expect(mission.routeProfile).toBe(course.profile)
    expect(mission.routeSummary.label).toBe(labels[spec.theme])
    expect(mission.routeBriefing).toContain(`ROUTE ${labels[spec.theme]}`)
    expect(mission.routeModifier).toBe(adapted.modifier)
    if (course.id === 'river-run') {
      expect(spec.course.map(p => waterBodyFromClimate(sampleGeography(p.x, p.z)))).toEqual(expect.arrayContaining(['river', 'lake']))
      expect(legacyGeneratedRecordId(course, seed)).toContain(':generated-waterway:r32:l136:q159:mission:river-run')
    } else {
      // The existing 71 mappings retain their theme and use the new gate distribution.
      expect(spec.course).toEqual(generateMission(seed, old.resolved.terrainTheme, course.profile === 'orbit').course)
    }
  } finally { mission.dispose() }
})
