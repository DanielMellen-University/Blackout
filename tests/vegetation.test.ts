import { Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { createVegetationFactory } from '../src/world/vegetation'

describe('weathered vegetation materials', () => {
  it('shares wind and clock uniforms with pooled foliage shaders', () => {
    const clock = { value: 12 }
    const factory = createVegetationFactory(clock)
    factory.setWeather(.4, .7, 14, -9)
    const buckets = factory.createBuckets()
    expect(buckets.place('forest', 0, 0, 0, 17, false)).toBe(true)
    buckets.finalize()

    const mesh = buckets.group.children.find(child => child instanceof Mesh) as Mesh
    const material = mesh.material as MeshStandardMaterial
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\\n#include <begin_vertex>',
      fragmentShader: '#include <common>\\n#include <normal_fragment_maps>',
    }
    try {
      material.onBeforeCompile(shader as never)
      expect(shader.uniforms.vegetationWindX).toEqual({ value: 14 })
      expect(shader.uniforms.vegetationWindZ).toEqual({ value: -9 })
      expect(shader.uniforms.vegetationTime).toBe(clock)
      expect(shader.vertexShader).toContain('vegetationGust')
      expect(shader.fragmentShader).toContain('vegetationSnow')
    } finally {
      factory.disposeShared()
    }
  })
})
