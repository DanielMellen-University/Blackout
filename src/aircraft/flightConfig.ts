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
  /** Level military cruise, m/s (~660 kt). Thrust balances drag here. */
  cruiseSpeed: 340,
  /** Level afterburner cruise, m/s (~1010 kt). */
  cruiseSpeedBoost: 520,
  /** Dive cap, m/s (~1320 kt). Dry and afterburner share it. */
  maxSpeed: 680,
  maxSpeedBoost: 680,
  /** Level-flight sustain (~180 kts). */
  liftSpeed: 92,

  /** Full military acceleration at low speed, m/s². */
  milAccel: 48,
  maxAccel: 130,
  maxAccelBoost: 190,
  /** Afterburner cannot light with the throttle effectively closed. */
  afterburnerMinThrottle: 0.05,
  /** Treat the lever as closed below this; idle then bleeds speed instead of holding it. */
  idleLever: 0.18,
  /** Extra deceleration while the lever is closed, m/s². */
  idleBleed: 26,

  /** Extra bleed only — cruise speed is set by ENG%, not this. */
  parasiteDrag: 0.000038,
  maxDecel: 130,
  /** Mild overspeed bleed while the engine is still spooled (below gravity). */
  coastDecel: 3,
  maxBrakeDecel: 240,
  /** Airborne speed-brake bleed, m/s². Tuned to dump the raised mil cruise. */
  airbrakeStrength: 220,
  wheelBrakeDecel: 170,
  gearDrag: 0.0048,
  rollingDecel: 1.6,

  gravity: 9.81,

  /** Bounded arcade updraft force from deterministic thermal pockets. */
  thermalLiftAcceleration: 2.4,

  /** How hard velocity snaps onto the nose (the whole turn model). */
  alignRate: 5.4,

  pitchRate: 0.95,
  rollRate: 2.7,
  yawRate: 1.05,
  pitchResponse: 7,
  angularResponse: 12,
  angularDamping: 4.2,
  airControlFullSpeed: 38,
  /** Optional trim assist gain. It only engages when its axis is released. */
  stabilityAssistPitch: 1.15,
  stabilityAssistRoll: 1.8,
  stabilityAssistDeadzone: 0.08,
  /** Subtle airborne weather torque, scaled by the active front's gust value. */
  turbulencePitch: 0.16,
  turbulenceRoll: 0.24,
  turbulenceYaw: 0.08,
  /** Arcade lateral wind response, strongest during approach speeds. */
  weatherWindAcceleration: 0.18,
  weatherWindSpeedFalloff: 480,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 26,
  rotateClimb: 11,
  groundSteer: 1.7,

  /** Stall AoA reference used by the tuned flight warning HUD. */
  stallAoA: 0.4,

  throttleRate: 1.8,

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
