/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 */
export const flightConfig = {
  mass: 10_000,

  /** Max thrust at full throttle (N) - strong for easy takeoff. */
  maxThrust: 320_000,
  boostThrustMul: 1.55,

  liftCoeff: 0.95,
  dragCoeff: 0.032,
  gearDrag: 0.008,

  gravity: 9.81,

  pitchRate: 1.65,
  rollRate: 2.6,
  yawRate: 0.9,

  angularResponse: 8,
  angularDamping: 2.5,

  stallAoA: 0.38,
  stallPitchDown: 0.9,

  /** Aircraft origin height above y=0 with gear down. */
  gearHeight: 1.4,
  bellyHeight: 0.95,

  /** Ground speed (m/s) to allow rotate / liftoff assist. */
  rotateSpeed: 22,
  /** Mild rolling resistance (m/s^2). */
  rollingDecel: 0.6,

  /** Climb rate added when rotating for takeoff (m/s). */
  rotateClimb: 8,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
