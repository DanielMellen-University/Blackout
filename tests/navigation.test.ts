import { describe, expect, it } from 'vitest'
import { HUD, navigationClosingSpeed, navigationEtaSeconds, navigationRangeCue } from '../src/ui/HUD'

function navigationHud() {
  const elements = new Map<string, {
    textContent: string
    hidden: boolean
    classList: { toggle(name: string, enabled: boolean): void }
    setAttribute(name: string, value: string): void
  }>()
  for (const id of ['nav-cue', 'nav-trend', 'nav-eta', 'nav-target']) {
    elements.set(id, { textContent: '', hidden: false, classList: { toggle() {} }, setAttribute() {} })
  }
  const hud = new HUD({ getElementById: (id: string) => elements.get(id) ?? null } as unknown as Document)
  const frame = { y: 100, speed: 200, cameraMode: 'chase', fps: 60, navBearing: 0, navDist: 1000,
    navAltDelta: 0, navTarget: 'gate', missionCurrent: 0, missionTotal: 6, navClosingSpeed: 50 }
  return { hud, frame, read: (id: string) => elements.get(id)!.textContent }
}

describe('target-relative navigation', () => {
  it('uses only velocity toward the target for arrival estimates', () => {
    const position = { x: 0, y: 0, z: 0 }
    const target = { x: 0, y: 0, z: 1000 }
    const closing = navigationClosingSpeed(position, { x: 200, y: 0, z: 50 }, target, 1000)
    expect(closing).toBe(50)
    expect(navigationEtaSeconds(1000, closing, 'closing')).toBe(20)
    expect(navigationClosingSpeed(position, { x: 200, y: 0, z: 0 }, target, 1000)).toBe(0)
    expect(navigationClosingSpeed(position, { x: 0, y: 0, z: -100 }, target, 1000)).toBe(-100)
  })

  it('accounts for vertical approaches and translated world coordinates', () => {
    const position = { x: -8000, y: 500, z: 12000 }
    const target = { x: -8000, y: 800, z: 12400 }
    expect(navigationClosingSpeed(position, { x: 0, y: 60, z: 80 }, target, 500)).toBe(100)
    expect(navigationClosingSpeed(position, { x: 0, y: -80, z: 60 }, target, 500)).toBe(0)
  })

  it('keeps malformed or absent targets and zero-range arrivals quiet', () => {
    const origin = { x: 0, y: 0, z: 0 }
    const velocity = { x: 0, y: 0, z: 100 }
    expect(navigationClosingSpeed(origin, velocity, null, 100)).toBe(0)
    expect(navigationClosingSpeed(origin, velocity, origin, 0)).toBe(0)
    expect(navigationClosingSpeed(origin, velocity, origin, Number.NaN)).toBe(0)
    expect(navigationClosingSpeed(origin, velocity, { ...origin, z: Number.NaN }, 100)).toBe(0)
    expect(navigationClosingSpeed(origin, { ...velocity, z: Infinity }, { ...origin, z: 100 }, 100)).toBe(0)
  })

  it('keeps a slow landing approach closing even at a high HUD refresh rate', () => {
    expect(navigationRangeCue(998, 1000, 60)).toBe('closing')
    expect(navigationRangeCue(999, 1000, -60)).toBe('opening')
    expect(navigationRangeCue(990, 1000, 0)).toBe('steady')
    expect(navigationRangeCue(990, 1000, 5)).toBe('steady')
    expect(navigationRangeCue(990, 1000, Number.NaN)).toBe('steady')
  })

  it('renders projected ETA and resets trends when the next gate changes', () => {
    const { hud, frame, read } = navigationHud()
    hud.update(frame)
    expect(read('nav-eta')).toBe('ETA --')
    hud.update({ ...frame, navDist: 995 })
    expect(read('nav-trend')).toBe('CLOSE')
    expect(read('nav-eta')).toBe('ETA 0:20')
    hud.update({ ...frame, navDist: 500, missionCurrent: 1 })
    expect(read('nav-trend')).toBe('HOLD')
    expect(read('nav-eta')).toBe('ETA --')
    hud.update({ ...frame, navDist: 498, missionCurrent: 1, navClosingSpeed: 60 })
    expect(read('nav-trend')).toBe('CLOSE')
    expect(read('nav-eta')).toBe('ETA 0:08')
  })

  it('clears estimates while departing and when switching radar landmarks', () => {
    const { hud, frame, read } = navigationHud()
    hud.update({ ...frame, navTarget: 'city', navTargetId: 'city-a' })
    hud.update({ ...frame, navTarget: 'city', navTargetId: 'city-a', navDist: 995 })
    expect(read('nav-eta')).toBe('ETA 0:20')
    hud.update({ ...frame, navTarget: 'city', navTargetId: 'city-b', navDist: 400 })
    expect(read('nav-eta')).toBe('ETA --')
    hud.update({ ...frame, navTarget: 'city', navTargetId: 'city-b', navDist: 401, navClosingSpeed: -50 })
    expect(read('nav-trend')).toBe('OPEN')
    expect(read('nav-eta')).toBe('ETA --')
    hud.update({ ...frame, navBearing: null })
    hud.update(frame)
    expect(read('nav-trend')).toBe('HOLD')
  })
})
