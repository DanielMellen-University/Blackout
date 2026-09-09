import { describe, expect, it } from 'vitest'
import { sampleLandforms } from '../src/world/Landforms'
import { setWorldSeed } from '../src/world/noise'

describe('regional landform families', () => {
  it('produces ridges, alpine valleys, plateaus and volcanic calderas', () => {
    setWorldSeed(1337)
    let peak = -Infinity
    let ridge = 0
    let valley = 0
    let plateau = 0
    let caldera = 0
    let glacial = 0
    for (let x = -60000; x <= 60000; x += 600) {
      for (let z = -60000; z <= 60000; z += 600) {
        const land = sampleLandforms(x, z)
        peak = Math.max(peak, land.height)
        ridge = Math.max(ridge, land.ridge)
        valley = Math.max(valley, land.alpineValley)
        plateau = Math.max(plateau, land.plateau)
        caldera = Math.max(caldera, land.caldera)
        glacial = Math.max(glacial, land.glacial)
      }
    }
    expect(peak).toBeGreaterThan(5000)
    expect(ridge).toBeGreaterThan(.5)
    expect(valley).toBeGreaterThan(.5)
    expect(plateau).toBeGreaterThan(.5)
    expect(caldera).toBeGreaterThan(.5)
    expect(glacial).toBeGreaterThan(.35)
  })

  it('keeps green lowlands smoothly rolling instead of forming needles', () => {
    setWorldSeed(73)
    let checked = 0
    for (let x = -36000; x <= 36000; x += 720) {
      for (let z = -36000; z <= 36000; z += 720) {
        const center = sampleLandforms(x, z)
        if (center.moisture < .38 || center.highlands > .08 || center.badlands > .08 || center.volcanic > .08) continue
        const left = sampleLandforms(x - 90, z).height
        const right = sampleLandforms(x + 90, z).height
        const down = sampleLandforms(x, z - 90).height
        const up = sampleLandforms(x, z + 90).height
        // A needle has a large local second derivative. Broad hills can still
        // gain substantial elevation across the full 180 metre span.
        expect(Math.abs(left + right - center.height * 2)).toBeLessThan(60)
        expect(Math.abs(down + up - center.height * 2)).toBeLessThan(60)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(250)
  })

  it('keeps lowland provinces varied at flight scale', () => {
    setWorldSeed(1)
    let low = Infinity, high = -Infinity, checked = 0
    for (let x = -36000; x <= 36000; x += 720) for (let z = -36000; z <= 36000; z += 720) {
      const land = sampleLandforms(x, z)
      if (land.highlands > .08 || land.badlands > .08 || land.volcanic > .08) continue
      low = Math.min(low, land.height)
      high = Math.max(high, land.height)
      checked++
    }
    expect(checked).toBeGreaterThan(250)
    expect(high - low).toBeGreaterThan(420)
  })

  it('adds smooth humid karst bowls without lowland spikes', () => {
    setWorldSeed(1)
    let karst = 0
    for (let x = -36000; x <= 36000; x += 720) for (let z = -36000; z <= 36000; z += 720) {
      const center = sampleLandforms(x, z)
      if (center.karst < .45 || center.highlands > .08) continue
      karst++
      const left = sampleLandforms(x - 90, z).height
      const right = sampleLandforms(x + 90, z).height
      const down = sampleLandforms(x, z - 90).height
      const up = sampleLandforms(x, z + 90).height
      expect(Math.abs(left + right - center.height * 2)).toBeLessThan(60)
      expect(Math.abs(down + up - center.height * 2)).toBeLessThan(60)
    }
    expect(karst).toBeGreaterThan(20)
  })

  it('reaches zero landmark influence before volcanic cell borders', () => {
    setWorldSeed(1)
    for (const boundary of [-48000, -24000, 0, 24000, 48000]) {
      for (let along = -50000; along <= 50000; along += 977) {
        const xA = sampleLandforms(boundary - .01, along).height
        const xB = sampleLandforms(boundary + .01, along).height
        const zA = sampleLandforms(along, boundary - .01).height
        const zB = sampleLandforms(along, boundary + .01).height
        expect(Math.abs(xA - xB)).toBeLessThan(.5)
        expect(Math.abs(zA - zB)).toBeLessThan(.5)
      }
    }
  })
})
