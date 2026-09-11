import { Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  LandingFx,
  landingScrubIntensity,
  landingScrubRate,
} from '../src/systems/LandingFx'

describe('landing scrub pooling', () => {
  it('keeps a stable scene footprint across repeated touchdowns', () => {
    const fx = new LandingFx(new Scene())
    const childCount = fx.root.children.length

    fx.trigger(new Vector3(), new Vector3(18, -2, 4), 1)
    fx.update(0.05)
    fx.reset()
    fx.trigger(new Vector3(12, 1, -3), new Vector3(-10, -1, 8), 0.7)

    expect(fx.root.children).toHaveLength(childCount)
    fx.dispose()
  })

  it('hides pooled scrub cleanly when reset', () => {
    const fx = new LandingFx(new Scene())
    fx.trigger(new Vector3(), new Vector3(22, -3, 0), 1)
    fx.reset()

    expect(fx.activeCount).toBe(0)
    expect(fx.root.visible).toBe(false)
    fx.dispose()
  })

  it('scales continuous scrub intensity with ground speed', () => {
    expect(landingScrubIntensity(0)).toBe(0)
    expect(landingScrubIntensity(9)).toBe(0)
    expect(landingScrubIntensity(37.5)).toBeCloseTo(0.5)
    expect(landingScrubIntensity(100)).toBe(1)
    expect(landingScrubRate(9)).toBe(0)
    expect(landingScrubRate(65)).toBeGreaterThan(landingScrubRate(20))
  })
})
