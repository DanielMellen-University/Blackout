import { Quaternion, Vector3 } from 'three'

const _forward = new Vector3()
const HORIZONTAL_HEADING_EPSILON = 0.08

/**
 * Resolve a stable world-Y heading from the aircraft nose.
 *
 * During a loop the nose can point almost straight up or down, where a
 * horizontal atan2 has no meaningful answer. Retain the last reliable
 * heading in that narrow band so HUD, return guidance, and camera framing do
 * not jump by 180 degrees.
 */
export function headingFromOrientation(
  orientation: Quaternion,
  fallbackHeading = 0,
): number {
  if (!finiteQuaternion(orientation) || !Number.isFinite(fallbackHeading)) {
    return Number.isFinite(fallbackHeading) ? fallbackHeading : 0
  }
  _forward.set(0, 0, 1).applyQuaternion(orientation)
  if (Math.hypot(_forward.x, _forward.z) <= HORIZONTAL_HEADING_EPSILON) {
    return fallbackHeading
  }
  return Math.atan2(_forward.x, _forward.z)
}

function finiteQuaternion(value: Quaternion): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Number.isFinite(value.z) && Number.isFinite(value.w)
}
