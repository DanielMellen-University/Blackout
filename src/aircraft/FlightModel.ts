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
 * Arcade flight model (Sketchbook-style).
 * Body: +X right, +Y up, +Z nose.
 *
 * Loop each step:
 *  1) Stick adds body angular rates (pitch about right, yaw about up, roll about nose)
 *  2) Integrate orientation from angular velocity
 *  3) Thrust along forward into velocity
 *  4) Drag opposing velocity; lift along body up from airspeed
 *  5) Soft path-follow: bend velocity toward the nose (turns change path)
 *  6) Banked-turn assist: curve path about world-up when wings banked
 *  7) Mild weathervane: nose eases toward velocity when stick is quiet
 */
export class FlightModel {
  step(aircraft: Aircraft, dt: number): void {
    if (dt <= 0) return

    const { controls, orientation, velocity, angularVelocity, position } = aircraft
    const mass = C.mass
    // Shared ground query: surface Y + gear/belly clearance
    const minY = contactMinY(position.x, position.z, controls.gearDown)
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

    // Pitch is slower to answer so W/S is not twitchy
    const blendPitch = 1 - Math.exp(-C.pitchResponse * dt)
    const blend = 1 - Math.exp(-C.angularResponse * dt)
    angularVelocity.x += (targetOx - angularVelocity.x) * blendPitch
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

    // --- Linear motion: thrust (capped accel), gravity, lift, drag/brake, envelope ---
    let thr = MathUtils.clamp(controls.throttle, 0, 1)
    if (controls.boost) thr = Math.min(1, thr + 0.45)
    const boost = controls.boost
    // Thrust only when throttle is up (idle = no push, airbrake handles bleed)
    let thrustAccel = 0
    if (thr > 0.02) {
      thrustAccel =
        (C.maxThrust / mass) * thr * (boost ? C.boostThrustMul : 1)
      thrustAccel = Math.min(thrustAccel, C.maxAccel * (0.35 + thr * 0.65))
    }

    if (onGround) {
      _flatFwd.set(_forward.x, 0, _forward.z)
      if (_flatFwd.lengthSq() > 1e-6) {
        _flatFwd.normalize()
        velocity.addScaledVector(_flatFwd, thrustAccel * dt)
      }
    } else {
      // Sketchbook-style: thrust always along nose so path tracks attitude
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
      // Below minSpeed airborne: weak lift (mush / stall edge)
      if (!onGround && airspeed < C.minSpeed) {
        liftAccel *= MathUtils.clamp(airspeed / C.minSpeed, 0.25, 1)
      }
      liftAccel *= MathUtils.clamp(0.55 + _forward.y * 0.9, 0.35, 1.35)

      if (aoaAbs > C.stallAoA) {
        const over = aoaAbs - C.stallAoA
        liftAccel *= Math.max(0.12, C.stallLiftMul - over * 1.5)
        if (!onGround) {
          angularVelocity.x += Math.sign(aoa || 1) * C.stallPitchDown * dt
        }
      }

      if (onGround) {
        velocity.y += liftAccel * dt
        if (velocity.y > 0 && liftAccel < C.gravity * 0.95) {
          velocity.y = 0
        }
      } else {
        velocity.addScaledVector(_up, liftAccel * dt)
      }
    }

    // Soft path-follow: gently bend velocity toward the nose so A/D yaw and
    // attitude changes actually turn the flight path (not a hard pin).
    if (!onGround && airspeed > 4 && airInfluence > 0.1) {
      const spd = velocity.length()
      if (spd > 1e-4) {
        _velDir.copy(velocity).normalize()
        const follow =
          C.pathFollowRate * airInfluence * (0.55 + MathUtils.clamp(stick * 0.35, 0, 0.45))
        const t = 1 - Math.exp(-follow * dt)
        _velDir.lerp(_forward, t).normalize()
        velocity.copy(_velDir).multiplyScalar(spd)
      }
    }

    // Banked-turn assist: when wings banked, curve path about world-up
    // (arcade coordinated turn — OSS sims rely on bank + path for turning)
    if (!onGround && airspeed > 8) {
      // Bank from body-right's vertical component: +right.y => left wing down? 
      // right.y > 0 means right wing is higher (rolled left in our axes...)
      // roll right (Q) banks right wing down => _right.y negative
      const bank = Math.asin(MathUtils.clamp(-_right.y, -1, 1))
      if (Math.abs(bank) > 0.04) {
        const turn =
          C.bankTurnRate *
          Math.sin(bank) *
          airInfluence *
          MathUtils.clamp(airspeed / 40, 0.35, 1.25)
        const c = Math.cos(turn * dt)
        const s = Math.sin(turn * dt)
        const vx = velocity.x
        const vz = velocity.z
        velocity.x = vx * c + vz * s
        velocity.z = -vx * s + vz * c
      }
    }

    // Drag + airbrake: low throttle = real braking (was nearly inert before)
    {
      const speedNow = velocity.length()
      if (speedNow > 1e-4) {
        _velDir.copy(velocity).multiplyScalar(1 / speedNow)

        // Base aero + gear
        let decel =
          C.dragPerSpeed * speedNow * speedNow * 0.08 +
          (controls.gearDown ? C.gearDrag * speedNow * 2.5 : 0)

        // Airbrake: idle throttle bleeds hard; full thr almost none
        const idle = MathUtils.clamp(1 - thr, 0, 1)
        const airbrake = idle * idle * C.airbrakeStrength
        decel += airbrake

        // Ground: wheel brakes when throttle near idle
        if (onGround && thr < 0.12) {
          decel += C.wheelBrakeDecel * (1 - thr / 0.12)
        } else if (onGround) {
          decel += C.rollingDecel * 0.35
        }

        // Cap: stronger cap when intentionally braking
        const brakeCap = thr < 0.15 ? C.maxBrakeDecel : C.maxDecel
        decel = Math.min(decel, brakeCap)

        velocity.addScaledVector(_velDir, -decel * dt)
        // Never reverse from drag alone
        if (velocity.dot(_velDir) < 0) velocity.set(0, 0, 0)
      }
    }

    // Speed envelope: hard min (airborne) / max (dry vs boost)
    this.applySpeedLimits(velocity, onGround, boost)

    // Keep path under nose while rolling; strong stop when fully braked
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

    // Rotate assist: pitch up near rotate speed to leave the runway cleanly
    const wantRotate = controls.pitch > 0.25 && groundSpeed >= C.rotateSpeed * 0.85
    if (onGround && wantRotate) {
      velocity.y = Math.max(velocity.y, C.rotateClimb * Math.min(1, controls.pitch))
      position.y = Math.max(position.y, minY + 0.35)
      onGround = false
    }

    // Mild weathervane: ease nose toward velocity when stick is quiet
    if (!onGround && airspeed > 6 && airInfluence > 0.15) {
      _velDir.copy(velocity).normalize()
      this.readBodyAxes(orientation)
      const alignDot = MathUtils.clamp(_forward.dot(_velDir), -1, 1)
      // Skip when nearly opposite (avoid setFromUnitVectors flip) or already aligned
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

    // Soft ground contact
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

  /**
   * Clamp airspeed into [minSpeed, maxSpeed] (or maxSpeedBoost with AB).
   * On the ground, only enforce max (you may start from 0).
   */
  private applySpeedLimits(velocity: Vector3, onGround: boolean, boost: boolean): void {
    const speed = velocity.length()
    if (speed < 1e-6) return

    const maxSp = boost ? C.maxSpeedBoost : C.maxSpeed
    if (speed > maxSp) {
      velocity.multiplyScalar(maxSp / speed)
      return
    }

    // Airborne: soft floor under minSpeed - do not force min on the runway
    if (!onGround && speed < C.minSpeed) {
      // Allow brief dips (stall) but push gently back toward min when throttled
      // Pure clamp would feel sticky; leave as lift penalty above, optional nudge:
      // (no hard raise - stall is allowed below minSpeed)
    }
  }
}
