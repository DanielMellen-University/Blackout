import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CrashCinematic } from '../src/systems/CrashCinematic'

describe('crash presentation clock', () => {
  it('delays and releases the captured debrief exactly once', () => {
    const sequence = new CrashCinematic<object>()
    const result = { score: 125, seed: 42 }
    sequence.begin(result)
    expect(sequence.active).toBe(true)
    expect(sequence.effectTimeScale).toBe(0.45)
    for (let i = 0; i < 30; i++) expect(sequence.update(1 / 60)).toBeNull()
    expect(sequence.progress).toBeCloseTo(0.5 / 3.2)
    for (let i = 0; i < 10; i++) sequence.update(1 / 60)
    expect(sequence.effectTimeScale).toBe(1)
    let completed: object | null = null
    for (let i = 0; i < 160; i++) completed = sequence.update(1 / 60) ?? completed
    expect(completed).toBe(result)
    expect(sequence.progress).toBe(1)
    expect(sequence.active).toBe(false)
    expect(sequence.update(1)).toBeNull()
  })

  it('freezes through pause, hidden frames, and invalid timing', () => {
    const sequence = new CrashCinematic<string>()
    sequence.begin('water')
    sequence.update(0.1)
    const progress = sequence.progress
    for (const dt of [0, -1, NaN, Infinity]) expect(sequence.update(dt)).toBeNull()
    expect(sequence.progress).toBe(progress)
    expect(sequence.update(60)).toBeNull()
    expect(sequence.progress).toBeCloseTo(0.35 / 3.2)
  })

  it('uses a shorter comfort shot and cancels pending results on retry/quit', () => {
    const sequence = new CrashCinematic<string>()
    sequence.begin('old', true)
    for (let i = 0; i < 4; i++) expect(sequence.update(0.25)).toBeNull()
    expect(sequence.update(0.2)).toBe('old')
    sequence.begin('cancelled')
    sequence.reset()
    expect(sequence.update(0.25)).toBeNull()
    expect(sequence.active).toBe(false)
    expect(sequence.progress).toBe(0)
    sequence.begin('new', true)
    for (let i = 0; i < 4; i++) sequence.update(0.25)
    expect(sequence.update(0.2)).toBe('new')
  })

  it('routes land/water separately and freezes flight during the shot', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
    const collision = main.slice(main.indexOf("if (touch === 'crash' || touch === 'ditch')"), main.indexOf('const scoredTouch'))
    expect(collision).toContain('crashCinematic.begin([')
    expect(collision).not.toContain('results.show(')
    expect(collision).toMatch(/waterImpactFx.trigger\([\s\S]*?\} else \{\s*crashFx.trigger/)
    expect(collision).toContain('aircraft.impact.preImpactVelocity')
    expect(collision).toContain('aircraft.impact?.surfacePoint.y')
    const presentation = main.split('} else if (crashCinematic.active) {')[1]!.split('} else {')[0]!
    expect(presentation).toContain('visualDt = time.beginFrame(nowMs).frameDt')
    expect(presentation).not.toMatch(/aircraft\.step\(|challenge\.update\(|ghost\.record\(|input\.consume/)
    expect(main).toContain('results.show(...debrief)')
    expect(main).toContain('crashCinematic.update(simLive ? visualDt : 0)')
    expect(main).toContain('(results.open || crashCinematic.active) && playing')
  })
})
