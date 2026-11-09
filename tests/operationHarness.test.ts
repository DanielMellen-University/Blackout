import { describe, expect, it } from 'vitest'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'
import { getTerrainProfile, setTerrainProfile, type TerrainProfile } from '../src/world/TerrainProfile'
import { commitAttempt, emptyProgress, loadProgress, memoryOperationStore, writeProgress } from '../src/systems/operation/save'
import { flyOperation } from '../src/systems/operation/harness'
import { replayOperation } from '../src/systems/operation/replay'
import { OPERATION_TERRAIN } from '../src/systems/operation/terrain'

const marker: TerrainProfile = { ...OPERATION_TERRAIN, baseHeight: 10, relief: 1 }

describe('operation flight harness', () => {
  it('flies valley then conserve to an airborne finish', () => {
    const measured = flyOperation(42, 'valley', 'conserve')
    expect(measured.passed).toBe(true)
    expect(measured.stages.map(stage => stage.id)).toEqual(['ingress', 'transit', 'egress'])
    expect(measured.stages.every(stage => stage.passed)).toBe(true)
    expect(measured.attempt.phase).toBe('complete')
  })

  it('flies the ridge higher than the valley', () => {
    const valley = flyOperation(42, 'valley', 'conserve')
    const ridge = flyOperation(42, 'ridge', 'conserve')
    const valleyTransit = valley.stages.find(stage => stage.id === 'transit')!
    const ridgeTransit = ridge.stages.find(stage => stage.id === 'transit')!
    expect(ridgeTransit.endAltitudeM).toBeGreaterThan(valleyTransit.endAltitudeM)
    expect(valleyTransit.minClearanceM).toBeLessThan(ridgeTransit.minClearanceM)
  })

  it('makes commit faster on the egress leg than conserve', () => {
    const conserve = flyOperation(42, 'valley', 'conserve')
    const commit = flyOperation(42, 'valley', 'commit')
    const conserveEgress = conserve.stages.find(stage => stage.id === 'egress')!
    const commitEgress = commit.stages.find(stage => stage.id === 'egress')!
    expect(commitEgress.peakSpeedMps).toBeGreaterThan(conserveEgress.peakSpeedMps)
    expect(commitEgress.elapsedSec).toBeLessThan(conserveEgress.elapsedSec)
    expect(commit.score).not.toBe(conserve.score)
  })
})
