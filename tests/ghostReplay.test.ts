import { Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  GHOST_SAMPLE_INTERVAL,
  GHOST_STORAGE_PREFIX,
  GhostReplay,
  MAX_GHOST_SAMPLES,
} from '../src/systems/GhostReplay'

function storageFixture(): {
  values: Map<string, string>
  storage: Storage
} {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  } as Storage
  return { values, storage }
}

describe('GhostReplay', () => {
  it('records bounded samples and persists only a new best for seeded courses', () => {
    const { values, storage } = storageFixture()
    const replay = new GhostReplay(new Group(), storage)
    replay.reset('seed:123:precision')
    expect(replay.commitIfBest(true, 9000)).toBe(false)
    replay.record(0.01, new Vector3(0, 10, 0))
    replay.record(0.01 + GHOST_SAMPLE_INTERVAL, new Vector3(2, 11, 4))
    replay.record(0.01 + GHOST_SAMPLE_INTERVAL * 2, new Vector3(4, 12, 8))
    expect(replay.recordedSampleCount).toBe(3)
    expect(replay.commitIfBest(false, 9000)).toBe(false)
    expect(replay.commitIfBest(true, 9000)).toBe(true)
    const raw = values.get(`${GHOST_STORAGE_PREFIX}seed:123:precision`)
    expect(raw).toContain('"version":1')

    const loaded = new GhostReplay(new Group(), storage)
    loaded.reset('seed:123:precision')
    expect(loaded.ghostSampleCount).toBe(3)
    loaded.setVisible(true)
    loaded.update(0.01 + GHOST_SAMPLE_INTERVAL * 0.5, true)
    expect(loaded.root.visible).toBe(true)
    expect(loaded.root.children[1]?.visible).toBe(true)
    expect(loaded.paceDelta(0.01 + GHOST_SAMPLE_INTERVAL * 2 + 1.25)).toBeCloseTo(1.25)
  })

  it('rejects random courses, malformed traces, and over-capacity records', () => {
    const { values, storage } = storageFixture()
    const replay = new GhostReplay(new Group(), storage)
    replay.reset('random-world')
    replay.record(0.1, new Vector3(1, 2, 3))
    expect(replay.recordedSampleCount).toBe(0)
    values.set(`${GHOST_STORAGE_PREFIX}seed:9:balanced`, JSON.stringify({ version: 1, samples: [0, 0, 0, 0, 2, 1, 1, 1, 1, 2, 2, 2] }))
    replay.reset('seed:9:balanced')
    expect(replay.ghostSampleCount).toBe(0)
    for (let i = 0; i < MAX_GHOST_SAMPLES + 10; i += 1) {
      replay.record(i * (GHOST_SAMPLE_INTERVAL + 0.0001), new Vector3(i, 0, 0))
    }
    expect(replay.recordedSampleCount).toBe(MAX_GHOST_SAMPLES)
  })

  it('survives storage failures and disposal', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as Storage
    const replay = new GhostReplay(new Group(), storage)
    expect(() => replay.reset('seed:1:balanced')).not.toThrow()
    replay.record(0.1, new Vector3(0, 0, 0))
    replay.record(0.2, new Vector3(1, 0, 0))
    expect(replay.commitIfBest(true, 1)).toBe(false)
    replay.dispose()
    expect(() => replay.update(0.2, true)).not.toThrow()
  })
})
