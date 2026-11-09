import { describe, expect, it } from 'vitest'
import { flyOperation } from '../src/systems/operation/harness'
import type { OperationTranscript } from '../src/systems/operation/replay'
import { operationReplayCues, operationReplayHud } from '../src/ui/operation/playback'

function transcript(): OperationTranscript {
  const flown = flyOperation(42, 'valley', 'commit')
  if (!flown.transcript) throw new Error('expected a transcript')
  return flown.transcript
}

describe('operation replay cues', () => {
  it('orders ingress, the route, transit, the energy, then egress', () => {
    const cues = operationReplayCues(transcript())
    expect(cues[0]).toMatchObject({ kind: 'sample', stage: 'ingress' })
    const route = cues.findIndex(cue => cue.kind === 'choice')
    const energy = cues.findIndex((cue, index) => index > route && cue.kind === 'choice')
    expect(cues[route]).toEqual({ kind: 'choice', choice: 'valley' })
    expect(cues[energy]).toEqual({ kind: 'choice', choice: 'commit' })
    expect(cues[route - 1]).toMatchObject({ kind: 'sample', stage: 'ingress' })
    expect(cues[route + 1]).toMatchObject({ kind: 'sample', stage: 'transit' })
    expect(cues[energy + 1]).toMatchObject({ kind: 'sample', stage: 'egress' })
    expect(cues.at(-1)).toMatchObject({ kind: 'sample', stage: 'egress' })
  })

  it('keeps one cue per sample plus the two decisions', () => {
    const stored = transcript()
    const cues = operationReplayCues(stored)
    const samples = stored.samples.ingress.length + stored.samples.transit.length + stored.samples.egress.length
    expect(cues).toHaveLength(samples + 2)
    const first = cues[0]
    expect(first && first.kind === 'sample' && first.sample.speed).toBeGreaterThan(0)
  })

  it('shows the route decision on the replay HUD', () => {
    const stored = transcript()
    const cue = operationReplayCues(stored).find(item => item.kind === 'choice' && item.choice === 'valley')
    expect(cue).toBeDefined()
    const hud = operationReplayHud(stored, cue!, stored.samples.ingress.at(-1) ?? null)
    expect(hud.prompt).toBe('Valley or ridge')
    expect(hud.decisions).toEqual(['valley', 'ridge'])
    expect(hud.chosen).toBe('valley')
    expect(hud.scoreLabel).toBe('Replay')
    expect(hud.brief.toLowerCase()).not.toContain('land')
  })

})
