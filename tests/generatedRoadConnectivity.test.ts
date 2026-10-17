import { afterEach, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, setOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement, regionalLinksForSettlement, roadBetweenSettlements } from '../src/world/RegionalRoads'
import { RoadProfileCache } from '../src/world/RoadProfileCache'
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
