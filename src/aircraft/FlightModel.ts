import { Quaternion, Vector3 } from 'three'
import type { Aircraft } from './Aircraft'
import { flightConfig as C } from './flightConfig'

const _forward = new Vector3()
const _up = new Vector3()
const _right = new Vector3()
const _force = new Vector3()
const _velDir = new Vector3()
const _spin = new Quaternion()
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
    const onGround = this.isOnGround(aircraft)
    const speed = velocity.length()

    // --- Stick to body rates ---
    // +pitch control (W) = pitch up = negative omega.x (RH, +Z nose)
    // +roll control (D) = roll right = negative omega.z (RH about nose)
    // +yaw control (E) = yaw right = negative omega.y about body up... use world-up on ground
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
      // Only allow pitch-up (omega.x <= 0) once fast enough to rotate
      if (speed < C.rotateSpeed) {
        if (angularVelocity.x > 0) angularVelocity.x = 0
        angularVelocity.x *= speed / Math.max(C.rotateSpeed, 1)
      }
      if (speed < 12) {
        angularVelocity.z *= 0.15
        angularVelocity.y *= 0.4
      }
    }

    // Local angular velocity -> quaternion (body frame)
    const hx = angularVelocity.x * dt * 0.5
    const hy = angularVelocity.y * dt * 0.5
    const hz = angularVelocity.z * dt * 0.5
    _spin.set(hx, hy, hz, 1).normalize()
    orientation.multiply(_spin)
    orientation.normalize()

    // Basis
    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)

    // AoA from velocity vs nose
    let aoa = 0
    if (speed > 2) {
      _velDir.copy(velocity).multiplyScalar(1 / speed)
      const vf = _velDir.dot(_forward)
      const vu = _velDir.dot(_up)
      aoa = Math.atan2(vu, Math.max(0.05, vf))
    }

    // --- Forces (arcade scaled accelerations * mass) ---
    _force.set(0, 0, 0)

    let thr = Math.max(0, Math.min(1, controls.throttle))
    if (controls.boost) thr = Math.min(1, thr + 0.4)
    const thrust = C.maxThrust * thr * (controls.boost ? C.boostThrustMul : 1)
    _force.addScaledVector(_forward, thrust)

    _force.y -= mass * C.gravity

    // Dynamic pressure proxy
    const q = speed * speed
    // At ~70 m/s want lift ~ weight: liftK * 0.55 * 4900 ≈ g => liftK ≈ 0.0036
    const aeroK = 0.0038

    if (speed > 1) {
      _velDir.copy(velocity).multiplyScalar(1 / speed)

      let liftFactor = Math.max(0, Math.cos(aoa * 0.9))
      const aoaAbs = Math.abs(aoa)
      if (aoaAbs > C.stallAoA) {
        liftFactor *= Math.max(0.1, 1 - (aoaAbs - C.stallAoA) * 2.2)
        // Nose drop
        angularVelocity.x += Math.sign(aoa || 1) * C.stallPitchDown * dt
      }

      const liftAccel = C.liftCoeff * aeroK * q * liftFactor
      _force.addScaledVector(_up, liftAccel * mass)

      let cd = C.dragCoeff + (controls.gearDown ? C.gearDrag : 0)
      if (aoaAbs > C.stallAoA) cd += 0.025
      const dragAccel = cd * aeroK * q
      _force.addScaledVector(_velDir, -dragAccel * mass)
    }

    // Ground steering assist: small yaw from stick when slow
    if (onGround && speed > 1 && speed < 40) {
      const steer = -controls.yaw * 0.9 * dt
      const steerQ = _spin.setFromAxisAngle(_worldUp, steer)
      orientation.premultiply(steerQ).normalize()
    }

    velocity.addScaledVector(_force, dt / mass)
    position.addScaledVector(velocity, dt)

    const minY = controls.gearDown ? C.gearHeight : C.bellyHeight
    if (position.y < minY) {
      position.y = minY
      if (velocity.y < 0) velocity.y = 0
      const bleed = Math.exp(-C.groundFriction * dt)
      velocity.x *= bleed
      velocity.z *= bleed
      // Kill excessive downward pitch into runway
      if (angularVelocity.x > 0) angularVelocity.x *= 0.4
    }

    aircraft.syncMesh()
  }

  isOnGround(aircraft: Aircraft): boolean {
    const minY = aircraft.controls.gearDown ? C.gearHeight : C.bellyHeight
    return aircraft.position.y <= minY + 0.1
  }
}
