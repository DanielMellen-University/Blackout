import { describe, expect, it } from 'vitest'
import { FlyingScore } from '../src/systems/FlyingScore'

describe('flying score', () => {
  it('weights samples by time and bounds each bonus', () => {
    const score = new FlyingScore()
    score.sample(1, 0, 0, 250)
    score.sample(3, 300, 100, 100)
    expect(score.bonuses()).toEqual({ lowScore: 2500, terrainScore: 2500, speedScore: 2500 })
  })

  it('ignores invalid samples and clamps extreme telemetry', () => {
    const score = new FlyingScore()
    score.sample(NaN, 0, 0, 250)
    score.sample(2, NaN, 0, 250)
    expect(score.bonuses()).toEqual({ lowScore: 0, terrainScore: 0, speedScore: 0 })
    score.sample(1, -10, -10, 1000)
    expect(score.bonuses()).toEqual({ lowScore: 10000, terrainScore: 10000, speedScore: 10000 })
  })

  it('measures terrain proximity against the gate line', () => {
    // 11.024: zero at 1.25 x the median gate clearance (at least 100 m, at most 400 m).
    const line = new FlyingScore(140)
    line.sample(1, 0, 175, 150)
    line.sample(1, 0, 140, 150)
    line.sample(1, 0, 70, 150)
    expect(line.bonuses().terrainScore).toBe(Math.round(10_000 * (0 + 0.2 + 0.6) / 3))
    const low = new FlyingScore(40)
    low.sample(1, 0, 50, 150)
    expect(low.bonuses().terrainScore).toBe(5_000)
    const high = new FlyingScore(1_000)
    high.sample(1, 0, 200, 150)
    expect(high.bonuses().terrainScore).toBe(5_000)
    const invalid = new FlyingScore(Number.NaN)
    invalid.sample(1, 0, 50, 150)
    expect(invalid.bonuses().terrainScore).toBe(5_000)
  })
})
