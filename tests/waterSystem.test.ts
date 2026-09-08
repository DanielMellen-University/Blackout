import { MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { buildWaterMesh } from '../src/world/WaterSystem'

describe('independent water surfaces', () => {
  it('omits dry ground and keeps a constant ocean or elevated lake level', () => {
    const clock = { value: 0 }
    expect(buildWaterMesh(new Float32Array([2, 3, 4, 5]), new Float32Array(4), 1, 100, 0, 0, clock)).toBeNull()
    for (const level of [0, 230]) {
      const bed = new Float32Array([level - 20, level - 10, level + 10, level + 30])
      const original = bed.slice()
      const mesh = buildWaterMesh(bed, new Float32Array(4).fill(level), 1, 100, 500, -700, clock)!
      expect(bed).toEqual(original)
      expect(mesh.name).toBe('WaterSurface')
      expect(mesh.geometry.boundingSphere?.radius).toBeGreaterThan(0)
      const positions = mesh.geometry.getAttribute('position')
      const depths = mesh.geometry.getAttribute('waterDepth')
      const normals = mesh.geometry.getAttribute('normal')
      let shoreline = 0
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBe(level)
        expect(depths.getX(i)).toBeGreaterThanOrEqual(0)
        expect(normals.getY(i)).toBeCloseTo(1)
        if (depths.getX(i) < .001) shoreline++
      }
      expect(shoreline).toBeGreaterThan(0)
      mesh.geometry.dispose()
      ;(mesh.material as MeshStandardMaterial).dispose()
    }
  })

  it('shares live precipitation uniforms with every generated water material', () => {
    const clock = { value: 4 }
    const weather = { rain: { value: .75 }, snow: { value: .25 } }
    const mesh = buildWaterMesh(
      new Float32Array([-8, -8, -8, -8]), new Float32Array(4), 1, 100, 0, 0, clock, weather,
    )!
    const material = mesh.material as MeshStandardMaterial
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <project_vertex>',
      fragmentShader: '#include <color_fragment>\n#include <normal_fragment_maps>',
    }
    try {
      material.onBeforeCompile(shader as never)
      expect(shader.uniforms.waterRain).toBe(weather.rain)
      expect(shader.uniforms.waterSnow).toBe(weather.snow)
      expect(shader.fragmentShader).toContain('waterRain')
      expect(shader.fragmentShader).toContain('waterSnow')
    } finally {
      mesh.geometry.dispose()
      material.dispose()
    }
  })
})
