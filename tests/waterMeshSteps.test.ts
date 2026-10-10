import { createHash } from 'node:crypto'
import { BufferGeometry, Material, type Mesh } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWaterMesh, buildWaterMeshSteps, type WaterBuildPhase, type WaterMeshSteps } from '../src/world/WaterSystem'
import type { RiverReach, WaterBasin } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

type WaterArgs = Parameters<typeof buildWaterMesh>
function argsFor(name: string): WaterArgs {
  const basin: WaterBasin = { x: 0, z: 0, radius: 720, aspect: .72, angle: .35, phase: .8, level: 18, sea: false, pond: false }
  const dx = 960, dz = 600
  const reach: RiverReach = { ax: -160, az: -100, bx: 800, bz: 500, wa: 26, wb: 38, ya: 90, yb: 70,
    dx, dz, lengthSq: dx * dx + dz * dz, length: Math.hypot(dx, dz) }
  if (name === 'raster') return [new Float32Array([-4, -4, 4, 4]), new Float32Array(4), 1, 100, 0, 0, { value: 0 }]
  if (name === 'lake' || name === 'pond' || name === 'sea') {
    const span = name === 'lake' ? 1800 : name === 'pond' ? 420 : 3360
    if (name === 'pond') { basin.pond = true; basin.radius = 160 }
    if (name === 'sea') { basin.sea = true; basin.radius = 3200 }
    return [new Float32Array(9).fill(-24), new Float32Array(9).fill(18), 2, span, -span / 2, -span / 2,
      { value: 0 }, undefined, new Float32Array(9).fill(1), [], [basin]]
  }
  if (name === 'mouth') { reach.mouth = true; reach.source = false; reach.terminal = true }
  if (name === 'junction') {
    Object.assign(reach, { ax: 100, az: 100, bx: 320, bz: 300, dx: 220, dz: 200,
      lengthSq: 220 * 220 + 200 * 200, length: Math.hypot(220, 200), source: false, terminal: false })
  }
  return [new Float32Array(4).fill(100), new Float32Array(4), 1, 420, 0, 0, { value: 0 }, undefined, new Float32Array(4), [reach]]
}
function digest(mesh: Mesh): string {
  const hash = createHash('sha256')
  const bounds = mesh.geometry.boundingSphere!
  hash.update(JSON.stringify({ position: mesh.position.toArray(), bounds: [...bounds.center.toArray(), bounds.radius] }))
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
    hash.update(name)
    hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength))
  }
  return hash.digest('hex')
}
function dispose(mesh: Mesh | null): void {
  if (!mesh) return
  mesh.geometry.dispose()
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
}
function finish(steps: WaterMeshSteps): Mesh | null {
  let result = steps.next()
  while (!result.done) result = steps.next()
  return result.value
}
function advanceTo(steps: WaterMeshSteps, phase: WaterBuildPhase): void {
  while (true) {
    const result = steps.next()
    expect(result.done).toBe(false)
    if (result.value === phase) return
  }
}
beforeEach(() => setWorldSeed(1337))
afterEach(() => vi.restoreAllMocks())

