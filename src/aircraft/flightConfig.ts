/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 */
export const flightConfig = {
  mass: 12_000,

  /** Max thrust at full throttle (N). */
  maxThrust: 280_000,
  /** Extra thrust multiplier while Space boost held. */
  boostThrustMul: 1.5,

  liftCoeff: 0.72,
  dragCoeff: 0.038,
  gearDrag: 0.01,

  gravity: 9.81,

  pitchRate: 1.5,
  rollRate: 2.6,
  yawRate: 0.85,

  angularResponse: 7,
  angularDamping: 2.8,

  stallAoA: 0.34,
  stallPitchDown: 1.0,

  /** Aircraft origin height above y=0 with gear down (wheels on pavement). */
  gearHeight: 1.4,
  bellyHeight: 0.95,

  /** Min ground speed (m/s) to allow full pitch-up rotation. */
  rotateSpeed: 28,
  /**
   * Rolling resistance (m/s^2 deceleration along ground track).
   * Keep low so you can accelerate to rotate speed.
   */
  rollingDecel: 1.2,

  /** Vertical impact speed (m/s, negative down) that counts as a crash. */
  crashVy: -14,
  /** Soft landing max |vy| when gear down. */
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
