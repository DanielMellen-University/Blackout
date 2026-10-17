import { afterEach, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, sampleClimate, setOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement, regionalLinksForSettlement, roadBetweenSettlements } from '../src/world/RegionalRoads'
import { RoadProfileCache } from '../src/world/RoadProfileCache'
import { MAX_ROAD_BRIDGE_SPAN, MAX_ROAD_STRUCTURE_HEIGHT, MAX_ROAD_SUPPORTS, bridgeSupportPoints } from '../src/world/RoadSurface'
import { roadGradeValid } from '../src/world/RoadRouting'

afterEach(() => clearOpsPad())

it('replaces three impassable proposals with a usable fourth link in actual seed-73 geography', () => {
  clearOpsPad(); setWorldSeed(73)
  const source = settlementForCell(-3, -2)!
  expect(source.kind).toBe('village')
  expect(regionalLinksForSettlement(source).map(link => link.key)).toEqual(['-3,-2|-4,-2'])
  const cache = new RoadProfileCache(), attempts: { key: string; accepted: boolean }[] = []
  const links = buildableRegionalLinksForSettlement(source, settlementForCell, [], link => cache.getOrBuild(link, () => {
    const road = roadBetweenSettlements(link.from, link.to, settlementForCell)
    attempts.push({ key: link.key, accepted: !!road }); return road
  }))
  expect(attempts.map(attempt => attempt.accepted)).toEqual([false, false, false, true])
  expect(links.map(link => link.key)).toEqual(['-2,-2|-3,-2'])
  expect(regionalLinksForSettlement(settlementForCell(-2, -2)!).map(link => link.key)).not.toContain(links[0]!.key)
  expect(JSON.stringify(links).length).toBeLessThan(2000)
  const buildAgain = () => { throw new Error('Selected profile should remain cached') }
  const road = cache.getOrBuild(links[0]!, buildAgain)!
  expect(roadGradeValid(road)).toBe(true)
  expect(road.points.length).toBeGreaterThan(500)
  expect(road.points[0]!.structure).toBe('ground'); expect(road.points.at(-1)!.structure).toBe('ground')
}, 60000)

it('replaces a usable near-parallel city spoke with a usable wider route in actual seed 32', () => {
  clearOpsPad(); setWorldSeed(32)
  const spawn = findPlayableSpawn()!
  setOpsPad(spawn.x, spawn.z, spawn.y, spawn.yaw)
  const source = settlementForCell(0, 0)!, first = settlementForCell(-2, -1)!
  const formerSecond = settlementForCell(-1, 0)!, wider = settlementForCell(-2, 2)!
  expect(source.kind).toBe('city')
  // This was the second buildable choice on 10.909, not a failed-road replacement.
  expect(roadBetweenSettlements(source, formerSecond, settlementForCell)).not.toBeNull()
  const cosine = (other: typeof source) => {
    const ax = first.x - source.x, az = first.z - source.z
    const bx = other.x - source.x, bz = other.z - source.z
    return (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz))
  }
  expect(cosine(formerSecond)).toBeGreaterThan(.5)
  expect(cosine(wider)).toBeLessThan(.5)
  const attempts: string[] = []
  const links = buildableRegionalLinksForSettlement(source, settlementForCell, [], link => {
    attempts.push(link.key)
    const road = roadBetweenSettlements(link.from, link.to, settlementForCell)
    if (road) {
      expect(roadGradeValid(road)).toBe(true)
      expect(road.points[0]!.structure).toBe('ground')
      expect(road.points.at(-1)!.structure).toBe('ground')
    }
    return road
  })
  expect(attempts).toEqual(['-2,-1|0,0', '-2,2|0,0'])
  expect(links.map(link => link.key)).toEqual(attempts)
  expect(JSON.stringify(links).length).toBeLessThan(4000)
}, 60_000)

it('connects an actual seed-73 rural fuel stop to the regional road approach', () => {
  clearOpsPad(); setWorldSeed(73)
  const source = settlementForCell(-4, -7)!
  const station = source.buildings.find(b => b.use === 'gas-station' && b.service)!
  expect(station).toBeDefined()
  const attempts: string[] = []
  const links = buildableRegionalLinksForSettlement(source, settlementForCell, [], link => {
    attempts.push(link.key)
    return roadBetweenSettlements(link.from, link.to, settlementForCell)
  })
  expect(attempts.length).toBeLessThanOrEqual(4)
  expect(links).toHaveLength(1)
  const endpoint = links[0]!.from.id === source.id ? links[0]!.from : links[0]!.to
  const join = endpoint.roads[0]!.points[0]!
  expect(Math.hypot(join.x - station.x, join.z - station.z)).toBeLessThan(120)
  expect(source.roads.some(r => r.gateway && r.points.some(p => p.x === join.x && p.z === join.z))).toBe(true)
  const road = roadBetweenSettlements(links[0]!.from, links[0]!.to, settlementForCell)!
  expect(road).not.toBeNull()
  expect(roadGradeValid(road)).toBe(true)
  expect(road.points[0]!.structure).toBe('ground')
  expect(road.points.at(-1)!.structure).toBe('ground')
}, 60000)


it('connects the actual seed-73 coastal village to an inland neighbour without a wet ground road', () => {
  clearOpsPad(); setWorldSeed(73)
  const source = settlementForCell(-5, -3)!
  expect(source.y).toBeLessThan(5)
  const links = buildableRegionalLinksForSettlement(source)
  expect(links.map(link => link.key)).toEqual(['-5,-2|-5,-3'])
  const link = links[0]!, road = roadBetweenSettlements(link.from, link.to, settlementForCell)!
  expect(road).not.toBeNull(); expect(roadGradeValid(road)).toBe(true)
  expect(roadBetweenSettlements(link.to, link.from, settlementForCell)).toEqual(road)
  expect(road.points[0]!.structure).toBe('ground'); expect(road.points.at(-1)!.structure).toBe('ground')
  expect(road.points[0]!.x).toBe(link.from.roads[0]!.points[0]!.x)
  expect(road.points.at(-1)!.z).toBe(link.to.roads[0]!.points[0]!.z)
  let wetSpan = 0, wetPoints = 0
  for (let i = 0; i < road.points.length; i++) {
    const point = road.points[i]!
    const ground = sampleClimate(point.x, point.z)
    if (ground.height <= (ground.waterLevel ?? 0) + 1) {
      expect(point.bridge).toBe(true); expect(point.y).toBeGreaterThanOrEqual((ground.waterLevel ?? 0) + 7)
      wetPoints++
    }
    if (point.bridge && i) wetSpan += Math.hypot(point.x - road.points[i - 1]!.x, point.z - road.points[i - 1]!.z)
    else wetSpan = 0
    expect(wetSpan).toBeLessThanOrEqual(MAX_ROAD_BRIDGE_SPAN)
    if (point.structure !== 'ground') expect(point.y - Math.min(point.groundY!, point.leftGroundY!, point.rightGroundY!))
      .toBeLessThanOrEqual(MAX_ROAD_STRUCTURE_HEIGHT)
  }
  expect(wetPoints).toBeGreaterThan(0)
  expect(bridgeSupportPoints(road).length).toBeLessThanOrEqual(MAX_ROAD_SUPPORTS)
}, 60000)
