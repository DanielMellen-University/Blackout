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
  // Regional drainage revision 2: snapshots pin deterministic build/cancel/interleave output.
  it.each([
    [42, -1, -1, '4b5634ee5d85a6ec7975b65cb0906e93f5c4d105d5a2acd17bc264059850b941'],
    [42, 0, 0, '6ad0d7bf7c0d68ea68c93b51fbce093bb3017e44d32cd6042c3e4002da9f248d'],
    [42, 1, -1, 'c01fe006cec1c782ef3721f2bd72ee7477bd03dad2ee89b8586704e9b85b6a2d'],
    [1337, -1, -1, 'f28dc45844d7cf94413e54851e53cee15004a7d2e65f0c193fddc834a40d1427'],
    [1337, 0, 0, '7a4daa5a2ed60deeb955d96a640f3b46ca37d1718cb8cd90cec9c81903f67bdc'],
    [1337, 1, -1, '526f4735bd5f58473b3e4096849436487f3da68330af38d021b7abc2c38b6eca'],
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
    expect(digest(0, 0)).toBe('7a4daa5a2ed60deeb955d96a640f3b46ca37d1718cb8cd90cec9c81903f67bdc')
  })

  it('keeps drainage order independent when other regions overwrite sort scratch', () => {
    const a = prepare(0, 0), b = prepare(-1, -1)
    advanceToGrade(a)
    advanceToGrade(b)
    waterLandmarks(1, -1)
    drain(a)
    drain(b)
    expect(digest(0, 0)).toBe('7a4daa5a2ed60deeb955d96a640f3b46ca37d1718cb8cd90cec9c81903f67bdc')
    expect(digest(-1, -1)).toBe('f28dc45844d7cf94413e54851e53cee15004a7d2e65f0c193fddc834a40d1427')
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
    expect(digest(0, 0)).toBe('6ad0d7bf7c0d68ea68c93b51fbce093bb3017e44d32cd6042c3e4002da9f248d')
  })

  it('does not reuse another seed\'s cache when a failed world search restores the original seed', () => {
    const steps = prepare(0, 0)
    advanceToGrade(steps)
    setWorldSeed(42)
    expect(digest(0, 0)).toBe('6ad0d7bf7c0d68ea68c93b51fbce093bb3017e44d32cd6042c3e4002da9f248d')
    setWorldSeed(1337)
    drain(steps)
    expect(digest(0, 0)).toBe('7a4daa5a2ed60deeb955d96a640f3b46ca37d1718cb8cd90cec9c81903f67bdc')
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
