import { MathUtils, Quaternion, Vector3 } from 'three'
import {
  contactMinY,
  sampleGroundNormal,
  sampleGroundSurfaceInto,
  undercarriageClearance,
  type GroundSurfaceSample,
} from '../world/ground'
import type { Aircraft, ContactSurfaceKind } from './Aircraft'
import { flightConfig as C } from './flightConfig'

const _fwd = new Vector3()
const _up = new Vector3()
const _velDir = new Vector3()
const _flatFwd = new Vector3()
const _worldUp = new Vector3(0, 1, 0)
const _spin = new Quaternion()
const _prevPos = new Vector3()
const _pt = new Vector3()
const _normal = new Vector3()

/** Extra vertical envelope used by the broad phase before detailed probes. */
const CONTACT_BROADPHASE_MARGIN = 24
const CONTACT_BROADPHASE_TRAVEL_FACTOR = 0.75
const CONTACT_BROADPHASE_TRAVEL_CAP = 32

interface SurfaceHit {
  depth: number
  normal: Vector3
  kind: ContactSurfaceKind
  wx: number
  wz: number
  surfaceY: number
}

/** Body-frame probes: origin, nose, tail, wings, canopy. */
const CONTACT_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [0, 0, 7.2],
  [0, 0, -4.8],
  [5.4, 0, 0.4],
  [-5.4, 0, 0.4],
  [0, 1.05, 2.2],
]

/**
 * Arcade fighter model.
 *
 * One rule: the jet goes where the nose points.
 * Roll/pitch/yaw aim the nose. Velocity is pulled onto +Z every frame.
 * Gravity is always on; lift only cancels it when you have speed and
 * aren't inverted. No weathervane, no extra bank-turn mixer.
 *
 * Body: +X right, +Y up, +Z nose.
 */
export class FlightModel {
  /** Reused contact result; each sweep consumes it before the next probe. */
  private readonly hitResult: SurfaceHit = {
    depth: 0,
    normal: _normal,
    kind: 'land',
    wx: 0,
    wz: 0,
    surfaceY: 0,
  }
  private readonly surfaceSample: GroundSurfaceSample = {
    height: 0,
    kind: 'land',
  }

  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const minY = contactMinY(position.x, position.z, controls.gearDown)
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    this.axes(orientation)
    let onGround = this.grounded(position.y, minY, velocity.y, _up.y)
    const startedAirborne = !onGround
    aircraft.impactVy = 0
    aircraft.impact = null

    const airspeed = velocity.length()
    const air = MathUtils.clamp(airspeed / C.airControlFullSpeed, 0, 1)

    // --- Aim the nose ---
    let auth = air
    if (onGround) {
      auth = Math.max(
        air,
        MathUtils.clamp((groundSpeed - C.rotateSpeed * 0.3) / (C.rotateSpeed * 0.7), 0, 1),
      )
    } else {
      // Keep enough stick to push the nose down from a hover / stall
      auth = Math.max(air, 0.28)
    }
    // Slightly heavier pitch only at extreme speed (still flyable)
    const q = 1 / (1 + (airspeed / 1260) ** 2 * 0.22)

    const tOx = -controls.pitch * C.pitchRate * auth * q
    const tOy = controls.yaw * C.yawRate * (onGround ? Math.max(auth, 0.45) : auth)
    const tOz = -controls.roll * C.rollRate * (onGround ? auth * 0.28 : auth)

    const kP = 1 - Math.exp(-C.pitchResponse * dt)
    const kA = 1 - Math.exp(-C.angularResponse * dt)
    angularVelocity.x += (tOx - angularVelocity.x) * kP
    angularVelocity.y += (tOy - angularVelocity.y) * kA
    angularVelocity.z += (tOz - angularVelocity.z) * kA

    const stick =
      Math.abs(controls.pitch) + Math.abs(controls.roll) + Math.abs(controls.yaw)
    angularVelocity.multiplyScalar(
      Math.exp(-(stick < 0.1 ? C.angularDamping : C.angularDamping * 0.22) * dt),
    )

    if (onGround) {
      if (angularVelocity.x > 0) angularVelocity.x = 0
      const rot =
        MathUtils.clamp((groundSpeed - C.rotateSpeed * 0.35) / (C.rotateSpeed * 0.65), 0, 1)
      angularVelocity.x *= rot
      if (groundSpeed < 10) angularVelocity.z *= 0.15
    }

    _spin
      .set(
        angularVelocity.x * dt * 0.5,
        angularVelocity.y * dt * 0.5,
        angularVelocity.z * dt * 0.5,
        1,
      )
      .normalize()
    orientation.multiply(_spin).normalize()

    if (onGround && groundSpeed > 0.5 && groundSpeed < 80) {
      const steer = controls.yaw * (C.groundSteer + groundSpeed * 0.02) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
    }

    this.axes(orientation)

    const engine = aircraft.engineState
    const lever = engine.lever
    const boost = engine.afterburnerActive
    const vmax = engine.maxSpeed
    const target = engine.targetSpeed

