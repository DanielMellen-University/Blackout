import { describe, expect, it } from 'vitest'
import {
  OPS_STREAK_STORAGE_KEY,
  bestOpsStreak,
  opsStreakLabel,
  readOpsStreak,
  recordOpsCompletion,
  type OpsStreakSnapshot,
} from '../src/core/OpsStreak'

function storageFixture(initial: string | null = null): Storage {
  let value = initial
  return {
    get length() { return value === null ? 0 : 1 },
    clear() { value = null },
    getItem(key: string) { return key === OPS_STREAK_STORAGE_KEY ? value : null },
    key() { return null },
    removeItem(key: string) { if (key === OPS_STREAK_STORAGE_KEY) value = null },
    setItem(key: string, next: string) { if (key === OPS_STREAK_STORAGE_KEY) value = next },
  }
}

function throwingStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  return {
    getItem() { throw new Error('storage denied') },
    setItem() { throw new Error('storage denied') },
  }
}

describe('Ops streaks', () => {
  it('advances once per daily period, resets gaps, and keeps the best', () => {
    const storage = storageFixture()
    let snapshot = readOpsStreak(storage)

    const first = recordOpsCompletion(storage, snapshot, 'daily-ops', '2026-01-01')
    expect(first?.current).toBe(1)
    expect(first?.advanced).toBe(true)
    snapshot = first!.snapshot

    const duplicate = recordOpsCompletion(storage, snapshot, 'daily-ops', '2026-01-01')
    expect(duplicate?.current).toBe(1)
    expect(duplicate?.advanced).toBe(false)
    snapshot = duplicate!.snapshot

    const next = recordOpsCompletion(storage, snapshot, 'daily-ops', '2026-01-02')
    expect(next?.current).toBe(2)
    snapshot = next!.snapshot

    const gap = recordOpsCompletion(storage, snapshot, 'daily-ops', '2026-01-04')
    expect(gap?.current).toBe(1)
    expect(gap?.best).toBe(2)
    expect(opsStreakLabel(gap!.snapshot, 'daily-ops', '2026-01-04')).toBe('OPS STREAK X1')
    expect(bestOpsStreak(gap!.snapshot)).toBe(2)
    expect(JSON.parse(storage.getItem(OPS_STREAK_STORAGE_KEY)!).daily.lastPeriod).toBe('2026-01-04')
  })

  it('tracks weekly and monthly periods independently and rejects authored courses', () => {
    const storage = storageFixture()
    let snapshot: OpsStreakSnapshot = readOpsStreak(storage)
    const weekly = recordOpsCompletion(storage, snapshot, 'weekly-ops', '2026-W01')
    expect(weekly?.kind).toBe('weekly')
    snapshot = weekly!.snapshot
    const monthly = recordOpsCompletion(storage, snapshot, 'monthly-ops', '2026-01')
    expect(monthly?.kind).toBe('monthly')
    snapshot = monthly!.snapshot

    expect(opsStreakLabel(snapshot, 'weekly-ops', '2026-W01')).toBe('OPS STREAK X1')
    expect(opsStreakLabel(snapshot, 'monthly-ops', '2026-01')).toBe('OPS STREAK X1')
    expect(recordOpsCompletion(storage, snapshot, 'training-orbit', '2026-01-01')).toBeNull()
    expect(recordOpsCompletion(storage, snapshot, 'daily-ops', 'not-a-day')).toBeNull()
    expect(bestOpsStreak(snapshot)).toBe(1)
  })

  it('repairs malformed snapshots and fails closed when storage is denied', () => {
    const malformed = storageFixture('{"daily":{"lastPeriod":"bad","current":99},"weekly":null}')
    expect(readOpsStreak(malformed)).toEqual({ daily: null, weekly: null, monthly: null })
    const denied = throwingStorage()
    expect(readOpsStreak(denied)).toEqual({ daily: null, weekly: null, monthly: null })
    const update = recordOpsCompletion(denied, { daily: null, weekly: null, monthly: null }, 'daily-ops', '2026-02-01')
    expect(update?.current).toBe(1)
  })
})
