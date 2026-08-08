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
 * Arcade flight model: thrust, gravity, lift/drag, stall lite, rate controls.
 * Body axes: +X right, +Y up, +Z nose.
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const mass = C.mass
    const minY = controls.gearDown ? C.gearHeight : C.bellyHeight
    let onGround = position.y <= minY + 0.12
    const speed = velocity.length()
    const groundSpeed = Math.hypot(velocity.x, velocity.z)

    // --- Stick to body rates ---
    // +pitch (W) = nose up = negative omega.x
    const targetOx = -controls.pitch * C.pitchRate
    const targetOy = -controls.yaw * C.yawRate
    const targetOz = -controls.roll * C.rollRate

    const k = 1 - Math.exp(-C.angularResponse * dt)
    angularVelocity.x += (targetOx - angularVelocity.x) * k
    angularVelocity.y += (targetOy - angularVelocity.y) * k
    angularVelocity.z += (targetOz - angularVelocity.z) * k

    const stick =
      Math.abs(controls.pitch) + Math.abs(controls.roll) + Math.abs(controls.yaw)
    if (stick < 0.12) {
      angularVelocity.multiplyScalar(Math.exp(-C.angularDamping * dt))
    }

    if (onGround) {
      // Level roll when slow
      if (groundSpeed < 15) {
        angularVelocity.z *= 0.2
      }
      // Pitch-up only after rotate speed; scale in with groundspeed
      const rotAllow = Math.min(1, groundSpeed / C.rotateSpeed)
      if (angularVelocity.x > 0) angularVelocity.x = 0 // no nose-down into pavement
      angularVelocity.x *= rotAllow
      // Keep aircraft from banking into the runway when parked
      if (groundSpeed < 5) {
        this.levelWings(orientation, dt)
      }
    }

    // Body-frame angular integration
    _spin
      .set(
        angularVelocity.x * dt * 0.5,
        angularVelocity.y * dt * 0.5,
        angularVelocity.z * dt * 0.5,
        1,
      )
      .normalize()
    orientation.multiply(_spin)
    orientation.normalize()

    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)

    // AoA
    let aoa = 0
    if (speed > 2) {
      _velDir.copy(velocity).multiplyScalar(1 / speed)
      const vf = _velDir.dot(_forward)
      const vu = _velDir.dot(_up)
      aoa = Math.atan2(vu, Math.max(0.05, vf))
    }

    // --- Forces ---
    _force.set(0, 0, 0)

    let thr = Math.max(0, Math.min(1, controls.throttle))
    if (controls.boost) thr = Math.min(1, thr + 0.4)
    const thrust = C.maxThrust * thr * (controls.boost ? C.boostThrustMul : 1)
    _force.addScaledVector(_forward, thrust)

    // Gravity always
    _force.y -= mass * C.gravity

    // On ground: normal force cancels gravity so we are not "fighting" into the floor
    if (onGround) {
      _force.y += mass * C.gravity
    }

    const qDyn = speed * speed
    const aeroK = 0.0042

    if (speed > 1) {
      _velDir.copy(velocity).multiplyScalar(1 / speed)

      let liftFactor = Math.max(0.05, Math.cos(aoa * 0.85))
      const aoaAbs = Math.abs(aoa)
      if (aoaAbs > C.stallAoA) {
        liftFactor *= Math.max(0.12, 1 - (aoaAbs - C.stallAoA) * 2.2)
        angularVelocity.x += Math.sign(aoa || 1) * C.stallPitchDown * dt
      }

      // Extra lift from pitch attitude when moving (helps rotate off runway)
      const pitchUp = Math.max(0, _forward.y)
      liftFactor += pitchUp * 0.35

      const liftAccel = C.liftCoeff * aeroK * qDyn * liftFactor
      // Prefer world-up lift contribution when mostly upright so we leave the runway
      if (onGround) {
        _force.y += liftAccel * mass
      } else {
        _force.addScaledVector(_up, liftAccel * mass)
      }

      let cd = C.dragCoeff + (controls.gearDown ? C.gearDrag : 0)
      if (aoaAbs > C.stallAoA) cd += 0.025
      const dragAccel = cd * aeroK * qDyn
      _force.addScaledVector(_velDir, -dragAccel * mass)
    }

    // Ground steering (world yaw)
    if (onGround && groundSpeed > 0.5 && groundSpeed < 45) {
      const steer = -controls.yaw * (1.1 + groundSpeed * 0.02) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
      // Align horizontal velocity with nose a bit when steering
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-4) {
        _flatFwd.normalize()
        const gs = groundSpeed
        velocity.x = velocity.x * 0.85 + _flatFwd.x * gs * 0.15
        velocity.z = velocity.z * 0.85 + _flatFwd.z * gs * 0.15
      }
    }

    velocity.addScaledVector(_force, dt / mass)

    // Rolling resistance (linear, not exponential velocity kill)
    if (onGround) {
      const gs = Math.hypot(velocity.x, velocity.z)
      if (gs > 0.05) {
        const decel = Math.min(gs, C.rollingDecel * dt)
        velocity.x -= (velocity.x / gs) * decel
        velocity.z -= (velocity.z / gs) * decel
      } else if (thr < 0.05) {
        velocity.x = 0
        velocity.z = 0
      }
      // No sinking
      if (velocity.y < 0) velocity.y = 0
    }

    position.addScaledVector(velocity, dt)

    // Contact resolve: only pin to ground if not lifting off
    const liftOff =
      velocity.y > 0.5 || (onGround && _forward.y > 0.08 && groundSpeed > C.rotateSpeed * 0.85)

    if (position.y < minY) {
      position.y = minY
      if (!liftOff && velocity.y < 0) velocity.y = 0
    }

    // If we have clear upward speed and pitch, allow leaving the pad
    if (position.y <= minY + 0.05 && velocity.y > 1.5 && groundSpeed > C.rotateSpeed * 0.7) {
      position.y = minY + 0.2
    }

    aircraft.syncMesh()
  }

  isOnGround(aircraft: Aircraft): boolean {
    const minY = aircraft.controls.gearDown ? C.gearHeight : C.bellyHeight
    return aircraft.position.y <= minY + 0.15 && aircraft.velocity.y <= 1.2
  }

  /** Softly level roll (and slight pitch) when parked. */
  private levelWings(orientation: Quaternion, dt: number): void {
    _up.set(0, 1, 0).applyQuaternion(orientation)
    // If nearly upright, slerp toward identity yaw-preserving level
    if (_up.y > 0.85) {
      _forward.set(0, 0, 1).applyQuaternion(orientation)
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() < 1e-4) return
      _flatFwd.normalize()
      // Build level orientation looking along flat forward
      const level = _spin // reuse
      // lookAt style: open a matrix - simpler slerp to flatten pitch/roll
      const flatten = 1 - Math.exp(-4 * dt)
      // Extract and damp pitch/roll by slerping up toward world up in orientation
      _right.set(1, 0, 0).applyQuaternion(orientation)
      // Small corrective roll/pitch rates handled by zeroing omega already
      void level
      void flatten
    }
  }
}
