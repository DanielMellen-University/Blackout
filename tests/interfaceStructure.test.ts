import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

describe('unified flight deck contracts', () => {
  it('has unique IDs and valid native label/dialog references', () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    const known = new Set(ids)
    expect(known.size).toBe(ids.length)
    for (const match of html.matchAll(/\b(?:for|aria-labelledby|aria-controls)="([^"]+)"/g)) {
      for (const id of match[1]!.split(/\s+/)) expect(known.has(id), id).toBe(true)
    }
  })

  it('removes the touch deck and its runtime integration, not just its visibility', () => {
    expect(html).not.toContain('data-touch-action')
    expect(html).not.toContain('touch-controls')
    expect(css).not.toContain('.touch-')
    expect(css).not.toMatch(/max-width:\s*(?:370|380|400|560|600)px/)
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
    const input = readFileSync(new URL('../src/core/InputManager.ts', import.meta.url), 'utf8')
    expect(main).not.toContain('TouchControls')
    expect(main).not.toContain('touchDevice')
    expect(input).not.toContain('setTouchState')
  })

  it('opens one settings category and puts advanced controls in closed disclosures', () => {
    const panels = [...html.matchAll(/<section[^>]*data-settings-panel="([^"]+)"[^>]*>/g)]
    expect(panels.map(match => match[1])).toEqual(['general', 'controls', 'camera', 'course'])
    expect(panels.filter(match => !match[0].includes(' hidden'))).toHaveLength(1)
    for (const [name, id] of [['Key bindings', 'menu-gear-key'], ['Audio mix', 'menu-effects-volume'], ['Reset settings', 'menu-reset-settings']]) {
      const section = html.match(new RegExp(`<details class="settings-section">\\s*<summary>${name}</summary>([\\s\\S]*?)</details>`))?.[1]
      expect(section, name).toContain(`id="${id}"`)
    }
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr) auto')
    expect(css).toContain('.settings-content { overflow-y: auto; min-height: 0;')
  })

  it('rebuilds both instruments as matching rails with only blue and pale orange accents', () => {
    const cards = html.match(/<!-- Paired digital flight instruments[\s\S]*?<!-- Next-gate cue:/)?.[0] ?? ''
    expect(cards.match(/class="flight-instrument"/g)).toHaveLength(2)
    expect(cards.match(/class="instrument-rail"/g)).toHaveLength(2)
    expect(cards).not.toContain('<svg')
    expect(cards).not.toContain('spd-needle')
    expect(cards).toContain('id="spd-fill"')
    expect(cards).toContain('id="eng-fill"')
    const instrumentStyle = css.slice(css.indexOf('/* Paired desktop instruments'), css.indexOf('/* Keep the flight instruments usable'))
    expect(instrumentStyle).not.toContain('gradient')
    expect(instrumentStyle).not.toContain('shadow')
    expect(instrumentStyle).not.toContain('--danger')
    expect(instrumentStyle).toContain('background: var(--accent)')
    expect(instrumentStyle).toContain('background: var(--amber)')
    const speedRules = [...css.matchAll(/[^{}]*#speedo-panel[^{}]*\{([^{}]*)\}/g)].map(match => match[1]).join('\n')
    expect(speedRules).not.toContain('--danger')
    expect(speedRules).not.toContain('#fff0ed')
  })

  it('has no green or turquoise color literals in the shipped interface', () => {
    const debug = readFileSync(new URL('../src/debug/DebugOverlay.ts', import.meta.url), 'utf8')
    const source = `${css}\n${html}\n${debug}`
    const colors = [...source.matchAll(/(?:#|0x)([a-f\d]{6})\b/gi)].map(match => [0, 2, 4].map(offset => parseInt(match[1]!.slice(offset, offset + 2), 16)))
    for (const match of source.matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/g)) colors.push([+match[1]!, +match[2]!, +match[3]!])
    for (const [r, g, b] of colors) {
      const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), delta = max - min
      if (delta < 4) continue
      const sector = max === r ? (g! - b!) / delta : max === g ? (b! - r!) / delta + 2 : (r! - g!) / delta + 4
      const hue = (sector * 60 + 360) % 360
      expect(hue < 65 || hue > 195, `RGB ${r},${g},${b}`).toBe(true)
    }
  })

  it('has readable palette roles on the raised surface', () => {
    const luminance = (name: string): number => {
      const hex = css.match(new RegExp(`--${name}: #([a-f0-9]{6});`))?.[1]
      expect(hex, name).toBeDefined()
      const channels = [0, 2, 4].map(offset => {
        const value = parseInt(hex!.slice(offset, offset + 2), 16) / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    }
    const surface = luminance('surface-raised')
    for (const role of ['ink', 'ink-dim', 'ink-mute', 'accent', 'amber', 'danger', 'success']) {
      expect((luminance(role) + 0.05) / (surface + 0.05), role).toBeGreaterThanOrEqual(4.5)
    }
  })
})
