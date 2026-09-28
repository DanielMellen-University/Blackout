import { describe, expect, it } from 'vitest'
import {
  COURSE_RECENTS_LIMIT,
  COURSE_RECENTS_STORAGE_KEY,
  readRecentCourseIds,
  rememberCourseId,
  writeRecentCourseIds,
} from '../src/core/CourseRecents'

describe('course recents', () => {
  it('moves a selected course to the front and bounds duplicates', () => {
    expect(rememberCourseId(['range-sweep', 'storm-run', 'range-sweep'], 'storm-run', 4))
      .toEqual(['storm-run', 'range-sweep'])
    expect(rememberCourseId(['A', 'bad value', 'B'], '', 4)).toEqual(['a', 'b'])
    expect(rememberCourseId([], 'daily-ops', 0)).toEqual(['daily-ops'])
  })

  it('repairs malformed storage without throwing', () => {
    let value = JSON.stringify(['storm-run', 'storm-run', 42, 'bad value', 'Daily-Ops'])
    const storage = {
      getItem: (key: string): string | null => key === COURSE_RECENTS_STORAGE_KEY ? value : null,
      setItem: (_key: string, next: string): void => { value = next },
    }
    expect(readRecentCourseIds(storage)).toEqual(['storm-run', 'daily-ops'])
    writeRecentCourseIds(storage, ['range-sweep', 'range-sweep'])
    expect(JSON.parse(value)).toEqual(['range-sweep'])
    expect(readRecentCourseIds(null)).toEqual([])
    expect(COURSE_RECENTS_LIMIT).toBe(8)
  })
})
