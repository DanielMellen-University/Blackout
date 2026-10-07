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

/** One context-sensitive line, with device-specific actions instead of keyboard-only advice. */
export function flightBriefingHint(state: BriefingControls & {
  onGround: boolean
  speed: number
  altitudeM: number
  missionPhase: string
  gatesPassed: number
  gearDown: boolean
}): string {
  const speed = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0
  const altitude = Number.isFinite(state.altitudeM) ? Math.max(0, state.altitudeM) : 0
  const gates = Number.isFinite(state.gatesPassed) ? Math.max(0, Math.floor(state.gatesPassed)) : 0
  if (state.missionPhase === 'returning') {
    if (state.gearDown) return 'ALIGN WITH RUNWAY · FLARE & LAND'
    const gearAction = state.inputSource === 'touch' ? 'GEAR' : `${briefingControls(state).gear} GEAR`
    return `${gearAction} DOWN · ALIGN WITH RUNWAY · FLARE & LAND`
  }
  if (state.onGround) {
    const controls = briefingControls(state)
    const gearAction = state.inputSource === 'touch' ? 'GEAR' : `${controls.gear} GEAR`
    return `${speed < 55 ? `${controls.power} POWER · ` : ''}${controls.rotate} ROTATE · ${gearAction} AFTER TAKEOFF`
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
