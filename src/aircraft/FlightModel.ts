import { MathUtils, Quaternion, Vector3 } from 'three'
import { contactMinY } from '../world/ground'
import type { Aircraft } from './Aircraft'
import { flightConfig as C } from './flightConfig'

const _fwd = new Vector3()
const _up = new Vector3()
const _velDir = new Vector3()
const _flatFwd = new Vector3()
const _worldUp = new Vector3(0, 1, 0)
const _spin = new Quaternion()

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
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const minY = contactMinY(position.x, position.z, controls.gearDown)
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    this.axes(orientation)
    let onGround = this.grounded(position.y, minY, velocity.y, _up.y)
    const startedAirborne = !onGround
    aircraft.impactVy = 0

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
    const q = 1 / (1 + (airspeed / 420) ** 2 * 0.22)

    const tOx = -controls.pitch * C.pitchRate * auth * q
    const tOy = -controls.yaw * C.yawRate * (onGround ? Math.max(auth, 0.45) : auth)
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
      const steer = -controls.yaw * (C.groundSteer + groundSpeed * 0.02) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
    }

    this.axes(orientation)

    const lever = MathUtils.clamp(controls.throttle, 0, 1)
    const boost = controls.boost
    // ENG% is a speed command: 50% → 500 kts, 100% → 1000 kts. AB = dry max + extra.
    const vmax = boost ? C.maxSpeedBoost : C.maxSpeed
    const target = boost ? C.maxSpeedBoost : lever * C.maxSpeed

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
      const capAccel = boost ? C.maxAccelBoost : C.maxAccel
      const capDecel =
        onGround && !boost && lever < 0.12 ? C.maxBrakeDecel : C.maxDecel
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

    position.addScaledVector(velocity, dt)
    if (position.y < minY) {
      const snap = minY - position.y
      if (startedAirborne && velocity.y < 0) aircraft.impactVy = velocity.y
      // Flying into a cliff / rising ridge — don't elevator onto the surface
      if (startedAirborne && snap > 3.5) {
        aircraft.impactVy = Math.min(aircraft.impactVy, C.crashVy - 1)
      }
      position.y = minY
      if (velocity.y < 0) velocity.y = 0
    } else if (
      startedAirborne &&
      position.y <= minY + 0.2 &&
      velocity.y < 0
    ) {
      aircraft.impactVy = velocity.y
    }

    aircraft.syncMesh()
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
