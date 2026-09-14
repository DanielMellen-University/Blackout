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
      const score = tracker.finish(0, 1)
      expect(tracker.complete).toBe(true)
      expect(tracker.progress).toBe(1)
      expect(score).toBe(MAX_CONTRACT_SCORE)
    }
    expect(kinds).toEqual(new Set(['pace', 'altitude', 'stunt', 'scout', 'fuel']))
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
