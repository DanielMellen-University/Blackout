import { describe, expect, it } from 'vitest'
import { buildOperationPlan, stageSpec } from '../src/systems/operation/plan'
import {
  canonicalTranscript,
  createTranscript,
  replayOperation,
  sameAttemptScore,
  transcriptPlan,
} from '../src/systems/operation/replay'
import type { FlightSample } from '../src/systems/operation/samples'

function line(stage: 'ingress' | 'transit' | 'egress'): FlightSample[] {
  const route = stage === 'ingress' ? null : 'valley' as const
  const energy = stage === 'egress' ? 'commit' as const : null
  const spec = stageSpec(buildOperationPlan(42, route, energy), stage)
  return Array.from({ length: 11 }, (_, index) => ({
    t: index * 0.4,
    x: spec.lateralM,
    y: spec.altitudeM,
    z: index * (spec.endZ / 10),
    speed: stage === 'egress' ? 360 : 180,
    clearance: Math.max(50, spec.altitudeM - 200),
    airborne: true,
  }))
}

function samples() {
  return { ingress: line('ingress'), transit: line('transit'), egress: line('egress') }
}

describe('operation replay', () => {
  it('reproduces the score from the stored samples', () => {
    const transcript = createTranscript(42, 'valley', 'commit', samples())
    expect(transcript).not.toBeNull()
    const first = replayOperation(transcript!)
    const second = replayOperation(transcript!)
    expect(first.attempt.phase).toBe('complete')
    expect(sameAttemptScore(first.attempt, second.attempt)).toBe(true)
    expect(first.attempt.score).toBe(second.attempt.score)
  })

  it('changes the score when a stored sample is tampered', () => {
    const transcript = createTranscript(42, 'valley', 'commit', samples())!
    const original = replayOperation(transcript).attempt.score
    const tampered = {
      ...transcript,
      samples: {
        ...transcript.samples,
        egress: transcript.samples.egress.map(sample => ({ ...sample, airborne: false })),
      },
    }
    expect(replayOperation(tampered).attempt.phase).toBe('failed')
    expect(replayOperation(tampered).attempt.score).not.toBe(original)
  })
})
