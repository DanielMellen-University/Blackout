import { expect, it, vi } from 'vitest'
import { RoadProfileCache, MAX_ROAD_PROFILE_CACHE_ENTRIES, MAX_ROAD_PROFILE_CACHE_POINTS } from '../src/world/RoadProfileCache'
import type { RegionalRoadLink } from '../src/world/RegionalRoads'
import type { SettlementRoad } from '../src/world/SettlementPlan'

function link(n = 0): RegionalRoadLink {
  const a = { id: '0,0', x: 100, y: 120, z: 100, radius: 500, biome: 'plains' as const, kind: 'village' as const,
    roads: [{ width: 10, points: [{ x: 100, y: 120.45, z: 100, structure: 'ground' as const }] }] }
  return { key: `0,0|${n + 1},0`, from: a, to: { ...a, id: `${n + 1},0`, x: 24000 * (n + 1) } }
}
function road(points = 10): SettlementRoad {
  return { width: 10, points: Array.from({ length: points }, (_, x) => ({ x, y: 100, z: 0 })) }
}
it('reuses successes and failures, but never a different attachment or world context', () => {
  const cache = new RoadProfileCache(), build = vi.fn(() => road())
  cache.setContext('seed1/pad1/generation1')
  expect(cache.getOrBuild(link(), build)).toBe(cache.getOrBuild(link(), build))
  expect(build).toHaveBeenCalledTimes(1)
  const changed = link(); changed.from.roads[0]!.points[0]!.z++
  cache.getOrBuild(changed, build); expect(build).toHaveBeenCalledTimes(2)
  cache.setContext('seed1/pad1/generation1'); cache.getOrBuild(link(), build); expect(build).toHaveBeenCalledTimes(2)
  cache.setContext('seed1/pad2/generation1'); cache.getOrBuild(link(), build); expect(build).toHaveBeenCalledTimes(3)
  const failure = vi.fn(() => null)
  expect(cache.getOrBuild(link(2), failure)).toBeNull(); expect(cache.getOrBuild(link(2), failure)).toBeNull()
  expect(failure).toHaveBeenCalledTimes(1)
})
it('evicts by both total profile points and entry count, including cached failures', () => {
  const cache = new RoadProfileCache(), build = vi.fn(() => road(MAX_ROAD_PROFILE_CACHE_POINTS / 2 + 1))
  cache.getOrBuild(link(), build); cache.getOrBuild(link(1), build)
  cache.getOrBuild(link(), build); expect(build).toHaveBeenCalledTimes(3)
  const fail = vi.fn(() => null)
  for (let i = 2; i < MAX_ROAD_PROFILE_CACHE_ENTRIES + 3; i++) cache.getOrBuild(link(i), fail)
  cache.getOrBuild(link(), build); expect(build).toHaveBeenCalledTimes(4)
  cache.getOrBuild(link(2), fail); expect(fail).toHaveBeenCalledTimes(MAX_ROAD_PROFILE_CACHE_ENTRIES + 2)
})
it('does not retain an oversized profile and propagates failed builds without poisoning the cache', () => {
  const cache = new RoadProfileCache(), build = vi.fn(() => road(MAX_ROAD_PROFILE_CACHE_POINTS + 1))
  cache.getOrBuild(link(), build); cache.getOrBuild(link(), build); expect(build).toHaveBeenCalledTimes(2)
  expect(() => cache.getOrBuild(link(1), () => { throw new Error('failed') })).toThrow('failed')
  const recovered = road()
  expect(cache.getOrBuild(link(1), () => recovered)).toBe(recovered)
})
