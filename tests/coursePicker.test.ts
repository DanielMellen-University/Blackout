import { describe, expect, it } from 'vitest'
import { courseFlightLogLabel, courseMasteryProgressLabel, coursePickerCopy } from '../src/ui/CoursePicker'

const orbit = {
  seed: 1 as number | null,
  profile: 'orbit' as const,
  detail: 'Gentle circuit and approach practice',
}

describe('course picker copy', () => {
  it('formats a bounded title-screen mastery summary', () => {
    expect(courseMasteryProgressLabel(3, 7)).toBe('LEGEND 3/7')
    expect(courseMasteryProgressLabel(99, 4)).toBe('LEGEND 4/4')
    expect(courseMasteryProgressLabel(Number.NaN, Number.POSITIVE_INFINITY)).toBe('LEGEND 0/0')
  })
  it('previews persistent flight-log records when a course has them', () => {
    expect(courseFlightLogLabel({
      completionCount: 4,
      bestTimeSec: 88,
      flightDistanceM: 12_450,
      peakPositiveG: 6.25,
      peakNegativeG: -1.75,
    })).toBe('LOG 12KM G+6.3 G-1.8')
    expect(courseFlightLogLabel({ completionCount: 1, bestTimeSec: 90 })).toBe('')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      landingQuality: 0.95,
    })).toBe('LOG LAND BUTTER')
  })

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
    expect(copy.stats).toBe('5 RUNS · 1:38.40 · BEST 88,000 · STREAK X4 · CONTRACT X4 · ACE · NEXT LEGEND · 3/6 BADGES · TASK FUEL SAVER / LAND WITH 75% FUEL · WX SNOW SHOWERS')
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
    expect(copy.stats).toBe('TASK FUEL SAVER / LAND WITH 75% FUEL · WX SNOW SHOWERS')
  })

  it('lets a rough saved touchdown lower the displayed mastery tier', () => {
    const copy = coursePickerCopy({
      course: orbit,
      history: {
        completionCount: 5,
        bestTimeSec: 98.4,
        contractWins: 2,
        contractStreakRecord: 4,
        landingQuality: 0.7,
      },
      bestScore: 88_000,
      badgeCount: 3,
      bestPrecisionStreak: 4,
    })
    expect(copy.meta).toBe('5 RUNS · VETERAN')
    expect(copy.stats).toContain('VETERAN')
  })
})
