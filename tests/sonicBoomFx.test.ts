import { describe, expect, it } from 'vitest'
import { Group, Quaternion, Vector3 } from 'three'
import {
  SONIC_BOOM_DURATION_SEC,
  SonicBoomFx,
  sonicBoomOpacity,
  sonicBoomProgress,
  sonicBoomScale,
} from '../src/systems/SonicBoomFx'

describe('supersonic shockwave presentation', () => {
  it('keeps progress, scale, and opacity finite and bounded', () => {
    expect(sonicBoomProgress(Number.NaN)).toBe(0)
    expect(sonicBoomProgress(SONIC_BOOM_DURATION_SEC * 2)).toBe(1)
    expect(sonicBoomScale(0)).toBeCloseTo(0.28)
    expect(sonicBoomScale(1)).toBeGreaterThan(sonicBoomScale(0))
    expect(sonicBoomOpacity(0)).toBeGreaterThan(sonicBoomOpacity(1))
    expect(sonicBoomOpacity(Number.NaN)).toBeCloseTo(0.42)
    expect(sonicBoomOpacity(0, true)).toBeLessThan(sonicBoomOpacity(0))
  })

  it('uses one pooled ring and safely resets after its short lifetime', () => {
    const parent = new Group()
    const fx = new SonicBoomFx(parent)
    const position = new Vector3(4, 5, 6)
    fx.trigger(position, new Quaternion())
    expect(fx.root.visible).toBe(true)
    expect(fx.root.position.toArray()).toEqual([4, 5, 6])
    for (let index = 0; index < 8; index += 1) fx.update(SONIC_BOOM_DURATION_SEC / 4)
    expect(fx.root.visible).toBe(false)
    fx.reset()
    expect(fx.root.visible).toBe(false)
    expect(() => fx.update(Number.NaN)).not.toThrow()
    fx.dispose()
    expect(() => fx.trigger(position, new Quaternion())).not.toThrow()
  })
})
