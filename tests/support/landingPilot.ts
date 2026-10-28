import { Quaternion, Vector3 } from 'three'
import type { Aircraft } from '../../src/aircraft/Aircraft'

// Test-only Free flight circuit pilot. It writes aircraft controls only, never
// pose, velocity or terrain: takeoff, a terrain-following join to the final,
// an approach profile chosen to clear the approach terrain, speed control, a
// flare to under about 1 m/s of sink and a braked rollout on the runway pad.
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const DEG = Math.PI / 180

export interface Pad { x: number; y: number; z: number; yaw: number }
export type Ground = (x: number, z: number) => number

export interface LandingPlan {
  /** +1 lands along the runway heading, -1 lands the reciprocal. */
  direction: 1 | -1
  cruiseY: number
  finalM: number
  /** Approach height above the pad every PROFILE_STEP_M back from the aim point. */
  profile: number[]
  /** Steepest descent the profile needs anywhere, in degrees. */
  maxGlideDeg: number
}

const AIM_M = 160 // cross this point, 6 m up, before the pad centre so the flare settles on the flat pad
const FINAL_M = 6000
export const PROFILE_STEP_M = 50
const BASE_GLIDE = Math.tan(3 * DEG)
const MAX_GLIDE = Math.tan(8 * DEG)

/**
 * Choose the runway end and a terrain-clearing approach profile: a 3 degree
 * glide where the ground allows, never steeper than 8 degrees, and always
 * above the approach terrain plus a clearance that shrinks near the runway.
 */
export function planLanding(pad: Pad, ground: Ground): LandingPlan | null {
  let best: LandingPlan | null = null
  const cruiseY = pad.y + 300
  for (const direction of [1, -1] as const) for (const finalM of [FINAL_M, 4000, 2800, 2000]) {
    const steps = finalM / PROFILE_STEP_M
    const obstacle: number[] = []
    for (let i = 0; i <= steps; i++) {
      const d = i * PROFILE_STEP_M
      if (d < 100) { obstacle.push(0); continue }
      const clearance = Math.min(65, 5 + d * .04)
      let worst = -Infinity
      for (const r of [-60, 0, 60]) worst = Math.max(worst, groundAt(pad, ground, r, direction * (-AIM_M - d)))
      obstacle.push(worst + clearance - pad.y)
    }
    const profile: number[] = []
    let feasible = true
    for (let i = 0; i <= steps; i++) {
      const d = i * PROFILE_STEP_M
      let h = BASE_GLIDE * d
      for (let j = 0; j <= steps; j++) {
        const dj = j * PROFILE_STEP_M
        h = Math.max(h, j <= i ? obstacle[j]! : obstacle[j]! - MAX_GLIDE * (dj - d))
      }
      profile.push(h)
    }
    if (profile[0]! > 8) feasible = false
    let maxGlide = 0
    for (let i = 1; i <= steps; i++) maxGlide = Math.max(maxGlide, Math.atan((profile[i]! - profile[i - 1]!) / PROFILE_STEP_M))
    if (!feasible) continue
    const plan: LandingPlan = { direction, cruiseY: Math.max(cruiseY, pad.y + profile[steps]! + 100), finalM, profile, maxGlideDeg: maxGlide / DEG }
    // Prefer the gentlest approach; a longer final wins near-ties.
    if (!best || plan.maxGlideDeg < best.maxGlideDeg - .5) best = plan
  }
  return best
}

function groundAt(pad: Pad, ground: Ground, right: number, forward: number): number {
  const fx = Math.sin(pad.yaw), fz = Math.cos(pad.yaw)
  return ground(pad.x + fx * forward + fz * right, pad.z + fz * forward - fx * right)
}

