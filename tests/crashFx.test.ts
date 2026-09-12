import { Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CrashFx } from '../src/systems/CrashFx'

describe('crash effect pooling', () => {
  it('keeps a stable scene footprint across repeated crash retries', () => {
    const fx = new CrashFx(new Scene())
    const childCount = fx.root.children.length

    fx.trigger(new Vector3(), new Vector3(4, -8, 12))
    fx.update(0.08)
    fx.reset()
    fx.trigger(new Vector3(10, 3, -4), new Vector3(-4, 2, 8))

    expect(fx.root.children).toHaveLength(childCount)
    fx.dispose()
  })

  it('hides the pooled effect cleanly when reset', () => {
    const fx = new CrashFx(new Scene())
    fx.trigger(new Vector3(), new Vector3())
    fx.reset()

    expect(fx.active).toBe(false)
    expect(fx.root.visible).toBe(false)
    fx.dispose()
  })

  it('compacts expired pooled particles during the effect tail', () => {
    const fx = new CrashFx(new Scene())
    fx.trigger(new Vector3(), new Vector3(4, -8, 12))
    expect(fx.activeCount).toBe(54)

    fx.update(1.1)
    expect(fx.activeCount).toBeLessThan(54)
    expect(fx.activeCount).toBeGreaterThan(0)

    fx.update(7)
    expect(fx.activeCount).toBe(0)
    fx.dispose()
  })

  it('replays the same impact burst deterministically', () => {
    const first = new CrashFx(new Scene())
    const second = new CrashFx(new Scene())
    const point = new Vector3(12, 3, -4)
    const velocity = new Vector3(-4, 2, 8)

    first.trigger(point, velocity)
    second.trigger(point, velocity)

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
})
