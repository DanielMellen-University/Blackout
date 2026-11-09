import { describe, expect, it } from 'vitest'
import { medalForScore } from '../src/systems/operation/medal'
import { replayOperation } from '../src/systems/operation/replay'
import { memoryOperationStore, type OperationStore } from '../src/systems/operation/save'
import { OperationSession } from '../src/ui/operation/session'
import { operationDeckView } from '../src/ui/operation/view'

function finish(session: OperationSession, route: string, energy: string): void {
  session.start()
  for (let n = 0; n < 20 && session.status === 'flying'; n += 1) session.advance(100_000)
  expect(session.status).toBe('choice')
  expect(session.hud?.decisions).toEqual(['valley', 'ridge'])
  session.choose(route)
  for (let n = 0; n < 20 && session.status === 'flying'; n += 1) session.advance(100_000)
  expect(session.status).toBe('choice')
  expect(session.hud?.decisions).toEqual(['conserve', 'commit'])
  session.choose(energy)
  for (let n = 0; n < 20 && session.status === 'flying'; n += 1) session.advance(100_000)
}

describe('operation session', () => {
  it('flies valley then commit to a gold result and stores the best', () => {
    const store = memoryOperationStore()
    const session = new OperationSession(store, 42, 0)
    expect(session.status).toBe('idle')
    finish(session, 'valley', 'commit')
    expect(session.status).toBe('results')
    expect(session.result?.medal).toBe('gold')
    expect(session.result?.bestLabel).toContain('Best')
    expect(session.result?.canReplay).toBe(true)
    expect(session.result?.pathLabel).toBe('Valley then commit')
    const saved = store.snapshot()
    expect(saved).toContain('ridge-relay')
    expect(saved).toContain('valley')
    const view = operationDeckView(session)
    expect(view.showResults).toBe(true)
    expect(view.resultScore).toContain(session.result?.scoreLabel)
    expect(view.resultMedal).toBe('Gold')
    expect(view.showReplay).toBe(true)
    expect(view.showChoices).toBe(false)
  })

  it('ignores a choice while the stage is still flying', () => {
    const session = new OperationSession(memoryOperationStore(), 42, 0)
    session.start()
    session.advance(1)
    expect(session.status).toBe('flying')
    session.choose('valley')
    expect(session.hud?.stageLabel).toContain('ingress')
  })

  it('ignores an unknown decision', () => {
    const session = new OperationSession(memoryOperationStore(), 42, 0)
    session.start()
    session.advance(100_000)
    session.choose('coast')
    expect(session.status).toBe('choice')
    expect(session.hud?.prompt).toBe('Valley or ridge')
  })

  it('does not replace the best with a lower finish', () => {
    const store = memoryOperationStore()
    const session = new OperationSession(store, 42, 0)
    finish(session, 'valley', 'commit')
    const best = session.result?.scoreLabel
    finish(session, 'ridge', 'conserve')
    expect(session.result?.medal).toBe(medalForScore(30_550, true))
    expect(session.result?.bestLabel).toBe(`Best ${best}`)
    expect(session.result?.bestLabel.startsWith('New best')).toBe(false)
  })

  it('replaces the best when a later finish scores higher', () => {
    const session = new OperationSession(memoryOperationStore(), 42, 0)
    finish(session, 'ridge', 'conserve')
    expect(session.result?.bestLabel.startsWith('New best')).toBe(false)
    finish(session, 'valley', 'commit')
    expect(session.result?.bestLabel.startsWith('New best')).toBe(true)
  })

  it('replays the saved transcript to the same score without changing the best', () => {
    const store = memoryOperationStore()
    const session = new OperationSession(store, 42, 0)
    finish(session, 'valley', 'commit')
    const score = session.result?.scoreLabel
    const best = session.result?.bestLabel
    expect(session.replay()).toBe(true)
    expect(session.status).toBe('replay')
    expect(session.hud?.scoreLabel).toBe('Replay')
    for (let n = 0; n < 500 && session.status === 'replay'; n += 1) session.advanceReplay(10_000)
    expect(session.status).toBe('results')
    expect(session.result?.scoreLabel).toBe(score)
    expect(session.result?.bestLabel).toBe(best)
    const saved = JSON.parse(store.snapshot() ?? '{}') as { replay: Parameters<typeof replayOperation>[0] }
    expect(replayOperation(saved.replay).attempt.score.toLocaleString('en-US')).toBe(score)
  })

})
