import type { Aircraft } from './Aircraft'

/**
 * Arcade flight model - Phase 1 (not wired yet).
 * Phase 0 uses Aircraft.freeFlyStep.
 */
export class FlightModel {
  maxThrust = 180_000
  liftCoeff = 0.8
  dragCoeff = 0.04
  stallAoA = 0.28
  pitchRate = 1.2
  rollRate = 2.0
  yawRate = 0.7
  angularDamping = 2.5

  step(_aircraft: Aircraft, _dt: number): void {
    // Phase 1: thrust, gravity, lift/drag, stall, integrate
  }
}
