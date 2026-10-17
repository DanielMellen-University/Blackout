import { afterEach, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import { regionalLinksForSettlement, roadBetweenSettlements, compactRegionalRoadLink,
  buildableRegionalLinksForSettlement, MAX_REGIONAL_LINK_ATTEMPTS } from '../src/world/RegionalRoads'
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
    const road = roadBetweenSettlements(link.from, link.to, settlementForCell)
    if (!road) continue
    const compact = compactRegionalRoadLink(link)!
    expect(compact).not.toBeNull()
    expect(JSON.stringify(compact).length).toBeLessThan(2000)
    expect(JSON.stringify(roadBetweenSettlements(compact.from, compact.to, settlementForCell))).toBe(JSON.stringify(road))
    connected++
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!, b = road.points[i]!
      expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(Math.hypot(b.x - a.x, b.z - a.z) * MAX_REGIONAL_ROAD_GRADE)
    }
  }
  expect(connected).toBeGreaterThan(0)
}, 60_000)

it.each([[1337, 1, 1], [1, -7, -5]])('selects buildable spokes in seed %i cell %i,%i', (seed, cx, cz) => {
  clearOpsPad(); setWorldSeed(seed!)
  const plan = settlementForCell(cx!, cz!)!
  const attempts: { key: string; accepted: boolean }[] = []
  const links = buildableRegionalLinksForSettlement(plan, settlementForCell, [], link => {
    const road = roadBetweenSettlements(link.from, link.to, settlementForCell)
    attempts.push({ key: link.key, accepted: !!road }); return road
  })
  const original = regionalLinksForSettlement(plan).map(link => link.key)
  const originalUsable = attempts.filter(attempt => original.includes(attempt.key) && attempt.accepted).length
  expect(links.length).toBeGreaterThanOrEqual(originalUsable)
  expect(links.length).toBeGreaterThan(0)
  expect(attempts.length).toBeLessThanOrEqual(MAX_REGIONAL_LINK_ATTEMPTS)
  expect(links.every(link => attempts.some(a => a.key === link.key && a.accepted))).toBe(true)
}, 60000)
