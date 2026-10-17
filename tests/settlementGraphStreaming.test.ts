import { afterEach, describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import type { RegionalRoadLink } from '../src/world/RegionalRoads'
import type { SettlementWorkerRequest } from '../src/world/settlement.worker'

const calls = vi.hoisted(() => ({ plans: 0 }))
vi.mock('../src/world/SettlementPlan', () => ({
  SETTLEMENT_CELL_SIZE: 24_000, MAX_LOCAL_ROAD_POINTS: 20_000,
  settlementForCell: (x: number, z: number) => { calls.plans++; return z === 0 && (x === 0 || x === 1) ? site(x) : null },
  settlementAnchorForCell: () => null,
}))
import { SettlementSystem } from '../src/world/SettlementSystem'

function site(cx = 0): SettlementPlan {
  const x = 12000 + cx * 24000, z = 12000
  return { id: `${cx},0`, x, z, y: 100, radius: 500, kind: 'village', biome: 'plains', buildings: [],
    roads: [{ width: 10, points: [{ x: x - 100, y: 100, z }, { x: x + 100, y: 100, z }] }] }
}
function edge(): RegionalRoadLink {
  const endpoint = (plan: SettlementPlan) => ({ id: plan.id, kind: plan.kind, biome: plan.biome,
    x: plan.x, y: plan.y, z: plan.z, radius: plan.radius,
    roads: [{ width: 10, points: [{ x: plan.x, y: plan.y, z: plan.z, structure: 'ground' as const }] }] })
  return { key: '0,0|1,0', from: endpoint(site()), to: endpoint(site(1)) }
}
class HoldingWorker {
  static current: HoldingWorker
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror = null
  requests: SettlementWorkerRequest[] = []
  terminate = vi.fn()
  constructor() { HoldingWorker.current = this }
  postMessage(request: SettlementWorkerRequest) { this.requests.push(request) }
  reply(data: unknown) { this.onmessage!({ data }) }
}
type View = {
  inFlight: SettlementWorkerRequest | null
  graphQueue: Map<string, unknown>; checkedGraphs: Set<string>
  roadJobs: Map<string, unknown>; checkedLinks: Set<string>
  queue: { key: string; cx: number; cz: number; score: number; distance: number }[]
  linkQueue: RegionalRoadLink[]; protectedPlans: Map<string, SettlementPlan>
  dispatchNearbyJob(x: number, z: number): void
  scheduleLinks(plan: SettlementPlan, key: string): void
  releaseLinksForCell(key: string): void
}
function setup() {
  vi.stubGlobal('Worker', HoldingWorker)
  const system = new SettlementSystem(new Scene()), view = system as unknown as View
  calls.plans = 0
  return { system, view, worker: HoldingWorker.current }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('off-thread settlement graphs', () => {
  it('queues discovery once and accepts compact links without main-thread plan generation', () => {
    const { system, view, worker } = setup()
    try {
      const source = site()
      view.scheduleLinks(source, source.id); view.scheduleLinks(source, source.id)
      expect(view.graphQueue.size).toBe(1); expect(calls.plans).toBe(0)
      view.dispatchNearbyJob(source.x, source.z)
      expect(worker.requests[0]!.type).toBe('links')
      view.dispatchNearbyJob(source.x, source.z)
      expect(worker.requests).toHaveLength(1)
      worker.reply({ ...worker.requests[0], links: [edge()] })
      expect(view.roadJobs.size).toBe(1); expect(calls.plans).toBe(0)
      view.dispatchNearbyJob(source.x, source.z)
      const request = worker.requests[1]!
      expect(request.type).toBe('road')
      expect(JSON.stringify(request).length).toBeLessThan(2000)
      if (request.type === 'road') {
        expect(request.protected).toEqual([])
        expect(request.from).not.toHaveProperty('buildings')
        expect(request.to).not.toHaveProperty('ground')
      }
    } finally { system.dispose() }
  })

  it('shares one worker slot fairly across root, graph and road traffic', () => {
    const { system, view, worker } = setup()
    try {
      const source = site()
      view.queue.push({ key: source.id, cx: 0, cz: 0, score: 0, distance: 0 })
      view.scheduleLinks(source, source.id)
      view.linkQueue.push(edge()); view.checkedLinks.add(edge().key)
      view.dispatchNearbyJob(source.x, source.z)
      view.queue.push({ key: '3,3', cx: 3, cz: 3, score: 0, distance: 0 })
      worker.reply({ ...worker.requests[0], plan: null })
      view.dispatchNearbyJob(source.x, source.z)
      worker.reply({ ...worker.requests[1], links: [] })
      view.dispatchNearbyJob(source.x, source.z)
      expect(worker.requests.map(request => request.type)).toEqual(['settlement', 'links', 'road'])
      expect(view.queue).toHaveLength(1); expect(calls.plans).toBe(0)
    } finally { system.dispose() }
  })

  it('discards a departed source and its in-flight graph result', () => {
    const { system, view, worker } = setup()
    try {
      const source = site()
      view.scheduleLinks(source, source.id); view.dispatchNearbyJob(source.x, source.z)
      view.releaseLinksForCell(source.id)
      worker.reply({ ...worker.requests[0], links: [edge()] })
      expect(view.graphQueue.size).toBe(0); expect(view.checkedGraphs.size).toBe(0)
      expect(view.roadJobs.size).toBe(0); expect(view.inFlight).toBeNull()
    } finally { system.dispose() }
  })

  it('does not release a new graph slot when an old-world reply arrives', () => {
    const { system, view, worker } = setup()
    try {
      const source = site()
      view.scheduleLinks(source, source.id); view.dispatchNearbyJob(source.x, source.z)
      system.clearAll()
      view.scheduleLinks(source, source.id); view.dispatchNearbyJob(source.x, source.z)
      worker.reply({ ...worker.requests[0], links: [] })
      expect(view.inFlight).toBe(worker.requests[1])
      worker.reply({ ...worker.requests[1], links: [] })
      expect(view.inFlight).toBeNull(); expect(view.roadJobs.size).toBe(0)
    } finally { system.dispose() }
  })

  it.each(['too-many', 'full-profile', 'wrong-key', 'wrong-source', 'wrong-protected'] as const)
    ('falls back safely for a %s graph reply', fault => {
      const { system, view, worker } = setup()
      try {
        const source = site(), link = edge()
        view.scheduleLinks(source, source.id); view.dispatchNearbyJob(source.x, source.z)
        let links = [link]
        if (fault === 'too-many') links = [link, link, link]
        if (fault === 'full-profile') link.to.roads[0]!.points.push({ ...link.to.roads[0]!.points[0]! })
        if (fault === 'wrong-key') link.key = 'wrong'
        if (fault === 'wrong-source') link.from.x++
        if (fault === 'wrong-protected') view.protectedPlans.set(link.to.id, { ...site(1), kind: 'city' })
        worker.reply({ ...worker.requests[0], links })
        expect(worker.terminate).toHaveBeenCalledTimes(1)
        expect(view.graphQueue.size).toBe(1); expect(view.inFlight).toBeNull()
        // A single synchronous fallback job is deferred to dispatch, not run
        // inside the broken worker callback.
        expect(calls.plans).toBe(0)
        view.dispatchNearbyJob(source.x, source.z)
        expect(calls.plans).toBeGreaterThan(0)
        expect(view.roadJobs.size).toBeGreaterThan(0)
      } finally { system.dispose() }
    })
})
