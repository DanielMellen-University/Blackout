/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 *
 * Physics style: Sketchbook-like arcade (not full aero).
 */
export const flightConfig = {
  mass: 10_000,

  /** Peak dry thrust (N). Accel = thrust / mass, then clamped by maxAccel. */
  maxThrust: 900_000,
  boostThrustMul: 1.55,

  /**
   * Speed envelope (m/s).
   * minSpeed: below this airborne, extra sink / weak lift (stall edge).
   * maxSpeed: hard cap on airspeed (dry); boost can slightly exceed via maxSpeedBoost.
   */
  minSpeed: 35,
  /** ~1000 knots dry (m/s). */
  maxSpeed: 514.44,
  /** Absolute cap with afterburner (~1040 kts). */
  maxSpeedBoost: 535.02,

  /** Peak forward acceleration from thrust (m/s^2). */
  maxAccel: 42,
  /**
   * Peak coasting drag (m/s^2) at mid throttle.
   * Idle uses maxBrakeDecel via airbrake (see FlightModel).
   */
  maxDecel: 28,
  /** Airbrake / reverse-bleed at zero throttle (m/s^2). */
  maxBrakeDecel: 58,
  /** How hard idle throttle acts as airbrake (0–1 thr maps to this). */
  airbrakeStrength: 52,
  /** Extra wheel brakes on ground when throttle near idle. */
  wheelBrakeDecel: 38,

  liftPerSpeed: 0.125,
  maxLiftAccel: 28,

  /** Light aero drag coefficient (speed-scaled). */
  dragPerSpeed: 0.004,
  gearDrag: 0.0045,

  gravity: 9.81,

  /**
   * Peak body rates (rad/s) at full stick.
   * Pitch is intentionally lower than roll - W/S was too twitchy.
   */
  pitchRate: 0.55,
  rollRate: 2.35,
  yawRate: 1.1,

  /** Pitch responds slower than roll/yaw for smoother elevator. */
  pitchResponse: 4.5,
  angularResponse: 9,
  angularDamping: 3.5,

  airControlFullSpeed: 30,

  /**
   * Soft path-follow (Sketchbook-style): bend velocity toward the nose so
   * yaw/roll actually change the flight path. Too high = sticky; 0 = pure slip.
   */
  pathFollowRate: 1.65,

  /**
   * Coordinated-turn assist: when banked, curve the path about world-up
   * (arcade stand-in for banked-lift turning). rad/s scale at full bank.
   */
  bankTurnRate: 1.35,

  /** Mild weathervane: ease nose toward velocity when stick is quiet. */
  weathervaneRate: 0.32,

  stallAoA: 0.4,
  stallLiftMul: 0.4,
  stallPitchDown: 0.75,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 22,
  rollingDecel: 1.4,
  rotateClimb: 8,
  groundSteer: 1.45,

  /** Throttle spool rate (0-1 per second). Shift up / Ctrl down. */
  throttleRate: 0.9,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
