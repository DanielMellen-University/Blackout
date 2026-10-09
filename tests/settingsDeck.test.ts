import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { nativeSelectOwnsEscape } from '../src/ui/NativeSelect'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('flight deck settings', () => {
  it('lets an open native picker own Escape without swallowing other keys or closed-picker Escape', () => {
    class Target {
      open = false
      select = true
      supported = true
      closest() { return this.select ? this : null }
      matches(selector: string) {
        expect(selector).toBe(':open')
        if (!this.supported) throw new DOMException('Unsupported selector', 'SyntaxError')
        return this.open
      }
    }
    vi.stubGlobal('Element', Target)
    try {
      const target = new Target() as Target & EventTarget
      expect(nativeSelectOwnsEscape({ code: 'Escape', target })).toBe(false)
      target.open = true
      expect(nativeSelectOwnsEscape({ code: 'Escape', target })).toBe(true)
      expect(nativeSelectOwnsEscape({ code: 'Enter', target })).toBe(false)
      target.select = false
      expect(nativeSelectOwnsEscape({ code: 'Escape', target })).toBe(false)
      target.select = true; target.supported = false
      expect(nativeSelectOwnsEscape({ code: 'Escape', target })).toBe(false)
      expect(nativeSelectOwnsEscape({ code: 'Escape', target: null })).toBe(false)
    } finally { vi.unstubAllGlobals() }
    const main = read('src/main.ts')
    expect(main.indexOf('if (nativeSelectOwnsEscape(e)) return')).toBeLessThan(main.indexOf("if (e.code === 'Escape')"))
  })

  it('preserves all preference controls and native labels while adding consistent settings cards', () => {
    const html = read('index.html')
    const root = html.split('id="menu-root"')[1]!.split('id="menu-controls"')[0]!
    for (const id of ['menu-quality', 'menu-volume', 'menu-hud-display', 'menu-reduced-motion',
      'menu-engine-volume', 'menu-environment-volume', 'menu-effects-volume', 'menu-reset-settings',
      'menu-control-scheme', 'menu-stability-assist', 'menu-pitch', 'menu-yaw', 'menu-roll',
      'menu-boost-key', 'menu-airbrake-key', 'menu-gear-key', 'menu-camera-sensitivity',
      'menu-camera-speed-framing', 'menu-camera-auto-return', 'menu-camera-effects']) {
      expect(html.split(`id="${id}"`), id).toHaveLength(2)
      expect(root, id).toContain(`id="${id}"`)
      if (id !== 'menu-reset-settings') expect(root, id).toContain(`for="${id}"`)
    }
    for (const name of ['general', 'controls', 'camera', 'course']) {
      expect(root).toContain(`data-settings-tab="${name}"`)
      expect(root).toContain(`data-settings-panel="${name}"`)
    }
    expect(root).toContain('settings-card-grid')
    expect(root).toContain('Blackout / Flight deck')
  })

  it('styles native popup surfaces with a fallback and fixed desktop settings navigation', () => {
    const css = read('src/ui/settingsDeck.css')
    expect(read('index.html')).toContain('href="/src/ui/settingsDeck.css"')
    expect(css).toContain('@supports (appearance: base-select)')
    expect(css).toContain('select::picker(select)')
    expect(css).toContain('option:checked')
    expect(css).toContain('var(--amber-soft)')
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr) auto')
    expect(css).toContain('@media (max-height: 650px)')
    expect(css).not.toMatch(/@keyframes|#[0-9a-f]{3,8}\b|url\(/i)
  })
})
