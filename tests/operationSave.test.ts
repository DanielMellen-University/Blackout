import { describe, expect, it } from 'vitest'
import { chooseEnergy, chooseRoute, createAttempt, recordStage, type OperationAttempt } from '../src/systems/operation/attempt'
import { buildOperationPlan, stageSpec } from '../src/systems/operation/plan'
import { createTranscript } from '../src/systems/operation/replay'
import {
  OPERATION_HISTORY_LIMIT,
  OPERATION_SAVE_VERSION,
  OPERATION_STORAGE_KEY,
  clearActive,
  commitAttempt,
  emptyProgress,
  loadProgress,
  memoryOperationStore,
  parseProgress,
  serializeProgress,
  stageIdsFromUnknown,
  writeProgress,
} from '../src/systems/operation/save'
import type { FlightSample } from '../src/systems/operation/samples'

function line(stage: 'ingress' | 'transit' | 'egress', route: 'valley' | 'ridge' | null, energy: 'conserve' | 'commit' | null): FlightSample[] {
  const spec = stageSpec(buildOperationPlan(42, route, energy), stage)
  return Array.from({ length: 11 }, (_, index) => ({
    t: index * 0.4,
    x: spec.lateralM,
    y: spec.altitudeM,
    z: index * (spec.endZ / 10),
    speed: 180,
    clearance: Math.max(50, spec.altitudeM - 200),
    airborne: true,
  }))
}

function finish(route: 'valley' | 'ridge' = 'valley'): OperationAttempt {
  let attempt = createAttempt(42)
  attempt = recordStage(attempt, line('ingress', null, null)).attempt
  attempt = chooseRoute(attempt, route).attempt
  attempt = recordStage(attempt, line('transit', route, null)).attempt
  attempt = chooseEnergy(attempt, 'conserve').attempt
  attempt = recordStage(attempt, line('egress', route, 'conserve')).attempt
  return attempt
}

describe('operation save', () => {
  it('uses a versioned storage key', () => {
    expect(OPERATION_SAVE_VERSION).toBe(1)
    expect(OPERATION_STORAGE_KEY).toBe('blackout.operation.ridge-relay')
  })

  it('round-trips an empty progress document', () => {
    expect(parseProgress(serializeProgress(emptyProgress()))).toEqual(emptyProgress())
    expect(parseProgress(null)).toEqual(emptyProgress())
    expect(parseProgress('')).toEqual(emptyProgress())
  })

  it('rejects a different save version', () => {
    expect(parseProgress(JSON.stringify({ version: 2, active: null, best: null, history: [], replay: null }))).toBeNull()
  })

  it('rejects truncated and garbage documents', () => {
    expect(parseProgress('{')).toBeNull()
    expect(parseProgress('[]')).toBeNull()
    expect(parseProgress(JSON.stringify({ version: 1, active: { id: 'other' }, best: null, history: [] }))).toBeNull()
  })

  it('keeps the best only when a later finish scores higher', () => {
    const first = finish('ridge')
    const second = finish('valley')
    expect(second.score).toBeGreaterThan(first.score)
    const once = commitAttempt(emptyProgress(), first)
    const twice = commitAttempt(once, second)
    expect(twice.best?.score).toBe(second.score)
    expect(twice.history).toHaveLength(2)
    const repeat = commitAttempt(twice, first)
    expect(repeat.best?.score).toBe(second.score)
  })

  it('does not replace the best with an equal score', () => {
    const attempt = finish('valley')
    const saved = commitAttempt(commitAttempt(emptyProgress(), attempt), attempt)
    expect(saved.best?.score).toBe(attempt.score)
    expect(saved.history).toHaveLength(2)
  })

  it('does not store a failed run as a best result', () => {
    const failed = recordStage(createAttempt(42), line('ingress', null, null).map(sample => ({ ...sample, airborne: false }))).attempt
    const saved = commitAttempt(emptyProgress(), failed)
    expect(saved.best).toBeNull()
    expect(saved.history).toHaveLength(0)
    expect(saved.active?.phase).toBe('failed')
  })

  it('caps remembered finishes', () => {
    let progress = emptyProgress()
    for (let index = 0; index < OPERATION_HISTORY_LIMIT + 3; index += 1) progress = commitAttempt(progress, finish('valley'))
    expect(progress.history).toHaveLength(OPERATION_HISTORY_LIMIT)
  })
})
