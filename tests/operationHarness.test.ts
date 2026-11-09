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
})
