import { expect, it } from 'vitest'
import { COURSE_LIBRARY } from '../src/systems/CourseLibrary'
import { auditMissionGeometry } from '../scripts/lib/mission-polish'

const fixed = COURSE_LIBRARY.filter(c => c.seed !== null)
it('covers exactly the 72 migrated fixed missions', () => { expect(fixed).toHaveLength(72) })
for (const course of fixed) it.each([...new Set([42, 1337, 9001, course.seed!])])(`${course.id} seed %s has a safe spawn, clear gate disks and ordered bounded triggers`, seed => {
  const row = auditMissionGeometry(course, seed)
  expect(row.gates).toBeGreaterThanOrEqual(8)
  expect(row.gates).toBeLessThanOrEqual(20)
  expect(row.minGateClearance).toBeGreaterThan(2.5)
  expect(row.maxSlope).toBeLessThan(25)
}, 30000)
