/**
 * Central arcade flight feel knobs - tune here first.
 * Units: meters, seconds, Newtons, kg (loose arcade scale).
 */
export const flightConfig = {
  mass: 15_000,

  /** Max thrust at full throttle (N). */
  maxThrust: 220_000,
  /** Extra thrust multiplier while Space boost held. */
  boostThrustMul: 1.45,

  /** Lift ~ 0.5 * rho * v^2 * Cl * S (bundled). */
  liftCoeff: 0.55,
  /** Parasite + induced drag bundle. */
  dragCoeff: 0.045,
  /** Extra drag when gear down. */
  gearDrag: 0.012,

  gravity: 9.81,

  /** Max pitch/roll/yaw rates (rad/s) at full stick. */
  pitchRate: 1.35,
  rollRate: 2.4,
  yawRate: 0.75,

  /** How fast angular velocity tracks stick (1/s). */
  angularResponse: 6,
  /** Passive rate damping when stick released (1/s). */
  angularDamping: 3.2,

  /** AoA (rad) where lift peaks then falls off. */
  stallAoA: 0.32,
  /** Extra nose-down pitch rate when stalled. */
  stallPitchDown: 1.1,

  /** Wheel reference height (aircraft origin above ground when parked). */
  gearHeight: 1.35,
  /** Belly height if gear up. */
  bellyHeight: 0.85,

  /** Min speed (m/s) to rotate nose up off runway. */
  rotateSpeed: 38,
  /** Ground rolling friction (1/s velocity bleed). */
  groundFriction: 0.8,
  /** Max taxi speed contribution from thrust on ground is automatic via drag. */

  /** Align spawn on runway. */
  spawn: {
    position: { x: 0, y: 1.35, z: -45 },
    /** Facing +Z down the runway. */
    yaw: 0,
    throttle: 0.0,
  },
} as const
