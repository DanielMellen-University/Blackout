import { describe, expect, it } from 'vitest'
import {
  COURSE_FAVORITES_LIMIT,
  COURSE_FAVORITES_STORAGE_KEY,
  readCourseFavoriteIds,
  toggleCourseFavorite,
  writeCourseFavoriteIds,
} from '../src/core/CourseFavorites'

describe('course favorites', () => {
  it('adds, removes, and bounds pinned course ids', () => {
    expect(toggleCourseFavorite(['storm-run', 'range-sweep'], 'daily-ops', true))
      .toEqual(['daily-ops', 'storm-run', 'range-sweep'])
    expect(toggleCourseFavorite(['storm-run', 'range-sweep'], 'storm-run', false))
      .toEqual(['range-sweep'])
    expect(toggleCourseFavorite(['a', 'b', 'c'], 'd', true, 2)).toEqual(['d', 'a'])
  })

  it('repairs malformed storage without throwing', () => {
    let value = JSON.stringify(['storm-run', 'storm-run', 12, 'bad value', 'Daily-Ops'])
    const storage = {
      getItem: (key: string): string | null => key === COURSE_FAVORITES_STORAGE_KEY ? value : null,
      setItem: (_key: string, next: string): void => { value = next },
    }
    expect(readCourseFavoriteIds(storage)).toEqual(['storm-run', 'daily-ops'])
    writeCourseFavoriteIds(storage, ['range-sweep', 'range-sweep'])
    expect(JSON.parse(value)).toEqual(['range-sweep'])
    expect(readCourseFavoriteIds(null)).toEqual([])
    expect(COURSE_FAVORITES_LIMIT).toBe(32)
  })
})
