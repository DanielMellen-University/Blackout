import type { Aircraft } from './Aircraft'

/**
 * Arcade flight model (Phase 1+).
 * Phase 0 uses Aircraft.freeFlyStep instead.
 *
 * Planned: thrust, gravity, lift/drag, stall, angular damping, control rates.
 */
export class FlightModel {
  // Tunables (see README Tuning Knobs)
  maxThrust = 180_000
  liftCoeff = 0.8
  dragCoeff = 0.04
  stallAoA = 0.28
  pitchRate = 1.2
  rollRate = 2.0
  yawRate = 0.7
  angularDamping = 2.5

  /**
   * Integrate one fixed physics step.
   * Stub for Phase 0 — not called yet.
   */
  step(_aircraft: Aircraft, _dt: number): void {
    // Phase 1: compute forces/torques and integrate aircraft state
  }
}
