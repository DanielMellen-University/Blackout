import { describe, expect, it } from 'vitest'
import type { MeshStandardMaterial } from 'three'
import { buildWaterMesh } from '../src/world/WaterSystem'

// Unit tests never compile GLSL, so a moved or duplicated declaration in an
// injected chunk (for example seaMix moving above depthMix) would only fail in
// the browser, as a black or missing water material. Guard the basics here.
describe('water shader declarations', () => {
  it('declares every injected fragment local exactly once, before use', () => {
    const mesh = buildWaterMesh(new Float32Array([-8, -8, -8, -8]), new Float32Array(4), 1, 100, 0, 0, { value: 0 })!
    const material = mesh.material as MeshStandardMaterial
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <project_vertex>',
      // Same chunk order as three's standard fragment shader.
      fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>',
    }
    try {
      material.onBeforeCompile(shader as never)
      const source = shader.fragmentShader.replace(/\/\/.*$/gm, '')
      const declarations = [...source.matchAll(/\b(?:float|vec2|vec3|vec4)\s+([A-Za-z_]\w*)\s*=/g)].map(m => m[1]!)
      expect(declarations.length).toBeGreaterThan(20)
      const seen = new Set<string>()
      for (const name of declarations) {
        expect(seen.has(name), `${name} declared twice`).toBe(false)
        seen.add(name)
        const declared = source.search(new RegExp(`\\b(?:float|vec2|vec3|vec4)\\s+${name}\\s*=`))
        const firstUse = source.search(new RegExp(`\\b${name}\\b`))
        expect(firstUse, `${name} used before declaration`).toBeGreaterThanOrEqual(declared)
      }
    } finally {
      mesh.geometry.dispose()
      material.dispose()
    }
  })
})