    // --- Gravity + simple lift (cancels g when fast and upright) ---
    // Lift must not add energy: after applying it, keep |v| from growing.
    if (!onGround) {
      velocity.y -= C.gravity * dt
      const spdBeforeLift = velocity.length()
      const lift =
        C.gravity *
        MathUtils.clamp((airspeed / C.liftSpeed) ** 2, 0, 1.15) *
        MathUtils.clamp(_up.y, 0, 1)
      velocity.y += lift * dt
      const spdAfter = velocity.length()
      if (spdAfter > spdBeforeLift && spdAfter > 1e-4) {
        velocity.multiplyScalar(spdBeforeLift / spdAfter)
      }
    } else if (velocity.y < 0) {
      velocity.y = 0
    }

    // --- THE turn: snap velocity onto the nose ---
    const spd = velocity.length()
    if (!onGround && spd > 3) {
      const align = C.alignRate * MathUtils.clamp(0.35 + air * 0.75, 0.35, 1)
      const t = 1 - Math.exp(-align * dt)
      _velDir.copy(velocity).normalize().lerp(_fwd, t).normalize()
      velocity.copy(_velDir).multiplyScalar(spd)
    } else if (onGround) {
      const gs = Math.hypot(velocity.x, velocity.z)
      if (gs > 0.08) {
        _flatFwd.set(_fwd.x, 0, _fwd.z)
        if (_flatFwd.lengthSq() > 1e-6) {
          _flatFwd.normalize()
          velocity.x = _flatFwd.x * gs
          velocity.z = _flatFwd.z * gs
        }
      }
    }

    // --- ENG% speed hold ---
    {
      const s = velocity.length()
      const err = target - s
      const capAccel = engine.maxAcceleration
      const idle = lever < C.idleLever && !boost
      const capDecel =
        onGround && idle ? C.maxBrakeDecel : idle ? C.maxDecel : C.coastDecel
      const along = MathUtils.clamp(err * C.speedSeek, -capDecel, capAccel)

      if (along > 0.05) {
        if (onGround) {
          _flatFwd.set(_fwd.x, 0, _fwd.z)
          if (_flatFwd.lengthSq() > 1e-6) {
            _flatFwd.normalize()
            velocity.addScaledVector(_flatFwd, along * dt)
          }
        } else {
          velocity.addScaledVector(_fwd, along * dt)
        }
      } else if (along < -0.05 && s > 1e-4) {
        _velDir.copy(velocity).multiplyScalar(1 / s)
        velocity.addScaledVector(_velDir, along * dt)
        if (velocity.dot(_velDir) < 0) velocity.set(0, 0, 0)
      } else if (onGround && target < 1 && s < 2) {
        velocity.set(0, 0, 0)
      }

      // Light extra bleed so gear / hard stick still cost a little
      const s2 = velocity.length()
      if (s2 > 1e-4) {
        _velDir.copy(velocity).multiplyScalar(1 / s2)
        let extra = 0
        if (controls.gearDown) extra += C.gearDrag * s2 * 0.55
        extra += stick * 1.4 * MathUtils.clamp(s2 / 160, 0.2, 1.2)
        if (onGround && lever < 0.08 && !boost) extra += C.rollingDecel * 0.45
        if (extra > 0) {
          velocity.addScaledVector(_velDir, -extra * dt)
          if (velocity.dot(_velDir) < 0) velocity.set(0, 0, 0)
        }
      }

      const s3 = velocity.length()
      if (s3 > vmax) velocity.multiplyScalar(vmax / s3)
    }

    // Rotate off the runway
    if (onGround && controls.pitch > 0.28 && groundSpeed >= C.rotateSpeed * 0.82) {
      velocity.y = Math.max(velocity.y, C.rotateClimb * Math.min(1, controls.pitch))
      position.y = Math.max(position.y, minY + 0.4)
      onGround = false
    }

    if (onGround && velocity.y < 0) velocity.y = 0

    _prevPos.copy(position)
    position.addScaledVector(velocity, dt)
    this.resolveContact(aircraft, _prevPos, startedAirborne, minY)