describe('cooperative water geometry', () => {
  // Authored basins retain their buffers; sea-level raster uses the sea material kind.
  it.each([
    ['raster', 'edeb0d4688d760b8e5119f4a1ac2cc7b1aeba293141ddf5e7b6321726497c436'],
    ['lake', 'b99072688cd79b31d632d9e436211765afc666fc6e55fe0c39d486a5403102ce'],
    ['pond', 'ff33001ecc43afe76c93fd273989f1d90ae460e20b5864eebd5d0315d420f116'],
    ['sea', '0bc507c61a5827c6a0db58a18fb2c83328170693afe87c3ab9873264cdc729b1'],
    ['river', '56b319baee7d18b19daf9fb881a0604f95862b919c337c7185b1b46e181c26a0'],
    ['mouth', '50edd2ed2766406519c3d822205d6bef37d2f1ac36ab789e57b945327007c3a1'],
    ['junction', '13e085ada102c346e8ee4334cb72d5e74da70cbaf0c7944b2a087e5b40c9c225'],
  ])('preserves %s bytes and bounds', (name, hash) => {
    const mesh = finish(buildWaterMeshSteps(...argsFor(name)))!
    const sync = buildWaterMesh(...argsFor(name))!
    try { expect(digest(mesh)).toBe(hash); expect(digest(sync)).toBe(hash) }
    finally { dispose(mesh); dispose(sync) }
  })

  it('preserves a suspended shoreline, staging arrays and input-list membership across interleaves', () => {
    const args = argsFor('sea')
    const expected = buildWaterMesh(...argsFor('sea'))!
    const steps = buildWaterMeshSteps(...args)
    advanceTo(steps, 'shore')
    ;(args[10] as WaterBasin[]).length = 0
    const interleaved = buildWaterMesh(...argsFor('river'))
    dispose(interleaved)
    const actual = finish(steps)!
    try { expect(digest(actual)).toBe(digest(expected)) }
    finally { dispose(actual); dispose(expected) }
  })

  it('retains a river list while another collector reuses the input array', () => {
    const args = argsFor('mouth')
    const expected = buildWaterMesh(...argsFor('mouth'))!
    const steps = buildWaterMeshSteps(...args)
    advanceTo(steps, 'grid')
    ;(args[9] as RiverReach[]).length = 0
    const actual = finish(steps)!
    try { expect(digest(actual)).toBe(digest(expected)) }
    finally { dispose(actual); dispose(expected) }
  })

  it.each(['grid', 'shore', 'basin', 'attributes', 'normals', 'bounds'] as const)(
    'cancels at %s without publishing partial geometry or leaking resources', phase => {
      const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
      const materialDispose = vi.spyOn(Material.prototype, 'dispose')
      const steps = buildWaterMeshSteps(...argsFor('sea'))
      advanceTo(steps, phase)
      expect(geometryDispose).not.toHaveBeenCalled()
      steps.return(null)
      const hasGeometry = ['attributes', 'normals', 'bounds'].includes(phase)
      expect(geometryDispose).toHaveBeenCalledTimes(hasGeometry ? 1 : 0)
      expect(materialDispose).not.toHaveBeenCalled()
      steps.return(null)
      expect(geometryDispose).toHaveBeenCalledTimes(hasGeometry ? 1 : 0)
      const mesh = buildWaterMesh(...argsFor('raster'))!
      try { expect(digest(mesh)).toBe('edeb0d4688d760b8e5119f4a1ac2cc7b1aeba293141ddf5e7b6321726497c436') }
      finally { dispose(mesh) }
    })

  it('cancels river work and recovers the reusable staging workspace', () => {
    const steps = buildWaterMeshSteps(...argsFor('river'))
    advanceTo(steps, 'river')
    steps.return(null)
    const mesh = buildWaterMesh(...argsFor('lake'))!
    try { expect(digest(mesh)).toBe('b99072688cd79b31d632d9e436211765afc666fc6e55fe0c39d486a5403102ce') }
    finally { dispose(mesh) }
  })

  it('cleans up partial geometry when mesh preparation throws', () => {
    const steps = buildWaterMeshSteps(...argsFor('lake'))
    advanceTo(steps, 'attributes')
    const disposal = vi.spyOn(BufferGeometry.prototype, 'dispose')
    vi.spyOn(BufferGeometry.prototype, 'computeBoundingSphere').mockImplementationOnce(() => { throw Error('synthetic bounds failure') })
    expect(() => finish(steps)).toThrow('synthetic bounds failure')
    expect(disposal).toHaveBeenCalledOnce()
    const mesh = buildWaterMesh(...argsFor('raster'))!
    dispose(mesh)
  })

  it('yields for dry grids but returns no surface', () => {
    const steps = buildWaterMeshSteps(new Float32Array(1089).fill(1), new Float32Array(1089), 32, 420, 0, 0, { value: 0 })
    let count = 0, result = steps.next()
    while (!result.done) { expect(result.value).toBe('grid'); count++; result = steps.next() }
    expect(count).toBe(33)
    expect(result.value).toBeNull()
  })
})
