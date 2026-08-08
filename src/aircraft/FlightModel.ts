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
const _prevQ = new Quaternion()
const _deltaQ = new Quaternion()
const _aligned = new Vector3()

/**
 * Arcade flight model.
 * Body: +X right, +Y up, +Z nose.
 *
 * Velocity is rotated with the jet when you turn, then sideslip is damped,
 * so you move the way you are facing instead of sliding sideways.
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const mass = C.mass
    const minY = controls.gearDown ? C.gearHeight : C.bellyHeight
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    let onGround = position.y <= minY + 0.15 && velocity.y < 2

    // Snapshot attitude so we can rotate velocity with the turn
    _prevQ.copy(orientation)

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
      if (angularVelocity.x > 0) angularVelocity.x = 0
      const rotAllow = Math.min(
        1,
        Math.max(0, (groundSpeed - C.rotateSpeed * 0.4) / (C.rotateSpeed * 0.6)),
      )
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

    // Ground steering (world yaw) - also turns the jet
    if (onGround && groundSpeed > 0.4 && groundSpeed < 50) {
      const steer = -controls.yaw * (1.2 + groundSpeed * 0.025) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
    }

    // --- Velocity follows facing ---
    // 1) Rotate world velocity by the same attitude change as the airframe
    _deltaQ.copy(orientation).multiply(_prevQ.clone().invert())
    _aligned.copy(velocity).applyQuaternion(_deltaQ)
    // Blend so it feels solid, not 100% glued on the first frame of a turn
    const follow = 1 - Math.exp(-C.velocityFollow * dt)
    velocity.lerp(_aligned, follow)

    // 2) Kill remaining sideslip (body-right component) so you don't skate
    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)

    const vFwd = velocity.dot(_forward)
    const vRight = velocity.dot(_right)
    const vUp = velocity.dot(_up)
    const slipKill = Math.exp(-C.sideslipDamp * dt)
    // Rebuild velocity in body axes with damped lateral slip
    velocity.set(0, 0, 0)
    velocity.addScaledVector(_forward, vFwd)
    velocity.addScaledVector(_right, vRight * slipKill)
    velocity.addScaledVector(_up, vUp)

    // On ground: keep motion in the horizontal plane along the nose
    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        const gs = Math.hypot(velocity.x, velocity.z)
        // Point ground track at the nose
        const align = 1 - Math.exp(-8 * dt)
        velocity.x += (_flatFwd.x * gs - velocity.x) * align
        velocity.z += (_flatFwd.z * gs - velocity.z) * align
      }
      velocity.y = Math.max(0, velocity.y)
    }

    const speed = velocity.length()

    // AoA from velocity vs nose
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
      // Thrust always along the nose so acceleration matches facing
      _force.addScaledVector(_forward, thrustN)
    }

    _force.y -= mass * C.gravity
    if (onGround) {
      _force.y += mass * C.gravity
    }

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
      // Lift mostly against gravity / along body up - perpendicular to flight path-ish
      if (onGround) {
        _force.y += liftAccel * mass
      } else {
        _force.addScaledVector(_up, liftAccel * mass)
      }

      let cd = C.dragCoeff + (controls.gearDown ? C.gearDrag : 0)
      if (aoaAbs > C.stallAoA) cd += 0.02
      // Drag opposite velocity (and thus mostly opposite nose after alignment)
      _force.addScaledVector(_velDir, -cd * aeroK * qDyn * mass)
    }

    velocity.addScaledVector(_force, dt / mass)

    // Second sideslip pass after forces so thrust/lift don't reintroduce skate
    if (!onGround && velocity.lengthSq() > 1) {
      _forward.set(0, 0, 1).applyQuaternion(orientation)
      _right.set(1, 0, 0).applyQuaternion(orientation)
      _up.set(0, 1, 0).applyQuaternion(orientation)
      const f = velocity.dot(_forward)
      const r = velocity.dot(_right) * Math.exp(-C.sideslipDamp * dt)
      const u = velocity.dot(_up)
      velocity.set(0, 0, 0)
      velocity.addScaledVector(_forward, f)
      velocity.addScaledVector(_right, r)
      velocity.addScaledVector(_up, u)
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

    // Takeoff assist
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
