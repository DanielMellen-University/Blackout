import { MathUtils } from 'three'

/** Precipitation must clear this before storm buffet engages (matches STORM RUN). */
export const STORM_PRECIP_ENTER = 0.25
/** Gusts must clear this before they alone drive buffet (below GUST RIDER floor). */
export const STORM_GUST_ENTER = 0.55
/** External chase / orbit amplitude multiplier. */
export const STORM_EXTERNAL_SCALE = 1
/** Cockpit reads the weather slightly harder than chase. */
export const STORM_COCKPIT_SCALE = 1.32
/** Low graphics keeps the same phase math but damps travel. */
export const STORM_LOW_QUALITY_SCALE = 0.62
/** Peak camera translation (meters) at full storm intensity on external view. */
export const STORM_CAMERA_TRAVEL_M = 0.055
/** Peak airframe Euler wobble (radians) at full storm intensity. */
export const STORM_AIRFRAME_RAD = 0.012

export interface StormBuffetOffset {
  x: number
  y: number
  z: number
}

export interface StormBuffetGate {
  reducedMotion?: boolean
  paused?: boolean
  playing?: boolean
}

/**
 * Collapse rain, snow, and gust telemetry into one finite 0..1 buffet drive.
 * Quiet below meaningful precip / strong-gust floors; no allocations.
 */
export function stormBuffetIntensity(rain: number, snow: number, gust: number): number {
  const precip = Math.max(clamp01(rain), clamp01(snow))
  const precipDrive = precip <= STORM_PRECIP_ENTER
    ? 0
    : MathUtils.smoothstep(precip, STORM_PRECIP_ENTER, 1)
  const gustValue = clamp01(gust)
  const gustDrive = gustValue <= STORM_GUST_ENTER
    ? 0
    : MathUtils.smoothstep(gustValue, STORM_GUST_ENTER, 1)
  if (precipDrive <= 0 && gustDrive <= 0) return 0
  // Prefer the stronger cue, with a small overlap lift when both are present.
  return MathUtils.clamp(
    Math.max(precipDrive, gustDrive * 0.94) + Math.min(precipDrive, gustDrive) * 0.16,
    0,
    1,
  )
}

/** Hard gate used by camera / airframe callers before applying motion. */
export function stormBuffetAllowed(gate: StormBuffetGate = {}): boolean {
  if (gate.reducedMotion === true) return false
  if (gate.paused === true) return false
  if (gate.playing === false) return false
  return true
}

/** Resolve the gated 0..1 drive that actually moves the camera or airframe. */
export function stormBuffetDrive(
  rain: number,
  snow: number,
  gust: number,
  gate: StormBuffetGate = {},
): number {
  if (!stormBuffetAllowed(gate)) return 0
  return stormBuffetIntensity(rain, snow, gust)
}

/** View and quality multiplier applied on top of the weather drive. */
export function stormBuffetViewScale(
  cockpit: boolean,
  lowQuality = false,
): number {
  const view = cockpit ? STORM_COCKPIT_SCALE : STORM_EXTERNAL_SCALE
  const quality = lowQuality ? STORM_LOW_QUALITY_SCALE : 1
  return view * quality
}

/** Smooth, restrained camera travel for precipitation / gust buffet. */
export function stormBuffetOffset(
  phase: number,
  intensity: number,
  travelM = STORM_CAMERA_TRAVEL_M,
): StormBuffetOffset {
  return stormBuffetOffsetInto({ x: 0, y: 0, z: 0 }, phase, intensity, travelM)
}

/** Fill a caller-owned offset record without allocating. */
export function stormBuffetOffsetInto(
  out: StormBuffetOffset,
  phase: number,
  intensity: number,
  travelM = STORM_CAMERA_TRAVEL_M,
): StormBuffetOffset {
  const safePhase = Number.isFinite(phase) ? phase : 0
  const scale = Number.isFinite(intensity) ? MathUtils.clamp(intensity, 0, 1) : 0
  const travel = Number.isFinite(travelM) ? Math.max(0, travelM) : STORM_CAMERA_TRAVEL_M
  if (scale <= 0 || travel <= 0) {
    out.x = 0
    out.y = 0
    out.z = 0
    return out
  }
  // Softer envelope than impact shake: readable in weather, never crash-punchy.
  out.x = (Math.sin(safePhase * 1.35) * 0.68 + Math.sin(safePhase * 2.7 + 0.9) * 0.32) * travel * scale
  out.y = (Math.sin(safePhase * 1.9 + 0.55) * 0.7 + Math.sin(safePhase * 3.4) * 0.3) * travel * 0.62 * scale
  out.z = (Math.cos(safePhase * 1.15 + 1.3) * 0.66 + Math.sin(safePhase * 2.95 - 0.4) * 0.34) * travel * 0.9 * scale
  return out
}

/** Tiny airframe Euler wobble driven by the same weather intensity. */
export function stormAirframeWobble(
  phase: number,
  intensity: number,
  amplitude = STORM_AIRFRAME_RAD,
): StormBuffetOffset {
  return stormBuffetOffsetInto(
    { x: 0, y: 0, z: 0 },
    phase,
    intensity,
    Number.isFinite(amplitude) ? Math.max(0, amplitude) : STORM_AIRFRAME_RAD,
  )
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return MathUtils.clamp(value, 0, 1)
}
