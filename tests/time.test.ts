import { describe, expect, it } from 'vitest'
import {
  shouldAdvanceWorld,
  shouldPauseForContextLoss,
  shouldPauseForFocusLost,
  shouldRenderFrame,
  shouldUpdateLiveHud,
  SIM_STEP,
  STATIC_RENDER_INTERVAL_MS,
  staticRenderDue,
  Time,
} from '../src/core/Time'
import {
  bannerRemainingMs,
  bannerUntilFromRemaining,
  MAX_BANNER_DURATION_MS,
} from '../src/core/BannerClock'

describe('Time', () => {
  it('throttles static scene rendering but renders immediately on transitions', () => {
    expect(staticRenderDue(100, Number.NaN, false, false)).toBe(true)
    expect(staticRenderDue(100 + STATIC_RENDER_INTERVAL_MS - 1, 100, false, false)).toBe(false)
    expect(staticRenderDue(100 + STATIC_RENDER_INTERVAL_MS, 100, false, false)).toBe(true)
    expect(staticRenderDue(101, 100, true, false)).toBe(true)
    expect(staticRenderDue(101, 100, false, true)).toBe(true)
    expect(staticRenderDue(101, 100, true, true)).toBe(true)
  })

  it('freezes and resumes banner deadlines with bounded remaining time', () => {
    expect(bannerRemainingMs(1_000, 2_500)).toBe(1_500)
    expect(bannerRemainingMs(3_000, 2_500)).toBe(0)
    expect(bannerRemainingMs(1_000, Number.POSITIVE_INFINITY)).toBeNull()
    expect(bannerUntilFromRemaining(5_000, 1_500)).toBe(6_500)
    expect(bannerUntilFromRemaining(5_000, MAX_BANNER_DURATION_MS * 4)).toBe(35_000)
    expect(bannerUntilFromRemaining(Number.NaN, 100)).toBeNaN()
  })

  it('runs extra fixed steps instead of slowing down at 10 fps', () => {
    const time = new Time()
    expect(time.beginFrame(0).steps).toBe(0)
    const frame = time.beginFrame(100)
    // 100 ms at 10 fps → 6 steps of 1/60 would be needed; catch-up is capped at 5.
    expect(frame.stepDt).toBe(SIM_STEP)
    expect(frame.steps).toBe(5)
  })

  it('does not dump a long tab-hide gap into the simulator', () => {
    const time = new Time()
    time.beginFrame(0)
    const frame = time.beginFrame(5000)
    expect(frame.steps).toBe(1)
  })

  it('drops accumulated time while skipped / paused', () => {
    const time = new Time()
    time.beginFrame(0)
    time.skipFrame(1000)
    const frame = time.beginFrame(1016)
    expect(frame.steps).toBeLessThanOrEqual(2)
  })

  it('exposes leftover time as a render blend factor', () => {
    const time = new Time()
    time.beginFrame(0)
    const frame = time.beginFrame(20)
    expect(frame.steps).toBe(1)
    expect(frame.alpha).toBeCloseTo(20 / 1000 / SIM_STEP - 1, 5)
    expect(frame.alpha).toBeGreaterThan(0)
    expect(frame.alpha).toBeLessThan(1)
  })

  it('reuses the frame timing record between render ticks', () => {
    const time = new Time()
    time.beginFrame(0)
    const first = time.beginFrame(16)
    const second = time.beginFrame(32)
    expect(second).toBe(first)
    expect(second.steps).toBe(1)
  })

  it('ignores malformed and backwards RAF timestamps without poisoning timing', () => {
    const time = new Time()
    time.beginFrame(100)
    const malformed = time.beginFrame(Number.NaN)
    expect(malformed.steps).toBe(0)
    expect(malformed.frameDt).toBe(0)
    expect(Number.isFinite(malformed.alpha)).toBe(true)

    const backwards = time.beginFrame(50)
    expect(backwards.frameDt).toBe(0)
    expect(backwards.steps).toBe(0)
    const recovered = time.beginFrame(116)
    expect(recovered.frameDt).toBeCloseTo(0.016, 6)
    expect(Number.isFinite(time.fps)).toBe(true)
  })

  it('keeps skipped frames monotonic when the timestamp is invalid', () => {
    const time = new Time()
    time.beginFrame(100)
    time.skipFrame(Number.NaN)
    const frame = time.beginFrame(116)
    expect(frame.frameDt).toBeCloseTo(0.016, 6)
    expect(frame.steps).toBe(0)
  })

  it('does not let a malformed reset timestamp poison the next frame', () => {
    const time = new Time()
    time.beginFrame(100)
    time.reset(Number.NaN)

    const first = time.beginFrame(250)
    expect(first.frameDt).toBe(0)
    expect(first.steps).toBe(0)

    const recovered = time.beginFrame(266)
    expect(recovered.frameDt).toBeCloseTo(0.016, 6)
    expect(Number.isFinite(recovered.alpha)).toBe(true)
  })

  it('skips world streaming on static non-flight frames', () => {
    expect(shouldAdvanceWorld(false, 0, 0)).toBe(false)
    expect(shouldAdvanceWorld(false, 0, 0.016)).toBe(true)
    expect(shouldAdvanceWorld(true, 0, 0)).toBe(true)
  })

  it('freezes the live HUD under pause and results overlays', () => {
    expect(shouldUpdateLiveHud(false, false)).toBe(false)
    expect(shouldUpdateLiveHud(true, false)).toBe(false)
    expect(shouldUpdateLiveHud(true, true)).toBe(true)
  })

  it('gates renderer submissions while hidden or recovering a GPU context', () => {
    expect(shouldRenderFrame(false, false)).toBe(true)
    expect(shouldRenderFrame(true, false)).toBe(false)
    expect(shouldRenderFrame(false, true)).toBe(false)
    expect(shouldRenderFrame(true, true)).toBe(false)
  })

  it('pauses active flight when focus is lost without auto-resuming menus', () => {
    expect(shouldPauseForFocusLost(true, false, false)).toBe(true)
    expect(shouldPauseForFocusLost(true, true, false)).toBe(false)
    expect(shouldPauseForFocusLost(true, false, true)).toBe(false)
    expect(shouldPauseForFocusLost(false, false, false)).toBe(false)
  })

  it('pauses active flight when graphics context recovery begins', () => {
    expect(shouldPauseForContextLoss(true, false, false)).toBe(true)
    expect(shouldPauseForContextLoss(true, true, false)).toBe(false)
    expect(shouldPauseForContextLoss(true, false, true)).toBe(false)
    expect(shouldPauseForContextLoss(false, false, false)).toBe(false)
  })
})
