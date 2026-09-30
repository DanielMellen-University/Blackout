import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEDGER_HUD_IDS, LIVE_HUD_IDS, liveHudViolations } from '../src/ui/liveHudBudget'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

describe('live HUD budget', () => {
  it('keeps speed, altitude, heading, attitude, throttle, one objective, and one warning', () => {
    expect(liveHudViolations(html, css)).toEqual([])
    for (const id of LIVE_HUD_IDS) expect(html).toContain(`id="${id}"`)
    for (const id of LEDGER_HUD_IDS) expect(html).toContain(`id="${id}"`)
  })

  it('does not let the flight loop unhide a ledger row by deleting the class', () => {
    const source = readFileSync(new URL('../src/ui/HUD.ts', import.meta.url), 'utf8')
    expect(source.includes("classList.remove('hud-ledger')")).toBe(false)
    expect(source.includes('classList.remove("hud-ledger")')).toBe(false)
  })

  it('keeps the touch utility deck compact on phone widths', () => {
    expect(css).toContain('grid-template-columns: repeat(4, minmax(36px, 1fr));')
    expect(css).toContain('width: min(200px, calc(100vw - 170px));')
    expect(css).toContain('@media (max-width: 370px)')
    expect(css).toContain('width: calc(100vw - 150px);')
  })
})
