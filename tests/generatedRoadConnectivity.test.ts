import { afterEach, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'
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
