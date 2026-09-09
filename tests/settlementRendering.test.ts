import { InstancedMesh, Mesh, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import { hitsSettlement, SettlementSystem } from '../src/world/SettlementSystem'

vi.mock('../src/world/SettlementPlan', () => ({
  SETTLEMENT_CELL_SIZE: 24000,
  settlementForCell: (x: number, z: number) => x === 0 && z === 0 ? example() : null,
}))

function example(): SettlementPlan {
  return {
    id: '0,0', kind: 'village', biome: 'plains', x: 3000, y: 100, z: 3000, radius: 150,
    roads: [{ width: 24, points: [
      { x: 2940, y: 100, z: 3000 }, { x: 3060, y: 100, z: 3000 },
    ] }], buildings: [{ x: 3000, y: 100, z: 3000, width: 12, depth: 24, height: 15,
      yaw: Math.PI / 2, shape: 'block', roof: 'pitched', wallColor: 0xc5c3b3, roofColor: 0x8b5343 }],
  }
}

describe('settlement rendering and lifecycle', () => {
  it('rejects stale worker replies after reseeding and bounds in-flight work', () => {
    const requests: { generation: number; key: string }[] = []
    class TestWorker {
      static instance: TestWorker
      onmessage?: (event: { data: object }) => void
      onerror?: () => void
      terminate = vi.fn()
      constructor() { TestWorker.instance = this }
      postMessage(request: { generation: number; key: string }) { requests.push(request) }
    }
    vi.stubGlobal('Worker', TestWorker)
    const system = new SettlementSystem(new Scene())
    try {
      system.update(3000, 3000)
      system.update(3000, 3000)
      expect(requests).toHaveLength(1)
      system.clearAll()
      TestWorker.instance.onmessage!({ data: { type: 'settlement', ...requests[0], plan: example() } })
      system.update(3000, 3000)
      expect(system.count).toBe(0)
      expect(requests).toHaveLength(2)
      TestWorker.instance.onmessage!({ data: { type: 'settlement', ...requests[1], plan: example() } })
      system.update(3000, 3000)
      expect(system.count).toBe(1)
    } finally {
      system.dispose()
      expect(TestWorker.instance.terminate).toHaveBeenCalledOnce()
      vi.unstubAllGlobals()
    }
  })

  it('batches buildings and roofs into instanced draws and cleans up unloaded instances', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    system.update(3000, 3000)
    expect(system.count).toBe(1)
    const instances: InstancedMesh[] = []
    system.root.traverse(object => { if (object instanceof InstancedMesh) instances.push(object) })
    expect(instances).toHaveLength(2)
    expect(instances.every(mesh => mesh.count === 1 && !mesh.castShadow)).toBe(true)
    const disposed = instances.map(mesh => vi.spyOn(mesh, 'dispose'))
    for (let frame = 0; frame < 100; frame++) system.update(100000, -100000)
    expect(system.count).toBe(0)
    expect(system.root.children).toHaveLength(0)
    expect(disposed.every(spy => spy.mock.calls.length === 1)).toBe(true)
    system.update(3000, 3000)
    expect(system.count).toBe(1)
    system.dispose()
    expect(scene.children).toHaveLength(0)
  })

  it('adds one batched centerline pass for local settlement roads', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    system.update(3000, 3000)
    const names: string[] = []
    system.root.traverse(object => { if (object.name) names.push(object.name) })
    expect(names).toContain('SettlementRoadMarkings')
    system.dispose()
  })

  it('keeps road markings batched while rendering segmented dashes', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    try {
      system.update(3000, 3000)
      const markings = scene.getObjectByName('SettlementRoadMarkings') as Mesh
      expect(markings).toBeDefined()
      expect(markings.geometry.getAttribute('position').count).toBeGreaterThan(6)
    } finally {
      system.dispose()
    }
  })

  it('shares blended weather values with road materials', () => {
    const system = new SettlementSystem(new Scene())
    try {
      system.setWeatherEffects(1.2, -.1)
      expect(system.weatherEffects).toEqual({ rain: 1, snow: 0 })
      system.setWeatherEffects(.35, .7)
      expect(system.weatherEffects).toEqual({ rain: .35, snow: .7 })
      system.setWeatherEffects(.1, .2, -.4)
      expect(system.lightingEffects).toEqual({ daylight: 0 })
      system.setWeatherEffects(.1, .2, .4)
      expect(system.lightingEffects).toEqual({ daylight: .4 })
    } finally {
      system.dispose()
    }
  })

  it('clears the checked-cell cache so reseeding can rebuild a settlement', () => {
    const system = new SettlementSystem(new Scene())
    system.update(3000, 3000)
    system.clearAll()
    expect(system.count).toBe(0)
    system.update(3000, 3000)
    expect(system.count).toBe(1)
    system.root.traverse(object => {
      if (object instanceof Mesh) expect(object.geometry.boundingSphere?.radius).toBeGreaterThan(0)
    })
    system.dispose()
  })

  it('collides with rotated buildings and roofs without blocking the open street', () => {
    const plan = example()
    expect(hitsSettlement(plan, 3010, 110, 3000)).toBe(true)
    expect(hitsSettlement(plan, 3000, 110, 3010)).toBe(false)
    expect(hitsSettlement(plan, 3000, 118, 3000)).toBe(true)
    expect(hitsSettlement(plan, 3000, 125, 3000)).toBe(false)
    expect(hitsSettlement(plan, 3000, 90, 3000)).toBe(false)
    expect(hitsSettlement(plan, 4000, 110, 3000)).toBe(false)
  })

  it('leaves air beside pitched roofs and tower crowns flyable', () => {
    const plan = example(), building = plan.buildings[0]
    building.yaw = 0; building.width = 200; building.depth = 200
    expect(hitsSettlement(plan, 3000, 160, 3000)).toBe(true)
    expect(hitsSettlement(plan, 3095, 160, 3000)).toBe(false)
    plan.kind = 'city'; building.roof = 'flat'; building.height = 500
    expect(hitsSettlement(plan, 3000, 640, 3000)).toBe(true)
    expect(hitsSettlement(plan, 3090, 640, 3000)).toBe(false)
  })

  it('includes oversized perimeter buildings in the broadphase', () => {
    const plan = example()
    plan.buildings[0].x += 300
    expect(hitsSettlement(plan, 3300, 110, 3000)).toBe(true)
  })
})
