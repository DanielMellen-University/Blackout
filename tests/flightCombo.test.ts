import { describe, expect, it } from 'vitest'
import { FlightComboTracker, MAX_COMBO_COUNT } from '../src/systems/FlightCombo'

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
})
