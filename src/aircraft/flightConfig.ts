/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 */
export const flightConfig = {
  mass: 10_000,

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

  /**
   * How hard velocity tracks the nose (1/s).
   * High = you go where you point; low = ice-skate / sideways slide.
   */
  velocityFollow: 4.5,
  /** Extra kill on body-right (sideslip) velocity (1/s). */
  sideslipDamp: 6,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 22,
  rollingDecel: 0.6,
  rotateClimb: 8,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
