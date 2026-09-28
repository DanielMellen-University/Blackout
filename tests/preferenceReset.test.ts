import { describe, expect, it } from 'vitest'
import {
  FLIGHT_PREFERENCE_STORAGE_KEYS,
  resetFlightPreferences,
} from '../src/core/PreferenceReset'

describe('flight preference reset', () => {
  it('clears settings keys while leaving unrelated progression records alone', () => {
    const values = new Map<string, string>([
      ...FLIGHT_PREFERENCE_STORAGE_KEYS.map((key) => [key, 'custom'] as const),
      ['blackout.course-best.seed:1', 'score'],
      ['blackout.course-favorites', '["training-orbit"]'],
      ['blackout.ops-streak', '{"daily":null}'],
    ])
    resetFlightPreferences({ removeItem: (key) => values.delete(key) })
    for (const key of FLIGHT_PREFERENCE_STORAGE_KEYS) expect(values.has(key)).toBe(false)
    expect(values.get('blackout.course-best.seed:1')).toBe('score')
    expect(values.get('blackout.course-favorites')).toBe('["training-orbit"]')
    expect(values.get('blackout.ops-streak')).toBe('{"daily":null}')
  })

  it('fails closed when storage removal is denied', () => {
    expect(() => resetFlightPreferences({ removeItem: () => { throw new Error('denied') } })).not.toThrow()
  })
})
