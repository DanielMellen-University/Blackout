import { Group, InstancedMesh, Matrix4, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { SettlementSystem, hitsSettlement } from '../src/world/SettlementSystem'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import { invalidateGroundSamplerCaches } from '../src/world/ground'
import { MAX_DRAPE_VERTICES_PER_FRAME, SurfaceDraper } from '../src/world/SurfaceDraper'

const plan = (): SettlementPlan => ({ id: 'foundations', kind: 'village', biome: 'plains',
  x: 3000, y: 100, z: -3000, radius: 200, roads: [],
  buildings: ['block', 'tower', 'stepped'].map((shape, i) => ({
    x: 3000 + i * 60, y: 100, z: -3000, width: 20, depth: 30, height: 40,
    yaw: .7, shape: shape as 'block' | 'tower' | 'stepped', roof: 'flat', wallColor: 0xffffff, roofColor: 0x333333,
  })) })
type State = { build(p: SettlementPlan): { root: Group }; draper: SurfaceDraper }
function bodies(root: Group) {
  return root.children.filter((o): o is InstancedMesh => o instanceof InstancedMesh && !!o.userData.foundationSurface)
}
function bounds(mesh: InstancedMesh, i = 0) {
  const m = new Matrix4(); mesh.getMatrixAt(i, m)
  return [m.elements[13]! + 100 - m.elements[5]! / 2, m.elements[13]! + 100 + m.elements[5]! / 2]
}

describe('rendered settlement foundations', () => {
  it('closes coarse terrain gaps for each body shape while leaving tops, roofs, plans and collision fixed', () => {
    let height = 79.91, owner = 1
    const system = new SettlementSystem(new Scene(), (x, z) => height + (x - 3000) * .01 + (z + 3000) * .02, () => owner)
    const state = system as unknown as State, p = plan(), original = structuredClone(p)
    try {
      const { root } = state.build(p), meshes = bodies(root)
      const tops = meshes.map(m => bounds(m)[1]), roof = root.children.filter(o => !meshes.includes(o as InstancedMesh))
      const roofMatrices = roof.map(o => o instanceof InstancedMesh ? Array.from(o.instanceMatrix.array) : [])
      expect(root.userData.foundationsPending).toBe(3)
      for (let i = 0; i < 50 && root.userData.foundationsPending; i++) state.draper.update()
      expect(root.userData.foundationsPending).toBe(0)
      meshes.forEach((m, i) => {
        const [bottom, top] = bounds(m)
        expect(bottom).toBeLessThan(79.91 + i * .6 - .29); expect(top).toBeCloseTo(tops[i]!, 4)
      })
      expect(p).toEqual(original)
      expect(hitsSettlement(p, 3000, 90, -3000)).toBe(false)
      expect(hitsSettlement(p, 3000, 105, -3000)).toBe(true)
      expect(roof.map(o => o instanceof InstancedMesh ? Array.from(o.instanceMatrix.array) : [])).toEqual(roofMatrices)
      const published = meshes.map(m => Array.from(m.instanceMatrix.array))
      height = 95; owner++; invalidateGroundSamplerCaches()
      for (let i = 0; i < 50; i++) state.draper.update()
      expect(meshes.map(m => Array.from(m.instanceMatrix.array))).toEqual(published)
      height = 60; owner++; invalidateGroundSamplerCaches()
      for (let i = 0; i < 50; i++) state.draper.update()
      meshes.forEach((m, i) => { expect(bounds(m)[0]).toBeLessThan(62); expect(bounds(m)[1]).toBeCloseTo(tops[i]!, 4) })
    } finally { system.dispose() }
  })

  it('catches a perimeter trough between the old corner/midpoint support samples', () => {
    const p = plan(); p.buildings = [{ ...p.buildings[0]!, yaw: 0 }]
    const system = new SettlementSystem(new Scene(), (x, z) =>
      90 - 8 * Math.exp(-((x - 3005) ** 2 + (z + 3015) ** 2) / 2))
    try {
      const state = system as unknown as State, { root } = state.build(p)
      for (let i = 0; i < 50 && root.userData.foundationsPending; i++) state.draper.update()
      expect(root.userData.foundationsPending).toBe(0)
      expect(bounds(bodies(root)[0]!)[0]).toBeLessThan(81.71)
      expect(bounds(bodies(root)[0]!)[1]).toBeCloseTo(140, 4)
    } finally { system.dispose() }
  })

  it('waits for resident support, shares the drape cap, and releases its sampling surfaces', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    let available = false
    const sample = vi.fn(() => available ? 70 : null)
    const system = new SettlementSystem(new Scene(), sample)
    const state = system as unknown as State
    try {
      const p = plan(); p.buildings = Array.from({ length: 400 }, () => ({ ...p.buildings[0]! }))
      const { root } = state.build(p)
      expect(state.draper.update()).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
      expect(root.userData.foundationsPending).toBe(1)
      available = true; invalidateGroundSamplerCaches()
      for (let i = 0; i < 30 && root.userData.foundationsPending; i++) {
        sample.mockClear()
        expect(state.draper.update()).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
        expect(sample.mock.calls.length).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
      }
      expect(root.userData.foundationsPending).toBe(0)
      system.dispose(); sample.mockClear(); state.draper.update(); expect(sample).not.toHaveBeenCalled()
    } finally { now.mockRestore(); system.dispose() }
  })
})
