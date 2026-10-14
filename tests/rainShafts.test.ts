import { Matrix4, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { RainShafts } from '../src/world/RainShafts'

describe('bounded distant rain shafts', () => {
  it('keeps one depth-tested 16-instance draw beneath its cloud sources', () => {
    const shafts = new RainShafts()
    try {
      shafts.begin()
      for (let i = 0; i < 46; i++) shafts.offer(i, 3000 + i * 100, 2000 + i * 10, 0, 2500, 1, i / 46, 0, 0)
      shafts.commit(.2, 0, 0, 1)
      expect(shafts.mesh.count).toBe(16); expect(shafts.mesh.visible).toBe(true)
      const material = shafts.mesh.material as MeshBasicMaterial
      expect(material.depthTest).toBe(true); expect(material.depthWrite).toBe(false)
      const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3()
      shafts.mesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix); scale.setFromMatrixScale(matrix)
      expect(position.y + scale.y / 2).toBeCloseTo(2000)
      expect(position.y - scale.y / 2).toBeCloseTo(-100)
      expect(shafts.mesh.geometry.getAttribute('shaftAlpha').count).toBe(16)
    } finally { shafts.dispose() }
  })

  it('fades an old identity before relocating its occupied slot', () => {
    const shafts = new RainShafts(), matrix = new Matrix4(), position = new Vector3()
    try {
      shafts.begin(); shafts.offer(0, 3000, 2000, 0, 2000, 1, .1, 0, 0); shafts.commit(.2, 0, 0, 1)
      shafts.begin(); shafts.offer(0, 16000, 2200, 0, 2000, 1, .2, 0, 0); shafts.commit(.2, 0, 0, 1)
      shafts.mesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix)
      expect(position.x).toBe(3000)
      shafts.mesh.getMatrixAt(1, matrix); position.setFromMatrixPosition(matrix)
      expect(position.x).toBe(16000)
    } finally { shafts.dispose() }
  })

  it('ignores invalid candidates, scales fixed pools, and releases resources once', () => {
    const shafts = new RainShafts(), geometry = shafts.mesh.geometry
    const disposed = vi.spyOn(geometry, 'dispose')
    shafts.begin(); shafts.offer(46, 3000, 2000, 0, 2000, 1, 0, 0, 0)
    shafts.offer(0, NaN, 2000, 0, 2000, 1, 0, 0, 0)
    shafts.commit(.2, 0, 0, 1); expect(shafts.mesh.visible).toBe(false)
    shafts.offer(0, 3000, 2000, 0, 2000, 1, 0, 0, 0)
    shafts.commit(.2, NaN, Infinity, NaN)
    const matrix = new Matrix4(); shafts.mesh.getMatrixAt(0, matrix)
    expect(matrix.elements.every(Number.isFinite)).toBe(true)
    shafts.setDensityScale(0)
    for (let i = 0; i < 30; i++) shafts.commit(.2, 0, 0, 1)
    expect(shafts.mesh.visible).toBe(false)
    expect(shafts.mesh.geometry).toBe(geometry)
    shafts.dispose(); shafts.dispose()
    shafts.commit(.2, 0, 0, 1)
    expect(disposed).toHaveBeenCalledOnce()
  })
})
