import { MathUtils, Quaternion, Vector3 } from 'three'
import { contactMinY } from '../world/ground'
import type { Aircraft } from './Aircraft'
import { flightConfig as C } from './flightConfig'

const _fwd = new Vector3()
const _up = new Vector3()
const _right = new Vector3()
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
    let onGround = position.y <= minY + 0.15 && velocity.y < 2

    this.axes(orientation)
    const airspeed = velocity.length()
    const air = MathUtils.clamp(airspeed / C.airControlFullSpeed, 0, 1)

    // --- Aim the nose ---
    let auth = air
    if (onGround) {
      auth = Math.max(
        air,
        MathUtils.clamp((groundSpeed - C.rotateSpeed * 0.3) / (C.rotateSpeed * 0.7), 0, 1),
      )
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

    // --- Thrust along the nose ---
    // Lever is what the ENG gauge shows. AB = full dry + extra, not +35% on idle.
    const lever = MathUtils.clamp(controls.throttle, 0, 1)
    const boost = controls.boost
    const thr = boost ? 1 : lever

    const vmax = boost ? C.maxSpeedBoost : C.maxSpeed
    const fade = 1 - MathUtils.clamp(airspeed / vmax, 0, 1) * 0.32
    let accel = 0
    if (thr > 0.02) {
      const cap = boost ? C.maxAccelBoost : C.maxAccel
      accel = Math.min((C.maxThrust / C.mass) * thr * (boost ? C.boostThrustMul : 1) * fade, cap)
    }

    if (onGround) {
      _flatFwd.set(_fwd.x, 0, _fwd.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        velocity.addScaledVector(_flatFwd, accel * dt)
      }
    } else {
      velocity.addScaledVector(_fwd, accel * dt)
    }

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

    // --- Drag / brakes ---
    {
      const s = velocity.length()
      if (s > 1e-4) {
        _velDir.copy(velocity).multiplyScalar(1 / s)
        let decel = C.parasiteDrag * s * s
        if (controls.gearDown) decel += C.gearDrag * s * 2.2
        // Pulling or rolling hard costs a little energy
        decel += stick * 3.2 * MathUtils.clamp(s / 120, 0.3, 2)
        const idle = MathUtils.clamp(1 - thr, 0, 1)
        decel += idle * idle * C.airbrakeStrength
        if (onGround && thr < 0.12) decel += C.wheelBrakeDecel * (1 - thr / 0.12)
        else if (onGround) decel += C.rollingDecel * 0.45
        decel = Math.min(decel, thr < 0.15 ? C.maxBrakeDecel : C.maxDecel)
        velocity.addScaledVector(_velDir, -decel * dt)
        if (velocity.dot(_velDir) < 0) velocity.set(0, 0, 0)
      } else if (onGround && thr < 0.05) {
        velocity.set(0, 0, 0)
      }
    }

    // Envelope
    {
      const s = velocity.length()
      if (s > vmax) velocity.multiplyScalar(vmax / s)
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
      position.y = minY
      if (velocity.y < 0) velocity.y = 0
    }

    aircraft.syncMesh()
  }

  isOnGround(aircraft: Aircraft): boolean {
    const minY = contactMinY(
      aircraft.position.x,
      aircraft.position.z,
      aircraft.controls.gearDown,
    )
    return aircraft.position.y <= minY + 0.2 && aircraft.velocity.y < 1.5
  }

  private axes(orientation: Quaternion): void {
    _fwd.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)
  }
}
