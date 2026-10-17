import { afterEach, expect, it, vi } from 'vitest'
import { selectRegionalRoadLinks, regionalLinksForSettlement, buildableRegionalLinksForSettlement,
  roadBetweenSettlements, MAX_REGIONAL_LINK_ATTEMPTS } from '../src/world/RegionalRoads'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import { setWorldSeed } from '../src/world/noise'
import * as terrain from '../src/world/terrainSample'

afterEach(() => vi.restoreAllMocks())
function site(id: string, x: number, z = 12000, kind: 'village' | 'city' = 'village'): SettlementPlan {
  return { id, x, y: 120, z, radius: 1000, kind, biome: 'plains', buildings: [],
    roads: [{ width: 10, points: [{ x: x - 200, y: 120.45, z }, { x: x + 200, y: 120.45, z }] }] }
}

it('skips failed ranked candidates while preserving sparse per-source success limits', () => {
  setWorldSeed(1)
  const city = site('0,0', 12000, 12000, 'city')
  const candidates = Array.from({ length: 8 }, (_, i) => site(`${i + 1},0`, 20000 + i * 1000))
  const accepted = vi.fn(link => !['0,0|1,0', '0,0|2,0'].includes(link.key))
  const links = selectRegionalRoadLinks(city, candidates, accepted)
  expect(links.map(link => link.key)).toEqual(['0,0|3,0', '0,0|4,0'])
  expect(accepted).toHaveBeenCalledTimes(MAX_REGIONAL_LINK_ATTEMPTS)
  expect(selectRegionalRoadLinks(city, [...candidates].reverse(), accepted)).toEqual(links)
  const fail = vi.fn(() => false)
  expect(selectRegionalRoadLinks(city, candidates, fail)).toEqual([])
  expect(fail).toHaveBeenCalledTimes(MAX_REGIONAL_LINK_ATTEMPTS)
  const village = { ...city, kind: 'village' as const }
  expect(selectRegionalRoadLinks(village, candidates, () => true)).toHaveLength(1)
})

it('connects to an alternative when the preferred hub is across an impassable sea', () => {
  setWorldSeed(1)
  vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x) => {
    out.height = x > 22000 && x < 28000 ? -20 : 120; out.waterLevel = 0
    out.landform.ridge = 0; out.landform.alpineValley = 0; return out
  })
  const source = site('0,0', 12000), blocked = site('1,0', 36000, 12000, 'city'), reachable = site('0,1', 12000, 36000)
  const plans = new Map([source, blocked, reachable].map(plan => [plan.id, plan]))
  const resolve = (x: number, z: number) => plans.get(`${x},${z}`) ?? null
  const old = regionalLinksForSettlement(source, resolve)
  expect(old.map(link => link.key)).toEqual(['0,0|1,0'])
  expect(roadBetweenSettlements(old[0]!.from, old[0]!.to, resolve)).toBeNull()
  const links = buildableRegionalLinksForSettlement(source, resolve)
  expect(links.map(link => link.key)).toEqual(['0,0|0,1'])
  const road = roadBetweenSettlements(links[0]!.from, links[0]!.to, resolve)!
  expect(road).not.toBeNull()
  expect(road.points[0]!.x).toBe(source.x - 200)
  expect(JSON.stringify(links).length).toBeLessThan(2000)
  const discover = (reverse: boolean) => {
    const sources = reverse ? [reachable, source] : [source, reachable]
    return [...new Set(sources.flatMap(p => buildableRegionalLinksForSettlement(p, resolve).map(link => link.key)))].sort()
  }
  expect(discover(true)).toEqual(discover(false))
})

it('counts missing street attachments against the same fixed attempt cap', () => {
  setWorldSeed(1)
  const sample = vi.spyOn(terrain, 'sampleClimateInto').mockImplementation(out => { out.height = 120; out.waterLevel = 0; return out })
  const source = site('0,0', 12000)
  const candidates = ['1,0', '0,1', '-1,0', '0,-1', '1,1'].map((id, i) => ({ ...site(id, 20000 + i * 1000), roads: [] }))
  const resolve = (x: number, z: number) => candidates.find(p => p.id === `${x},${z}`) ?? null
  const profile = vi.fn(() => ({ width: 10, points: [] }))
  expect(buildableRegionalLinksForSettlement(source, resolve, [], profile)).toEqual([])
  expect(profile).not.toHaveBeenCalled()
  expect(sample).toHaveBeenCalledTimes(MAX_REGIONAL_LINK_ATTEMPTS * 5)
})

it('spreads a city second spoke beyond a near-parallel neighbour without adding attempts', () => {
  const city = site('0,0', 12000, 12000, 'city')
  const east = site('1,0', 20000), parallel = site('2,0', 24000), west = site('-1,0', -4000)
  const candidates = [east, parallel, west]
  const accept = vi.fn(() => true)
  const links = selectRegionalRoadLinks(city, candidates, accept)
  expect(links.map(link => link.key)).toEqual(['0,0|1,0', '-1,0|0,0'])
  expect(accept).toHaveBeenCalledTimes(2)
  expect(selectRegionalRoadLinks(city, [...candidates].reverse(), () => true)).toEqual(links)
  expect(selectRegionalRoadLinks({ ...city, kind: 'village' }, candidates, () => true)).toHaveLength(1)
})

it('falls back to a near-parallel spoke when wider city candidates fail within the same cap', () => {
  const city = site('0,0', 12000, 12000, 'city')
  const candidates = [site('1,0', 20000), site('2,0', 24000), site('-1,0', -4000), site('0,1', 12000, 30000)]
  const attempted: string[] = []
  const links = selectRegionalRoadLinks(city, candidates, link => {
    attempted.push(link.key)
    return link.key === '0,0|1,0' || link.key === '0,0|2,0'
  })
  expect(attempted).toEqual(['0,0|1,0', '-1,0|0,0', '0,0|0,1', '0,0|2,0'])
  expect(attempted).toHaveLength(MAX_REGIONAL_LINK_ATTEMPTS)
  expect(links).toHaveLength(2)
})
