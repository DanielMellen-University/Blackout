/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 *
 * Physics style: Sketchbook-like arcade (not full aero).
 * Controls rotate the airframe; thrust/drag/lift move the path;
 * mild weathervane aligns the nose into the airflow at speed.
 */
export const flightConfig = {
  mass: 10_000,

  /** Peak dry thrust (N). Accel = thrust / mass. */
  maxThrust: 320_000,
  /** Multiplier while boost (Space) is held. */
  boostThrustMul: 1.55,

  /**
   * Lift acceleration per m/s of airspeed (along body up).
   * Near liftPerSpeed * cruise ≈ gravity for easy level flight.
   */
  liftPerSpeed: 0.125,
  /** Cap on lift acceleration (m/s^2), ~2.8 g. */
  maxLiftAccel: 28,

  /**
   * Speed-proportional drag: each step velocity *= 1 - dragPerSpeed * speed * dt.
   * Higher = lower top speed and snappier bleed-off in turns.
   */
  dragPerSpeed: 0.0055,
  /** Extra drag when gear is down. */
  gearDrag: 0.0035,

  gravity: 9.81,

  /** Peak body rates (rad/s) at full stick and full air influence. */
  pitchRate: 1.55,
  rollRate: 2.4,
  yawRate: 1.05,

  /** How fast angular rates chase the stick (1/s). */
  angularResponse: 10,
  /** Angular rate decay when stick is near neutral (1/s). */
  angularDamping: 3.2,

  /**
   * Airspeed (m/s) at which pitch/roll/yaw reach full authority.
   * Maps to Sketchbook flightModeInfluence = clamp(speed / this, 0, 1).
   */
  airControlFullSpeed: 30,

  /**
   * Mild directional stability (1/s): blend nose toward velocity.
   * Keep low so the player still owns the stick.
   */
  weathervaneRate: 0.5,

  /** AoA (rad) where lift falls off and a soft nose-down is applied. */
  stallAoA: 0.4,
  /** Lift multiplier once past stall AoA (before further falloff). */
  stallLiftMul: 0.4,
  /** Extra nose-down rate (rad/s^2 scale via *dt) in a stall. */
  stallPitchDown: 0.75,

  gearHeight: 1.4,
  bellyHeight: 0.95,

  /** Ground speed (m/s) where rotate (pitch up) becomes effective. */
  rotateSpeed: 22,
  /** Rolling friction decel on the runway (m/s^2). */
  rollingDecel: 0.7,
  /** Extra climb assist (m/s) when rotating off the runway. */
  rotateClimb: 8,
  /** Nosewheel / rudder steer strength on the ground. */
  groundSteer: 1.45,

  crashVy: -14,
  softLandingVy: -6,

  spawn: {
    position: { x: 0, y: 1.4, z: -45 },
    yaw: 0,
    throttle: 0.0,
  },
} as const
