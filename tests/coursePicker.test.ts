import { describe, expect, it } from 'vitest'
import { coursePickerCopy } from '../src/ui/CoursePicker'

const orbit = {
  seed: 1 as number | null,
  profile: 'orbit' as const,
  detail: 'Gentle circuit and approach practice',
}

describe('course picker copy', () => {
  it('keeps unplayed worlds on short card meta without stuffing stats into the name', () => {
    expect(coursePickerCopy({
      course: { seed: null, profile: null, detail: 'New terrain and route every time' },
      history: null,
      bestScore: 0,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    })).toEqual({
      detail: 'New terrain and route every time',
      meta: 'INFINITE',
      stats: '',
    })

    expect(coursePickerCopy({
      course: { seed: null, profile: 'free', detail: 'Explore the terrain with no checkpoint clock' },
      history: null,
      bestScore: Number.NaN,
      badgeCount: Number.POSITIVE_INFINITY,
      bestPrecisionStreak: -4,
    })).toEqual({
      detail: 'Explore the terrain with no checkpoint clock',
      meta: 'EXPLORE',
      stats: '',
    })

    expect(coursePickerCopy({
      course: orbit,
      history: null,
      bestScore: 0,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    }).meta).toBe('NEW')
  })

  it('puts mastery on the selected-world line instead of a long option label', () => {
    const copy = coursePickerCopy({
      course: orbit,
      history: {
        completionCount: 5,
        bestTimeSec: 98.4,
        contractWins: 2,
        contractStreakRecord: 4,
      },
      bestScore: 88_000,
      badgeCount: 3,
      bestPrecisionStreak: 4,
    })

    expect(copy.meta).toBe('5 RUNS · ACE')
    expect(copy.stats).toBe('5 RUNS · 1:38.40 · BEST 88,000 · STREAK X4 · CONTRACT X4 · ACE · 3/6 BADGES')
    expect(copy.detail).toBe('Gentle circuit and approach practice')
    expect(copy.stats.includes('TOP')).toBe(false)
    expect(copy.stats.includes('ROLLS')).toBe(false)
  })

  it('fails closed on malformed history instead of leaking NaN into the picker', () => {
    const copy = coursePickerCopy({
      course: orbit,
      history: {
        completionCount: Number.NaN,
        bestTimeSec: Number.POSITIVE_INFINITY,
        contractWins: Number.NaN,
      },
      bestScore: Number.NaN,
      badgeCount: Number.NaN,
      bestPrecisionStreak: Number.NaN,
    })
    expect(copy.meta).toBe('NEW')
    expect(copy.stats).toBe('')
  })
})
