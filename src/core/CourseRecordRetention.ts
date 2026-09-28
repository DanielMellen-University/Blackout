import {
  dailyOpsTimestampForDayKey,
  monthlyOpsTimestampForMonthKey,
  weeklyOpsTimestampForWeekKey,
} from '../systems/CourseLibrary'

/** The rotating records that can grow as UTC challenge periods advance. */
const ROTATING_RECORD_PREFIXES = [
  'blackout.best.',
  'blackout.streak.',
  'blackout.history.',
  'blackout.badges.',
  'blackout.trace.',
  'blackout.ghost.',
] as const

/** Keep enough history for recent comparisons without letting localStorage grow forever. */
export const ROTATING_RECORD_RETENTION = {
  daily: 14,
  weekly: 8,
  monthly: 6,
} as const

export type RotatingRecordPeriod = keyof typeof ROTATING_RECORD_RETENTION

export interface IndexedRecordStorage {
  readonly length?: number
  key?(index: number): string | null
  removeItem?(key: string): void
}

/**
 * Remove only stale, period-scoped Ops records. Authored and random-course
 * records have no rotating suffix and are never touched.
 */
export function pruneRotatingCourseRecords(
  storage: IndexedRecordStorage | null | undefined,
): number {
  if (!storage || typeof storage.key !== 'function' || typeof storage.removeItem !== 'function') return 0
  const length = Number.isFinite(storage.length) ? Math.max(0, Math.floor(storage.length!)) : 0
  if (length === 0) return 0

  const keys: string[] = []
  for (let index = 0; index < length; index += 1) {
    try {
      const key = storage.key(index)
      if (typeof key === 'string' && key.length > 0) keys.push(key)
    } catch {
      return 0
    }
  }

  const groups = new Map<RotatingRecordPeriod, Map<string, { timestamp: number; keys: string[] }>>()
  const removeNow = (key: string): boolean => {
    try {
      storage.removeItem?.(key)
      return true
    } catch {
      return false
    }
  }
  let removed = 0

  for (const key of keys) {
    if (!ROTATING_RECORD_PREFIXES.some(prefix => key.startsWith(prefix))) continue
    const period = rotatingPeriodFromKey(key)
    if (!period) continue
    const timestamp = periodTimestamp(period.kind, period.key)
    if (timestamp === null) {
      if (removeNow(key)) removed += 1
      continue
    }
    let byPeriod = groups.get(period.kind)
    if (!byPeriod) {
      byPeriod = new Map()
      groups.set(period.kind, byPeriod)
    }
    const entry = byPeriod.get(period.key)
    if (entry) entry.keys.push(key)
    else byPeriod.set(period.key, { timestamp, keys: [key] })
  }

  for (const [kind, byPeriod] of groups) {
    const periods = Array.from(byPeriod.values())
      .sort((a, b) => b.timestamp - a.timestamp)
    const keep = ROTATING_RECORD_RETENTION[kind]
    for (const period of periods.slice(keep)) {
      for (const key of period.keys) {
        if (removeNow(key)) removed += 1
      }
    }
  }
  return removed
}

function rotatingPeriodFromKey(key: string): { kind: RotatingRecordPeriod; key: string } | null {
  const match = /:(daily|weekly|monthly):([^:]+)$/.exec(key)
  if (!match) return null
  const kind = match[1]
  if (kind !== 'daily' && kind !== 'weekly' && kind !== 'monthly') return null
  return { kind, key: match[2]! }
}

function periodTimestamp(kind: RotatingRecordPeriod, key: string): number | null {
  if (kind === 'daily') return dailyOpsTimestampForDayKey(key)
  if (kind === 'weekly') return weeklyOpsTimestampForWeekKey(key)
  return monthlyOpsTimestampForMonthKey(key)
}
