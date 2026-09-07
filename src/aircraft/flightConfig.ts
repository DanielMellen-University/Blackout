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
  /** ~3000 kts dry / ~3120 AB. */
  maxSpeed: 1543.32,
  maxSpeedBoost: 1605.06,
  /** Level-flight sustain (~180 kts). */
  liftSpeed: 92,

  maxAccel: 130,
  maxAccelBoost: 190,
  /** Afterburner cannot light with the throttle effectively closed. */
  afterburnerMinThrottle: 0.05,
  /** Treat the lever as closed below this; speed hold then brakes instead of coasting. */
  idleLever: 0.18,
  /** How hard IAS chases the ENG% target (1/s). */
  speedSeek: 7.25,

  /** Extra bleed only — cruise speed is set by ENG%, not this. */
  parasiteDrag: 0.000038,
  maxDecel: 130,
  /** Mild overspeed bleed while the engine is still spooled (below gravity). */
  coastDecel: 3,
  maxBrakeDecel: 240,
  airbrakeStrength: 200,
  wheelBrakeDecel: 170,
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

  throttleRate: 0.396,

  crashVy: -14,
  softLandingVy: -6,

  /** Contact / landing envelope. */
  contactSweepSpacing: 2,
  maxLandingSpeed: 75,
  maxLandingSlope: 14 * (Math.PI / 180),
  maxLandingPitch: 24 * (Math.PI / 180),
  maxLandingBank: 30 * (Math.PI / 180),

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
