import { MathUtils, Quaternion, Vector3 } from 'three'
import type { Aircraft } from './Aircraft'
import { flightConfig as C } from './flightConfig'

const _forward = new Vector3()
const _up = new Vector3()
const _right = new Vector3()
const _velDir = new Vector3()
const _flatFwd = new Vector3()
const _worldUp = new Vector3(0, 1, 0)
const _spin = new Quaternion()
const _alignQ = new Quaternion()
const _targetQ = new Quaternion()

/**
 * Arcade flight model (Sketchbook-style).
 * Body: +X right, +Y up, +Z nose.
 *
 * Loop each step:
 *  1) Stick adds body angular rates (pitch about right, yaw about up, roll about nose)
 *  2) Integrate orientation from angular velocity
 *  3) Thrust along forward into velocity
 *  4) Drag opposing velocity; lift along body up from airspeed
 *  5) Mild weathervane: nose eases toward the velocity vector at speed
 *
 * Does not pin airspeed to the nose with a hard velocity lerp (that felt stuck in turns).
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const mass = C.mass
    const minY = controls.gearDown ? C.gearHeight : C.bellyHeight
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    let onGround = position.y <= minY + 0.15 && velocity.y < 2

    this.readBodyAxes(orientation)

    const airspeed = velocity.length()
    const airInfluence = MathUtils.clamp(airspeed / C.airControlFullSpeed, 0, 1)

    // --- Stick rates (body frame) ---
    // W = nose up => omega.x < 0; D = yaw right => omega.y < 0; Q = roll right => omega.z < 0
    let authority = airInfluence
    if (onGround) {
      // Pitch for rotate ramps with ground speed; roll weak while slow; yaw free for steer
      const rotAuth = MathUtils.clamp(
        (groundSpeed - C.rotateSpeed * 0.35) / (C.rotateSpeed * 0.65),
        0,
        1,
      )
      authority = Math.max(airInfluence, rotAuth)
    }

    const targetOx = -controls.pitch * C.pitchRate * authority
    const targetOy = -controls.yaw * C.yawRate * (onGround ? Math.max(authority, 0.35) : authority)
    const targetOz = -controls.roll * C.rollRate * (onGround ? authority * 0.35 : authority)

    const blend = 1 - Math.exp(-C.angularResponse * dt)
    angularVelocity.x += (targetOx - angularVelocity.x) * blend
    angularVelocity.y += (targetOy - angularVelocity.y) * blend
    angularVelocity.z += (targetOz - angularVelocity.z) * blend

    const stick =
      Math.abs(controls.pitch) + Math.abs(controls.roll) + Math.abs(controls.yaw)
    if (stick < 0.12) {
      angularVelocity.multiplyScalar(Math.exp(-C.angularDamping * dt))
    } else {
      // Light always-on damping so rates do not wind up
      angularVelocity.multiplyScalar(Math.exp(-C.angularDamping * 0.25 * dt))
    }

    if (onGround) {
      // No dig-in pitch; allow rotate nose-up only as speed builds
      if (angularVelocity.x > 0) angularVelocity.x = 0
      const rotAllow = MathUtils.clamp(
        (groundSpeed - C.rotateSpeed * 0.4) / (C.rotateSpeed * 0.6),
        0,
        1,
      )
      angularVelocity.x *= rotAllow
      if (groundSpeed < 12) angularVelocity.z *= 0.2
    }

    // Integrate orientation from body angular velocity
    _spin
      .set(
        angularVelocity.x * dt * 0.5,
        angularVelocity.y * dt * 0.5,
        angularVelocity.z * dt * 0.5,
        1,
      )
      .normalize()
    orientation.multiply(_spin).normalize()

    // Ground steer: yaw about world up while rolling on the pavement
    if (onGround && groundSpeed > 0.4 && groundSpeed < 60) {
      const steer = -controls.yaw * (C.groundSteer + groundSpeed * 0.025) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
    }

    this.readBodyAxes(orientation)

    // --- Linear motion: thrust, gravity, lift, drag ---
    let thr = MathUtils.clamp(controls.throttle, 0, 1)
    if (controls.boost) thr = Math.min(1, thr + 0.45)
    const thrustAccel =
      (C.maxThrust / mass) * thr * (controls.boost ? C.boostThrustMul : 1)

    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        velocity.addScaledVector(_flatFwd, thrustAccel * dt)
      }
    } else {
      velocity.addScaledVector(_forward, thrustAccel * dt)
    }

    // Gravity (cancelled while firmly on the ground)
    if (!onGround) {
      velocity.y -= C.gravity * dt
    } else if (velocity.y < 0) {
      velocity.y = 0
    }

    // Lift along body up from airspeed (banked lift curves the path naturally)
    if (airspeed > 1) {
      _velDir.copy(velocity).normalize()
      const aoa = Math.atan2(_velDir.dot(_up), Math.max(0.05, _velDir.dot(_forward)))
      const aoaAbs = Math.abs(aoa)

      let liftAccel = Math.min(C.maxLiftAccel, C.liftPerSpeed * airspeed)
      // Slight pitch-up / climb attitude bonus for arcade takeoff and climb
      liftAccel *= MathUtils.clamp(0.55 + _forward.y * 0.9, 0.35, 1.35)

      if (aoaAbs > C.stallAoA) {
        const over = aoaAbs - C.stallAoA
        liftAccel *= Math.max(0.12, C.stallLiftMul - over * 1.5)
        if (!onGround) {
          angularVelocity.x += Math.sign(aoa || 1) * C.stallPitchDown * dt
        }
      }

      if (onGround) {
        // Unload gear as speed builds; does not shove sideways on the runway
        velocity.y += liftAccel * dt
        if (velocity.y > 0 && liftAccel < C.gravity * 0.95) {
          velocity.y = 0
        }
      } else {
        velocity.addScaledVector(_up, liftAccel * dt)
      }
    }

    // Drag opposing velocity (Sketchbook: vel *= 1 - k * speed)
    {
      let dragK = C.dragPerSpeed + (controls.gearDown ? C.gearDrag : 0)
      if (onGround) dragK += 0.0015
      const speedNow = velocity.length()
      if (speedNow > 1e-4) {
        const damp = Math.min(0.6, dragK * speedNow * dt)
        velocity.multiplyScalar(1 - damp)
      }
    }

    // Rolling friction on the runway
    if (onGround) {
      const gs = Math.hypot(velocity.x, velocity.z)
      if (gs > 0.08) {
        const decel = Math.min(gs, C.rollingDecel * dt)
        velocity.x -= (velocity.x / gs) * decel
        velocity.z -= (velocity.z / gs) * decel
        // Keep path roughly under the nose while taxiing / rolling
        _flatFwd.set(_forward.x, 0, _forward.z)
        if (_flatFwd.lengthSq() > 1e-6) {
          _flatFwd.normalize()
          const gs2 = Math.hypot(velocity.x, velocity.z)
          velocity.x = _flatFwd.x * gs2
          velocity.z = _flatFwd.z * gs2
        }
      } else if (thr < 0.04) {
        velocity.x = 0
        velocity.z = 0
      }
      if (velocity.y < 0) velocity.y = 0
    }

    // Rotate assist: pitch up near rotate speed to leave the runway cleanly
    const wantRotate = controls.pitch > 0.25 && groundSpeed >= C.rotateSpeed * 0.85
    if (onGround && wantRotate) {
      velocity.y = Math.max(velocity.y, C.rotateClimb * Math.min(1, controls.pitch))
      position.y = Math.max(position.y, minY + 0.35)
      onGround = false
    }

    // Mild weathervane: ease nose toward velocity (not the other way around)
    if (!onGround && airspeed > 6 && airInfluence > 0.15) {
      _velDir.copy(velocity).normalize()
      this.readBodyAxes(orientation)
      const alignDot = MathUtils.clamp(_forward.dot(_velDir), -1, 1)
      // Skip when nearly opposite (avoid setFromUnitVectors flip) or already aligned
      if (alignDot < 0.999 && alignDot > -0.9) {
        _alignQ.setFromUnitVectors(_forward, _velDir)
        _targetQ.copy(_alignQ).multiply(orientation).normalize()
        const vane =
          C.weathervaneRate * airInfluence * (1 - MathUtils.clamp(stick * 0.55, 0, 0.85))
        const t = 1 - Math.exp(-vane * dt)
        orientation.slerp(_targetQ, t).normalize()
      }
    }

    position.addScaledVector(velocity, dt)

    // Soft ground contact
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

  private readBodyAxes(orientation: Quaternion): void {
    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)
  }
}
