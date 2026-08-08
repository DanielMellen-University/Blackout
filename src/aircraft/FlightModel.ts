import { MathUtils, Quaternion, Vector3 } from 'three'
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
const _prevQ = new Quaternion()
const _deltaQ = new Quaternion()
const _aligned = new Vector3()
const _horiz = new Vector3()

/**
 * Arcade flight model.
 * Body: +X right, +Y up, +Z nose.
 *
 * When you yaw (A/D) or bank (Q/E), airspeed direction updates with the jet
 * so you fly the way you are pointed / banked.
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const mass = C.mass
    const minY = controls.gearDown ? C.gearHeight : C.bellyHeight
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    let onGround = position.y <= minY + 0.15 && velocity.y < 2

    _prevQ.copy(orientation)

    // --- Stick rates ---
    // W = nose up (omega.x < 0); A/D = yaw; Q/E = roll
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
      if (angularVelocity.x > 0) angularVelocity.x = 0
      const rotAllow = Math.min(
        1,
        Math.max(0, (groundSpeed - C.rotateSpeed * 0.4) / (C.rotateSpeed * 0.6)),
      )
      angularVelocity.x *= rotAllow
      if (groundSpeed < 12) angularVelocity.z *= 0.25
    }

    // Attitude integrate
    _spin
      .set(
        angularVelocity.x * dt * 0.5,
        angularVelocity.y * dt * 0.5,
        angularVelocity.z * dt * 0.5,
        1,
      )
      .normalize()
    orientation.multiply(_spin).normalize()

    // Ground steer (A/D yaw on pavement)
    if (onGround && groundSpeed > 0.4 && groundSpeed < 55) {
      const steer = -controls.yaw * (1.4 + groundSpeed * 0.03) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
    }

    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)

    // --- Make path follow facing ---
    // 1) Full rotate of velocity by the same attitude delta as the airframe
    //    (this is what was missing for A/D yaw and pitch turns)
    _deltaQ.copy(_prevQ).invert()
    _deltaQ.premultiply(orientation) // world: new * old^-1
    velocity.applyQuaternion(_deltaQ)

    // 2) Pull remaining velocity direction onto the nose (keeps "go where you point")
    const speed0 = velocity.length()
    if (speed0 > 0.5) {
      _aligned.copy(_forward).multiplyScalar(speed0)
      const t = 1 - Math.exp(-C.velocityFollow * dt)
      velocity.lerp(_aligned, t)
    }

    // 3) Banked turn: when rolled, curve the horizontal path (Q/E changes direction)
    if (!onGround && speed0 > 8) {
      // Bank: how much the right wing is down/up relative to horizon
      const bank = Math.asin(MathUtils.clamp(_right.y, -1, 1))
      // Positive bank (right wing up in our basis?) - tune sign so Q/E feel natural
      // _right.y > 0 means right wing is high-ish depending on roll direction
      // Use body roll also: roll right (E, +control.roll) => bank turn right
      const bankFromStick = controls.roll * 0.35
      const bankEff = bank + bankFromStick
      if (Math.abs(bankEff) > 0.02) {
        // Arcade: banked path curves horizontal velocity and nose together
        const yawRate = -bankEff * C.bankTurn * dt
        _horiz.set(velocity.x, 0, velocity.z)
        if (_horiz.lengthSq() > 1) {
          _horiz.applyAxisAngle(_worldUp, yawRate)
          velocity.x = _horiz.x
          velocity.z = _horiz.z
        }
        orientation.premultiply(_spin.setFromAxisAngle(_worldUp, yawRate * 0.85)).normalize()
        _forward.set(0, 0, 1).applyQuaternion(orientation)
        _up.set(0, 1, 0).applyQuaternion(orientation)
        _right.set(1, 0, 0).applyQuaternion(orientation)
      }
    }

    // Ground: path locked to nose on XZ
    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        const gs = Math.hypot(velocity.x, velocity.z)
        velocity.x = _flatFwd.x * gs
        velocity.z = _flatFwd.z * gs
      }
      if (velocity.y < 0) velocity.y = 0
    }

    const speed = velocity.length()

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

    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        _force.addScaledVector(_flatFwd, thrustN)
      }
    } else {
      _force.addScaledVector(_forward, thrustN)
    }

    _force.y -= mass * C.gravity
    if (onGround) _force.y += mass * C.gravity

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
      liftFactor += Math.max(0, _forward.y) * 0.5

      const liftAccel = C.liftCoeff * aeroK * qDyn * liftFactor
      if (onGround) {
        _force.y += liftAccel * mass
      } else {
        _force.addScaledVector(_up, liftAccel * mass)
      }

      let cd = C.dragCoeff + (controls.gearDown ? C.gearDrag : 0)
      if (aoaAbs > C.stallAoA) cd += 0.02
      _force.addScaledVector(_velDir, -cd * aeroK * qDyn * mass)
    }

    velocity.addScaledVector(_force, dt / mass)

    // After forces: keep air path on the nose again (thrust stays aligned)
    if (!onGround) {
      const sp = velocity.length()
      if (sp > 1) {
        _forward.set(0, 0, 1).applyQuaternion(orientation)
        _aligned.copy(_forward).multiplyScalar(sp)
        velocity.lerp(_aligned, 1 - Math.exp(-C.velocityFollow * 0.65 * dt))
      }
    }

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

    const wantRotate = controls.pitch > 0.25 && groundSpeed >= C.rotateSpeed * 0.85
    if (onGround && wantRotate) {
      velocity.y = Math.max(velocity.y, C.rotateClimb * Math.min(1, controls.pitch))
      position.y = Math.max(position.y, minY + 0.35)
      onGround = false
    }

    position.addScaledVector(velocity, dt)

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