    aircraft.syncMesh()
  }

  private resolveContact(
    aircraft: Aircraft,
    prev: Vector3,
    startedAirborne: boolean,
    previousMinY: number,
  ): void {
    const { position, velocity, orientation, controls } = aircraft
    const dx = position.x - prev.x
    const dy = position.y - prev.y
    const dz = position.z - prev.z
    const dist = Math.hypot(dx, dy, dz)

    // A fast jet spends most of its time far above the heightfield. Check the
    // old, new, and midpoint clearances first; only paths that enter a
    // conservative vertical envelope pay for all swept body probes.
    if (prev.y - previousMinY > CONTACT_BROADPHASE_MARGIN) {
      const currentMinY = contactMinY(position.x, position.z, controls.gearDown)
      const midMinY = contactMinY(
        prev.x + dx * 0.5,
        prev.z + dz * 0.5,
        controls.gearDown,
      )
      const midpointClearance = (prev.y + dy * 0.5) - midMinY
      if (!contactSweepNeedsDetailedProbes(
        prev.y - previousMinY,
        position.y - currentMinY,
        midpointClearance,
        dist,
      )) return
    }

    const steps = Math.max(1, Math.min(24, Math.ceil(dist / C.contactSweepSpacing)))

    let lastX = prev.x
    let lastY = prev.y
    let lastZ = prev.z

    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = prev.x + dx * t
      const y = prev.y + dy * t
      const z = prev.z + dz * t
      const hit = this.deepestHit(x, y, z, orientation, controls.gearDown)
      if (!hit) {
        lastX = x
        lastY = y
        lastZ = z
        continue
      }

      if (startedAirborne) {
        const nVel = velocity.dot(hit.normal)
        const tang = Math.sqrt(Math.max(0, velocity.lengthSq() - nVel * nVel))
        const imp = aircraft.impactState
        imp.point.set(x, y, z)
        imp.surfacePoint.set(hit.wx, hit.surfaceY, hit.wz)
        imp.surfaceNormal.copy(hit.normal)
        imp.preImpactVelocity.copy(velocity)
        imp.normalVelocity = nVel
        imp.verticalVelocity = velocity.y
        imp.tangentialSpeed = tang
        imp.surface = hit.kind
        imp.gearDown = controls.gearDown
        imp.startedAirborne = true
        aircraft.impact = imp
        if (velocity.y < 0) aircraft.impactVy = velocity.y

        const wall = hit.normal.y < 0.55 || hit.depth > 3.5
        if (wall) {
          aircraft.impactVy = Math.min(aircraft.impactVy, C.crashVy - 1)
          imp.normalVelocity = Math.min(nVel, C.crashVy - 1)
          position.set(lastX, lastY, lastZ)
          if (nVel < 0) velocity.addScaledVector(hit.normal, -nVel)
          return
        }
      }

      position.set(x, y + hit.depth, z)
      const speedBefore = velocity.length()
      if (velocity.y < 0) velocity.y = 0
      const nv = velocity.dot(hit.normal)
      if (nv < 0) velocity.addScaledVector(hit.normal, -nv)
      // Walkable contact must not act as a brake; noisy mesh normals
      // and shallow slopes used to strip speed after the takeoff roll.
      if (hit.normal.y >= 0.55 && speedBefore > 1e-4) {
        const s = velocity.length()
        if (s > 1e-4 && s < speedBefore) velocity.multiplyScalar(speedBefore / s)
      }
      return
    }
  }

  private deepestHit(
    ox: number,
    oy: number,
    oz: number,
    orientation: Quaternion,
    gearDown: boolean,
  ): SurfaceHit | null {
    let depth = 0
    let wx = ox
    let wz = oz
    let surfaceY = 0
    let kind: ContactSurfaceKind = 'land'
    let found = false

    for (let i = 0; i < CONTACT_POINTS.length; i++) {
      const p = CONTACT_POINTS[i]!
      _pt.set(p[0], p[1], p[2]).applyQuaternion(orientation)
      const px = ox + _pt.x
      const py = oy + _pt.y
      const pz = oz + _pt.z
      const surface = sampleGroundSurfaceInto(px, pz, this.surfaceSample)
      const clearance = i === 0 ? undercarriageClearance(gearDown) : 0.4
      const minY = surface.height + clearance
      const d = minY - py
      if (d > depth) {
        found = true
        depth = d
        wx = px
        wz = pz
        surfaceY = surface.height
        kind = surface.kind
        sampleGroundNormal(px, pz, 2, _normal)
      }
    }

    if (!found) return null
    const hit = this.hitResult
    hit.depth = depth
    hit.normal = _normal
    hit.kind = kind
    hit.wx = wx
    hit.wz = wz
    hit.surfaceY = surfaceY
    return hit
  }

  isOnGround(aircraft: Aircraft): boolean {
    const minY = contactMinY(
      aircraft.position.x,
      aircraft.position.z,
      aircraft.controls.gearDown,
    )
    this.axes(aircraft.orientation)
    return this.grounded(aircraft.position.y, minY, aircraft.velocity.y, _up.y)
  }

  private grounded(y: number, minY: number, vy: number, upY: number): boolean {
    return y <= minY + 0.18 && vy < 1.8 && upY > 0.35
  }

  private axes(orientation: Quaternion): void {
    _fwd.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
  }
}

/**
 * Conservative broad-phase gate for swept aircraft contact.
 * Invalid samples keep the detailed path enabled so bad terrain data cannot
 * turn into a missed collision.
 */
export function contactSweepNeedsDetailedProbes(
  previousClearance: number,
  currentClearance: number,
  midpointClearance: number,
  travelMeters: number,
): boolean {
  if (
    !Number.isFinite(previousClearance) ||
    !Number.isFinite(currentClearance) ||
    !Number.isFinite(midpointClearance)
  ) return true
  const travel = Number.isFinite(travelMeters) ? Math.max(0, travelMeters) : 0
  const margin = CONTACT_BROADPHASE_MARGIN + Math.min(
    CONTACT_BROADPHASE_TRAVEL_CAP,
    travel * CONTACT_BROADPHASE_TRAVEL_FACTOR,
  )
  return Math.min(previousClearance, currentClearance, midpointClearance) <= margin
}
