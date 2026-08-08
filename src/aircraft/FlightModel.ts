import { Quaternion, Vector3 } from 'three'
import type { Aircraft } from './Aircraft'
import { flightConfig as C } from './flightConfig'

const _forward = new Vector3()
const _up = new Vector3()
const _right = new Vector3()
const _force = new Vector3()
const _velDir = new Vector3()
const _spin = new Quaternion()
const _flatFwd = new Vector3()
const _worldUp = new Vector3(0, 1, 0)

/**
 * Arcade flight model.
 * Body: +X right, +Y up, +Z nose.
 * Ground roll keeps thrust horizontal; rotate + speed triggers liftoff assist.
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const mass = C.mass
    const minY = controls.gearDown ? C.gearHeight : C.bellyHeight
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    let onGround = position.y <= minY + 0.15 && velocity.y < 2

    // --- Rates from stick ---
    // W (+pitch) = nose up = negative omega.x
    const targetOx = -controls.pitch * C.pitchRate
    const targetOy = -controls.yaw * C.yawRate
    const targetOz = -controls.roll * C.rollRate

    const blend = 1 - Math.exp(-C.angularResponse * dt)
    angularVelocity.x += (targetOx - angularVelocity.x) * blend
    angularVelocity.y += (targetOy - angularVelocity.y) * blend
    angularVelocity.z += (targetOz - angularVelocity.z) * blend

    const stick =
      Math.abs(controls.pitch) + Math.abs(controls.roll) + Math.abs(controls.yaw)
    if (stick < 0.1) {
      angularVelocity.multiplyScalar(Math.exp(-C.angularDamping * dt))
    }

    if (onGround) {
      // No digging nose into the pavement
      if (angularVelocity.x > 0) angularVelocity.x = 0
      // Allow pitch-up earlier (from ~50% rotate speed), scale in
      const rotAllow = Math.min(1, Math.max(0, (groundSpeed - C.rotateSpeed * 0.4) / (C.rotateSpeed * 0.6)))
      angularVelocity.x *= rotAllow
      if (groundSpeed < 12) angularVelocity.z *= 0.25
    }

    // Integrate attitude (body frame)
    _spin
      .set(
        angularVelocity.x * dt * 0.5,
        angularVelocity.y * dt * 0.5,
        angularVelocity.z * dt * 0.5,
        1,
      )
      .normalize()
    orientation.multiply(_spin).normalize()

    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)

    const speed = velocity.length()

    // AoA
    let aoa = 0
    if (speed > 2) {
      _velDir.copy(velocity).normalize()
      aoa = Math.atan2(_velDir.dot(_up), Math.max(0.05, _velDir.dot(_forward)))
    }

    // --- Forces ---
    _force.set(0, 0, 0)

    let thr = Math.max(0, Math.min(1, controls.throttle))
    if (controls.boost) thr = Math.min(1, thr + 0.45)
    const thrustN = C.maxThrust * thr * (controls.boost ? C.boostThrustMul : 1)

    // On ground: thrust stays horizontal so we accelerate, not push into dirt
    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        _force.addScaledVector(_flatFwd, thrustN)
      }
    } else {
      _force.addScaledVector(_forward, thrustN)
    }

    // Gravity
    _force.y -= mass * C.gravity
    // Normal force while rolling (cancel weight)
    if (onGround) {
      _force.y += mass * C.gravity
    }

    // Aero
    const qDyn = speed * speed
    const aeroK = 0.0055
    if (speed > 1) {
      _velDir.copy(velocity).normalize()

      let liftFactor = Math.max(0.1, Math.cos(aoa * 0.8))
      const aoaAbs = Math.abs(aoa)
      if (aoaAbs > C.stallAoA) {
        liftFactor *= Math.max(0.15, 1 - (aoaAbs - C.stallAoA) * 2)
        angularVelocity.x += Math.sign(aoa || 1) * C.stallPitchDown * dt
      }
      // Attitude helps lift (nose up)
      liftFactor += Math.max(0, _forward.y) * 0.5

      const liftAccel = C.liftCoeff * aeroK * qDyn * liftFactor
      if (onGround) {
        // World-up lift so the jet leaves the runway cleanly
        _force.y += liftAccel * mass
      } else {
        _force.addScaledVector(_up, liftAccel * mass)
      }

      let cd = C.dragCoeff + (controls.gearDown ? C.gearDrag : 0)
      if (aoaAbs > C.stallAoA) cd += 0.02
      _force.addScaledVector(_velDir, -cd * aeroK * qDyn * mass)
    }

    // Ground steering
    if (onGround && groundSpeed > 0.4 && groundSpeed < 50) {
      const steer = -controls.yaw * (1.2 + groundSpeed * 0.025) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        const gs = Math.hypot(velocity.x, velocity.z)
        velocity.x = velocity.x * 0.8 + _flatFwd.x * gs * 0.2
        velocity.z = velocity.z * 0.8 + _flatFwd.z * gs * 0.2
      }
    }

    velocity.addScaledVector(_force, dt / mass)

    // Rolling resistance (light)
    if (onGround) {
      const gs = Math.hypot(velocity.x, velocity.z)
      if (gs > 0.08) {
        const decel = Math.min(gs, C.rollingDecel * dt)
        velocity.x -= (velocity.x / gs) * decel
        velocity.z -= (velocity.z / gs) * decel
      } else if (thr < 0.04) {
        velocity.x = 0
        velocity.z = 0
      }
      if (velocity.y < 0) velocity.y = 0
    }

    // --- Arcade takeoff assist ---
    // Hold W with enough speed: pop the nose and climb off the runway
    const wantRotate = controls.pitch > 0.25 && groundSpeed >= C.rotateSpeed * 0.85
    if (onGround && wantRotate) {
      // Ensure positive climb
      velocity.y = Math.max(velocity.y, C.rotateClimb * Math.min(1, controls.pitch))
      // Nudge off the pad so we are not re-clamped forever
      position.y = Math.max(position.y, minY + 0.35)
      onGround = false
    }

    position.addScaledVector(velocity, dt)

    // Ground contact (only when not climbing out)
    if (position.y < minY) {
      position.y = minY
      if (velocity.y < 0) velocity.y = 0
    }

    aircraft.syncMesh()
  }

  isOnGround(aircraft: Aircraft): boolean {
    const minY = aircraft.controls.gearDown ? C.gearHeight : C.bellyHeight
    return aircraft.position.y <= minY + 0.2 && aircraft.velocity.y < 1.5
  }
}