export function createLandingPilot(aircraft: Aircraft, pad: Pad, plan: LandingPlan, ground: Ground) {
  const yaw = pad.yaw + (plan.direction === 1 ? 0 : Math.PI)
  const fx = Math.sin(yaw), fz = Math.cos(yaw)
  const profileAt = (distance: number) => {
    const q = clamp(distance / PROFILE_STEP_M, 0, plan.profile.length - 1), i = Math.floor(q), f = q - i
    const a = plan.profile[i]!, b = plan.profile[Math.min(i + 1, plan.profile.length - 1)]!
    return { height: a + (b - a) * f, slope: (b - a) / PROFILE_STEP_M }
  }
  const fwd = new Vector3(), inv = new Quaternion(), up = new Vector3()
  // Landing-frame waypoints (right, forward from the aim point). Departure
  // always uses the runway heading; the circuit then joins the chosen final.
  const local = (r: number, f: number) => ({ x: pad.x + fx * f + fz * r, z: pad.z + fz * f - fx * r })
  const aim = local(0, -AIM_M)
  // Join the final from the lower side, 1.5 km outside the entry point.
  const side = groundAt(pad, ground, 1500, -plan.direction * (AIM_M + plan.finalM + 1500)) <
    groundAt(pad, ground, -1500, -plan.direction * (AIM_M + plan.finalM + 1500)) ? 1 : -1
  const waypoints = [
    { ...local(side * 1500 * plan.direction, -plan.finalM - 1500), stage: 'join' },
    { ...local(0, -plan.finalM), stage: 'base' },
  ]
  let stage: 'takeoff' | 'circuit' | 'final' | 'rollout' = 'takeoff'
  let waypoint = 0
  const state = { stage: () => stage, waypoint: () => waypoint }

  const steer = (headingCmd: number, heading: number) => {
    const c = aircraft.controls
    const error = Math.atan2(Math.sin(headingCmd - heading), Math.cos(headingCmd - heading))
    c.yaw = clamp(error * 2.5 - aircraft.angularVelocity.y * .4, -1, 1)
  }
  const holdVerticalSpeed = (vyCmd: number, pitch: number, maxPitch: number) => {
    const c = aircraft.controls
    const speed = Math.max(aircraft.speed, 30)
    const pathCorrection = clamp((vyCmd - aircraft.velocity.y) / speed * 2.2, -.3, .3)
    const target = Math.min(maxPitch, pitch + pathCorrection)
    c.pitch = clamp((target - pitch) * 3 + aircraft.angularVelocity.x * .4, -1, 1)
  }
  const holdSpeed = (speedCmd: number, gearDrag: boolean) => {
    const c = aircraft.controls
    const feed = (aircraft.speed / 340) ** 2 + (gearDrag ? .0048 * aircraft.speed ** 2 * .55 / 48 : 0)
    c.throttle = clamp(feed + (speedCmd - aircraft.speed) * .03, 0, 1)
    c.airbrake = aircraft.speed > speedCmd + 8
    c.boost = false
  }

  function before(): void {
    const c = aircraft.controls, p = aircraft.position
    fwd.set(0, 0, 1).applyQuaternion(aircraft.orientation)
    inv.copy(aircraft.orientation).invert(); up.set(0, 1, 0).applyQuaternion(inv)
    const pitch = Math.asin(clamp(fwd.y, -1, 1)), heading = Math.atan2(fwd.x, fwd.z), roll = Math.atan2(-up.x, up.y)
    c.roll = clamp(-roll * 2 + aircraft.angularVelocity.z * .4, -1, 1)
    c.stabilityAssist = true
    const along = (p.x - aim.x) * fx + (p.z - aim.z) * fz // negative before the aim point
    const lateral = (p.x - aim.x) * fz - (p.z - aim.z) * fx

    // Terrain floor along the current heading and toward the target.
    const floorAhead = (towardX: number, towardZ: number) => {
      let floor = -Infinity
      const tx = towardX - p.x, tz = towardZ - p.z, tl = Math.max(1, Math.hypot(tx, tz))
      for (const ahead of [0, 300, 600, 1000, 1500, 2000]) {
        floor = Math.max(floor, ground(p.x + Math.sin(heading) * ahead, p.z + Math.cos(heading) * ahead))
        const t = Math.min(ahead, tl)
        floor = Math.max(floor, ground(p.x + tx / tl * t, p.z + tz / tl * t))
      }
      return floor
    }

    if (stage === 'takeoff') {
      c.airbrake = false; c.boost = false
      steer(pad.yaw, heading)
      if (aircraft.onGround) {
        c.throttle = 1
        c.pitch = aircraft.speed > 45 ? clamp((8 * DEG - pitch) * 3, -.3, .6) : 0
      } else {
        holdVerticalSpeed(18, pitch, 16 * DEG)
        holdSpeed(110, c.gearDown)
      }
      if (!aircraft.onGround && aircraft.altitudeAgl > 40 && c.gearDown) aircraft.toggleGear()
      if (aircraft.altitudeAgl > 150) stage = 'circuit'
      return
    }

    if (stage === 'circuit') {
      const w = waypoints[waypoint]!
      const dx = w.x - p.x, dz = w.z - p.z
      steer(Math.atan2(dx, dz), heading)
      const entryY = pad.y + profileAt(plan.finalM).height
      const floor = floorAhead(w.x, w.z) + 250
      const altCmd = Math.max(floor, w.stage === 'base' ? entryY : Math.max(entryY, plan.cruiseY))
      holdVerticalSpeed(clamp((altCmd - p.y) * .1, -12, 30), pitch, 25 * DEG)
      holdSpeed(w.stage === 'base' ? 90 : 120, false)
      if (Math.hypot(dx, dz) < 450) {
        waypoint++
        if (waypoint >= waypoints.length) stage = 'final'
      }
      return
    }

    if (stage === 'final') {
      const distance = Math.max(0, -along)
      // Track the centreline: intercept angle shrinks as the runway nears.
      const intercept = clamp(lateral * (distance > 1500 ? .0025 : .006), -.45, .45)
      steer(yaw - intercept, heading)
      const glide = profileAt(distance)
      const glideY = pad.y + 1.4 + 6 + glide.height
      const speedCmd = 52 + clamp((distance - 800) / 2400, 0, 1) * 35
      const gear = distance < 3500
      if (gear && !c.gearDown) aircraft.toggleGear()
      c.gearDown = gear || c.gearDown
      const agl = aircraft.altitudeAgl
      let vyCmd = -aircraft.speed * glide.slope + clamp((glideY - p.y) * .25, -8, 8)
      if (agl < 30) vyCmd = Math.max(vyCmd, -(.75 + Math.max(0, agl - 1.5) * .35))
      holdVerticalSpeed(clamp(vyCmd, -14, 4), pitch, 14 * DEG)
      holdSpeed(agl < 8 ? 53 : speedCmd + 4, c.gearDown)
      // Keep lift through the flare: no speed brake until the wheels are down.
      if (agl < 8) c.airbrake = false
      if (aircraft.onGround) stage = 'rollout'
      return
    }

    // Rollout: power off, brakes on, nose down, keep the runway heading.
    c.throttle = 0; c.airbrake = true; c.boost = false
    c.pitch = clamp(-pitch * 3, -.4, .4)
    steer(yaw, heading)
  }

  return { before, state }
}
