import { Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { flightRecordId, legacyFlightRecordLabel } from '../src/core/FlightRevision'
import { pruneRotatingCourseRecords, touchSeededRandomCourseRecord } from '../src/core/CourseRecordRetention'
import { GhostReplay } from '../src/systems/GhostReplay'
import { ChallengeRun } from '../src/systems/ChallengeRun'

function fixture() {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size } } as Storage
  return { values, storage }
}
describe('b21 record compatibility', () => {
  it('stores new bests and ghosts separately and shows the historical family read-only', () => {
    const { values, storage } = fixture(), oldId = 'seed:1:orbit', currentId = flightRecordId(oldId)
    const ghost = JSON.stringify({ version: 1, worldGeneration: 30, score: 700, samples: [0, 0, 10, 0, 1, 5, 10, 5] })
    values.set(`blackout.best.${oldId}`, '700')
    values.set(`blackout.history.${oldId}`, JSON.stringify({ completionCount: 3 }))
    values.set(`blackout.ghost.${oldId}`, ghost)
    values.set(`blackout.best.${oldId}:r31`, '800')
    values.set(`blackout.ghost.${oldId}:r31`, ghost.replace('30', '31'))
    const frozen = new Map(values)
    const replay = new GhostReplay(new Group(), storage)
    replay.reset(currentId)
    expect(replay.ghostSampleCount).toBe(0)
    replay.record(.1, new Vector3(0, 10, 0)); replay.record(.2, new Vector3(0, 10, 2))
    expect(replay.commitIfBest(true, 50)).toBe(true)
    const run = new ChallengeRun(storage)
    run.reset(currentId, 1)
    run.update(.1, 80)
    run.recordGate(1)
    expect(run.finishAirborne()).not.toBeNull()
    expect(values.has(`blackout.best.${currentId}`)).toBe(true)
    // Score/history persistence uses the same revisioned identity as the ghost.
    expect(currentId).toBe('seed:1:orbit:r32')
    expect(legacyFlightRecordLabel(storage, currentId)).toBe('PRE-B20 BEST 700 / 3 COMPLETE / GHOST SAVED | B20 R31 BEST 800 / GHOST SAVED')
    expect(JSON.parse(values.get(`blackout.ghost.${currentId}`)!).worldGeneration).toBe(32)
    replay.reset(currentId); expect(replay.ghostSampleCount).toBe(2)
    for (const [key, value] of frozen) expect(values.get(key)).toBe(value)
    replay.dispose()
  })
  it('never prunes old rotating or custom families, even after new records fill retention', () => {
    const { values, storage } = fixture()
    const legacy = ['blackout.best.seed:9:ridge:daily:2020-01-01', 'blackout.ghost.seed:8:orbit:custom',
      'blackout.best.seed:9:ridge:r31:daily:2020-01-01', 'blackout.ghost.seed:8:orbit:r31:custom', 'blackout.seededRandomRecords.r31', 'blackout.seededRandomRecords', 'blackout.history.seed:8:orbit:custom']
    for (const key of legacy) values.set(key, 'unchanged')
    for (let i = 0; i < 20; i++) {
      values.set(`blackout.best.seed:9:ridge:r32:daily:2026-01-${String(i+1).padStart(2,'0')}`, '1')
      touchSeededRandomCourseRecord(storage, `seed:${i}:orbit:r32:custom`, i)
    }
    pruneRotatingCourseRecords(storage)
    for (const key of legacy) expect(values.get(key)).toBe('unchanged')
  })
  it('fails closed when historical storage is malformed or denied', () => {
    expect(legacyFlightRecordLabel({ getItem: () => { throw Error('denied') } }, 'seed:1:orbit:r32')).toBe('')
  })
})
