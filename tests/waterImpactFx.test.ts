import { InstancedMesh, Matrix4, Mesh, NormalBlending, Scene, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { WaterImpactFx } from '../src/systems/WaterImpactFx'

describe('pooled water impact', () => {
  it('anchors the splash to elevated water, not the jet origin, with no fire material', () => {
    const fx = new WaterImpactFx(new Scene())
    try {
      fx.trigger(new Vector3(10, 420, -20), new Vector3(120, -80, 30), 410)
      expect(fx.root.position.toArray()).toEqual([10, 410, -20])
      expect(fx.activeCount).toBe(64)
      for (const child of fx.root.children as Mesh[]) {
        const material = child.material as import('three').MeshBasicMaterial
        expect(material.blending).toBe(NormalBlending)
        expect(material.color.b).toBeGreaterThan(material.color.r)
      }
    } finally { fx.dispose() }
  })

  it('uses fixed resources across retries and trims Low without disabling the splash', () => {
    const fx = new WaterImpactFx(new Scene())
    try {
      const children = [...fx.root.children]
      fx.setRenderQuality('low')
      for (let i = 0; i < 10; i++) {
        fx.trigger(new Vector3(), new Vector3(100, -50, 100), 0)
        fx.update(0.1)
        expect(fx.activeCount).toBe(24)
        expect(fx.root.children).toEqual(children)
        fx.reset()
        expect(fx.activeCount).toBe(0)
      }
      fx.setRenderQuality('high')
      fx.trigger(new Vector3(), new Vector3(), 0)
      expect(fx.activeCount).toBe(64)
    } finally { fx.dispose() }
  })

  it('raises spray above the surface, expands ripples, then retires the burst', () => {
    const fx = new WaterImpactFx(new Scene())
    try {
      fx.trigger(new Vector3(), new Vector3(1000, -100, 0), 0)
      fx.update(0.5)
      const spray = fx.root.children[0] as InstancedMesh
      const matrix = new Matrix4(), position = new Vector3()
      spray.getMatrixAt(0, matrix)
      position.setFromMatrixPosition(matrix)
      expect(position.y).toBeGreaterThan(8)
      expect(Math.abs(position.x)).toBeLessThan(20)
      expect(fx.root.children[1]!.scale.x).toBeGreaterThan(5)
      fx.update(4)
      expect(fx.active).toBe(false)
      expect(fx.root.visible).toBe(false)
    } finally { fx.dispose() }
  })

  it('preserves static comfort framing, pause, and finite fallback data', () => {
    const fx = new WaterImpactFx(new Scene())
    try {
      fx.setReducedMotion(true)
      fx.trigger(new Vector3(NaN, Infinity, -Infinity), new Vector3(NaN, -Infinity, Infinity), NaN)
      expect(fx.root.position.toArray()).toEqual([0, 0, 0])
      const spray = fx.root.children[0] as InstancedMesh
      const before = new Matrix4(), after = new Matrix4()
      spray.getMatrixAt(0, before)
      const position = new Vector3().setFromMatrixPosition(before)
      fx.update(0.2)
      spray.getMatrixAt(0, after)
      expect(new Vector3().setFromMatrixPosition(after)).toEqual(position)
      expect(after.elements.every(Number.isFinite)).toBe(true)
      const opacity = (spray.material as import('three').MeshBasicMaterial).opacity
      for (const dt of [0, -1, NaN, Infinity]) fx.update(dt)
      expect((spray.material as import('three').MeshBasicMaterial).opacity).toBe(opacity)
    } finally { fx.dispose() }
  })

  it('releases shared resources once and ignores late triggers after disposal', () => {
    const scene = new Scene(), fx = new WaterImpactFx(scene)
    const mesh = fx.root.children[0] as InstancedMesh
    const geometry = vi.spyOn(mesh.geometry, 'dispose')
    fx.dispose()
    fx.dispose()
    fx.trigger(new Vector3(), new Vector3(), 0)
    fx.update(0.1)
    expect(geometry).toHaveBeenCalledTimes(1)
    expect(fx.active).toBe(false)
    expect(scene.children).toHaveLength(0)
  })
})
