import { afterEach, expect, it } from 'vitest'
import corpus from './fixtures/village-coverage.json'
import { auditRoad, auditStreetEnds } from './helpers/roadIntegrity'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement, roadBetweenSettlements } from '../src/world/RegionalRoads'
import { groundRoad } from '../src/world/RoadSurface'

afterEach(() => clearOpsPad())

it.each([42, 73, 808, 1337])('audits seed %s generated local streets, complete regional profiles, structures and both joins', seed => {
  clearOpsPad(); setWorldSeed(seed)
  const seen = new Set<string>()
  for (const site of corpus.sites.filter(s => s.seed === seed)) {
    const [cx, cz] = site.id.split(',').map(Number), plan = settlementForCell(cx!, cz!)!
    for (const road of plan.roads) expect(auditRoad(road).failures).toEqual([])
    expect(auditStreetEnds(plan).unexpectedTruncations).toEqual([])
    expect(auditStreetEnds(plan).ends).toHaveLength(plan.roads.length * 2)
    for (const link of buildableRegionalLinksForSettlement(plan)) {
      if (seen.has(link.key)) continue
      seen.add(link.key)
      const plans = [link.from, link.to].map(p => {
        const [x,z] = p.id.split(',').map(Number)
        return settlementForCell(x!, z!)!
      })
      const road = roadBetweenSettlements(link.from, link.to, settlementForCell)!
      const result = auditRoad(road, plans)
      expect(result.failures, link.key).toEqual([])
      expect(result.joins).toBe(2)
      expect(result.maxGrade).toBeLessThanOrEqual(.240001)
    }
  }
  expect(seen.size).toBeGreaterThanOrEqual(3)
}, 90_000)

it('detects a floating ground section, missing support, broken step and detached street join', () => {
  setWorldSeed(42)
  const plan = settlementForCell(-6,-4)!, road = structuredClone(plan.roads[0]!)
  road.points[0]!.y += 2
  expect(auditRoad(road).failures.some(f => f.startsWith('ground-contact:'))).toBe(true)
  road.points[2]!.x += 100
  expect(auditRoad(road).failures.some(f => f.startsWith('gap:'))).toBe(true)
  const straight = groundRoad([{x:0,z:0},{x:500,z:0}],10,()=>({height:100}))!
  for (const p of straight.points) { p.y = p.leftY = p.rightY = 120; p.structure = 'viaduct' }
  // A valid supported viaduct is accepted; its deck cannot masquerade as ground.
  expect(auditRoad(straight).failures.some(f => f.startsWith('unsupported:'))).toBe(false)
  const tooLong = groundRoad([{x:0,z:0},{x:32000,z:0}],10,()=>({height:100}))!
  for (const p of tooLong.points) { p.y = p.leftY = p.rightY = 120; p.structure = 'viaduct' }
  expect(auditRoad(tooLong).failures.some(f => f.startsWith('unsupported:'))).toBe(true)
  expect(auditRoad(road,[{...plan,roads:[]}]).failures.some(f => f.startsWith('street-join:'))).toBe(true)
})
