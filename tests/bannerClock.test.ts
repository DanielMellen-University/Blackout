import { describe, expect, it } from 'vitest'
import {
  MAX_BANNER_DURATION_MS,
  bannerRemainingMs,
  bannerUntilFromRemaining,
} from '../src/core/BannerClock'

describe('banner pause clock', () => {
  it('captures the finite banner time that survives a pause', () => {
    expect(bannerRemainingMs(1000, 2500)).toBe(1500)
    expect(bannerRemainingMs(1000, 500)).toBe(0)
    expect(bannerRemainingMs(1000, 1000 + MAX_BANNER_DURATION_MS + 5000)).toBe(MAX_BANNER_DURATION_MS)
    expect(bannerRemainingMs(Number.NaN, 2500)).toBe(0)
    expect(bannerRemainingMs(1000, Number.NaN)).toBeNull()
    expect(bannerRemainingMs(1000, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('rebuilds a wall-clock deadline after the simulation resumes', () => {
    expect(bannerUntilFromRemaining(1000, 1500)).toBe(2500)
    expect(bannerUntilFromRemaining(1000, MAX_BANNER_DURATION_MS + 5000)).toBe(1000 + MAX_BANNER_DURATION_MS)
    expect(bannerUntilFromRemaining(1000, -5)).toBe(1000)
    expect(bannerUntilFromRemaining(1000, Number.NaN)).toBe(1000)
  })

  it('never returns a NaN deadline for a malformed clock reading', () => {
    expect(bannerUntilFromRemaining(Number.NaN, 1500)).toBe(0)
    expect(bannerUntilFromRemaining(Number.POSITIVE_INFINITY, 1500)).toBe(0)
    expect(Number.isFinite(bannerUntilFromRemaining(Number.NaN, Number.NaN))).toBe(true)
  })
})
