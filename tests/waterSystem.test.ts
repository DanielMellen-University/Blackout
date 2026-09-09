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
      const flow = mesh.geometry.getAttribute('waterFlow')
      const flowDir = mesh.geometry.getAttribute('waterFlowDir')
      const normals = mesh.geometry.getAttribute('normal')
      expect(flow.count).toBe(positions.count)
      expect(flowDir.count).toBe(positions.count)
      let shoreline = 0
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBe(level)
        expect(depths.getX(i)).toBeGreaterThanOrEqual(0)
        expect(flow.getX(i)).toBe(0)
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
      expect(shader.vertexShader).toContain('waterFlow')
      expect(shader.vertexShader).toContain('waterFlowDir')
      expect(shader.fragmentShader).toContain('vWaterFlow')
      expect(shader.fragmentShader).toContain('riverRiffle')
      expect(shader.fragmentShader).toContain('flowStreak')
      expect(shader.fragmentShader).toContain('riverDepthBand')
      expect(shader.fragmentShader).toContain('riverBankFoam')
      expect(shader.fragmentShader).toContain('shoreFoam')
      expect(shader.fragmentShader).toContain('waterPattern')
    } finally {
      mesh.geometry.dispose()
      material.dispose()
    }
  })

  it('batches analytic rivers when a coarse tile misses every wet vertex', () => {
    const clock = { value: 0 }
    const mesh = buildWaterMesh(
      new Float32Array([60, 60, 60, 60]), new Float32Array(4), 1, 420, 0, 0, clock, undefined,
      [{ ax: 12, az: 90, bx: 408, bz: 330, wa: 18, wb: 42, ya: 130, yb: 92 }],
    )
    expect(mesh).not.toBeNull()
    const positions = mesh!.geometry.getAttribute('position')
    const depths = mesh!.geometry.getAttribute('waterDepth')
    const flow = mesh!.geometry.getAttribute('waterFlow')
    const flowDir = mesh!.geometry.getAttribute('waterFlowDir')
    expect(positions.count).toBeGreaterThanOrEqual(24)
    expect(depths.count).toBe(positions.count)
    expect(flow.count).toBe(positions.count)
    expect(flowDir.count).toBe(positions.count)
    expect(Math.hypot(flowDir.getX(0), flowDir.getY(0))).toBeCloseTo(1, 5)
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getY(i)).toBeGreaterThan(90)
      expect(depths.getX(i)).toBeGreaterThan(0)
      expect(flow.getX(i)).toBe(1)
    }
    mesh!.geometry.dispose()
    ;(mesh!.material as MeshStandardMaterial).dispose()
  })

  it('drops staged tributary caps below the live channel surface', () => {
    const clock = { value: 0 }
    const mesh = buildWaterMesh(
      new Float32Array([60, 60, 60, 60]), new Float32Array(4), 1, 420, 0, 0, clock, undefined,
      [{ ax: 160, az: 90, bx: 260, bz: 90, wa: 18, wb: 18, ya: 100, yb: 100, source: true, terminal: true }],
    )!
    const positions = mesh.geometry.getAttribute('position')
    let lowered = 0
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) < 100.04 - .01 && positions.getY(i) > 99.9) lowered++
    }
    expect(lowered).toBeGreaterThan(0)
    mesh.geometry.dispose()
    ;(mesh.material as MeshStandardMaterial).dispose()
  })

  it('clips rivers to each tile and keeps raster water basin-only', () => {
    const clock = { value: 0 }
    const dryBed = new Float32Array([60, 60, 60, 60])
    const noBasin = new Float32Array(4)
    expect(buildWaterMesh(new Float32Array([-4, -4, -4, -4]), new Float32Array(4), 1, 100, 0, 0, clock, undefined, noBasin)).toBeNull()

    const basin = buildWaterMesh(new Float32Array([-4, -4, -4, -4]), new Float32Array(4), 1, 100, 0, 0, clock,
      undefined, new Float32Array(4).fill(1))!
    expect(basin).not.toBeNull()
    basin.geometry.dispose()
    ;(basin.material as MeshStandardMaterial).dispose()

    const river = buildWaterMesh(dryBed, new Float32Array(4), 1, 420, 0, 0, clock, undefined, noBasin,
      [{ ax: -160, az: 60, bx: 580, bz: 340, wa: 26, wb: 38, ya: 90, yb: 70 }])!
    const positions = river.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getX(i)).toBeGreaterThanOrEqual(-210 - 1e-4)
      expect(positions.getX(i)).toBeLessThanOrEqual(210 + 1e-4)
      expect(positions.getZ(i)).toBeGreaterThanOrEqual(-210 - 1e-4)
      expect(positions.getZ(i)).toBeLessThanOrEqual(210 + 1e-4)
    }
    river.geometry.dispose()
    ;(river.material as MeshStandardMaterial).dispose()
  })

  it('builds a smooth irregular shoreline fan for fixed-level basins', () => {
    const clock = { value: 0 }
    const basin = {
      x: 0, z: 0, radius: 720, aspect: .72, angle: .35, phase: .8,
      level: 18, sea: false, pond: false,
    }
    const bed = new Float32Array(9).fill(-24)
    const levels = new Float32Array(9).fill(18)
    const mask = new Float32Array(9).fill(1)
    const mesh = buildWaterMesh(bed, levels, 2, 1800, -900, -900, clock, undefined, undefined, [], [basin])!
    const positions = mesh.geometry.getAttribute('position')
    expect(positions.count).toBeGreaterThan(60)
    for (let i = 0; i < positions.count; i++) expect(positions.getY(i)).toBe(18)
    mesh.geometry.dispose()
    ;(mesh.material as MeshStandardMaterial).dispose()
  })
})
