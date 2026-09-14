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
    for (let seed = 0; seed < 64; seed += 1) {
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
      const score = tracker.finish(0, 1)
      expect(tracker.complete).toBe(true)
      expect(tracker.progress).toBe(1)
      expect(score).toBe(MAX_CONTRACT_SCORE)
    }
    expect(kinds).toEqual(new Set(['pace', 'altitude', 'stunt', 'scout', 'fuel', 'low-level', 'biome', 'speed-band']))
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
