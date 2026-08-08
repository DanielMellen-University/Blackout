/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 *
 * Physics style: Sketchbook-like arcade (not full aero).
 */
export const flightConfig = {
  mass: 10_000,

  /** Peak dry thrust (N). Accel = thrust / mass, then clamped by maxAccel. */
  maxThrust: 280_000,
  boostThrustMul: 1.45,

  /**
   * Speed envelope (m/s).
   * minSpeed: below this airborne, extra sink / weak lift (stall edge).
   * maxSpeed: hard cap on airspeed (dry); boost can slightly exceed via maxSpeedBoost.
   */
  minSpeed: 35,
  maxSpeed: 95,
  /** Absolute cap with afterburner (m/s). */
  maxSpeedBoost: 120,

  /** Peak forward acceleration from thrust (m/s^2), after mass. */
  maxAccel: 18,
  /** Peak speed bleed from drag/brakes feel (m/s^2 scale). */
  maxDecel: 22,

  liftPerSpeed: 0.125,
  maxLiftAccel: 28,

  dragPerSpeed: 0.0055,
  gearDrag: 0.0035,

  gravity: 9.81,

  /**
   * Peak body rates (rad/s) at full stick.
   * Pitch is intentionally lower than roll - W/S was too twitchy.
   */
  pitchRate: 0.55,
  rollRate: 2.2,
  yawRate: 0.95,

  /** Pitch responds slower than roll/yaw for smoother elevator. */
  pitchResponse: 4.5,
  angularResponse: 9,
  angularDamping: 3.5,

  airControlFullSpeed: 30,

  weathervaneRate: 0.45,

  stallAoA: 0.4,
  stallLiftMul: 0.4,
  stallPitchDown: 0.75,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  rotateSpeed: 22,
  rollingDecel: 0.7,
  rotateClimb: 8,
  groundSteer: 1.45,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
