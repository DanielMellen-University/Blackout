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

const SEEDED_RANDOM_RECORD_PREFIXES = ROTATING_RECORD_PREFIXES
const SEEDED_RANDOM_RECORD_ID = /^seed:-?\d+:[a-z-]+:custom$/
export const SEEDED_RANDOM_RECORDS_STORAGE_KEY = 'blackout.seededRandomRecords'
/** Keep explicit exploration history useful without allowing one key per seed forever. */
export const SEEDED_RANDOM_RECORD_RETENTION = 12

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
  getItem?(key: string): string | null
  setItem?(key: string, value: string): void
}

interface SeededRandomRecordEntry {
  id: string
  touched: number
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

/**
 * Touch and bound one explicitly seeded random-world record family. The
 * manifest is tiny and lets us prune all score/history/ghost siblings without
 * scanning unrelated authored records or relying on localStorage timestamps.
 */
export function touchSeededRandomCourseRecord(
  storage: IndexedRecordStorage | null | undefined,
  courseId: string,
  nowMs = Date.now(),
): number {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' ||
    typeof storage.removeItem !== 'function' || !SEEDED_RANDOM_RECORD_ID.test(courseId)) return 0
  const safeNow = Number.isFinite(nowMs) ? Math.max(0, Math.floor(nowMs)) : 0
  const entries = readSeededRandomRecordEntries(storage)
  const existing = entries.find(entry => entry.id === courseId)
  if (existing) existing.touched = safeNow
  else entries.push({ id: courseId, touched: safeNow })
  entries.sort((a, b) => b.touched - a.touched || a.id.localeCompare(b.id))
  const keep = entries.slice(0, SEEDED_RANDOM_RECORD_RETENTION)
  const drop = entries.slice(SEEDED_RANDOM_RECORD_RETENTION)
  let removed = 0
  try {
    storage.setItem(SEEDED_RANDOM_RECORDS_STORAGE_KEY, JSON.stringify(keep))
  } catch {
    return 0
  }
  for (const entry of drop) {
    for (const prefix of SEEDED_RANDOM_RECORD_PREFIXES) {
      try {
        storage.removeItem(`${prefix}${entry.id}`)
        removed += 1
      } catch {
        // Storage can revoke access between the manifest write and cleanup.
      }
    }
  }
  return removed
}

function readSeededRandomRecordEntries(storage: IndexedRecordStorage): SeededRandomRecordEntry[] {
  let raw: string | null = null
  try {
    raw = storage.getItem?.(SEEDED_RANDOM_RECORDS_STORAGE_KEY) ?? null
  } catch {
    return []
  }
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const entriesById = new Map<string, SeededRandomRecordEntry>()
    for (const value of parsed) {
      if (!value || typeof value !== 'object') continue
      const candidate = value as Partial<SeededRandomRecordEntry>
      if (typeof candidate.id !== 'string' || !SEEDED_RANDOM_RECORD_ID.test(candidate.id) ||
        !Number.isFinite(candidate.touched)) continue
      const touched = Math.max(0, Math.floor(candidate.touched!))
      const existing = entriesById.get(candidate.id)
      if (!existing || touched > existing.touched) {
        entriesById.set(candidate.id, { id: candidate.id, touched })
      }
    }
    return Array.from(entriesById.values()).slice(0, SEEDED_RANDOM_RECORD_RETENTION * 4)
  } catch {
    return []
  }
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
