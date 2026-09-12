import { InstancedMesh, Mesh, MeshStandardMaterial, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import { hitsSettlement, SettlementSystem, settlementStreetLightPoints, settlementWaterfrontPoints } from '../src/world/SettlementSystem'

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

  it('can stage settlements out of the title hero without clearing the cache', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    try {
      system.update(3000, 3000)
      expect(system.count).toBe(1)
      system.setVisible(false)
      expect(system.root.visible).toBe(false)
      expect(system.count).toBe(1)
      system.setVisible(true)
      expect(system.root.visible).toBe(true)
    } finally {
      system.dispose()
    }
  })

  it('adds one batched centerline pass for local settlement roads', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    system.update(3000, 3000)
    const names: string[] = []
    system.root.traverse(object => { if (object.name) names.push(object.name) })
    expect(names).toContain('SettlementRoadMarkings')
    system.dispose()
  })

  it('leaves a central green for village road approaches', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    try {
      system.update(3000, 3000)
      expect(scene.getObjectByName('SettlementGreen')).toBeDefined()
    } finally {
      system.dispose()
    }
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
      expect((system as unknown as { streetLampGlow: { opacity: number } }).streetLampGlow.opacity).toBeCloseTo(.78)
      system.setWeatherEffects(.1, .2, .4)
      expect(system.lightingEffects).toEqual({ daylight: .4 })
      expect((system as unknown as { streetLampGlow: { opacity: number } }).streetLampGlow.opacity).toBeCloseTo(.492)
    } finally {
      system.dispose()
    }
  })

  it('caps deterministic street lights to city roads only', () => {
    const city: SettlementPlan = {
      id: 'city', kind: 'city', biome: 'plains', x: 0, y: 120, z: 0, radius: 9000,
      buildings: [], roads: [{
        width: 54,
        points: Array.from({ length: 10 }, (_, i) => ({ x: i * 900, y: 120, z: Math.sin(i * .4) * 180 })),
      }],
    }
    const lights = settlementStreetLightPoints(city)
    expect(lights.length).toBeGreaterThan(0)
    expect(lights.length).toBeLessThanOrEqual(72)
    expect(lights.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)
      && Number.isFinite(point.z) && Number.isFinite(point.yaw))).toBe(true)
    expect(settlementStreetLightPoints({ ...city, kind: 'village' })).toHaveLength(0)
  })

  it('keeps waterfront docks deterministic and capped', () => {
    const plan: SettlementPlan = {
      id: 'water-city', kind: 'city', biome: 'plains', x: 0, y: 120, z: 0, radius: 9000,
      buildings: [], roads: [],
    }
    const first = settlementWaterfrontPoints(plan)
    const second = settlementWaterfrontPoints(plan)
    expect(second).toEqual(first)
    expect(first.length).toBeLessThanOrEqual(3)
    expect(first.every(point => point.length >= 220 && point.width >= 18
      && Number.isFinite(point.yaw))).toBe(true)
  })

  it('breaks up rain puddles in the shared road shader', () => {
    const system = new SettlementSystem(new Scene())
    try {
      const asphalt = (system as unknown as { asphalt: MeshStandardMaterial }).asphalt
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\n#include <project_vertex>',
        fragmentShader: '#include <common>\n#include <roughnessmap_fragment>\n#include <color_fragment>',
      }
      asphalt.onBeforeCompile(shader as never, undefined as never)
      expect(shader.vertexShader).toContain('settlementRoadWorld')
      expect(shader.fragmentShader).toContain('puddleMask')
      expect(shader.fragmentShader).toContain('roughnessFactor')
      expect(asphalt.customProgramCacheKey()).toBe('settlement-road-weather-v3')
    } finally {
      system.dispose()
    }
  })

  it('keeps facade windows readable at flight scale', () => {
    const system = new SettlementSystem(new Scene())
    try {
      const walls = (system as unknown as { walls: MeshStandardMaterial }).walls
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\n#include <begin_vertex>',
        fragmentShader: '#include <common>\n#include <color_fragment>',
      }
      walls.onBeforeCompile(shader as never, undefined as never)
      expect(shader.fragmentShader).toContain('mix(5.0, 10.0, settlementSeed)')
      expect(shader.fragmentShader).toContain('(.42 + (1.0 - settlementDaylight) * .24)')
      expect(shader.fragmentShader).toContain('panelPeriod')
      expect(shader.fragmentShader).toContain('floorPeriod')
      expect(shader.fragmentShader).toContain('totalEmissiveRadiance += windowColor * windowMask')
      expect(shader.fragmentShader).toContain('vec3(.012, .018, .03)')
      expect(system.lightingEffects.daylight).toBe(1)
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
