import { MathUtils, Quaternion, Vector3 } from 'three'
import { contactMinY } from '../world/ground'
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
 * Arcade flight model with energy: thrust vs drag, lift from speed/AoA,
 * banked turns, q-feel, stall mush. Body +X right, +Y up, +Z nose.
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const minY = contactMinY(position.x, position.z, controls.gearDown)
    const groundSpeed = Math.hypot(velocity.x, velocity.z)
    let onGround = position.y <= minY + 0.15 && velocity.y < 2

    this.readBodyAxes(orientation)

    const airspeed = velocity.length()
    const airInfluence = MathUtils.clamp(airspeed / C.airControlFullSpeed, 0, 1)
    const speedNorm = MathUtils.clamp(airspeed / C.cruiseSpeed, 0, 2.8)

    // --- Stick rates: mushy when slow, q-feel (heavier pitch) when fast ---
    let authority = airInfluence
    if (onGround) {
      const rotAuth = MathUtils.clamp(
        (groundSpeed - C.rotateSpeed * 0.35) / (C.rotateSpeed * 0.65),
        0,
        1,
      )
      authority = Math.max(airInfluence, rotAuth)
    }

    const qFeel = 1 / (1 + (airspeed / (C.cruiseSpeed * 1.8)) ** 2 * 0.85)
    const rollEase = MathUtils.clamp(0.45 + speedNorm * 0.4, 0.45, 1.15)

    const targetOx = -controls.pitch * C.pitchRate * authority * qFeel
    const targetOy =
      -controls.yaw * C.yawRate * (onGround ? Math.max(authority, 0.4) : authority)
    const targetOz =
      -controls.roll * C.rollRate * (onGround ? authority * 0.32 : authority) * rollEase

    const blendPitch = 1 - Math.exp(-C.pitchResponse * dt)
    const blend = 1 - Math.exp(-C.angularResponse * dt)
    angularVelocity.x += (targetOx - angularVelocity.x) * blendPitch
    angularVelocity.y += (targetOy - angularVelocity.y) * blend
    angularVelocity.z += (targetOz - angularVelocity.z) * blend

    const stick =
      Math.abs(controls.pitch) + Math.abs(controls.roll) + Math.abs(controls.yaw)
    const damp = stick < 0.12 ? C.angularDamping : C.angularDamping * 0.28
    angularVelocity.multiplyScalar(Math.exp(-damp * dt))

    if (onGround) {
      if (angularVelocity.x > 0) angularVelocity.x = 0
      const rotAllow = MathUtils.clamp(
        (groundSpeed - C.rotateSpeed * 0.4) / (C.rotateSpeed * 0.6),
        0,
        1,
      )
      angularVelocity.x *= rotAllow
      if (groundSpeed < 12) angularVelocity.z *= 0.18
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

    if (onGround && groundSpeed > 0.4 && groundSpeed < 70) {
      const steer = -controls.yaw * (C.groundSteer + groundSpeed * 0.022) * dt
      orientation.premultiply(_spin.setFromAxisAngle(_worldUp, steer)).normalize()
    }

    this.readBodyAxes(orientation)

    // --- Thrust: fades a bit at high Mach-arcade so top end needs AB ---
    let thr = MathUtils.clamp(controls.throttle, 0, 1)
    const boost = controls.boost
    if (boost) thr = Math.min(1, thr + 0.4)

    const speedFrac = airspeed / (boost ? C.maxSpeedBoost : C.maxSpeed)
    const thrustFade = 1 - MathUtils.clamp(speedFrac, 0, 1) * 0.38
    let thrustAccel = 0
    if (thr > 0.02) {
      const cap = boost ? C.maxAccelBoost : C.maxAccel
      thrustAccel =
        (C.maxThrust / C.mass) * thr * (boost ? C.boostThrustMul : 1) * thrustFade
      thrustAccel = Math.min(thrustAccel, cap * (0.4 + thr * 0.6))
    }

    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        velocity.addScaledVector(_flatFwd, thrustAccel * dt)
      }
    } else {
      velocity.addScaledVector(_forward, thrustAccel * dt)
    }

    if (!onGround) {
      velocity.y -= C.gravity * dt
    } else if (velocity.y < 0) {
      velocity.y = 0
    }

    // --- Lift + stall + energy bleed ---
    let aoa = 0
    let aoaAbs = 0
    if (airspeed > 1) {
      _velDir.copy(velocity).normalize()
      aoa = Math.atan2(_velDir.dot(_up), Math.max(0.05, _velDir.dot(_forward)))
      aoaAbs = Math.abs(aoa)

      const qBar = (airspeed / C.cruiseSpeed) ** 2
      // Auto-trim: wings-level cruise mostly holds altitude
      const wingsLevel = MathUtils.clamp(1 - Math.abs(_right.y) * 1.4, 0.15, 1)
      const trim = C.autoLift * C.gravity * MathUtils.clamp(qBar, 0, 1.35) * wingsLevel

      // Stick / AoA lift (pulling G)
      const cl = MathUtils.clamp(aoa / C.stallAoA, -1.45, 1.45)
      let pullLift = cl * C.liftAuthority * Math.min(qBar, 2.4)
      pullLift = MathUtils.clamp(pullLift, -C.maxLiftAccel, C.maxLiftAccel)

      let liftAccel = trim + pullLift
      if (!onGround && airspeed < C.minSpeed) {
        liftAccel *= MathUtils.clamp(airspeed / C.minSpeed, 0.2, 1)
      }

      if (aoaAbs > C.stallAoA) {
        const over = aoaAbs - C.stallAoA
        liftAccel *= Math.max(0.1, C.stallLiftMul - over * 1.6)
        if (!onGround) {
          angularVelocity.x += Math.sign(aoa || 1) * C.stallPitchDown * dt
        }
      }

      if (onGround) {
        velocity.y += Math.max(0, liftAccel) * dt
        if (velocity.y > 0 && liftAccel < C.gravity * 0.92) velocity.y = 0
      } else {
        velocity.addScaledVector(_up, liftAccel * dt)
      }
    }

    // Path-follow: attitude actually turns the jet
    if (!onGround && airspeed > 5 && airInfluence > 0.1) {
      const spd = velocity.length()
      if (spd > 1e-4) {
        _velDir.copy(velocity).normalize()
        const follow =
          C.pathFollowRate *
          airInfluence *
          (0.5 + MathUtils.clamp(stick * 0.4, 0, 0.5))
        const t = 1 - Math.exp(-follow * dt)
        _velDir.lerp(_forward, t).normalize()
        velocity.copy(_velDir).multiplyScalar(spd)
      }
    }

    // Coordinated bank turn (stronger at speed)
    if (!onGround && airspeed > 10) {
      const bank = Math.asin(MathUtils.clamp(-_right.y, -1, 1))
      if (Math.abs(bank) > 0.035) {
        const turn =
          C.bankTurnRate *
          Math.sin(bank) *
          airInfluence *
          MathUtils.clamp(0.4 + speedNorm * 0.45, 0.4, 1.45)
        const c = Math.cos(turn * dt)
        const s = Math.sin(turn * dt)
        const vx = velocity.x
        const vz = velocity.z
        velocity.x = vx * c + vz * s
        velocity.z = -vx * s + vz * c
      }
    }

    // --- Drag: parasite (v^2) + induced (from pull) + airbrake / wheels ---
    {
      const speedNow = velocity.length()
      if (speedNow > 1e-4) {
        _velDir.copy(velocity).multiplyScalar(1 / speedNow)

        let decel =
          C.parasiteDrag * speedNow * speedNow +
          C.inducedDrag * aoaAbs * aoaAbs * speedNow +
          (controls.gearDown ? C.gearDrag * speedNow * 2.2 : 0)

        // Pulling G / high AoA bleeds energy (loops and hard turns cost speed)
        if (!onGround && aoaAbs > 0.08) {
          decel += C.pullBleed * aoaAbs * MathUtils.clamp(speedNow / C.cruiseSpeed, 0.4, 2)
        }

        const idle = MathUtils.clamp(1 - thr, 0, 1)
        decel += idle * idle * C.airbrakeStrength

        if (onGround && thr < 0.12) {
          decel += C.wheelBrakeDecel * (1 - thr / 0.12)
        } else if (onGround) {
          decel += C.rollingDecel * 0.4
        }

        const brakeCap = thr < 0.15 ? C.maxBrakeDecel : C.maxDecel
        decel = Math.min(decel, brakeCap)

        velocity.addScaledVector(_velDir, -decel * dt)
        if (velocity.dot(_velDir) < 0) velocity.set(0, 0, 0)
      }
    }

    this.applySpeedLimits(velocity, onGround, boost)

    if (onGround) {
      const gs = Math.hypot(velocity.x, velocity.z)
      if (gs > 0.08) {
        _flatFwd.set(_forward.x, 0, _forward.z)
        if (_flatFwd.lengthSq() > 1e-6) {
          _flatFwd.normalize()
          velocity.x = _flatFwd.x * gs
          velocity.z = _flatFwd.z * gs
        }
      } else if (thr < 0.05) {
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

    if (!onGround && airspeed > 6 && airInfluence > 0.15) {
      _velDir.copy(velocity).normalize()
      this.readBodyAxes(orientation)
      const alignDot = MathUtils.clamp(_forward.dot(_velDir), -1, 1)
      if (alignDot < 0.999 && alignDot > -0.9) {
        _alignQ.setFromUnitVectors(_forward, _velDir)
        _targetQ.copy(_alignQ).multiply(orientation).normalize()
        const vane =
          C.weathervaneRate * airInfluence * (1 - MathUtils.clamp(stick * 0.7, 0, 0.92))
        const t = 1 - Math.exp(-vane * dt)
        orientation.slerp(_targetQ, t).normalize()
      }
    }

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

  private readBodyAxes(orientation: Quaternion): void {
    _forward.set(0, 0, 1).applyQuaternion(orientation)
    _up.set(0, 1, 0).applyQuaternion(orientation)
    _right.set(1, 0, 0).applyQuaternion(orientation)
  }

  private applySpeedLimits(velocity: Vector3, onGround: boolean, boost: boolean): void {
    const speed = velocity.length()
    if (speed < 1e-6) return
    const maxSp = boost ? C.maxSpeedBoost : C.maxSpeed
    if (speed > maxSp) velocity.multiplyScalar(maxSp / speed)
    void onGround
  }
}
