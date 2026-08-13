/**
 * Arcade flight feel knobs. Tune here first.
 * Units: meters, seconds (loose arcade scale).
 *
 * Not a coefficient sim. Energy + attitude should still read as a jet:
 * pull hard = bleed speed, bank = turn, idle = brake, AB = kick.
 */
export const flightConfig = {
  mass: 10_000,

  /** Peak dry thrust (N). Accel = thrust/mass then clamped. */
  maxThrust: 620_000,
  boostThrustMul: 1.72,

  /**
   * Speed envelope (m/s).
   * minSpeed: below this airborne, lift collapses (stall edge).
   * maxSpeed: dry cap; boost uses maxSpeedBoost.
   */
  minSpeed: 42,
  /** ~1000 knots dry. */
  maxSpeed: 514.44,
  /** ~1040 knots AB. */
  maxSpeedBoost: 535.02,
  /** Airspeed where 1G level flight is comfortable (~210 kts). */
  cruiseSpeed: 108,

  /** Peak forward acceleration from dry thrust (m/s^2). */
  maxAccel: 22,
  /** Extra accel budget with AB. */
  maxAccelBoost: 34,
  /**
   * Parasite drag scale (quadratic). Higher = harder to reach top speed.
   * Tuned so mid throttle cruises ~350–450 kts; 1000 kts wants AB.
   */
  parasiteDrag: 0.000048,
  /** Induced drag when pulling lift (bleed in turns / loops). */
  inducedDrag: 0.014,
  /** Peak coasting decel cap (m/s^2) at mid throttle. */
  maxDecel: 24,
  /** Airbrake / reverse-bleed at idle (m/s^2). */
  maxBrakeDecel: 52,
  airbrakeStrength: 44,
  wheelBrakeDecel: 36,
  gearDrag: 0.0055,

  /** Lift scale so cruiseSpeed ~ sustains 1G in level flight. */
  liftAuthority: 11.2,
  maxLiftAccel: 42,
  /** Auto-trim: fraction of gravity cancelled when flying fast and wings level. */
  autoLift: 0.88,

  gravity: 9.81,

  /**
   * Peak body rates (rad/s) at full stick, mid speed.
   * High speed damps pitch (q-feel); low speed is mushy.
   */
  pitchRate: 0.72,
  rollRate: 2.55,
  yawRate: 0.95,
  pitchResponse: 5.2,
  angularResponse: 10,
  angularDamping: 3.8,
  /** Speed where full aero authority unlocks. */
  airControlFullSpeed: 48,

  pathFollowRate: 2.05,
  bankTurnRate: 1.55,
  weathervaneRate: 0.38,

  stallAoA: 0.36,
  stallLiftMul: 0.38,
  stallPitchDown: 0.95,
  /** Extra speed bleed when |AoA| is high (pulling G). */
  pullBleed: 9.5,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 24,
  rollingDecel: 1.5,
  rotateClimb: 9,
  groundSteer: 1.55,

  throttleRate: 0.9,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
