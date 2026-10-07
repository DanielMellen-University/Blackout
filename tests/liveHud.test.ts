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
    expect(html).toContain('<details class="touch-utilities">')
    expect(html).toContain('<summary aria-label="More flight controls">TOOLS</summary>')
    expect(css).toContain('grid-template-columns: repeat(3, 44px)')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain('.touch-flight #overlay')
  })

  it('gives the compass and navigation independent grid ownership on short screens', () => {
    const layout = css.slice(css.indexOf('/* One flight-deck layout'))
    expect(layout).toContain('#heading-tape { grid-area: compass;')
    expect(layout).toContain('#nav-cue { grid-area: navigation;')
    expect(layout).toContain('"brand compass readouts"')
    expect(layout).toContain('"gauges navigation readouts"')
    expect(layout).toContain('"compass compass"')
    expect(layout).toContain('inset: auto;')
    expect(layout).toContain('transform: none;')
  })

  it('rejects hiding essential landing guidance or expanded debrief records', () => {
    const hiddenGlide = html.replace('id="nav-glide"', 'class="hud-ledger" id="nav-glide"')
    expect(liveHudViolations(hiddenGlide, css)).toContain('live instrument nav-glide is in the ledger')
    expect(liveHudViolations(html, `${css}\n.result-ledger { display: none !important; }`))
      .toContain('debrief records must remain accessible when expanded')
  })

  it('keeps landing and terrain warning cues visually distinct', () => {
    expect(css).toContain('.warn.caution.warning-low-alt')
    expect(css).toContain('.warn.caution.warning-flare')
    expect(css).toContain('.warn.warning.warning-go-around')
  })

  it('keeps debrief coaching visible and results scrollable on short screens', () => {
    const panel = css.match(/\.run-results-panel\s*\{[^}]*max-height:[^}]*\}/)?.[0] ?? ''
    expect(panel).toContain('max-height: calc(100dvh - 48px)')
    expect(panel).toContain('overflow-y: auto')
    for (const id of ['result-coaching', 'result-touchdown']) {
      const element = html.match(new RegExp(`<p[^>]*id="${id}"[^>]*>`))?.[0] ?? ''
      expect(element).not.toBe('')
      expect(element).not.toContain('result-ledger')
    }
  })
})
