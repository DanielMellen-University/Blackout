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
  it.each([
    ['daily', '2025-01-01', '2026-01-', ROTATING_RECORD_RETENTION.daily],
    ['weekly', '2025-W01', '2026-W', ROTATING_RECORD_RETENTION.weekly],
    ['monthly', '2025-01', '2026-', ROTATING_RECORD_RETENTION.monthly],
  ] as const)('protects only the active/replayed %s family until released', (kind, oldPeriod, newerPrefix, limit) => {
    const prefixes = ['best', 'streak', 'history', 'badges', 'trace', 'ghost']
    const runId = `seed:42:ridge:r32:s2:${kind}:${oldPeriod}`
    const siblings = prefixes.map(prefix => `blackout.${prefix}.${runId}`)
    const otherOld = `blackout.history.seed:43:ridge:r32:s2:${kind}:${oldPeriod}`
    const recent = Array.from({ length: limit }, (_, i) =>
      `blackout.history.seed:99:ridge:r32:s2:${kind}:${newerPrefix}${String(i + 1).padStart(2, '0')}`)
    const storage = storageFixture([...siblings, otherOld, ...recent])
    expect(pruneRotatingCourseRecords(storage, new Set([runId]))).toBe(1)
    expect(siblings.every(key => storage.values.has(key))).toBe(true)
    expect(recent.every(key => storage.values.has(key))).toBe(true)
    expect(storage.values.has(otherOld)).toBe(false)
    expect(pruneRotatingCourseRecords(storage)).toBe(6)
    expect(siblings.some(key => storage.values.has(key))).toBe(false)
  })

  it('keeps recent periods, removes stale rotating records, and preserves authored records', () => {
    const daily = Array.from({ length: ROTATING_RECORD_RETENTION.daily + 2 }, (_, index) =>
      `blackout.history.seed:${index}:sweep:r32:s2:daily:2026-01-${String(index + 1).padStart(2, '0')}`)
    const weekly = Array.from({ length: ROTATING_RECORD_RETENTION.weekly + 2 }, (_, index) =>
      `blackout.ghost.seed:${index}:ridge:r32:s2:weekly:2026-W${String(index + 1).padStart(2, '0')}`)
    const monthly = Array.from({ length: ROTATING_RECORD_RETENTION.monthly + 2 }, (_, index) =>
      `blackout.best.seed:${index}:alpine:r32:s2:monthly:2026-${String(index + 1).padStart(2, '0')}`)
    const malformed = 'blackout.badges.seed:broken:ridge:r32:s2:daily:2026-02-30'
    const authored = 'blackout.history.seed:12:ridge:r32'
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
    expect(pruneRotatingCourseRecords({ length: 1, key: () => 'blackout.history.seed:1:sweep:r32:s2:daily:2026-01-01' })).toBe(0)
  })

  it('bounds explicit seeded-world families while preserving the newest records', () => {
    const data = new Map<string, string>()
    const storage: IndexedRecordStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    }
    for (let index = 0; index < SEEDED_RANDOM_RECORD_RETENTION + 2; index += 1) {
      const id = `seed:${index}:orbit:r32:custom:s2`
      data.set(`blackout.history.${id}`, 'history')
      data.set(`blackout.ghost.${id}`, 'ghost')
      touchSeededRandomCourseRecord(storage, id, index + 1)
    }
    const newest = `seed:${SEEDED_RANDOM_RECORD_RETENTION + 1}:orbit:r32:custom:s2`
    const oldest = 'seed:0:orbit:r32:custom:s2'
    expect(data.has(`blackout.history.${newest}`)).toBe(true)
    expect(data.has(`blackout.ghost.${newest}`)).toBe(true)
    expect(data.has(`blackout.history.${oldest}`)).toBe(false)
    expect(data.has(`blackout.ghost.${oldest}`)).toBe(false)
    const manifest = JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY) ?? '[]') as unknown[]
    expect(manifest).toHaveLength(SEEDED_RANDOM_RECORD_RETENTION)
  })

  it('deduplicates malformed seeded-world manifests using the newest touch', () => {
    const data = new Map<string, string>()
    const duplicateId = 'seed:4:orbit:r32:custom:s2'
    const storage: IndexedRecordStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    }
    data.set(SEEDED_RANDOM_RECORDS_STORAGE_KEY, JSON.stringify([
      { id: duplicateId, touched: 1 },
      { id: duplicateId, touched: 9 },
      { id: 'seed:2:ridge:r32:custom:s2', touched: 8 },
      { id: 'not-a-seed', touched: 99 },
    ]))

    touchSeededRandomCourseRecord(storage, 'seed:99:orbit:r32:custom:s2', 10)

    const manifest = JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY) ?? '[]') as Array<{ id: string; touched: number }>
    expect(manifest.filter(entry => entry.id === duplicateId)).toHaveLength(1)
    expect(manifest.find(entry => entry.id === duplicateId)?.touched).toBe(9)
    expect(manifest.map(entry => entry.id)).toEqual([
      'seed:99:orbit:r32:custom:s2',
      duplicateId,
      'seed:2:ridge:r32:custom:s2',
    ])
  })
})

