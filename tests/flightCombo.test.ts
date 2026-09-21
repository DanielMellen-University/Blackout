import { describe, expect, it } from 'vitest'
import { COMBO_WARNING_SEC, COMBO_WINDOW_SEC, FlightComboTracker, MAX_COMBO_COUNT } from '../src/systems/FlightCombo'

describe('FlightComboTracker', () => {
  it('emits only the authored milestone thresholds and keeps the chain bounded', () => {
    const combo = new FlightComboTracker()
    const milestones: number[] = []
    for (let i = 0; i < MAX_COMBO_COUNT + 4; i += 1) {
      const event = combo.record(i % 2 === 0 ? 'gate' : 'stunt')!
      if (event.milestone) milestones.push(event.combo)
    }
    expect(milestones).toEqual([2, 4, 8, 12, 16])
    expect(combo.current).toBe(MAX_COMBO_COUNT)
    expect(combo.best).toBe(MAX_COMBO_COUNT)
  })

  it('breaks a chain and restarts milestone progression safely', () => {
    const combo = new FlightComboTracker()
    expect(combo.record('gate')?.milestone).toBe(false)
    expect(combo.record('stunt')?.milestone).toBe(true)
    combo.break()
    expect(combo.current).toBe(0)
    expect(combo.best).toBe(2)
    expect(combo.record('gate')?.milestone).toBe(false)
    expect(combo.record('gate')?.milestone).toBe(true)
    expect(combo.record('other' as 'gate')).toBeNull()
    expect(combo.current).toBe(2)
  })

  it('resets both current and best run state', () => {
    const combo = new FlightComboTracker()
    combo.record('gate')
    combo.record('stunt')
    combo.reset()
    expect(combo.current).toBe(0)
    expect(combo.best).toBe(0)
  })

  it('expires an idle chain after the bounded timing window', () => {
    const combo = new FlightComboTracker()
    expect(combo.remainingSeconds).toBe(0)
    combo.record('gate')
    combo.record('stunt')
    expect(combo.remainingSeconds).toBe(COMBO_WINDOW_SEC)
    combo.update(0.5)
    combo.update(0.5)
    expect(combo.remainingSeconds).toBe(COMBO_WINDOW_SEC - 1)
    combo.reset()
    combo.record('gate')
    combo.record('stunt')
    for (let i = 0; i < Math.floor(COMBO_WINDOW_SEC / 0.5) - 1; i += 1) {
      expect(combo.update(0.5)).toBe(false)
    }
    expect(combo.current).toBe(2)
    expect(combo.update(0.5)).toBe(true)
    expect(combo.current).toBe(0)
    expect(combo.best).toBe(2)
    expect(combo.update(Number.NaN)).toBe(false)
  })

  it('emits one final-window warning without repeating it every frame', () => {
    const combo = new FlightComboTracker()
    combo.record('gate')
    for (let i = 0; i < Math.floor((COMBO_WINDOW_SEC - COMBO_WARNING_SEC) / 0.5); i += 1) {
      expect(combo.update(0.5)).toBe(false)
    }
    expect(combo.remainingSeconds).toBe(COMBO_WARNING_SEC)
    expect(combo.consumeExpiryWarning()).toBe(true)
    expect(combo.consumeExpiryWarning()).toBe(false)
  })
})
