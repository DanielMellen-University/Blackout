import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

describe('unified flight deck contracts', () => {
  it('has unique IDs and valid native label/dialog references', () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    const known = new Set(ids)
    expect(known.size).toBe(ids.length)
    for (const match of html.matchAll(/\b(?:for|aria-labelledby)="([^"]+)"/g)) {
      for (const id of match[1]!.split(/\s+/)) expect(known.has(id), id).toBe(true)
    }
  })

  it('keeps every touch action once while disclosing infrequent utilities', () => {
    const actions = [...html.matchAll(/data-touch-action="([^"]+)"/g)].map(match => match[1])
    expect(new Set(actions).size).toBe(actions.length)
    expect(actions.sort()).toEqual([
      'pitch-up', 'pitch-down', 'roll-left', 'roll-right', 'yaw-left', 'yaw-right',
      'throttle-down', 'throttle-up', 'airbrake', 'gear-toggle', 'camera-toggle',
      'stability-toggle', 'radar-cycle', 'weather-cycle', 'audio-toggle', 'ghost-toggle',
      'seed-copy', 'reset', 'pause-toggle', 'boost',
    ].sort())
    const disclosure = html.match(/<details class="touch-utilities">([\s\S]*?)<\/details>/)?.[1] ?? ''
    for (const action of ['stability-toggle', 'radar-cycle', 'weather-cycle', 'audio-toggle', 'ghost-toggle', 'seed-copy', 'reset']) {
      expect(disclosure).toContain(`data-touch-action="${action}"`)
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
