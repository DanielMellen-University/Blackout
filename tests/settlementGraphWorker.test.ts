import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import type { SettlementWorkerReply, SettlementWorkerRequest } from '../src/world/settlement.worker'
import * as roads from '../src/world/RegionalRoads'

vi.mock('../src/world/SettlementPlan', () => ({ SETTLEMENT_CELL_SIZE: 24000,
  settlementForCell: (x: number, z: number, kind?: 'city' | 'village') => site(x, z, kind) }))
vi.mock('../src/world/terrainSample', async importOriginal => ({
  ...await importOriginal<object>(),
  sampleClimateInto: (out: { height: number; waterLevel: number }) => { out.height = 100; out.waterLevel = 0; return out },
}))

function site(cx: number, cz: number, kind: 'city' | 'village' = 'village'): SettlementPlan | null {
  if (![[0, 0], [1, 0], [0, 1]].some(([x, z]) => cx === x && cz === z)) return null
  const x = cx * (kind === 'city' ? 18000 : 24000), z = cz * 24000
  return { id: `${cx},${cz}`, kind, biome: 'plains', x, y: 100, z, radius: 500,
    buildings: Array.from({ length: 1000 }, () => ({ x, y: 100, z, width: 20, depth: 20, height: 12, yaw: 0,
      shape: 'block' as const, roof: 'flat' as const, wallColor: 0xffffff, roofColor: 0x555555 })),
    roads: [{ width: 10, points: [{ x: x - 200, y: 100.45, z }, { x: x + 200, y: 100.45, z }] }] }
}
const scope = { onmessage: null as ((event: { data: SettlementWorkerRequest }) => void) | null,
  postMessage: vi.fn<(reply: SettlementWorkerReply) => void>() }
beforeAll(async () => { vi.stubGlobal('self', scope); await import('../src/world/settlement.worker') })
beforeEach(() => scope.postMessage.mockClear())
afterAll(() => vi.unstubAllGlobals())
afterEach(() => vi.restoreAllMocks())

it('resolves protected neighbours in the worker and transfers only the selected ground attachments', () => {
  scope.onmessage!({ data: { type: 'links', key: '0,0', cx: 0, cz: 0, x: 0, z: 0,
    kind: 'village', seed: 1, generation: 7, pad: null, protected: [{ cx: 1, cz: 0, kind: 'city' }] } })
  const reply = scope.postMessage.mock.calls[0]![0]
  expect(reply.type).toBe('links'); expect(reply.generation).toBe(7)
  if (reply.type !== 'links') throw new Error('Expected graph reply')
  expect(reply.links).toHaveLength(1)
  const link = reply.links[0]!
  expect(link.to.kind).toBe('city'); expect(link.to.x).toBe(18000)
  expect(link.from.roads[0]!.points[0]!.x).toBe(200)
  expect(link.to.roads[0]!.points[0]!.x).toBe(17800)
  expect(JSON.stringify(reply).length).toBeLessThan(2000)
  for (const endpoint of [link.from, link.to]) {
    expect(endpoint).not.toHaveProperty('buildings'); expect(endpoint).not.toHaveProperty('ground')
    expect(endpoint.roads).toHaveLength(1); expect(endpoint.roads[0]!.points).toHaveLength(1)
    expect(endpoint.roads[0]!.points[0]!.structure).toBe('ground')
  }
})

it('returns an empty graph for a missing source without blocking the worker protocol', () => {
  scope.onmessage!({ data: { type: 'links', key: '4,4', cx: 4, cz: 4, x: 96000, z: 96000,
    kind: 'village', seed: 1, generation: 8, pad: null, protected: [] } })
  expect(scope.postMessage.mock.calls[0]![0]).toEqual({ type: 'links', key: '4,4', generation: 8, links: [] })
})

