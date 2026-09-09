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
})
