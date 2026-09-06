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
