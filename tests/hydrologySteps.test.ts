import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { CATCHMENT_SIZE, prepareHydrologyInBoundsSteps, riverReaches, waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

function resetSeed(seed: number): void {
  setWorldSeed(seed + 1)
  const invalidate = prepareHydrologyInBoundsSteps(1, 1, 1, 1)
  invalidate.next()
  invalidate.return()
  setWorldSeed(seed)
}
function prepare(cx: number, cz: number) {
  const x = cx * CATCHMENT_SIZE + 1, z = cz * CATCHMENT_SIZE + 1
  return prepareHydrologyInBoundsSteps(x, z, x, z)
}
function drain(steps: ReturnType<typeof prepare>): void { while (!steps.next().done) { /* CPU worker path */ } }
function advanceToGrade(steps: ReturnType<typeof prepare>): void {
  while (true) {
    const result = steps.next()
    expect(result.done).toBe(false)
    if (result.value === 'grade') return
  }
}
function digest(cx: number, cz: number): string {
  return createHash('sha256').update(JSON.stringify({ basins: waterLandmarks(cx, cz), reaches: riverReaches(cx, cz) })).digest('hex')
}
beforeEach(() => resetSeed(1337))

describe('cooperative cold hydrology', () => {
  // Regional drainage revision 4: snapshots pin deterministic build/cancel/interleave output.
  it.each([
    [42, -1, -1, '57644984b8fb6a97c4b93ba3a1bc92f97ff4a25c4c066efca15ebc3ac4a4bb9a'],
    [42, 0, 0, '7a63068918cb2c7747fdcc1697a2b4c86b32abed55047e3a1491dca785dbcf0a'],
    [42, 1, -1, '677ad34c42fe39acdd750c76278c0fb9063f18bd15249c1b1c0855ebcebacbc2'],
    [1337, -1, -1, '6a8e671821896aa9e6c620be247610d33dd2ce6cb40f815f88dfaa162762b778'],
    [1337, 0, 0, '89226267d26194b7658c659b0b307023b4b0a0a13bbac2faa52dbea823a61665'],
    [1337, 1, -1, '5fac9dcc2ea0dba137d89e87e752b74aa8172691db0029201eb9e0ebd21bf4df'],
  ] as const)('preserves regional seed %s region %s,%s', (seed, cx, cz, hash) => {
    resetSeed(seed)
    const phases = new Set<string>()
    const steps = prepare(cx, cz)
    let result = steps.next()
    while (!result.done) { phases.add(result.value); result = steps.next() }
    expect(phases).toEqual(new Set(['samples', 'routing', 'basins', 'grade', 'channels']))
    expect(digest(cx, cz)).toBe(hash)
    expect(prepare(cx, cz).next().done).toBe(true)
    resetSeed(seed)
    expect(digest(cx, cz)).toBe(hash) // Synchronous point-query miss uses the same builder.
  })

  it('does not publish partial regions and cancellation allows a clean restart', () => {
    const first = prepare(0, 0)
    advanceToGrade(first)
    const second = prepare(0, 0)
    expect(second.next().value).toBe('samples')
    first.return()
    second.return()
    const restarted = prepare(0, 0)
    expect(restarted.next().value).toBe('samples')
    drain(restarted)
    expect(digest(0, 0)).toBe('89226267d26194b7658c659b0b307023b4b0a0a13bbac2faa52dbea823a61665')
  })

  it('keeps drainage order independent when other regions overwrite sort scratch', () => {
    const a = prepare(0, 0), b = prepare(-1, -1)
    advanceToGrade(a)
    advanceToGrade(b)
    waterLandmarks(1, -1)
    drain(a)
    drain(b)
    expect(digest(0, 0)).toBe('89226267d26194b7658c659b0b307023b4b0a0a13bbac2faa52dbea823a61665')
    expect(digest(-1, -1)).toBe('6a8e671821896aa9e6c620be247610d33dd2ce6cb40f815f88dfaa162762b778')
  })

  it('retains canonical landmarks when a synchronous query completes a suspended region', () => {
    const steps = prepare(0, 0)
    advanceToGrade(steps)
    const canonical = waterLandmarks(0, 0)
    drain(steps)
    expect(waterLandmarks(0, 0)).toBe(canonical)
  })

  it('rejects a changed world seed before resuming stale calculations', () => {
    const steps = prepare(0, 0)
    steps.next()
    setWorldSeed(42)
    expect(() => steps.next()).toThrow('World seed changed')
    drain(prepare(0, 0))
    expect(digest(0, 0)).toBe('7a63068918cb2c7747fdcc1697a2b4c86b32abed55047e3a1491dca785dbcf0a')
  })

  it('does not reuse another seed\'s cache when a failed world search restores the original seed', () => {
    const steps = prepare(0, 0)
    advanceToGrade(steps)
    setWorldSeed(42)
    expect(digest(0, 0)).toBe('7a63068918cb2c7747fdcc1697a2b4c86b32abed55047e3a1491dca785dbcf0a')
    setWorldSeed(1337)
    drain(steps)
    expect(digest(0, 0)).toBe('89226267d26194b7658c659b0b307023b4b0a0a13bbac2faa52dbea823a61665')
  })

  it('covers exact region boundaries for shared normal probes', () => {
    drain(prepareHydrologyInBoundsSteps(-1, -1, 0, 0))
    for (const cx of [-1, 0]) for (const cz of [-1, 0]) expect(prepare(cx, cz).next().done).toBe(true)
  })

  it.each([
    [NaN, 0, 1, 1], [0, Infinity, 1, 1], [2, 0, 1, 1], [0, 2, 1, 1],
    [0, 0, CATCHMENT_SIZE * 5, 1], [0, 0, 1, CATCHMENT_SIZE * 5],
    [Number.MAX_VALUE, 0, Number.MAX_VALUE, 1], [0, -Number.MAX_VALUE, 1, -Number.MAX_VALUE],
  ])('fails closed on invalid/unbounded preparation %j', (...bounds) => {
    expect(prepareHydrologyInBoundsSteps(...bounds as [number, number, number, number]).next().done).toBe(true)
  })
})
