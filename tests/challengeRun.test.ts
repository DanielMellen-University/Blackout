import { describe, expect, it } from 'vitest'
import { ChallengeRun, formatTime } from '../src/systems/ChallengeRun'

describe('ChallengeRun', () => {
  it('starts the clock on the takeoff roll and scores a completed landing', () => {
    const store = new Map<string, string>()
    const run = new ChallengeRun({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value)
      },
    })
    run.reset('seed:1', 2)
    expect(run.phase).toBe('ready')
    run.update(0.5, 0)
    expect(run.phase).toBe('ready')
    run.update(0.5, 8)
    expect(run.phase).toBe('running')
    expect(run.elapsedSec).toBeCloseTo(0.5)

    run.recordGate(1)
    run.recordGate(0.5)
    expect(run.phase).toBe('returning')

    const result = run.finishLanding({
      verticalSpeed: -2,
      groundSpeed: 28,
      pitchRad: 0.1,
      rollRad: 0.05,
    })
    expect(result).not.toBeNull()
    expect(result!.gateScore).toBe(15_000)
    expect(result!.totalScore).toBeGreaterThan(0)
    expect(result!.isNewBest).toBe(true)
    expect(run.phase).toBe('complete')
  })

  it('does not score a landing before the circuit is done', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:1', 2)
    run.recordGate(1)
    expect(
      run.finishLanding({
        verticalSpeed: -1,
        groundSpeed: 20,
        pitchRad: 0,
        rollRad: 0,
      }),
    ).toBeNull()
  })

  it('formats time with centiseconds', () => {
    expect(formatTime(75.5)).toBe('1:15.50')
  })

  it('reuses the clock label while the displayed centiseconds stay unchanged', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:clock', 1)
    const first = run.clockLabel
    run.update(0.001, 0)
    expect(run.clockLabel).toBe(first)
    run.update(0.01, 8)
    expect(run.clockLabel).not.toBe(first)
  })
})
