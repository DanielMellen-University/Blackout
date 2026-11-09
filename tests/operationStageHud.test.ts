import { describe, expect, it } from 'vitest'
import { createAttempt } from '../src/systems/operation/attempt'
import type { FlightSample } from '../src/systems/operation/samples'
import { operationHudModel, operationLegProgress } from '../src/ui/operation/hud'

const sample: FlightSample = {
  t: 1, x: 0, y: 420, z: 800, speed: 180, clearance: 90, airborne: true,
}

describe('operation stage HUD', () => {
  it('names ridge relay and stage 1 during ingress', () => {
    const hud = operationHudModel(createAttempt(42), null)
    expect(hud.title).toBe('Ridge relay')
    expect(hud.stageLabel).toContain('Stage 1 of 3')
    expect(hud.stageLabel).toContain('ingress')
    expect(hud.stageLabel).toContain('seed 42')
    expect(hud.decisions).toEqual([])
    expect(hud.prompt).toBe('')
    expect(hud.speedLabel).toBe('—')
    expect(hud.airborneLabel).toBe('—')
  })

  it('shows live speed, clearance and leg progress', () => {
    const hud = operationHudModel(createAttempt(42), sample)
    expect(hud.speedLabel).toBe('180 m/s')
    expect(hud.clearanceLabel).toBe('90 m')
    expect(hud.airborneLabel).toBe('Airborne')
    expect(hud.progressLabel).toBe(operationLegProgress(createAttempt(42), sample))
    expect(hud.progressLabel.endsWith('%')).toBe(true)
  })

  it('says stopped when the sample is not airborne', () => {
    const hud = operationHudModel(createAttempt(42), { ...sample, airborne: false })
    expect(hud.airborneLabel).toBe('Stopped')
    expect(hud.brief.toLowerCase()).not.toContain('land')
  })

  it('offers valley and ridge after ingress', () => {
    const attempt = { ...createAttempt(42), phase: 'route-choice' as const }
    const hud = operationHudModel(attempt, sample)
    expect(hud.decisions).toEqual(['valley', 'ridge'])
    expect(hud.prompt).toBe('Valley or ridge')
    expect(hud.stageLabel).toContain('Stage 2 of 3')
    expect(hud.brief).toContain('valley or ridge')
  })

  it('names the chosen route during transit', () => {
    const attempt = { ...createAttempt(42), phase: 'transit' as const, route: 'valley' as const }
    const hud = operationHudModel(attempt, sample)
    expect(hud.stageLabel).toContain('valley')
    expect(hud.decisions).toEqual([])
  })

  it('offers conserve and commit after transit', () => {
    const attempt = { ...createAttempt(42), phase: 'energy-choice' as const, route: 'ridge' as const }
    const hud = operationHudModel(attempt, sample)
    expect(hud.decisions).toEqual(['conserve', 'commit'])
    expect(hud.prompt).toBe('Conserve or commit')
    expect(hud.stageLabel).toContain('Stage 3 of 3')
    expect(hud.brief).toContain('conserve or commit')
  })

})
