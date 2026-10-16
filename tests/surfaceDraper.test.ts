import { BufferGeometry, Float32BufferAttribute } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { SurfaceDraper, MAX_DRAPE_VERTICES_PER_FRAME } from '../src/world/SurfaceDraper'

function surface(vertices = 3) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(vertices * 3), 3))
  geometry.setAttribute('groundOffset', new Float32BufferAttribute(new Float32Array(vertices).fill(.45), 1))
  return geometry
}

describe('bounded streamed surface contact', () => {
  it('updates terrain contact only on revisions and never drapes an elevated deck', () => {
    let revision = 1
    const sample = vi.fn((x: number, z: number) => 100 + x * .1 + z * .2)
    const draper = new SurfaceDraper(sample, () => revision), geometry = surface()
    geometry.getAttribute('groundOffset').setX(2, -1)
    draper.add(geometry, 1000, 80, -500)
    expect(draper.update()).toBe(2)
    expect(geometry.getAttribute('position').getY(0)).toBeCloseTo(20.45)
    expect(geometry.getAttribute('position').getY(2)).toBe(0)
    sample.mockClear(); draper.update(); expect(sample).not.toHaveBeenCalled()
    revision++; draper.update(); expect(sample).toHaveBeenCalledTimes(2)
    draper.remove(geometry); revision++; sample.mockClear(); draper.update()
    expect(sample).not.toHaveBeenCalled()
  })

  it('bounds samples, publishes complete meshes atomically and completes despite revision churn', () => {
    let revision = 1
    const sample = vi.fn(() => 200), geometry = surface(MAX_DRAPE_VERTICES_PER_FRAME * 3)
    const draper = new SurfaceDraper(sample, () => revision)
    draper.add(geometry, 0, 0, 0)
    const first = draper.update()
    expect(first).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
    expect(geometry.getAttribute('position').getY(0)).toBe(0)
    for (let i = 0; i < 100 && geometry.getAttribute('position').getY(0) === 0; i++) {
      revision++
      expect(draper.update()).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
    }
    expect(geometry.getAttribute('position').getY(0)).toBeCloseTo(200.45)
    draper.clear(); sample.mockClear(); draper.update(); expect(sample).not.toHaveBeenCalled()
  })

  it('keeps the analytic fallback when no streamed tile is ready', () => {
    const geometry = surface(), draper = new SurfaceDraper(() => null, () => 1)
    geometry.getAttribute('position').setY(0, 42)
    draper.add(geometry, 0, 0, 0); draper.update()
    expect(geometry.getAttribute('position').getY(0)).toBe(42)
  })
})
