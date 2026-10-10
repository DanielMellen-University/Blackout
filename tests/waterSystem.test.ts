import { MeshStandardMaterial } from 'three'
import { basinDistance, type RiverReach, type WaterBasin } from '../src/world/Hydrology'
import { describe, expect, it } from 'vitest'
import { applyWaterAppearance } from '../src/world/WaterAppearance'
import { buildWaterMesh } from '../src/world/WaterSystem'

describe('independent water surfaces', () => {
  it('does not rasterize a second sea surface under a near-sea-level lake', () => {
    const lake: WaterBasin = { x: 50, z: 50, radius: 35, aspect: 1, angle: 0, phase: 0,
      level: .01, sea: false, pond: true, shoreRadii: new Float32Array(32).fill(35) }
    const mesh = buildWaterMesh(new Float32Array(4).fill(-5), new Float32Array([0, .01, 0, .01]),
      1, 100, 0, 0, { value: 0 }, undefined, new Float32Array(4).fill(1), [], [lake])!
    try {
      const kind = mesh.geometry.getAttribute('waterKind')
      expect(kind.count).toBeGreaterThan(0)
      for (let i = 0; i < kind.count; i++) expect(kind.getX(i)).toBe(.5)
    } finally { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose() }
  })

  it('gives receiving lakes surface ownership instead of overlapping river caps', () => {
    const lake: WaterBasin = { x: 800, z: 500, radius: 220, aspect: 1, angle: 0, phase: 0,
      level: 90, sea: false, pond: true, shoreRadii: new Float32Array(32).fill(220) }
    const reach: RiverReach = { ax: 100, az: 500, bx: 800, bz: 500, wa: 80, wb: 100,
      ya: 100, yb: 90, dx: 700, dz: 0, length: 700, lengthSq: 490000,
      source: false, terminal: true, mouth: true,
      tangentAX: 1, tangentAZ: 0, tangentBX: 1, tangentBZ: 0 }
    const mesh = buildWaterMesh(new Float32Array(4).fill(200), new Float32Array(4), 1, 1200,
      0, 0, { value: 0 }, undefined, [reach], [], [lake])!
    const p = mesh.geometry.getAttribute('position'), kind = mesh.geometry.getAttribute('waterKind')
    const normals = mesh.geometry.getAttribute('normal')
    const flow = mesh.geometry.getAttribute('waterFlow'), depth = mesh.geometry.getAttribute('waterDepth')
    let river = 0, basin = 0, blended = 0, shore = 0, deepMouth = 0, dryShore = 0
    for (let i = 0; i < p.count; i++) {
      blended += Number(kind.getX(i) > 0 && kind.getX(i) < .49)
      if (Math.abs(basinDistance(lake, p.getX(i) + 600, p.getZ(i) + 600)) > .05) continue
      shore++
      expect(kind.getX(i)).toBeCloseTo(.5, 4)
      expect(flow.getX(i)).toBeCloseTo(0, 4)
      expect(depth.getX(i)).toBeGreaterThanOrEqual(.0799)
      if (p.getX(i) + 600 < lake.x && Math.abs(p.getZ(i) + 600 - 500) < 25) {
        expect(depth.getX(i)).toBeGreaterThan(2)
        deepMouth++
      }
      if (depth.getX(i) < .081) dryShore++
    }
    expect(blended).toBeGreaterThan(0); expect(shore).toBeGreaterThan(0)
    expect(deepMouth).toBeGreaterThan(0); expect(dryShore).toBeGreaterThan(0)
    for (let i = 0; i < p.count; i += 3) {
      for (let j = i; j < i + 3; j++) {
        expect(normals.getX(j)).toBe(0); expect(normals.getZ(j)).toBe(0)
        expect(Math.abs(normals.getY(j))).toBe(1)
      }
      if (kind.getX(i) !== 0) { basin++; continue }
      river++
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 + 600
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 + 600
      expect(basinDistance(lake, x, z)).toBeGreaterThan(-1)
    }
    expect(river).toBeGreaterThan(0); expect(basin).toBeGreaterThan(0)
    mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose()
  })

  it('keeps a river mouth at its carved width instead of pinching it to one-third', () => {
    const reach: RiverReach = { ax: 200, az: 300, bx: 600, bz: 300,
      wa: 60, wb: 120, ya: 100, yb: 90, dx: 400, dz: 0, length: 400, lengthSq: 160000,
      source: false, terminal: true, mouth: true,
      tangentAX: 1, tangentAZ: 0, tangentBX: 1, tangentBZ: 0 }
    const mesh = buildWaterMesh(new Float32Array(4).fill(200), new Float32Array(4),
      1, 1000, 0, 0, { value: 0 }, undefined, [reach])!
    const p = mesh.geometry.getAttribute('position')
    let halfWidth = 0
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) + 500 - reach.bx) < .001 &&
      Math.abs(p.getY(i) - 90.04) < .001) halfWidth = Math.max(halfWidth, Math.abs(p.getZ(i) + 500 - reach.bz))
    expect(halfWidth).toBeCloseTo(reach.wb, 3)
    // The outward mouth cap must not cover the upstream ribbon a second time.
    let coverage = 0
    const x = 590 - 500, z = 313 - 500
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1)
      const cx = p.getX(i + 2), cz = p.getZ(i + 2)
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
      if (Math.abs(d) < 1e-8) continue
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d
      const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d
      if (Math.min(a, b, 1 - a - b) > 1e-6) coverage++
    }
    expect(coverage).toBe(1)
    mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose()
  })

  it('stitches curved graded ribbons at shared cross-sections without flat overlapping pads', () => {
    const a: RiverReach = { ax: 50, az: 60, bx: 200, bz: 200, wa: 24, wb: 32, ya: 100, yb: 90,
      dx: 150, dz: 140, length: Math.hypot(150, 140), lengthSq: 150 ** 2 + 140 ** 2,
      source: false, terminal: false, tangentAX: 1, tangentAZ: 0, tangentBX: .6, tangentBZ: .8 }
    const b: RiverReach = { ...a, ax: 200, az: 200, bx: 340, bz: 360, wa: 32, wb: 40, ya: 90, yb: 80,
      dx: 140, dz: 160, length: Math.hypot(140, 160), lengthSq: 140 ** 2 + 160 ** 2,
      tangentAX: .6, tangentAZ: .8, tangentBX: 0, tangentBZ: 1 }
    const sections: string[][] = []
    for (const reach of [a, b]) {
      const mesh = buildWaterMesh(new Float32Array(4).fill(200), new Float32Array(4), 1, 420,
        0, 0, { value: 0 }, undefined, new Float32Array(4), [reach])!
      const p = mesh.geometry.getAttribute('position'), section = new Set<string>()
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - 90.04) < .001) {
        const x = p.getX(i) + 210 - 200, z = p.getZ(i) + 210 - 200
        expect(Math.abs(x * .6 + z * .8)).toBeLessThan(.001)
        section.add(`${x.toFixed(3)},${z.toFixed(3)}`)
      }
      sections.push([...section].sort())
      mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose()
    }
    expect(sections[0]).toHaveLength(3)
    expect(sections[0]).toEqual(sections[1])
  })

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
      const kind = mesh.geometry.getAttribute('waterKind')
      const drop = mesh.geometry.getAttribute('waterDrop')
      const normals = mesh.geometry.getAttribute('normal')
      expect(flow.count).toBe(positions.count)
      expect(flowDir.count).toBe(positions.count)
      expect(kind.count).toBe(positions.count)
      expect(drop.count).toBe(positions.count)
      let shoreline = 0
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBe(level)
        expect(depths.getX(i)).toBeGreaterThanOrEqual(0)
        expect(flow.getX(i)).toBe(0)
        expect(kind.getX(i)).toBe(level <= 0 ? 2 : 1)
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
    const weather = { rain: { value: .75 }, snow: { value: .25 }, windX: { value: .8 }, windZ: { value: -.35 } }
    const mesh = buildWaterMesh(
      new Float32Array([-8, -8, -8, -8]), new Float32Array(4), 1, 100, 0, 0, clock, weather,
    )!
    const material = mesh.material as MeshStandardMaterial
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <project_vertex>',
      fragmentShader: '#include <roughnessmap_fragment>\n#include <color_fragment>\n#include <normal_fragment_maps>',
    }
    try {
      material.onBeforeCompile(shader as never)
      expect(shader.uniforms.waterRain).toBe(weather.rain)
      expect(shader.uniforms.waterSnow).toBe(weather.snow)
      expect(shader.uniforms.waterWindX).toBe(weather.windX)
      expect(shader.uniforms.waterWindZ).toBe(weather.windZ)
      expect(shader.fragmentShader).toContain('waterRain')
      expect(shader.fragmentShader).toContain('waterSnow')
      expect(shader.fragmentShader).toContain('waterWindX')
      expect(shader.vertexShader).toContain('waterFlow')
      expect(shader.vertexShader).toContain('waterFlowDir')
      expect(shader.vertexShader).toContain('waterKind')
      expect(shader.vertexShader).toContain('waterDrop')
      expect(shader.vertexShader).not.toContain('waterVertexDistance')
      expect(shader.vertexShader).not.toContain('DistanceFade')
      expect(shader.fragmentShader).toContain('waterPixelDistance = length(vWaterWorld - cameraPosition)')
      expect(shader.fragmentShader).toContain('vWaterFlow')
      expect(shader.fragmentShader).toContain('riverRiffle')
      expect(shader.fragmentShader).toContain('flowStreak')
      expect(shader.fragmentShader).not.toContain('riverSurfaceTint')
      expect(shader.fragmentShader).not.toContain('riverDepthBand')
      expect(shader.fragmentShader).not.toContain('vWaterKind * 1.8')
      expect(shader.fragmentShader).toContain('vec3 deepWater = vec3(0.008, 0.065, 0.12)')
      expect(shader.fragmentShader).toContain('depthDetail = 1.0 - smoothstep(450.0, 1800.0, waterPixelDistance)')
      expect(shader.vertexShader).not.toContain('depthDetail')
      expect(shader.fragmentShader).toContain('riverBankFoam')
      expect(shader.fragmentShader).toContain('shoreFoam')
      expect(shader.fragmentShader).toContain('waterPattern')
      expect(shader.fragmentShader).toContain('broadBodyField')
      expect(shader.fragmentShader).toContain('bodyContrast')
      expect(shader.fragmentShader).toContain('waterDistanceFade')
      expect(shader.fragmentShader).toContain('seaMix')
      expect(shader.fragmentShader).toContain('cascadeFoam')
      expect(shader.fragmentShader).toContain('waterSpecMask')
      expect(shader.fragmentShader).toContain('waterSpecDistanceFade')
      expect(shader.fragmentShader).not.toContain('vWaterDistanceFade')
      expect(shader.fragmentShader).toContain('windRippleStrength')
      expect(shader.fragmentShader).not.toContain('vec2(waterWindX, waterWindZ) * worldWaterTime')
      expect(shader.fragmentShader).toContain('waterDetail > 0.05')
      expect(shader.fragmentShader).toContain('roughnessFactor')
      expect(material.polygonOffset).toBe(true)
      expect(material.polygonOffsetFactor).toBe(-2)
      expect(material.polygonOffsetUnits).toBe(-2)
      expect(material.customProgramCacheKey()).toBe('calm-basin-water-weather-v20')
    } finally {
      mesh.geometry.dispose()
      material.dispose()
    }
  })

  it('shares a live quality uniform for expensive water detail', () => {
    const material = new MeshStandardMaterial()
    const detailScale = { value: 0.35 }
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <project_vertex>',
      fragmentShader: '#include <roughnessmap_fragment>\n#include <color_fragment>\n#include <normal_fragment_maps>',
    }
    try {
      applyWaterAppearance(material, { value: 0 }, undefined, detailScale)
      material.onBeforeCompile(shader as never)
      expect(shader.uniforms.waterDetailScale).toBe(detailScale)
      expect(shader.fragmentShader).toContain('fineWaterDetail')
      expect(shader.fragmentShader).toContain('waterNormalDetail')
      expect(shader.fragmentShader).toContain('if (fineWaterDetail > 0.05')
      expect(shader.fragmentShader).toContain('if (waterNormalDetail > 0.05')
      detailScale.value = 1
      expect(detailScale.value).toBe(1)
    } finally {
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
    const kind = mesh!.geometry.getAttribute('waterKind')
    expect(positions.count).toBeGreaterThanOrEqual(24)
    expect(depths.count).toBe(positions.count)
    expect(flow.count).toBe(positions.count)
    expect(flowDir.count).toBe(positions.count)
    expect(kind.count).toBe(positions.count)
    expect(Math.hypot(flowDir.getX(0), flowDir.getY(0))).toBeCloseTo(1, 5)
    const flowValues: number[] = []
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getY(i)).toBeGreaterThan(90)
      expect(depths.getX(i)).toBeGreaterThan(0)
      expect(flow.getX(i)).toBeGreaterThanOrEqual(.24)
      expect(flow.getX(i)).toBeLessThanOrEqual(1)
      flowValues.push(flow.getX(i))
      expect(kind.getX(i)).toBe(0)
    }
    // Flow is now a bounded local signal, not a binary river flag. A reach
    // that widens downstream should carry visibly stronger highlights without
    // changing the shared material or adding a second draw.
    expect(Math.max(...flowValues) - Math.min(...flowValues)).toBeGreaterThan(.05)
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
    let maxX = -Infinity
    for (let i = 0; i < positions.count; i++) {
      maxX = Math.max(maxX, positions.getX(i))
      if (positions.getY(i) < 100.04 - .01 && positions.getY(i) > 99.9) lowered++
    }
    expect(lowered).toBeGreaterThan(0)
    // A terminal cap should feather well past the last live section instead
    // of leaving a short, screen-space rectangular cutoff.
    expect(maxX).toBeGreaterThan(150)
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

  it('decimates far basin shorelines while preserving near detail', () => {
    const clock = { value: 0 }
    const basin = {
      x: 0, z: 0, radius: 120, aspect: .72, angle: .35, phase: .8,
      level: 18, sea: false, pond: false,
    }
    const nearBed = new Float32Array(9).fill(-24)
    const nearLevels = new Float32Array(9).fill(18)
    const mask = new Float32Array(9).fill(1)
    const near = buildWaterMesh(nearBed, nearLevels, 2, 420, -210, -210, clock, undefined, mask, [], [basin])!
    const far = buildWaterMesh(nearBed, nearLevels, 2, 3360, -1680, -1680, clock, undefined, mask, [], [basin])!
    expect(near.geometry.getAttribute('position').count)
      .toBeGreaterThan(far.geometry.getAttribute('position').count * 1.8)
    near.geometry.dispose(); far.geometry.dispose()
    ;(near.material as MeshStandardMaterial).dispose()
    ;(far.material as MeshStandardMaterial).dispose()
  })
})
