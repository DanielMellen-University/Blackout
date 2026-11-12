import { describe, expect, it } from 'vitest'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'
import { getTerrainProfile, setTerrainProfile, type TerrainProfile } from '../src/world/TerrainProfile'
import { commitAttempt, emptyProgress, loadProgress, memoryOperationStore, writeProgress } from '../src/systems/operation/save'
import { flyOperation } from '../src/systems/operation/harness'
import { replayOperation } from '../src/systems/operation/replay'
import { clearOpsPad, getOpsPad, setOpsPad } from '../src/world/terrainSample'
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

  it('repeats a path with the same score and stage times', () => {
    const first = flyOperation(42, 'ridge', 'commit')
    const second = flyOperation(42, 'ridge', 'commit')
    expect(second.score).toBe(first.score)
    expect(second.stages.map(stage => stage.steps)).toEqual(first.stages.map(stage => stage.steps))
    expect(second.stages.map(stage => stage.peakSpeedMps)).toEqual(first.stages.map(stage => stage.peakSpeedMps))
  })

  it('replays the measured transcript to the same score', () => {
    const measured = flyOperation(42, 'valley', 'commit')
    expect(measured.transcript).not.toBeNull()
    const replayed = replayOperation(measured.transcript!)
    expect(replayed.attempt.phase).toBe('complete')
    expect(replayed.attempt.score).toBe(measured.score)
  })

  it('saves the finish and reloads it', () => {
    const measured = flyOperation(42, 'ridge', 'conserve')
    const store = memoryOperationStore()
    writeProgress(store, commitAttempt(emptyProgress(), measured.attempt, measured.transcript))
    const loaded = loadProgress(store)
    expect(loaded?.best?.score).toBe(measured.score)
    expect(loaded?.best?.route).toBe('ridge')
    expect(loaded?.replay?.energy).toBe('conserve')
    expect(replayOperation(loaded!.replay!).attempt.score).toBe(measured.score)
  })

  it('restores the surrounding world pad after a harness flight', () => {
    const previousPad = getOpsPad()
    setOpsPad(4, 5, 6, 0.2)
    try {
      flyOperation(42, 'valley', 'commit')
      expect(getOpsPad()).toEqual({ x: 4, z: 5, y: 6, yaw: 0.2 })
    } finally {
      if (previousPad) setOpsPad(previousPad.x, previousPad.z, previousPad.y, previousPad.yaw)
      else clearOpsPad()
    }
  })

  it('restores the world seed and terrain profile', () => {
    setWorldSeed(99)
    setTerrainProfile(marker)
    flyOperation(42, 'valley', 'conserve')
    expect(getWorldSeed()).toBeCloseTo(99, 6)
    expect(getTerrainProfile()).toEqual(marker)
    setTerrainProfile(null)
  })
})
