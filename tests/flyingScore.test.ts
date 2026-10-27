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
})
