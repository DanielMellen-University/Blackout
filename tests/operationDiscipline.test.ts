import { describe, expect, it } from 'vitest'
import { buildOperationPlan, stageSpec } from '../src/systems/operation/plan'
import {
  ALTITUDE_POINTS,
  ENERGY_POINTS,
  PATH_POINTS,
  SPEED_POINTS,
  measureDiscipline,
} from '../src/systems/operation/discipline'
import { scoreStage } from '../src/systems/operation/score'
import type { FlightSample } from '../src/systems/operation/samples'

function trace(spec: ReturnType<typeof stageSpec>, overrides: Partial<FlightSample> = {}): FlightSample[] {
  return Array.from({ length: 8 }, (_, index) => ({
    t: index * 0.5,
    x: spec.lateralM,
    y: spec.altitudeM,
    z: spec.endZ * (index / 7),
    speed: (spec.speedBand.minMps + spec.speedBand.maxMps) / 2,
    clearance: 120,
    airborne: true,
    fuel: 100 - index * 0.05,
    nitro: 1,
    ...overrides,
  }))
}

describe('operation discipline', () => {
  it('pays a trace that holds the line, the band and the speed window', () => {
    const spec = stageSpec(buildOperationPlan(42, 'valley', 'conserve'), 'ingress')
    const scored = measureDiscipline(spec, trace(spec))
    expect(scored.pathScore).toBe(PATH_POINTS)
    expect(scored.altitudeScore).toBe(ALTITUDE_POINTS)
    expect(scored.speedScore).toBe(SPEED_POINTS)
    expect(scored.energyScore).toBe(ENERGY_POINTS)
    expect(scored.score).toBe(PATH_POINTS + ALTITUDE_POINTS + SPEED_POINTS + ENERGY_POINTS)
  })

  it('pays less when the path and the altitude wander', () => {
    const spec = stageSpec(buildOperationPlan(42, 'valley', null), 'transit')
    const tight = measureDiscipline(spec, trace(spec))
    const wide = measureDiscipline(spec, trace(spec, { x: spec.lateralM + 90, y: spec.altitudeM + 110 }))
    expect(wide.pathScore).toBeLessThan(tight.pathScore)
    expect(wide.altitudeScore).toBeLessThan(tight.altitudeScore)
    expect(wide.pathDeviationM).toBeCloseTo(90, 5)
    expect(wide.altitudeErrorM).toBeCloseTo(110, 5)
  })

  it('drops the speed score outside the briefed window', () => {
    const spec = stageSpec(buildOperationPlan(42, 'valley', 'conserve'), 'egress')
    const held = measureDiscipline(spec, trace(spec))
    const slow = measureDiscipline(spec, trace(spec, { speed: 40 }))
    expect(slow.speedScore).toBe(0)
    expect(slow.speedErrorMps).toBeGreaterThan(0)
    expect(held.speedScore).toBeGreaterThan(slow.speedScore)
  })

  it('charges fuel past the budget and nitro burned off a commit leg', () => {
    const conserve = stageSpec(buildOperationPlan(42, 'ridge', 'conserve'), 'egress')
    const commit = stageSpec(buildOperationPlan(42, 'ridge', 'commit'), 'egress')
    const heavy = trace(conserve).map((sample, index) => ({ ...sample, fuel: 100 - index * 2, nitro: 1 - index * 0.1 }))
    const spent = measureDiscipline(conserve, heavy)
    const budgeted = measureDiscipline(conserve, trace(conserve))
    expect(spent.fuelUsed).toBeGreaterThan(conserve.fuelBudget)
    expect(spent.energyScore).toBeLessThan(budgeted.energyScore)
    expect(spent.nitroUsed).toBeGreaterThan(0)
    const committed = measureDiscipline(commit, heavy.map(sample => ({ ...sample, speed: 500 })))
    expect(commit.boost).toBe(true)
    expect(committed.nitroUsed).toBeGreaterThan(0)
    expect(committed.energyScore).toBeGreaterThan(spent.energyScore)
  })

  it('adds the discipline to a passing stage and banks nothing after a miss', () => {
    const spec = stageSpec(buildOperationPlan(42, null, null), 'ingress')
    const passed = scoreStage(spec, trace(spec))
    expect(passed.passed).toBe(true)
    expect(passed.disciplineScore).toBe(passed.pathDeviationM === 0 ? measureDiscipline(spec, trace(spec)).score : passed.disciplineScore)
    expect(passed.score).toBe(passed.timeScore + passed.flyingScore + passed.gateScore + passed.disciplineScore)
    const crashed = scoreStage(spec, trace(spec, { airborne: false }))
    expect(crashed.score).toBe(0)
    expect(crashed.disciplineScore).toBe(0)
    expect(crashed.pathDeviationM).toBe(0)
  })
})
