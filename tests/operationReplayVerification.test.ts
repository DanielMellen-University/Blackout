import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { flyOperation } from '../src/systems/operation/harness'
import { OPERATION_STAGES } from '../src/systems/operation/identity'
import { buildOperationPlan } from '../src/systems/operation/plan'
import { replayFileTranscript, serializeOperationReplayFile, type OperationReplayFile } from '../src/systems/operation/replayFile'
import { operationReplaySummary, verifyOperationReplayFile } from '../src/systems/operation/replayVerification'

const text = readFileSync(new URL('../docs/reviews/operation-11.040/seed-42-valley-commit.replay.json', import.meta.url), 'utf8')
const fixture = JSON.parse(text) as OperationReplayFile

describe('operation replay verification and summary', () => {
  it('verifies the sample file to exact stage and total scores repeatedly', () => {
    const first = verifyOperationReplayFile(text)
    expect(first).toEqual(verifyOperationReplayFile(text))
    expect(first).toMatchObject({
      ok: true, matches: true, claimedTotal: 61472, totalDifference: 0, flightMode: 'model',
      summary: { score: 61472, medal: 'gold', phase: 'complete', decisionPath: ['valley', 'commit'] },
      stages: [
        { id: 'ingress', claimed: 17245, actual: 17245, difference: 0 },
        { id: 'transit', claimed: 18737, actual: 18737, difference: 0 },
        { id: 'egress', claimed: 22790, actual: 22790, difference: 0 },
      ],
    })
  })

  it('reports each changed stage claim even when their differences cancel and the total matches', () => {
    const claimed = structuredClone(fixture.claimed)
    claimed.stages.ingress += 20
    claimed.stages.transit -= 20
    const verified = verifyOperationReplayFile(serializeOperationReplayFile(replayFileTranscript(fixture), claimed))
    expect(verified).toMatchObject({
      ok: true, matches: false, totalDifference: 0,
      stages: [
        { id: 'ingress', difference: -20 }, { id: 'transit', difference: 20 }, { id: 'egress', difference: 0 },
      ],
    })
  })

  it('compares the total including decision bonuses, separately from stage scores', () => {
    const claimed = { ...fixture.claimed, total: Object.values(fixture.claimed.stages).reduce((a, b) => a + b, 0) }
    expect(verifyOperationReplayFile(serializeOperationReplayFile(replayFileTranscript(fixture), claimed)))
      .toMatchObject({ ok: true, matches: false, totalDifference: 2700 })
  })

  it('rejects tampering before attempting score comparison', () => {
    expect(verifyOperationReplayFile(text.replace('61472', '61473')))
      .toEqual({ ok: false, reason: 'integrity-mismatch', path: '$.integrity' })
  })

  it('reports a failed stage and stages not reached rather than matching fabricated zero claims', () => {
    const transcript = replayFileTranscript(structuredClone(fixture))
    transcript.samples.ingress[0]!.airborne = false
    const file = serializeOperationReplayFile(transcript, { total: 0, stages: { ingress: 0, transit: 0, egress: 0 } })
    expect(verifyOperationReplayFile(file)).toMatchObject({
      ok: true, matches: false, totalDifference: 0,
      summary: { phase: 'failed', medal: 'none', score: 0 },
      stages: [{ actual: 0, difference: 0 }, { actual: null, difference: null }, { actual: null, difference: null }],
    })
  })

  it.each(['transit', 'egress'] as const)('reports the %s failure and does not score later stages', failedStage => {
    const transcript = replayFileTranscript(structuredClone(fixture))
    transcript.samples[failedStage][0]!.airborne = false
    const text = serializeOperationReplayFile(transcript, {
      total: 0, stages: { ingress: 0, transit: 0, egress: 0 },
    })
    const verified = verifyOperationReplayFile(text)
    expect(verified).toMatchObject({
      ok: true,
      matches: false,
      summary: { phase: 'failed' },
    })
    if (!verified.ok) throw new Error(verified.reason)
    const failedIndex = OPERATION_STAGES.indexOf(failedStage)
    expect(verified.stages.slice(failedIndex + 1).every(stage => stage.actual === null && stage.difference === null)).toBe(true)
    expect(verified.stages[failedIndex]!.actual).toBe(0)
    expect(verified.stages.slice(0, failedIndex).every(stage => stage.actual !== null)).toBe(true)
  })

  it('summarizes the same measured time, speed, clearance and score as the harness', () => {
    const flown = flyOperation(42, 'valley', 'commit')
    const transcript = replayFileTranscript(fixture)
    const before = JSON.stringify(transcript)
    const summary = operationReplaySummary(transcript)
    expect(summary.elapsedSec).toBeCloseTo(28.850, 8)
    for (const [index, stage] of summary.stages.entries()) {
      const measured = flown.stages[index]!
      expect(stage).toMatchObject({
        id: measured.id, elapsedSec: measured.elapsedSec, score: measured.score,
        peakSpeedMps: measured.peakSpeedMps, minClearanceM: measured.minClearanceM, passed: true,
      })
      expect(stage.gates).toEqual(buildOperationPlan(42, 'valley', 'commit').stages[index]!.gates)
      expect(stage.gateScore).toBe(flown.attempt.stages[stage.id]!.gateScore)
    }
    expect(summary.stages.map(stage => stage.id)).toEqual(OPERATION_STAGES)
    expect(JSON.stringify(transcript)).toBe(before)
  })

  it.each([
    ['valley', 'conserve', 57741, 'silver'],
    ['ridge', 'conserve', 42947, 'bronze'],
    ['ridge', 'commit', 56521, 'silver'],
  ] as const)('verifies %s then %s with unchanged scoring', (route, energy, score, medal) => {
    const flown = flyOperation(42, route, energy)
    const claimed = { total: flown.score, stages: { ingress: flown.stages[0]!.score, transit: flown.stages[1]!.score, egress: flown.stages[2]!.score } }
    expect(verifyOperationReplayFile(serializeOperationReplayFile(flown.transcript!, claimed)))
      .toMatchObject({ ok: true, matches: true, summary: { score, medal, decisionPath: [route, energy] } })
  })
})
