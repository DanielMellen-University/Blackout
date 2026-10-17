import { afterEach, describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import type { RegionalRoadEndpoint } from '../src/world/RegionalRoads'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'

vi.mock('../src/world/SettlementPlan', () => ({
  SETTLEMENT_CELL_SIZE: 24_000, MAX_LOCAL_ROAD_POINTS: 20_000,
  settlementAnchorForCell: (x: number, z: number) => x === 1 && z === 0 ? 'city' : x === 0 && z === 1 ? 'village' : null,
  settlementAnchorCells: (kind: string) => kind === 'city' ? [[0, -1]] : [[-1, 0]],
  settlementForCell: (x: number, z: number, forced?: 'city' | 'village') => fixture(x, z, forced),
}))
vi.mock('../src/world/terrainSample', async importOriginal => ({
  ...await importOriginal<object>(),
  sampleClimateInto: (out: { height: number; waterLevel: number }) => { out.height = 100; out.waterLevel = 0; return out },
}))

import { SettlementSystem } from '../src/world/SettlementSystem'

function fixture(cx: number, cz: number, forced?: 'city' | 'village'): SettlementPlan | null {
  const id = `${cx},${cz}`
  if (!['0,-1', '-1,0', '0,0'].includes(id)) return null
  const [x, z] = id === '0,-1' ? forced ? [5000, -3000] : [14000, -12000]
    : id === '-1,0' ? forced ? [-4000, 5000] : [-8000, 12000] : [20000, 5000]
  return { id, kind: forced ?? 'village', anchor: forced, biome: 'plains', x, y: 100, z, radius: 200,
    buildings: [{ x, y: 100, z, width: 20, depth: 20, height: 12, yaw: 0,
      shape: 'block', roof: 'flat', wallColor: 0xffffff, roofColor: 0x555555 }],
    roads: [{ width: 10, points: [{ x: x - 100, y: 100, z }, { x: x + 100, y: 100, z }] }] }
}

type Job = { key: string; from: RegionalRoadEndpoint; to: RegionalRoadEndpoint }
type Internal = {
  roadJobs: Map<string, Job>; roadSources: Map<string, Set<string>>
  checkedLinks: Set<string>; linkQueue: Job[]
  loaded: Map<string, { plan: SettlementPlan }>
  protectedPlans: Map<string, SettlementPlan>
  checked: Set<string>; ready: { key: string; plan: SettlementPlan }[]
  generation: number; inFlight: unknown; worker: Worker
  remove(resident: { plan: SettlementPlan }): void
  deleteLoaded(key: string): void
  canLoad(plan: SettlementPlan, x: number, z: number): boolean
  scheduleLinks(plan: SettlementPlan, key: string): void
}

afterEach(() => { clearOpsPad(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('protected settlement road ownership', () => {
  it('resolves both fallback sites before choosing their neighbour links', () => {
    const system = new SettlementSystem(new Scene()), internal = system as unknown as Internal
    try {
      setOpsPad(0, 0, 100); system.primeAnchors(0, 0)
      const city = internal.loaded.get('0,-1')!.plan, village = internal.loaded.get('-1,0')!.plan
      expect(city.anchor).toBe('city'); expect(village.anchor).toBe('village')
      // The normal city-cell plan is a different village at a different site.
      // First priming the village must not lock in that obsolete neighbour.
      expect(internal.roadSources.get('-1,0|0,-1')).toContain(village.id)
      const job = internal.roadJobs.get('-1,0|0,-1')!
      expect(job.from).toMatchObject({ id: village.id, kind: village.kind, x: village.x, y: village.y, z: village.z, radius: village.radius })
      expect(job.to).toMatchObject({ id: city.id, kind: city.kind, x: city.x, y: city.y, z: city.z, radius: city.radius })
      expect(job.from).not.toHaveProperty('buildings'); expect(job.to).not.toHaveProperty('buildings')
      internal.scheduleLinks(fixture(0, 0)!, '0,0')
      for (const edge of internal.roadJobs.values()) for (const endpoint of [edge.from, edge.to]) {
        const actual = internal.loaded.get(endpoint.id)?.plan
        if (actual) expect(endpoint).toMatchObject({ id: actual.id, kind: actual.kind,
          x: actual.x, y: actual.y, z: actual.z, radius: actual.radius })
      }
      system.clearAll()
      expect(internal.protectedPlans.size).toBe(0)
      expect(internal.roadJobs.size).toBe(0)
    } finally { system.dispose() }
  })

  it('uses the selected protected blueprint when an ordinary worker reply arrives for that cell', () => {
    class HoldingWorker {
      onmessage = null
      onerror = null
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', HoldingWorker)
    const system = new SettlementSystem(new Scene()), internal = system as unknown as Internal
    try {
      setOpsPad(0, 0, 100); system.primeAnchors(0, 0)
      const resident = internal.loaded.get('0,-1')!, city = resident.plan
      internal.remove(resident); internal.deleteLoaded(city.id)
      internal.checked.add(city.id)
      internal.inFlight = { type: 'settlement', key: city.id, generation: internal.generation }
      internal.worker.onmessage!({ data: { type: 'settlement', key: city.id,
        generation: internal.generation, plan: fixture(0, -1) } } as MessageEvent)
      expect(internal.ready).toHaveLength(1)
      expect(internal.ready[0]!.plan).toBe(city)
    } finally { system.dispose() }
  })

  it('keeps graph discovery independent of resident admission and source query order', () => {
    const discover = (reverse: boolean, blocked: boolean) => {
      const system = new SettlementSystem(new Scene()), internal = system as unknown as Internal
      try {
        if (blocked) vi.spyOn(internal, 'canLoad').mockReturnValue(false)
        system.primeAnchors(0, 0)
        expect(system.count).toBe(blocked ? 0 : 2)
        expect(internal.protectedPlans.size).toBe(2)
        internal.roadJobs.clear(); internal.roadSources.clear()
        internal.checkedLinks.clear(); internal.linkQueue.length = 0
        const sources = [...internal.protectedPlans.values(), fixture(0, 0)!]
        if (reverse) sources.reverse()
        for (const source of sources) internal.scheduleLinks(source, source.id)
        const result = [...internal.roadJobs.values()].sort((a, b) => a.key.localeCompare(b.key))
          .map(job => ({ key: job.key, from: job.from, to: job.to }))
        return JSON.stringify(result)
      } finally { system.dispose() }
    }
    setOpsPad(0, 0, 100)
    expect(discover(true, true)).toBe(discover(false, false))
  })
})
