import { describe, expect, it } from 'vitest'
import {
  MAX_CONTRACT_SCORE,
  SortieContractTracker,
  type SortieContractKind,
} from '../src/systems/SortieContract'

describe('sortie contracts', () => {
  it('assigns a deterministic contract without allocating runtime state', () => {
    const first = new SortieContractTracker()
    const second = new SortieContractTracker()
    first.reset(42, 5)
    second.reset(42, 5)
    expect(first.enabled).toBe(true)
    expect(first.kind).toBe(second.kind)
    expect(first.label).toBe(second.label)
    expect(first.detail).toBe(second.detail)
    expect(first.progress).toBe(0)
    expect(first.complete).toBe(false)

    const disabled = new SortieContractTracker()
    disabled.reset(undefined, 5)
    expect(disabled.enabled).toBe(false)
    expect(disabled.hudLabel).toBe('')
    expect(disabled.finish(0, 1)).toBe(0)
  })

  it('covers every contract kind with bounded event and touchdown completion', () => {
    const kinds = new Set<SortieContractKind>()
    for (let seed = 0; seed < 512; seed += 1) {
      const tracker = new SortieContractTracker()
      tracker.reset(seed, 5)
      if (!tracker.kind) continue
      kinds.add(tracker.kind)
      if (tracker.kind === 'altitude') tracker.recordAltitude(99_999)
      if (tracker.kind === 'stunt') tracker.recordStunt(99)
      if (tracker.kind === 'scout') tracker.recordDestination(99)
      if (tracker.kind === 'low-level') {
        tracker.recordLowLevel(180, 5)
        tracker.recordLowLevel(180, 5)
      }
      if (tracker.kind === 'biome') tracker.recordBiome(99)
      if (tracker.kind === 'speed-band') {
        tracker.recordSpeedBand(220, 5)
        tracker.recordSpeedBand(220, 5)
        tracker.recordSpeedBand(220, 5)
      }
      if (tracker.kind === 'weather') {
        tracker.recordWeather(0.5, 0, 5)
        tracker.recordWeather(0, 0.7, 5)
        tracker.recordWeather(0.6, 0, 5)
      }
      if (tracker.kind === 'water') {
        tracker.recordWater(true, 5, false)
        tracker.recordWater(false, 5)
        tracker.recordWater(true, 5)
        tracker.recordWater(true, 5)
        tracker.recordWater(true, 5)
      }
      if (tracker.kind === 'brake') {
        tracker.recordBrake(240, 5, false)
        tracker.recordBrake(120, 5, true)
        tracker.recordBrake(240, 5, true)
      }
      if (tracker.kind === 'heat') {
        tracker.recordHeat(0.5, 220, 5, false)
        tracker.recordHeat(0.9, 220, 5)
        tracker.recordHeat(0.5, 120, 5)
        tracker.recordHeat(0.5, 220, 5)
        tracker.recordHeat(0.5, 220, 5)
        tracker.recordHeat(0.5, 220, 5)
      }
      if (tracker.kind === 'crosswind') {
        tracker.recordCrosswind(12, 5, false)
        tracker.recordCrosswind(4, 5)
        tracker.recordCrosswind(12, 5)
        tracker.recordCrosswind(12, 5)
      }
      if (tracker.kind === 'g-control') {
        tracker.recordGControl(2, 180, 5, false)
        tracker.recordGControl(5, 180, 5)
        tracker.recordGControl(2, 90, 5)
        tracker.recordGControl(2, 180, 5)
        tracker.recordGControl(2, 180, 5)
        tracker.recordGControl(2, 180, 5)
      }
      const score = tracker.finish(0, 1, tracker.kind === 'approach' ? 500 : 0)
      expect(tracker.complete).toBe(true)
      expect(tracker.progress).toBe(1)
      expect(score).toBe(MAX_CONTRACT_SCORE)
    }
    expect(kinds).toEqual(new Set(['pace', 'altitude', 'stunt', 'scout', 'fuel', 'low-level', 'biome', 'speed-band', 'weather', 'approach', 'water', 'brake', 'heat', 'crosswind', 'g-control']))
  })

  it('accumulates only airborne time inside the terrain-hugger band', () => {
    const tracker = new SortieContractTracker()
    tracker.reset(11, 5)
    expect(tracker.kind).toBe('low-level')
    tracker.recordLowLevel(18, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordLowLevel(180, 4, false)
    expect(tracker.progress).toBe(0)
    tracker.recordLowLevel(180, 4)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordLowLevel(480, 10)
    expect(tracker.complete).toBe(false)
    tracker.recordLowLevel(180, 5)
    tracker.recordLowLevel(180, 1)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('turns distinct biome progress into a bounded biome-tour reward', () => {
    const tracker = new SortieContractTracker()
    tracker.reset(8, 5)
    expect(tracker.kind).toBe('biome')
    tracker.recordBiome(1)
    expect(tracker.progress).toBeCloseTo(0.25)
    tracker.recordBiome(3)
    expect(tracker.complete).toBe(false)
    tracker.recordBiome(4)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time inside the energy speed band', () => {
    const tracker = new SortieContractTracker()
    let speedBandSeed = -1
    for (let seed = 0; seed < 256; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'speed-band') {
        speedBandSeed = seed
        break
      }
    }
    expect(speedBandSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(speedBandSeed, 5)
    tracker.recordSpeedBand(220, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordSpeedBand(120, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordSpeedBand(220, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordSpeedBand(220, 5)
    tracker.recordSpeedBand(220, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time during meaningful precipitation', () => {
    const tracker = new SortieContractTracker()
    let weatherSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'weather') {
        weatherSeed = seed
        break
      }
    }
    expect(weatherSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(weatherSeed, 5)
    tracker.recordWeather(0.8, 0, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordWeather(0.1, 0.1, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordWeather(0.35, 0, 4)
    expect(tracker.progress).toBeCloseTo(4 / 14)
    tracker.recordWeather(0, 0.8, 5)
    tracker.recordWeather(0.8, 0, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time over rendered water', () => {
    const tracker = new SortieContractTracker()
    let waterSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'water') {
        waterSeed = seed
        break
      }
    }
    expect(waterSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(waterSeed, 5)
    tracker.recordWater(true, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordWater(false, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordWater(true, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordWater(true, 5)
    tracker.recordWater(true, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('turns centered touchdown quality into a precision-approach contract', () => {
    const tracker = new SortieContractTracker()
    let approachSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'approach') {
        approachSeed = seed
        break
      }
    }
    expect(approachSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(approachSeed, 5)
    expect(tracker.label).toBe('PRECISION APPROACH')
    expect(tracker.detail).toBe('LAND CENTERED AND ALIGNED')
    expect(tracker.finish(99, 1, 359)).toBe(0)
    expect(tracker.complete).toBe(false)
    expect(tracker.progress).toBeCloseTo(359 / 360)
    expect(tracker.finish(99, 1, 500)).toBe(MAX_CONTRACT_SCORE)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
  })

  it('accumulates only high-speed airborne time with the speed brake open', () => {
    const tracker = new SortieContractTracker()
    let brakeSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'brake') {
        brakeSeed = seed
        break
      }
    }
    expect(brakeSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(brakeSeed, 5)
    tracker.recordBrake(240, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordBrake(120, 5, true)
    expect(tracker.progress).toBe(0)
    tracker.recordBrake(240, 2, true, false)
    expect(tracker.progress).toBe(0)
    tracker.recordBrake(240, 2, true)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordBrake(240, 3, true)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only controlled engine heat at cruise speed', () => {
    const tracker = new SortieContractTracker()
    let heatSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'heat') {
        heatSeed = seed
        break
      }
    }
    expect(heatSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(heatSeed, 5)
    tracker.recordHeat(0.5, 220, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordHeat(0.9, 220, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordHeat(0.5, 120, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordHeat(0.5, 220, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordHeat(0.5, 220, 5)
    tracker.recordHeat(0.5, 220, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time through meaningful crosswind', () => {
    const tracker = new SortieContractTracker()
    let crosswindSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'crosswind') {
        crosswindSeed = seed
        break
      }
    }
    expect(crosswindSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(crosswindSeed, 5)
    expect(tracker.label).toBe('CROSSWIND')
    tracker.recordCrosswind(12, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordCrosswind(8, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordCrosswind(12, 4)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordCrosswind(12, 5)
    tracker.recordCrosswind(12, 1)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only high-speed time inside the G-control envelope', () => {
    const tracker = new SortieContractTracker()
    let gControlSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'g-control') {
        gControlSeed = seed
        break
      }
    }
    expect(gControlSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(gControlSeed, 5)
    expect(tracker.label).toBe('G CONTROL')
    tracker.recordGControl(2, 180, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordGControl(5, 180, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordGControl(2, 90, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordGControl(2, 180, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordGControl(2, 180, 5)
    tracker.recordGControl(2, 180, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    tracker.finish(99, 0)
    expect(tracker.complete).toBe(true)
  })

  it('does not award incomplete contracts and keeps malformed telemetry finite', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const tracker = new SortieContractTracker()
      tracker.reset(seed, 5)
      expect(tracker.finish(Number.NaN, Number.NaN)).toBe(0)
      expect(tracker.complete).toBe(false)
      expect(Number.isFinite(tracker.progress)).toBe(true)
      expect(tracker.progress).toBeGreaterThanOrEqual(0)
      expect(tracker.progress).toBeLessThanOrEqual(1)
    }
  })
})
