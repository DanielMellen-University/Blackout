import { afterEach, expect, it } from 'vitest'
import { generateMission } from '../src/systems/MissionGenerator'
import { buildMissionRoute, missionLegClearance } from '../src/systems/Mission'
import { courseDefinitionForId, courseRunId, courseSessionId, resolveCourseReplaySeed } from '../src/systems/CourseLibrary'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { sampleGeography } from '../src/world/Geography'
import { coastField } from '../src/world/Coastline'
import { hydrologyWaterLevelAt } from '../src/world/Hydrology'
import { clearOpsPad, getOpsPad, sampleTerrainSurfaceHeightFast, setOpsPad } from '../src/world/terrainSample'
import { settlementAnchorCells, settlementForCell } from '../src/world/SettlementPlan'
import { generateTerrainGeometry, CHUNK_SIZE } from '../src/world/TerrainGeometry'

const themes = ['coastal-island-run', 'volcanic-run'] as const
const courseForTheme = (theme: typeof themes[number]) => courseDefinitionForId(theme === 'volcanic-run' ? 'generated-volcanic-run' : theme)
const seeds = [42, 73, 808, 1337, 2026, 9001]
afterEach(() => { setTerrainProfile(null); clearOpsPad() })
function setup(seed: number, theme: typeof themes[number]) {
  const spec = generateMission(seed, theme)
  setWorldSeed(seed); setTerrainProfile(JSON.parse(JSON.stringify(spec.terrain)))
  setOpsPad(spec.landingRunway.x, spec.landingRunway.z, spec.landingRunway.y, spec.landingRunway.yaw)
  return spec
}
for (const theme of themes) it.each(seeds)('validates the seeded %s corridor, replay and ordinary record identity', seed => {
  const spec = setup(seed, theme), start = spec.start
  const route = buildMissionRoute(start.x, start.y, start.z, start.yaw, spec.profile)
  let previous = start
  for (const [leg, point] of route.entries()) {
    const dx = point.x - previous.x, dz = point.z - previous.z, length = Math.hypot(dx, dz)
    for (let step = 1; step <= 60; step++) {
      const t = step / 60
      for (const lateral of [-52, 0, 52]) {
        const x = previous.x + dx * t + dz / length * lateral
        const z = previous.z + dz * t - dx / length * lateral
        const y = previous.y + (point.y - previous.y) * t
        expect(y - sampleTerrainSurfaceHeightFast(x, z)).toBeGreaterThanOrEqual(missionLegClearance(leg, length * t, length) - .1)
      }
    }
    previous = { ...point, yaw: start.yaw }
  }
  const replay = resolveCourseReplaySeed(courseForTheme(theme), seed + .123456)
  const identity = courseRunId(replay)
  expect(identity).toBe(`seed:${seed}.123456:${spec.profile}:r32:l${spec.terrain.landscapeRevision}:q${spec.terrain.routeRevision}:s1`)
  expect(courseSessionId(theme, seed + .123456, spec.profile)).toBe(identity)
  expect(identity).not.toBe(courseRunId(resolveCourseReplaySeed(courseDefinitionForId('desert-run'), seed + .123456)))
  expect(courseRunId(resolveCourseReplaySeed(courseDefinitionForId('desert-run'), seed))).toBe(`seed:${seed}:generated-desert:r32:l33:q56:s1`)
  expect(courseRunId(resolveCourseReplaySeed(courseDefinitionForId('mountain-valley-run'), seed))).toBe(`seed:${seed}:generated-valley:r32:l33:q57:s1`)
})

