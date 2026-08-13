/**
 * Arcade jet feel (Ace Combat / Afterburner, not MSFS).
 * The nose is the flight path. Tune here.
 */
export const flightConfig = {
  mass: 10_000,

  /** Dry thrust (N). */
  maxThrust: 780_000,
  boostThrustMul: 1.65,

  /** Stall-ish floor (~80 kts). */
  minSpeed: 41,
  /** ~1000 kts dry / ~1040 AB. */
  maxSpeed: 514.44,
  maxSpeedBoost: 535.02,
  /** Level-flight sustain (~180 kts). */
  liftSpeed: 92,

  maxAccel: 26,
  maxAccelBoost: 38,

  /** Quadratic parasite drag. Mid throttle sits ~400 kts; top needs AB. */
  parasiteDrag: 0.000038,
  maxDecel: 26,
  maxBrakeDecel: 48,
  airbrakeStrength: 40,
  wheelBrakeDecel: 34,
  gearDrag: 0.0048,
  rollingDecel: 1.6,

  gravity: 9.81,

  /** How hard velocity snaps onto the nose (the whole turn model). */
  alignRate: 5.4,

  pitchRate: 0.95,
  rollRate: 2.7,
  yawRate: 1.05,
  pitchResponse: 7,
  angularResponse: 12,
  angularDamping: 4.2,
  airControlFullSpeed: 38,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 26,
  rotateClimb: 11,
  groundSteer: 1.7,

  /** Used by (currently disabled) stall warning HUD. */
  stallAoA: 0.4,

  throttleRate: 0.9,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
