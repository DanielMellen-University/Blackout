import { DodecahedronGeometry, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import {
  createVegetationFactory,
  vegetationClusterFactor,
  vegetationInstanceCount,
} from '../src/world/vegetation'

describe('weathered vegetation materials', () => {
  it('clamps quality-scaled instance counts to the authored batch', () => {
    expect(vegetationInstanceCount(100, .45)).toBe(45)
    expect(vegetationInstanceCount(100, 1.4)).toBe(100)
    expect(vegetationInstanceCount(100, 0)).toBe(0)
    expect(vegetationInstanceCount(0, .5)).toBe(0)
  })

  it('keeps broad vegetation clustering deterministic and bounded', () => {
    const samples = [[0, 0], [181, 0], [360, 240], [-640, 512]]
    for (const [x, z] of samples) {
      const factor = vegetationClusterFactor(x, z)
      expect(factor).toBeGreaterThanOrEqual(.48)
      expect(factor).toBeLessThanOrEqual(1.35)
      expect(vegetationClusterFactor(x, z)).toBe(factor)
    }
    expect(Number.isFinite(vegetationClusterFactor(Number.NaN, Number.POSITIVE_INFINITY))).toBe(true)
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
    expect(factory.isSharedMaterial(material)).toBe(true)
    const privateMaterial = new MeshStandardMaterial()
    expect(factory.isSharedMaterial(privateMaterial)).toBe(false)
    privateMaterial.dispose()
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
      expect(shader.fragmentShader).toContain('snowMask = vegetationSnow')
      expect(shader.fragmentShader).toContain('vec3(.62, .7, .76)')
    } finally {
      factory.disposeShared()
    }
  })

  it('uses a rounded lowland ground-cover silhouette instead of cone spikes', () => {
    const factory = createVegetationFactory()
    const buckets = factory.createBuckets()
    for (let seed = 1; seed <= 24; seed++) {
      buckets.place('plains', seed * 3, 0, seed * -5, seed, false)
    }
    buckets.finalize()

    expect(
      buckets.group.children.some(child => child instanceof Mesh && child.geometry instanceof DodecahedronGeometry),
    ).toBe(true)
    factory.disposeShared()
  })
})