it('resolves a forced source blueprint before choosing its two city links', () => {
  scope.onmessage!({ data: { type: 'links', key: '1,0', cx: 1, cz: 0, x: 18000, z: 0,
    kind: 'city', seed: 1, generation: 9, pad: null, protected: [{ cx: 1, cz: 0, kind: 'city' }] } })
  const reply = scope.postMessage.mock.calls[0]![0]
  if (reply.type !== 'links') throw new Error('Expected graph reply')
  expect(reply.links).toHaveLength(2)
  for (const link of reply.links) {
    const source = link.from.id === '1,0' ? link.from : link.to
    expect(source.kind).toBe('city'); expect(source.x).toBe(18000)
  }
})

it('recovers protected full plans for compact road jobs and rejects mismatched ownership', () => {
  const protectedSpecs = [{ cx: 1, cz: 0, kind: 'city' as const }]
  scope.onmessage!({ data: { type: 'links', key: '0,0', cx: 0, cz: 0, x: 0, z: 0,
    kind: 'village', seed: 1, generation: 10, pad: null, protected: protectedSpecs } })
  const graph = scope.postMessage.mock.calls[0]![0]
  if (graph.type !== 'links') throw new Error('Expected graph')
  const link = graph.links[0]!
  scope.onmessage!({ data: { type: 'road', ...link, seed: 1, generation: 10, pad: null, protected: protectedSpecs } })
  const result = scope.postMessage.mock.calls[1]![0]
  if (result.type !== 'road') throw new Error('Expected road')
  expect(result.road).not.toBeNull()
  expect(result.fromId).toBe(link.from.id); expect(result.toId).toBe(link.to.id)
  scope.onmessage!({ data: { type: 'road', ...link, seed: 1, generation: 10, pad: null, protected: [] } })
  const rejected = scope.postMessage.mock.calls[2]![0]
  expect(rejected.type === 'road' && rejected.road).toBeNull()
})

it('skips an unbuildable hub and reuses the successful profile in a compact road request', () => {
  const original = roads.roadBetweenSettlements
  const build = vi.spyOn(roads, 'roadBetweenSettlements').mockImplementation((a, b, resolve, protectedPlans) =>
    a.kind === 'city' || b.kind === 'city' ? null : original(a, b, resolve, protectedPlans))
  const protectedSpecs = [{ cx: 1, cz: 0, kind: 'city' as const }]
  scope.onmessage!({ data: { type: 'links', key: '0,0', cx: 0, cz: 0, x: 0, z: 0,
    kind: 'village', seed: 1, generation: 42, pad: null, protected: protectedSpecs } })
  const graph = scope.postMessage.mock.calls[0]![0]
  if (graph.type !== 'links') throw new Error('Expected graph')
  expect(graph.links.map(link => link.key)).toEqual(['0,0|0,1'])
  expect(JSON.stringify(graph).length).toBeLessThan(2000)
  expect(build).toHaveBeenCalledTimes(2)
  const link = graph.links[0]!
  const request = { type: 'road' as const, ...link, seed: 1, generation: 42, pad: null, protected: protectedSpecs }
  scope.onmessage!({ data: request })
  expect(build).toHaveBeenCalledTimes(2)
  const result = scope.postMessage.mock.calls[1]![0]
  expect(result.type === 'road' && result.road).not.toBeNull()
  scope.onmessage!({ data: { type: 'settlement', key: '0,0', cx: 0, cz: 0, seed: 1, generation: 42, pad: null } })
  scope.onmessage!({ data: request })
  expect(build).toHaveBeenCalledTimes(2)
  scope.onmessage!({ data: { type: 'settlement', key: '0,0', cx: 0, cz: 0, seed: 1, generation: 43, pad: null } })
  scope.onmessage!({ data: { ...request, generation: 43 } })
  expect(build).toHaveBeenCalledTimes(3)
  scope.onmessage!({ data: { ...request, generation: 43, pad: { x: 0, y: 100, z: 0, yaw: .3 } } })
  expect(build).toHaveBeenCalledTimes(4)
})
