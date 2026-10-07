import { describe, expect, it } from 'vitest'
import { CourseSession, launchNeedsNewWorld } from '../src/core/CourseSession'
import { courseDefinitionForId, courseRunId, resolveCourseDefinition, type CourseId } from '../src/systems/CourseLibrary'
import { ChallengeRun, readCourseHistory } from '../src/systems/ChallengeRun'
import { readOpsStreak, recordOpsCompletion } from '../src/core/OpsStreak'
import { worldSeedReplayUrl } from '../src/core/WorldSeed'

const utc = (value: string): number => Date.parse(`${value}Z`)
function captureOps(session: CourseSession, id: CourseId) {
  const course = resolveCourseDefinition(courseDefinitionForId(id), session.timestampFor(id))
  return session.capture(id, course.seed!, course.profile!)
}

describe('course session lifetime', () => {
  it('files completions, retries and replay links under the original sortie after rollover and menu changes', () => {
    const session = new CourseSession(utc('2026-10-06T23:59:59'))
    const active = captureOps(session, 'daily-ops')
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    session.refresh(utc('2026-10-07T00:00:00'))
    const nextSelection = session.capture('training-orbit', 1, 'orbit')
    const nextDaily = captureOps(session, 'daily-ops')
    for (let retry = 0; retry < 2; retry++) {
      run.reset(active.recordId, 1, 'balanced', active.course.seed!, active.course.contractCatalog)
      run.update(1, 30)
      run.recordGate(1)
      const result = run.finishLanding({ verticalSpeed: -1, groundSpeed: 20, pitchRad: 0, rollRad: 0 })!
      expect(result.courseId).toBe(active.recordId)
    }
    expect(readCourseHistory(storage, active.recordId)?.completionCount).toBe(2)
    expect(readCourseHistory(storage, nextDaily.recordId)).toBeNull()
    expect(readCourseHistory(storage, nextSelection.recordId)).toBeNull()
    const update = recordOpsCompletion(storage, readOpsStreak(storage), active.course.id, active.periodKey)!
    expect(update.snapshot.daily?.lastPeriod).toBe('2026-10-06')
    const link = new URL(worldSeedReplayUrl('https://game.test/', active.course.seed!, active.course.id, active.periodKey)!)
    expect(link.searchParams.get('course')).toBe('daily-ops')
    expect(link.searchParams.get('day')).toBe('2026-10-06')
  })

  it.each([
    ['daily-ops', '2026-09-30T23:59:59', '2026-10-01T00:00:00', '2026-09-30', '2026-10-01'],
    ['weekly-ops', '2026-10-04T23:59:59', '2026-10-05T00:00:00', '2026-W40', '2026-W41'],
    ['weekly-ops', '2027-01-03T23:59:59', '2027-01-04T00:00:00', '2026-W53', '2027-W01'],
    ['monthly-ops', '2026-12-31T23:59:59', '2027-01-01T00:00:00', '2026-12', '2027-01'],
  ] as const)('refreshes %s without changing the captured flight', (id, before, after, oldKey, newKey) => {
    const session = new CourseSession(utc(before))
    const active = captureOps(session, id)
    const original = JSON.stringify(active)
    expect(active.periodKey).toBe(oldKey)
    expect(session.refresh(utc(after))).toBe(true)
    const next = captureOps(session, id)
    expect(next.periodKey).toBe(newKey)
    expect(next.recordId).not.toBe(active.recordId)
    expect(next.recordId).toBe(courseRunId(courseDefinitionForId(id), utc(after)))
    expect(JSON.stringify(active)).toBe(original)
    expect(Object.isFrozen(active)).toBe(true)
    expect(Object.isFrozen(active.course)).toBe(true)
  })

  it('does not rotate weekly or monthly identities at an ordinary daily boundary', () => {
    const session = new CourseSession(utc('2026-10-06T23:59:59'))
    const week = captureOps(session, 'weekly-ops')
    const month = captureOps(session, 'monthly-ops')
    session.refresh(utc('2026-10-07T00:00:00'))
    expect(captureOps(session, 'weekly-ops')).toEqual(week)
    expect(captureOps(session, 'monthly-ops')).toEqual(month)
  })

  it('pins only the explicitly replayed mode and releases it immediately on selection', () => {
    const now = utc('2026-10-06T15:00:00')
    const pin = { courseId: 'daily-ops' as const, timestamp: utc('2025-01-01T12:00:00') }
    const session = new CourseSession(now, pin)
    pin.timestamp = now // Caller mutation cannot silently move the replay.
    const active = captureOps(session, 'daily-ops')
    expect(active.periodKey).toBe('2025-01-01')
    expect(session.replayRecordId).toBe(active.recordId)
    expect(captureOps(session, 'weekly-ops').periodKey).toBe('2026-W41')
    expect(captureOps(session, 'monthly-ops').periodKey).toBe('2026-10')
    session.refresh(utc('2026-10-07T12:00:00'))
    expect(captureOps(session, 'daily-ops')).toEqual(active)
    expect(session.leaveReplay()).toBe(true)
    expect(session.replayRecordId).toBeNull()
    expect(session.leaveReplay()).toBe(false)
    expect(captureOps(session, 'daily-ops').periodKey).toBe('2026-10-07')
    expect(active.periodKey).toBe('2025-01-01')
  })

  it.each([NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE])('rejects invalid clock %s', bad => {
    const now = utc('2026-10-06T12:00:00')
    const session = new CourseSession(now)
    expect(session.refresh(bad)).toBe(false)
    expect(session.timestampFor('daily-ops')).toBe(now)
    const fallback = new CourseSession(bad, { courseId: 'daily-ops', timestamp: bad })
    expect(captureOps(fallback, 'daily-ops').periodKey).toBe('2025-01-01')
    expect(fallback.replayRecordId).toBeNull()
  })

  it('ignores same-day checks and backwards clock jumps', () => {
    const now = utc('2026-10-06T12:00:00')
    const session = new CourseSession(now)
    expect(session.refresh(utc('2026-10-06T23:00:00'))).toBe(false)
    expect(session.refresh(utc('2026-10-05T23:00:00'))).toBe(false)
    expect(session.timestampFor('daily-ops')).toBe(now)
  })

  it('preserves authored, custom random, bounded random and free-flight identities', () => {
    const session = new CourseSession(utc('2026-10-06T12:00:00'))
    expect(session.capture('training-orbit', 1, 'orbit').recordId).toBe('seed:1:orbit')
    expect(session.capture('clean-circuit-run', 9, 'desert').recordId).toBe('seed:9:desert:clean-circuit')
    expect(session.capture('random', 99, 'ridge', true).recordId).toBe('seed:99:ridge:custom')
    expect(session.capture('random', 99, 'ridge').recordId).toBe(session.capture('random', 100, 'orbit').recordId)
    expect(session.capture('free-flight', 99, 'free').recordId).toBe('free-flight')
    expect(session.capture('training-orbit', 1, 'orbit').periodKey).toBeUndefined()
  })

  it('launches a changed selection against a new world without mutating the resident sortie', () => {
    const session = new CourseSession(utc('2026-10-06T12:00:00'))
    const active = session.capture('training-orbit', 1, 'orbit')
    expect(launchNeedsNewWorld(false, 'training-orbit', active, null)).toBe(false)
    expect(launchNeedsNewWorld(false, 'random', active, null)).toBe(true)
    expect(launchNeedsNewWorld(false, 'training-orbit', active, 42)).toBe(true)
    expect(launchNeedsNewWorld(true, 'training-orbit', active, null)).toBe(true)
    // Failed reseeds and retries retain this snapshot; only a successful build
    // is captured, matching the actual world rather than the menu selection.
    expect(active.course.id).toBe('training-orbit')
    expect(active.recordId).toBe('seed:1:orbit')
  })
})
