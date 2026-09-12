import { Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { createVegetationFactory, vegetationInstanceCount } from '../src/world/vegetation'

describe('weathered vegetation materials', () => {
  it('clamps quality-scaled instance counts to the authored batch', () => {
    expect(vegetationInstanceCount(100, .45)).toBe(45)
    expect(vegetationInstanceCount(100, 1.4)).toBe(100)
    expect(vegetationInstanceCount(100, 0)).toBe(0)
    expect(vegetationInstanceCount(0, .5)).toBe(0)
  })

  it('shares wind and clock uniforms with pooled foliage shaders', () => {
    const clock = { value: 12 }
    const factory = createVegetationFactory(clock)
    factory.setWeather(.4, .7, 14, -9)
    const buckets = factory.createBuckets()
    expect(buckets.place('forest', 0, 0, 0, 17, false)).toBe(true)
    buckets.finalize()

    const mesh = buckets.group.children.find(child => child instanceof Mesh) as Mesh
    expect(mesh.userData.fullCount).toBe((mesh as { count?: number }).count)
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
