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
  // Regional drainage revision 7: snapshots pin deterministic build/cancel/interleave output.
  it.each([
    [42, -1, -1, 'cfd1c4d10271ee623c624c6da61503cd6796172b8e853b9c3e49bdb265e4a49c'],
    [42, 0, 0, '3e1a452daa79ae48fd09da9b96b72bf8595c75e2e78b89dea862fb1a80ff770d'],
    [42, 1, -1, '4ecbc4d5e187dcc4c3b78d1fc47123bb7d17c5a029f107944ca58c74e768326a'],
    [1337, -1, -1, 'b11037db74d7fcbba2bdd8c0b6be541ec1a293bf2ae1555c3eed078d7df31ad2'],
    [1337, 0, 0, 'f49b244e6e9cb1c6a6c6d0e5971bddb625fbda0e95cb36994b9a633e704453f5'],
    [1337, 1, -1, 'b20428280d4a9d6bf8b932f7b4b7eb7d7b3f4e23429e98972067eb0e8a9913f1'],
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
    expect(digest(0, 0)).toBe('f49b244e6e9cb1c6a6c6d0e5971bddb625fbda0e95cb36994b9a633e704453f5')
  })

  it('keeps drainage order independent when other regions overwrite sort scratch', () => {
    const a = prepare(0, 0), b = prepare(-1, -1)
    advanceToGrade(a)
    advanceToGrade(b)
    waterLandmarks(1, -1)
    drain(a)
    drain(b)
    expect(digest(0, 0)).toBe('f49b244e6e9cb1c6a6c6d0e5971bddb625fbda0e95cb36994b9a633e704453f5')
    expect(digest(-1, -1)).toBe('b11037db74d7fcbba2bdd8c0b6be541ec1a293bf2ae1555c3eed078d7df31ad2')
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
    expect(digest(0, 0)).toBe('3e1a452daa79ae48fd09da9b96b72bf8595c75e2e78b89dea862fb1a80ff770d')
  })

  it('does not reuse another seed\'s cache when a failed world search restores the original seed', () => {
    const steps = prepare(0, 0)
    advanceToGrade(steps)
    setWorldSeed(42)
    expect(digest(0, 0)).toBe('3e1a452daa79ae48fd09da9b96b72bf8595c75e2e78b89dea862fb1a80ff770d')
    setWorldSeed(1337)
    drain(steps)
    expect(digest(0, 0)).toBe('f49b244e6e9cb1c6a6c6d0e5971bddb625fbda0e95cb36994b9a633e704453f5')
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
