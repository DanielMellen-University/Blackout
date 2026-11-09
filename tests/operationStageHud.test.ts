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

})
