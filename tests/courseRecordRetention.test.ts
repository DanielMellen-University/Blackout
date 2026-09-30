import { describe, expect, it } from 'vitest'
import {
  pruneRotatingCourseRecords,
  ROTATING_RECORD_RETENTION,
  SEEDED_RANDOM_RECORD_RETENTION,
  SEEDED_RANDOM_RECORDS_STORAGE_KEY,
  touchSeededRandomCourseRecord,
  type IndexedRecordStorage,
} from '../src/core/CourseRecordRetention'

function storageFixture(values: readonly string[]): IndexedRecordStorage & { values: Map<string, string> } {
  const data = new Map(values.map((key) => [key, 'record']))
  return {
    values: data,
    get length() {
      return data.size
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => data.delete(key),
  }
}

describe('rotating course record retention', () => {
  it('keeps recent periods, removes stale rotating records, and preserves authored records', () => {
    const daily = Array.from({ length: ROTATING_RECORD_RETENTION.daily + 2 }, (_, index) =>
      `blackout.history.seed:${index}:sweep:daily:2026-01-${String(index + 1).padStart(2, '0')}`)
    const weekly = Array.from({ length: ROTATING_RECORD_RETENTION.weekly + 2 }, (_, index) =>
      `blackout.ghost.seed:${index}:ridge:weekly:2026-W${String(index + 1).padStart(2, '0')}`)
    const monthly = Array.from({ length: ROTATING_RECORD_RETENTION.monthly + 2 }, (_, index) =>
      `blackout.best.seed:${index}:alpine:monthly:2026-${String(index + 1).padStart(2, '0')}`)
    const malformed = 'blackout.badges.seed:broken:ridge:daily:2026-02-30'
    const authored = 'blackout.history.seed:12:ridge'
    const storage = storageFixture([...daily, ...weekly, ...monthly, malformed, authored])

    const removed = pruneRotatingCourseRecords(storage)

    expect(removed).toBe(7)
    expect(storage.values.has(authored)).toBe(true)
    expect(storage.values.has(malformed)).toBe(false)
    expect(storage.values.has(daily[0]!)).toBe(false)
    expect(storage.values.has(daily.at(-1)!)).toBe(true)
    expect(storage.values.has(weekly[0]!)).toBe(false)
    expect(storage.values.has(weekly.at(-1)!)).toBe(true)
    expect(storage.values.has(monthly[0]!)).toBe(false)
    expect(storage.values.has(monthly.at(-1)!)).toBe(true)
  })

  it('fails closed when indexed storage operations are unavailable', () => {
    expect(pruneRotatingCourseRecords(null)).toBe(0)
    expect(pruneRotatingCourseRecords({ length: 1 })).toBe(0)
    expect(pruneRotatingCourseRecords({ length: 1, key: () => 'blackout.history.seed:1:sweep:daily:2026-01-01' })).toBe(0)
  })

  it('bounds explicit seeded-world families while preserving the newest records', () => {
    const data = new Map<string, string>()
    const storage: IndexedRecordStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    }
    for (let index = 0; index < SEEDED_RANDOM_RECORD_RETENTION + 2; index += 1) {
      const id = `seed:${index}:orbit:custom`
      data.set(`blackout.history.${id}`, 'history')
      data.set(`blackout.ghost.${id}`, 'ghost')
      touchSeededRandomCourseRecord(storage, id, index + 1)
    }
    const newest = `seed:${SEEDED_RANDOM_RECORD_RETENTION + 1}:orbit:custom`
    const oldest = 'seed:0:orbit:custom'
    expect(data.has(`blackout.history.${newest}`)).toBe(true)
    expect(data.has(`blackout.ghost.${newest}`)).toBe(true)
    expect(data.has(`blackout.history.${oldest}`)).toBe(false)
    expect(data.has(`blackout.ghost.${oldest}`)).toBe(false)
    const manifest = JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY) ?? '[]') as unknown[]
    expect(manifest).toHaveLength(SEEDED_RANDOM_RECORD_RETENTION)
  })

  it('deduplicates malformed seeded-world manifests using the newest touch', () => {
    const data = new Map<string, string>()
    const duplicateId = 'seed:4:orbit:custom'
    const storage: IndexedRecordStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    }
    data.set(SEEDED_RANDOM_RECORDS_STORAGE_KEY, JSON.stringify([
      { id: duplicateId, touched: 1 },
      { id: duplicateId, touched: 9 },
      { id: 'seed:2:ridge:custom', touched: 8 },
      { id: 'not-a-seed', touched: 99 },
    ]))

    touchSeededRandomCourseRecord(storage, 'seed:99:orbit:custom', 10)

    const manifest = JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY) ?? '[]') as Array<{ id: string; touched: number }>
    expect(manifest.filter(entry => entry.id === duplicateId)).toHaveLength(1)
    expect(manifest.find(entry => entry.id === duplicateId)?.touched).toBe(9)
    expect(manifest.map(entry => entry.id)).toEqual([
      'seed:99:orbit:custom',
      duplicateId,
      'seed:2:ridge:custom',
    ])
  })
})
