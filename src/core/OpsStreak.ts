import {
  dailyOpsDayKey,
  dailyOpsTimestampForDayKey,
  monthlyOpsMonthKey,
  monthlyOpsTimestampForMonthKey,
  weeklyOpsTimestampForWeekKey,
  weeklyOpsWeekKey,
  type CourseId,
} from '../systems/CourseLibrary'

export const OPS_STREAK_STORAGE_KEY = 'blackout.ops-streak'
export const MAX_OPS_STREAK = 1_000

export type OpsStreakKind = 'daily' | 'weekly' | 'monthly'

export interface OpsStreakRecord {
  lastPeriod: string
  current: number
  best: number
}

export interface OpsStreakSnapshot {
  daily: OpsStreakRecord | null
  weekly: OpsStreakRecord | null
  monthly: OpsStreakRecord | null
}

export interface OpsStreakUpdate {
  kind: OpsStreakKind
  periodKey: string
  current: number
  best: number
  advanced: boolean
  snapshot: OpsStreakSnapshot
}

interface OpsStreakStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const EMPTY_SNAPSHOT: OpsStreakSnapshot = Object.freeze({ daily: null, weekly: null, monthly: null })

/** Read a finite, repairable snapshot without letting storage block flight. */
export function readOpsStreak(storage: Pick<OpsStreakStorage, 'getItem'> | null | undefined): OpsStreakSnapshot {
  try {
    const raw = storage?.getItem(OPS_STREAK_STORAGE_KEY)
    if (!raw) return cloneSnapshot(EMPTY_SNAPSHOT)
    const parsed: unknown = JSON.parse(raw)
    return snapshotFromUnknown(parsed)
  } catch {
    return cloneSnapshot(EMPTY_SNAPSHOT)
  }
}

/** Record one successful rotating Ops period, ignoring duplicate completions. */
export function recordOpsCompletion(
  storage: OpsStreakStorage | null | undefined,
  snapshot: OpsStreakSnapshot,
  courseId: CourseId,
  periodKey: string | undefined,
): OpsStreakUpdate | null {
  const kind = opsStreakKind(courseId)
  if (!kind || !periodKey || periodTimestamp(kind, periodKey) === null) return null
  const currentRecord = snapshot[kind]
  const safeCurrent = currentRecord ? sanitizeRecord(kind, currentRecord) : null
  const timestamp = periodTimestamp(kind, periodKey)!
  // A historical replay may earn its own score, but cannot rewind today's
  // progression and break a later consecutive completion chain.
  if (safeCurrent && timestamp < periodTimestamp(kind, safeCurrent.lastPeriod)!) return {
    kind, periodKey, current: safeCurrent.current, best: safeCurrent.best,
    advanced: false, snapshot: withRecord(snapshot, kind, safeCurrent),
  }
  if (safeCurrent?.lastPeriod === periodKey) {
    return {
      kind,
      periodKey,
      current: safeCurrent.current,
      best: safeCurrent.best,
      advanced: false,
      snapshot: withRecord(snapshot, kind, safeCurrent),
    }
  }
  const previousKey = previousPeriodKey(kind, timestamp)
  const nextCurrent = safeCurrent?.lastPeriod === previousKey
    ? Math.min(MAX_OPS_STREAK, safeCurrent.current + 1)
    : 1
  const nextRecord: OpsStreakRecord = {
    lastPeriod: periodKey,
    current: nextCurrent,
    best: Math.max(safeCurrent?.best ?? 0, nextCurrent),
  }
  const nextSnapshot = withRecord(snapshot, kind, nextRecord)
  try {
    storage?.setItem(OPS_STREAK_STORAGE_KEY, JSON.stringify(nextSnapshot))
  } catch {
    /* Private browsing or quota denial should not block a completed run. */
  }
  return {
    kind,
    periodKey,
    current: nextCurrent,
    best: nextRecord.best,
    advanced: true,
    snapshot: nextSnapshot,
  }
}

/** Return the visible streak only when the card represents that exact period. */
export function opsStreakLabel(
  snapshot: OpsStreakSnapshot,
  courseId: CourseId,
  periodKey: string | undefined,
): string {
  const kind = opsStreakKind(courseId)
  const record = kind ? snapshot[kind] : null
  if (!record || !periodKey || record.lastPeriod !== periodKey || record.current < 1) return ''
  return `OPS STREAK X${record.current}`
}

/** Best streak across the three rotating Ops tracks for compact career copy. */
export function bestOpsStreak(snapshot: OpsStreakSnapshot): number {
  return Math.max(snapshot.daily?.best ?? 0, snapshot.weekly?.best ?? 0, snapshot.monthly?.best ?? 0)
}

function opsStreakKind(courseId: CourseId): OpsStreakKind | null {
  if (courseId === 'daily-ops') return 'daily'
  if (courseId === 'weekly-ops') return 'weekly'
  if (courseId === 'monthly-ops') return 'monthly'
  return null
}

function periodTimestamp(kind: OpsStreakKind, key: string): number | null {
  if (kind === 'daily') return dailyOpsTimestampForDayKey(key)
  if (kind === 'weekly') return weeklyOpsTimestampForWeekKey(key)
  return monthlyOpsTimestampForMonthKey(key)
}

function previousPeriodKey(kind: OpsStreakKind, timestamp: number): string {
  if (kind === 'daily') return dailyOpsDayKey(timestamp - 86_400_000)
  if (kind === 'weekly') return weeklyOpsWeekKey(timestamp - 7 * 86_400_000)
  const date = new Date(timestamp)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return monthlyOpsMonthKey(date.getTime())
}

function withRecord(
  snapshot: OpsStreakSnapshot,
  kind: OpsStreakKind,
  record: OpsStreakRecord,
): OpsStreakSnapshot {
  return {
    daily: kind === 'daily' ? record : cloneRecord(snapshot.daily),
    weekly: kind === 'weekly' ? record : cloneRecord(snapshot.weekly),
    monthly: kind === 'monthly' ? record : cloneRecord(snapshot.monthly),
  }
}

function snapshotFromUnknown(value: unknown): OpsStreakSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return cloneSnapshot(EMPTY_SNAPSHOT)
  const record = value as Record<string, unknown>
  return {
    daily: sanitizeRecord('daily', record.daily),
    weekly: sanitizeRecord('weekly', record.weekly),
    monthly: sanitizeRecord('monthly', record.monthly),
  }
}

function sanitizeRecord(kind: OpsStreakKind, value: unknown): OpsStreakRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const lastPeriod = typeof record.lastPeriod === 'string' ? record.lastPeriod : ''
  if (!lastPeriod || periodTimestamp(kind, lastPeriod) === null) return null
  const current = finiteStreak(record.current)
  const best = Math.max(current, finiteStreak(record.best))
  return { lastPeriod, current, best }
}

function finiteStreak(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_OPS_STREAK, Math.max(0, Math.floor(value)))
    : 0
}

function cloneRecord(record: OpsStreakRecord | null): OpsStreakRecord | null {
  return record ? { ...record } : null
}

function cloneSnapshot(snapshot: OpsStreakSnapshot): OpsStreakSnapshot {
  return {
    daily: cloneRecord(snapshot.daily),
    weekly: cloneRecord(snapshot.weekly),
    monthly: cloneRecord(snapshot.monthly),
  }
}
