import { Scene, Vector3 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import {
  LandingFx,
  landingScrubIntensity,
  landingScrubRate,
} from '../src/systems/LandingFx'
import { setContactHeightSampler } from '../src/world/ground'

afterEach(() => setContactHeightSampler(null))

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

  it('compacts expired pooled particles during the effect tail', () => {
    const fx = new LandingFx(new Scene())
    fx.trigger(new Vector3(), new Vector3(42, -3, 0), 1)
    expect(fx.activeCount).toBe(22)

    fx.update(1.2)
    expect(fx.activeCount).toBeLessThan(22)
    expect(fx.activeCount).toBeGreaterThan(0)

    fx.update(2)
    expect(fx.activeCount).toBe(0)
    expect(fx.root.visible).toBe(false)
    fx.dispose()
  })

  it('keeps pooled landing particles untouched while time is frozen', () => {
    const fx = new LandingFx(new Scene())
    fx.trigger(new Vector3(), new Vector3(0, -2, 50), 1)
    const activeCount = fx.activeCount
    fx.update(0)
    expect(fx.activeCount).toBe(activeCount)
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

  it('replays the same touchdown burst deterministically', () => {
    const first = new LandingFx(new Scene())
    const second = new LandingFx(new Scene())
    const point = new Vector3(12, 1, -3)
    const velocity = new Vector3(-10, -1, 8)

    first.trigger(point, velocity, 0.7)
    second.trigger(point, velocity, 0.7)

    const firstVisible = first.root.children
      .filter((child) => child.visible)
      .slice(0, 4)
      .map((child) => child.position.toArray())
    const secondVisible = second.root.children
      .filter((child) => child.visible)
      .slice(0, 4)
      .map((child) => child.position.toArray())
    expect(secondVisible).toEqual(firstVisible)

    first.dispose()
    second.dispose()
  })

  it('ignores late calls after idempotent disposal', () => {
    setContactHeightSampler(() => 0)
    const fx = new LandingFx(new Scene())
    fx.dispose()
    fx.dispose()
    fx.trigger(new Vector3(), new Vector3(0, -2, 40))
    fx.scrub(new Vector3(), new Vector3(0, 0, 50), 1 / 60)
    fx.update(1)
    fx.reset()
    expect(fx.activeCount).toBe(0)
  })
})
