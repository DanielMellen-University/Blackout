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
  toBest,
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

  it('rejects an active attempt with a malformed nested stage result', () => {
    const attempt = finish()
    const saved = commitAttempt(emptyProgress(), attempt)
    const progress = { ...saved, active: { ...attempt, stages: { ...attempt.stages, ingress: { ...attempt.stages.ingress!, passed: 'yes' } } } }
    expect(parseProgress(JSON.stringify(progress))).toBeNull()
  })

  it('rejects a saved best with non-finite stage measurements', () => {
    const saved = commitAttempt(emptyProgress(), finish())
    const best = structuredClone(saved.best!)
    best.stages.transit.altitudeErrorM = Number.NaN
    expect(parseProgress(JSON.stringify({ ...saved, best }))).toBeNull()
  })

  it('keeps legacy version-1 best and history records without discipline measurements', () => {
    const saved = commitAttempt(emptyProgress(), finish())
    const legacy = structuredClone(saved)
    for (const record of [legacy.best!, ...legacy.history]) {
      for (const stage of Object.values(record.stages)) {
        delete (stage as Partial<typeof stage>).pathDeviationM
        delete (stage as Partial<typeof stage>).altitudeErrorM
        delete (stage as Partial<typeof stage>).speedErrorMps
        delete (stage as Partial<typeof stage>).meanSpeedMps
        delete (stage as Partial<typeof stage>).fuelUsed
        delete (stage as Partial<typeof stage>).nitroUsed
        delete (stage as Partial<typeof stage>).disciplineScore
      }
    }
    const parsed = parseProgress(JSON.stringify(legacy))
    expect(parsed?.best).not.toBeNull()
    expect(parsed?.history).toHaveLength(1)

    const malformed = structuredClone(legacy)
    malformed.history[0]!.stages.transit.pathDeviationM = Number.POSITIVE_INFINITY
    expect(parseProgress(JSON.stringify(malformed))).toBeNull()
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

  it('keeps the latest completed replay when a later attempt fails', () => {
    const completed = finish('valley')
    const transcript = createTranscript(42, 'valley', 'conserve', {
      ingress: line('ingress', null, null),
      transit: line('transit', 'valley', null),
      egress: line('egress', 'valley', 'conserve'),
    })
    const saved = commitAttempt(emptyProgress(), completed, transcript)
    const failed = recordStage(createAttempt(73), line('ingress', null, null).map(sample => ({ ...sample, airborne: false }))).attempt
    const afterFailure = commitAttempt(saved, failed)
    expect(afterFailure.replay).toEqual(transcript)
    expect(afterFailure.best).toEqual(saved.best)
    expect(afterFailure.history).toEqual(saved.history)
  })

  it('caps remembered finishes', () => {
    let progress = emptyProgress()
    for (let index = 0; index < OPERATION_HISTORY_LIMIT + 3; index += 1) progress = commitAttempt(progress, finish('valley'))
    expect(progress.history).toHaveLength(OPERATION_HISTORY_LIMIT)
  })

  it('keeps the newest finishes when loading or serializing an oversized history', () => {
    const result = toBest(finish())!
    const history = Array.from({ length: OPERATION_HISTORY_LIMIT + 3 }, (_, index) => ({ ...result, seed: index + 1 }))
    const progress = { ...emptyProgress(), history }
    const newest = history.slice(-OPERATION_HISTORY_LIMIT).map(entry => entry.seed)
    expect(parseProgress(JSON.stringify(progress))?.history.map(entry => entry.seed)).toEqual(newest)
    expect(parseProgress(serializeProgress(progress))?.history.map(entry => entry.seed)).toEqual(newest)
    expect(progress.history).toHaveLength(OPERATION_HISTORY_LIMIT + 3)
  })

  it('clears the active attempt and keeps the best', () => {
    const saved = clearActive(commitAttempt(emptyProgress(), finish('valley')))
    expect(saved.active).toBeNull()
    expect(saved.best?.route).toBe('valley')
  })

  it('reloads progress from the store', () => {
    const store = memoryOperationStore()
    const transcript = createTranscript(42, 'valley', 'conserve', {
      ingress: line('ingress', null, null),
      transit: line('transit', 'valley', null),
      egress: line('egress', 'valley', 'conserve'),
    })
    expect(writeProgress(store, commitAttempt(emptyProgress(), finish('valley'), transcript))).toBe(true)
    expect(loadProgress(store)?.best?.energy).toBe('conserve')
    expect(loadProgress(store)?.replay?.route).toBe('valley')
  })

  it.each(['empty', 'single', 'null', 'missing-fields', 'non-finite', 'backward-time'] as const)(
    'rejects a stored replay with a malformed %s stage', kind => {
      const transcript = createTranscript(42, 'valley', 'conserve', {
        ingress: line('ingress', null, null),
        transit: line('transit', 'valley', null),
        egress: line('egress', 'valley', 'conserve'),
      })!
      if (kind === 'empty') transcript.samples.transit = []
      if (kind === 'single') transcript.samples.transit.length = 1
      if (kind === 'null') transcript.samples.transit[0] = null as never
      if (kind === 'missing-fields') transcript.samples.transit[0] = {} as never
      if (kind === 'non-finite') transcript.samples.transit[0]!.speed = Infinity
      if (kind === 'backward-time') transcript.samples.transit[1]!.t = -1
      const progress = commitAttempt(emptyProgress(), finish(), transcript)
      expect(parseProgress(serializeProgress(progress)) === null).toBe(true)
    },
  )

  it('fails closed when the store throws', () => {
    const store = {
      read: () => { throw new Error('denied') },
      write: () => { throw new Error('full') },
    }
    expect(loadProgress(store)).toBeNull()
    expect(writeProgress(store, emptyProgress())).toBe(false)
  })

  it('keeps an in-progress attempt without writing history', () => {
    const attempt = recordStage(createAttempt(9), line('ingress', null, null)).attempt
    const saved = commitAttempt(emptyProgress(), attempt)
    expect(saved.active?.phase).toBe('route-choice')
    expect(saved.history).toHaveLength(0)
    expect(saved.best).toBeNull()
  })

  it('filters unknown stage ids', () => {
    expect(stageIdsFromUnknown(['ingress', 'landing', 'egress'])).toEqual(['ingress', 'egress'])
  })
})
