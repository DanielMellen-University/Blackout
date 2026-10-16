import { afterEach, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import { regionalLinksForSettlement, roadBetweenSettlements } from '../src/world/RegionalRoads'
import { MAX_REGIONAL_ROAD_GRADE } from '../src/world/RoadRouting'

afterEach(() => clearOpsPad())

it.each([[1337, 1, 1], [1, -7, -5]])('retains usable regional routes around seed %i cell %i,%i', (seed, cx, cz) => {
  clearOpsPad(); setWorldSeed(seed!)
  const plan = settlementForCell(cx!, cz!)!
  expect(plan).not.toBeNull()
  const links = regionalLinksForSettlement(plan)
  expect(links.length).toBeGreaterThan(0)
  let connected = 0
  for (const link of links) {
    const road = roadBetweenSettlements(link.from, link.to)
    if (!road) continue
    connected++
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!, b = road.points[i]!
      expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(Math.hypot(b.x - a.x, b.z - a.z) * MAX_REGIONAL_ROAD_GRADE)
    }
  }
  expect(connected).toBeGreaterThan(0)
}, 60_000)
