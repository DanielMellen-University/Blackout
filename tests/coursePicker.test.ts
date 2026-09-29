import { describe, expect, it } from 'vitest'
import {
  courseFlightLogLabel,
  courseConditionSummary,
  courseMasteryProgressLabel,
  coursePickerNavigationIndex,
  coursePickerCopy,
  coursePickerCategoryForCourse,
  coursePickerDifficultyForCourse,
  coursePickerCategoryLabel,
  coursePickerEmptyMessage,
  coursePickerMetaLabel,
  coursePickerSortLabel,
  courseTimePreviewLabel,
  courseWindPreviewLabel,
  courseWeatherPreviewLabel,
  filterCoursePickerItems,
  normalizeCoursePickerCategory,
  normalizeCoursePickerFilter,
  normalizeCoursePickerSort,
  readCoursePickerCategory,
  readCoursePickerSort,
  sortCoursePickerItems,
  writeCoursePickerCategory,
  writeCoursePickerSort,
} from '../src/ui/CoursePicker'

const orbit = {
  seed: 1 as number | null,
  profile: 'orbit' as const,
  detail: 'Gentle circuit and approach practice',
}

describe('course picker copy', () => {
  it('keeps keyboard navigation inside filtered results', () => {
    expect(coursePickerNavigationIndex('End', 0, 3)).toBe(2)
    expect(coursePickerNavigationIndex('Home', 2, 3)).toBe(0)
    expect(coursePickerNavigationIndex('ArrowDown', 0, 5)).toBe(2)
    expect(coursePickerNavigationIndex('ArrowDown', 2, 3)).toBe(2)
    expect(coursePickerNavigationIndex('ArrowUp', 0, 3)).toBe(0)
    expect(coursePickerNavigationIndex('PageDown', 0, 3)).toBeNull()
    expect(coursePickerNavigationIndex('End', 0, Number.NaN)).toBeNull()
  })

  it('filters the catalog by every search term while preserving authored order', () => {
    const items = [
      { id: 'storm', label: 'Storm Run', detail: 'Low visibility mountain pass', meta: 'NEW', stats: '', category: 'routes' as const, favorite: true },
      { id: 'river', label: 'River Run', detail: 'Rainy low-level water route', meta: '2 RUNS', stats: '', category: 'contracts' as const, runs: 2 },
      { id: 'night', label: 'Night Ops', detail: 'Foggy midnight pass', meta: 'NEW', stats: '', category: 'ops' as const, recent: true },
    ]
    expect(filterCoursePickerItems(items, '  RAIN  WATER ')).toEqual([items[1]])
    expect(filterCoursePickerItems(items, 'pass')).toEqual([items[0], items[2]])
    expect(filterCoursePickerItems(items, '')).toEqual(items)
    expect(filterCoursePickerItems(items, 'unknown')).toEqual([])
    expect(filterCoursePickerItems(items, '', 'contracts')).toEqual([items[1]])
    expect(filterCoursePickerItems(items, 'rain', 'routes')).toEqual([])
    expect(filterCoursePickerItems(items, '', 'recent')).toEqual([items[2]])
    expect(filterCoursePickerItems(items, '', 'favorites')).toEqual([items[0]])
    expect(filterCoursePickerItems(items, '', 'unplayed')).toEqual([items[0], items[2]])
  })

  it('keeps Recent and Favorites filters in player-defined newest-first order', () => {
    const items = [
      { id: 'authored-first', label: 'Authored First', detail: '', meta: '', stats: '', recent: true, recentRank: 2, favorite: true, favoriteRank: 1 },
      { id: 'latest', label: 'Latest', detail: '', meta: '', stats: '', recent: true, recentRank: 0, favorite: true, favoriteRank: 2 },
      { id: 'pinned', label: 'Pinned', detail: '', meta: '', stats: '', recent: true, recentRank: 1, favorite: true, favoriteRank: 0 },
    ]
    expect(filterCoursePickerItems(items, '', 'recent').map(item => item.id))
      .toEqual(['latest', 'pinned', 'authored-first'])
    expect(filterCoursePickerItems(items, '', 'favorites').map(item => item.id))
      .toEqual(['pinned', 'authored-first', 'latest'])
  })

  it('classifies the catalog into stable launch filters', () => {
    expect(coursePickerCategoryForCourse({ id: 'daily-ops', seed: null, profile: null, daily: true })).toBe('ops')
    expect(coursePickerCategoryForCourse({ id: 'weekly-ops', seed: null, profile: null, weekly: true })).toBe('ops')
    expect(coursePickerCategoryForCourse({ id: 'monthly-ops', seed: null, profile: null, monthly: true })).toBe('ops')
    expect(coursePickerCategoryForCourse({ id: 'random', seed: null, profile: null })).toBe('explore')
    expect(coursePickerCategoryForCourse({ id: 'free-flight', seed: null, profile: 'free' })).toBe('explore')
    expect(coursePickerCategoryForCourse({ id: 'training-orbit', seed: 1, profile: 'orbit' })).toBe('routes')
    expect(coursePickerCategoryForCourse({ id: 'storm-contract', seed: 34, profile: 'storm', contractCatalog: true })).toBe('contracts')
    expect(coursePickerDifficultyForCourse({ profile: 'orbit' })).toBe('relaxed')
    expect(coursePickerDifficultyForCourse({ profile: 'sweep' })).toBe('standard')
    expect(coursePickerDifficultyForCourse({ profile: 'canyon' })).toBe('technical')
  })

  it('labels catalog filters with finite counts', () => {
    expect(coursePickerCategoryLabel('all', 71)).toBe('All courses (71)')
    expect(coursePickerCategoryLabel('favorites', 2.9)).toBe('Favorites (2)')
    expect(coursePickerCategoryLabel('recent', Number.NaN)).toBe('Recent (0)')
    expect(coursePickerSortLabel('catalog')).toBe('Catalog order')
    expect(coursePickerSortLabel('score')).toBe('Best score')
    expect(coursePickerSortLabel('time')).toBe('Best time')
    expect(coursePickerSortLabel('runs')).toBe('Most runs')
    expect(coursePickerSortLabel('difficulty')).toBe('Difficulty')
    expect(coursePickerSortLabel('name')).toBe('A–Z')
  })

  it('repairs and persists the bounded catalog browsing view', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    expect(normalizeCoursePickerCategory('favorites')).toBe('favorites')
    expect(normalizeCoursePickerCategory('unplayed')).toBe('unplayed')
    expect(normalizeCoursePickerCategory('bogus')).toBe('all')
    expect(normalizeCoursePickerFilter('  storm  ')).toBe('storm')
    expect(normalizeCoursePickerFilter(null)).toBe('')
    expect(normalizeCoursePickerFilter('x'.repeat(100))).toHaveLength(80)
    expect(normalizeCoursePickerSort('score')).toBe('score')
    expect(normalizeCoursePickerSort('time')).toBe('time')
    expect(normalizeCoursePickerSort('runs')).toBe('runs')
    expect(normalizeCoursePickerSort('difficulty')).toBe('difficulty')
    expect(normalizeCoursePickerSort({})).toBe('catalog')

    writeCoursePickerCategory(storage, 'recent')
    writeCoursePickerSort(storage, 'name')
    expect(readCoursePickerCategory(storage)).toBe('recent')
    expect(readCoursePickerSort(storage)).toBe('name')
    values.set('blackout.coursePickerCategory', 'invalid')
    values.set('blackout.coursePickerSort', 'invalid')
    expect(readCoursePickerCategory(storage)).toBe('all')
    expect(readCoursePickerSort(storage)).toBe('catalog')
  })

  it('sorts filtered cards by score or name without mutating catalog order', () => {
    const items = [
      { id: 'zulu', label: 'Zulu', detail: '', meta: '', stats: '', score: 80_000 },
      { id: 'alpha', label: 'alpha', detail: '', meta: '', stats: '', score: 100_000 },
      { id: 'none', label: 'No Score', detail: '', meta: '', stats: '', score: Number.NaN },
    ]
    expect(sortCoursePickerItems(items, 'catalog').map(item => item.id)).toEqual(['zulu', 'alpha', 'none'])
    expect(sortCoursePickerItems(items, 'score').map(item => item.id)).toEqual(['alpha', 'zulu', 'none'])
    expect(sortCoursePickerItems(items, 'name').map(item => item.id)).toEqual(['alpha', 'none', 'zulu'])
    const timed = [
      { id: 'slow', label: 'Slow', detail: '', meta: '', stats: '', time: 92 },
      { id: 'fast', label: 'Fast', detail: '', meta: '', stats: '', time: 61 },
      { id: 'unflown', label: 'Unflown', detail: '', meta: '', stats: '', time: 0 },
    ]
    expect(sortCoursePickerItems(timed, 'time').map(item => item.id)).toEqual(['fast', 'slow', 'unflown'])
    const difficulty = [
      { id: 'technical', label: 'Technical', detail: '', meta: '', stats: '', difficulty: 'technical' as const },
      { id: 'relaxed', label: 'Relaxed', detail: '', meta: '', stats: '', difficulty: 'relaxed' as const },
      { id: 'standard', label: 'Standard', detail: '', meta: '', stats: '', difficulty: 'standard' as const },
    ]
    expect(sortCoursePickerItems(difficulty, 'difficulty').map(item => item.id)).toEqual(['relaxed', 'standard', 'technical'])
    const replayed = [
      { id: 'once', label: 'Once', detail: '', meta: '', stats: '', runs: 1 },
      { id: 'often', label: 'Often', detail: '', meta: '', stats: '', runs: 9 },
      { id: 'new', label: 'New', detail: '', meta: '', stats: '', runs: 0 },
      { id: 'malformed', label: 'Malformed', detail: '', meta: '', stats: '', runs: Number.NaN },
    ]
    expect(sortCoursePickerItems(replayed, 'runs').map(item => item.id)).toEqual(['often', 'once', 'new', 'malformed'])
    expect(items.map(item => item.id)).toEqual(['zulu', 'alpha', 'none'])
  })

  it('formats a bounded title-screen mastery summary', () => {
    expect(courseMasteryProgressLabel(3, 7)).toBe('LEGEND 3/7')
    expect(courseMasteryProgressLabel(99, 4)).toBe('LEGEND 4/4')
    expect(courseMasteryProgressLabel(Number.NaN, Number.POSITIVE_INFINITY)).toBe('LEGEND 0/0')
  })

  it('explains empty catalog filters and keyboard pinning', () => {
    expect(coursePickerEmptyMessage('favorites', '')).toContain('PRESS F')
    expect(coursePickerEmptyMessage('recent', '')).toBe('NO RECENT COURSES YET')
    expect(coursePickerEmptyMessage('unplayed', '')).toContain('NO UNPLAYED COURSES')
    expect(coursePickerEmptyMessage('all', '  unknown  ')).toBe('NO MATCHING COURSES')
    expect(coursePickerMetaLabel('NEW', true)).toBe('★ NEW')
    expect(coursePickerMetaLabel('', true)).toBe('★ FAVORITE')
    expect(coursePickerMetaLabel('NEW', false)).toBe('NEW')
  })
  it('exposes authored weather and night conditions before launch', () => {
    expect(courseWeatherPreviewLabel(Number.NaN, 'storm')).toBe('THUNDERSTORM')
    expect(courseTimePreviewLabel(0.84)).toBe('NIGHT')
    expect(courseTimePreviewLabel(0.5)).toBe('')
    expect(courseTimePreviewLabel(-0.16)).toBe('NIGHT')
    expect(courseWindPreviewLabel('right')).toBe('CROSSWIND R / CRAB L')
    expect(courseWindPreviewLabel('left')).toBe('CROSSWIND L / CRAB R')
    expect(courseWindPreviewLabel(undefined)).toBe('')

    const copy = coursePickerCopy({
      course: {
        seed: 11,
        profile: 'night',
        detail: 'Low-level fog run',
        weather: 'fog',
        timeOfDay: 0.84,
      },
      history: null,
      bestScore: 0,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    })
    expect(copy.detail).toBe('Low-level fog run / WEATHER LOW FOG / TIME NIGHT')
    expect(courseConditionSummary({ weather: 'fog', timeOfDay: 0.84 }))
      .toBe('WEATHER LOW FOG / TIME NIGHT')
    expect(courseConditionSummary({ weather: 'fog', timeOfDay: 0.84 }, '2026-09-28'))
      .toBe('DAY 2026-09-28 / WEATHER LOW FOG / TIME NIGHT')
    expect(courseConditionSummary({ weather: 'clear' }, 'WEEK 2026-W40'))
      .toBe('WEEK 2026-W40 / WEATHER CLEAR')
    expect(courseConditionSummary({ weather: 'clear' }, 'WEEK 2026-W99'))
      .toBe('WEATHER CLEAR')
    expect(courseConditionSummary({ weather: 'clear' }, 'MONTH 2026-09'))
      .toBe('MONTH 2026-09 / WEATHER CLEAR')
    expect(courseConditionSummary({ weather: 'clear' }, 'MONTH 2026-13'))
      .toBe('WEATHER CLEAR')
    expect(courseConditionSummary({ weather: 'fog' }, '2026-02-30'))
      .toBe('WEATHER LOW FOG')
    expect(courseConditionSummary({ weather: 'storm', timeOfDay: 0.5 }))
      .toBe('WEATHER THUNDERSTORM')
    expect(courseConditionSummary({ weather: 'storm', timeOfDay: 0.5, windSide: 'right' }))
      .toBe('WEATHER THUNDERSTORM / CROSSWIND R / CRAB L')
    expect(coursePickerCopy({
      course: {
        seed: 259,
        profile: 'storm',
        detail: 'Rain-to-storm sweep',
        weather: 'rain',
        weatherShift: 'storm',
      },
      history: null,
      bestScore: 0,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    }).detail).toBe('Rain-to-storm sweep / WEATHER RAIN FRONT / SHIFT THUNDERSTORM')
    expect(courseConditionSummary({ weather: 'rain', weatherShift: 'storm' }))
      .toBe('WEATHER RAIN FRONT / SHIFT THUNDERSTORM')
  })

  it('previews the deterministic seeded task without changing free flight copy', () => {
    const copy = coursePickerCopy({
      course: orbit,
      history: null,
      bestScore: 0,
      badgeCount: 0,
      bestPrecisionStreak: 0,
      contractLabel: 'CONTRACT RANGE RUN',
      contractDetail: 'FLY 12KM BEFORE LANDING',
    })
    expect(copy.detail).toBe('Gentle circuit and approach practice / TASK CONTRACT RANGE RUN / FLY 12KM BEFORE LANDING')
    expect(coursePickerCopy({
      course: { seed: null, profile: 'free', detail: 'Explore the terrain with no checkpoint clock' },
      history: null,
      bestScore: 0,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    }).detail).toBe('Explore the terrain with no checkpoint clock')
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
    })).toBe('LOG LAND BUTTER 95%')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      approachScore: 500,
    })).toBe('LOG APP +500')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      destinations: 3,
      biomes: 4,
      waterBodies: 3,
    })).toBe('LOG DEST X3 BIOMES X4 WATERWAYS X3')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      stuntRolls: 3,
      combo: 6,
    })).toBe('LOG ROLLS X3 COMBO X6')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      peakSpeedKts: 962,
      peakAltitudeM: 1_240,
    })).toBe('LOG TOP 962KT ALT 1,240M')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      runStreak: 4,
      contractWins: 3,
    })).toBe('LOG RUN STREAK X4 CONTRACT WINS X3')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      runStreak: 0,
      runStreakRecord: 5,
    })).toBe('LOG RUN STREAK X5')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      contractStreak: 0,
      contractStreakRecord: 4,
    })).toBe('LOG CONTRACT STREAK X4')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      fuelRemainingPercent: 72,
    })).toBe('LOG FUEL 72%')
    expect(courseFlightLogLabel({
      completionCount: 1,
      bestTimeSec: 90,
      sortieStyle: 'precision',
    })).toBe('LOG STYLE PRECISION')
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

  it('puts mastery records on the selected-world line instead of a long option label', () => {
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

    expect(copy.meta).toBe('5 RUNS')
    expect(copy.stats).toBe('1:38.40 · SCORE 88,000 · MEDAL GOLD · BADGES X3 · GATE STREAK X4')
    expect(copy.detail).toBe('Gentle circuit and approach practice')
    expect(copy.stats.includes('TASK')).toBe(false)
    expect(copy.stats).toContain('MEDAL GOLD')
    expect(copy.stats).toContain('BADGES X3')
    expect(copy.stats).toContain('GATE STREAK X4')
  })

  it('shows a finite bounded best score even when the medal tier is incomplete', () => {
    expect(coursePickerCopy({
      course: orbit,
      history: { completionCount: 1, bestTimeSec: 120 },
      bestScore: 63_999,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    }).stats).toBe('2:00.00 · SCORE 63,999 · NEXT BRONZE 64,000')
    expect(coursePickerCopy({
      course: orbit,
      history: null,
      bestScore: 999_999,
      badgeCount: 0,
      bestPrecisionStreak: 0,
    }).stats).toBe('SCORE 117,500 · MEDAL GOLD')
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
    expect(copy.meta).toBe('5 RUNS')
    expect(copy.stats).toBe('1:38.40 · SCORE 88,000 · LAND FIRM · MEDAL GOLD · BADGES X3 · GATE STREAK X4')
    expect(copy.stats).not.toContain('VETERAN')
    expect(copy.stats).not.toContain('TASK')
  })
})
