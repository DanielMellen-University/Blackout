import {
  DEFAULT_KEYBOARD_BINDINGS,
  keyboardBindingLabel,
  keyboardControlSchemeLabel,
  type KeyboardBindings,
  type KeyboardControlScheme,
  type KeyboardPitchPreference,
} from './FlightPreferences'

export type FlightInputSource = 'keyboard' | 'touch' | 'gamepad'
export const BRIEFING_DURATION_SECONDS = 16
export interface BriefingControls {
  inputSource?: FlightInputSource
  keyboardPitch?: KeyboardPitchPreference
  keyboardScheme?: KeyboardControlScheme
  keyboardBindings?: KeyboardBindings
}

/** Resolve labels from the same normalized controls that the input sampler uses. */
export function briefingControls(options: BriefingControls): { power: string; rotate: string; gear: string } {
  if (options.inputSource === 'touch') return { power: '+ PWR', rotate: '▲', gear: 'GEAR' }
  if (options.inputSource === 'gamepad') return { power: 'RT / R2', rotate: 'LEFT STICK UP', gear: 'X / SQUARE' }
  return {
    power: 'SHIFT / 2',
    rotate: options.keyboardPitch === 'w-down' ? 'S' : 'W',
    gear: keyboardBindingLabel(options.keyboardBindings?.gear ?? DEFAULT_KEYBOARD_BINDINGS.gear)
      ?? keyboardBindingLabel(DEFAULT_KEYBOARD_BINDINGS.gear),
  }
}

/** Consume simulated flight time only; pauses and loading cannot eat the briefing. */
export function briefingRemainingSeconds(remaining: number, elapsed: number, live: boolean): number {
  const safeRemaining = Number.isFinite(remaining) ? Math.max(0, Math.min(BRIEFING_DURATION_SECONDS, remaining)) : 0
  if (!live || !Number.isFinite(elapsed) || elapsed <= 0) return safeRemaining
  return Math.max(0, safeRemaining - elapsed)
}

export type BriefingStage = 'takeoff' | 'first-gate' | 'route' | 'explore' | 'return' | 'approach'
const STAGE_ORDER: Record<BriefingStage, number> = { takeoff: 0, 'first-gate': 1, route: 2, explore: 2, return: 3, approach: 4 }

/** One quiet hint per milestone, not a new timer, banner or audio cue. */
export class FlightBriefingSession {
  private enabled = false
  private guided = false
  private airborne = false
  private current: BriefingStage = 'takeoff'
  private remaining = 0

  reset(enabled: boolean, guided = false): void {
    this.enabled = enabled
    this.guided = guided
    this.airborne = false
    this.current = 'takeoff'
    this.remaining = enabled ? BRIEFING_DURATION_SECONDS : 0
  }

  /** Call once per simulation frame, independently of HUD/render cadence. */
  advance(elapsed: number, live: boolean): void {
    // Reading the takeoff brief while stationary cannot make it disappear.
    // Training keeps gate-one coaching until that actual milestone is reached.
    if (this.current === 'takeoff' || (this.guided && this.current === 'first-gate')) return
    this.remaining = briefingRemainingSeconds(this.remaining, elapsed, live)
  }

  observe(onGround: boolean, gatesPassed: number, phase: string, approachActive: boolean, totalGates: number, emergency = false): void {
    if (!this.enabled) return
    if (phase === 'complete' || phase === 'failed') {
      this.enabled = false
      this.remaining = 0
      return
    }
    this.airborne ||= !onGround
    let next: BriefingStage = 'takeoff'
    if (this.airborne) {
      const returning = emergency || (phase === 'returning' && totalGates > 0)
      next = approachActive && (returning || totalGates === 0) ? 'approach'
        : returning ? 'return'
        : totalGates === 0 ? 'explore'
        : gatesPassed > 0 ? 'route' : 'first-gate'
    }
    // Go-arounds, touch-and-goes and target jitter cannot repeatedly renew hints.
    if (STAGE_ORDER[next] > STAGE_ORDER[this.current]) {
      this.current = next
      this.remaining = BRIEFING_DURATION_SECONDS
    }
  }

  get visible(): boolean { return this.enabled && this.remaining > 0 }
  get stage(): BriefingStage { return this.current }
  get remainingSeconds(): number { return this.remaining }
}

/** One context-sensitive line, with device-specific actions instead of keyboard-only advice. */
export function flightBriefingHint(state: BriefingControls & {
  onGround: boolean
  speed: number
  altitudeM: number
  missionPhase: string
  gatesPassed: number
  gearDown: boolean
  totalGates?: number
  approachActive?: boolean
  emergencyReturn?: boolean
  navTarget?: string
}): string {
  const speed = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0
  const altitude = Number.isFinite(state.altitudeM) ? Math.max(0, state.altitudeM) : 0
  const gates = Number.isFinite(state.gatesPassed) ? Math.max(0, Math.floor(state.gatesPassed)) : 0
  if (state.onGround) {
    const controls = briefingControls(state)
    return `${speed < 55 ? `${controls.power} POWER · ` : ''}${controls.rotate} ROTATE · GEAR AUTO`
  }
  if (state.emergencyReturn || state.approachActive || (state.missionPhase === 'returning' && state.totalGates !== 0)) {
    const powerDown = state.inputSource === 'touch' ? '− PWR'
      : state.inputSource === 'gamepad' ? 'LT / L2' : 'CTRL / 1'
    const gearAction = state.gearDown ? '' : state.inputSource === 'touch'
      ? 'GEAR DOWN · ' : `${briefingControls(state).gear} GEAR DOWN · `
    return state.approachActive
      ? altitude <= 14 ? `${gearAction}FLARE GENTLY · KEEP WINGS LEVEL`
        : `${gearAction}TWO WHITE / TWO RED · STEADY DESCENT`
      : `${powerDown} REDUCE POWER · ${gearAction}FOLLOW BASE ARROW`
  }
  if (state.totalGates === 0) return 'EXPLORE THE WORLD · RETURN & LAND WHEN READY'
  if (state.navTarget === 'city' || state.navTarget === 'village') {
    return 'LANDMARK SELECTED · FLY THE GATES TO COMPLETE THE COURSE'
  }
  if (gates === 0) {
    return altitude < 120
      ? 'PITCH TO CLIMB · FOLLOW THE ARROW TO GATE 1'
      : 'FOLLOW THE ARROW · FLY THROUGH GATE 1'
  }
  const axes = state.inputSource === 'touch' ? 'ARROWS PITCH / ROLL · YAW L / R'
    : state.inputSource === 'gamepad' ? 'LEFT STICK PITCH / ROLL · RIGHT STICK YAW'
    : keyboardControlSchemeLabel(state.keyboardScheme ?? 'arcade')
  return `FOLLOW THE ARROW · ${axes}`
}
