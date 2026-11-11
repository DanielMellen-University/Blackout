import { describe, expect, it } from 'vitest'
import { exportLatestOperationReplay } from '../src/systems/operation/replayExport'
import { verifyOperationReplayFile } from '../src/systems/operation/replayVerification'
import { emptyProgress, memoryOperationStore } from '../src/systems/operation/save'
import { OperationSession } from '../src/ui/operation/session'

function finish(session: OperationSession, route: string, energy: string): void {
  session.start()
  session.advance(100_000)
  session.choose(route)
  session.advance(100_000)
  session.choose(energy)
  session.advance(100_000)
  expect(session.status).toBe('results')
}

describe('latest operation replay export', () => {
  it('returns null with no completed transcript', () => {
    expect(exportLatestOperationReplay(emptyProgress())).toBeNull()
    const session = new OperationSession(memoryOperationStore())
    session.start()
    session.advance(5)
    expect(session.exportReplay()).toBeNull()
    session.close()
  })

  it('exports the latest finish, preserving the stored claims, result, best and save', () => {
    const store = memoryOperationStore()
    const session = new OperationSession(store, 42, 0)
    finish(session, 'valley', 'commit')
    finish(session, 'ridge', 'conserve')
    const saved = store.snapshot()
    const result = structuredClone(session.result)
    const file = session.exportReplay()!
    expect(verifyOperationReplayFile(file)).toMatchObject({
      ok: true, matches: true, claimedTotal: 42947,
      summary: { decisionPath: ['ridge', 'conserve'], medal: 'bronze' },
    })
    expect(JSON.parse(file)).not.toHaveProperty('flightMode')
    expect(session.result).toEqual(result)
    expect(session.result?.bestLabel).toBe('Best 61,472')
    expect(store.snapshot()).toBe(saved)
    session.close()
    expect(new OperationSession(store).exportReplay()).toBe(file)
  })

  it('keeps the last completed export while another flight is underway or closed', () => {
    const session = new OperationSession(memoryOperationStore())
    finish(session, 'valley', 'commit')
    const file = session.exportReplay()
    session.start()
    session.advance(5)
    expect(session.exportReplay()).toBe(file)
    session.close()
    expect(session.exportReplay()).toBe(file)
  })

  it('exports recorded claims without repairing an incorrect score', () => {
    const store = memoryOperationStore()
    const session = new OperationSession(store)
    finish(session, 'valley', 'commit')
    const progress = JSON.parse(store.snapshot()!)
    progress.history.at(-1).stages.transit.score += 7
    const exported = exportLatestOperationReplay(progress)!
    expect(verifyOperationReplayFile(exported)).toMatchObject({
      ok: true, matches: false, stages: [{ difference: 0 }, { difference: -7 }, { difference: 0 }],
    })
  })

  it('fails closed on a corrupt old save or mismatched replay identity', () => {
    const store = memoryOperationStore()
    finish(new OperationSession(store), 'valley', 'commit')
    const progress = JSON.parse(store.snapshot()!)
    progress.replay.samples.egress = []
    expect(exportLatestOperationReplay(progress)).toBeNull()
    const mismatch = JSON.parse(store.snapshot()!)
    mismatch.replay.seed = 73
    expect(exportLatestOperationReplay(mismatch)).toBeNull()
  })
})