it.each(seeds)('has real open sea, beaches, cliffs and a small coastal town on seed %s', seed => {
  const spec = setup(seed, 'coastal-island-run'), p = spec.terrain
  const world = (r: number, f: number) => ({ x: p.originX + Math.cos(p.yaw) * r + Math.sin(p.yaw) * f,
    z: p.originZ - Math.sin(p.yaw) * r + Math.cos(p.yaw) * f })
  for (const [r, f] of [[0, 1800], [9000, 0], [0, 9000]]) {
    const w = world(r!, f!), sample = sampleGeography(w.x, w.z)
    expect(sample.biome).toBe('ocean'); expect(sample.height).toBeLessThan(0)
    expect(coastField(w.x, w.z)).toBeLessThan(0)
    expect(hydrologyWaterLevelAt(w.x, w.z)).toBe(0)
  }
  let beach = false, cliff = false
  for (let r = -3600; r < -1000; r += 40) {
    const w = world(r, -1900), s = sampleGeography(w.x, w.z)
    beach ||= s.height > 0 && s.height < 12 && s.coastal > .3
    cliff ||= s.height > 150
  }
  expect(beach).toBe(true); expect(cliff).toBe(true)
  const cells = settlementAnchorCells('village', getOpsPad())
  const town = cells.map(([x,z]) => settlementForCell(x,z,'village')).find(Boolean)
  expect(town?.kind).toBe('village'); expect(town!.buildings.length).toBeGreaterThanOrEqual(6)
  expect(town!.radius).toBeLessThan(700)
  // A same-seed switch cannot reuse either settlement plans or anchor metadata.
  setTerrainProfile(generateMission(seed, 'mountain-valley-run').terrain)
  expect(settlementAnchorCells('city', getOpsPad()).length).toBeGreaterThan(0)
  settlementForCell(cells[0]![0], cells[0]![1], 'village')
  setTerrainProfile(spec.terrain)
  expect(settlementAnchorCells('city', getOpsPad())).toEqual([])
  expect(cells.map(([x,z]) => settlementForCell(x,z,'village')).find(Boolean)).toEqual(town)
})

it('keeps open-sea near/far shared geometry and water in the existing tile pipeline', () => {
  const spec = setup(2026, 'coastal-island-run'), p = spec.terrain
  const x = Math.floor((p.originX + Math.sin(p.yaw) * 1800) / CHUNK_SIZE) * CHUNK_SIZE
  const z = Math.floor((p.originZ + Math.cos(p.yaw) * 1800) / CHUNK_SIZE) * CHUNK_SIZE
  const near = generateTerrainGeometry(x,z,0), far = generateTerrainGeometry(x,z,2)
  expect(near.water).not.toBeNull(); expect(far.water).not.toBeNull()
  const ratio = near.segs / far.segs
  for (let row=0; row<=far.segs; row++) for(let col=0; col<=far.segs; col++)
    expect(far.heights[row*(far.segs+1)+col]).toBe(near.heights[row*ratio*(near.segs+1)+col*ratio])
})

it.each(seeds)('has large volcanic cones, summit calderas and a low dark lava corridor on seed %s', seed => {
  const spec = setup(seed, 'volcanic-run'), p=spec.terrain
  const sample = (r: number, f: number) => sampleGeography(p.originX + Math.cos(p.yaw)*r + Math.sin(p.yaw)*f,
    p.originZ - Math.sin(p.yaw)*r + Math.cos(p.yaw)*f)
  for (const [r,f,radius] of [[-2200,3200,1800],[3300,4500,1800],[-2700,-3400,1600]]) {
    const center=sample(r!,f!),rim=sample(r!+radius!*.28,f!)
    expect(center.landform.caldera).toBe(1)
    expect(center.height-p.baseHeight).toBeGreaterThan(900)
    expect(rim.height-center.height).toBeGreaterThan(450)
    expect(rim.height-p.baseHeight).toBeGreaterThan(1600)
    expect(rim.biome).toBe('volcanic'); expect(rim.biomeWeights!.find(([biome])=>biome==='volcanic')![1]).toBe(1)
  }
  for(const point of spec.course) {
    const s=sampleGeography(point.x,point.z)
    expect(s.biome).toBe('volcanic'); expect(s.height-p.baseHeight).toBeLessThan(60)
  }
  // Populate both planner caches before returning to the original profile.
  const cells=settlementAnchorCells('village',getOpsPad())
  const initial=settlementForCell(cells[0]![0],cells[0]![1],'village')
  setTerrainProfile(generateMission(seed,'coastal-island-run').terrain)
  expect(settlementAnchorCells('city',getOpsPad())).toEqual([])
  settlementForCell(cells[0]![0],cells[0]![1],'village')
  setTerrainProfile(spec.terrain)
  expect(settlementAnchorCells('city',getOpsPad()).length).toBeGreaterThan(0)
  expect(settlementForCell(cells[0]![0],cells[0]![1],'village')).toEqual(initial)
  expect(courseRunId(resolveCourseReplaySeed(courseForTheme('volcanic-run'),seed))).not.toBe(
    courseRunId(resolveCourseReplaySeed(courseDefinitionForId('coastal-island-run'),seed)))
})
