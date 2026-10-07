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
  // Independently evaluated from c4615ad through a virtual legacy module.
  it.each([
    [42, -1, -1, 'a596ecaef4a51e4a23813568b9e2a3791aa03839a50e48b5ef0334f673f5a44f'],
    [42, 0, 0, '0091905390c80ae1a4394f99e0466c2e346f94e3823c0fd39f07148628c3b61d'],
    [42, 1, -1, '2cafe984b6b9cb4a621e211bea46c3c37d7ad010cc4dd6ea7010784d0a3e9715'],
    [1337, -1, -1, '14a855e1aeff0934de0b4a49e7d21fd90642115a1a7700820536799cdc2710ae'],
    [1337, 0, 0, 'a5f784db96adbf38e8c845e1b6973307972f9276761a5d2fc5d61e008f71895e'],
    [1337, 1, -1, 'f2bdc75541b6a316521d10eab1f77934bd9103b8eecb2d06567e26f9eb8392c2'],
  ] as const)('preserves legacy seed %s region %s,%s', (seed, cx, cz, hash) => {
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
    expect(digest(0, 0)).toBe('a5f784db96adbf38e8c845e1b6973307972f9276761a5d2fc5d61e008f71895e')
  })

  it('keeps drainage order independent when other regions overwrite sort scratch', () => {
    const a = prepare(0, 0), b = prepare(-1, -1)
    advanceToGrade(a)
    advanceToGrade(b)
    waterLandmarks(1, -1)
    drain(a)
    drain(b)
    expect(digest(0, 0)).toBe('a5f784db96adbf38e8c845e1b6973307972f9276761a5d2fc5d61e008f71895e')
    expect(digest(-1, -1)).toBe('14a855e1aeff0934de0b4a49e7d21fd90642115a1a7700820536799cdc2710ae')
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
    expect(digest(0, 0)).toBe('0091905390c80ae1a4394f99e0466c2e346f94e3823c0fd39f07148628c3b61d')
  })

  it('does not reuse another seed\'s cache when a failed world search restores the original seed', () => {
    const steps = prepare(0, 0)
    advanceToGrade(steps)
    setWorldSeed(42)
    expect(digest(0, 0)).toBe('0091905390c80ae1a4394f99e0466c2e346f94e3823c0fd39f07148628c3b61d')
    setWorldSeed(1337)
    drain(steps)
    expect(digest(0, 0)).toBe('a5f784db96adbf38e8c845e1b6973307972f9276761a5d2fc5d61e008f71895e')
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
