/**
 * Arcade jet feel (Ace Combat / Afterburner, not MSFS).
 * The nose is the flight path. Tune here.
 */
export const flightConfig = {
  mass: 10_000,

  /** Dry thrust (N). */
  maxThrust: 780_000,
  boostThrustMul: 2 * (650 / 340) ** 2,

  /** Normalized reserve; full burst lasts 5 s, passive refill takes 20 s. */
  nitroDrainPerSecond: 1 / 5,
  nitroRefillPerSecond: 1 / 20,
  nitroGateRefill: 0.25,
  /** Hysteresis prevents empty-edge flicker even with boost held. */
  nitroRestartFraction: 0.15,
  /** Feedback dimensions, scaled by the resolved burner and throttle. */
  dryPlumeLength: 1.4,
  boostPlumeLength: 3.4,
  boostPlumeWidth: 1.5,
  boostNozzleGlow: 10,
  boostChasePullback: 10,
  boostChaseLookLeadScale: 0.15,
  boostChaseLookOffsetZ: -2,

  /** Low-speed lift reference, m/s (~93 kt); not an artificial speed floor. */
  minSpeed: 48,
  /** Level military cruise, m/s (~660 kt). Thrust balances drag here. */
  cruiseSpeed: 340,
  /** Natural thrust/drag equilibrium, not a boost speed limit. */
  cruiseSpeedBoost: 650 * Math.SQRT2,
  /** Dry dive cap, m/s (~1320 kt). Nitro excess decays through drag. */
  maxSpeed: 680,
  /** Legacy dev-review speed reference, not a nitro limit. */
  maxSpeedBoost: 680,
  /** Full low-angle lift support, m/s (~132 kt). Stall sink grows below this. */
  liftSpeed: 68,

  /** Full military acceleration at low speed, m/s². */
  milAccel: 48,
  maxAccel: 130,
  /** Afterburner cannot light with the throttle effectively closed. */
  afterburnerMinThrottle: 0.05,
  /** Treat the lever as closed below this; idle then bleeds speed instead of holding it. */
  idleLever: 0.18,
  /** Extra deceleration while the lever is closed, m/s². */
  idleBleed: 26,

  /** Extra bleed only - cruise speed is set by ENG%, not this. */
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

  /** Flight-path alignment at full lift. It softens continuously in a stall. */
  alignRate: 6.2,

  pitchRate: 1.18,
  rollRate: 3.45,
  yawRate: 1.05,
  pitchResponse: 10,
  angularResponse: 14,
  angularDamping: 4.2,
  airControlFullSpeed: 90,
  /** Half-strength trim, delayed after yaw/roll input so it never fights a turn. */
  stabilityAssistPitch: 0.575,
  stabilityAssistRoll: 0.9,
  stabilityAssistDeadzone: 0.08,
  stabilityAssistDelay: 2,
  /** Subtle airborne weather torque, scaled by the active front's gust value. */
  turbulencePitch: 0.16,
  turbulenceRoll: 0.24,
  turbulenceYaw: 0.08,
  /** Arcade lateral wind response, strongest during approach speeds. */
  weatherWindAcceleration: 0.18,
  weatherWindSpeedFalloff: 480,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 40,
  rotateClimb: 8,
  groundSteer: 1.7,

  /** Smooth aerodynamic separation starts here, in radians. No alert system. */
  stallAoA: 0.32,
  stallAoAFull: 0.68,
  /** Gentle nose drop at low lift, rad/s, with enough forward-stick recovery. */
  stallNoseDrop: 0.36,
  /** Induced deceleration per squared turn load at cruise, m/s². */
  inducedDrag: 0.16,
  maxDragLoad: 10,

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
