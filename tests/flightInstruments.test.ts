import { describe, expect, it, vi } from 'vitest'
import { HUD } from '../src/ui/HUD'
import { displayedKnots } from '../src/core/airspeed'

class Instrument {
  textContent = ''
  hidden = false
  readonly styles = new Map<string, string>()
  readonly attributes = new Map<string, string>()
  readonly classes = new Set<string>()
  readonly style = { setProperty: vi.fn((name: string, value: string) => this.styles.set(name, value)) }
  readonly classList = { toggle: (name: string, enabled: boolean) => enabled ? this.classes.add(name) : this.classes.delete(name) }
  readonly setAttribute = vi.fn((name: string, value: string) => this.attributes.set(name, value))
}

function fixture() {
  const elements = new Map<string, Instrument>()
  for (const id of ['hud-pos', 'speedo-panel', 'spd-fill', 'spd-target', 'hud-spd', 'hud-speed-state', 'eng-panel', 'eng-fill', 'hud-thr', 'hud-target-speed', 'hud-ab-state']) elements.set(id, new Instrument())
  const hud = new HUD({ getElementById: (id: string) => elements.get(id) ?? null } as unknown as Document)
  const frame = { y: 200, speed: 150, cameraMode: 'chase', fps: 60, throttle: 0.5, targetSpeed: 200, boost: false }
  const read = (id: string): Instrument => elements.get(id)!
  return { hud, frame, read }
}

describe('digital flight instrument adapters', () => {
  it('keeps low-altitude readings numeric and neutral instead of raising alerts', () => {
    const { hud, frame, read } = fixture()
    for (const altitude of [120, 31, 6, 0, Number.NaN]) {
      hud.update({ ...frame, y: altitude, onGround: false })
      const shown = Number.isFinite(altitude) ? altitude : 0
      expect(read('hud-pos').textContent).toBe(String(shown))
      expect(read('hud-pos').attributes.get('aria-valuetext')).toBe(`${shown} metres`)
      expect(read('hud-pos').classes.has('clearance-caution')).toBe(false)
      expect(read('hud-pos').classes.has('clearance-warning')).toBe(false)
    }
  })

  it('uses live speed, commanded speed and engine lever values on horizontal rails', () => {
    const { hud, frame, read } = fixture()
    hud.update(frame)
    expect(read('hud-spd').textContent).toBe(String(Math.round(displayedKnots(150))))
    expect(parseFloat(read('spd-fill').styles.get('width')!)).toBeCloseTo(displayedKnots(150) / 900 * 100, 0)
    expect(parseFloat(read('spd-target').styles.get('left')!)).toBeCloseTo(Math.round(displayedKnots(200)) / 900 * 100, 0)
    expect(read('hud-thr').textContent).toBe('50%')
    expect(read('eng-fill').styles.get('width')).toBe('50%')
    expect(read('eng-fill').attributes.get('aria-valuenow')).toBe('50')
    expect(read('hud-speed-state').textContent).toBe('IAS')
    expect(read('hud-target-speed').textContent).toContain('TGT ')
  })

  it('clamps rail geometry but keeps the numeric overspeed readout honest', () => {
    const { hud, frame, read } = fixture()
    hud.update({ ...frame, speed: 900, targetSpeed: 900, throttle: 3, boost: true })
    expect(read('hud-spd').textContent).toBe(String(Math.round(displayedKnots(900))))
    expect(read('spd-fill').styles.get('width')).toBe('100%')
    expect(read('spd-target').styles.get('left')).toBe('100%')
    expect(read('hud-speed-state').textContent).toBe('OVERSPEED')
    expect(read('speedo-panel').classes.has('overspeed')).toBe(true)
    expect(read('eng-fill').styles.get('width')).toBe('100%')
    expect(read('eng-panel').classes.has('boost')).toBe(true)
    hud.update({ ...frame, speed: Number.NaN, targetSpeed: Number.NaN, throttle: Number.NaN })
    expect(read('hud-spd').textContent).toBe('0')
    expect(read('spd-fill').styles.get('width')).toBe('0%')
    expect(read('spd-target').styles.get('left')).toBe('0%')
    expect(read('eng-fill').styles.get('width')).toBe('0%')
    expect(read('speedo-panel').classes.has('overspeed')).toBe(false)
    expect(read('eng-panel').classes.has('boost')).toBe(false)
  })

  it('does not repeat unchanged style or attribute writes', () => {
    const { hud, frame, read } = fixture()
    hud.update(frame)
    const ids = ['spd-fill', 'spd-target', 'eng-fill', 'hud-spd']
    for (const id of ids) {
      read(id).style.setProperty.mockClear()
      read(id).setAttribute.mockClear()
    }
    hud.update(frame)
    for (const id of ids) {
      expect(read(id).style.setProperty).not.toHaveBeenCalled()
      expect(read(id).setAttribute).not.toHaveBeenCalled()
    }
  })
})
