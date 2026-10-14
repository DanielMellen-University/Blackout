import { describe, expect, it } from 'vitest'
import { lightningFlashEnvelope, StormEvents, thunderGainAtDistance } from '../src/world/StormEvents'

const source = { x: 0, y: 1500, z: 0, strength: 1 }
const listener = { x: 0, y: 1500, z: -3430 }

describe('spatial storm events', () => {
  it('delays thunder by distance, attenuates it and consumes it exactly once', () => {
    const events = new StormEvents(); events.reset(73)
    events.update(60, source, listener)
    expect(events.active).toBe(true)
    expect(events.position).toEqual({ x: 0, y: 1500, z: 0 })
    expect(events.consumeThunder()).toBe(0)
    events.update(9.9, source, listener)
    expect(events.consumeThunder()).toBe(0)
    events.update(.11, source, listener)
    expect(events.consumeThunder()).toBeCloseTo(thunderGainAtDistance(3430))
    expect(events.consumeThunder()).toBe(0)
  })

  it('freezes flash/delay on pause and malformed steps, and clears events on reset', () => {
    const events = new StormEvents(); events.reset(1)
    events.update(60, source, listener); events.update(.1, source, listener)
    const flash = events.flash
    expect(flash).toBeGreaterThan(0); expect(flash).toBeLessThanOrEqual(.18)
    for (const dt of [0, -1, NaN, Infinity]) events.update(dt, source, listener)
    expect(events.flash).toBe(flash)
    expect(events.thunderPending).toBe(true)
    expect(events.consumeThunder()).toBe(0)
    events.reset(2)
    expect(events.flash).toBe(0); expect(events.active).toBe(false)
    expect(events.thunderPending).toBe(false); expect(events.consumeThunder()).toBe(0)
  })

  it('never queues a second thunder or overwrites an unheard event', () => {
    const events = new StormEvents(); events.reset(42)
    events.update(60, source, listener)
    events.update(60, { ...source, x: 10000 }, listener)
    expect(events.thunderPending).toBe(true)
    expect(events.position.x).toBe(0)
    events.update(60, { ...source, x: 10000 }, listener)
    expect(events.position.x).toBe(0)
    expect(events.consumeThunder()).toBeGreaterThan(0)
    events.update(.1, { ...source, x: 10000 }, listener)
    expect(events.position.x).toBe(10000)
    expect(events.consumeThunder()).toBe(0)
  })

  it('cancels preset-switch illumination while retaining sound already in flight', () => {
    const events = new StormEvents(); events.reset(1)
    events.update(60, source, listener); events.update(.1, source, listener)
    expect(events.flash).toBeGreaterThan(0)
    events.clearFlash()
    expect(events.flash).toBe(0); expect(events.active).toBe(false)
    expect(events.thunderPending).toBe(true)
    events.update(10, { ...source, strength: 0 }, listener)
    expect(events.consumeThunder()).toBeGreaterThan(0)
  })

  it('keeps seeded events reproducible and suppresses only flash illumination with reduced motion', () => {
    const first = new StormEvents(), second = new StormEvents()
    first.reset(1); second.reset(1)
    for (const dt of [60, .1, .1]) { first.update(dt, source, listener); second.update(dt, source, listener) }
    expect(first.flash).toBe(second.flash)
    first.setReducedMotion(true)
    expect(first.flash).toBe(0); expect(first.active).toBe(false)
    first.update(10, source, listener)
    expect(first.consumeThunder()).toBeGreaterThan(0)
    first.reset(1); first.update(60, source, listener); first.update(.1, source, listener)
    expect(first.flash).toBe(0); expect(first.thunderPending).toBe(true)
  })

  it('ignores dry, distant and invalid sources and avoids thunder after flying out of audible range', () => {
    const events = new StormEvents(); events.reset(1)
    events.update(60, { ...source, strength: .1 }, listener)
    events.update(60, { ...source, x: 40000 }, listener)
    events.update(60, { ...source, x: NaN }, listener)
    expect(events.active).toBe(false); expect(events.thunderPending).toBe(false)
    events.update(.1, source, listener)
    events.update(11, { ...source, strength: 0 }, { ...listener, x: 50000 })
    expect(events.consumeThunder()).toBe(0)
    expect(thunderGainAtDistance(Infinity)).toBe(0)
    expect(thunderGainAtDistance(-1)).toBe(1)
    expect(lightningFlashEnvelope(NaN, 1)).toBe(0)
  })
})
