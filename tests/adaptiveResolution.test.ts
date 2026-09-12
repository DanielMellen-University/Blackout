import { expect, it } from 'vitest'
import { AdaptiveResolution } from '../src/core/AdaptiveResolution'

it('reduces sustained rendering load, recovers gradually, and ignores pauses', () => {
  const quality = new AdaptiveResolution(2)
  expect(quality.ratio).toBe(1.5)
  quality.update(1000, true)
  expect(quality.ratio).toBe(1.5)
  for (let i = 0; i < 61; i++) quality.update(34, true)
  expect(quality.ratio).toBe(1.35)
  for (let i = 0; i < 125; i++) quality.update(16, true)
  expect(quality.ratio).toBeCloseTo(1.4)
  for (let i = 0; i < 1000; i++) quality.update(34, false)
  expect(quality.ratio).toBeCloseTo(1.4)
  for (let i = 0; i < 1000; i++) quality.update(34, true)
  expect(quality.ratio).toBe(.75)
})

it('applies a lower user ceiling without exceeding the device ratio', () => {
  const quality = new AdaptiveResolution(2, 1.15)
  expect(quality.maximum).toBeCloseTo(1.15)
  expect(quality.ratio).toBeCloseTo(1.15)
  quality.setCeiling(.8)
  expect(quality.maximum).toBeCloseTo(.8)
  expect(quality.ratio).toBeCloseTo(.8)
  quality.setCeiling(4)
  expect(quality.maximum).toBeCloseTo(2)
})

it('refreshes the display-density cap without jumping recovered quality upward', () => {
  const quality = new AdaptiveResolution(2)
  quality.update(34, true)
  expect(quality.setDeviceRatio(1)).toBeCloseTo(1)
  expect(quality.maximum).toBeCloseTo(1)

  quality.setDeviceRatio(3)
  expect(quality.maximum).toBeCloseTo(1.5)
  expect(quality.ratio).toBeCloseTo(1)
  quality.setDeviceRatio(Number.NaN)
  expect(quality.maximum).toBeCloseTo(1.5)
})