it('bounds generated themes in the existing seeded manifest without touching authored or old records', () => {
  const data = new Map<string, string>()
  const storage: IndexedRecordStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: key => { data.delete(key) },
  }
  const protectedIds = ['seed:42:contour:r32', 'seed:42:generated-desert:r31:l30:q33', 'seed:42:desert:r32', 'seed:42.25:generated-coastal:r32:l31:q34', 'seed:42.25:generated-volcanic:r32:l32:q35']
  for (const id of protectedIds) data.set(`blackout.history.${id}`, 'retained')
  for (let i = 0; i < SEEDED_RANDOM_RECORD_RETENTION + 2; i++) {
    const id = `seed:${i}.125:generated-${['valley','desert','coastal','volcanic'][i % 4]}:r32:l${30 + (i % 4 > 1 ? i % 4 - 1 : 0)}:q${33 + (i % 4 > 1 ? i % 4 - 1 : 0)}:s2`
    data.set(`blackout.history.${id}`, 'history')
    data.set(`blackout.ghost.${id}`, 'ghost')
    touchSeededRandomCourseRecord(storage, id, i + 1)
  }
  expect(data.has('blackout.history.seed:0.125:generated-valley:r32:l30:q33:s2')).toBe(false)
  expect(data.has('blackout.ghost.seed:0.125:generated-valley:r32:l30:q33:s2')).toBe(false)
  expect(JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY)!)).toHaveLength(SEEDED_RANDOM_RECORD_RETENTION)
  for (const id of protectedIds) expect(data.has(`blackout.history.${id}`)).toBe(true)
})

it.each(['', ':mission:monsoon-run', ':mission:waterway-tour'])('bounds Waterway sibling records in the existing manifest (%s)', suffix => {
  const data = new Map<string, string>()
  const storage: IndexedRecordStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: key => { data.delete(key) },
  }
  const old = ['seed:54:monsoon:r32', 'seed:54:river:r32', 'seed:42:generated-waterway:r31:l36:q39']
  for (const id of old) data.set(`blackout.ghost.${id}`, 'retained')
  const prefixes = ['best', 'streak', 'history', 'badges', 'trace', 'ghost']
  for (let seed = 1; seed <= SEEDED_RANDOM_RECORD_RETENTION + 2; seed++) {
    const id = `seed:${seed}.125:generated-waterway:r32:l${suffix ? 136 : 36}:q${suffix ? 139 : 39}${suffix}:s2`
    for (const prefix of prefixes) data.set(`blackout.${prefix}.${id}`, prefix)
    touchSeededRandomCourseRecord(storage, id, seed)
  }
  const manifest = JSON.parse(data.get(SEEDED_RANDOM_RECORDS_STORAGE_KEY) ?? '[]')
  expect(manifest).toHaveLength(SEEDED_RANDOM_RECORD_RETENTION)
  const oldest = `seed:1.125:generated-waterway:r32:l${suffix ? 136 : 36}:q${suffix ? 139 : 39}${suffix}:s2`
  for (const prefix of prefixes) expect(data.has(`blackout.${prefix}.${oldest}`)).toBe(false)
  expect(manifest[0].id).toContain('seed:14.125:generated-waterway:')
  for (const id of old) expect(data.get(`blackout.ghost.${id}`)).toBe('retained')
})


it('preserves pre-M4 rotating records while pruning the new score family', () => {
  const oldId = 'seed:42:ridge:r32:daily:2025-01-01'
  const current = Array.from({ length: ROTATING_RECORD_RETENTION.daily + 1 }, (_, i) =>
    `blackout.best.seed:42:ridge:r32:s2:daily:2026-01-${String(i + 1).padStart(2, '0')}`)
  const storage = storageFixture([`blackout.best.${oldId}`, ...current])
  expect(pruneRotatingCourseRecords(storage)).toBe(1)
  expect(storage.values.get(`blackout.best.${oldId}`)).toBe('record')
})
